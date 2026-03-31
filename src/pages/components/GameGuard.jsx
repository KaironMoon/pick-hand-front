import { useEffect, useState } from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { useAtomValue, useSetAtom } from "jotai";
import { userAtom } from "@/store/auth-store";
import { blockedGamesAtom, fetchBlockedGamesAtom } from "@/store/app-settings-store";

// eslint-disable-next-line react/prop-types
function GameGuard({ gameType, children }) {
  const user = useAtomValue(userAtom);
  const blockedGames = useAtomValue(blockedGamesAtom);
  const fetchBlocked = useSetAtom(fetchBlockedGamesAtom);
  const navigate = useNavigate();
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetchBlocked().then(() => setLoaded(true));
  }, [fetchBlocked]);

  if (!loaded) return null;

  const blocked = user?.role !== "admin" && blockedGames.includes(gameType);

  if (blocked) {
    return (
      <Dialog
        open
        PaperProps={{
          sx: {
            backgroundColor: "background.paper",
            border: "1px solid #333",
            minWidth: 320,
            textAlign: "center",
          },
        }}
      >
        <DialogTitle sx={{ color: "text.primary", fontWeight: 600 }}>
          준비중입니다
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: "text.secondary" }}>
            현재 이 게임은 이용할 수 없습니다.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ justifyContent: "center", pb: 2 }}>
          <Button
            variant="contained"
            onClick={() => navigate("/", { replace: true })}
            sx={{ backgroundColor: "#2e7d32", "&:hover": { backgroundColor: "#1b5e20" } }}
          >
            돌아가기
          </Button>
        </DialogActions>
      </Dialog>
    );
  }

  return children;
}

export default GameGuard;
