import React, { useState, useEffect, useCallback, useRef } from "react";
import { Box, Typography, useMediaQuery, useTheme, Dialog, DialogTitle, DialogContent, DialogActions, Button } from "@mui/material";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAtomValue } from "jotai";
import { userAtom } from "@/store/auth-store";
import apiCaller from "@/services/api-caller";
import { GH_GAMES_API } from "@/constants/api-url";

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

export default function GhUserGamePage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const navigate = useNavigate();
  const user = useAtomValue(userAtom);
  const isAdmin = user?.role === "admin";
  const [searchParams, setSearchParams] = useSearchParams();
  const [collapsedPatterns, setCollapsedPatterns] = useState({});
  const [results, setResults] = useState([]);
  const [globalhitData, setGlobalhitData] = useState([]);
  const [betData, setBetData] = useState(null);
  const [gameId, setGameId] = useState(null);
  const [config, setConfig] = useState(null);
  const [cumPnL, setCumPnL] = useState({ gh: 0, user_a: 0, user_z: 0 });
  const [showNextConfirm, setShowNextConfirm] = useState(false);
  const [showNewConfirm, setShowNewConfirm] = useState(false);
  const [endingMode, setEndingMode] = useState(false);
  const [endingSnapshot, setEndingSnapshot] = useState(null);
  const [endingDone, setEndingDone] = useState(false);
  const [resumeGame, setResumeGame] = useState(null);
  const [userSummary, setUserSummary] = useState(null);
  const [userMartinDashboard, setUserMartinDashboard] = useState(null);
  const processingRef = useRef(false);
  const [processing, setProcessing] = useState(false);
  const goalAlertedRef = useRef({ a: false, z: false });
  const [goalDialog, setGoalDialog] = useState({ open: false, msgs: [] });

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

  const startGame = useCallback(async () => {
    try {
      const res = await apiCaller.post(GH_GAMES_API.START + "?mode=user");
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
      setResults([]); setCumPnL({ gh: 0, user_a: 0, user_z: 0 }); setBetData(null); setUserSummary(null); setUserMartinDashboard(null);
      setGlobalhitData([]);
      startGame();
    } else if (urlGameId) {
      restoreGame(parseInt(urlGameId));
    } else {
      // 직전 게임이 active면 복원 여부 확인
      apiCaller.get(GH_GAMES_API.LAST_ACTIVE + "?mode=user").then(async (res) => {
        if (cancelled) return;
        const game = res.data?.game;
        if (game && game.round_count > 0) {
          setResumeGame(game);
        } else {
          if (game) {
            try { await apiCaller.post(GH_GAMES_API.END, { game_id: game.game_id, actual: "P" }); } catch {}
          }
          if (!cancelled) startGame();
        }
      }).catch(() => { if (!cancelled) startGame(); });
    }
    return () => { cancelled = true; };
  }, [searchParams.get("new"), searchParams.get("gameId")]); // eslint-disable-line react-hooks/exhaustive-deps

  const restoreGame = async (gid) => {
    try {
      const res = await apiCaller.get(GH_GAMES_API.STATE(gid));
      const data = res.data;
      setGameId(data.game_id);
      setConfig(data.config);
      setCumPnL(data.cum_pnl || { gh: 0, user_a: 0, user_z: 0 });
      const seq = data.seq || "";
      const picks = data.round_picks || [];
      setResults(seq.split("").map((v, i) => {
        const pick = picks[i];
        const status = pick ? (pick === v ? "hit" : "miss") : "wait";
        return { value: v, status };
      }));
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
    const pick = betData?.combined?.direction;
    if (pick && pick !== "wait") {
      status = pick === inputValue ? "hit" : "miss";
    }
    setResults((prev) => [...prev, { value: inputValue, status }]);

    try {
      const res = await apiCaller.post(GH_GAMES_API.ROUND, { game_id: gameId, actual: inputValue });
      const data = res.data;
      if (data.round_num !== undefined && data.round_num !== results.length + 1) {
        alert("서버/클라이언트 불일치가 감지되어 페이지를 리로드합니다.");
        window.location.reload();
        return;
      }
      setCumPnL({ gh: data.cum_pnl.gh, user_a: data.cum_pnl.user_a || 0, user_z: data.cum_pnl.user_z || 0 });
      setGlobalhitData(data.globalhit || []);
      setBetData(data.bet ? { ...data.bet, user_martin: data.user_martin } : null);
      setUserSummary(data.user_summary || null);
      setUserMartinDashboard(data.user_martin_dashboard || null);
      checkGoalAlert(data.user_summary);

      if (endingMode && endingSnapshot && checkEndingComplete(data)) {
        setEndingDone(true);
        setBetData(null); setUserSummary(null);
      }
    } catch (err) {
      console.error("Failed to record round:", err);
      setResults((prev) => prev.slice(0, -1));
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
      const res = await apiCaller.delete(GH_GAMES_API.LAST_ROUND(gameId));
      const data = res.data;
      setResults(results.slice(0, -1));
      setCumPnL(data.cum_pnl || { gh: 0, user_a: 0, user_z: 0 });
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
      const res = await apiCaller.post(GH_GAMES_API.NEXT, null, { params: { game_id: gameId } });
      setResults([]); setBetData(null); setUserSummary(null);
      setGlobalhitData(res.data.globalhit || []);
      setGameId(res.data.game_id);
      setSearchParams({ gameId: res.data.game_id }, { replace: true });
      if (res.data.carry_pnl) {
        setCumPnL({ gh: res.data.carry_pnl.gh || 0, user_a: res.data.carry_pnl.user_a || 0, user_z: res.data.carry_pnl.user_z || 0 });
      } else {
        setCumPnL({ gh: 0, user_a: 0, user_z: 0 });
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
    const snapshot = { gh: [] };
    if (globalhitData) {
      globalhitData.forEach((pat) => {
        pat.groups.forEach((g) => {
          if (g.step > 1) snapshot.gh.push(`${pat.pattern}-${g.group + 1}`);
        });
      });
    }

    if (snapshot.gh.length === 0) {
      try {
        await apiCaller.post(GH_GAMES_API.ENDING, { game_id: gameId, snapshot });
      } catch {}
      setEndingMode(true); setEndingSnapshot(snapshot); setEndingDone(true);
      return;
    }

    try {
      const res = await apiCaller.post(GH_GAMES_API.ENDING, { game_id: gameId, snapshot });
      const data = res.data;
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
        await apiCaller.post(GH_GAMES_API.END, { game_id: gameId, actual: "P" });
      } catch {}
    }
    setEndingMode(false); setEndingSnapshot(null); setEndingDone(false);
    setResults([]); setCumPnL({ gh: 0, user_a: 0, user_z: 0 }); setBetData(null); setUserSummary(null); setUserMartinDashboard(null);
    setGlobalhitData([]);
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
          await apiCaller.post(GH_GAMES_API.END, { game_id: gameId, actual: "P" });
        } catch {}
      }
      setEndingMode(false); setEndingSnapshot(null); setEndingDone(false);
      setResults([]); setCumPnL({ gh: 0, user_a: 0, user_z: 0 }); setBetData(null); setUserSummary(null); setUserMartinDashboard(null);
      setGlobalhitData([]);
      await startGame();
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Box sx={{ p: isMobile ? 0.5 : 2 }}>
      <Box sx={{ mb: 1, display: "flex", alignItems: "baseline", gap: 1 }}>
        <span style={{ fontSize: 14, fontWeight: "bold", color: "#fff" }}>글로벌히트</span>
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
        {(() => {
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
        <Box sx={{ width: isMobile ? 24 : 40, height: isMobile ? 24 : 40, border: "2px solid rgba(255,255,255,0.3)", borderRadius: 1, backgroundColor: "#333", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Typography variant="body2" sx={{ fontWeight: "bold", fontSize: isMobile ? 10 : 16 }}>{currentTurn}</Typography>
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
          onClick={() => navigate(`/ghgame/user-setup${gameId ? `?gameId=${gameId}` : ""}`)}
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
            ].map((item) => (
              <Typography key={item.name} sx={{ color: item.pnl >= 0 ? "#4caf50" : "#f44336" }}>
                {item.name}: {item.pnl > 0 ? "+" : ""}{item.pnl.toLocaleString()}P
              </Typography>
            ))}
            {(() => { const t = cumPnL.user_a + cumPnL.user_z; return (
              <Typography sx={{ mt: 1, fontWeight: "bold", color: t >= 0 ? "#4caf50" : "#f44336" }}>
                Total: {t > 0 ? "+" : ""}{t.toLocaleString()}P
              </Typography>
            ); })()}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleFinishGame} variant="contained">새 게임 시작</Button>
        </DialogActions>
      </Dialog>

      {/* 새 게임 확인 대화상자 */}
      {/* 이전 게임 복원 확인 */}
      <Dialog open={!!resumeGame} onClose={async () => { const gid = resumeGame?.game_id; setResumeGame(null); if (gid) { try { await apiCaller.post(GH_GAMES_API.END, { game_id: gid, actual: "P" }); } catch {} } startGame(); }}>
        <DialogTitle sx={{ fontWeight: "bold" }}>이전 게임 복원</DialogTitle>
        <DialogContent>
          <Typography>진행 중인 게임이 있습니다. (#{resumeGame?.game_id}, {resumeGame?.round_count}회차)</Typography>
          <Typography>이어서 하시겠습니까?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={async () => { const gid = resumeGame.game_id; setResumeGame(null); try { await apiCaller.post(GH_GAMES_API.END, { game_id: gid, actual: "P" }); } catch {} startGame(); }}>새 게임</Button>
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
          const renderGroup = (label, fDir, fColor, martinPnl, mActive) => (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.3, flex: 1 }}>
              <Box sx={{ ...rowSx, border: "1px solid rgba(255,255,255,0.3)" }}>
                <Typography variant="caption" sx={{ fontSize: 9, color: "#888" }}>formal</Typography>
                <Typography variant="caption" sx={{ fontSize: 11, fontWeight: "bold", color: fColor }}>{fDir}</Typography>
              </Box>
              <Box sx={{ ...rowSx, border: `1px solid ${mActive ? "rgba(255,255,255,0.3)" : "#333"}` }}>
                <Typography variant="caption" sx={{ fontSize: 9, color: "#888" }}>{label}</Typography>
                <Typography variant="caption" sx={{ fontSize: 11, fontWeight: "bold", color: pnlColor(martinPnl) }}>{pnlText(martinPnl)}</Typography>
              </Box>
              <Box sx={{ ...rowSx, backgroundColor: "#00bcd4" }}>
                <Typography variant="caption" sx={{ fontSize: 9, color: "#000" }}>합계</Typography>
                <Typography variant="caption" sx={{ fontSize: 11, fontWeight: "bold", color: martinPnl < 0 ? "#f44336" : "#000" }}>{pnlText(martinPnl)}</Typography>
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

        const renderGroup = (label, fDir, fColor, martinPnl, mActive) => (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.3, flex: 1 }}>
            <Box sx={{ border: "1px solid rgba(255,255,255,0.3)", borderRadius: 2, px: 2, py: 0.3, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Typography variant="caption" sx={{ fontSize: 11, fontWeight: "bold", color: "#888" }}>formal</Typography>
              <Typography variant="caption" sx={{ fontSize: 11, fontWeight: "bold", color: fColor }}>{fDir}</Typography>
            </Box>
            <Box sx={{ border: `1px solid ${mActive ? "rgba(255,255,255,0.3)" : "#333"}`, borderRadius: 2, px: 2, py: 0.3, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Typography variant="caption" sx={{ fontSize: 11, fontWeight: "bold", color: "#fff" }}>{label}</Typography>
              <Typography variant="caption" sx={{ fontSize: 11, fontWeight: "bold", color: pnlColor(martinPnl) }}>{pnlText(martinPnl)}</Typography>
            </Box>
            <Box sx={{ backgroundColor: "#00bcd4", borderRadius: 2, px: 2, py: 0.3, display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
              <Typography variant="caption" sx={{ fontSize: 11, fontWeight: "bold", color: martinPnl < 0 ? "#f44336" : "#000" }}>{pnlText(martinPnl)}</Typography>
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
        const ghHasBet = (gh?.P || 0) + (gh?.B || 0) > 0;

        return (
          <>
            {/* 상단 요약 바 — 마틴A / 마틴Z 분리 */}
            {!isMobile && (() => {
              const umA = betData?.user_martin?.martin_a;
              const umZ = betData?.user_martin?.martin_z;
              const aDirRaw = umA?.direction || "wait";
              const zDirRaw = umZ?.direction || "wait";
              const fADir = aDirRaw;
              const fAColor = fADir === "P" ? "#1565c0" : fADir === "B" ? "#f44336" : "#888";
              const fZDir = zDirRaw;
              const fZColor = fZDir === "P" ? "#1565c0" : fZDir === "B" ? "#f44336" : "#888";
              const pnlText = (v) => `${v > 0 ? "+" : ""}${v.toLocaleString()}P`;
              const pnlClr = (v) => v > 0 ? "#4caf50" : v < 0 ? "#f44336" : "#fff";
              const umAHasBet = (umA?.amount || 0) > 0;
              const umZHasBet = (umZ?.amount || 0) > 0;
              const barSx = { border: "1px solid rgba(255,255,255,0.3)", borderRadius: 2, px: 2, py: 0.3, display: "flex", alignItems: "center", justifyContent: "space-between", flex: 1 };
              const renderBar = (label, fDir, fColor, martinPnl, martinActive) => (
                <Box sx={{ display: "flex", gap: 0.5, flex: 1 }}>
                  <Box sx={{ ...barSx, minWidth: 0, justifyContent: "center" }}>
                    <Typography variant="caption" sx={{ fontSize: 11, fontWeight: "bold", color: fColor }}>{`formal(${fDir})`}</Typography>
                  </Box>
                  <Box sx={{ ...barSx, border: `1px solid ${martinActive ? "rgba(255,255,255,0.3)" : "#333"}` }}>
                    <Typography variant="caption" sx={{ fontSize: 11, fontWeight: "bold", color: "#fff" }}>{label}</Typography>
                    <Typography variant="caption" sx={{ fontSize: 11, fontWeight: "bold", color: pnlClr(martinPnl) }}>{pnlText(martinPnl)}</Typography>
                  </Box>
                  <Box sx={{ backgroundColor: "#00bcd4", borderRadius: 2, px: 2, py: 0.3, display: "flex", alignItems: "center", justifyContent: "flex-end", minWidth: 80 }}>
                    <Typography variant="caption" sx={{ fontSize: 11, fontWeight: "bold", color: martinPnl < 0 ? "#f44336" : "#000" }}>{pnlText(martinPnl)}</Typography>
                  </Box>
                </Box>
              );
              return (
                <Box sx={{ display: "flex", gap: 1, mb: 0.5 }}>
                  {renderBar("마틴A", fADir, fAColor, cumPnL.user_a, umAHasBet)}
                  {renderBar("마틴Z", fZDir, fZColor, cumPnL.user_z, umZHasBet)}
                </Box>
              );
            })()}

            {/* 배팅 상황판 — 마틴A / 마틴Z 각각 독립 테이블 (유저 마틴 대시보드 데이터) */}
            {(() => {
              const umA = betData?.user_martin?.martin_a;
              const umZ = betData?.user_martin?.martin_z;
              const dashA = userMartinDashboard?.martin_a;
              const dashZ = userMartinDashboard?.martin_z;
              const martinTable = (label, um, labelColor, dash, isUnified) => {
                const mDir = um?.direction || "wait";
                const mAmt = um?.amount || 0;
                const mP = mDir === "P" ? mAmt : 0;
                const mB = mDir === "B" ? mAmt : 0;
                const fDir = mP > mB ? "P" : mB > mP ? "B" : "wait";
                const fColor = fDir === "P" ? "#1565c0" : fDir === "B" ? "#f44336" : "#888";
                const mHasBet = mAmt > 0;
                const mDimStyle = mHasBet ? {} : { filter: "grayscale(100%)", opacity: 0.7 };
                const amounts = dash?.amounts || [];
                const stepMin = dash?.step_min || 1;
                const stepMax = dash?.step_max || 20;
                const unifiedStep = isUnified ? (dash?.step || stepMin) : null;
                const patternSteps = !isUnified ? (dash?.steps || {}) : {};
                const getStepAmt = (pat, sec) => {
                  const key = `${pat}-${sec + 1}`;
                  const step = isUnified ? unifiedStep : (patternSteps[key] || stepMin);
                  const idx = step - 1;
                  const amt = (idx >= 0 && idx < amounts.length) ? amounts[idx] : 0;
                  const detail = betData?.globalhit?.details?.find((d) => d.pattern === pat && d.group === sec + 1);
                  const predict = detail?.direction || null;
                  return { step, amt, predict };
                };
                return (
                  <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, mb: 0.5 }}>
                  <Box>
                  <table style={{ borderCollapse: "collapse", width: "fit-content", marginBottom: 4 }}>
                    <tbody>
                      <tr>
                        <td style={{ ...dcB, color: fColor }}>{`formal(${fDir})`}</td>
                        <td style={{ ...dcB, color: labelColor, ...mDimStyle }}>{label}</td>
                        <td style={{ ...dc, color: "#1565c0", ...mDimStyle }}>{`${mP.toLocaleString()}P`}</td>
                        <td style={{ ...dc, color: "#f44336", ...mDimStyle }}>{`${mB.toLocaleString()}P`}</td>
                        <td style={{ ...dcB, color: "#fff" }}>{currentTurn}</td>
                        {Array.from({ length: 11 }, (_, i) => <td key={i} style={{ ...dc }}></td>)}
                      </tr>
                      {dash && [[ghPatterns[0], ghPatterns[1]], [ghPatterns[2], ghPatterns[3]], [ghPatterns[4], ghPatterns[5]], [ghPatterns[6], ghPatterns[7]]].map((pair, ri) => (
                        <tr key={`gh-${ri}`}>
                          {pair.map((pat) =>
                            [0, 1, 2].map((sec) => {
                              const { step, amt, predict } = getStepAmt(pat, sec);
                              const isActive = step > stepMin;
                              const isBetting = !!predict;
                              const dimStyle = isBetting ? {} : { filter: "grayscale(100%)", opacity: 0.5 };
                              const predictColor = predict === "P" ? "#1565c0" : predict === "B" ? "#f44336" : "#888";
                              return (
                                <React.Fragment key={`${pat}-${sec}`}>
                                  <td style={{ ...dc, ...dimStyle }}>
                                    {pat.split("").map((c, ci) => (
                                      <span key={ci} style={{ color: c === "P" ? "#1565c0" : "#f44336", fontWeight: "bold" }}>{c}</span>
                                    ))}
                                    <span style={{ fontSize: 9 }}>({sec + 1}sc)</span>
                                  </td>
                                  <td style={{ ...dc, ...dimStyle, ...(isActive && isBetting && { color: "#ffeb3b", fontWeight: "bold" }) }}>
                                    {predict && <span style={{ color: predictColor, fontWeight: "bold", marginRight: 2 }}>{predict}</span>}
                                    {`${amt.toLocaleString()}P`}
                                    {isActive && <span style={{ fontSize: 8, marginLeft: 2 }}>{step}S</span>}
                                  </td>
                                </React.Fragment>
                              );
                            })
                          )}
                          {Array.from({ length: 4 }, (_, i) => <td key={`pad-${i}`} style={{ ...dc }}></td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </Box>
                  </Box>
                );
              };
              return (
                <>
                  {martinTable("마틴A", umA, "#1565c0", dashA, false)}
                  {martinTable("마틴Z", umZ, "#c62828", dashZ, true)}
                </>
              );
            })()}


            {/* GlobalHit 패턴별 상세 — 마틴A / 마틴Z 독립 블록 */}
            {(() => {
              const cellSize = 20;
              const colsPerRow = 30;
              const totalCols = colsPerRow + 2;
              const GH_CELL_BG = { hit: "#00e676", miss: "#ffeb3b", wait: "#555" };
              const tdStyleFn = (status) => ({
                width: cellSize, height: cellSize, border: "1px solid #555", padding: 0, textAlign: "center",
                backgroundColor: status ? (GH_CELL_BG[status] || "#333") : "#333",
              });

              const dashA = userMartinDashboard?.martin_a;
              const dashZ = userMartinDashboard?.martin_z;

              const getStepAmt = (pat, gi, dash, isUnified) => {
                if (dash) {
                  const key = `${pat}-${gi + 1}`;
                  const stepMin = dash.step_min || 1;
                  const step = isUnified ? (dash.step || stepMin) : (dash.steps?.[key] || stepMin);
                  const idx = step - 1;
                  const amounts = dash.amounts || [];
                  const amt = (idx >= 0 && idx < amounts.length) ? amounts[idx] : 0;
                  return { step, amt, stepMin };
                }
                // 유저 설정 없으면 0단계 — 단계 진행 안 함
                return { step: 0, amt: 0, stepMin: 0 };
              };

              const renderPatternBlock = (label, labelColor, dash, isUnified) => (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                  <Box sx={{ backgroundColor: labelColor, borderRadius: 1, px: 1, py: 0.3, width: "fit-content" }}>
                    <Typography variant="caption" sx={{ fontSize: 11, fontWeight: "bold", color: "#fff" }}>{label}</Typography>
                  </Box>
                  {globalhitData.map((patData) => {
                    const pat = patData.pattern;
                    const circleStyle = (charIdx) => ({
                      width: cellSize - 2, height: cellSize - 2, borderRadius: "50%",
                      backgroundColor: pat[charIdx % pat.length] === "P" ? "#1565c0" : "#f44336",
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      color: "#fff", fontSize: 9, fontWeight: "bold",
                    });
                    const collapseKey = `${label}-${pat}`;
                    return (
                      <Box key={pat}>
                        <Box
                          onClick={() => setCollapsedPatterns((prev) => ({ ...prev, [collapseKey]: !prev[collapseKey] }))}
                          sx={{
                            display: "flex", alignItems: "center", gap: 0.5, mb: 0.3,
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
                          {patData.groups.map((g, gi) => {
                            const { step, amt, stepMin } = getStepAmt(pat, gi, dash, isUnified);
                            const isActive = step > (stepMin || 1);
                            return (
                              <Box key={gi} sx={{ display: "flex", gap: 0.3, ml: gi > 0 ? 1 : 0 }}>
                                <Box sx={{ border: "1px solid rgba(255,255,255,0.3)", px: 0.6, py: 0.2 }}>
                                  <Typography variant="caption" sx={{ fontSize: 10 }}>SC{gi + 1}</Typography>
                                </Box>
                                <Box sx={{ border: "1px solid rgba(255,255,255,0.3)", px: 0.6, py: 0.2 }}>
                                  <Typography variant="caption" sx={{ fontSize: 10, ...(isActive && { color: "#f44336", fontWeight: "bold" }) }}>{step}S</Typography>
                                </Box>
                                <Box sx={{ border: "1px solid rgba(255,255,255,0.3)", px: 0.8, py: 0.2 }}>
                                  <Typography variant="caption" sx={{ fontSize: 10, ...(isActive && { color: "#ffeb3b", fontWeight: "bold" }) }}>{amt.toLocaleString()}P</Typography>
                                </Box>
                              </Box>
                            );
                          })}
                          <Box sx={{ flexGrow: 1 }} />
                        </Box>
                        {collapsedPatterns[collapseKey] && (
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
              );

              return (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {renderPatternBlock("마틴A", "#1565c0", dashA, false)}
                  {renderPatternBlock("마틴Z", "#c62828", dashZ, true)}
                </Box>
              );
            })()}
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
            ].map((item) => (
              <Typography key={item.name} sx={{ color: item.pnl >= 0 ? "#4caf50" : "#f44336" }}>
                {item.name}: {item.pnl > 0 ? "+" : ""}{item.pnl.toLocaleString()}P
              </Typography>
            ))}
            {(() => { const t = cumPnL.user_a + cumPnL.user_z; return (
              <Typography sx={{ mt: 1, fontWeight: "bold", color: t >= 0 ? "#4caf50" : "#f44336" }}>
                Total: {t > 0 ? "+" : ""}{t.toLocaleString()}P
              </Typography>
            ); })()}
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
