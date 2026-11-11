import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Alert, Box, Button, Dialog, DialogContent, DialogTitle, Stack, TextField, Typography } from "@mui/material";
import apiCaller from "@/services/api-caller";
import { supportError, useSupportPoll } from "@/services/gh-support-service";

const EMPTY_MESSAGES = [];

export default function GhSupportChat({ path, title, admin = false, onClose, onRead }) {
  const [revision, setRevision] = useState(0);
  const { data, error } = useSupportPoll(path, 3000, revision);
  const messages = data ?? EMPTY_MESSAGES;
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const history = useRef(null);
  const followLatest = useRef(true);
  const acknowledged = useRef(new Set());
  const lastMessageId = messages.at(-1)?.id;

  useLayoutEffect(() => {
    if (followLatest.current && history.current) history.current.scrollTop = history.current.scrollHeight;
  }, [lastMessageId]);

  useEffect(() => {
    if (!history.current || !messages.length) return undefined;
    const activeIds = new Set(messages.filter((message) => !message.read_at).map((message) => message.id));
    for (const id of acknowledged.current) {
      if (!activeIds.has(id)) acknowledged.current.delete(id);
    }

    const controller = new AbortController();
    const visible = new Set();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const id = entry.target.dataset.unreadId;
        if (entry.isIntersecting) visible.add(id);
        else visible.delete(id);
      }
      markVisible();
    }, { root: history.current });

    function markVisible() {
      if (document.hidden || !document.hasFocus()) return;
      const ids = [...visible].filter((id) => !acknowledged.current.has(id));
      if (!ids.length) return;
      for (const id of ids) acknowledged.current.add(id);
      apiCaller.post(`${path}/read`, { ids }).then(() => {
        if (!controller.signal.aborted) onRead?.();
      }).catch(() => {
        for (const id of ids) acknowledged.current.delete(id);
      });
    }

    for (const item of history.current.querySelectorAll("[data-unread-id]")) observer.observe(item);
    document.addEventListener("visibilitychange", markVisible);
    window.addEventListener("focus", markVisible);
    return () => {
      controller.abort();
      observer.disconnect();
      document.removeEventListener("visibilitychange", markVisible);
      window.removeEventListener("focus", markVisible);
    };
  }, [messages, onRead, path]);

  const send = async (event) => {
    event.preventDefault();
    if (sending || !draft.trim()) return;
    setSending(true);
    setSendError("");
    try {
      await apiCaller.post(path, { body: draft });
      setDraft("");
      followLatest.current = true;
      setRevision((current) => current + 1);
    } catch (error) {
      setSendError(supportError(error, "메시지를 보내지 못했습니다."));
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
        {title}
        <Button onClick={onClose}>닫기</Button>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={1.5}>
          {error && <Alert severity="error">{supportError(error, "대화를 불러오지 못했습니다.")}</Alert>}
          <Box
            ref={history}
            aria-label="메시지 목록"
            onScroll={(event) => {
              const element = event.currentTarget;
              followLatest.current = element.scrollHeight - element.scrollTop - element.clientHeight < 32;
            }}
            sx={{ height: 320, overflowY: "auto", border: 1, borderColor: "divider", borderRadius: 1, p: 1.5 }}
          >
            {messages.length === 0 && !error && (
              <Typography color="text.secondary">{data ? "대화가 없습니다." : "대화를 불러오는 중입니다."}</Typography>
            )}
            <Stack spacing={1.25} alignItems="stretch">
              {messages.map((message) => {
                const sent = message.from_admin === admin;
                return (
                  <Box
                    key={message.id}
                    data-unread-id={!sent && !message.read_at ? message.id : undefined}
                    sx={{
                      alignSelf: sent ? "flex-end" : "flex-start", maxWidth: "85%", px: 1.25, py: 0.75,
                      bgcolor: sent ? "action.selected" : "action.hover", borderRadius: 1.5, overflowWrap: "anywhere",
                    }}
                  >
                    <Typography sx={{ whiteSpace: "pre-wrap" }}>{message.body}</Typography>
                    <Typography component="div" variant="caption" color="text.secondary">
                      {new Date(message.sent_at).toLocaleString("ko-KR")}
                      {sent && (message.read_at ? " · 읽음" : " · 안 읽음")}
                    </Typography>
                  </Box>
                );
              })}
            </Stack>
          </Box>
          {sendError && <Alert severity="error">{sendError}</Alert>}
          <Stack component="form" direction="row" alignItems="flex-end" spacing={1} onSubmit={send}>
            <TextField
              fullWidth multiline maxRows={5} size="small" label="메시지"
              value={draft} onChange={(event) => setDraft(event.target.value)} disabled={sending || !data}
            />
            <Button type="submit" variant="contained" disabled={!data || sending || !draft.trim()} sx={{ flexShrink: 0 }}>
              보내기
            </Button>
          </Stack>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
