import React, { useState, useEffect, useCallback, useRef } from "react";
import { Box, Typography, useMediaQuery, useTheme, Dialog, DialogTitle, DialogContent, DialogActions, Button } from "@mui/material";
import { useNavigate, useSearchParams } from "react-router-dom";
import apiCaller from "@/services/api-caller";
import { MH_GAMES_API } from "@/constants/api-url";

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
  border: "1px solid rgba(255,255,255,0.3)",
  borderRadius: 1,
  px: 1,
  py: 0.3,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: 40,
  "&:hover": { opacity: 0.8 },
};

const controlBtnSx = {
  border: "1px solid rgba(255,255,255,0.3)",
  borderRadius: 1,
  px: 1.5,
  py: 0.5,
  backgroundColor: "background.paper",
  "&:hover": { backgroundColor: "rgba(255,255,255,0.1)" },
};

export default function MhGamePage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [results, setResults] = useState([]);
  const [pickResult, setPickResult] = useState({ method: "wait", pick: null });
  const [selectedGridCell, setSelectedGridCell] = useState(null);
  const [globalhitData, setGlobalhitData] = useState([]);
  const [betData, setBetData] = useState(null);
  const [gameId, setGameId] = useState(null);
  const [refGameSeq, setRefGameSeq] = useState(null);
  const [refShoes, setRefShoes] = useState("");
  const [mhGrids, setMhGrids] = useState(null);
  const [cumPnL, setCumPnL] = useState({ mh: 0, gh: 0, pinch: 0 });
  const [carryPnL, setCarryPnL] = useState({ mh: 0, gh: 0, pinch: 0 });

  // 라운드별 예측 히스토리 [{pick, method, order, step}]
  const [pickHistory, setPickHistory] = useState([]);

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

  // 게임 시작
  const startGame = useCallback(async (refSeq) => {
    try {
      const params = new URLSearchParams({ mode: "admin" });
      if (refSeq) params.set("ref_game_seq", refSeq);
      const res = await apiCaller.post(MH_GAMES_API.START + "?" + params.toString());
      const data = res.data;
      setGameId(data.game_id);
      setSearchParams({ gameId: data.game_id }, { replace: true });
      const { globalhit, bet, game_id: _gid, config: _cfg, carry_over: _co, prev_game_id: _pid, status: _st, ending_snapshot: _es, carry_pnl: _cp, ref_game_seq, ref_shoes: rs, created_at: _ca, ...pick } = data;
      setPickResult({ method: pick.method, pick: pick.pick, prev_picks: pick.prev_picks, nickname: pick.nickname, code1: pick.code1, code2: pick.code2 });
      setRefGameSeq(ref_game_seq);
      setRefShoes(rs || "");
      setMhGrids(data.mh_grids || null);
      setGlobalhitData(globalhit || []);
      setBetData(bet || null);
      if (data.carry_pnl) setCarryPnL(data.carry_pnl);
    } catch (err) {
      console.error("Failed to start game:", err);
    }
  }, []);

  // 게임 복원
  const restoreGame = async (gid) => {
    try {
      const res = await apiCaller.get(MH_GAMES_API.STATE(gid));
      const data = res.data;
      setGameId(data.game_id);
      setResults(data.results || []);
      setCumPnL(data.cum_pnl || { mh: 0, gh: 0, pinch: 0 });
      const { globalhit, bet, results: _, cum_pnl: __, game_id: ___, config: ____, status, ending_snapshot: snap, ref_game_seq: rgs, ref_shoes: rs, ...pick } = data;
      setPickResult({ method: pick.method, pick: pick.pick, match_start: pick.match_start, match_end: pick.match_end, matches: pick.matches, order: pick.order, prev_picks: pick.prev_picks, nickname: pick.nickname, code1: pick.code1, code2: pick.code2 });
      setRefGameSeq(rgs);
      setRefShoes(rs || "");
      setMhGrids(data.mh_grids || null);
      setGlobalhitData(globalhit || []);
      setBetData(bet || null);
      if (status === "ending" && snap) {
        setEndingMode(true);
        setEndingSnapshot({
          nc: snap.nc || false,
          gh: new Set(snap.gh || []),
          pinch: new Set(snap.pinch || []),
        });
      }
    } catch (err) {
      console.error("Failed to restore game:", err);
    }
  };

  // 복원 확인 다이얼로그
  const [showNextConfirm, setShowNextConfirm] = useState(false);
  const [showNewConfirm, setShowNewConfirm] = useState(false);
  const [resumeGame, setResumeGame] = useState(null);

  // 페이지 로드
  useEffect(() => {
    const urlGameId = searchParams.get("gameId");
    const isNew = searchParams.get("new");
    if (isNew) {
      const doNew = async () => {
        if (gameId && results.length > 0) {
          try { await apiCaller.post(MH_GAMES_API.END, null, { params: { game_id: gameId } }); } catch {}
        }
        setEndingMode(false); setEndingSnapshot(null); setEndingDone(false);
        setResults([]); setPickHistory([]); setCumPnL({ mh: 0, gh: 0, pinch: 0 }); setCarryPnL({ mh: 0, gh: 0, pinch: 0 });
        setBetData(null); setPickResult({ method: "wait", pick: null }); setGlobalhitData([]);
        await startGame();
      };
      doNew();
      return;
    } else if (urlGameId) {
      restoreGame(parseInt(urlGameId));
    } else {
      let cancelled = false;
      apiCaller.get(MH_GAMES_API.LAST_ACTIVE + "?mode=admin").then(async (res) => {
        if (cancelled) return;
        const game = res.data?.game;
        if (game && game.round_count > 0) {
          setResumeGame(game);
        } else {
          if (game) { try { await apiCaller.post(MH_GAMES_API.END, null, { params: { game_id: game.game_id } }); } catch {} }
          if (!cancelled) startGame();
        }
      }).catch(() => { if (!cancelled) startGame(); });
      return () => { cancelled = true; };
    }
  }, [searchParams.get("new"), searchParams.get("gameId")]); // eslint-disable-line react-hooks/exhaustive-deps

  // P/B 입력
  const handleInput = async (inputValue) => {
    if (!gameId || processingRef.current) return;
    processingRef.current = true;
    setProcessing(true);

    let status = "wait";
    if (pickResult.pick) {
      status = pickResult.pick === inputValue ? "hit" : "miss";
    }
    const newResults = [...results, { value: inputValue, status }];
    setResults(newResults);

    // 현재 라운드의 예측 기록 (입력 전의 pickResult)
    setPickHistory((prev) => [...prev, {
      pick: pickResult.pick,
      method: pickResult.method,
      order: pickResult.order,
      step: betData?.megahit?.step || 0,
    }]);

    try {
      const res = await apiCaller.post(MH_GAMES_API.ROUND, { game_id: gameId, actual: inputValue });
      const data = res.data;
      if (data.round_num !== undefined && data.round_num !== results.length + 1) {
        alert("서버/클라이언트 불일치가 감지되어 페이지를 리로드합니다.");
        window.location.reload();
        return;
      }
      setCumPnL({ mh: data.cum_pnl.mh, gh: data.cum_pnl.gh, pinch: data.cum_pnl.pinch });
      const { globalhit, bet, mh_grids: grids, ...pick } = data;
      setPickResult({ method: pick.method, pick: pick.pick, match_start: pick.match_start, match_end: pick.match_end, matches: pick.matches, order: pick.order, prev_picks: pick.prev_picks, nickname: pick.nickname, code1: pick.code1, code2: pick.code2 });
      if (grids) setMhGrids(grids);
      setGlobalhitData(globalhit || []);
      setBetData(bet || null);

      if (endingMode && endingSnapshot) {
        if (checkEndingComplete(data)) {
          setEndingDone(true);
          setBetData(null);
        }
      }
    } catch (err) {
      console.error("Failed to record round:", err);
    } finally {
      processingRef.current = false;
      setProcessing(false);
    }
  };

  // 마지막 1개 삭제
  const handleDeleteOne = useCallback(async () => {
    if (results.length === 0 || !gameId || processingRef.current) return;
    processingRef.current = true;
    setProcessing(true);
    try {
      const res = await apiCaller.delete(MH_GAMES_API.LAST_ROUND(gameId));
      const data = res.data;
      setResults(results.slice(0, -1));
      setPickHistory((prev) => prev.slice(0, -1));
      setCumPnL({ mh: data.cum_pnl.mh, gh: data.cum_pnl.gh, pinch: data.cum_pnl.pinch });
      const { globalhit, bet, status, ending_snapshot: snap, mh_grids: grids, ...pick } = data;
      setPickResult({ method: pick.method, pick: pick.pick, match_start: pick.match_start, match_end: pick.match_end, matches: pick.matches, order: pick.order, prev_picks: pick.prev_picks, nickname: pick.nickname, code1: pick.code1, code2: pick.code2 });
      if (grids) setMhGrids(grids);
      setGlobalhitData(globalhit || []);
      setBetData(bet || null);
      if (status === "active") { setEndingMode(false); setEndingSnapshot(null); }
    } catch (err) {
      console.error("Failed to delete round:", err);
    } finally {
      processingRef.current = false;
      setProcessing(false);
    }
  }, [results, gameId]);

  // ED: 종료 모드 진입
  const handleEndingMode = async () => {
    if (endingMode || !betData) return;

    const nc = betData.megahit;
    const gh = betData.globalhit;
    const pinch = betData.pinch;
    const snapshot = { nc: false, gh: new Set(), pinch: new Set() };

    if (nc && nc.step > 1) snapshot.nc = true;

    if (globalhitData) {
      globalhitData.forEach((pat) => {
        pat.groups.forEach((g) => {
          if (g.step > 1) snapshot.gh.add(`${pat.pattern}-${g.group + 1}`);
        });
      });
    }

    if (pinch?.methods) {
      Object.entries(pinch.methods).forEach(([method, m]) => {
        if (m.step > 1) snapshot.pinch.add(method);
      });
    }

    if (!snapshot.nc && snapshot.gh.size === 0 && snapshot.pinch.size === 0) {
      try {
        await apiCaller.post(MH_GAMES_API.ENDING, { game_id: gameId, snapshot: { nc: false, gh: [], pinch: [] } });
      } catch (err) { console.error("Failed to start ending:", err); }
      setEndingMode(true); setEndingSnapshot(snapshot); setEndingDone(true);
      return;
    }

    try {
      const res = await apiCaller.post(MH_GAMES_API.ENDING, {
        game_id: gameId,
        snapshot: { nc: snapshot.nc, gh: [...snapshot.gh], pinch: [...snapshot.pinch] },
      });
      const data = res.data;
      const { globalhit, bet, game_id: _gid, status: _st, snapshot: _snap, mh_grids: grids, ...pick } = data;
      setPickResult({ method: pick.method, pick: pick.pick, match_start: pick.match_start, match_end: pick.match_end, matches: pick.matches, order: pick.order, prev_picks: pick.prev_picks, nickname: pick.nickname, code1: pick.code1, code2: pick.code2 });
      if (grids) setMhGrids(grids);
      setGlobalhitData(globalhit || []);
      setBetData(bet || null);
    } catch (err) { console.error("Failed to start ending:", err); }

    setEndingMode(true);
    setEndingSnapshot(snapshot);
  };

  // 종료 완료 체크
  const checkEndingComplete = (data) => {
    if (!endingSnapshot) return false;
    const nc = data.bet?.megahit;
    const gh = data.bet?.globalhit;
    const pinch = data.bet?.pinch;

    if (endingSnapshot.nc && nc && nc.step > 1) return false;

    if (data.globalhit) {
      for (const key of endingSnapshot.gh) {
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

    if (pinch?.methods) {
      for (const method of endingSnapshot.pinch) {
        const m = pinch.methods[method];
        if (m && m.step > 1) return false;
      }
    }
    return true;
  };

  // 게임 완전 종료
  const handleFinishGame = async () => {
    if (gameId) { try { await apiCaller.post(MH_GAMES_API.END, null, { params: { game_id: gameId } }); } catch {} }
    setEndingMode(false); setEndingSnapshot(null); setEndingDone(false);
    setResults([]); setPickHistory([]); setCumPnL({ mh: 0, gh: 0, pinch: 0 }); setCarryPnL({ mh: 0, gh: 0, pinch: 0 });
    setBetData(null); setPickResult({ method: "wait", pick: null }); setGlobalhitData([]);
    setSearchParams({}, { replace: true });
    startGame();
  };

  // new game
  const handleNewGame = () => setShowNewConfirm(true);
  const handleNewGameConfirm = async () => {
    setShowNewConfirm(false);
    setProcessing(true);
    try {
      if (searchParams.get("new")) setSearchParams({}, { replace: true });
      if (gameId && results.length > 0) {
        try { await apiCaller.post(MH_GAMES_API.END, null, { params: { game_id: gameId } }); } catch {}
      }
      setEndingMode(false); setEndingSnapshot(null); setEndingDone(false);
      setResults([]); setPickHistory([]); setCumPnL({ mh: 0, gh: 0, pinch: 0 }); setCarryPnL({ mh: 0, gh: 0, pinch: 0 });
      setBetData(null); setPickResult({ method: "wait", pick: null }); setGlobalhitData([]);
      await startGame();
    } finally { setProcessing(false); }
  };

  // next game
  const handleNextGame = async () => {
    if (!gameId) return;
    setProcessing(true);
    try {
      const res = await apiCaller.post(MH_GAMES_API.NEXT, null, { params: { game_id: gameId } });
      setEndingDone(false); setResults([]);
      const d = res.data;
      setGameId(d.game_id);
      setSearchParams({ gameId: d.game_id }, { replace: true });
      if (d.ref_game_seq) setRefGameSeq(d.ref_game_seq);
      if (d.ref_shoes) setRefShoes(d.ref_shoes);
      setMhGrids(d.mh_grids || null);
      setPickResult({ method: d.method || "wait", pick: d.pick || null });
      setGlobalhitData(d.globalhit || []);
      setBetData(d.bet || null);
      if (d.carry_pnl) { setCumPnL(d.carry_pnl); setCarryPnL(d.carry_pnl); }
      else { setCumPnL({ mh: 0, gh: 0, pinch: 0 }); setCarryPnL({ mh: 0, gh: 0, pinch: 0 }); }
      if (d.status === "ending" && d.ending_snapshot) {
        const snap = d.ending_snapshot;
        setEndingMode(true);
        setEndingSnapshot({ nc: snap.nc, gh: new Set(snap.gh || []), pinch: new Set(snap.pinch || []) });
      } else { setEndingMode(false); setEndingSnapshot(null); }
    } catch (err) { console.error("Failed to next game:", err); }
    finally { setProcessing(false); }
  };

  return (
    <Box sx={{ p: isMobile ? 0.5 : 2 }}>
      <Box sx={{ mb: 1, display: "flex", alignItems: "baseline", gap: 1 }}>
        <span style={{ fontSize: 14, fontWeight: "bold", color: "#fff" }}>메가히트</span>
        {gameId && <span style={{ fontSize: 11, color: "#888" }}>#{gameId}</span>}
      </Box>

      {/* ===== 상단: 6x40 빅로드 격자 ===== */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: `repeat(${GRID_COLS}, ${isMobile ? 16 : 26}px)`,
          gridTemplateRows: `repeat(${GRID_ROWS}, ${isMobile ? 16 : 26}px)`,
          gap: "1px", mb: 2, backgroundColor: "#616161", border: "1px solid #616161", width: "fit-content",
        }}
      >
        {grid.map((row, rowIndex) =>
          row.map((cell, colIndex) => {
            const isLscMatch = cell && Array.isArray(pickResult.matches) && pickResult.matches.some(
              m => cell.idx >= m.start && cell.idx < m.end
            );
            return (
              <Box
                key={`${rowIndex}-${colIndex}`}
                sx={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  backgroundColor: cell ? (CELL_BG[cell.status] || "background.default") : "background.default",
                  ...(isLscMatch && { border: "2px solid #4caf50", borderRadius: "2px" }),
                }}
              >
                {cell && <Circle type={cell.type} filled={true} size={isMobile ? 12 : 22} label={cell.idx + 1} />}
              </Box>
            );
          })
        )}
      </Box>

      {/* ===== 중단: 인터페이스 (1단) ===== */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 1, flexWrap: "wrap" }}>
        {/* formal / reverse */}
        {(() => {
          const method = pickResult.method || "formal";
          const isFormal = method === "formal";
          return (
            <Box sx={{ ...toggleBtnSx, backgroundColor: "#000", border: "2px solid #4caf50", borderRadius: 1, minWidth: isMobile ? 48 : 60, justifyContent: "center" }}>
              <Typography variant="caption" sx={{ fontSize: isMobile ? 10 : 12, fontWeight: "bold", color: isFormal ? "#f44336" : "#1565c0" }}>{isFormal ? "formal" : "reverse"}</Typography>
            </Box>
          );
        })()}
        {/* MH step */}
        {(() => {
          const mhStep = betData?.megahit?.step || 0;
          return (
            <Box sx={{ ...toggleBtnSx, border: "2px solid #4caf50" }}>
              <Typography variant="caption" sx={{ fontSize: isMobile ? 9 : 11, fontWeight: "bold", color: "#fff" }}>M{mhStep}</Typography>
            </Box>
          );
        })()}
        {/* global */}
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
            backgroundColor: endingMode ? "#ff6f00" : "#b71c1c", borderRadius: 2,
            border: endingMode ? "2px solid #ffab00" : "none", px: isMobile ? 1 : 1.5, cursor: "pointer",
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
        {/* 합산 배팅금액 */}
        <Box sx={{ ...toggleBtnSx, border: "2px solid #4caf50", cursor: "default", px: isMobile ? 0.5 : 1.5, minWidth: isMobile ? 50 : 120, justifyContent: "flex-end" }}>
          <Typography variant="caption" sx={{ fontSize: isMobile ? 10 : 12, fontWeight: "bold", color: "#4caf50" }}>
            {betData?.combined ? `${betData.combined.amount.toLocaleString()}P` : "0P"}
          </Typography>
        </Box>

        <Box sx={{ width: "1px", height: 28, backgroundColor: "rgba(255,255,255,0.2)", mx: 0.3 }} />

        {/* 픽이미지 */}
        <Box sx={{ width: isMobile ? 52 : 95, height: isMobile ? 52 : 95, border: "2px solid rgba(255,255,255,0.3)", borderRadius: 2, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <img src={pickImage} alt="pick" style={{ width: isMobile ? 46 : 85, height: isMobile ? 46 : 85, objectFit: "contain" }} />
        </Box>
        {/* 턴 */}
        <Box sx={{ width: isMobile ? 24 : 40, height: isMobile ? 24 : 40, border: "2px solid rgba(255,255,255,0.3)", borderRadius: 1, backgroundColor: "#333", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Typography variant="body2" sx={{ fontWeight: "bold", fontSize: isMobile ? 10 : 16 }}>{currentTurn}</Typography>
        </Box>
        {/* P 버튼 */}
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
        {/* B 버튼 */}
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
        <Box sx={{ width: isMobile ? 32 : 0 }} />
        {/* del */}
        <Box
          onClick={results.length > 0 && !processing ? handleDeleteOne : undefined}
          sx={{ ...controlBtnSx, cursor: processing ? "not-allowed" : results.length > 0 ? "pointer" : "default", opacity: processing ? 0.4 : results.length > 0 ? 1 : 0.4, pointerEvents: processing ? "none" : "auto" }}
        >
          <Typography variant="caption" sx={{ fontSize: isMobile ? 10 : 13 }}>del</Typography>
        </Box>
        {/* set-up */}
        <Box onClick={() => navigate(`/mhgame/setup${gameId ? `?gameId=${gameId}` : ""}`)} sx={{ ...controlBtnSx, cursor: "pointer", border: "2px solid rgba(255,255,255,0.3)" }}>
          <Typography variant="caption" sx={{ fontSize: isMobile ? 10 : 12 }}>set-up</Typography>
        </Box>
        {/* next */}
        <Box
          onClick={results.length > 0 && !processing ? () => setShowNextConfirm(true) : undefined}
          sx={{ ...controlBtnSx, cursor: processing ? "not-allowed" : results.length > 0 ? "pointer" : "default", opacity: processing ? 0.4 : results.length > 0 ? 1 : 0.4, pointerEvents: processing ? "none" : "auto", border: "2px solid rgba(255,255,255,0.3)" }}
        >
          <Typography variant="caption" sx={{ fontSize: isMobile ? 10 : 12 }}>next</Typography>
        </Box>
        {/* new */}
        <Box onClick={!processing ? handleNewGame : undefined} sx={{ ...controlBtnSx, cursor: processing ? "not-allowed" : "pointer", opacity: processing ? 0.4 : 1, pointerEvents: processing ? "none" : "auto", border: "2px solid #2196f3" }}>
          <Typography variant="caption" sx={{ fontSize: isMobile ? 10 : 12, color: "#2196f3" }}>new</Typography>
        </Box>
      </Box>

      {/* ===== 대시보드 ===== */}
      {(() => {
        const nc = betData?.megahit;
        const gh = betData?.globalhit;
        const combined = betData?.combined;
        const combinedDir = combined?.direction || "wait";
        const dirColor = combinedDir === "P" ? "#1565c0" : combinedDir === "B" ? "#f44336" : "#888";

        const dc = { border: "1px solid #555", padding: isMobile ? "2px 4px" : "3px 12px", fontSize: isMobile ? 8 : 10, textAlign: "center", whiteSpace: "nowrap" };
        const dcB = { ...dc, fontWeight: "bold" };

        return (
          <>
          {/* 데스크톱: 상단 요약 바 */}
          {!isMobile && (
          <Box sx={{ display: "flex", alignItems: "stretch", gap: 0.5, mb: 0.5, flexWrap: "wrap" }}>
            <Box sx={{ border: "1px solid rgba(255,255,255,0.3)", borderRadius: 2, px: 1.5, display: "flex", alignItems: "center" }}>
              <Typography variant="caption" sx={{ fontSize: 11, fontWeight: "bold", color: dirColor }}>{`${pickResult.method || "formal"}(${combinedDir})`}</Typography>
            </Box>
            {(() => {
              const ncHasBet = (betData?.megahit?.amount || 0) > 0;
              const ghHasBet = (betData?.globalhit?.P || 0) + (betData?.globalhit?.B || 0) > 0;
              const pinchOn = betData?.pinch?.active || false;
              const items = [
                { name: "MegaHit", pnl: cumPnL.mh || 0, active: ncHasBet },
                { name: "globalhit", pnl: cumPnL.gh || 0, active: ghHasBet },
              ];
              return items.map((item, i) => {
                const clr = item.pnl > 0 ? "#4caf50" : item.pnl < 0 ? "#f44336" : "#fff";
                const sign = item.pnl > 0 ? "+" : "";
                return (
                  <Box key={i} sx={{ border: `1px solid ${item.active ? "rgba(255,255,255,0.3)" : "#333"}`, borderRadius: 2, px: 2, minWidth: 200, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <Typography variant="caption" sx={{ fontSize: 11, fontWeight: "bold", color: "#fff" }}>{item.name}</Typography>
                    <Typography variant="caption" sx={{ fontSize: 11, fontWeight: "bold", color: clr }}>{`${sign}${item.pnl.toLocaleString()}P`}</Typography>
                  </Box>
                );
              });
            })()}
            {(() => {
              const totalPnL = (cumPnL.mh || 0) + (cumPnL.gh || 0);
              const sign = totalPnL > 0 ? "+" : "";
              return (
                <Box sx={{ px: 2, minWidth: 200, backgroundColor: "#00bcd4", borderRadius: 2, display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
                  <Typography variant="caption" sx={{ fontSize: 11, fontWeight: "bold", color: totalPnL < 0 ? "#f44336" : "#000" }}>{`${sign}${totalPnL.toLocaleString()}P`}</Typography>
                </Box>
              );
            })()}
          </Box>
          )}

          {/* 상황판 테이블 + 모바일 우측 요약 */}
          <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, mb: 0.5 }}>
          {(() => {
            const anyBet = (nc?.amount || 0) > 0 || (gh?.P || 0) + (gh?.B || 0) > 0;
            return (
          <table style={{ borderCollapse: "collapse", width: "fit-content", marginBottom: 12, filter: anyBet ? "none" : "grayscale(100%)", opacity: anyBet ? 1 : 0.8 }}>
            <tbody>
              {/* 1행: 섹션 상세 */}
              {(() => {
                const ncHasBet = (nc?.amount || 0) > 0;
                const ghHasBet = (gh?.P || 0) + (gh?.B || 0) > 0;
                const ncDimStyle = ncHasBet ? {} : { filter: "grayscale(100%)", opacity: 0.7 };
                const ghDimStyle = ghHasBet ? {} : { filter: "grayscale(100%)", opacity: 0.7 };
                return (
                  <tr>
                    <td style={{ ...dcB, color: "#00bcd4", ...ncDimStyle }}>MegaHit</td>
                    <td style={{ ...dc, color: "#1565c0", ...ncDimStyle }}>{`${(nc?.direction === "P" ? (nc?.amount || 0) : 0).toLocaleString()}P`}</td>
                    <td style={{ ...dc, color: "#f44336", ...ncDimStyle }}>{`${(nc?.direction === "B" ? (nc?.amount || 0) : 0).toLocaleString()}P`}</td>
                    <td style={{ ...dcB, color: "#00bcd4", ...ghDimStyle }}>globalhit</td>
                    <td style={{ ...dc, color: "#1565c0", ...ghDimStyle }}>{`${(gh?.P || 0).toLocaleString()}P`}</td>
                    <td style={{ ...dc, color: "#f44336", ...ghDimStyle }}>{`${(gh?.B || 0).toLocaleString()}P`}</td>
                    <td style={{ ...dcB, color: "#fff" }}>{currentTurn}</td>
                    <td style={{ ...dc, color: "#1565c0" }}>{`${((nc?.direction === "P" ? (nc?.amount || 0) : 0) + (gh?.P || 0)).toLocaleString()}P`}</td>
                    <td style={{ ...dc, color: "#f44336" }}>{`${((nc?.direction === "B" ? (nc?.amount || 0) : 0) + (gh?.B || 0)).toLocaleString()}P`}</td>
                  </tr>
                );
              })()}

              {/* 글로벌히트 패턴×섹션 */}
              {(() => {
                const ghPatterns = ["PPP", "BBB", "PBP", "BPB", "PPB", "BBP", "PBB", "BPP"];
                const getPatSec = (pat, sec) => {
                  const d = gh?.details?.find((x) => x.pattern === pat && x.group === sec + 1);
                  return d ? d.amount : 0;
                };
                return [[ghPatterns[0], ghPatterns[1]], [ghPatterns[2], ghPatterns[3]], [ghPatterns[4], ghPatterns[5]], [ghPatterns[6], ghPatterns[7]]].map((pair, ri) => (
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
                              {(() => {
                                const active = currentTurn >= sec + 1;
                                const predict = active ? pat[(currentTurn - 1 - sec) % pat.length] : null;
                                const clr = !active ? "#fff" : predict === "P" ? "#1565c0" : "#f44336";
                                return <span style={{ color: clr, fontSize: 9 }}>({sec + 1}sc)</span>;
                              })()}
                            </td>
                            {(() => {
                              const active = currentTurn >= sec + 1;
                              const predict = active ? pat[(currentTurn - 1 - sec) % pat.length] : null;
                              const clr = !active ? "#fff" : predict === "P" ? "#1565c0" : "#f44336";
                              return <td style={{ ...dc, color: clr, ...dimStyle }}>{`${(amt || 0).toLocaleString()}P`}</td>;
                            })()}
                          </React.Fragment>
                        );
                      })
                    )}
                  </tr>
                ));
              })()}

            </tbody>
          </table>
            );
          })()}

          {/* 모바일: 우측 요약 패널 — 생략 */}
          </Box>

          {/* ===== formal / reverse 예측 그리드 ===== */}
          {(() => {
            const PRED_COLS = 30;
            const cellSz = isMobile ? 16 : 26;
            const predCell = { width: cellSz, height: cellSz, border: "1px solid #555", padding: 0, display: "flex", alignItems: "center", justifyContent: "center" };
            const predCircle = (color) => ({
              width: cellSz - 4, height: cellSz - 4, borderRadius: "50%",
              backgroundColor: color,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontSize: isMobile ? 8 : 10, fontWeight: "bold",
            });
            const emptyCell = { ...predCell, backgroundColor: "transparent" };

            // 서버에서 계산된 formal/reverse 격자 데이터 사용
            const formalData = mhGrids?.formal || [];
            const reverseData = mhGrids?.reverse || [];

            const renderGrid = (label, data, gridColor, formalRef) => {
              return (
                <Box sx={{ mb: 1 }}>
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.3, width: PRED_COLS * (cellSz + 1) + 1 }}>
                    <Box sx={{ border: "1px solid rgba(255,255,255,0.3)", borderRadius: 1, px: 1.5, py: 0.2 }}>
                      <Typography variant="caption" sx={{ fontSize: isMobile ? 10 : 12, color: "#fff" }}>{label}</Typography>
                    </Box>
                    {label === "formal" && (
                      <Box onClick={() => {
                        const val = prompt("참조 게임 번호 입력 (빈값=랜덤)", refGameSeq || "");
                        if (val === null) return;
                        const seq = val.trim() ? parseInt(val.trim(), 10) : null;
                        if (val.trim() && isNaN(seq)) return;
                        const doStart = async () => {
                          if (gameId && results.length > 0) {
                            try { await apiCaller.post(MH_GAMES_API.END, null, { params: { game_id: gameId } }); } catch {}
                          }
                          setEndingMode(false); setEndingSnapshot(null); setEndingDone(false);
                          setResults([]); setCumPnL({ mh: 0, gh: 0 }); setCarryPnL({ mh: 0, gh: 0 });
                          setBetData(null); setPickResult({ method: "wait", pick: null }); setGlobalhitData([]);
                          await startGame(seq || undefined);
                        };
                        doStart();
                      }} sx={{ border: "1px solid rgba(255,255,255,0.3)", borderRadius: 1, px: 2, py: 0.2, minWidth: isMobile ? 60 : 80, textAlign: "right", cursor: "pointer", "&:hover": { borderColor: "#4caf50" } }}>
                        <Typography variant="caption" sx={{ fontSize: isMobile ? 10 : 13, fontWeight: "bold", color: "#fff" }}>
                          {refGameSeq || ""}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                  <Box sx={{ display: "grid", gridTemplateColumns: `repeat(${PRED_COLS}, ${cellSz}px)`, gridTemplateRows: `repeat(2, ${cellSz}px)`, gap: "1px", backgroundColor: gridColor, border: `1px solid ${gridColor}`, width: "fit-content" }}>
                    {[0, 1].flatMap((ri) =>
                      Array.from({ length: PRED_COLS }, (_, ci) => {
                        const idx = ri * PRED_COLS + ci;
                        const d = data[idx];
                        const fPick = formalRef ? formalRef[idx]?.dir : d?.dir;
                        return (
                          <Box key={`${ri}-${ci}`} onClick={() => { if (d && d.prev_picks) setSelectedGridCell({ prev_picks: d.prev_picks, code1: d.code1, code2: d.code2, nickname: d.nickname, pick: fPick, num: d.num }); }} sx={{ width: cellSz, height: cellSz, display: "flex", alignItems: "center", justifyContent: "center", cursor: d?.prev_picks ? "pointer" : "default", backgroundColor: d?.status === "hit" ? "#00e676" : d?.status === "miss" ? "#ffeb3b" : "background.default" }}>
                            {d && d.dir && <Box sx={predCircle(d.dir === "P" ? "#1565c0" : "#f44336")}>{d.num || ""}</Box>}
                          </Box>
                        );
                      })
                    )}
                  </Box>
                </Box>
              );
            };

            return (
              <Box sx={{ mt: 1 }}>
                {renderGrid("formal", formalData, "#f44336")}
                {renderGrid("reverse", reverseData, "#1565c0", formalData)}
              </Box>
            );
          })()}

</>
        );
      })()}

      {/* ===== 패턴 매칭 표시 ===== */}
      {(() => {
        const src = selectedGridCell || (pickResult.prev_picks ? pickResult : null);
        const dispNum = src ? (selectedGridCell ? selectedGridCell.num : currentTurn) : null;
        const dispPick = src ? (selectedGridCell ? selectedGridCell.pick : pickResult.pick) : null;
        return (
          <Box sx={{ display: "flex", alignItems: "center", gap: 0, my: 1, flexWrap: "wrap" }}>
            {selectedGridCell && (
              <Box onClick={() => setSelectedGridCell(null)} sx={{ cursor: "pointer", mr: 1, color: "#aaa", fontSize: 16, lineHeight: 1 }}>✕</Box>
            )}
            {/* prev_picks 패턴 격자 (11칸) */}
            <Box sx={{ display: "grid", gridTemplateColumns: `repeat(11, ${isMobile ? 22 : 28}px)`, gap: "1px", backgroundColor: "#555", border: "1px solid #555" }}>
              {Array.from({ length: 11 }).map((_, i) => {
                const ch = src?.prev_picks?.[i];
                const sz = isMobile ? 16 : 22;
                return (
                  <Box key={`pp-${i}`} sx={{
                    width: isMobile ? 22 : 28, height: isMobile ? 22 : 28,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    backgroundColor: "#1a1a1a",
                  }}>
                    {ch && (
                      <Box sx={{
                        width: sz, height: sz, borderRadius: "50%",
                        backgroundColor: ch === "P" ? "#1565c0" : "#f44336",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: isMobile ? 9 : 11, fontWeight: "bold", color: "#fff",
                      }}>{ch}</Box>
                    )}
                  </Box>
                );
              })}
            </Box>
            {/* gap */}
            <Box sx={{ width: 8 }} />
            {/* code1-code2 */}
            <Box sx={{
              border: "1px solid #888", borderRadius: 1, px: 1, py: 0.3,
              backgroundColor: "rgba(255,255,255,0.08)", minWidth: 50, textAlign: "center",
            }}>
              <Typography variant="caption" sx={{ fontSize: isMobile ? 10 : 12, color: "#ccc" }}>
                {src?.code1 || "?"}-{src?.code2 || "?"}
              </Typography>
            </Box>
            {/* gap */}
            <Box sx={{ width: 8 }} />
            {/* nickname */}
            <Box sx={{
              border: "1px solid #888", borderRadius: 1, px: 1, py: 0.3,
              backgroundColor: "rgba(255,255,255,0.08)", minWidth: 40, textAlign: "center",
            }}>
              <Typography variant="caption" sx={{ fontSize: isMobile ? 10 : 12, color: "#ffd54f", fontWeight: "bold" }}>
                {src?.nickname || "-"}
              </Typography>
            </Box>
            {/* gap */}
            <Box sx={{ width: 8 }} />
            {/* 픽 격자 (회차 번호 표시) */}
            <Box sx={{
              width: isMobile ? 24 : 30, height: isMobile ? 24 : 30,
              border: "1px solid #555", display: "flex", alignItems: "center", justifyContent: "center",
              backgroundColor: "#1a1a1a",
            }}>
              <Box sx={{
                width: isMobile ? 18 : 24, height: isMobile ? 18 : 24, borderRadius: "50%",
                backgroundColor: dispPick === "P" ? "#1565c0" : dispPick === "B" ? "#f44336" : "#555",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: isMobile ? 10 : 13, fontWeight: "bold", color: "#fff",
              }}>
                {dispNum}
              </Box>
            </Box>
          </Box>
        );
      })()}

      {/* ===== 하단: GlobalHit 패턴 요약 ===== */}
      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
        <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
          <Box sx={{ border: "1px solid #4caf50", borderRadius: 1, px: 1.5, py: 0.3, cursor: "pointer" }}>
            <Typography variant="caption" sx={{ fontSize: 11, color: "#4caf50", fontWeight: "bold" }}>globalhitwhole</Typography>
          </Box>
        </Box>
        {(() => {
          const ghPatterns = ["PPP", "BBB", "PBP", "BPB", "PPB", "BBP", "PBB", "BPP"];
          const displayData = ghPatterns.map((p) => {
            const existing = globalhitData.find((d) => d.pattern === p);
            return existing || { pattern: p, groups: [{ step: 1, row1: [], row2: [] }, { step: 1, row1: [], row2: [] }, { step: 1, row1: [], row2: [] }] };
          });
          return displayData;
        })().map((patData) => {
          const pat = patData.pattern;
          const cellSize = 20;
          const colsPerRow = 30;
          const totalCols = colsPerRow + 2;
          const GH_CELL_BG = { hit: "#00e676", miss: "#ffeb3b", wait: "#555" };
          const tdStyleFn = (status) => ({
            width: cellSize, height: cellSize, border: "1px solid #555", padding: 0, textAlign: "center",
            backgroundColor: GH_CELL_BG[status],
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
                    {pat.split("").map((c, i) => (
                      <Typography key={i} component="span" sx={{ color: c === "P" ? "#1565c0" : "#f44336", fontWeight: "bold", fontSize: 11 }}>{c}</Typography>
                    ))}
                    <Typography component="span" sx={{ fontSize: 10, color: "text.secondary" }}>(123)</Typography>
                  </Typography>
                </Box>
                <Box sx={{ border: "1px solid rgba(255,255,255,0.3)", px: 0.8, py: 0.2 }}>
                  <Typography variant="caption" sx={{ fontSize: 10 }}>{results.length}</Typography>
                </Box>
                {(patData.groups || [0, 1, 2].map(() => ({}))).map((g, gi) => (
                  <Box key={gi} sx={{ display: "flex", gap: 0.3, ml: gi > 0 ? 1 : 0 }}>
                    <Box sx={{ border: "1px solid rgba(255,255,255,0.3)", px: 0.6, py: 0.2 }}>
                      <Typography variant="caption" sx={{ fontSize: 10 }}>SC{gi + 1}</Typography>
                    </Box>
                    <Box sx={{ border: "1px solid rgba(255,255,255,0.3)", px: 0.6, py: 0.2 }}>
                      <Typography variant="caption" sx={{ fontSize: 10, ...((g.step ?? 0) > 1 && { color: "#f44336", fontWeight: "bold" }) }}>{g.step ?? 1}S</Typography>
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

              {/* 접이식 세부 그리드 */}
              {collapsedPatterns[pat] && (
              <table style={{ borderCollapse: "collapse", borderSpacing: 0 }}>
                <tbody>
                  {(patData.groups || []).map((group, gi) => {
                    const row1 = group.row1 || [];
                    const row2 = group.row2 || [];
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
                          const base = hasData ? tdStyleFn(item.status) : tdStyleFn(null);
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
                          const base = hasData ? tdStyleFn(item.status) : tdStyleFn(null);
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

      {/* ED 종료 완료 팝업 */}
      <Dialog open={endingDone} onClose={() => {}}>
        <DialogTitle sx={{ fontWeight: "bold" }}>게임 종료</DialogTitle>
        <DialogContent>
          <Typography>모든 배팅이 완료되었습니다.</Typography>
          <Box sx={{ mt: 2 }}>
            {[
              { name: "MegaHit", pnl: cumPnL.mh || 0 },
              { name: "Globalhit", pnl: cumPnL.gh || 0 },
            ].map((item) => (
              <Typography key={item.name} sx={{ color: item.pnl >= 0 ? "#4caf50" : "#f44336" }}>
                {item.name}: {item.pnl > 0 ? "+" : ""}{item.pnl.toLocaleString()}P
              </Typography>
            ))}
            <Typography sx={{ mt: 1, fontWeight: "bold", color: ((cumPnL.mh || 0) + (cumPnL.gh || 0)) >= 0 ? "#4caf50" : "#f44336" }}>
              Total: {((cumPnL.mh || 0) + (cumPnL.gh || 0)) > 0 ? "+" : ""}{((cumPnL.mh || 0) + (cumPnL.gh || 0)).toLocaleString()}P
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleFinishGame} variant="contained">새 게임 시작</Button>
        </DialogActions>
      </Dialog>

      {/* 넥스트 게임 확인 */}
      <Dialog open={showNextConfirm} onClose={() => setShowNextConfirm(false)}>
        <DialogTitle sx={{ fontWeight: "bold" }}>다음 게임</DialogTitle>
        <DialogContent>
          <Typography>현재 게임을 종료하고 다음 게임으로 넘어가시겠습니까?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowNextConfirm(false)}>취소</Button>
          <Button onClick={() => { setShowNextConfirm(false); handleNextGame(); }} variant="contained">확인</Button>
        </DialogActions>
      </Dialog>

      {/* 이전 게임 복원 확인 */}
      <Dialog open={!!resumeGame} onClose={async () => { const gid = resumeGame?.game_id; setResumeGame(null); if (gid) { try { await apiCaller.post(MH_GAMES_API.END, null, { params: { game_id: gid } }); } catch {} } startGame(); }}>
        <DialogTitle sx={{ fontWeight: "bold" }}>이전 게임 복원</DialogTitle>
        <DialogContent>
          <Typography>진행 중인 게임이 있습니다. (#{resumeGame?.game_id}, {resumeGame?.round_count}회차)</Typography>
          <Typography>이어서 하시겠습니까?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={async () => { const gid = resumeGame.game_id; setResumeGame(null); try { await apiCaller.post(MH_GAMES_API.END, null, { params: { game_id: gid } }); } catch {} startGame(); }}>새 게임</Button>
          <Button onClick={() => { const gid = resumeGame.game_id; setResumeGame(null); restoreGame(gid); }} variant="contained">이어하기</Button>
        </DialogActions>
      </Dialog>

      {/* 새 게임 확인 */}
      <Dialog open={showNewConfirm} onClose={() => { setShowNewConfirm(false); if (searchParams.get("new")) setSearchParams(gameId ? { gameId } : {}, { replace: true }); }}>
        <DialogTitle sx={{ fontWeight: "bold" }}>새 게임</DialogTitle>
        <DialogContent>
          <Typography>테스트용 기능입니다.</Typography>
          <Typography>carry-over 없이 새 게임을 시작합니다.</Typography>
          <Typography>계속하시겠습니까?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setShowNewConfirm(false); if (searchParams.get("new")) setSearchParams(gameId ? { gameId } : {}, { replace: true }); }}>취소</Button>
          <Button onClick={handleNewGameConfirm} variant="contained">확인</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
