import React, { useState, useEffect, useCallback, useRef } from "react";
import { Box, Typography, useMediaQuery, useTheme, Dialog, DialogTitle, DialogContent, DialogActions, Button, CircularProgress } from "@mui/material";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAtomValue } from "jotai";
import { userAtom } from "@/store/auth-store";
import apiCaller from "@/services/api-caller";
import { HB_GAMES_API, LINKED_GAMES_API, USER_BET_SETTINGS_API } from "@/constants/api-url";
import useLinkedGame from "@/hooks/useLinkedGame";

const GRID_ROWS = 6;
const GRID_COLS = 40;

const CELL_BG = {
  hit: "#00e676",
  miss: "#ffeb3b",
  wait: "#ffffff",
};

const Circle = ({ type, filled = true, size = 24, label }) => {
  const colors = { P: "#1565c0", B: "#f44336" };
  const display = label != null ? label : type;
  return (
    <Box
      sx={{
        width: size, height: size, borderRadius: "50%",
        backgroundColor: filled ? colors[type] : "#fff",
        border: "3px solid", borderColor: colors[type],
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: label != null ? size * 0.4 : size * 0.5,
        fontWeight: "bold", color: filled ? "#fff" : colors[type],
      }}
    >{display}</Box>
  );
};

const calculateCircleGrid = (results) => {
  const grid = Array(GRID_ROWS).fill(null).map(() => Array(GRID_COLS).fill(null));
  if (!results || results.length === 0) return grid;

  let col = 0, row = 0, prevValue = null, verticalStartCol = 0, isBent = false;
  for (let i = 0; i < results.length; i++) {
    const current = results[i].value;
    const status = results[i].status || "wait";
    if (prevValue === null) {
      grid[row][col] = { type: current, status, idx: i };
      verticalStartCol = col;
    } else if (current === prevValue) {
      if (isBent) { col++; }
      else if (row >= GRID_ROWS - 1) { col++; isBent = true; }
      else if (grid[row + 1][col]) { col++; isBent = true; }
      else { row++; }
      if (col >= GRID_COLS) break;
      grid[row][col] = { type: current, status, idx: i };
    } else {
      verticalStartCol++;
      col = verticalStartCol;
      row = 0;
      isBent = false;
      if (col >= GRID_COLS) break;
      grid[row][col] = { type: current, status, idx: i };
    }
    prevValue = current;
  }
  return grid;
};

const toggleBtnSx = {
  border: "1px solid rgba(255,255,255,0.3)", borderRadius: 1,
  px: 1, py: 0.3, cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center", minWidth: 40,
  "&:hover": { opacity: 0.8 },
};

const controlBtnSx = {
  border: "1px solid rgba(255,255,255,0.3)", borderRadius: 1,
  px: 1.5, py: 0.5, backgroundColor: "background.paper",
  "&:hover": { backgroundColor: "rgba(255,255,255,0.1)" },
};

