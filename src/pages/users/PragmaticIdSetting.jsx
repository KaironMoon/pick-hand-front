/**
 * 본인 pragmatic_id 등록/해제 — mvp-aboo-integration.md §4.5.
 *
 * 어드민 페이지 안 별도 화면으로 노출하거나 마이페이지 메뉴에 추가. 본 컴포넌트는
 * 단독 마운트도 가능하도록 작성.
 */
import { useState } from "react";
import { Alert, Box, Button, Stack, TextField, Typography } from "@mui/material";
import autoService from "@/services/auto-service";

const PragmaticIdSetting = ({ currentValue = "", onUpdated }) => {
  const [value, setValue] = useState(currentValue || "");
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);

  const handleSave = async () => {
    setStatus(null);
    setBusy(true);
    try {
      const resp = await autoService.updatePragmaticId(value.trim() || null);
      setStatus({ ok: true, msg: resp.pragmatic_id ? `등록됨: ${resp.pragmatic_id}` : "해제됨" });
      onUpdated?.(resp.pragmatic_id);
    } catch (e) {
      const detail = e?.response?.data?.detail;
      if (e?.response?.status === 503) {
        setStatus({ ok: false, msg: "자동 베팅 기능 비활성화" });
      } else if (e?.response?.status === 409) {
        setStatus({ ok: false, msg: "이미 사용 중인 pragmatic_id" });
      } else {
        setStatus({ ok: false, msg: detail || "저장 실패" });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 480, p: 2 }}>
      <Typography variant="h6" gutterBottom>Pragmatic 계정 연결</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        자동 베팅 사용 시 모바일 앱이 같은 pragmatic_id로 JSESSIONID를 보냅니다.
      </Typography>
      <Stack direction="row" spacing={1}>
        <TextField
          label="pragmatic_id"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          size="small"
          fullWidth
        />
        <Button onClick={handleSave} variant="contained" disabled={busy}>
          저장
        </Button>
      </Stack>
      {status && (
        <Alert severity={status.ok ? "success" : "error"} sx={{ mt: 2 }}>
          {status.msg}
        </Alert>
      )}
    </Box>
  );
};

export default PragmaticIdSetting;
