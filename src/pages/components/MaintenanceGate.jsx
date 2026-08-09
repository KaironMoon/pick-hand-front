import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAtomValue } from "jotai";
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from "@mui/material";

import { userAtom } from "@/store/auth-store";
import maintenanceService from "@/services/maintenance-service";

const WARNING_TEXT = "진행 중인 Auto를 30분 이내에 종료해 주세요. 기한 내 종료하지 않을 경우 강제 종료될 수 있으며, 강제 종료로 발생한 손실에 대해서는 책임지지 않습니다.";

export default function MaintenanceGate({ children }) {
  const user = useAtomValue(userAtom);
  const location = useLocation();
  const [status, setStatus] = useState(null);
  const [warningOpen, setWarningOpen] = useState(false);
  const warnedVersionRef = useRef(null);

  const refresh = useCallback(async () => {
    try {
      const next = await maintenanceService.getStatus();
      setStatus(next);
      if (next.enabled && next.running_auto_count > 0 && user?.role !== "admin") {
        const version = next.updated_at || "enabled";
        if (warnedVersionRef.current !== version) {
          warnedVersionRef.current = version;
          setWarningOpen(true);
        }
      }
      if (!next.enabled) warnedVersionRef.current = null;
    } catch {
      // 점검 상태 조회 장애가 일반 서비스 전체 차단으로 이어지지 않게 fail-open.
      setStatus((prev) => prev || { enabled: false });
    }
  }, [user?.role]);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 5000);
    return () => clearInterval(timer);
  }, [refresh]);

  const content = children || <Outlet />;
  if (user?.role === "admin") return content;
  if (!status) return null;
  if (status.enabled && Number(status.running_auto_count || 0) === 0 && location.pathname !== "/maintenance") {
    return <Navigate to="/maintenance" replace />;
  }
  if (!status.enabled && location.pathname === "/maintenance") {
    return <Navigate to="/" replace />;
  }

  return (
    <>
      {content}
      <Dialog open={warningOpen} onClose={() => setWarningOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ color: "#f44336", fontWeight: 700 }}>서비스 점검 안내</DialogTitle>
        <DialogContent>
          {status.message && <Typography sx={{ mb: 2, whiteSpace: "pre-wrap" }}>{status.message}</Typography>}
          <Typography sx={{ fontWeight: 700 }}>{WARNING_TEXT}</Typography>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={() => setWarningOpen(false)}>확인</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
