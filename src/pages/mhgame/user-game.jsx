import React, { useState, useEffect, useCallback, useRef } from "react";
import { Box, Typography, useMediaQuery, useTheme, Dialog, DialogTitle, DialogContent, DialogActions, Button } from "@mui/material";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAtomValue } from "jotai";
import { userAtom } from "@/store/auth-store";
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

export default function MhUserGamePage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const user = useAtomValue(userAtom);
  const isAdmin = user?.role === "admin";

  const [results, setResults] = useState([]);
  const [pickResult, setPickResult] = useState({ method: "wait", pick: null });
  const [selectedGridCell, setSelectedGridCell] = useState(null);
  const [globalhitData, setGlobalhitData] = useState([]);
  const [ghActiveSteps, setGhActiveSteps] = useState({});
  const [betData, setBetData] = useState(null);
  const [gameId, setGameId] = useState(null);
  const [refGameSeq, setRefGameSeq] = useState(null);
  const [refShoes, setRefShoes] = useState("");
  const [mhGrids, setMhGrids] = useState(null);
  const [cumPnL, setCumPnL] = useState({ mh: 0, gh: 0, user_a: 0, user_z: 0 });
  const [carryPnL, setCarryPnL] = useState({ mh: 0, gh: 0 });

  const [endingMode, setEndingMode] = useState(false);
  const [endingSnapshot, setEndingSnapshot] = useState(null);
  const [endingDone, setEndingDone] = useState(false);
  const [collapsedPatterns, setCollapsedPatterns] = useState({});
  const processingRef = useRef(false);
  const [processing, setProcessing] = useState(false);

  // 유저 마틴 관련
  const [userMartin, setUserMartin] = useState(null);
  const [userSummary, setUserSummary] = useState(null);
  const [userMartinDashboard, setUserMartinDashboard] = useState(null);
  const goalAlertedRef = useRef({ a: false, z: false });
  const [goalDialog, setGoalDialog] = useState({ open: false, msgs: [] });

  const [showNextConfirm, setShowNextConfirm] = useState(false);
  const [showNewConfirm, setShowNewConfirm] = useState(false);
  const [resumeGame, setResumeGame] = useState(null);

  const currentTurn = results.length + 1;
  const grid = calculateCircleGrid(results);

  // 유저 배팅: user_martin.combined → bet.combined fallback
  const umCombined = userMartin?.combined || betData?.combined;
  const displayPick = umCombined?.direction && umCombined.direction !== "wait" ? umCombined.direction : null;
  const pickImage = displayPick === "P" ? "/player.png" : displayPick === "B" ? "/banker.png" : "/wait.png";

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

  // 응답에서 공통 데이터 추출 헬퍼
  const applyResponseData = (data) => {
    if (data.method !== undefined) setPickResult({ method: data.method, pick: data.pick || null, prev_picks: data.prev_picks, nickname: data.nickname, code1: data.code1, code2: data.code2 });
    if (data.mh_grids) setMhGrids(data.mh_grids);
    setGlobalhitData(data.globalhit || []);
    setGhActiveSteps(data.gh_active_steps || {});
    setBetData(data.bet || null);
    if (data.user_martin !== undefined) setUserMartin(data.user_martin || null);
    if (data.user_summary !== undefined) setUserSummary(data.user_summary || null);
    if (data.user_martin_dashboard !== undefined) setUserMartinDashboard(data.user_martin_dashboard || null);
  };

  const resetAll = () => {
    setEndingMode(false); setEndingSnapshot(null); setEndingDone(false);
    setResults([]); setCumPnL({ mh: 0, gh: 0, user_a: 0, user_z: 0 }); setCarryPnL({ mh: 0, gh: 0 });
    setBetData(null); setUserMartin(null); setPickResult({ method: "wait", pick: null }); setGlobalhitData([]); setGhActiveSteps({});
    setUserSummary(null); setUserMartinDashboard(null);
  };

  // 게임 시작
  const startGame = useCallback(async (refSeq) => {
    try {
      const params = new URLSearchParams({ mode: "user" });
      if (refSeq) params.set("ref_game_seq", refSeq);
      const res = await apiCaller.post(MH_GAMES_API.START + "?" + params.toString());
      const data = res.data;
      setGameId(data.game_id);
      setSearchParams({ gameId: data.game_id }, { replace: true });
      setPickResult({ method: data.method, pick: data.pick, prev_picks: data.prev_picks, nickname: data.nickname, code1: data.code1, code2: data.code2 });
      setRefGameSeq(data.ref_game_seq);
      setRefShoes(data.ref_shoes || "");
      setMhGrids(data.mh_grids || null);
      setGlobalhitData(data.globalhit || []);
      setGhActiveSteps(data.gh_active_steps || {});
      setBetData(data.bet || null);
      setUserMartin(data.user_martin || null);
      setUserSummary(data.user_summary || null);
      setUserMartinDashboard(data.user_martin_dashboard || null);
      if (data.carry_pnl) setCarryPnL(data.carry_pnl);
    } catch (err) {
      console.error("Failed to start game:", err);
    }
  }, []);

  // 게임 복원
  const restoreGame = async (gid) => {
    try {
      const res = await apiCaller.get(MH_GAMES_API.STATE(gid) + "?mode=user");
      const data = res.data;
      setGameId(data.game_id);
      setResults(data.results || []);
      setCumPnL(data.cum_pnl || { mh: 0, gh: 0, user_a: 0, user_z: 0 });
      setPickResult({ method: data.method, pick: data.pick, prev_picks: data.prev_picks, nickname: data.nickname, code1: data.code1, code2: data.code2 });
      setRefGameSeq(data.ref_game_seq);
      setRefShoes(data.ref_shoes || "");
      setMhGrids(data.mh_grids || null);
      setGlobalhitData(data.globalhit || []);
      setGhActiveSteps(data.gh_active_steps || {});
      setBetData(data.bet || null);
      setUserMartin(data.user_martin || null);
      setUserSummary(data.user_summary || null);
      setUserMartinDashboard(data.user_martin_dashboard || null);
      if (data.status === "ending" && data.ending_snapshot) {
        setEndingMode(true);
        setEndingSnapshot({
          nc: data.ending_snapshot.nc || false,
          gh: new Set(data.ending_snapshot.gh || []),
          pinch: new Set(data.ending_snapshot.pinch || []),
        });
      }
    } catch (err) {
      console.error("Failed to restore game:", err);
    }
  };

  // 페이지 로드
  useEffect(() => {
    const urlGameId = searchParams.get("gameId");
    const isNew = searchParams.get("new");
    if (isNew) {
      const doNew = async () => {
        if (gameId && results.length > 0) {
          try { await apiCaller.post(MH_GAMES_API.END, null, { params: { game_id: gameId } }); } catch {}
        }
        resetAll();
        await startGame();
      };
      doNew();
      return;
    } else if (urlGameId) {
      restoreGame(parseInt(urlGameId));
    } else {
      let cancelled = false;
      apiCaller.get(MH_GAMES_API.LAST_ACTIVE + "?mode=user").then(async (res) => {
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

    try {
      const res = await apiCaller.post(MH_GAMES_API.ROUND, { game_id: gameId, actual: inputValue });
      const data = res.data;
      if (data.round_num !== undefined && data.round_num !== results.length + 1) {
        alert("서버/클라이언트 불일치가 감지되어 페이지를 리로드합니다.");
        window.location.reload();
        return;
      }
      setCumPnL({ mh: data.cum_pnl.mh, gh: data.cum_pnl.gh, user_a: data.cum_pnl.user_a || 0, user_z: data.cum_pnl.user_z || 0 });
      setPickResult({ method: data.method, pick: data.pick, prev_picks: data.prev_picks, nickname: data.nickname, code1: data.code1, code2: data.code2 });
      if (data.mh_grids) setMhGrids(data.mh_grids);
      setGlobalhitData(data.globalhit || []);
      setGhActiveSteps(data.gh_active_steps || {});
      setBetData(data.bet || null);
      setUserMartin(data.user_martin || null);
      setUserSummary(data.user_summary || null);
      setUserMartinDashboard(data.user_martin_dashboard || null);
      checkGoalAlert(data.user_summary);

      if (endingMode && endingSnapshot) {
        if (checkEndingComplete(data)) {
          setEndingDone(true);
          setBetData(null);
          setUserMartin(null);
        }
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

  // 마지막 1개 삭제
  const handleDeleteOne = useCallback(async () => {
    if (results.length === 0 || !gameId || processingRef.current) return;
    processingRef.current = true;
    setProcessing(true);
    try {
      const res = await apiCaller.delete(MH_GAMES_API.LAST_ROUND(gameId));
      const data = res.data;
      setResults(results.slice(0, -1));
      setCumPnL({ mh: data.cum_pnl.mh, gh: data.cum_pnl.gh, user_a: data.cum_pnl.user_a || 0, user_z: data.cum_pnl.user_z || 0 });
      setPickResult({ method: data.method, pick: data.pick, prev_picks: data.prev_picks, nickname: data.nickname, code1: data.code1, code2: data.code2 });
      if (data.mh_grids) setMhGrids(data.mh_grids);
      setGlobalhitData(data.globalhit || []);
      setGhActiveSteps(data.gh_active_steps || {});
      setBetData(data.bet || null);
      setUserMartin(data.user_martin || null);
      setUserSummary(data.user_summary || null);
      setUserMartinDashboard(data.user_martin_dashboard || null);
      if (data.status === "active") { setEndingMode(false); setEndingSnapshot(null); }
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

    // 유저: 서버가 내려준 요약 데이터로 snapshot 구성
    const mhStep = betData.megahit?.step ?? betData.mh_step ?? 1;
    const ghSteps = ghActiveSteps || {};
    const snapshot = { nc: false, gh: new Set(), pinch: new Set() };

    if (mhStep > 1) snapshot.nc = true;
    Object.keys(ghSteps).forEach((key) => { if (ghSteps[key] > 1) snapshot.gh.add(key); });

    if (!snapshot.nc && snapshot.gh.size === 0) {
      try {
        await apiCaller.post(MH_GAMES_API.ENDING, { game_id: gameId, snapshot: { nc: false, gh: [], pinch: [] } });
      } catch (err) { console.error("Failed to start ending:", err); }
      setEndingMode(true); setEndingSnapshot(snapshot); setEndingDone(true);
      return;
    }

    try {
      const res = await apiCaller.post(MH_GAMES_API.ENDING, {
        game_id: gameId,
        snapshot: { nc: snapshot.nc, gh: [...snapshot.gh], pinch: [] },
      });
      const data = res.data;
      setPickResult({ method: data.method, pick: data.pick, prev_picks: data.prev_picks, nickname: data.nickname, code1: data.code1, code2: data.code2 });
      if (data.mh_grids) setMhGrids(data.mh_grids);
      setGlobalhitData(data.globalhit || []);
      setGhActiveSteps(data.gh_active_steps || {});
      setBetData(data.bet || null);
    } catch (err) { console.error("Failed to start ending:", err); }

    setEndingMode(true);
    setEndingSnapshot(snapshot);
  };

  // 종료 완료 체크
  const checkEndingComplete = (data) => {
    if (!endingSnapshot) return false;

    // 어드민: bet.megahit 사용, 유저: bet.mh_step 사용
    const mhStep = data.bet?.megahit?.step ?? data.bet?.mh_step ?? 1;
    if (endingSnapshot.nc && mhStep > 1) return false;

    // 어드민: globalhit 상세, 유저: gh_active_steps 요약
    const activeSteps = data.gh_active_steps || {};
    for (const key of endingSnapshot.gh) {
      if (activeSteps[key] && activeSteps[key] > 1) return false;
    }
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
    return true;
  };

  // 게임 완전 종료
  const handleFinishGame = async () => {
    if (gameId) { try { await apiCaller.post(MH_GAMES_API.END, null, { params: { game_id: gameId } }); } catch {} }
    setEndingMode(false); setEndingSnapshot(null); setEndingDone(false);
    setResults([]); setCumPnL({ mh: 0, gh: 0, user_a: 0, user_z: 0 }); setCarryPnL({ mh: 0, gh: 0 });
    setBetData(null); setUserMartin(null); setPickResult({ method: "wait", pick: null }); setGlobalhitData([]);
    setUserSummary(null); setUserMartinDashboard(null);
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
      setResults([]); setCumPnL({ mh: 0, gh: 0, user_a: 0, user_z: 0 }); setCarryPnL({ mh: 0, gh: 0 });
      setBetData(null); setUserMartin(null); setPickResult({ method: "wait", pick: null }); setGlobalhitData([]);
      setUserSummary(null); setUserMartinDashboard(null);
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
      setPickResult({ method: d.method || "wait", pick: d.pick || null, prev_picks: d.prev_picks, nickname: d.nickname, code1: d.code1, code2: d.code2 });
      setGlobalhitData(d.globalhit || []);
      setBetData(d.bet || null);
      setUserMartin(d.user_martin || null);
      setUserSummary(d.user_summary || null);
      setUserMartinDashboard(d.user_martin_dashboard || null);
      setGhActiveSteps(d.gh_active_steps || {});
      if (d.carry_pnl) { setCumPnL({ ...d.carry_pnl, user_a: d.carry_pnl.user_a || 0, user_z: d.carry_pnl.user_z || 0 }); setCarryPnL(d.carry_pnl); }
      else { setCumPnL({ mh: 0, gh: 0, user_a: 0, user_z: 0 }); setCarryPnL({ mh: 0, gh: 0 }); }
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
      <Box sx={{ display: "flex", alignItems: "center", gap: isMobile ? 0.4 : 0.5, mb: 1, flexWrap: "wrap" }}>
        {/* 마틴A/Z 위아래 */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.3 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <Box sx={{ borderRadius: 1, px: isMobile ? 0.6 : 1, py: 0.2, backgroundColor: "#1565c0", display: "flex", alignItems: "center", justifyContent: "center", minWidth: isMobile ? 36 : 48 }}>
              <Typography variant="caption" sx={{ fontSize: isMobile ? 9 : 11, fontWeight: "bold", color: "#fff" }}>마틴A</Typography>
            </Box>
            <Box sx={{ border: "1px solid rgba(255,255,255,0.3)", borderRadius: 1, px: isMobile ? 1 : 2, py: 0.2, minWidth: isMobile ? 80 : 140, display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
              <Typography variant="caption" sx={{ fontSize: isMobile ? 10 : 12, fontWeight: "bold", color: "#4caf50" }}>
                {userMartin?.martin_a?.amount ? `${userMartin.martin_a.amount.toLocaleString()}${userMartin.martin_a.direction || ""}` : "0"}
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <Box sx={{ borderRadius: 1, px: isMobile ? 0.6 : 1, py: 0.2, backgroundColor: "#c62828", display: "flex", alignItems: "center", justifyContent: "center", minWidth: isMobile ? 36 : 48 }}>
              <Typography variant="caption" sx={{ fontSize: isMobile ? 9 : 11, fontWeight: "bold", color: "#fff" }}>마틴Z</Typography>
            </Box>
            <Box sx={{ border: "1px solid rgba(255,255,255,0.3)", borderRadius: 1, px: isMobile ? 1 : 2, py: 0.2, minWidth: isMobile ? 80 : 140, display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
              <Typography variant="caption" sx={{ fontSize: isMobile ? 10 : 12, fontWeight: "bold", color: "#4caf50" }}>
                {userMartin?.martin_z?.amount ? `${userMartin.martin_z.amount.toLocaleString()}${userMartin.martin_z.direction || ""}` : "0"}
              </Typography>
            </Box>
          </Box>
        </Box>

        <Box sx={{ width: "1px", height: 28, backgroundColor: "rgba(255,255,255,0.2)", mx: 0.3 }} />

        {/* 픽이미지 A/Z 2개 */}
        {(() => {
          const umA = userMartin?.martin_a;
          const umZ = userMartin?.martin_z;
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
        <Box sx={{ width: isMobile ? 32 : 16 }} />
        {/* del */}
        <Box
          onClick={results.length > 0 && !processing ? handleDeleteOne : undefined}
          sx={{ ...controlBtnSx, cursor: processing ? "not-allowed" : results.length > 0 ? "pointer" : "default", opacity: processing ? 0.4 : results.length > 0 ? 1 : 0.4, pointerEvents: processing ? "none" : "auto" }}
        >
          <Typography variant="caption" sx={{ fontSize: isMobile ? 10 : 13 }}>del</Typography>
        </Box>
        <Box sx={{ width: isMobile ? 8 : 12 }} />
        {/* next */}
        <Box
          onClick={results.length > 0 && !processing ? () => setShowNextConfirm(true) : undefined}
          sx={{ ...controlBtnSx, cursor: processing ? "not-allowed" : results.length > 0 ? "pointer" : "default", opacity: processing ? 0.4 : results.length > 0 ? 1 : 0.4, pointerEvents: processing ? "none" : "auto", border: "2px solid rgba(255,255,255,0.3)" }}
        >
          <Typography variant="caption" sx={{ fontSize: isMobile ? 10 : 12 }}>next</Typography>
        </Box>
        <Box sx={{ width: isMobile ? 8 : 12 }} />
        {/* new */}
        <Box onClick={!processing ? handleNewGame : undefined} sx={{ ...controlBtnSx, cursor: processing ? "not-allowed" : "pointer", opacity: processing ? 0.4 : 1, pointerEvents: processing ? "none" : "auto", border: "2px solid #2196f3" }}>
          <Typography variant="caption" sx={{ fontSize: isMobile ? 10 : 12, color: "#2196f3" }}>new</Typography>
        </Box>
        <Box sx={{ width: isMobile ? 8 : 12 }} />
        {/* 셋업 (유저 설정) */}
        <Box onClick={() => navigate(`/mhgame/user-setup${gameId ? `?gameId=${gameId}` : ""}`)} sx={{ ...controlBtnSx, cursor: "pointer", border: "2px solid #ff9800" }}>
          <Typography variant="caption" sx={{ fontSize: isMobile ? 9 : 11, color: "#ff9800", fontWeight: "bold" }}>셋업</Typography>
        </Box>
      </Box>

      {/* 상단 PnL 요약 바 (마틴A/Z) */}
      {(() => {
        const gh = betData?.gh_summary || betData?.globalhit;
        const ghHasBet = (gh?.P || 0) + (gh?.B || 0) > 0;
        const umA = userMartin?.martin_a;
        const umZ = userMartin?.martin_z;
        const umAHasBet = (umA?.amount || 0) > 0;
        const umZHasBet = (umZ?.amount || 0) > 0;
        const aDirRaw = umA?.direction || "wait";
        const zDirRaw = umZ?.direction || "wait";
        const sumA = (cumPnL.user_a || 0) + (cumPnL.gh || 0);
        const sumZ = (cumPnL.user_z || 0) + (cumPnL.gh || 0);
        const pnlClr = (v) => v > 0 ? "#4caf50" : v < 0 ? "#f44336" : "#fff";
        const pnlText = (v) => `${v > 0 ? "+" : ""}${v.toLocaleString()}P`;
        const fs = isMobile ? 9 : 11;
        const barSx = { border: "1px solid rgba(255,255,255,0.3)", borderRadius: 2, px: isMobile ? 1 : 2, py: 0.3, display: "flex", alignItems: "center", justifyContent: "space-between", flex: 1 };
        const renderBar = (label, fDir, martinPnl, martinActive, ghPnl, total) => (
          <Box sx={{ display: "flex", gap: 0.5, flex: 1 }}>
            <Box sx={{ ...barSx, minWidth: 0, justifyContent: "center" }}>
              <Typography variant="caption" sx={{ fontSize: fs, fontWeight: "bold", color: "#fff" }}>{`formal(${fDir})`}</Typography>
            </Box>
            <Box sx={{ ...barSx, border: `1px solid ${martinActive ? "rgba(255,255,255,0.3)" : "#333"}` }}>
              <Typography variant="caption" sx={{ fontSize: fs, fontWeight: "bold", color: "#fff" }}>{label}</Typography>
              <Typography variant="caption" sx={{ fontSize: fs, fontWeight: "bold", color: pnlClr(martinPnl) }}>{pnlText(martinPnl)}</Typography>
            </Box>
            <Box sx={{ ...barSx, border: `1px solid ${ghHasBet ? "rgba(255,255,255,0.3)" : "#333"}` }}>
              <Typography variant="caption" sx={{ fontSize: fs, fontWeight: "bold", color: "#fff" }}>GH</Typography>
              <Typography variant="caption" sx={{ fontSize: fs, fontWeight: "bold", color: pnlClr(ghPnl) }}>{pnlText(ghPnl)}</Typography>
            </Box>
            <Box sx={{ backgroundColor: "#00bcd4", borderRadius: 2, px: isMobile ? 1 : 2, py: 0.3, display: "flex", alignItems: "center", justifyContent: "flex-end", flex: 1 }}>
              <Typography variant="caption" sx={{ fontSize: fs, fontWeight: "bold", color: total < 0 ? "#f44336" : "#000" }}>{pnlText(total)}</Typography>
            </Box>
          </Box>
        );
        return (
          <Box sx={{ display: "flex", gap: isMobile ? 0.5 : 1, mb: 0.5 }}>
            {renderBar("마틴A", aDirRaw, cumPnL.user_a || 0, umAHasBet, cumPnL.gh || 0, sumA)}
            {renderBar("마틴Z", zDirRaw, cumPnL.user_z || 0, umZHasBet, cumPnL.gh || 0, sumZ)}
          </Box>
        );
      })()}

      {/* ===== 대시보드 (어드민만) ===== */}
      {isAdmin && (<>
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
          {/* 상황판 테이블 */}
          <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, mb: 0.5 }}>
          {(() => {
            const anyBet = (nc?.amount || 0) > 0 || (gh?.P || 0) + (gh?.B || 0) > 0;
            return (
          <table style={{ borderCollapse: "collapse", width: "fit-content", marginBottom: 12, filter: anyBet ? "none" : "grayscale(100%)", opacity: anyBet ? 1 : 0.8 }}>
            <tbody>
              {/* 0행: MH 단계 */}
              <tr>
                <td style={{ ...dcB, color: "#ff9800" }}>MH단계</td>
                <td style={{ ...dcB, color: (nc?.step || 0) > 1 ? "#f44336" : "#fff" }}>{`M${nc?.step || 0}`}</td>
                <td colSpan={10} style={dc}></td>
              </tr>
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
                    <td colSpan={3} style={dc}></td>
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
          </Box>

          {/* ===== formal / reverse 예측 그리드 ===== */}
          {(() => {
            const PRED_COLS = 30;
            const cellSz = isMobile ? 16 : 26;
            const predCircle = (color) => ({
              width: cellSz - 4, height: cellSz - 4, borderRadius: "50%",
              backgroundColor: color,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontSize: isMobile ? 8 : 10, fontWeight: "bold",
            });

            const formalData = mhGrids?.formal || [];
            const reverseData = mhGrids?.reverse || [];

            const currentMethod = pickResult.method || "formal";
            const renderGrid = (label, data, gridColor, formalRef) => {
              const isActive = currentMethod === label;
              return (
              <Box sx={{ mb: 1 }}>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.3, width: PRED_COLS * (cellSz + 1) + 1 }}>
                  <Box sx={{ border: `2px solid ${isActive ? "#4caf50" : "rgba(255,255,255,0.3)"}`, borderRadius: 1, px: 1.5, py: 0.2, backgroundColor: isActive ? "rgba(76,175,80,0.15)" : "transparent" }}>
                    <Typography variant="caption" sx={{ fontSize: isMobile ? 10 : 12, color: isActive ? "#4caf50" : "#666", fontWeight: isActive ? "bold" : "normal" }}>{label}</Typography>
                  </Box>
                  {label === "formal" && (
                    <Box onClick={isAdmin ? () => {
                      const val = prompt("참조 게임 번호 입력 (빈값=랜덤)", refGameSeq || "");
                      if (val === null) return;
                      const seq = val.trim() ? parseInt(val.trim(), 10) : null;
                      if (val.trim() && isNaN(seq)) return;
                      const doStart = async () => {
                        if (gameId && results.length > 0) {
                          try { await apiCaller.post(MH_GAMES_API.END, null, { params: { game_id: gameId } }); } catch {}
                        }
                        resetAll();
                        await startGame(seq || undefined);
                      };
                      doStart();
                    } : undefined} sx={{ border: "1px solid rgba(255,255,255,0.3)", borderRadius: 1, px: 2, py: 0.2, minWidth: isMobile ? 60 : 80, textAlign: "right", ...(isAdmin && { cursor: "pointer", "&:hover": { borderColor: "#4caf50" } }) }}>
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
            <Box sx={{ display: "grid", gridTemplateColumns: `repeat(11, ${isMobile ? 22 : 28}px)`, gap: "1px", backgroundColor: "#555", border: "1px solid #555" }}>
              {Array.from({ length: 11 }).map((_, i) => {
                const ch = src?.prev_picks?.[i];
                const sz = isMobile ? 16 : 22;
                return (
                  <Box key={`pp-${i}`} sx={{ width: isMobile ? 22 : 28, height: isMobile ? 22 : 28, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#1a1a1a" }}>
                    {ch && (<Box sx={{ width: sz, height: sz, borderRadius: "50%", backgroundColor: ch === "P" ? "#1565c0" : "#f44336", display: "flex", alignItems: "center", justifyContent: "center", fontSize: isMobile ? 9 : 11, fontWeight: "bold", color: "#fff" }}>{ch}</Box>)}
                  </Box>
                );
              })}
            </Box>
            <Box sx={{ width: 8 }} />
            <Box sx={{ border: "1px solid #888", borderRadius: 1, px: 1, py: 0.3, backgroundColor: "rgba(255,255,255,0.08)", minWidth: 50, textAlign: "center" }}>
              <Typography variant="caption" sx={{ fontSize: isMobile ? 10 : 12, color: "#ccc" }}>{src?.code1 || "?"}-{src?.code2 || "?"}</Typography>
            </Box>
            <Box sx={{ width: 8 }} />
            <Box sx={{ border: "1px solid #888", borderRadius: 1, px: 1, py: 0.3, backgroundColor: "rgba(255,255,255,0.08)", minWidth: 40, textAlign: "center" }}>
              <Typography variant="caption" sx={{ fontSize: isMobile ? 10 : 12, color: "#ffd54f", fontWeight: "bold" }}>{src?.nickname || "-"}</Typography>
            </Box>
            <Box sx={{ width: 8 }} />
            <Box sx={{ width: isMobile ? 24 : 30, height: isMobile ? 24 : 30, border: "1px solid #555", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#1a1a1a" }}>
              <Box sx={{ width: isMobile ? 18 : 24, height: isMobile ? 18 : 24, borderRadius: "50%", backgroundColor: dispPick === "P" ? "#1565c0" : dispPick === "B" ? "#f44336" : "#555", display: "flex", alignItems: "center", justifyContent: "center", fontSize: isMobile ? 10 : 13, fontWeight: "bold", color: "#fff" }}>{dispNum}</Box>
            </Box>
          </Box>
        );
      })()}

      {/* ===== 하단: GlobalHit 패턴 요약 ===== */}
      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
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
      </>)}

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
          <Typography>carry-over 없이 새 게임을 시작합니다.</Typography>
          <Typography>계속하시겠습니까?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setShowNewConfirm(false); if (searchParams.get("new")) setSearchParams(gameId ? { gameId } : {}, { replace: true }); }}>취소</Button>
          <Button onClick={handleNewGameConfirm} variant="contained">확인</Button>
        </DialogActions>
      </Dialog>

      {/* 목표금액 도달 팝업 */}
      <Dialog open={goalDialog.open} onClose={() => setGoalDialog({ open: false, msgs: [] })}>
        <DialogTitle sx={{ fontWeight: "bold" }}>목표금액 도달</DialogTitle>
        <DialogContent>
          <Typography>목표금액에 도달하여 배팅이 정지됩니다.</Typography>
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
