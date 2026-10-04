import { useState } from "react";
import { useAtomValue } from "jotai";
import { Alert, Box, Button, Typography } from "@mui/material";
import { userAtom } from "@/store/auth-store";
import authService from "@/services/auth-service";

export default function ImpersonationBanner() {
  const user = useAtomValue(userAtom);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!user?.impersonator) return null;

  const returnToAdmin = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await authService.stopImpersonating();
      window.location.replace("/users");
    } catch (err) {
      setError(err.response?.data?.detail || err.message || "관리자 계정 복귀에 실패했습니다.");
      setBusy(false);
    }
  };

  return (
    <Box sx={{ px: { xs: 1, md: 2 }, py: 1, bgcolor: "background.paper" }}>
      <Alert severity="info" sx={{ alignItems: "center" }}>
        <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1 }}>
          <Typography variant="body2">
            {user.nickname ? `${user.nickname} (${user.username})` : user.username} 계정으로 접속 중
          </Typography>
          <Button size="small" variant="outlined" onClick={returnToAdmin} disabled={busy}>
            {busy ? "복귀 중…" : "관리자로 돌아가기"}
          </Button>
        </Box>
      </Alert>
      {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
    </Box>
  );
}
