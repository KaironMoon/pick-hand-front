import { useEffect, useState, useCallback } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAtomValue, useSetAtom } from "jotai";
import { Box, CircularProgress } from "@mui/material";
import { userAtom, isAuthenticatedAtom, initAuthAtom } from "@/store/auth-store";
import { fetchBlockedGamesAtom } from "@/store/app-settings-store";
import authService from "@/services/auth-service";

// eslint-disable-next-line react/prop-types
function ProtectedRoute({ adminOnly = false }) {
  const user = useAtomValue(userAtom);
  const isAuthenticated = useAtomValue(isAuthenticatedAtom);
  const initAuth = useSetAtom(initAuthAtom);
  const fetchBlocked = useSetAtom(fetchBlockedGamesAtom);
  const [loading, setLoading] = useState(true);

  const initialize = useCallback(async () => {
    if (!isAuthenticated && authService.isAuthenticated()) {
      await initAuth();
    }
    setLoading(false);
  }, [isAuthenticated, initAuth]);

  useEffect(() => {
    initialize();
  }, [initialize]);

  // 1분마다 blocked_games 자동 갱신
  useEffect(() => {
    if (!isAuthenticated) return;
    fetchBlocked();
    const id = setInterval(() => fetchBlocked(), 60 * 1000);
    return () => clearInterval(id);
  }, [isAuthenticated, fetchBlocked]);


  if (loading) {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#000",
        }}
      >
        <CircularProgress sx={{ color: "#4caf50" }} />
      </Box>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && user?.role !== "admin") {
    return <Navigate to="/404" replace />;
  }

  return <Outlet />;
}

export default ProtectedRoute;
