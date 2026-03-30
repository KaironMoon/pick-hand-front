import React, { useState, useEffect, useCallback, useRef } from "react";
import { Box, Typography, useMediaQuery, useTheme, Dialog, DialogTitle, DialogContent, DialogActions, Button } from "@mui/material";
import { useNavigate, useSearchParams } from "react-router-dom";
import apiCaller from "@/services/api-caller";
import { HB_GAMES_API } from "@/constants/api-url";

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

export default function HbGamePage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [results, setResults] = useState([]);
  const [pickResult, setPickResult] = useState({ method: "wait", pick: null, nickname: null });
  const [hbPatterns, setHbPatterns] = useState({});
  const [globalhitData, setGlobalhitData] = useState([]);
  const [betData, setBetData] = useState(null);
  const [gameId, setGameId] = useState(null);
  const [config, setConfig] = useState(null);
  const [cumPnL, setCumPnL] = useState({ hb: 0, gh: 0 });
  const [nicknames, setNicknames] = useState([]);

  const [endingMode, setEndingMode] = useState(false);
  const [endingSnapshot, setEndingSnapshot] = useState(null);
  const [endingDone, setEndingDone] = useState(false);
  const [collapsedPatterns, setCollapsedPatterns] = useState({});
  const processingRef = useRef(false);
  const [processing, setProcessing] = useState(false);

  const currentTurn = results.length + 1;
  const grid = calculateCircleGrid(results);

  const displayPick = betData?.combined?.direction && betData.combined.direction !== "wait" ? betData.combined.direction : null;
  const pickImage = displayPick === "P" ? "/player.png" : displayPick === "B" ? "/banker.png" : "/wait.png";

  // 닉네임 로드
  useEffect(() => {
    apiCaller.get(HB_GAMES_API.NICKNAMES).then((res) => {
      setNicknames(res.data.nicknames || []);
    });
  }, []);

  // 게임 시작
  const startGame = useCallback(async () => {
    try {
      const res = await apiCaller.post(HB_GAMES_API.START + "?mode=admin");
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
      setEndingMode(false); setEndingSnapshot(null); setEndingDone(false);
      setResults([]); setCumPnL({ hb: 0, gh: 0 }); setBetData(null);
      setPickResult({ method: "wait", pick: null, nickname: null });
      setHbPatterns({}); setGlobalhitData([]);
      startGame();
    } else if (urlGameId) {
      restoreGame(parseInt(urlGameId));
    } else {
      apiCaller.get(HB_GAMES_API.LAST_ACTIVE + "?mode=admin").then(async (res) => {
        if (cancelled) return;
        const game = res.data?.game;
        if (game && game.round_count > 0) {
          setResumeGame(game);
        } else {
          if (game) {
            try { await apiCaller.post(HB_GAMES_API.END, { game_id: game.game_id, actual: "P" }); } catch {}
          }
          if (!cancelled) startGame();
        }
      }).catch(() => { if (!cancelled) startGame(); });
    }
    return () => { cancelled = true; };
  }, [searchParams.get("new"), searchParams.get("gameId")]); // eslint-disable-line react-hooks/exhaustive-deps

  const restoreGame = async (gid) => {
    try {
      const res = await apiCaller.get(HB_GAMES_API.STATE(gid));
      const data = res.data;
      setGameId(data.game_id);
      setConfig(data.config);
      setCumPnL(data.cum_pnl || { hb: 0, gh: 0 });
      // results 복원 (pick vs actual 비교로 hit/miss 판정)
      const seq = data.seq || "";
      const picks = data.round_picks || [];
      const restoredResults = seq.split("").map((v, i) => {
        const pick = picks[i];
        const st = pick ? (v === pick ? "hit" : "miss") : "wait";
        return { value: v, status: st };
      });
      setResults(restoredResults);
      setPickResult({ method: data.method, pick: data.pick, nickname: data.nickname });
      setHbPatterns(data.hb_patterns || {});
      setGlobalhitData(data.globalhit || []);
      setBetData(data.bet || null);
      if (data.status === "ending" && data.ending_snapshot) {
        setEndingMode(true);
        setEndingSnapshot(data.ending_snapshot);
      }
    } catch (err) {
      console.error("Failed to restore, starting new:", err);
      startGame();
    }
  };

  // P/B 입력
  const handleInput = async (inputValue) => {
    if (!gameId || processingRef.current) return;
    processingRef.current = true;
    setProcessing(true);

    let status = "wait";
    if (pickResult.pick) {
      status = pickResult.pick === inputValue ? "hit" : "miss";
    }
    setResults((prev) => [...prev, { value: inputValue, status }]);

    try {
      const res = await apiCaller.post(HB_GAMES_API.ROUND, { game_id: gameId, actual: inputValue });
      const data = res.data;
      if (data.round_num !== undefined && data.round_num !== results.length + 1) {
        alert("서버/클라이언트 불일치가 감지되어 페이지를 리로드합니다.");
        window.location.reload();
        return;
      }
      setCumPnL({ hb: data.cum_pnl.hb, gh: data.cum_pnl.gh });
      setPickResult({ method: data.method, pick: data.pick, nickname: data.nickname });
      setHbPatterns(data.hb_patterns || {});
      setGlobalhitData(data.globalhit || []);
      setBetData(data.bet || null);

      if (endingMode && endingSnapshot && checkEndingComplete(data)) {
        setEndingDone(true);
        setBetData(null);
      }
    } catch (err) {
      console.error("Failed to record round:", err);
    } finally {
      processingRef.current = false;
      setProcessing(false);
    }
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

  // ED
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
      setBetData(data.bet || null);
    } catch (err) {
      console.error("Failed to start ending:", err);
    }
    setEndingMode(true); setEndingSnapshot(snapshot);
  };

  const handleFinishGame = async () => {
    if (gameId) {
      try {
        await apiCaller.post(HB_GAMES_API.END, { game_id: gameId, actual: "P" });
      } catch {}
    }
    setEndingMode(false); setEndingSnapshot(null); setEndingDone(false);
    setResults([]); setCumPnL({ hb: 0, gh: 0 }); setBetData(null);
    setPickResult({ method: "wait", pick: null, nickname: null });
    setHbPatterns({}); setGlobalhitData([]);
    setSearchParams({}, { replace: true });
    startGame();
  };

  // 마지막 1개 삭제
  const handleDeleteOne = useCallback(async () => {
    if (results.length === 0 || !gameId || processingRef.current) return;
    processingRef.current = true;
    setProcessing(true);
    try {
      const res = await apiCaller.delete(HB_GAMES_API.LAST_ROUND(gameId));
      const data = res.data;
      setResults(results.slice(0, -1));
      setCumPnL(data.cum_pnl || { hb: 0, gh: 0 });
      setPickResult({ method: data.method, pick: data.pick, nickname: data.nickname });
      setHbPatterns(data.hb_patterns || {});
      setGlobalhitData(data.globalhit || []);
      setBetData(data.bet || null);
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

  // next game
  const handleNextGame = async () => {
    if (!gameId || results.length === 0 || processing) return;
    setProcessing(true);
    try {
      const res = await apiCaller.post(HB_GAMES_API.NEXT, null, { params: { game_id: gameId } });
      setEndingDone(false);
      setResults([]); setBetData(null);
      setPickResult({ method: "wait", pick: null, nickname: null });
      setHbPatterns({});
      setGlobalhitData(res.data.globalhit || []);
      setGameId(res.data.game_id);
      setSearchParams({ gameId: res.data.game_id }, { replace: true });
      if (res.data.carry_pnl) {
        setCumPnL(res.data.carry_pnl);
      } else {
        setCumPnL({ hb: 0, gh: 0 });
      }
      if (res.data.status === "ending" && res.data.ending_snapshot) {
        setEndingMode(true); setEndingSnapshot(res.data.ending_snapshot);
      } else {
        setEndingMode(false); setEndingSnapshot(null);
      }
    } catch (err) {
      const msg = err.response?.data?.detail || "다음 게임 전환에 실패했습니다";
      alert(msg);
    } finally {
      setProcessing(false);
    }
  };

  const [showNextConfirm, setShowNextConfirm] = useState(false);
  const [showNewConfirm, setShowNewConfirm] = useState(false);
  const [resumeGame, setResumeGame] = useState(null);
  const handleNewGame = () => setShowNewConfirm(true);
  const handleNewGameConfirm = async () => {
    setShowNewConfirm(false);
    setProcessing(true);
    try {
      if (gameId && results.length > 0) {
        try { await apiCaller.post(HB_GAMES_API.END, { game_id: gameId, actual: "P" }); } catch {}
      }
      setEndingMode(false); setEndingSnapshot(null); setEndingDone(false);
      setResults([]); setCumPnL({ hb: 0, gh: 0 }); setBetData(null);
      setPickResult({ method: "wait", pick: null, nickname: null });
      setHbPatterns({}); setGlobalhitData([]);
      await startGame();
    } finally {
      setProcessing(false);
    }
  };

  // 패턴×스텝 표시할 패턴 목록
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

      {/* ===== 중단: 인터페이스 ===== */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 1, flexWrap: "wrap" }}>
        {/* 허니비 닉네임 */}
        {(() => {
          const nn = pickResult.nickname;
          const hbHasBet = (betData?.honeybee?.P || 0) + (betData?.honeybee?.B || 0) > 0;
          return (
            <Box sx={{ ...toggleBtnSx, border: `2px solid ${hbHasBet ? "#ff9800" : "#555"}`, opacity: hbHasBet ? 1 : 0.35, minWidth: isMobile ? 50 : 70 }}>
              <Typography variant="caption" sx={{ fontSize: isMobile ? 9 : 11, fontWeight: "bold", color: hbHasBet ? "#ff9800" : "#555" }}>
                {nn || "wait"}
              </Typography>
            </Box>
          );
        })()}
        {/* GH */}
        {(() => {
          const ghHasBet = (betData?.globalhit?.P || 0) + (betData?.globalhit?.B || 0) > 0;
          return (
            <Box sx={{ ...toggleBtnSx, border: `2px solid ${ghHasBet ? "#4caf50" : "#555"}`, opacity: ghHasBet ? 1 : 0.35 }}>
              <Typography variant="caption" sx={{ fontSize: isMobile ? 9 : 11, fontWeight: "bold", color: ghHasBet ? "#fff" : "#555" }}>global</Typography>
            </Box>
          );
        })()}
        {/* ED */}
        <Box
          onClick={handleEndingMode}
          sx={{
            ...toggleBtnSx,
            backgroundColor: endingMode ? "#ff6f00" : "#b71c1c",
            borderRadius: 2, border: endingMode ? "2px solid #ffab00" : "none",
            px: isMobile ? 1 : 1.5, cursor: "pointer",
            animation: endingMode ? "pulse 1.5s infinite" : "none",
            "@keyframes pulse": { "0%": { opacity: 1 }, "50%": { opacity: 0.6 }, "100%": { opacity: 1 } },
          }}
        >
          <Typography variant="caption" sx={{ fontSize: isMobile ? 11 : 13, fontWeight: "bold", color: "#fff" }}>
            {endingMode ? "ED..." : "ED"}
          </Typography>
        </Box>
        {/* BT */}
        <Box sx={{ ...toggleBtnSx, backgroundColor: "#1565c0", borderRadius: 2, border: "none", px: isMobile ? 1 : 1.5 }}>
          <Typography variant="caption" sx={{ fontSize: isMobile ? 11 : 13, fontWeight: "bold", color: "#fff" }}>BT</Typography>
        </Box>
        {/* 합산 금액 */}
        <Box sx={{ ...toggleBtnSx, border: "2px solid #4caf50", cursor: "default", px: isMobile ? 0.5 : 1.5, minWidth: isMobile ? 50 : 120, justifyContent: "flex-end" }}>
          <Typography variant="caption" sx={{ fontSize: isMobile ? 10 : 12, fontWeight: "bold", color: "#4caf50" }}>
            {betData?.combined ? `${betData.combined.amount.toLocaleString()}P` : "0P"}
          </Typography>
        </Box>

        <Box sx={{ width: "1px", height: 28, backgroundColor: "rgba(255,255,255,0.2)", mx: 0.3 }} />

        {/* 픽이미지 + 턴 + P/B */}
        <Box sx={{ width: isMobile ? 52 : 95, height: isMobile ? 52 : 95, border: "2px solid rgba(255,255,255,0.3)", borderRadius: 2, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <img src={pickImage} alt="pick" style={{ width: isMobile ? 46 : 85, height: isMobile ? 46 : 85, objectFit: "contain" }} />
        </Box>
        <Box sx={{ width: isMobile ? 24 : 40, height: isMobile ? 24 : 40, border: "2px solid rgba(255,255,255,0.3)", borderRadius: 1, backgroundColor: "#333", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Typography variant="body2" sx={{ fontWeight: "bold", fontSize: isMobile ? 10 : 16 }}>{currentTurn}</Typography>
        </Box>
        <Box
          onClick={() => handleInput("P")}
          sx={{
            width: isMobile ? 38 : 55, height: isMobile ? 38 : 55, borderRadius: 2,
            backgroundColor: "#1565c0", display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontSize: isMobile ? 16 : 24, fontWeight: "bold",
            cursor: processing ? "not-allowed" : "pointer",
            opacity: processing ? 0.4 : 1, pointerEvents: processing ? "none" : "auto",
            "&:hover": { opacity: processing ? 0.4 : 0.85 }, "&:active": { transform: "scale(0.95)" },
          }}
        >P</Box>
        <Box
          onClick={() => handleInput("B")}
          sx={{
            width: isMobile ? 38 : 55, height: isMobile ? 38 : 55, borderRadius: 2,
            backgroundColor: "#f44336", display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontSize: isMobile ? 16 : 24, fontWeight: "bold",
            cursor: processing ? "not-allowed" : "pointer",
            opacity: processing ? 0.4 : 1, pointerEvents: processing ? "none" : "auto",
            "&:hover": { opacity: processing ? 0.4 : 0.85 }, "&:active": { transform: "scale(0.95)" },
          }}
        >B</Box>
        <Box sx={{ width: isMobile ? 32 : 0 }} />
        <Box
          onClick={results.length > 0 && !processing ? handleDeleteOne : undefined}
          sx={{ ...controlBtnSx, cursor: processing ? "not-allowed" : results.length > 0 ? "pointer" : "default", opacity: processing ? 0.4 : results.length > 0 ? 1 : 0.4, pointerEvents: processing ? "none" : "auto" }}
        >
          <Typography variant="caption" sx={{ fontSize: isMobile ? 10 : 13 }}>del</Typography>
        </Box>
        <Box onClick={() => navigate(gameId ? `/hbgame/setup?gameId=${gameId}` : `/hbgame/setup`)} sx={{ ...controlBtnSx, cursor: "pointer", border: "2px solid rgba(255,255,255,0.3)" }}>
          <Typography variant="caption" sx={{ fontSize: isMobile ? 10 : 12 }}>set-up</Typography>
        </Box>
        <Box onClick={() => gameId ? navigate(`/hbgame/setup?gameId=${gameId}`) : undefined} sx={{ ...controlBtnSx, cursor: gameId ? "pointer" : "default", opacity: gameId ? 1 : 0.4, border: "2px solid rgba(255,255,255,0.3)" }}>
          <Typography variant="caption" sx={{ fontSize: isMobile ? 8 : 10, lineHeight: 1.2, textAlign: "center" }}>현게임{"\n"}설정</Typography>
        </Box>
        <Box
          onClick={results.length > 0 && !processing ? () => setShowNextConfirm(true) : undefined}
          sx={{ ...controlBtnSx, cursor: processing ? "not-allowed" : results.length > 0 ? "pointer" : "default", opacity: processing ? 0.4 : results.length > 0 ? 1 : 0.4, pointerEvents: processing ? "none" : "auto", border: "2px solid rgba(255,255,255,0.3)" }}
        >
          <Typography variant="caption" sx={{ fontSize: isMobile ? 10 : 12 }}>next</Typography>
        </Box>
        <Box onClick={!processing ? handleNewGame : undefined} sx={{ ...controlBtnSx, cursor: processing ? "not-allowed" : "pointer", opacity: processing ? 0.4 : 1, pointerEvents: processing ? "none" : "auto", border: "2px solid #2196f3" }}>
          <Typography variant="caption" sx={{ fontSize: isMobile ? 10 : 12, color: "#2196f3" }}>new</Typography>
        </Box>
      </Box>

      {/* ===== 대시보드 (허니비 + GH 배팅 테이블) ===== */}
      {(() => {
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

        return (
          <>
          {/* 상단 요약 바 */}
          {!isMobile && (
          <Box sx={{ display: "flex", alignItems: "stretch", gap: 0.5, mb: 0.5, flexWrap: "wrap" }}>
            <Box sx={{ border: "1px solid rgba(255,255,255,0.3)", borderRadius: 2, px: 1.5, display: "flex", alignItems: "center" }}>
              <Typography variant="caption" sx={{ fontSize: 11, fontWeight: "bold", color: dirColor }}>{`formal(${combinedDir})`}</Typography>
            </Box>
            {[
              { name: "Honeybee", pnl: cumPnL.hb, active: hbHasBet },
              { name: "globalhit", pnl: cumPnL.gh, active: ghHasBet },
            ].map((item, i) => {
              const clr = item.pnl > 0 ? "#4caf50" : item.pnl < 0 ? "#f44336" : "#fff";
              const sign = item.pnl > 0 ? "+" : "";
              return (
                <Box key={i} sx={{ border: `1px solid ${item.active ? "rgba(255,255,255,0.3)" : "#333"}`, borderRadius: 2, px: 2, minWidth: 200, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <Typography variant="caption" sx={{ fontSize: 11, fontWeight: "bold", color: "#fff" }}>{item.name}</Typography>
                  <Typography variant="caption" sx={{ fontSize: 11, fontWeight: "bold", color: clr }}>{`${sign}${item.pnl.toLocaleString()}P`}</Typography>
                </Box>
              );
            })}
            {(() => {
              const totalPnL = cumPnL.hb + cumPnL.gh;
              const sign = totalPnL > 0 ? "+" : "";
              return (
                <Box sx={{ px: 2, minWidth: 200, backgroundColor: "#00bcd4", borderRadius: 2, display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
                  <Typography variant="caption" sx={{ fontSize: 11, fontWeight: "bold", color: totalPnL < 0 ? "#f44336" : "#000" }}>{`${sign}${totalPnL.toLocaleString()}P`}</Typography>
                </Box>
              );
            })()}
          </Box>
          )}

          {/* 배팅 상황판 — 단일 16열 테이블 */}
          <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, mb: 0.5 }}>
          <Box>
          <table style={{ borderCollapse: "collapse", width: "fit-content", marginBottom: 12, opacity: anyBet ? 1 : 0.8 }}>
            <tbody>
              {/* 1행: HB + GH 요약 + 빈칸 (16열 맞춤) */}
              {(() => {
                const hbDimStyle = hbHasBet ? {} : { filter: "grayscale(100%)", opacity: 0.7 };
                const ghDimStyle = ghHasBet ? {} : { filter: "grayscale(100%)", opacity: 0.7 };
                return (
                  <tr>
                    <td style={{ ...dcB, color: "#00bcd4", ...hbDimStyle }}>honeybee</td>
                    <td style={{ ...dc, color: "#1565c0", ...hbDimStyle }}>{`${(hb?.P || 0).toLocaleString()}P`}</td>
                    <td style={{ ...dc, color: "#f44336", ...hbDimStyle }}>{`${(hb?.B || 0).toLocaleString()}P`}</td>
                    <td style={{ ...dcB, color: "#00bcd4", ...ghDimStyle }}>globalhit</td>
                    <td style={{ ...dc, color: "#1565c0", ...ghDimStyle }}>{`${(gh?.P || 0).toLocaleString()}P`}</td>
                    <td style={{ ...dc, color: "#f44336", ...ghDimStyle }}>{`${(gh?.B || 0).toLocaleString()}P`}</td>
                    <td style={{ ...dcB, color: "#fff" }}>{currentTurn}</td>
                    <td style={{ ...dc, color: "#1565c0" }}>{`${((hb?.P || 0) + (gh?.P || 0)).toLocaleString()}P`}</td>
                    <td style={{ ...dc, color: "#f44336" }}>{`${((hb?.B || 0) + (gh?.B || 0)).toLocaleString()}P`}</td>
                    {Array.from({ length: 7 }, (_, i) => (
                      <td key={i} style={{ ...dc }}></td>
                    ))}
                  </tr>
                );
              })()}

              {/* 2~5행: GH 패턴별 + 빈칸 (16열 맞춤) */}
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
                  {/* GH 행은 12열 → 나머지 4열 빈칸 */}
                  {Array.from({ length: 4 }, (_, i) => (
                    <td key={`pad-${i}`} style={{ ...dc }}></td>
                  ))}
                </tr>
              ))}

              {/* 허니비 스텝 헤더 */}
              {(() => {
                const hbAmounts = config?.honeybee?.amounts || new Array(20).fill(0);
                const hbStepMin = config?.honeybee?.step_min || 1;
                const hbStepMax = config?.honeybee?.step_max || 20;
                // 배팅묶기: 현재 픽 패턴과 같은 그룹이면 같이 활성화
                const hbGroups = config?.honeybee?.groups || [];
                const currentNn = pickResult.nickname;
                const groupedSet = new Set();
                if (currentNn) {
                  groupedSet.add(currentNn);
                  for (const g of hbGroups) {
                    const members = (g.patterns || []).filter(Boolean);
                    if (members.includes(currentNn)) {
                      members.forEach((m) => groupedSet.add(m));
                    }
                  }
                }
                return (
                  <>
                    <tr>
                      <td style={{ ...dcB, color: "#ff9800" }}>honeybee</td>
                      <td style={{ ...dcB, color: "#ff9800" }}>pick</td>
                      {Array.from({ length: 14 }, (_, i) => (
                        <td key={i} style={{ ...dc, color: "#ff9800" }}>{i + 1}step</td>
                      ))}
                    </tr>

                    {/* 허니비 패턴×스텝 데이터 */}
                    {sortedPatterns.map((nn) => {
                      const st = hbPatterns[nn] || { step: 1, wins: 0, losses: 0, amount: 0, direction: null };
                      const isCurrentPick = groupedSet.has(nn);
                      const hasBet = st.amount > 0;
                      const isExactPick = pickResult.nickname === nn;
                      return (
                        <tr key={nn}>
                          <td style={{
                            ...dc,
                            color: isCurrentPick ? "#fff" : "#555",
                            fontWeight: isCurrentPick ? "bold" : "normal",
                          }}>{nn}</td>
                          <td style={{
                            ...dc,
                            color: isExactPick
                              ? (st.direction === "P" ? "#1565c0" : st.direction === "B" ? "#f44336" : "#555")
                              : "#555",
                            fontWeight: isExactPick ? "bold" : "normal",
                          }}>
                            {isExactPick ? (st.direction || "-") : "-"}
                          </td>
                          {Array.from({ length: 14 }, (_, i) => {
                            const stepNum = i + 1;
                            const isCurrent = st.step === stepNum;
                            const inRange = stepNum >= hbStepMin && stepNum <= hbStepMax;
                            const amt = inRange ? (hbAmounts[stepNum - 1] || 0) : 0;
                            return (
                              <td key={i} style={{
                                ...dc,
                                color: isCurrent && isCurrentPick ? "#fff" : stepNum < st.step ? "#c8a415" : "#555",
                                fontWeight: (isCurrent && isCurrentPick) || stepNum < st.step ? "bold" : "normal",
                                backgroundColor: isCurrent && isCurrentPick ? "rgba(255,255,255,0.08)" : "transparent",
                              }}>
                                {inRange ? amt.toLocaleString() : ""}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </>
                );
              })()}
            </tbody>
          </table>
          </Box>

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
                if (item.isFormal) {
                  return (
                    <Box key={i} sx={{ ...rowSx, border: "1px solid rgba(255,255,255,0.3)" }}>
                      <Typography variant="caption" sx={{ fontSize: 9, color: "#888" }}>{item.name}</Typography>
                      <Typography variant="caption" sx={{ fontSize: 11, fontWeight: "bold", color: item.color }}>{item.value}</Typography>
                    </Box>
                  );
                }
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
          </Box>
          </>
        );
      })()}

      {/* ===== 하단: GlobalHit 패턴별 상세 (t9game 스타일) ===== */}
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
              {/* 헤더 바 */}
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
                          const detail = betData?.globalhit?.details?.find(
                            (d) => d.pattern === pat && d.group === gi + 1
                          );
                          return detail ? `${detail.amount.toLocaleString()}P` : "0P";
                        })()}
                      </Typography>
                    </Box>
                  </Box>
                ))}
                <Box sx={{ flexGrow: 1 }} />
              </Box>

              {/* 3조 격자 - table */}
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
                          return (
                            <td key={colIdx} style={style}>
                              {hasData && <div style={circleStyle(roundNum - 1)}>{roundNum}</div>}
                            </td>
                          );
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
                          return (
                            <td key={colIdx} style={style}>
                              {hasData && <div style={circleStyle(roundNum - 1)}>{roundNum}</div>}
                            </td>
                          );
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

      {/* 종료 다이얼로그 */}
      <Dialog open={endingDone} onClose={() => {}}>
        <DialogTitle sx={{ fontWeight: "bold" }}>게임 종료</DialogTitle>
        <DialogContent>
          <Typography>모든 배팅이 완료되었습니다.</Typography>
          <Box sx={{ mt: 2 }}>
            {[
              { name: "Honeybee", pnl: cumPnL.hb },
              { name: "Globalhit", pnl: cumPnL.gh },
            ].map((item) => (
              <Typography key={item.name} sx={{ color: item.pnl >= 0 ? "#4caf50" : "#f44336" }}>
                {item.name}: {item.pnl > 0 ? "+" : ""}{item.pnl.toLocaleString()}P
              </Typography>
            ))}
            <Typography sx={{ mt: 1, fontWeight: "bold", color: (cumPnL.hb + cumPnL.gh) >= 0 ? "#4caf50" : "#f44336" }}>
              Total: {(cumPnL.hb + cumPnL.gh) > 0 ? "+" : ""}{(cumPnL.hb + cumPnL.gh).toLocaleString()}P
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleFinishGame} variant="contained">새 게임 시작</Button>
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

      {/* 이전 게임 복원 확인 */}
      <Dialog open={!!resumeGame} onClose={async () => { const gid = resumeGame?.game_id; setResumeGame(null); if (gid) { try { await apiCaller.post(HB_GAMES_API.END, { game_id: gid, actual: "P" }); } catch {} } startGame(); }}>
        <DialogTitle sx={{ fontWeight: "bold" }}>이전 게임 복원</DialogTitle>
        <DialogContent>
          <Typography>진행 중인 게임이 있습니다. (#{resumeGame?.game_id}, {resumeGame?.round_count}회차)</Typography>
          <Typography>이어서 하시겠습니까?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={async () => { const gid = resumeGame.game_id; setResumeGame(null); try { await apiCaller.post(HB_GAMES_API.END, { game_id: gid, actual: "P" }); } catch {} startGame(); }}>새 게임</Button>
          <Button onClick={() => { const gid = resumeGame.game_id; setResumeGame(null); restoreGame(gid); }} variant="contained">이어하기</Button>
        </DialogActions>
      </Dialog>

      {/* 새 게임 확인 */}
      <Dialog open={showNewConfirm} onClose={() => setShowNewConfirm(false)}>
        <DialogTitle>새 게임</DialogTitle>
        <DialogContent>
          <Typography variant="body2">현재 게임을 종료하고 새 게임을 시작하시겠습니까?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowNewConfirm(false)}>취소</Button>
          <Button onClick={handleNewGameConfirm} color="primary" variant="contained">확인</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
