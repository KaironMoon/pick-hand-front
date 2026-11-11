import { useCallback, useEffect, useState } from "react";
import { Alert, Box, Button, Chip, List, ListItemButton, ListItemText, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";
import { useAtomValue } from "jotai";
import { Navigate } from "react-router-dom";
import apiCaller from "@/services/api-caller";
import { GH_SUPPORT_API, supportAdminUsername, supportError, useSupportPoll } from "@/services/gh-support-service";
import { userAtom } from "@/store/auth-store";
import GhSupportChat from "../ghgame/components/GhSupportChat";

const ADMIN_API = `${GH_SUPPORT_API}/admin`;

function SupportInbox({ adminId }) {
  const [selected, setSelected] = useState(null);
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((current) => current + 1), []);
  const { data: inbox, error } = useSupportPoll(adminId ? `${ADMIN_API}/inbox` : null, 4000, revision);
  const canChat = adminId && error?.response?.status !== 403;

  return (
    <Paper component="section" variant="outlined" sx={{ p: 2 }}>
      <Typography component="h2" variant="h6">상담함</Typography>
      {!canChat ? (
        <Typography color="text.secondary">지정된 상담 담당 관리자 계정으로 상담함을 열 수 있습니다.</Typography>
      ) : error ? (
        <Alert severity="error">{supportError(error, "상담함을 불러오지 못했습니다.")}</Alert>
      ) : inbox?.length ? (
        <List disablePadding>
          {inbox.map((entry) => (
            <ListItemButton key={entry.id} onClick={() => setSelected(entry)}>
              <ListItemText
                primary={entry.nickname || entry.username}
                secondary={entry.nickname ? entry.username : undefined}
              />
              {entry.has_unread && <Chip size="small" color="primary" label="새 메시지" />}
            </ListItemButton>
          ))}
        </List>
      ) : (
        <Typography color="text.secondary">{inbox ? "대화가 없습니다." : "상담함을 불러오는 중입니다."}</Typography>
      )}
      {canChat && selected && (
        <GhSupportChat
          key={selected.id}
          path={`${ADMIN_API}/inbox/${selected.id}`}
          title={`${selected.nickname || selected.username}님과의 상담`}
          admin
          onRead={refresh}
          onClose={() => { setSelected(null); refresh(); }}
        />
      )}
    </Paper>
  );
}

function SupportAdmin({ username }) {
  const [settings, setSettings] = useState(null);
  const [notice, setNotice] = useState("");
  const [assignees, setAssignees] = useState(["", ""]);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    apiCaller.get(`${ADMIN_API}/settings`, {}, { signal: controller.signal }).then(({ data }) => {
      setSettings(data);
      setNotice(data.notice);
      setAssignees(data.admin_ids.map((id) => data.admins.some((admin) => admin.id === id) ? id : ""));
    }).catch((error) => {
      if (!controller.signal.aborted) {
        setFeedback({ severity: "error", text: supportError(error, "공지·상담 설정을 불러오지 못했습니다.") });
      }
    });
    return () => controller.abort();
  }, []);

  const saveNotice = async (text) => {
    setSaving(true);
    setFeedback(null);
    try {
      const { data } = await apiCaller.put(`${ADMIN_API}/notice`, { notice: text });
      setSettings((current) => ({ ...current, notice: data.notice }));
      setNotice(data.notice);
      setFeedback({ severity: "success", text: data.notice ? "공지를 저장했습니다." : "공지를 삭제했습니다." });
    } catch (error) {
      setFeedback({ severity: "error", text: supportError(error, "공지를 저장하지 못했습니다.") });
    } finally {
      setSaving(false);
    }
  };

  const saveAssignees = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      const { data } = await apiCaller.put(`${ADMIN_API}/assignees`, { admin_ids: assignees });
      setSettings((current) => ({ ...current, admin_ids: data.admin_ids }));
      setFeedback({ severity: "success", text: "상담 담당 관리자를 저장했습니다." });
    } catch (error) {
      setFeedback({ severity: "error", text: supportError(error, "상담 담당 관리자를 저장하지 못했습니다.") });
    } finally {
      setSaving(false);
    }
  };

  const activeAdminId = settings?.admins.find(({ id, username: name }) => (
    name === username && settings.admin_ids.includes(id)
  ))?.id;

  return (
    <Stack spacing={2} sx={{ maxWidth: 720 }}>
      <Typography component="h1" variant="h5">GH 공지·상담 관리</Typography>
      {feedback && <Alert severity={feedback.severity} onClose={() => setFeedback(null)}>{feedback.text}</Alert>}
      {!settings ? (
        !feedback && <Typography color="text.secondary">설정을 불러오는 중입니다.</Typography>
      ) : (
        <>
          <SupportInbox key={activeAdminId ?? "unassigned"} adminId={activeAdminId} />
          <Paper component="section" variant="outlined" sx={{ p: 2 }}>
            <Stack spacing={1.5}>
              <Typography component="h2" variant="h6">공지</Typography>
              <TextField
                label="GH 게임에 표시할 공지"
                multiline minRows={2} fullWidth value={notice} disabled={saving}
                onChange={(event) => setNotice(event.target.value)}
              />
              <Stack direction="row" spacing={1}>
                <Button variant="contained" disabled={saving || !notice.trim() || notice.trim() === settings.notice} onClick={() => saveNotice(notice)}>
                  공지 저장
                </Button>
                <Button color="error" disabled={saving || !settings.notice} onClick={() => saveNotice("")}>공지 삭제</Button>
              </Stack>
            </Stack>
          </Paper>
          <Paper component="section" variant="outlined" sx={{ p: 2 }}>
            <Stack spacing={1.5}>
              <Typography component="h2" variant="h6">상담 담당 관리자</Typography>
              {assignees.map((id, index) => (
                <TextField
                  key={index} select label={`담당 관리자 ${index + 1}`} value={id} disabled={saving}
                  onChange={(event) => setAssignees((current) => (
                    current.map((value, position) => position === index ? event.target.value : value)
                  ))}
                >
                  {settings.admins.map((admin) => (
                    <MenuItem key={admin.id} value={admin.id} disabled={admin.id === assignees[1 - index]}>
                      {admin.nickname ? `${admin.nickname} (${admin.username})` : admin.username}
                    </MenuItem>
                  ))}
                </TextField>
              ))}
              <Box>
                <Button
                  variant="contained" onClick={saveAssignees}
                  disabled={saving || assignees.some((id) => !id) || assignees.every((id, index) => id === settings.admin_ids[index])}
                >
                  담당 관리자 저장
                </Button>
              </Box>
            </Stack>
          </Paper>
        </>
      )}
    </Stack>
  );
}

export default function GhSupportAdminPage() {
  const user = useAtomValue(userAtom);
  const username = supportAdminUsername(user);
  if (!username) return <Navigate to="/" replace />;
  return <SupportAdmin key={username} username={username} />;
}
