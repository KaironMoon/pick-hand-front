import { useEffect, useState, useCallback } from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { useSetAtom } from "jotai";
import { forceRefreshBlockedGamesAtom } from "@/store/app-settings-store";

function GameBlockedDialog() {
  const navigate = useNavigate();
  const forceRefresh = useSetAtom(forceRefreshBlockedGamesAtom);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [redirect, setRedirect] = useState("/");

  const handleEvent = useCallback((e) => {
    setMessage(e.detail.message || "현재 이 게임은 이용할 수 없습니다.");
    setRedirect(e.detail.redirect || "/");
    setOpen(true);
  }, []);

  useEffect(() => {
    window.addEventListener("game-blocked", handleEvent);
    return () => window.removeEventListener("game-blocked", handleEvent);
  }, [handleEvent]);

  const handleClose = () => {
    setOpen(false);
    forceRefresh();
    navigate(redirect, { replace: true });
  };

  return (
    <Dialog
      open={open}
      PaperProps={{
        sx: { backgroundColor: "background.paper", border: "1px solid #333", minWidth: 320, textAlign: "center" },
      }}
    >
      <DialogTitle sx={{ color: "text.primary", fontWeight: 600 }}>준비중입니다</DialogTitle>
      <DialogContent>
        <Typography sx={{ color: "text.secondary" }}>{message}</Typography>
      </DialogContent>
      <DialogActions sx={{ justifyContent: "center", pb: 2 }}>
        <Button
          variant="contained"
          onClick={handleClose}
          sx={{ backgroundColor: "#2e7d32", "&:hover": { backgroundColor: "#1b5e20" } }}
        >
          확인
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default GameBlockedDialog;
