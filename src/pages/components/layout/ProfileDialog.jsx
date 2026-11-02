import { useEffect, useState } from "react";
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Link, TextField } from "@mui/material";
import { useSetAtom } from "jotai";
import { userAtom } from "@/store/auth-store";
import apiCaller from "@/services/api-caller";
import { USERS_API } from "@/constants/api-url";

export default function ProfileDialog({ open, onClose }) {
  const setUser = useSetAtom(userAtom);
  const [form, setForm] = useState({ nickname: "", telegram_chat_id: "", password: "" });
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    setLoaded(false);
    setError("");
    setForm({ nickname: "", telegram_chat_id: "", password: "" });
    apiCaller.get(USERS_API.PROFILE).then(({ data }) => {
      if (active) {
        setForm({ nickname: data.nickname, telegram_chat_id: data.telegram_chat_id, password: "" });
        setLoaded(true);
      }
    }).catch(() => {
      if (active) setError("내 정보를 불러오지 못했습니다. 창을 다시 열어 주세요.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [open]);

  const handleSave = async (event) => {
    event.preventDefault();
    if (!loaded || saving) return;
    setSaving(true);
    setError("");
    try {
      const payload = { nickname: form.nickname, telegram_chat_id: form.telegram_chat_id.trim() };
      if (form.password.trim()) payload.password = form.password;
      const { data } = await apiCaller.put(USERS_API.PROFILE, payload);
      setUser((current) => ({ ...current, nickname: data.nickname }));
      setForm((current) => ({ ...current, password: "" }));
      onClose();
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "내 정보를 저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="xs">
      <form onSubmit={handleSave}>
        <DialogTitle>내 정보 수정</DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
          {loading && <Alert severity="info">내 정보를 불러오는 중입니다.</Alert>}
          <TextField fullWidth label="닉네임" value={form.nickname} margin="dense" disabled={!loaded || saving}
            onChange={(event) => setForm((current) => ({ ...current, nickname: event.target.value }))} />
          <TextField fullWidth label="텔레그램 채팅 ID" value={form.telegram_chat_id} margin="dense" disabled={!loaded || saving}
            onChange={(event) => setForm((current) => ({ ...current, telegram_chat_id: event.target.value }))}
            helperText={<><Link href="https://t.me/pick_hand_bot" target="_blank" rel="noopener noreferrer">픽미알림봇(@pick_hand_bot)</Link>에서 시작(Start)을 누른 뒤 알림을 받을 숫자 채팅 ID를 입력하세요. 빈 값은 알림 해제입니다.</>} />
          <TextField fullWidth label="새 비밀번호 (변경 시에만 입력)" type="password" autoComplete="new-password"
            value={form.password} margin="dense" disabled={!loaded || saving}
            onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose} disabled={saving}>취소</Button>
          <Button type="submit" variant="contained" disabled={!loaded || saving}>
            {saving ? "저장 중..." : "저장"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
