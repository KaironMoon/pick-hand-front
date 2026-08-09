import { useCallback, useEffect, useState } from "react";
import {
  Alert, Box, Button, FormControlLabel, Paper, Switch, TextField, Typography,
} from "@mui/material";

import maintenanceService from "@/services/maintenance-service";

const toInputValue = (value) => value ? String(value).slice(0, 16) : "";

export default function MaintenanceAdminPage() {
  const [form, setForm] = useState({ enabled: false, starts_at: "", ends_at: "", message: "서비스 점검 중입니다." });
  const [users, setUsers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);

  const load = useCallback(async () => {
    const status = await maintenanceService.getStatus();
    setForm({
      enabled: !!status.enabled,
      starts_at: toInputValue(status.starts_at),
      ends_at: toInputValue(status.ends_at),
      message: status.message || "서비스 점검 중입니다.",
    });
    if (status.enabled) {
      const result = await maintenanceService.getRunningUsers();
      setUsers(result.users || []);
    } else setUsers([]);
  }, []);

  useEffect(() => {
    load().catch(() => setNotice({ severity: "error", text: "점검 상태를 불러오지 못했습니다." }));
    const timer = setInterval(() => {
      maintenanceService.getRunningUsers().then((result) => setUsers(result.users || [])).catch(() => {});
    }, 5000);
    return () => clearInterval(timer);
  }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      await maintenanceService.updateStatus({ ...form, starts_at: form.starts_at || null, ends_at: form.ends_at || null });
      setNotice({ severity: "success", text: "점검 설정을 저장했습니다." });
      await load();
    } catch {
      setNotice({ severity: "error", text: "점검 설정을 저장하지 못했습니다." });
    } finally { setSaving(false); }
  };

  const forceStop = async (item) => {
    if (!window.confirm(`${item.nickname || item.username} 계정의 Auto ${item.auto_count}개를 모두 강제 종료할까요?`)) return;
    try {
      const result = await maintenanceService.forceStopUser(item.user_id);
      setNotice({ severity: "success", text: `${result.stopped_count}개의 Auto를 종료했습니다.` });
      await load();
    } catch {
      setNotice({ severity: "error", text: "강제 종료에 실패했습니다." });
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 900 }}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>점검 관리</Typography>
      {notice && <Alert severity={notice.severity} sx={{ mb: 2 }} onClose={() => setNotice(null)}>{notice.text}</Alert>}
      <Paper sx={{ p: 3, mb: 3 }}>
        <FormControlLabel control={<Switch checked={form.enabled} onChange={(e) => setForm((p) => ({ ...p, enabled: e.target.checked }))} />} label={form.enabled ? "점검 모드 ON" : "점검 모드 OFF"} />
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2, my: 2 }}>
          <TextField label="안내 시작 시각" type="datetime-local" value={form.starts_at} onChange={(e) => setForm((p) => ({ ...p, starts_at: e.target.value }))} InputLabelProps={{ shrink: true }} />
          <TextField label="안내 종료 시각" type="datetime-local" value={form.ends_at} onChange={(e) => setForm((p) => ({ ...p, ends_at: e.target.value }))} InputLabelProps={{ shrink: true }} />
        </Box>
        <TextField fullWidth multiline minRows={3} label="점검 메시지" value={form.message} onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))} />
        <Button variant="contained" sx={{ mt: 2 }} disabled={saving} onClick={save}>저장</Button>
      </Paper>

      {form.enabled && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>Auto 플레이 중인 계정 ({users.length})</Typography>
          {users.length === 0 ? <Typography color="text.secondary">진행 중인 Auto가 없습니다.</Typography> : users.map((item) => (
            <Box key={item.user_id} sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, py: 1.5, borderBottom: "1px solid #444" }}>
              <Box>
                <Typography sx={{ fontWeight: 700 }}>{item.nickname || item.username} <Typography component="span" variant="caption">({item.role})</Typography></Typography>
                <Typography variant="body2" color="text.secondary">{item.username} · Auto {item.auto_count}개</Typography>
              </Box>
              <Button color="error" variant="contained" onClick={() => forceStop(item)}>전체 강제 종료</Button>
            </Box>
          ))}
        </Paper>
      )}
    </Box>
  );
}
