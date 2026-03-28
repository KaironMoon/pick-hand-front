import React, { useState, useEffect, useCallback, useRef } from "react";
import { Box, Typography, useMediaQuery, useTheme, Dialog, DialogTitle, DialogContent, DialogActions, Button } from "@mui/material";
import { useNavigate, useSearchParams } from "react-router-dom";
import apiCaller from "@/services/api-caller";

const GRID_ROWS = 6;
const GRID_COLS = 40;

// 격자 셀 배경색: hit=형광색, miss=노란색, wait=흰색
const CELL_BG = {
  hit: "#00e676",
  miss: "#ffeb3b",
  wait: "#ffffff",
};

// 원 컴포넌트
const Circle = ({ type, filled = true, size = 24, label }) => {
  const colors = { P: "#1565c0", B: "#f44336" };
  const display = label != null ? label : type;
  return (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: "50%",
        backgroundColor: filled ? colors[type] : "#fff",
        border: "3px solid",
        borderColor: colors[type],
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: label != null ? size * 0.4 : size * 0.5,
        fontWeight: "bold",
        color: filled ? "#fff" : colors[type],
      }}
    >
      {display}
    </Box>
  );
};

// 빅로드 격자 계산 (status: hit/miss/wait 포함)
const calculateCircleGrid = (results) => {
  const grid = Array(GRID_ROWS)
    .fill(null)
    .map(() => Array(GRID_COLS).fill(null));

  if (!results || results.length === 0) return grid;

  let col = 0;
  let row = 0;
  let prevValue = null;
  let verticalStartCol = 0;
  let isBent = false;

  for (let i = 0; i < results.length; i++) {
    const current = results[i].value;
    const status = results[i].status || "wait";

    if (prevValue === null) {
      grid[row][col] = { type: current, status, idx: i };
      verticalStartCol = col;
    } else if (current === prevValue) {
      if (isBent) {
        col++;
      } else if (row >= GRID_ROWS - 1) {
        col++;
        isBent = true;
      } else if (grid[row + 1][col]) {
        col++;
        isBent = true;
      } else {
        row++;
      }
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


// 공통 스타일
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

const settingGroupSx = {
  border: "1px solid rgba(255,255,255,0.15)",
  borderRadius: 1,
  px: 0.8,
  py: 0.3,
  backgroundColor: "background.paper",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 0.2,
};

const stepBtnSx = {
  width: 18,
  height: 18,
  border: "1px solid rgba(255,255,255,0.3)",
  borderRadius: 0.5,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 12,
  cursor: "pointer",
  color: "text.secondary",
  "&:hover": { backgroundColor: "rgba(255,255,255,0.1)" },
};

export default function GamePage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [results, setResults] = useState([]);
  const [pickResult, setPickResult] = useState({ method: "wait", pick: null });
  const [globalhitData, setGlobalhitData] = useState([]);
  const [betData, setBetData] = useState(null);
  const [gameId, setGameId] = useState(null);
  const [cumPnL, setCumPnL] = useState({ tn: 0, gh: 0, pinch: 0 });
  const [carryPnL, setCarryPnL] = useState({ tn: 0, gh: 0, pinch: 0 }); // next game 이월분
  const [toggles, setToggles] = useState({
    nor1: true,
    m1: true,
    ham: false,
    bk: false,
  });
  const [mode, setMode] = useState("STD"); // STD or PTN
  const [line, setLine] = useState(1); // 1~4 LINE
  const [winLoss, setWinLoss] = useState("2W-0W"); // 승패 표시

  // 개별 메서드 매칭 여부 (UI 인디케이터용)

  // ED 종료 모드
  const [endingMode, setEndingMode] = useState(false);
  const [endingSnapshot, setEndingSnapshot] = useState(null); // { tn: bool, gh: Set<"PPP-0">, pinch: Set<"pattern"> }
  const [endingDone, setEndingDone] = useState(false); // 팝업 표시용
  const [showNextConfirm, setShowNextConfirm] = useState(false);
  const [showNewConfirm, setShowNewConfirm] = useState(false);
  const [resumeGame, setResumeGame] = useState(null);
  const processingRef = useRef(false); // API 호출 중 잠금 (연타 방지)

  const currentTurn = results.length + 1;
  const grid = calculateCircleGrid(results);

  // 픽 이미지 결정
  // combined direction (서버에서 TN+GH+핀치 합산)
  const displayPick = betData?.combined?.direction && betData.combined.direction !== "wait" ? betData.combined.direction : null;
  const pickImage = displayPick === "P" ? "/player.png" : displayPick === "B" ? "/banker.png" : "/wait.png";

  // 게임 시작
  const startGame = useCallback(async () => {
    try {
      const res = await apiCaller.post("/api/v1/games/start");
      setGameId(res.data.game_id);
      setSearchParams({ gameId: res.data.game_id }, { replace: true });
      // 초기 픽 조회
      const pickRes = await apiCaller.post("/api/v1/pick", { seq: "" });
      const { globalhit, bet, user_martin, ...pick } = pickRes.data;
      setPickResult(pick);
      setGlobalhitData(globalhit || []);
      setBetData(bet ? { ...bet, user_martin } : null);
    } catch (err) {
      console.error("Failed to start game:", err);
    }
  }, []);

  const restoreGame = async (gid) => {
    try {
      const res = await apiCaller.get(`/api/v1/games/${gid}/state`);
      const data = res.data;
      setGameId(data.game_id);
      setResults(data.results || []);
      setCumPnL(data.cum_pnl || { tn: 0, gh: 0, pinch: 0 });
      const { globalhit, bet, user_martin, results: _, cum_pnl: __, game_id: ___, config: ____, status, ending_snapshot: snap, ...pick } = data;
      setPickResult({ method: pick.method, pick: pick.pick, match_start: pick.match_start, match_end: pick.match_end, matches: pick.matches, order: pick.order });
      setGlobalhitData(globalhit || []);
      setBetData(bet ? { ...bet, user_martin } : null);
      if (status === "ending" && snap) {
        setEndingMode(true);
        setEndingSnapshot({
          tn: snap.tn || false,
          gh: new Set(snap.gh || []),
          pinch: new Set(snap.pinch || []),
        });
      }
    } catch (err) {
      console.error("Failed to restore game, starting new:", err);
      startGame();
    }
  };

  // 페이지 로드 시 게임 시작 또는 복원
  useEffect(() => {
    let cancelled = false;
    const urlGameId = searchParams.get("gameId");
    const isNew = searchParams.get("new");
    if (isNew) {
      // 메뉴에서 새 게임 요청
      setSearchParams({}, { replace: true });
      handleNewGame();
    } else if (urlGameId) {
      // URL에 gameId가 있으면 게임 상태 복원 시도
      restoreGame(parseInt(urlGameId));
    } else {
      // 직전 게임이 active면 복원 여부 확인
      apiCaller.get("/api/v1/games/last-active").then(async (res) => {
        if (cancelled) return;
        const game = res.data?.game;
        if (game && game.round_count > 0) {
          setResumeGame(game);
        } else {
          if (game) {
            try { await apiCaller.post("/api/v1/games/end", null, { params: { game_id: game.game_id } }); } catch {}
          }
          if (!cancelled) startGame();
        }
      }).catch(() => { if (!cancelled) startGame(); });
    }
    return () => { cancelled = true; };
  }, [searchParams.get("new")]); // eslint-disable-line react-hooks/exhaustive-deps

  // P/B 입력 → 서버에 라운드 기록 + 다음 상태 수신
  const handleInput = async (inputValue) => {
    if (!gameId || processingRef.current) return;
    processingRef.current = true;

    let status = "wait";
    if (pickResult.pick) {
      status = pickResult.pick === inputValue ? "hit" : "miss";
    }
    const newResult = { value: inputValue, status };
    const newResults = [...results, newResult];
    setResults(newResults);

    try {
      const res = await apiCaller.post("/api/v1/games/round", {
        game_id: gameId,
        actual: inputValue,
      });
      const data = res.data;

      // 서버에서 받은 누적 P&L
      setCumPnL({
        tn: data.cum_pnl.tn,
        gh: data.cum_pnl.gh,
        pinch: data.cum_pnl.pinch,
      });

      // 다음 라운드 상태 갱신
      const { globalhit, bet, user_martin: um, ...pick } = data;
      setPickResult({ method: pick.method, pick: pick.pick, match_start: pick.match_start, match_end: pick.match_end, matches: pick.matches, order: pick.order });
      setGlobalhitData(globalhit || []);
      setBetData(bet ? { ...bet, user_martin: um } : null);

      // 종료 모드: 모든 추적 배팅이 step 1로 돌아왔는지 체크
      if (endingMode && endingSnapshot) {
        if (checkEndingComplete(data)) {
          setEndingDone(true);
          setBetData(null);
        }
      }
    } catch (err) {
      console.error("Failed to record round:", err);
      setResults((prev) => prev.slice(0, -1));
      alert("서버 오류로 입력이 반영되지 않았습니다. 다시 시도해주세요.");
    } finally {
      processingRef.current = false;
    }
  };

  // 마지막 1개 삭제 (서버 + 프론트 동기화)
  const handleDeleteOne = useCallback(async () => {
    if (results.length === 0 || !gameId || processingRef.current) return;
    processingRef.current = true;

    try {
      const res = await apiCaller.delete(`/api/v1/games/${gameId}/last-round`);
      const data = res.data;

      setResults(results.slice(0, -1));
      setCumPnL({
        tn: data.cum_pnl.tn,
        gh: data.cum_pnl.gh,
        pinch: data.cum_pnl.pinch,
      });

      const { globalhit, bet, user_martin: um2, status, ending_snapshot: snap, ...pick } = data;
      setPickResult({ method: pick.method, pick: pick.pick, match_start: pick.match_start, match_end: pick.match_end, matches: pick.matches, order: pick.order });
      setGlobalhitData(globalhit || []);
      setBetData(bet ? { ...bet, user_martin: um2 } : null);

      // 엔딩 시점 이전으로 삭제되면 엔딩 모드 해제
      if (status === "active") {
        setEndingMode(false);
        setEndingSnapshot(null);
      }
    } catch (err) {
      console.error("Failed to delete round:", err);
    } finally {
      processingRef.current = false;
    }
  }, [results, gameId]);

  // ED: 종료 모드 진입
  const handleEndingMode = async () => {
    if (endingMode) return; // 이미 종료 모드
    if (!betData) return;

    const tn = betData.triplenine;
    const gh = betData.globalhit;
    const pinch = betData.pinch;

    // 스냅샷: step > 1인 배팅만 추적
    const snapshot = { tn: false, gh: new Set(), pinch: new Set() };

    // 트리플나인
    if (tn && tn.step > 1) {
      snapshot.tn = true;
    }

    // 글로벌히트: 각 패턴×섹션
    if (gh?.details) {
      gh.details.forEach((d) => {
        if (d.step > 1) {
          snapshot.gh.add(`${d.pattern}-${d.group}`);
        }
      });
    }

    // 핀치: 각 방법
    if (pinch?.methods) {
      Object.entries(pinch.methods).forEach(([method, m]) => {
        if (m.step > 1) {
          snapshot.pinch.add(method);
        }
      });
    }

    // 모든 배팅이 이미 step 1이면 즉시 종료
    if (!snapshot.tn && snapshot.gh.size === 0 && snapshot.pinch.size === 0) {
      handleFinishGame();
      return;
    }

    // 서버에 엔딩 모드 진입 기록
    try {
      await apiCaller.post("/api/v1/games/ending", {
        game_id: gameId,
        snapshot: {
          tn: snapshot.tn,
          gh: [...snapshot.gh],
          pinch: [...snapshot.pinch],
        },
      });
    } catch (err) {
      console.error("Failed to start ending:", err);
    }

    setEndingMode(true);
    setEndingSnapshot(snapshot);
  };

  // 종료 모드에서 라운드 후 체크: 모든 추적 배팅이 step 1로 돌아왔는지
  const checkEndingComplete = (data) => {
    if (!endingSnapshot) return false;

    const tn = data.bet?.triplenine;
    const gh = data.bet?.globalhit;
    const pinch = data.bet?.pinch;

    // TN 체크
    if (endingSnapshot.tn && tn && tn.step > 1) return false;

    // GH 체크
    if (gh?.details) {
      for (const key of endingSnapshot.gh) {
        const [pat, grp] = key.split("-");
        const d = gh.details.find((x) => x.pattern === pat && x.group === parseInt(grp));
        if (d && d.step > 1) return false;
      }
    }

    // Pinch 체크
    if (pinch?.methods) {
      for (const method of endingSnapshot.pinch) {
        const m = pinch.methods[method];
        if (m && m.step > 1) return false;
      }
    }

    return true;
  };

  // 게임 완전 종료 + 새 게임
  const handleFinishGame = async () => {
    if (gameId) {
      try {
        await apiCaller.post("/api/v1/games/end", null, { params: { game_id: gameId } });
      } catch (err) {
        console.error("Failed to end game:", err);
      }
    }
    setEndingMode(false);
    setEndingSnapshot(null);
    setEndingDone(false);
    setResults([]);
    setCumPnL({ tn: 0, gh: 0, pinch: 0 });
    setCarryPnL({ tn: 0, gh: 0, pinch: 0 });
    setBetData(null);
    setPickResult({ method: "wait", pick: null });

    setGlobalhitData([]);
    setSearchParams({}, { replace: true });
    startGame();
  };

  // new game: 확인 대화상자 후 carry_over 없이 새 게임 시작
  const handleNewGameConfirm = async () => {
    setShowNewConfirm(false);
    if (searchParams.get("new")) setSearchParams({}, { replace: true });
    await handleNewGame();
  };

  const handleNewGame = async () => {
    if (gameId && results.length > 0) {
      try {
        await apiCaller.post("/api/v1/games/end", null, { params: { game_id: gameId } });
      } catch (err) {
        console.error("Failed to end game:", err);
      }
    }

    setEndingMode(false);
    setEndingSnapshot(null);
    setEndingDone(false);
    setResults([]);
    setCumPnL({ tn: 0, gh: 0, pinch: 0 });
    setCarryPnL({ tn: 0, gh: 0, pinch: 0 });
    setBetData(null);
    setPickResult({ method: "wait", pick: null });
    setGlobalhitData([]);

    await startGame();
  };

  // next game: 서버가 carry-over를 자체 구성하여 처리
  const handleNextGame = async () => {
    if (!gameId) return;

    try {
      const res = await apiCaller.post("/api/v1/games/next", null, { params: { game_id: gameId } });

      // 상태 초기화
      setEndingDone(false);
      setResults([]);
      setBetData(null);
      setPickResult({ method: "wait", pick: null });
      setGlobalhitData([]);

      setGameId(res.data.game_id);
      setSearchParams({ gameId: res.data.game_id }, { replace: true });

      // PnL 이월 복원
      if (res.data.carry_pnl) {
        setCumPnL(res.data.carry_pnl);
        setCarryPnL(res.data.carry_pnl);
      } else {
        setCumPnL({ tn: 0, gh: 0, pinch: 0 });
        setCarryPnL({ tn: 0, gh: 0, pinch: 0 });
      }

      // 엔딩 모드 복원
      if (res.data.status === "ending" && res.data.ending_snapshot) {
        const snap = res.data.ending_snapshot;
        setEndingMode(true);
        setEndingSnapshot({
          tn: snap.tn,
          gh: new Set(snap.gh || []),
          pinch: new Set(snap.pinch || []),
        });
      } else {
        setEndingMode(false);
        setEndingSnapshot(null);
      }

      // 초기 픽 조회
      const pickRes = await apiCaller.post("/api/v1/pick", { seq: "" });
      const { globalhit, bet, user_martin: um3, ...pick } = pickRes.data;
      setPickResult(pick);
      setGlobalhitData(globalhit || []);
      setBetData(bet ? { ...bet, user_martin: um3 } : null);
    } catch (err) {
      console.error("Failed to next game:", err);
    }
  };

  return (
    <Box sx={{ p: isMobile ? 0.5 : 2 }}>
      <Box sx={{ mb: 1, display: "flex", alignItems: "baseline", gap: 1 }}>
        <span style={{ fontSize: 14, fontWeight: "bold", color: "#fff" }}>트리플나인</span>
        {gameId && <span style={{ fontSize: 11, color: "#888" }}>#{gameId}</span>}
      </Box>
      {/* ===== 상단: 6x40 빅로드 격자 ===== */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: `repeat(${GRID_COLS}, ${isMobile ? 16 : 26}px)`,
          gridTemplateRows: `repeat(${GRID_ROWS}, ${isMobile ? 16 : 26}px)`,
          gap: "1px",
          mb: 2,
          backgroundColor: "#616161",
          border: "1px solid #616161",
          width: "fit-content",
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
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: cell ? (CELL_BG[cell.status] || "background.default") : "background.default",
                  ...(isLscMatch && { border: "2px solid #4caf50", borderRadius: "2px" }),
                }}
              >
                {cell && (
                  <Circle
                    type={cell.type}
                    filled={true}
                    size={isMobile ? 12 : 22}
                    label={cell.idx + 1}
                  />
                )}
              </Box>
            );
          })
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
                {betData?.user_martin?.martin_a?.total_P || betData?.user_martin?.martin_a?.total_B ? `${((betData.user_martin.martin_a.total_P || 0) + (betData.user_martin.martin_a.total_B || 0)).toLocaleString()}P` : "0P"}
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
                {betData?.user_martin?.martin_z?.amount ? `${betData.user_martin.martin_z.amount.toLocaleString()}P` : "0P"}
              </Typography>
            </Box>
          </Box>
        </Box>

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
            color: "#fff", fontSize: isMobile ? 16 : 24, fontWeight: "bold", cursor: "pointer",
            "&:hover": { opacity: 0.85 }, "&:active": { transform: "scale(0.95)" },
          }}
        >P</Box>
        <Box
          onClick={() => handleInput("B")}
          sx={{
            width: isMobile ? 38 : 55, height: isMobile ? 38 : 55, borderRadius: 2,
            backgroundColor: "#f44336", display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontSize: isMobile ? 16 : 24, fontWeight: "bold", cursor: "pointer",
            "&:hover": { opacity: 0.85 }, "&:active": { transform: "scale(0.95)" },
          }}
        >B</Box>

        {/* del/next/new/셋업 */}
        <Box
          onClick={results.length > 0 ? handleDeleteOne : undefined}
          sx={{ ...controlBtnSx, cursor: results.length > 0 ? "pointer" : "default", opacity: results.length > 0 ? 1 : 0.4 }}
        >
          <Typography variant="caption" sx={{ fontSize: isMobile ? 10 : 13 }}>del</Typography>
        </Box>
        <Box
          onClick={results.length > 0 ? () => setShowNextConfirm(true) : undefined}
          sx={{ ...controlBtnSx, cursor: results.length > 0 ? "pointer" : "default", opacity: results.length > 0 ? 1 : 0.4, border: "2px solid rgba(255,255,255,0.3)" }}
        >
          <Typography variant="caption" sx={{ fontSize: isMobile ? 10 : 12 }}>next</Typography>
        </Box>
        <Box
          onClick={() => setShowNewConfirm(true)}
          sx={{ ...controlBtnSx, cursor: "pointer", border: "2px solid #2196f3" }}
        >
          <Typography variant="caption" sx={{ fontSize: isMobile ? 10 : 12, color: "#2196f3" }}>new</Typography>
        </Box>
        <Box
          onClick={() => navigate(`/t9game/user-setup${gameId ? `?gameId=${gameId}` : ""}`)}
          sx={{ ...controlBtnSx, cursor: "pointer", border: "2px solid #ff9800" }}
        >
          <Typography variant="caption" sx={{ fontSize: isMobile ? 10 : 12, color: "#ff9800", fontWeight: "bold" }}>셋업</Typography>
        </Box>
      </Box>

      {/* ===== 대시보드 (단일 12열 테이블) ===== */}
      {(() => {
        const tn = betData?.triplenine;
        const gh = betData?.globalhit;
        const combined = betData?.combined;
        const pinch = betData?.pinch;
        const pinchActive = pinch?.active || false;
        const pinchMethods = pinch?.methods || {};
        const combinedDir = combined?.direction || "wait";
        const dirColor = combinedDir === "P" ? "#1565c0" : combinedDir === "B" ? "#f44336" : "#888";
        const totalBet = combined?.amount || 0;

        // 핀치 P/B 합산
        let pinchP = 0, pinchB = 0;
        Object.values(pinchMethods).forEach((m) => {
          if (m.direction === "P") pinchP += m.amount || 0;
          else if (m.direction === "B") pinchB += m.amount || 0;
        });

        const dc = { border: "1px solid #555", padding: isMobile ? "2px 4px" : "3px 12px", fontSize: isMobile ? 8 : 10, textAlign: "center", whiteSpace: "nowrap" };
        const dcB = { ...dc, fontWeight: "bold" };

        const ghPatterns = ["PPP", "BBB", "PBP", "BPB", "PPB", "BBP", "PBB", "BPP"];
        const ghLeft = ghPatterns.slice(0, 4);
        const ghRight = ghPatterns.slice(4, 8);
        const getPatSec = (pat, sec) => {
          const d = gh?.details?.find((x) => x.pattern === pat && x.group === sec + 1);
          return d ? d.amount : 0;
        };

        return (
          <>
          {/* 데스크톱: 상단 요약 바 */}
          {!isMobile && (
          <Box sx={{ display: "flex", alignItems: "stretch", gap: 0.5, mb: 0.5, flexWrap: "wrap" }}>
            <Box sx={{ border: "1px solid rgba(255,255,255,0.3)", borderRadius: 2, px: 1.5, display: "flex", alignItems: "center" }}>
              <Typography variant="caption" sx={{ fontSize: 11, fontWeight: "bold", color: dirColor }}>{`formal(${combinedDir})`}</Typography>
            </Box>
            {(() => {
              const tnHasBet = (betData?.triplenine?.amount || 0) > 0;
              const ghHasBet = (betData?.globalhit?.P || 0) + (betData?.globalhit?.B || 0) > 0;
              const pinchOn = betData?.pinch?.active || false;
              const items = [
                { name: "Triplenine", pnl: cumPnL.tn, active: tnHasBet },
                { name: "globalhit", pnl: cumPnL.gh, active: ghHasBet },
                { name: "pinch", pnl: cumPnL.pinch, active: pinchOn },
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
              const totalPnL = cumPnL.tn + cumPnL.gh + cumPnL.pinch;
              const sign = totalPnL > 0 ? "+" : "";
              return (
                <Box sx={{ px: 2, minWidth: 200, backgroundColor: "#00bcd4", borderRadius: 2, display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
                  <Typography variant="caption" sx={{ fontSize: 11, fontWeight: "bold", color: totalPnL < 0 ? "#f44336" : "#000" }}>{`${sign}${totalPnL.toLocaleString()}P`}</Typography>
                </Box>
              );
            })()}
          </Box>
          )}

          {/* 모바일: 우측 요약 패널 */}
          {isMobile && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, mb: 0.5 }}>
            {(() => {
              const tnHasBet = (betData?.triplenine?.amount || 0) > 0;
              const ghHasBet = (betData?.globalhit?.P || 0) + (betData?.globalhit?.B || 0) > 0;
              const pinchOn = betData?.pinch?.active || false;
              const totalPnL = cumPnL.tn + cumPnL.gh + cumPnL.pinch;
              const items = [
                { name: "formal", value: combinedDir, color: dirColor, isFormal: true },
                { name: "Triplenine", pnl: cumPnL.tn, active: tnHasBet },
                { name: "globalhit", pnl: cumPnL.gh, active: ghHasBet },
                { name: "pinch", pnl: cumPnL.pinch, active: pinchOn },
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

          </>
        );
      })()}

      {/* ED 종료 완료 팝업 */}
      {/* 새 게임 확인 대화상자 */}
      {/* 이전 게임 복원 확인 */}
      <Dialog open={!!resumeGame} onClose={async () => { const gid = resumeGame?.game_id; setResumeGame(null); if (gid) { try { await apiCaller.post("/api/v1/games/end", null, { params: { game_id: gid } }); } catch {} } startGame(); }}>
        <DialogTitle sx={{ fontWeight: "bold" }}>이전 게임 복원</DialogTitle>
        <DialogContent>
          <Typography>진행 중인 게임이 있습니다. (#{resumeGame?.game_id}, {resumeGame?.round_count}회차)</Typography>
          <Typography>이어서 하시겠습니까?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={async () => { const gid = resumeGame.game_id; setResumeGame(null); try { await apiCaller.post("/api/v1/games/end", null, { params: { game_id: gid } }); } catch {} startGame(); }}>새 게임</Button>
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
        <DialogTitle sx={{ fontWeight: "bold" }}>다음 게임</DialogTitle>
        <DialogContent>
          <Typography>현재 게임을 종료하고 다음 게임으로 넘어가시겠습니까?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowNextConfirm(false)}>취소</Button>
          <Button onClick={() => { setShowNextConfirm(false); handleNextGame(); }} variant="contained">확인</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={endingDone} onClose={() => {}}>
        <DialogTitle sx={{ fontWeight: "bold" }}>게임 종료</DialogTitle>
        <DialogContent>
          <Typography>모든 배팅이 완료되었습니다.</Typography>
          <Box sx={{ mt: 2 }}>
            {[
              { name: "Triplenine", pnl: cumPnL.tn },
              { name: "Globalhit", pnl: cumPnL.gh },
              { name: "Pinch", pnl: cumPnL.pinch },
            ].map((item) => (
              <Typography key={item.name} sx={{ color: item.pnl >= 0 ? "#4caf50" : "#f44336" }}>
                {item.name}: {item.pnl > 0 ? "+" : ""}{item.pnl.toLocaleString()}P
              </Typography>
            ))}
            <Typography sx={{ mt: 1, fontWeight: "bold", color: (cumPnL.tn + cumPnL.gh + cumPnL.pinch) >= 0 ? "#4caf50" : "#f44336" }}>
              Total: {(cumPnL.tn + cumPnL.gh + cumPnL.pinch) > 0 ? "+" : ""}{(cumPnL.tn + cumPnL.gh + cumPnL.pinch).toLocaleString()}P
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleFinishGame} variant="contained">새 게임 시작</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
