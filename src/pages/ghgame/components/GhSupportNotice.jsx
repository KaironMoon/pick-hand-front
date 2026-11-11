import { useCallback, useState } from "react";
import { Alert, Box, ButtonBase, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { GH_SUPPORT_API, useSupportPoll } from "@/services/gh-support-service";
import GhSupportChat from "./GhSupportChat";

export default function GhSupportNotice({ isAdmin }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [revision, setRevision] = useState(0);
  const { data, error } = useSupportPoll(`${GH_SUPPORT_API}/status`, 10000, revision);
  const refresh = useCallback(() => setRevision((current) => current + 1), []);
  const interactive = isAdmin || data?.can_chat;

  if (!data && !isAdmin) {
    return error ? <Alert severity="warning">공지를 불러오지 못했습니다.</Alert> : null;
  }

  return (
    <>
      <Box
        component={interactive ? ButtonBase : "div"}
        onClick={interactive ? () => isAdmin ? navigate("/gh-support-admin") : setOpen(true) : undefined}
        sx={{
          display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 0.4,
          width: "100%", minHeight: 56, boxSizing: "border-box", px: 1.25, py: 0.75,
          bgcolor: "background.paper", border: 1, borderColor: "divider", borderRadius: 1,
          textAlign: "left", overflowWrap: "anywhere", "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main" },
        }}
      >
        <Typography component="span" variant="caption" color="primary.main" fontWeight={700}>
          {data?.notice ? "공지" : "관리자 상담"}
        </Typography>
        {data?.notice && <Typography component="span" variant="body2" sx={{ whiteSpace: "pre-wrap" }}>{data.notice}</Typography>}
        <Typography component="span" variant="caption" color={data?.has_unread ? "primary.main" : "text.secondary"}>
          {isAdmin ? "공지·상담 관리" : data?.has_unread ? "새 답장 확인" : data?.can_chat ? "1:1 대화 열기" : "현재 상담을 이용할 수 없습니다."}
        </Typography>
      </Box>
      {open && (
        <GhSupportChat
          path={`${GH_SUPPORT_API}/messages`}
          title="관리자 1:1 상담"
          onRead={refresh}
          onClose={() => { setOpen(false); refresh(); }}
        />
      )}
    </>
  );
}
