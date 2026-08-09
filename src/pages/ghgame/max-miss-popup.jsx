import { useCallback, useEffect, useState } from "react";
import { Alert, Box, CircularProgress } from "@mui/material";
import { useSearchParams } from "react-router-dom";

import apiCaller from "@/services/api-caller";
import { GH_GAMES_API } from "@/constants/api-url";
import GhMaxMissPanel from "./components/GhMaxMissDialog.jsx";

export default function GhMaxMissPopupPage() {
  const [searchParams] = useSearchParams();
  const gameId = Number(searchParams.get("gameId"));
  const replayRound = Number(searchParams.get("round")) || null;
  const [roundState, setRoundState] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!gameId) {
      setError("게임 ID가 없습니다.");
      return;
    }
    try {
      const response = replayRound
        ? await apiCaller.get(GH_GAMES_API.REPLAY(gameId), { round_num: replayRound })
        : await apiCaller.get(`${GH_GAMES_API.STATE(gameId)}?mode=user`);
      setRoundState(response.data?.round_state_lower || null);
      setError("");
      document.title = `고연패 현황 #${gameId}${replayRound ? ` · ${replayRound}회차` : ""}`;
    } catch (err) {
      setError(err.response?.data?.detail || "고연패 현황을 불러오지 못했습니다.");
    }
  }, [gameId, replayRound]);

  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      if (!cancelled) load();
    };
    refresh();
    const timer = replayRound ? null : setInterval(refresh, 3000);
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [load, replayRound]);

  if (error) return <Alert severity="error">{error}</Alert>;
  if (!roundState) {
    return <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", backgroundColor: "#0d0f12" }}><CircularProgress /></Box>;
  }
  return <GhMaxMissPanel roundState={roundState} gameId={gameId} replayRound={replayRound} />;
}
