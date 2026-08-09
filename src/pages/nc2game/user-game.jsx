import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControlLabel, MenuItem, TextField, Typography, useMediaQuery, useTheme,
} from "@mui/material";
import { useAtomValue } from "jotai";
import { useNavigate, useSearchParams } from "react-router-dom";

import { userAtom } from "@/store/auth-store";
import apiCaller from "@/services/api-caller";
import autoService from "@/services/auto-service";
import AutoStartDialog from "../t9game/components/AutoStartDialog";
import { Nc2BettingSummaryPanel, Nc2Circle, Nc2RoundAmountTable, calculateNc2CircleGrid } from "./components/Nc2GameBoards.jsx";
import { NC2_GAMES_API } from "@/constants/api-url";

const zoneColor = { blue: "#42a5f5", white: "#fff", red: "#ef5350" };
const resultCellColor = { hit: "#00e676", miss: "#ffeb3b", wait: "#fff" };
const GRID_ROWS = 6;
const GRID_COLS = 40;

const buildShoePreviewGrid = (actuals) => {
  const cols = Math.max(1, Math.ceil((actuals?.length || 0) / GRID_ROWS));
  return Array.from({ length: GRID_ROWS }, (_, row) =>
    Array.from({ length: cols }, (__, col) => actuals?.[col * GRID_ROWS + row] || null)
  );
};

function PickChip({ value }) {
  if (!value) return null;
  return (
    <Box sx={{
      width: 22, height: 22, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
      color: "#fff", fontWeight: 900, fontSize: 11, backgroundColor: value === "P" ? "#1565c0" : "#e53935",
    }}>{value}</Box>
  );
}

