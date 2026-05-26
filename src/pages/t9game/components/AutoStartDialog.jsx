/**
 * Auto 시작 모달 — mvp-aboo-integration.md §5.1 step 3.
 *
 * 동작:
 *  - 열림 시 /auth/session-status 로 JSESSIONID 캡처 상태 확인.
 *  - 캡처 없거나 expired → "캡처 필요" 안내 + 입력 비활성.
 *  - 캡처 OK → table_id / server 입력 + "자동 베팅 시작" 활성.
 *  - 시작 호출 후 부모에서 폴링 시작.
 */
import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import autoService from "@/services/auto-service";

const formatAge = (sec) => {
  if (sec == null) return "";
  if (sec < 60) return `${sec}초 전`;
  if (sec < 3600) return `${Math.floor(sec / 60)}분 전`;
  return `${Math.floor(sec / 3600)}시간 전`;
};

const AutoStartDialog = ({ open, onClose, onStarted, gameId, pragmaticId }) => {
  const [sessionInfo, setSessionInfo] = useState(null);
  const [tableId, setTableId] = useState("");
  const [server, setServer] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [featureDisabled, setFeatureDisabled] = useState(false);

  useEffect(() => {
    if (!open) {
      setError(null);
      setBusy(false);
      return;
    }
    if (!pragmaticId) {
      setError("프로필에서 pragmatic_id를 먼저 등록하세요");
      setSessionInfo(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const info = await autoService.getSessionStatus(pragmaticId);
        if (!cancelled) setSessionInfo(info);
      } catch (e) {
        if (cancelled) return;
        if (e?.response?.status === 503) {
          setFeatureDisabled(true);
        } else {
          setError("세션 상태 조회 실패");
        }
      }
    })();
    return () => { cancelled = true; };
  }, [open, pragmaticId]);

  const handleStart = async () => {
    setError(null);
    setBusy(true);
    try {
      const resp = await autoService.startAuto({
        gameId,
        pragmaticId,
        tableId: tableId.trim(),
        server: server.trim() || null,
      });
      onStarted?.(resp);
      onClose?.();
    } catch (e) {
      const detail = e?.response?.data?.detail;
      if (detail?.error === "session_required") {
        setError("JSESSIONID가 만료되었습니다. 모바일 앱에서 재캡처하세요");
      } else if (detail?.error === "auto_session_already_running") {
        setError("이미 자동 베팅이 실행 중입니다");
      } else if (e?.response?.status === 503) {
        setFeatureDisabled(true);
      } else {
        setError(detail?.error || "시작 실패");
      }
    } finally {
      setBusy(false);
    }
  };

  const isCaptureOk = sessionInfo?.captured && sessionInfo?.status === "fresh";
  const canStart = !!pragmaticId && isCaptureOk && tableId.trim().length > 0 && !busy;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>자동 베팅 시작</DialogTitle>
      <DialogContent>
        {featureDisabled && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            자동 베팅 기능이 비활성화되어 있습니다 (운영자 문의)
          </Alert>
        )}
        {!featureDisabled && !pragmaticId && (
          <Alert severity="info" sx={{ mb: 2 }}>
            프로필에서 pragmatic_id를 등록한 뒤 다시 시도하세요
          </Alert>
        )}
        {!featureDisabled && sessionInfo && (
          <Stack spacing={1} sx={{ mb: 2 }}>
            <Typography variant="body2">
              JSESSIONID:&nbsp;
              {isCaptureOk
                ? `캡처됨 (${formatAge(sessionInfo.age_seconds)})`
                : "캡처 필요 / 만료"}
            </Typography>
            {!isCaptureOk && (
              <Alert severity="warning">모바일 앱에서 JSESSIONID를 캡처하세요</Alert>
            )}
          </Stack>
        )}
        <Stack spacing={2}>
          <TextField
            label="table_id"
            value={tableId}
            onChange={(e) => setTableId(e.target.value)}
            disabled={!isCaptureOk || busy}
            size="small"
            autoFocus
          />
          <TextField
            label="server (선택)"
            value={server}
            onChange={(e) => setServer(e.target.value)}
            disabled={!isCaptureOk || busy}
            size="small"
          />
        </Stack>
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>취소</Button>
        <Button onClick={handleStart} disabled={!canStart} variant="contained">
          자동 베팅 시작
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AutoStartDialog;