export default function HbUserGamePage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const navigate = useNavigate();
  const user = useAtomValue(userAtom);
  const isAdmin = user?.role === "admin";
  const [searchParams, setSearchParams] = useSearchParams();
  const [results, setResults] = useState([]);
  const [pickResult, setPickResult] = useState({ method: "wait", pick: null, nickname: null });
  const [collapsedPatterns, setCollapsedPatterns] = useState({});
  const [hbPatterns, setHbPatterns] = useState({});
  const [globalhitData, setGlobalhitData] = useState([]);
  const [betData, setBetData] = useState(null);
  const [gameId, setGameId] = useState(null);
  const [config, setConfig] = useState(null);
  const [cumPnL, setCumPnL] = useState({ hb: 0, gh: 0, user_a: 0, user_z: 0 });
  const [showNextConfirm, setShowNextConfirm] = useState(false);
  const [showNewConfirm, setShowNewConfirm] = useState(false);
  const [nicknames, setNicknames] = useState([]);
  const [endingMode, setEndingMode] = useState(false);
  const [endingSnapshot, setEndingSnapshot] = useState(null);
  const [endingDone, setEndingDone] = useState(false);
  const [userSummary, setUserSummary] = useState(null);
  const [userMartinDashboard, setUserMartinDashboard] = useState(null);
  const [resumeGame, setResumeGame] = useState(null);
  const processingRef = useRef(false);
  const [processing, setProcessing] = useState(false);
  const goalAlertedRef = useRef({ a: false, z: false });
  const [goalDialog, setGoalDialog] = useState({ open: false, msgs: [] });

  // 연동게임
  const handleLinkedUpdate = useCallback(() => {
    if (gameId) {
      apiCaller.get(HB_GAMES_API.STATE(gameId) + "?mode=user").then((res) => {
        const data = res.data;
        const seq = data.seq || "";
        const picks = data.round_picks || [];
        setResults(seq.split("").map((v, i) => {
          const pick = picks[i];
          const status = pick ? (pick === v ? "hit" : "miss") : "wait";
          return { value: v, status };
        }));
        setCumPnL(data.cum_pnl || { hb: 0, gh: 0, user_a: 0, user_z: 0 });
        setPickResult({ method: data.method, pick: data.pick, nickname: data.nickname });
        setHbPatterns(data.hb_patterns || {});
        setGlobalhitData(data.globalhit || []);
        setBetData(data.bet ? { ...data.bet, user_martin: data.user_martin } : null);
        setUserSummary(data.user_summary || null);
        setUserMartinDashboard(data.user_martin_dashboard || null);
      }).catch(() => {});
    }
  }, [gameId]);
  const { isLinked, linkedRound, linkedNext, linkedEnd, linkedDeleteLastRound } = useLinkedGame("hb", gameId, results.length, handleLinkedUpdate);

  const currentTurn = results.length + 1;
  const grid = calculateCircleGrid(results);

  const checkGoalAlert = useCallback((summary) => {
    if (!summary) return;
    const ref = goalAlertedRef.current;
    const aReached = summary.martin_a?.goal_reached;
    const zReached = summary.martin_z?.goal_reached;
    const msgs = [];
    if (aReached && !ref.a) msgs.push("마틴 A");
    if (zReached && !ref.z) msgs.push("마틴 Z");
    ref.a = !!aReached;
    ref.z = !!zReached;
    if (msgs.length > 0) setGoalDialog({ open: true, msgs });
  }, []);

  const displayPick = betData?.combined?.direction && betData.combined.direction !== "wait" ? betData.combined.direction : null;
  const pickImage = displayPick === "P" ? "/player.png" : displayPick === "B" ? "/banker.png" : "/wait.png";

  useEffect(() => {
    apiCaller.get(HB_GAMES_API.NICKNAMES).then((res) => {
      setNicknames(res.data.nicknames || []);
    });
  }, []);

  const startGame = useCallback(async () => {
    try {
      // 연동 설정 직접 확인
      let useLinked = isLinked;
      if (!useLinked) {
        try {
          const lc = await apiCaller.get(USER_BET_SETTINGS_API.GET("common"));
          useLinked = (lc.data.config?.linked_games || []).length > 0;
        } catch {}
      }
      const res = useLinked
        ? await apiCaller.post(LINKED_GAMES_API.START, { game_type: "hb" })
        : await apiCaller.post(HB_GAMES_API.START + "?mode=user");
      setGameId(res.data.game_id);
      setConfig(res.data.config);
      setGlobalhitData(res.data.globalhit || []);
      setSearchParams({ gameId: res.data.game_id }, { replace: true });
    } catch (err) {
      console.error("Failed to start game:", err);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const isNew = searchParams.get("new");
    const urlGameId = searchParams.get("gameId");
    if (isNew) {
      setResults([]); setCumPnL({ hb: 0, gh: 0, user_a: 0, user_z: 0 }); setBetData(null);
      setPickResult({ method: "wait", pick: null, nickname: null });
      setHbPatterns({}); setGlobalhitData([]);
      startGame();
    } else if (urlGameId) {
      restoreGame(parseInt(urlGameId));
    } else {
      // 직전 게임이 active면 복원 여부 확인
      apiCaller.get(HB_GAMES_API.LAST_ACTIVE + "?mode=user").then(async (res) => {
        if (cancelled) return;
        const game = res.data?.game;
        if (game && game.round_count > 0) {
          setResumeGame(game);
        } else {
          if (game) {
            try { await apiCaller.post(HB_GAMES_API.END, null, { params: { game_id: game.game_id } }); } catch {}
          }
          if (!cancelled) startGame();
        }
      }).catch(() => { if (!cancelled) startGame(); });
    }
    return () => { cancelled = true; };
  }, [searchParams.get("new"), searchParams.get("gameId")]); // eslint-disable-line react-hooks/exhaustive-deps

  const restoreGame = async (gid) => {
    try {
      const res = await apiCaller.get(HB_GAMES_API.STATE(gid) + "?mode=user");
      const data = res.data;
      setGameId(data.game_id);
      setConfig(data.config);
      setCumPnL(data.cum_pnl || { hb: 0, gh: 0, user_a: 0, user_z: 0 });
      const seq = data.seq || "";
      const picks = data.round_picks || [];
      setResults(seq.split("").map((v, i) => {
        const pick = picks[i];
        const status = pick ? (pick === v ? "hit" : "miss") : "wait";
        return { value: v, status };
      }));
      setPickResult({ method: data.method, pick: data.pick, nickname: data.nickname });
      setHbPatterns(data.hb_patterns || {});
      setGlobalhitData(data.globalhit || []);
      setBetData(data.bet ? { ...data.bet, user_martin: data.user_martin } : null);
      setUserSummary(data.user_summary || null);
      setUserMartinDashboard(data.user_martin_dashboard || null);
      if (data.status === "ending" && data.ending_snapshot) {
        setEndingMode(true);
        setEndingSnapshot(data.ending_snapshot);
      }
    } catch (err) {
      console.error("Failed to restore, starting new:", err);
      startGame();
    }
  };

  const handleInput = async (inputValue) => {
    if (!gameId || processingRef.current) return;
    processingRef.current = true;
    setProcessing(true);

    let status = "wait";
    if (pickResult.pick) {
      status = pickResult.pick === inputValue ? "hit" : "miss";
    }
    setResults((prev) => [...prev, { value: inputValue, status }]);
    setBetData(null);
    setPickResult({ method: "wait", pick: null });

    try {
      const res = isLinked
        ? await apiCaller.post(LINKED_GAMES_API.ROUND, { game_type: "hb", game_id: gameId, actual: inputValue })
        : await apiCaller.post(HB_GAMES_API.ROUND, { game_id: gameId, actual: inputValue });
      const data = res.data;
      if (data.round_num !== undefined && data.round_num !== results.length + 1) {
        alert("서버/클라이언트 불일치가 감지되어 페이지를 리로드합니다.");
        window.location.reload();
        return;
      }
      setCumPnL({ hb: data.cum_pnl.hb, gh: data.cum_pnl.gh, user_a: data.cum_pnl.user_a || 0, user_z: data.cum_pnl.user_z || 0 });
      setPickResult({ method: data.method, pick: data.pick, nickname: data.nickname });
      setHbPatterns(data.hb_patterns || {});
      setGlobalhitData(data.globalhit || []);
      setBetData(data.bet ? { ...data.bet, user_martin: data.user_martin } : null);
      setUserSummary(data.user_summary || null);
      setUserMartinDashboard(data.user_martin_dashboard || null);
      checkGoalAlert(data.user_summary);

      if (endingMode && endingSnapshot && checkEndingComplete(data)) {
        setEndingDone(true);
        setBetData(null);
      }
    } catch (err) {
      console.error("Failed to record round:", err);
      setResults((prev) => prev.slice(0, -1));
      if (err.response?.status === 404) {
        alert("게임이 종료되었거나 존재하지 않습니다.");
        navigate("/");
        return;
      }
      alert("서버 오류로 입력이 반영되지 않았습니다. 다시 시도해주세요.");
    } finally {
      processingRef.current = false;
      setProcessing(false);
    }
  };

  const handleDeleteOne = useCallback(async () => {
    if (results.length === 0 || !gameId || processingRef.current) return;
    processingRef.current = true;
    setProcessing(true);
    try {
      const res = isLinked
        ? await apiCaller.delete(LINKED_GAMES_API.LAST_ROUND, { params: { game_type: "hb", game_id: gameId } })
        : await apiCaller.delete(HB_GAMES_API.LAST_ROUND(gameId));
      const data = res.data;
      setResults(results.slice(0, -1));
      setCumPnL(data.cum_pnl || { hb: 0, gh: 0, user_a: 0, user_z: 0 });
      setPickResult({ method: data.method, pick: data.pick, nickname: data.nickname });
      setHbPatterns(data.hb_patterns || {});
      setGlobalhitData(data.globalhit || []);
      setBetData(data.bet ? { ...data.bet, user_martin: data.user_martin } : null);
      setUserSummary(data.user_summary || null);
      setUserMartinDashboard(data.user_martin_dashboard || null);
      if (data.status === "ending" && data.ending_snapshot) {
        setEndingMode(true); setEndingSnapshot(data.ending_snapshot);
      } else {
        setEndingMode(false); setEndingSnapshot(null); setEndingDone(false);
      }
    } catch (err) {
      console.error("Failed to delete last round:", err);
    } finally {
      processingRef.current = false;
      setProcessing(false);
    }
  }, [gameId, results]);

  const handleNextGame = async () => {
    if (!gameId || results.length === 0) return;
    setProcessing(true);
    try {
      const res = isLinked
        ? await apiCaller.post(LINKED_GAMES_API.NEXT, { game_type: "hb", game_id: gameId })
        : await apiCaller.post(HB_GAMES_API.NEXT, null, { params: { game_id: gameId } });
      setResults([]); setBetData(null);
      setPickResult({ method: "wait", pick: null, nickname: null });
      setHbPatterns({});
      setGlobalhitData(res.data.globalhit || []);
      setGameId(res.data.game_id);
      setSearchParams({ gameId: res.data.game_id }, { replace: true });
      if (res.data.carry_pnl) {
        setCumPnL({ hb: res.data.carry_pnl.hb || 0, gh: res.data.carry_pnl.gh || 0, user_a: res.data.carry_pnl.user_a || 0, user_z: res.data.carry_pnl.user_z || 0 });
      } else {
        setCumPnL({ hb: 0, gh: 0, user_a: 0, user_z: 0 });
      }
      if (res.data.status === "ending" && res.data.ending_snapshot) {
        setEndingMode(true); setEndingSnapshot(res.data.ending_snapshot);
      } else {
        setEndingMode(false); setEndingSnapshot(null);
      }
    } catch (err) {
      console.error("Failed to next game:", err);
    } finally {
      setProcessing(false);
    }
  };

  // ED: 종료 모드 진입
  const handleEndingMode = async () => {
    if (endingMode || !gameId) return;
    const snapshot = { hb: [], gh: [] };
    Object.entries(hbPatterns).forEach(([nn, st]) => {
      if (st.step > 1) snapshot.hb.push(nn);
    });
    if (globalhitData) {
      globalhitData.forEach((pat) => {
        pat.groups.forEach((g) => {
          if (g.step > 1) snapshot.gh.push(`${pat.pattern}-${g.group + 1}`);
        });
      });
    }

    if (snapshot.hb.length === 0 && snapshot.gh.length === 0) {
      try {
        await apiCaller.post(HB_GAMES_API.ENDING, { game_id: gameId, snapshot });
      } catch {}
      setEndingMode(true); setEndingSnapshot(snapshot); setEndingDone(true);
      return;
    }

    try {
      const res = await apiCaller.post(HB_GAMES_API.ENDING, { game_id: gameId, snapshot });
      const data = res.data;
      setPickResult({ method: data.method, pick: data.pick, nickname: data.nickname });
      setHbPatterns(data.hb_patterns || {});
      setGlobalhitData(data.globalhit || []);
      setBetData(data.bet ? { ...data.bet, user_martin: data.user_martin } : null);
      setUserSummary(data.user_summary || null);
      setUserMartinDashboard(data.user_martin_dashboard || null);
    } catch (err) {
      console.error("Failed to start ending:", err);
    }
    setEndingMode(true); setEndingSnapshot(snapshot);
  };

  const checkEndingComplete = (data) => {
    if (!endingSnapshot) return false;
    const hbTracked = endingSnapshot.hb || [];
    for (const nn of hbTracked) {
      const st = data.hb_patterns?.[nn];
      if (st && st.step > 1) return false;
    }
    const ghTracked = endingSnapshot.gh || [];
    if (data.globalhit) {
      for (const key of ghTracked) {
        const [pat, grp] = key.split("-");
        const grpNum = parseInt(grp);
        for (const patData of data.globalhit) {
          if (patData.pattern === pat) {
            const g = patData.groups.find((x) => x.group === grpNum - 1);
            if (g && g.step > 1) return false;
          }
        }
      }
    }
    return true;
  };

  const handleFinishGame = async () => {
    if (gameId) {
      try {
        await apiCaller.post(HB_GAMES_API.END, null, { params: { game_id: gameId } });
      } catch {}
    }
    setEndingMode(false); setEndingSnapshot(null); setEndingDone(false);
    setResults([]); setCumPnL({ hb: 0, gh: 0, user_a: 0, user_z: 0 }); setBetData(null);
    setPickResult({ method: "wait", pick: null, nickname: null });
    setHbPatterns({}); setGlobalhitData([]);
    setSearchParams({}, { replace: true });
    startGame();
  };

  // new game: carry-over 없이 새 게임 시작
  const handleNewGameConfirm = async () => {
    setShowNewConfirm(false);
    setProcessing(true);
    try {
      if (gameId && results.length > 0) {
        try {
          await apiCaller.post(HB_GAMES_API.END, null, { params: { game_id: gameId } });
        } catch {}
      }
      setEndingMode(false); setEndingSnapshot(null); setEndingDone(false);
      setResults([]); setCumPnL({ hb: 0, gh: 0, user_a: 0, user_z: 0 }); setBetData(null);
      setPickResult({ method: "wait", pick: null, nickname: null });
      setHbPatterns({}); setGlobalhitData([]);
      await startGame();
    } finally {
      setProcessing(false);
    }
  };

  const sortedPatterns = nicknames.length > 0 ? nicknames : Object.keys(hbPatterns).sort();

  return (
    <Box sx={{ p: isMobile ? 0.5 : 2 }}>
      <Box sx={{ mb: 1, display: "flex", alignItems: "baseline", gap: 1 }}>
        <span style={{ fontSize: 14, fontWeight: "bold", color: "#fff" }}>허니비</span>
        {gameId && <span style={{ fontSize: 11, color: "#888" }}>#{gameId}</span>}
      </Box>
      {/* ===== 상단: 6x40 빅로드 격자 ===== */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: `repeat(${GRID_COLS}, ${isMobile ? 16 : 26}px)`,
          gridTemplateRows: `repeat(${GRID_ROWS}, ${isMobile ? 16 : 26}px)`,
          gap: "1px", mb: 2, backgroundColor: "#616161",
          border: "1px solid #616161", width: "fit-content",
        }}
      >
        {grid.map((row, rowIndex) =>
          row.map((cell, colIndex) => (
            <Box
              key={`${rowIndex}-${colIndex}`}
              sx={{
                display: "flex", alignItems: "center", justifyContent: "center",
                backgroundColor: cell ? (CELL_BG[cell.status] || "background.default") : "background.default",
              }}
            >
              {cell && <Circle type={cell.type} filled={true} size={isMobile ? 12 : 22} label={cell.idx + 1} />}
            </Box>
          ))
        )}
      </Box>

      {/* ===== 중단: 인터페이스 (한줄) ===== */}
      <Box sx={{ display: "flex", alignItems: "center", gap: isMobile ? 0.5 : 1, mb: 1, flexWrap: "wrap" }}>
        {/* 좌: 마틴A/Z 2행 */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
          {/* 마틴A 행 */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <Box sx={{ borderRadius: 1, px: isMobile ? 0.6 : 1, py: 0.2, backgroundColor: "#1565c0", display: "flex", alignItems: "center", justifyContent: "center", minWidth: isMobile ? 36 : 48 }}>
              <Typography variant="caption" sx={{ fontSize: isMobile ? 9 : 11, fontWeight: "bold", color: "#fff" }}>마틴A</Typography>
            </Box>
            <Box sx={{ border: "1px solid rgba(255,255,255,0.3)", borderRadius: 1, px: isMobile ? 1 : 2, py: 0.2, minWidth: isMobile ? 80 : 140, display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
              <Typography variant="caption" sx={{ fontSize: isMobile ? 10 : 12, fontWeight: "bold", color: "#4caf50" }}>
                {betData?.user_martin?.martin_a?.amount ? `${betData.user_martin.martin_a.amount.toLocaleString()}${betData.user_martin.martin_a.direction || ""}` : "0"}
              </Typography>
            </Box>
          </Box>
          {/* 마틴Z 행 */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <Box sx={{ borderRadius: 1, px: isMobile ? 0.6 : 1, py: 0.2, backgroundColor: "#c62828", display: "flex", alignItems: "center", justifyContent: "center", minWidth: isMobile ? 36 : 48 }}>
              <Typography variant="caption" sx={{ fontSize: isMobile ? 9 : 11, fontWeight: "bold", color: "#fff" }}>마틴Z</Typography>
            </Box>
            <Box sx={{ border: "1px solid rgba(255,255,255,0.3)", borderRadius: 1, px: isMobile ? 1 : 2, py: 0.2, minWidth: isMobile ? 80 : 140, display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
              <Typography variant="caption" sx={{ fontSize: isMobile ? 10 : 12, fontWeight: "bold", color: "#4caf50" }}>
                {betData?.user_martin?.martin_z?.amount ? `${betData.user_martin.martin_z.amount.toLocaleString()}${betData.user_martin.martin_z.direction || ""}` : "0"}
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* 픽이미지 A/Z 2개 */}
        {processing ? (
          <Box sx={{ width: isMobile ? 108 : 194, height: isMobile ? 52 : 95, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <CircularProgress size={isMobile ? 28 : 40} sx={{ color: "rgba(255,255,255,0.6)" }} />
          </Box>
        ) : (() => {
          const umA = betData?.user_martin?.martin_a;
          const umZ = betData?.user_martin?.martin_z;
          const pickA = umA?.direction || null;
          const pickZ = umZ?.direction || null;
          const imgA = pickA === "P" ? "/player.png" : pickA === "B" ? "/banker.png" : "/wait.png";
          const imgZ = pickZ === "P" ? "/player.png" : pickZ === "B" ? "/banker.png" : "/wait.png";
          const sz = isMobile ? 46 : 85;
          const boxSz = isMobile ? 52 : 95;
          return (
            <Box sx={{ display: "flex", gap: 0.5 }}>
              <Box sx={{ width: boxSz, height: boxSz, border: "2px solid rgba(255,255,255,0.3)", borderRadius: 2, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                <img src={imgA} alt="pickA" style={{ width: sz, height: sz, objectFit: "contain" }} />
                <Typography variant="caption" sx={{ position: "absolute", top: 2, left: 4, fontSize: isMobile ? 8 : 10, color: "#1565c0", fontWeight: "bold" }}>A</Typography>
              </Box>
              <Box sx={{ width: boxSz, height: boxSz, border: "2px solid rgba(255,255,255,0.3)", borderRadius: 2, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                <img src={imgZ} alt="pickZ" style={{ width: sz, height: sz, objectFit: "contain" }} />
                <Typography variant="caption" sx={{ position: "absolute", top: 2, left: 4, fontSize: isMobile ? 8 : 10, color: "#c62828", fontWeight: "bold" }}>Z</Typography>
              </Box>
            </Box>
          );
        })()}
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.2 }}>
          <Box sx={{ width: isMobile ? 24 : 40, height: isMobile ? 24 : 40, border: `2px solid ${isLinked ? "#ff9800" : "rgba(255,255,255,0.3)"}`, borderRadius: 1, backgroundColor: "#333", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Typography variant="body2" sx={{ fontWeight: "bold", fontSize: isMobile ? 10 : 16 }}>{currentTurn}</Typography>
          </Box>
          {isLinked && <Typography variant="caption" sx={{ fontSize: 7, color: "#ff9800", fontWeight: "bold" }}>연동</Typography>}
        </Box>
        <Box
          onClick={() => handleInput("P")}
          sx={{
            width: isMobile ? 38 : 55, height: isMobile ? 38 : 55, borderRadius: 2,
            backgroundColor: "#1565c0", display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontSize: isMobile ? 16 : 24, fontWeight: "bold",
            cursor: processing ? "not-allowed" : "pointer", opacity: processing ? 0.4 : 1, pointerEvents: processing ? "none" : "auto",
            "&:hover": { opacity: processing ? 0.4 : 0.85 }, "&:active": { transform: "scale(0.95)" },
          }}
        >P</Box>
        <Box
          onClick={() => handleInput("B")}
          sx={{
            width: isMobile ? 38 : 55, height: isMobile ? 38 : 55, borderRadius: 2,
            backgroundColor: "#f44336", display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontSize: isMobile ? 16 : 24, fontWeight: "bold",
            cursor: processing ? "not-allowed" : "pointer", opacity: processing ? 0.4 : 1, pointerEvents: processing ? "none" : "auto",
            "&:hover": { opacity: processing ? 0.4 : 0.85 }, "&:active": { transform: "scale(0.95)" },
          }}
        >B</Box>

        {/* del/next/new/셋업 */}
        <Box
          onClick={results.length > 0 && !processing ? handleDeleteOne : undefined}
          sx={{ ...controlBtnSx, cursor: processing ? "not-allowed" : results.length > 0 ? "pointer" : "default", opacity: processing ? 0.4 : results.length > 0 ? 1 : 0.4, pointerEvents: processing ? "none" : "auto" }}
        >
          <Typography variant="caption" sx={{ fontSize: isMobile ? 10 : 13 }}>del</Typography>
        </Box>
        <Box
          onClick={results.length > 0 && !processing ? () => setShowNextConfirm(true) : undefined}
          sx={{ ...controlBtnSx, cursor: processing ? "not-allowed" : results.length > 0 ? "pointer" : "default", opacity: processing ? 0.4 : results.length > 0 ? 1 : 0.4, pointerEvents: processing ? "none" : "auto", border: "2px solid rgba(255,255,255,0.3)" }}
        >
          <Typography variant="caption" sx={{ fontSize: isMobile ? 10 : 12 }}>next</Typography>
        </Box>
        <Box
          onClick={!processing ? () => setShowNewConfirm(true) : undefined}
          sx={{ ...controlBtnSx, cursor: processing ? "not-allowed" : "pointer", opacity: processing ? 0.4 : 1, pointerEvents: processing ? "none" : "auto", border: "2px solid #2196f3" }}
        >
          <Typography variant="caption" sx={{ fontSize: isMobile ? 10 : 12, color: "#2196f3" }}>new</Typography>
        </Box>
        <Box
          onClick={() => navigate(`/hbgame/user-setup${gameId ? `?gameId=${gameId}` : ""}`)}
          sx={{ ...controlBtnSx, cursor: "pointer", border: "2px solid #ff9800" }}
        >
          <Typography variant="caption" sx={{ fontSize: isMobile ? 10 : 12, color: "#ff9800", fontWeight: "bold" }}>셋업</Typography>
        </Box>
      </Box>

      {/* 종료 다이얼로그 */}
      <Dialog open={endingDone} onClose={() => {}}>
        <DialogTitle sx={{ fontWeight: "bold" }}>게임 종료</DialogTitle>
        <DialogContent>
          <Typography>모든 배팅이 완료되었습니다.</Typography>
          <Box sx={{ mt: 2 }}>
            {[
              { name: "마틴A", pnl: cumPnL.user_a },
              { name: "마틴Z", pnl: cumPnL.user_z },
              { name: "Globalhit", pnl: cumPnL.gh },
            ].map((item) => (
              <Typography key={item.name} sx={{ color: item.pnl >= 0 ? "#4caf50" : "#f44336" }}>
                {item.name}: {item.pnl > 0 ? "+" : ""}{item.pnl.toLocaleString()}P
              </Typography>
            ))}
            <Typography sx={{ mt: 1, fontWeight: "bold", color: (cumPnL.gh + cumPnL.user_a + cumPnL.user_z) >= 0 ? "#4caf50" : "#f44336" }}>
              Total: {(cumPnL.gh + cumPnL.user_a + cumPnL.user_z) > 0 ? "+" : ""}{(cumPnL.gh + cumPnL.user_a + cumPnL.user_z).toLocaleString()}P
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleFinishGame} variant="contained">새 게임 시작</Button>
        </DialogActions>
      </Dialog>

      {/* 새 게임 확인 대화상자 */}
      {/* 이전 게임 복원 확인 */}
      <Dialog open={!!resumeGame} onClose={async () => { const gid = resumeGame?.game_id; setResumeGame(null); if (gid) { try { await apiCaller.post(HB_GAMES_API.END, null, { params: { game_id: gid } }); } catch {} } startGame(); }}>
        <DialogTitle sx={{ fontWeight: "bold" }}>이전 게임 복원</DialogTitle>
        <DialogContent>
          <Typography>진행 중인 게임이 있습니다. (#{resumeGame?.game_id}, {resumeGame?.round_count}회차)</Typography>
          <Typography>이어서 하시겠습니까?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={async () => { const gid = resumeGame.game_id; setResumeGame(null); try { await apiCaller.post(HB_GAMES_API.END, null, { params: { game_id: gid } }); } catch {} startGame(); }}>새 게임</Button>
          <Button onClick={() => { const gid = resumeGame.game_id; setResumeGame(null); restoreGame(gid); }} variant="contained">이어하기</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={showNewConfirm} onClose={() => setShowNewConfirm(false)}>
        <DialogTitle sx={{ fontWeight: "bold" }}>새 게임</DialogTitle>
        <DialogContent>
          <Typography>carry-over 없이 새 게임을 시작합니다.</Typography>
          <Typography>계속하시겠습니까?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowNewConfirm(false)}>취소</Button>
          <Button onClick={handleNewGameConfirm} variant="contained">확인</Button>
        </DialogActions>
      </Dialog>

      {/* 넥스트 게임 확인 */}
      <Dialog open={showNextConfirm} onClose={() => setShowNextConfirm(false)}>
        <DialogTitle>다음 게임</DialogTitle>
        <DialogContent>
          <Typography variant="body2">현재 게임을 종료하고 다음 게임으로 넘어가시겠습니까?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowNextConfirm(false)}>취소</Button>
          <Button onClick={() => { setShowNextConfirm(false); handleNextGame(); }} color="primary" variant="contained">확인</Button>
        </DialogActions>
      </Dialog>

      {/* ===== 총금액 요약 (A그룹 / Z그룹) ===== */}
      {(() => {
        const sA = userSummary?.martin_a;
        const sZ = userSummary?.martin_z;

        const formalADir = sA?.direction || "wait";
        const formalZDir = sZ?.direction || "wait";
        const formalAColor = formalADir === "P" ? "#1565c0" : formalADir === "B" ? "#f44336" : "#888";
        const formalZColor = formalZDir === "P" ? "#1565c0" : formalZDir === "B" ? "#f44336" : "#888";

        const martinPnlA = sA?.pnl || 0;
        const martinPnlZ = sZ?.pnl || 0;

        const martinActive = (sA?.bet_p || 0) + (sA?.bet_b || 0) > 0;
        const martinZActive = (sZ?.bet_p || 0) + (sZ?.bet_b || 0) > 0;

        const pnlText = (v) => { const s = v > 0 ? "+" : ""; return `${s}${v.toLocaleString()}P`; };
        const pnlColor = (v) => v > 0 ? "#4caf50" : v < 0 ? "#f44336" : "#fff";

        if (isMobile) {
          const rowSx = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 0.5, borderRadius: 1, px: 0.8, py: 0.3, whiteSpace: "nowrap" };
          const renderGroup = (label, fDir, fColor, mPnl, mActive) => (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.3, flex: 1 }}>
              <Box sx={{ ...rowSx, border: "1px solid rgba(255,255,255,0.3)" }}>
                <Typography variant="caption" sx={{ fontSize: 9, color: "#888" }}>formal</Typography>
                <Typography variant="caption" sx={{ fontSize: 11, fontWeight: "bold", color: fColor }}>{fDir}</Typography>
              </Box>
              <Box sx={{ ...rowSx, border: `1px solid ${mActive ? "rgba(255,255,255,0.3)" : "#333"}` }}>
                <Typography variant="caption" sx={{ fontSize: 9, color: "#888" }}>{label}</Typography>
                <Typography variant="caption" sx={{ fontSize: 11, fontWeight: "bold", color: pnlColor(mPnl) }}>{pnlText(mPnl)}</Typography>
              </Box>
              <Box sx={{ ...rowSx, backgroundColor: "#00bcd4" }}>
                <Typography variant="caption" sx={{ fontSize: 9, color: "#000" }}>합계</Typography>
                <Typography variant="caption" sx={{ fontSize: 11, fontWeight: "bold", color: mPnl < 0 ? "#f44336" : "#000" }}>{pnlText(mPnl)}</Typography>
              </Box>
            </Box>
          );
          return (
            <Box sx={{ display: "flex", gap: 1, mb: 1 }}>
              {renderGroup("마틴A", formalADir, formalAColor, martinPnlA, martinActive)}
              {renderGroup("마틴Z", formalZDir, formalZColor, martinPnlZ, martinZActive)}
            </Box>
          );
        }

        const renderGroup = (label, fDir, fColor, mPnl, mActive) => (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.3, flex: 1 }}>
            <Box sx={{ border: "1px solid rgba(255,255,255,0.3)", borderRadius: 2, px: 2, py: 0.3, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Typography variant="caption" sx={{ fontSize: 11, fontWeight: "bold", color: "#888" }}>formal</Typography>
              <Typography variant="caption" sx={{ fontSize: 11, fontWeight: "bold", color: fColor }}>{fDir}</Typography>
            </Box>
            <Box sx={{ border: `1px solid ${mActive ? "rgba(255,255,255,0.3)" : "#333"}`, borderRadius: 2, px: 2, py: 0.3, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Typography variant="caption" sx={{ fontSize: 11, fontWeight: "bold", color: "#fff" }}>{label}</Typography>
              <Typography variant="caption" sx={{ fontSize: 11, fontWeight: "bold", color: pnlColor(mPnl) }}>{pnlText(mPnl)}</Typography>
            </Box>
            <Box sx={{ backgroundColor: "#00bcd4", borderRadius: 2, px: 2, py: 0.3, display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
              <Typography variant="caption" sx={{ fontSize: 11, fontWeight: "bold", color: mPnl < 0 ? "#f44336" : "#000" }}>{pnlText(mPnl)}</Typography>
            </Box>
          </Box>
        );

        return (
          <Box sx={{ display: "flex", gap: 1, mb: 1 }}>
            {renderGroup("마틴A", formalADir, formalAColor, martinPnlA, martinActive)}
            {renderGroup("마틴Z", formalZDir, formalZColor, martinPnlZ, martinZActive)}
          </Box>
        );
      })()}

      {/* ===== 어드민 전용: 대시보드 + 글로벌히트 상세 ===== */}
      {isAdmin && (() => {
        const hb = betData?.honeybee;
        const gh = betData?.globalhit;
        const combined = betData?.combined;
        const combinedDir = combined?.direction || "wait";
        const dirColor = combinedDir === "P" ? "#1565c0" : combinedDir === "B" ? "#f44336" : "#888";
        const dc = { border: "1px solid #555", padding: isMobile ? "2px 4px" : "3px 12px", fontSize: isMobile ? 8 : 10, textAlign: "center", whiteSpace: "nowrap" };
        const dcB = { ...dc, fontWeight: "bold" };
        const ghPatterns = ["PPP", "BBB", "PBP", "BPB", "PPB", "BBP", "PBB", "BPP"];
        const getPatSec = (pat, sec) => {
          const d = gh?.details?.find((x) => x.pattern === pat && x.group === sec + 1);
          return d ? d.amount : 0;
        };
        const hbHasBet = (hb?.P || 0) + (hb?.B || 0) > 0;
        const ghHasBet = (gh?.P || 0) + (gh?.B || 0) > 0;
        const anyBet = hbHasBet || ghHasBet;

        const umaDash = userMartinDashboard?.martin_a || {};
        const umzDash = userMartinDashboard?.martin_z || {};
        const hbGroups = config?.honeybee?.groups || [];
        const currentNn = pickResult.nickname;
        const groupedSet = new Set();
        if (currentNn) {
          groupedSet.add(currentNn);
          for (const g of hbGroups) {
            const members = (g.patterns || []).filter(Boolean);
            if (members.includes(currentNn)) members.forEach((m) => groupedSet.add(m));
          }
        }

        return (
          <>
            {/* 상단 요약 바 — 마틴A / 마틴Z 분리 */}
            {!isMobile && (() => {
              const umA = betData?.user_martin?.martin_a;
              const umZ = betData?.user_martin?.martin_z;
              const adminP = (hb?.P || 0) + (gh?.P || 0);
              const adminB = (hb?.B || 0) + (gh?.B || 0);
              const aDirRaw = umA?.direction || "wait";
              const zDirRaw = umZ?.direction || "wait";
              const fAP = adminP + (aDirRaw === "P" ? (umA?.amount || 0) : 0);
              const fAB = adminB + (aDirRaw === "B" ? (umA?.amount || 0) : 0);
              const fADir = fAP > fAB ? "P" : fAB > fAP ? "B" : "wait";
              const fAColor = fADir === "P" ? "#1565c0" : fADir === "B" ? "#f44336" : "#888";
              const fZP = adminP + (zDirRaw === "P" ? (umZ?.amount || 0) : 0);
              const fZB = adminB + (zDirRaw === "B" ? (umZ?.amount || 0) : 0);
              const fZDir = fZP > fZB ? "P" : fZB > fZP ? "B" : "wait";
              const fZColor = fZDir === "P" ? "#1565c0" : fZDir === "B" ? "#f44336" : "#888";
              const pnlText = (v) => `${v > 0 ? "+" : ""}${v.toLocaleString()}P`;
              const pnlClr = (v) => v > 0 ? "#4caf50" : v < 0 ? "#f44336" : "#fff";
              const umAHasBet = (umA?.amount || 0) > 0;
              const umZHasBet = (umZ?.amount || 0) > 0;
              const sumA = cumPnL.user_a + cumPnL.gh;
              const sumZ = cumPnL.user_z + cumPnL.gh;
              const barSx = { border: "1px solid rgba(255,255,255,0.3)", borderRadius: 2, px: 2, py: 0.3, display: "flex", alignItems: "center", justifyContent: "space-between", flex: 1 };
              const renderBar = (label, fDir, fColor, martinPnl, martinActive, ghPnl, total) => (
                <Box sx={{ display: "flex", gap: 0.5, flex: 1 }}>
                  <Box sx={{ ...barSx, minWidth: 0, justifyContent: "center" }}>
                    <Typography variant="caption" sx={{ fontSize: 11, fontWeight: "bold", color: fColor }}>{`formal(${fDir})`}</Typography>
                  </Box>
                  <Box sx={{ ...barSx, border: `1px solid ${martinActive ? "rgba(255,255,255,0.3)" : "#333"}` }}>
                    <Typography variant="caption" sx={{ fontSize: 11, fontWeight: "bold", color: "#fff" }}>{label}</Typography>
                    <Typography variant="caption" sx={{ fontSize: 11, fontWeight: "bold", color: pnlClr(martinPnl) }}>{pnlText(martinPnl)}</Typography>
                  </Box>
                  <Box sx={{ ...barSx, border: `1px solid ${ghHasBet ? "rgba(255,255,255,0.3)" : "#333"}` }}>
                    <Typography variant="caption" sx={{ fontSize: 11, fontWeight: "bold", color: "#fff" }}>GH</Typography>
                    <Typography variant="caption" sx={{ fontSize: 11, fontWeight: "bold", color: pnlClr(ghPnl) }}>{pnlText(ghPnl)}</Typography>
                  </Box>
                  <Box sx={{ backgroundColor: "#00bcd4", borderRadius: 2, px: 2, py: 0.3, display: "flex", alignItems: "center", justifyContent: "flex-end", minWidth: 80 }}>
                    <Typography variant="caption" sx={{ fontSize: 11, fontWeight: "bold", color: total < 0 ? "#f44336" : "#000" }}>{pnlText(total)}</Typography>
                  </Box>
                </Box>
              );
              return (
                <Box sx={{ display: "flex", gap: 1, mb: 0.5 }}>
                  {renderBar("마틴A", fADir, fAColor, cumPnL.user_a, umAHasBet, cumPnL.gh, sumA)}
                  {renderBar("마틴Z", fZDir, fZColor, cumPnL.user_z, umZHasBet, cumPnL.gh, sumZ)}
                </Box>
              );
            })()}

            {/* 배팅 상황판 — 마틴A / 마틴Z 각각 독립 테이블 */}
            {(() => {
              const umA = betData?.user_martin?.martin_a;
              const umZ = betData?.user_martin?.martin_z;
              const adminP = (hb?.P || 0) + (gh?.P || 0);
              const adminB = (hb?.B || 0) + (gh?.B || 0);
              const hbDimStyle = hbHasBet ? {} : { filter: "grayscale(100%)", opacity: 0.7 };
              const ghDimStyle = ghHasBet ? {} : { filter: "grayscale(100%)", opacity: 0.7 };
              const martinTable = (label, um, labelColor, dash) => {
                const hbAmounts = dash.amounts || new Array(20).fill(0);
                const hbStepMin = dash.step_min || 1;
                const hbStepMax = dash.step_max || 20;
                // 마틴Z: dash.step (통합 단계), 마틴A: dash.steps (패턴별 단계)
                const unifiedStep = dash.step || null;
                const patternSteps = dash.steps || {};
                const mDir = um?.direction || "wait";
                const mAmt = um?.amount || 0;
                const mP = mDir === "P" ? mAmt : 0;
                const mB = mDir === "B" ? mAmt : 0;
                const totalP = adminP + mP;
                const totalB = adminB + mB;
                const fDir = totalP > totalB ? "P" : totalB > totalP ? "B" : "wait";
                const fColor = fDir === "P" ? "#1565c0" : fDir === "B" ? "#f44336" : "#888";
                const mHasBet = mAmt > 0;
                const mDimStyle = mHasBet ? {} : { filter: "grayscale(100%)", opacity: 0.7 };
                return (
                  <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, mb: 0.5 }}>
                  <Box>
                  <table style={{ borderCollapse: "collapse", width: "fit-content", marginBottom: 4, opacity: anyBet ? 1 : 0.8 }}>
                    <tbody>
                      <tr>
                        <td style={{ ...dcB, color: fColor }}>{`formal(${fDir})`}</td>
                        <td style={{ ...dcB, color: labelColor, ...mDimStyle }}>{label}</td>
                        <td style={{ ...dc, color: "#1565c0", ...mDimStyle }}>{`${mP.toLocaleString()}P`}</td>
                        <td style={{ ...dc, color: "#f44336", ...mDimStyle }}>{`${mB.toLocaleString()}P`}</td>
                        <td style={{ ...dcB, color: "#00bcd4", ...ghDimStyle }}>GH</td>
                        <td style={{ ...dc, color: "#1565c0", ...ghDimStyle }}>{`${(gh?.P || 0).toLocaleString()}P`}</td>
                        <td style={{ ...dc, color: "#f44336", ...ghDimStyle }}>{`${(gh?.B || 0).toLocaleString()}P`}</td>
                        <td style={{ ...dcB, color: "#fff" }}>{currentTurn}</td>
                        <td style={{ ...dc, color: "#1565c0" }}>{`${totalP.toLocaleString()}P`}</td>
                        <td style={{ ...dc, color: "#f44336" }}>{`${totalB.toLocaleString()}P`}</td>
                        {Array.from({ length: 6 }, (_, i) => <td key={i} style={{ ...dc }}></td>)}
                      </tr>
                      {[[ghPatterns[0], ghPatterns[1]], [ghPatterns[2], ghPatterns[3]], [ghPatterns[4], ghPatterns[5]], [ghPatterns[6], ghPatterns[7]]].map((pair, ri) => (
                        <tr key={`gh-${ri}`}>
                          {pair.map((pat) =>
                            [0, 1, 2].map((sec) => {
                              const amt = getPatSec(pat, sec);
                              const hasBet = amt > 0;
                              const dimStyle = hasBet ? {} : { filter: "grayscale(100%)", opacity: 0.7 };
                              return (
                                <React.Fragment key={`${pat}-${sec}`}>
                                  <td style={{ ...dc, ...dimStyle }}>
                                    {pat.split("").map((c, ci) => (
                                      <span key={ci} style={{ color: c === "P" ? "#1565c0" : "#f44336", fontWeight: "bold" }}>{c}</span>
                                    ))}
                                    <span style={{ fontSize: 9 }}>({sec + 1}sc)</span>
                                  </td>
                                  <td style={{ ...dc, ...dimStyle }}>{`${amt.toLocaleString()}P`}</td>
                                </React.Fragment>
                              );
                            })
                          )}
                          {Array.from({ length: 4 }, (_, i) => <td key={`pad-${i}`} style={{ ...dc }}></td>)}
                        </tr>
                      ))}
                      <tr>
                        <td style={{ ...dcB, color: "#ff9800" }}>honeybee</td>
                        <td style={{ ...dcB, color: "#ff9800" }}>pick</td>
                        {Array.from({ length: 14 }, (_, i) => (
                          <td key={i} style={{ ...dc, color: "#ff9800" }}>{i + 1}step</td>
                        ))}
                      </tr>
                      {sortedPatterns.map((nn) => {
                        const st = hbPatterns[nn] || { step: 1, wins: 0, losses: 0, amount: 0, direction: null };
                        const isCurrentPick = groupedSet.has(nn);
                        const isExactPick = pickResult.nickname === nn;
                        // 마틴Z: 통합 단계, 마틴A: 패턴별 단계 (서버에서 계산된 값)
                        const currentStep = unifiedStep != null ? unifiedStep : (patternSteps[nn] || hbStepMin);
                        return (
                          <tr key={nn}>
                            <td style={{ ...dc, color: isCurrentPick ? "#fff" : "#555", fontWeight: isCurrentPick ? "bold" : "normal" }}>{nn}</td>
                            <td style={{ ...dc, color: isExactPick ? (st.direction === "P" ? "#1565c0" : st.direction === "B" ? "#f44336" : "#555") : "#555", fontWeight: isExactPick ? "bold" : "normal" }}>
                              {isExactPick ? (st.direction || "-") : "-"}
                            </td>
                            {Array.from({ length: 14 }, (_, i) => {
                              const stepNum = i + 1;
                              const isCurrent = currentStep === stepNum;
                              const inRange = stepNum >= hbStepMin && stepNum <= hbStepMax;
                              const amt = inRange ? (hbAmounts[stepNum - 1] || 0) : 0;
                              return (
                                <td key={i} style={{
                                  ...dc,
                                  color: isCurrent && isCurrentPick ? "#fff" : stepNum < currentStep ? "#c8a415" : "#555",
                                  fontWeight: (isCurrent && isCurrentPick) || stepNum < currentStep ? "bold" : "normal",
                                  backgroundColor: isCurrent && isCurrentPick ? "rgba(255,255,255,0.08)" : "transparent",
                                }}>
                                  {inRange ? amt.toLocaleString() : ""}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  </Box>
                  </Box>
                );
              };
              return (
                <>
                  {martinTable("마틴A", umA, "#1565c0", umaDash)}
                  {martinTable("마틴Z", umZ, "#c62828", umzDash)}
                </>
              );
            })()}

            {/* 모바일: 우측 요약 */}
            {isMobile && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, minWidth: 105 }}>
              {(() => {
                const totalPnL = cumPnL.hb + cumPnL.gh;
                const items = [
                  { name: "formal", value: combinedDir, color: dirColor, isFormal: true },
                  { name: "Honeybee", pnl: cumPnL.hb, active: hbHasBet },
                  { name: "globalhit", pnl: cumPnL.gh, active: ghHasBet },
                  { name: "합계", pnl: totalPnL, isTotal: true },
                ];
                const rowSx = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 0.5, borderRadius: 1, px: 0.8, py: 0.3, whiteSpace: "nowrap" };
                return items.map((item, i) => {
                  if (item.isFormal) return (
                    <Box key={i} sx={{ ...rowSx, border: "1px solid rgba(255,255,255,0.3)" }}>
                      <Typography variant="caption" sx={{ fontSize: 9, color: "#888" }}>{item.name}</Typography>
                      <Typography variant="caption" sx={{ fontSize: 11, fontWeight: "bold", color: item.color }}>{item.value}</Typography>
                    </Box>
                  );
                  if (item.isTotal) {
                    const sign = item.pnl > 0 ? "+" : "";
                    return (
                      <Box key={i} sx={{ ...rowSx, backgroundColor: "#00bcd4" }}>
                        <Typography variant="caption" sx={{ fontSize: 9, color: "#000" }}>{item.name}</Typography>
                        <Typography variant="caption" sx={{ fontSize: 11, fontWeight: "bold", color: item.pnl < 0 ? "#f44336" : "#000" }}>{`${sign}${item.pnl.toLocaleString()}P`}</Typography>
                      </Box>
                    );
                  }
                  const clr = item.pnl > 0 ? "#4caf50" : item.pnl < 0 ? "#f44336" : "#fff";
                  const sign = item.pnl > 0 ? "+" : "";
                  return (
                    <Box key={i} sx={{ ...rowSx, border: `1px solid ${item.active ? "rgba(255,255,255,0.3)" : "#333"}` }}>
                      <Typography variant="caption" sx={{ fontSize: 9, color: "#888" }}>{item.name}</Typography>
                      <Typography variant="caption" sx={{ fontSize: 11, fontWeight: "bold", color: clr }}>{`${sign}${item.pnl.toLocaleString()}P`}</Typography>
                    </Box>
                  );
                });
              })()}
            </Box>
            )}

            {/* GlobalHit 패턴별 상세 */}
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
              {globalhitData.map((patData) => {
                const pat = patData.pattern;
                const cellSize = 20;
                const colsPerRow = 30;
                const totalCols = colsPerRow + 2;
                const GH_CELL_BG = { hit: "#00e676", miss: "#ffeb3b", wait: "#555" };
                const tdStyleFn = (status) => ({
                  width: cellSize, height: cellSize, border: "1px solid #555", padding: 0, textAlign: "center",
                  backgroundColor: status ? (GH_CELL_BG[status] || "#333") : "#333",
                });
                const circleStyle = (charIdx) => ({
                  width: cellSize - 2, height: cellSize - 2, borderRadius: "50%",
                  backgroundColor: pat[charIdx % pat.length] === "P" ? "#1565c0" : "#f44336",
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  color: "#fff", fontSize: 9, fontWeight: "bold",
                });
                return (
                  <Box key={pat}>
                    <Box
                      onClick={() => setCollapsedPatterns((prev) => ({ ...prev, [pat]: !prev[pat] }))}
                      sx={{
                        display: "flex", alignItems: "center", gap: 0.5, mb: 0.5,
                        border: "1px solid rgba(255,255,255,0.2)", backgroundColor: "background.paper",
                        px: 0.5, py: 0.3, cursor: "pointer",
                        "&:hover": { backgroundColor: "rgba(255,255,255,0.05)" },
                      }}
                    >
                      <Box sx={{ border: "1px solid rgba(255,255,255,0.3)", px: 1, py: 0.2 }}>
                        <Typography variant="caption" sx={{ fontSize: 11, fontWeight: "bold" }}>
                          {pat.split("").map((c, ci) => (
                            <Typography key={ci} component="span" sx={{ color: c === "P" ? "#1565c0" : "#f44336", fontWeight: "bold", fontSize: 11 }}>{c}</Typography>
                          ))}
                          <Typography component="span" sx={{ fontSize: 10, color: "text.secondary" }}>(123)</Typography>
                        </Typography>
                      </Box>
                      <Box sx={{ border: "1px solid rgba(255,255,255,0.3)", px: 0.8, py: 0.2 }}>
                        <Typography variant="caption" sx={{ fontSize: 10 }}>{results.length}</Typography>
                      </Box>
                      {patData.groups.map((g, gi) => (
                        <Box key={gi} sx={{ display: "flex", gap: 0.3, ml: gi > 0 ? 1 : 0 }}>
                          <Box sx={{ border: "1px solid rgba(255,255,255,0.3)", px: 0.6, py: 0.2 }}>
                            <Typography variant="caption" sx={{ fontSize: 10 }}>SC{gi + 1}</Typography>
                          </Box>
                          <Box sx={{ border: "1px solid rgba(255,255,255,0.3)", px: 0.6, py: 0.2 }}>
                            <Typography variant="caption" sx={{ fontSize: 10, ...((g.step ?? 0) !== 1 && { color: "#f44336", fontWeight: "bold" }) }}>{g.step ?? 0}S</Typography>
                          </Box>
                          <Box sx={{ border: "1px solid rgba(255,255,255,0.3)", px: 0.8, py: 0.2 }}>
                            <Typography variant="caption" sx={{ fontSize: 10 }}>
                              {(() => {
                                const detail = betData?.globalhit?.details?.find((d) => d.pattern === pat && d.group === gi + 1);
                                return detail ? `${detail.amount.toLocaleString()}P` : "0P";
                              })()}
                            </Typography>
                          </Box>
                        </Box>
                      ))}
                      <Box sx={{ flexGrow: 1 }} />
                    </Box>
                    {collapsedPatterns[pat] && (
                    <table style={{ borderCollapse: "collapse", borderSpacing: 0 }}>
                      <tbody>
                        {patData.groups.map((group, gi) => {
                          const row1 = group.row1;
                          const row2 = group.row2;
                          return [
                            gi > 0 && <tr key={`${gi}-gap`}><td colSpan={totalCols} style={{ height: 4, padding: 0 }} /></tr>,
                            <tr key={`${gi}-0`}>
                              {Array.from({ length: totalCols }, (_, colIdx) => {
                                const dataIdx = colIdx - gi;
                                const hasData = dataIdx >= 0 && dataIdx < row1.length;
                                const isEmpty = colIdx < gi;
                                const item = hasData ? row1[dataIdx] : null;
                                const roundNum = item?.round;
                                const isGroupEnd = hasData && (roundNum - gi) % 3 === 0;
                                const base = hasData ? tdStyleFn(item.status) : (isEmpty ? tdStyleFn(null) : { width: cellSize, height: cellSize, border: "none", padding: 0 });
                                const style = { ...base, ...(hasData && isGroupEnd && { borderRight: "2px solid #aaa" }) };
                                return <td key={colIdx} style={style}>{hasData && <div style={circleStyle(roundNum - 1)}>{roundNum}</div>}</td>;
                              })}
                            </tr>,
                            <tr key={`${gi}-1`}>
                              {Array.from({ length: totalCols }, (_, colIdx) => {
                                const hasData = colIdx < row2.length;
                                const item = hasData ? row2[colIdx] : null;
                                const roundNum = item?.round;
                                const isGroupEnd = hasData && (roundNum - gi) % 3 === 0;
                                const base = hasData ? tdStyleFn(item.status) : { width: cellSize, height: cellSize, border: "none", padding: 0 };
                                const style = { ...base, ...(hasData && isGroupEnd && { borderRight: "2px solid #aaa" }) };
                                return <td key={colIdx} style={style}>{hasData && <div style={circleStyle(roundNum - 1)}>{roundNum}</div>}</td>;
                              })}
                            </tr>,
                          ];
                        })}
                      </tbody>
                    </table>
                    )}
                  </Box>
                );
              })}
            </Box>
          </>
        );
      })()}

      <Dialog open={goalDialog.open} onClose={() => setGoalDialog({ open: false, msgs: [] })}>
        <DialogTitle sx={{ fontWeight: "bold" }}>목표금액 도달</DialogTitle>
        <DialogContent>
          <Typography>목표금액에 도달하여 배팅이 정지됩니다.</Typography>
          <Box sx={{ mt: 2 }}>
            {[
              { name: "마틴A", pnl: cumPnL.user_a },
              { name: "마틴Z", pnl: cumPnL.user_z },
              { name: "Globalhit", pnl: cumPnL.gh },
            ].map((item) => (
              <Typography key={item.name} sx={{ color: item.pnl >= 0 ? "#4caf50" : "#f44336" }}>
                {item.name}: {item.pnl > 0 ? "+" : ""}{item.pnl.toLocaleString()}P
              </Typography>
            ))}
            <Typography sx={{ mt: 1, fontWeight: "bold", color: (cumPnL.gh + cumPnL.user_a + cumPnL.user_z) >= 0 ? "#4caf50" : "#f44336" }}>
              Total: {(cumPnL.gh + cumPnL.user_a + cumPnL.user_z) > 0 ? "+" : ""}{(cumPnL.gh + cumPnL.user_a + cumPnL.user_z).toLocaleString()}P
            </Typography>
          </Box>
          <Box sx={{ mt: 2 }}>
            {goalDialog.msgs.map((m) => (
              <Typography key={m} sx={{ fontSize: "0.85rem", color: "text.secondary" }}>
                * {m} 배팅 정지
              </Typography>
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGoalDialog({ open: false, msgs: [] })} variant="contained">확인</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