function Nc2Grid({ state }) {
  const actuals = state?.actuals || "";
  const sortedItems = [...(state?.items || [])].sort(
    (left, right) => Number(left.game_seq || 0) - Number(right.game_seq || 0),
  );
  const infoWidths = [30, 58, 42, 48, 40, 50];
  const progressRoundIndex = Number(state?.round_num || 0) < 60 ? Number(state?.round_num || 0) : -1;
  return (
    <Box sx={{ overflow: "auto", maxHeight: "62vh", border: "1px solid #59616d", backgroundColor: "#101318" }}>
      <Box component="table" sx={{ borderCollapse: "separate", borderSpacing: 0, tableLayout: "fixed", width: 2128, minWidth: 2128, fontSize: 11, color: "#fff" }}>
        <thead>
          <tr>
            {["#", "NC", "단계", "적중률", "구간", "금액", ...Array.from({ length: 60 }, (_, i) => i + 1)].map((label, index) => (
              (() => {
                const isProgress = index >= 6 && index - 6 === progressRoundIndex;
                return (
              <Box component="th" key={label} sx={{
                position: "sticky", top: 0, left: index < 2 ? (index === 0 ? 0 : infoWidths[0]) : undefined,
                zIndex: index < 2 ? 4 : 3,
                width: index < 6 ? infoWidths[index] : 31,
                minWidth: index < 6 ? infoWidths[index] : 31,
                maxWidth: index < 6 ? infoWidths[index] : 31,
                height: 31,
                borderRight: isProgress ? "2px solid #ffb300" : "1px solid #59616d",
                borderLeft: isProgress ? "2px solid #ffb300" : undefined,
                borderBottom: isProgress ? "2px solid #ffb300" : "1px solid #59616d",
                backgroundColor: isProgress ? "#6d4c00" : "#20262e",
                color: isProgress ? "#fff59d" : "#e8edf3",
                boxShadow: isProgress ? "inset 0 0 8px rgba(255,193,7,.45)" : "none",
              }}>{isProgress ? `▶${label}` : label}</Box>
                );
              })()
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedItems.map((item, sortedIndex) => (
            <tr key={item.index}>
              <Box component="td" sx={{ position: "sticky", left: 0, zIndex: 2, width: infoWidths[0], minWidth: infoWidths[0], maxWidth: infoWidths[0], textAlign: "center", borderRight: "1px solid #59616d", borderBottom: "1px solid #59616d", backgroundColor: "#181d23" }}>{sortedIndex + 1}</Box>
              <Box component="td" sx={{ position: "sticky", left: infoWidths[0], zIndex: 2, width: infoWidths[1], minWidth: infoWidths[1], maxWidth: infoWidths[1], textAlign: "center", borderRight: "1px solid #59616d", borderBottom: "1px solid #59616d", backgroundColor: "#181d23", fontWeight: 800 }}>{item.game_seq}</Box>
              <Box component="td" sx={{ width: infoWidths[2], minWidth: infoWidths[2], textAlign: "center", borderRight: "1px solid #59616d", borderBottom: "1px solid #59616d" }}>{item.step}S</Box>
              <Box component="td" sx={{ width: infoWidths[3], minWidth: infoWidths[3], textAlign: "center", borderRight: "1px solid #59616d", borderBottom: "1px solid #59616d" }}>{item.rate == null ? "-" : `${item.rate}%`}</Box>
              <Box component="td" sx={{ width: infoWidths[4], minWidth: infoWidths[4], textAlign: "center", borderRight: "1px solid #59616d", borderBottom: "1px solid #59616d", color: zoneColor[item.zone] }}>{item.zone}</Box>
              <Box component="td" sx={{ width: infoWidths[5], minWidth: infoWidths[5], textAlign: "right", pr: 0.5, borderRight: "1px solid #59616d", borderBottom: "1px solid #59616d", color: zoneColor[item.zone] }}>{Number(item.amount || 0).toFixed(1)}</Box>
              {Array.from({ length: 60 }, (_, roundIndex) => {
                const pick = item.shoes?.[roundIndex];
                const actual = actuals[roundIndex];
                const status = actual ? (pick === actual ? "hit" : "miss") : null;
                const isProgress = roundIndex === progressRoundIndex;
                return (
                  <Box component="td" key={roundIndex} sx={{ width: 31, height: 31, borderRight: isProgress ? "2px solid #ffb300" : "1px solid #59616d", borderLeft: isProgress ? "2px solid #ffb300" : undefined, borderBottom: "1px solid #59616d", textAlign: "center", backgroundColor: actual ? (status === "hit" ? "#2e9e5b" : "#5b6068") : isProgress ? "rgba(255,193,7,.13)" : "transparent" }}>
                    <Box sx={{ display: "flex", justifyContent: "center" }}><PickChip value={pick} /></Box>
                  </Box>
                );
              })}
            </tr>
          ))}
        </tbody>
      </Box>
    </Box>
  );
}

export default function Nc2UserGamePage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const user = useAtomValue(userAtom);
  const navigate = useNavigate();
  const isAdmin = user?.role === "admin";
  const [searchParams, setSearchParams] = useSearchParams();
  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [keepCombination, setKeepCombination] = useState(false);
  const [sourceGameId, setSourceGameId] = useState("");
  const [autoOpen, setAutoOpen] = useState(false);
  const [autoPlayMode, setAutoPlayMode] = useState("keep");
  const [autoStatus, setAutoStatus] = useState({ running: false });
  const [autoStatusError, setAutoStatusError] = useState(null);
  const [replayControls, setReplayControls] = useState(false);
  const [replay, setReplay] = useState({ active: false, sourceGameId: null, roundNum: 0, totalRounds: 0 });
  const [roundInput, setRoundInput] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [shoeCopyOpen, setShoeCopyOpen] = useState(false);
  const [shoeSourceType, setShoeSourceType] = useState("nc2");
  const [shoeSourceId, setShoeSourceId] = useState("");
  const [shoePreview, setShoePreview] = useState(null);
  const [shoeCopyLoading, setShoeCopyLoading] = useState(false);
  const [shoeCopyError, setShoeCopyError] = useState("");
  const state = game?.round_state;

  const loadShoePreview = async () => {
    const sourceId = Number(shoeSourceId);
    if (!Number.isInteger(sourceId) || sourceId <= 0) { setShoeCopyError("올바른 게임번호를 입력하세요."); return; }
    setShoeCopyLoading(true); setShoeCopyError("");
    try {
      const response = await apiCaller.get(NC2_GAMES_API.SHOE_COPY_PREVIEW(sourceId), { source_game_type: shoeSourceType });
      setShoePreview(response.data);
    } catch (err) { setShoePreview(null); setShoeCopyError(err.response?.data?.detail || "기존 슈를 조회하지 못했습니다."); }
    finally { setShoeCopyLoading(false); }
  };

  const executeShoeCopy = async () => {
    if (!shoePreview || !game?.game_id) return;
    setShoeCopyLoading(true); setLoading(true); setShoeCopyError("");
    try {
      const response = await apiCaller.post(NC2_GAMES_API.SHOE_COPY_PROCESS, {
        source_game_type: shoePreview.source_game_type, source_game_id: shoePreview.source_game_id, game_id: game.game_id,
      }, { timeout: 5 * 60 * 1000 });
      await restore(game.game_id);
      if (response.data.completed) { setShoeCopyOpen(false); window.alert(`기존 슈 입력 완료 (${response.data.completed_results}/${response.data.total_results})`); }
      else setShoeCopyError(`${response.data.completed_results}개 입력 후 실패: ${response.data.error}`);
    } catch (err) { setShoeCopyError(err.response?.data?.detail || "기존 슈 입력을 실행하지 못했습니다."); }
    finally { setShoeCopyLoading(false); setLoading(false); }
  };

  const applyGame = useCallback((data) => {
    setGame(data);
    setKeepCombination(!!data?.keep_combination);
    if (data?.game_id) setSearchParams({ gameId: data.game_id }, { replace: true });
  }, [setSearchParams]);

  const restore = useCallback(async (gameId) => {
    const response = await apiCaller.get(NC2_GAMES_API.STATE(gameId));
    applyGame(response.data);
  }, [applyGame]);

  const start = useCallback(async ({ source = null } = {}) => {
    setLoading(true); setError("");
    try {
      const response = await apiCaller.post(NC2_GAMES_API.START, { keep_combination: keepCombination, source_game_id: source });
      applyGame(response.data);
      if (source) setSourceGameId("");
      setReplay({ active: false, sourceGameId: null, roundNum: 0, totalRounds: 0 });
    } catch (err) {
      setError(err.response?.data?.detail || "NC2 게임을 시작하지 못했습니다.");
    } finally { setLoading(false); }
  }, [applyGame, keepCombination]);

  useEffect(() => {
    const gameId = Number(searchParams.get("gameId"));
    if (gameId > 0) { restore(gameId).catch(() => setError("NC2 게임을 불러오지 못했습니다.")); return; }
    apiCaller.get(NC2_GAMES_API.LAST_ACTIVE).then((response) => {
      if (response.data?.game) applyGame(response.data.game);
    }).catch((err) => setError(err.response?.data?.detail || "NC2 상태를 불러오지 못했습니다."));
  }, []);

  useEffect(() => {
    if (!game?.game_id) return undefined;
    let cancelled = false;
    const poll = () => autoService.getAutoStatus(game.game_id, "nc2").then((status) => {
      if (cancelled) return;
      setAutoStatus(status);
      setAutoStatusError(null);
      if (status.running && (status.play_mode === "one" || status.play_mode === "keep")) {
        setAutoPlayMode(status.play_mode);
      }
      if (status.running) {
        restore(game.game_id).catch(() => {});
      }
    }).catch((err) => {
      if (cancelled) return;
      setAutoStatusError({
        code: "auto_status_lookup_failed",
        detail: err.response?.data?.detail || "오토 실행 상태를 확인하지 못했습니다.",
      });
    });
    poll();
    const timer = setInterval(poll, 3000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [game?.game_id, restore]);

  // GH와 동일하게 오토 이벤트를 실시간 구독하고, 결과 확정 시 서버 상태를 다시 읽는다.
  useEffect(() => {
    if (!game?.game_id || !autoStatus.running) return undefined;
    const token = sessionStorage.getItem("pick_hand_token");
    if (!token) return undefined;

    const base = import.meta.env.VITE_API_BASE_URL || window.location.origin;
    const wsUrl = `${base.replace(/^http/, "ws")}/ws/auto?token=${encodeURIComponent(token)}`;
    let ws;
    let pingTimer;
    let reconnectTimer;
    let cancelled = false;

    const refreshEventGame = (gameId) => {
      if (!gameId) return;
      restore(gameId).catch(() => {});
    };
    const connect = () => {
      if (cancelled) return;
      ws = new WebSocket(wsUrl);
      ws.onopen = () => {
        setAutoStatusError(null);
        pingTimer = setInterval(() => {
          try { ws.send("ping"); } catch (_) {}
        }, 30000);
      };
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          const type = message.type;
          const data = message.data || {};
          if (type !== "pong") {
            const currentGameId = Number(game.game_id);
            const eventGameId = Number(data.game_id);
            const sourceGameId = Number(data.source_game_id);
            const currentSessionId = autoStatus.auto_session_id;
            const belongsToCurrentAuto = (
              (Number.isFinite(eventGameId) && eventGameId === currentGameId)
              || (Number.isFinite(sourceGameId) && sourceGameId === currentGameId)
              || (currentSessionId && data.auto_session_id === currentSessionId)
              || (currentSessionId && data.source_auto_session_id === currentSessionId)
            );
            if (!belongsToCurrentAuto) return;
          }

          if (type === "round_committed") {
            refreshEventGame(data.game_id || game.game_id);
            setAutoStatus((previous) => ({
              ...previous,
              phase: data.phase ?? previous.phase,
              round_count: data.round_count ?? previous.round_count,
              pnl_total: data.pnl_total ?? previous.pnl_total,
              pnl_actual: data.pnl_actual ?? previous.pnl_actual,
              pnl_total_p: data.pnl_total_p ?? previous.pnl_total_p,
              pnl_actual_p: data.pnl_actual_p ?? previous.pnl_actual_p,
              stop_reason: data.stop_reason ?? previous.stop_reason,
              pending_direction: data.pending_direction ?? null,
              pending_amount_p: data.pending_amount_p ?? 0,
              pending_amount_won: data.pending_amount_won ?? 0,
            }));
          } else if (type === "shoe_result_recorded") {
            refreshEventGame(data.game_id || game.game_id);
          } else if (type === "phase_changed") {
            setAutoStatus((previous) => ({
              ...previous,
              phase: data.phase ?? previous.phase,
              round_count: data.round_count ?? previous.round_count,
              pnl_total: data.pnl_total ?? previous.pnl_total,
              pnl_actual: data.pnl_actual ?? previous.pnl_actual,
              pnl_total_p: data.pnl_total_p ?? previous.pnl_total_p,
              pnl_actual_p: data.pnl_actual_p ?? previous.pnl_actual_p,
              stop_reason: data.stop_reason ?? data.reason ?? previous.stop_reason,
            }));
            if (data.game_id && Number(data.game_id) !== Number(game.game_id)) {
              refreshEventGame(data.game_id);
            }
          } else if (type === "game_switched" && data.new_game_id) {
            refreshEventGame(data.new_game_id);
          } else if (type === "auto_restarted") {
            setAutoStatus((previous) => ({
              ...previous,
              running: true,
              auto_session_id: data.auto_session_id,
              phase: data.phase || "betting",
              round_count: 0,
              pnl_total: 0,
              pnl_actual: 0,
              pnl_total_p: 0,
              pnl_actual_p: 0,
              stop_reason: data.stop_reason || null,
            }));
            refreshEventGame(data.game_id);
          } else if (type === "bet_rejected") {
            setError("배팅이 거부되었습니다 (카지노 미체결)");
            refreshEventGame(data.game_id || game.game_id);
          }
        } catch (_) {}
      };
      ws.onclose = () => {
        clearInterval(pingTimer);
        if (!cancelled) reconnectTimer = setTimeout(connect, 5000);
      };
      ws.onerror = () => {
        setAutoStatusError({
          code: "realtime_connection_error",
          detail: "오토 실시간 연결에 문제가 발생했습니다. 상태 조회로 복구 중입니다.",
        });
        try { ws.close(); } catch (_) {}
      };
    };
    connect();

    return () => {
      cancelled = true;
      clearInterval(pingTimer);
      clearTimeout(reconnectTimer);
      try { ws?.close(); } catch (_) {}
    };
  }, [autoStatus.running, autoStatus.auto_session_id, game?.game_id, restore]);

  const record = async (actual) => {
    if (!game?.game_id || loading || replay.active) return;
    setLoading(true); setError("");
    try { applyGame((await apiCaller.post(NC2_GAMES_API.ROUND, { game_id: game.game_id, actual })).data); }
    catch (err) { setError(err.response?.data?.detail || "결과 입력 실패"); }
    finally { setLoading(false); }
  };

  const newGame = async () => {
    if (game?.game_id && !replay.active) await apiCaller.post(NC2_GAMES_API.END(game.game_id));
    setNewOpen(false);
    await start({ source: sourceGameId ? Number(sourceGameId) : null });
  };

  const moveReplay = async (target) => {
    const source = replay.active ? replay.sourceGameId : game?.game_id;
    const total = replay.active ? replay.totalRounds : Number(state?.round_num || 0);
    const round = Math.max(0, Math.min(total, Number(target)));
    const response = await apiCaller.get(NC2_GAMES_API.REPLAY(source), { round_num: round });
    setGame(response.data);
    setReplay({ active: true, sourceGameId: source, roundNum: round, totalRounds: response.data.total_rounds });
    setRoundInput(String(round));
  };

  const aggregate = state?.next_bet || {};
  const currentRound = replay.active ? replay.roundNum : Number(state?.round_num || 0);
  const finalLabel = aggregate.direction ? `${aggregate.direction} ${Number(aggregate.amount || 0).toFixed(1)}P` : "대기 0P";
  const summary = useMemo(() => ({ P: aggregate.p_total || 0, B: aggregate.b_total || 0 }), [aggregate.p_total, aggregate.b_total]);
  const bigRoad = useMemo(() => {
    const historyByRound = new Map(
      (state?.round_history || []).map((entry) => [Number(entry.round_num), entry]),
    );
    return calculateNc2CircleGrid(
      [...String(state?.actuals || "")].map((value, idx) => ({
        value,
        status: historyByRound.get(idx + 1)?.status || "wait",
        idx,
      })),
    );
  }, [state?.actuals, state?.round_history]);
  const pCount = [...String(state?.actuals || "")].filter((value) => value === "P").length;
  const bCount = Number(state?.round_num || 0) - pCount;
  const inputLocked = !game || loading || replay.active || Number(state?.round_num || 0) >= 60;
  const panelSx = { border: "1px solid rgba(255,255,255,.3)", borderRadius: 1, backgroundColor: "#101318" };
  const pbSx = (backgroundColor) => ({ width: 48, height: 48, borderRadius: 2, backgroundColor, color: "#fff", fontSize: 24, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", cursor: inputLocked ? "not-allowed" : "pointer", opacity: inputLocked ? .4 : 1, "&:hover": { opacity: .85 }, "&:active": { transform: "scale(.95)" } });
  const ghRoundState = useMemo(() => {
    const actuals = String(state?.actuals || "");
    const historyByRound = new Map(
      (state?.round_history || []).map((entry) => [Number(entry.round_num), entry]),
    );
    const cells = Array.from({ length: 80 }, (_, idx) => {
      const history = historyByRound.get(idx + 1);
      const isCurrent = idx === actuals.length;
      return {
        round: idx + 1,
        amount: history ? Number(history.amount || 0) : isCurrent ? Number(aggregate.amount || 0) : 0,
        pnl: history ? Number(history.pnl || 0) : 0,
        total_pnl: history ? Number(history.total_pnl || 0) : 0,
        actual: history?.actual || actuals[idx] || null,
        pick: history?.direction || (isCurrent ? aggregate.direction : null),
        status: history?.status || null,
      };
    });
    return {
      round_num: Number(state?.round_num || 0),
      shoe_results: [...actuals],
      pick_martin: { step: 1, direction: aggregate.direction, amount: Number(aggregate.amount || 0) },
      round_amount_table: {
        cells,
        total_side: aggregate.direction,
        total_amount: Number(aggregate.amount || 0),
        total_pnl: Number(state?.pnl || 0),
      },
    };
  }, [state, aggregate.direction, aggregate.amount]);

  return (
    <Box sx={{ p: isMobile ? .5 : 2 }}>
      <Box sx={{ mb: 1, display: "flex", alignItems: "center", gap: 1 }}>
        <span style={{ fontSize: 14, fontWeight: "bold", color: "#fff" }}>NiceChoice2</span>
        {game?.game_id && <span style={{ fontSize: 11, color: "#888" }}>#{game.game_id}</span>}
        {replay.active && <span style={{ fontSize: 12, color: "#ffb300", fontWeight: "bold", marginLeft: 8 }}>{`리플레이 중 #${replay.sourceGameId} · ${replay.roundNum}/${replay.totalRounds}회차`}</span>}
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: `repeat(${GRID_COLS}, ${isMobile ? 16 : 26}px)`, gridTemplateRows: `repeat(${GRID_ROWS}, ${isMobile ? 16 : 26}px)`, gap: "1px", mb: 2, backgroundColor: "#616161", border: "1px solid #616161", width: "fit-content" }}>
        {bigRoad.flatMap((row, r) => row.map((cell, c) => <Box key={`${r}-${c}`} sx={{ backgroundColor: cell ? (resultCellColor[cell.status] || "#fff") : "background.default", display: "flex", alignItems: "center", justifyContent: "center", ...(r === 3 ? { borderTop: "2px solid #87ceeb" } : {}) }}>{cell && <Nc2Circle type={cell.type} filled size={isMobile ? 12 : 22} label={cell.idx + 1} />}</Box>))}
      </Box>

      <Box sx={{ display: "flex", flexDirection: "row", gap: 1, alignItems: "flex-start", mb: 2, overflowX: "auto", overflowY: "hidden" }}>
        <Box sx={{ flex: "0 0 auto", display: "flex", flexDirection: "column", gap: 1 }}>
          <Box sx={{ display: "flex", gap: .5, alignItems: "center", flexWrap: "wrap" }}>
            <Box sx={{ borderRadius: 1, px: .5, height: 20, minWidth: 44, backgroundColor: "#1565c0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 900 }}>A</Box>
            <Box sx={{ ...panelSx, minWidth: 55, height: 24, px: 1, display: "flex", alignItems: "center", justifyContent: "flex-end", color: Number(summary.P) > 0 ? "#4caf50" : "#666", fontSize: 12, fontWeight: 900 }}>{Number(summary.P).toFixed(1)}</Box>
            <Box sx={{ borderRadius: 1, px: .5, height: 20, minWidth: 44, backgroundColor: "#c62828", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 900 }}>Z</Box>
            <Box sx={{ ...panelSx, minWidth: 80, height: 24, px: .6, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: .5, color: Number(summary.B) > 0 ? "#4caf50" : "#666", fontSize: 11, fontWeight: 900 }}><span style={{ color: "#888", fontSize: 10 }}>1S</span>{Number(summary.B).toFixed(1)}{aggregate.direction || ""}</Box>
            <Box sx={{ width: 32, height: 32, border: "1px solid #8e24aa", borderRadius: 1, backgroundColor: "#101318", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 13, opacity: .4 }}>≡0</Box>
            <Box sx={{ width: 32, height: 32, border: "1px solid #2f80ed", borderRadius: 1, backgroundColor: "#101318", color: "#64b5f6", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 13 }}>RE</Box>
          </Box>
          <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
            <Box sx={{ ...panelSx, width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900 }}>{currentRound + 1 > 60 ? 60 : currentRound + 1}</Box>
            <Box sx={pbSx("#1565c0")} onClick={() => !inputLocked && record("P")}>P</Box>
            <Box sx={{ ...panelSx, width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900 }}>{pCount}</Box>
            <Box sx={pbSx("#f44336")} onClick={() => !inputLocked && record("B")}>B</Box>
            <Box sx={{ ...panelSx, width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900 }}>{bCount}</Box>
            <Box sx={{ ...panelSx, px: 1.5, height: 40, display: "flex", alignItems: "center", color: "#666" }}>del</Box>
          </Box>
          <Nc2BettingSummaryPanel
            roundState={ghRoundState}
            selectedMode={autoPlayMode}
            onModeChange={setAutoPlayMode}
            autoStatus={autoStatus}
            onPlay={() => autoStatus.running ? autoService.stopAuto(autoStatus.auto_session_id).then(() => setAutoStatus({ running: false })) : setAutoOpen(true)}
            autoError={autoStatusError}
            replayActive={replay.active}
            disabled={!game || replay.active}
          />
        </Box>

        <Nc2RoundAmountTable
          roundState={ghRoundState}
          amountMode="calculated"
          onSetup={() => navigate("/nc2game/user-setup")}
          onNew={() => setNewOpen(true)}
          newDisabled={loading || autoStatus.running}
          gameSlots={Array.from({ length: 6 }, (_, idx) => ({ slot_no: idx + 1, occupied: idx === 0, game_id: idx === 0 ? game?.game_id : null, auto_running: idx === 0 && autoStatus.running }))}
          selectedSlotNo={1}
          onSlotSelect={() => {}}
          slotBusy={loading || replay.active}
          endDisabled
        />
      </Box>

      {isAdmin && <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap", mb: 1.5, px: 1, py: .7, border: "1px solid rgba(255,193,7,.45)", borderRadius: 1, backgroundColor: "rgba(255,193,7,.06)" }}>
        <Typography variant="caption" sx={{ color: "#ffc107", fontWeight: 900 }}>어드민 도구</Typography>
        <FormControlLabel
          sx={{ m: 0, mr: .5, "& .MuiFormControlLabel-label": { fontSize: 12 } }}
          control={<Checkbox size="small" sx={{ p: .5 }} checked={keepCombination} onChange={(event) => setKeepCombination(event.target.checked)} />}
          label="NC 조합 유지"
        />
        <TextField
          size="small"
          type="number"
          label="NC 게임번호"
          value={sourceGameId}
          onChange={(event) => setSourceGameId(event.target.value)}
          inputProps={{ min: 1 }}
          sx={{ width: 142, "& .MuiInputBase-root": { height: 32 }, "& .MuiInputBase-input": { fontSize: 12, py: .5 } }}
        />
        <Button size="small" variant="outlined" color="warning" onClick={() => setNewOpen(true)} disabled={!sourceGameId || loading || autoStatus.running || replay.active}>이 조합으로 새 게임</Button>
        <Button size="small" variant="outlined" color="warning" onClick={() => { setShoeSourceType("nc2"); setShoeSourceId(""); setShoePreview(null); setShoeCopyError(""); setShoeCopyOpen(true); }} disabled={loading || autoStatus.running || replay.active || !game?.game_id}>기존 슈 불러오기</Button>
        <Button size="small" variant="outlined" onClick={() => setReplayControls((value) => !value)} disabled={loading || !game?.game_id}>리플레이</Button>
        {autoStatus.running && <Typography variant="caption" sx={{ color: "text.secondary" }}>오토 실행 중에는 NC 조합을 변경할 수 없습니다.</Typography>}
        {(replayControls || replay.active) && <>
          <Button size="small" onClick={() => moveReplay(currentRound - 10)} disabled={loading || currentRound <= 0}>-10</Button>
          <Button size="small" onClick={() => moveReplay(currentRound - 1)} disabled={loading || currentRound <= 0}>이전</Button>
          <Button size="small" onClick={() => moveReplay(currentRound + 1)} disabled={!replay.active || loading || currentRound >= replay.totalRounds}>다음</Button>
          <Button size="small" onClick={() => moveReplay(currentRound + 10)} disabled={!replay.active || loading || currentRound >= replay.totalRounds}>+10</Button>
          <TextField size="small" type="number" value={roundInput} onChange={(event) => setRoundInput(event.target.value)} inputProps={{ min: 0, max: replay.active ? replay.totalRounds : currentRound }} sx={{ width: 82, "& .MuiInputBase-root": { height: 32 }, "& .MuiInputBase-input": { fontSize: 12, py: .5 } }} />
          <Button size="small" onClick={() => moveReplay(roundInput)} disabled={loading || !roundInput}>이동</Button>
          {replay.active && <Button size="small" color="warning" onClick={() => restore(replay.sourceGameId).then(() => setReplay({ active: false, sourceGameId: null, roundNum: 0, totalRounds: 0 }))} disabled={loading}>리플레이 종료</Button>}
        </>}
      </Box>}

      {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
      {state && <Nc2Grid state={state} />}

      <AutoStartDialog open={autoOpen} onClose={() => setAutoOpen(false)} onStarted={(status) => {
        setAutoStatus({ ...status, running: status?.running ?? status?.status === "running" });
        setAutoStatusError(null);
      }} onError={(value) => setError(value.detail)} gameId={game?.game_id} pickhandId={user?.pickhand_id || user?.username} gameType="nc2" playMode="keep" />
      <Dialog open={newOpen} onClose={() => setNewOpen(false)}>
        <DialogTitle>NC2 새 게임</DialogTitle>
        <DialogContent><Typography>{sourceGameId ? `게임 #${sourceGameId}의 NC 조합을 사용합니다.` : keepCombination ? "현재 NC 조합을 유지합니다." : "128개 NC를 새로 선정합니다."}</Typography></DialogContent>
        <DialogActions><Button onClick={() => setNewOpen(false)}>취소</Button><Button variant="contained" onClick={newGame}>시작</Button></DialogActions>
      </Dialog>
      <Dialog open={shoeCopyOpen} onClose={() => !shoeCopyLoading && setShoeCopyOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>기존 슈 불러오기</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", gap: 1, mt: .5, mb: 2, flexWrap: "wrap" }}>
            <TextField select size="small" label="원본 게임" value={shoeSourceType} onChange={(event) => { setShoeSourceType(event.target.value); setShoePreview(null); }} sx={{ minWidth: 150 }}>
              <MenuItem value="nc2">나이스초이스2</MenuItem><MenuItem value="gh">글로벌히트</MenuItem>
            </TextField>
            <TextField size="small" type="number" label="기존 게임번호" value={shoeSourceId} onChange={(event) => { setShoeSourceId(event.target.value); setShoePreview(null); }} />
            <Button variant="outlined" disabled={shoeCopyLoading} onClick={loadShoePreview}>조회</Button>
          </Box>
          {shoeCopyError && <Alert severity="error" sx={{ mb: 1 }}>{shoeCopyError}</Alert>}
          {shoePreview && (() => {
            const previewGrid = buildShoePreviewGrid(shoePreview.actuals);
            const previewCols = previewGrid[0]?.length || 1;
            return <><Typography variant="body2" sx={{ mb: 1 }}>{`${shoePreview.source_game_label} #${shoePreview.source_game_id} · ${shoePreview.round_count}회차 · 전체 결과 ${shoePreview.result_count}개`}</Typography><Box sx={{ overflowX: "auto", pb: 1 }}><Box sx={{ display: "grid", gridTemplateColumns: `repeat(${previewCols}, 24px)`, gridTemplateRows: `repeat(${GRID_ROWS}, 24px)`, gridAutoFlow: "column", gap: "1px", width: "fit-content", backgroundColor: "#616161", border: "1px solid #616161" }}>{Array.from({ length: previewCols }, (_, col) => Array.from({ length: GRID_ROWS }, (__, row) => { const actual = previewGrid[row][col]; const color = actual === "P" ? "#1565c0" : actual === "B" ? "#f44336" : "#2e7d32"; return <Box key={`${row}-${col}`} sx={{ width: 24, height: 24, backgroundColor: "background.default", display: "flex", alignItems: "center", justifyContent: "center" }}>{actual && <Box sx={{ width: 20, height: 20, borderRadius: "50%", backgroundColor: color, color: "#fff", fontSize: 10, fontWeight: "bold", display: "flex", alignItems: "center", justifyContent: "center" }}>{actual}</Box>}</Box>; }))}</Box></Box></>;
          })()}
        </DialogContent>
        <DialogActions><Button onClick={() => setShoeCopyOpen(false)} disabled={shoeCopyLoading}>취소</Button><Button variant="contained" color="warning" onClick={executeShoeCopy} disabled={!shoePreview || shoeCopyLoading}>현재 게임에 이어서 입력</Button></DialogActions>
      </Dialog>
    </Box>
  );
}
