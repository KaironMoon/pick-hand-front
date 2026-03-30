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
  const [collapsedPatterns, setCollapsedPatterns] = useState({});
  const processingRef = useRef(false); // API 호출 중 잠금 (연타 방지)
  const [processing, setProcessing] = useState(false);

  const currentTurn = results.length + 1;
  const grid = calculateCircleGrid(results);

  // 픽 이미지 결정
  // combined direction (서버에서 TN+GH+핀치 합산)
  const displayPick = betData?.combined?.direction && betData.combined.direction !== "wait" ? betData.combined.direction : null;
  const pickImage = displayPick === "P" ? "/player.png" : displayPick === "B" ? "/banker.png" : "/wait.png";

  // 게임 시작
  const startGame = useCallback(async () => {
    try {
      const res = await apiCaller.post("/api/v1/games/start?mode=admin");
      setGameId(res.data.game_id);
      setSearchParams({ gameId: res.data.game_id }, { replace: true });
      // 초기 픽 조회
      const pickRes = await apiCaller.post("/api/v1/pick", { seq: "" });
      const { globalhit, bet, ...pick } = pickRes.data;
      setPickResult(pick);
      setGlobalhitData(globalhit || []);
      setBetData(bet || null);
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
      const { globalhit, bet, results: _, cum_pnl: __, game_id: ___, config: ____, status, ending_snapshot: snap, ...pick } = data;
      setPickResult({ method: pick.method, pick: pick.pick, match_start: pick.match_start, match_end: pick.match_end, matches: pick.matches, order: pick.order });
      setGlobalhitData(globalhit || []);
      setBetData(bet || null);
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
    const urlGameId = searchParams.get("gameId");
    const isNew = searchParams.get("new");
    if (isNew) {
      // 메뉴에서 새 게임 요청 — 바로 새 게임 시작
      const doNew = async () => {
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
      doNew();
      return;
    } else if (urlGameId) {
      // URL에 gameId가 있으면 게임 상태 복원 시도
      restoreGame(parseInt(urlGameId));
    } else {
      let cancelled = false;
      apiCaller.get("/api/v1/games/last-active?mode=admin").then(async (res) => {
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
      return () => { cancelled = true; };
    }
  }, [searchParams.get("new")]); // eslint-disable-line react-hooks/exhaustive-deps

  // P/B 입력 → 서버에 라운드 기록 + 다음 상태 수신
  const handleInput = async (inputValue) => {
    if (!gameId || processingRef.current) return;
    processingRef.current = true;
    setProcessing(true);

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
      if (data.round_num !== undefined && data.round_num !== results.length + 1) {
        alert("서버/클라이언트 불일치가 감지되어 페이지를 리로드합니다.");
        window.location.reload();
        return;
      }

      // 서버에서 받은 누적 P&L
      setCumPnL({
        tn: data.cum_pnl.tn,
        gh: data.cum_pnl.gh,
        pinch: data.cum_pnl.pinch,
      });

      // 다음 라운드 상태 갱신
      const { globalhit, bet, ...pick } = data;
      setPickResult({ method: pick.method, pick: pick.pick, match_start: pick.match_start, match_end: pick.match_end, matches: pick.matches, order: pick.order });
      setGlobalhitData(globalhit || []);
      setBetData(bet || null);

      // 종료 모드: 모든 추적 배팅이 step 1로 돌아왔는지 체크
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

  // 마지막 1개 삭제 (서버 + 프론트 동기화)
  const handleDeleteOne = useCallback(async () => {
    if (results.length === 0 || !gameId || processingRef.current) return;
    processingRef.current = true;
    setProcessing(true);

    try {
      const res = await apiCaller.delete(`/api/v1/games/${gameId}/last-round`);
      const data = res.data;

      setResults(results.slice(0, -1));
      setCumPnL({
        tn: data.cum_pnl.tn,
        gh: data.cum_pnl.gh,
        pinch: data.cum_pnl.pinch,
      });

      const { globalhit, bet, status, ending_snapshot: snap, ...pick } = data;
      setPickResult({ method: pick.method, pick: pick.pick, match_start: pick.match_start, match_end: pick.match_end, matches: pick.matches, order: pick.order });
      setGlobalhitData(globalhit || []);
      setBetData(bet || null);

      // 엔딩 시점 이전으로 삭제되면 엔딩 모드 해제
      if (status === "active") {
        setEndingMode(false);
        setEndingSnapshot(null);
      }
    } catch (err) {
      console.error("Failed to delete round:", err);
    } finally {
      processingRef.current = false;
      setProcessing(false);
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

    // 글로벌히트: 원본 데이터에서 전체 그룹의 step 확인
    if (globalhitData) {
      globalhitData.forEach((pat) => {
        pat.groups.forEach((g) => {
          if (g.step > 1) {
            snapshot.gh.add(`${pat.pattern}-${g.group + 1}`);
          }
        });
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

    // 모든 배팅이 이미 step 1이면 엔딩 진입 + 완료 팝업
    if (!snapshot.tn && snapshot.gh.size === 0 && snapshot.pinch.size === 0) {
      try {
        await apiCaller.post("/api/v1/games/ending", {
          game_id: gameId,
          snapshot: { tn: false, gh: [], pinch: [] },
        });
      } catch (err) {
        console.error("Failed to start ending:", err);
      }
      setEndingMode(true);
      setEndingSnapshot(snapshot);
      setEndingDone(true);
      return;
    }

    // 서버에 엔딩 모드 진입 기록 + 재계산된 상태 반영
    try {
      const res = await apiCaller.post("/api/v1/games/ending", {
        game_id: gameId,
        snapshot: {
          tn: snapshot.tn,
          gh: [...snapshot.gh],
          pinch: [...snapshot.pinch],
        },
      });
      const data = res.data;

      // 재계산된 픽/배팅/글로벌히트 반영
      const { globalhit, bet, game_id: _gid, status: _st, snapshot: _snap, ...pick } = data;
      setPickResult({ method: pick.method, pick: pick.pick, match_start: pick.match_start, match_end: pick.match_end, matches: pick.matches, order: pick.order });
      setGlobalhitData(globalhit || []);
      setBetData(bet || null);
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

    // GH 체크 — 원본 globalhitData에서 step 확인 (details는 필터링된 목록이라 누락 가능)
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

  // next / new game: 확인 대화상자
  const [showNextConfirm, setShowNextConfirm] = useState(false);
  const [showNewConfirm, setShowNewConfirm] = useState(false);
  const [resumeGame, setResumeGame] = useState(null);

  const handleNewGame = () => {
    setShowNewConfirm(true);
  };

  const handleNewGameConfirm = async () => {
    setShowNewConfirm(false);
    setProcessing(true);
    try {
      // ?new 파라미터 제거
      if (searchParams.get("new")) {
        setSearchParams({}, { replace: true });
      }
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
    } finally {
      setProcessing(false);
    }
  };

  // next game: 서버가 carry-over를 자체 구성하여 처리
  const handleNextGame = async () => {
    if (!gameId) return;
    setProcessing(true);

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
      const { globalhit, bet, ...pick } = pickRes.data;
      setPickResult(pick);
      setGlobalhitData(globalhit || []);
      setBetData(bet || null);
    } catch (err) {
      console.error("Failed to next game:", err);
    } finally {
      setProcessing(false);
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

      {/* ===== 중단: 인터페이스 (1단) ===== */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 1, flexWrap: "wrap" }}>
        {/* 상태 토글 */}
        {(() => {
          const tnActive = betData?.triplenine?.amount > 0;
          const pinchMain = betData?.pinch?.main_enable && betData?.pinch?.active;
          const isActive = tnActive || pinchMain;
          const isLsc = /^\d+LSC$/.test(pickResult.method || "");
          const isPattern = pickResult.method === "pattern" && pickResult.order;
          const methodLabel = isPattern ? `pat${pickResult.order}` : (pickResult.method || "wait");
          const borderColor = isActive ? (isLsc ? "#4caf50" : "#ff9800") : "#555";
          return (
            <Box sx={{ ...toggleBtnSx, border: `2px solid ${borderColor}`, width: isMobile ? 50 : 70, opacity: isActive ? 1 : 0.35, justifyContent: "center" }}>
              <Typography variant="caption" sx={{ fontSize: isMobile ? 9 : 11, fontWeight: "bold", color: borderColor }}>{methodLabel}</Typography>
            </Box>
          );
        })()}
        {(() => {
          const tnStep = betData?.triplenine?.step || 0;
          const tnActive = !betData?.pinch?.main_enable && betData?.triplenine?.amount > 0;
          const label = `M${tnStep}`;
          return (
            <Box sx={{ ...toggleBtnSx, border: `2px solid ${tnActive ? "#4caf50" : "#555"}`, opacity: tnActive ? 1 : 0.35 }}>
              <Typography variant="caption" sx={{ fontSize: isMobile ? 9 : 11, fontWeight: "bold", color: tnActive ? "#fff" : "#555" }}>{label}</Typography>
            </Box>
          );
        })()}
        {(() => {
          const ghHasBet = (betData?.globalhit?.P || 0) + (betData?.globalhit?.B || 0) > 0;
          return (
            <Box sx={{ ...toggleBtnSx, border: `2px solid ${ghHasBet ? "#4caf50" : "#555"}`, opacity: ghHasBet ? 1 : 0.35 }}>
              <Typography variant="caption" sx={{ fontSize: isMobile ? 9 : 11, fontWeight: "bold", color: ghHasBet ? "#fff" : "#555" }}>global</Typography>
            </Box>
          );
        })()}
        {(() => {
          const pinchOn = betData?.pinch?.active || false;
          return (
            <Box sx={{ ...toggleBtnSx, border: `2px solid ${pinchOn ? "#ff9800" : "#555"}`, opacity: pinchOn ? 1 : 0.35 }}>
              <Typography variant="caption" sx={{ fontSize: isMobile ? 9 : 11, fontWeight: "bold", color: pinchOn ? "#ff9800" : "#555" }}>pinch</Typography>
            </Box>
          );
        })()}
        <Box
          onClick={handleEndingMode}
          sx={{
            ...toggleBtnSx,
            backgroundColor: endingMode ? "#ff6f00" : "#b71c1c",
            borderRadius: 2,
            border: endingMode ? "2px solid #ffab00" : "none",
            px: isMobile ? 1 : 1.5,
            cursor: "pointer",
            animation: endingMode ? "pulse 1.5s infinite" : "none",
            "@keyframes pulse": { "0%": { opacity: 1 }, "50%": { opacity: 0.6 }, "100%": { opacity: 1 } },
          }}
        >
          <Typography variant="caption" sx={{ fontSize: isMobile ? 11 : 13, fontWeight: "bold", color: "#fff" }}>
            {endingMode ? "ED..." : "ED"}
          </Typography>
        </Box>
        <Box sx={{ ...toggleBtnSx, backgroundColor: "#1565c0", borderRadius: 2, border: "none", px: isMobile ? 1 : 1.5 }}>
          <Typography variant="caption" sx={{ fontSize: isMobile ? 11 : 13, fontWeight: "bold", color: "#fff" }}>BT</Typography>
        </Box>
        <Box sx={{ ...toggleBtnSx, border: "2px solid #4caf50", cursor: "default", px: isMobile ? 0.5 : 1.5, minWidth: isMobile ? 50 : 120, justifyContent: "flex-end" }}>
          <Typography variant="caption" sx={{ fontSize: isMobile ? 10 : 12, fontWeight: "bold", color: "#4caf50" }}>
            {betData?.combined ? `${betData.combined.amount.toLocaleString()}P` : "0P"}
          </Typography>
        </Box>

        {/* 구분선 */}
        <Box sx={{ width: "1px", height: 28, backgroundColor: "rgba(255,255,255,0.2)", mx: 0.3 }} />

        {/* 픽이미지 + 턴 + P/B + 컨트롤 */}
        <Box sx={{ width: isMobile ? 52 : 95, height: isMobile ? 52 : 95, border: "2px solid rgba(255,255,255,0.3)", borderRadius: 2, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <img src={pickImage} alt="pick" style={{ width: isMobile ? 46 : 85, height: isMobile ? 46 : 85, objectFit: "contain" }} />
        </Box>
        <Box
          sx={{
            width: isMobile ? 24 : 40,
            height: isMobile ? 24 : 40,
            border: "2px solid rgba(255,255,255,0.3)",
            borderRadius: 1,
            backgroundColor: "#333",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
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
        <Box sx={{ width: isMobile ? 32 : 0 }} />
        <Box
          onClick={results.length > 0 && !processing ? handleDeleteOne : undefined}
          sx={{ ...controlBtnSx, cursor: processing ? "not-allowed" : results.length > 0 ? "pointer" : "default", opacity: processing ? 0.4 : results.length > 0 ? 1 : 0.4, pointerEvents: processing ? "none" : "auto" }}
        >
          <Typography variant="caption" sx={{ fontSize: isMobile ? 10 : 13 }}>del</Typography>
        </Box>
        <Box onClick={() => navigate(`/t9game/setup${gameId ? `?gameId=${gameId}` : ""}`)} sx={{ ...controlBtnSx, cursor: "pointer", border: "2px solid rgba(255,255,255,0.3)" }}>
          <Typography variant="caption" sx={{ fontSize: isMobile ? 10 : 12 }}>set-up</Typography>
        </Box>
        <Box onClick={() => gameId ? navigate(`/t9game/current-setup?gameId=${gameId}`) : undefined} sx={{ ...controlBtnSx, cursor: gameId ? "pointer" : "default", opacity: gameId ? 1 : 0.4, border: "2px solid rgba(255,255,255,0.3)" }}>
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

          {/* 상황판 테이블 + 모바일 우측 요약 */}
          <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, mb: 0.5 }}>
          {(() => {
            const anyBet = (tn?.amount || 0) > 0 || (gh?.P || 0) + (gh?.B || 0) > 0 || pinchActive;
            return (
          <table style={{ borderCollapse: "collapse", width: "fit-content", marginBottom: 12, filter: anyBet ? "none" : "grayscale(100%)", opacity: anyBet ? 1 : 0.8 }}>
            <tbody>
              {/* 1행: 섹션 상세 — 배팅 없으면 dimmed */}
              {(() => {
                const tnHasBet = (tn?.amount || 0) > 0;
                const ghHasBet = (gh?.P || 0) + (gh?.B || 0) > 0;
                const pinchHasBet = pinchP + pinchB > 0;
                const tnDimStyle = tnHasBet ? {} : { filter: "grayscale(100%)", opacity: 0.7 };
                const ghDimStyle = ghHasBet ? {} : { filter: "grayscale(100%)", opacity: 0.7 };
                const pinchDimStyle = pinchHasBet ? {} : { filter: "grayscale(100%)", opacity: 0.7 };
                return (
                  <tr>
                    <td style={{ ...dcB, color: "#00bcd4", ...tnDimStyle }}>Triplenine</td>
                    <td style={{ ...dc, color: "#1565c0", ...tnDimStyle }}>{`${(tn?.direction === "P" ? (tn?.amount || 0) : 0).toLocaleString()}P`}</td>
                    <td style={{ ...dc, color: "#f44336", ...tnDimStyle }}>{`${(tn?.direction === "B" ? (tn?.amount || 0) : 0).toLocaleString()}P`}</td>
                    <td style={{ ...dcB, color: "#00bcd4", ...ghDimStyle }}>globalhit</td>
                    <td style={{ ...dc, color: "#1565c0", ...ghDimStyle }}>{`${(gh?.P || 0).toLocaleString()}P`}</td>
                    <td style={{ ...dc, color: "#f44336", ...ghDimStyle }}>{`${(gh?.B || 0).toLocaleString()}P`}</td>
                    <td style={{ ...dcB, color: "#00bcd4", ...pinchDimStyle }}>pinch</td>
                    <td style={{ ...dc, color: "#1565c0", ...pinchDimStyle }}>{`${pinchP.toLocaleString()}P`}</td>
                    <td style={{ ...dc, color: "#f44336", ...pinchDimStyle }}>{`${pinchB.toLocaleString()}P`}</td>
                    <td style={{ ...dcB, color: "#fff" }}>{currentTurn}</td>
                    <td style={{ ...dc, color: "#1565c0" }}>{`${((tn?.direction === "P" ? (tn?.amount || 0) : 0) + (gh?.P || 0) + pinchP).toLocaleString()}P`}</td>
                    <td style={{ ...dc, color: "#f44336" }}>{`${((tn?.direction === "B" ? (tn?.amount || 0) : 0) + (gh?.B || 0) + pinchB).toLocaleString()}P`}</td>
                  </tr>
                );
              })()}

              {/* 2~5행: 글로벌히트 패턴별 — 배팅 있는 셀만 활성 */}
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
                            return <td style={{ ...dc, color: clr, ...dimStyle }}>{`${amt.toLocaleString()}P`}</td>;
                          })()}
                        </React.Fragment>
                      );
                    })
                  )}
                </tr>
              ))}

              {/* 7행: pinch mission 헤더 */}
              <tr>
                <td style={{ ...dcB, color: pinchActive ? "#00bcd4" : "#555" }}>pinch</td>
                <td style={{ ...dcB, color: pinchActive ? "#00bcd4" : "#555" }}>mission</td>
                {Array.from({ length: 10 }, (_, i) => (
                  <td key={i} style={{ ...dc, color: pinchActive ? "#4caf50" : "#555" }}>{i + 1}step</td>
                ))}
              </tr>

              {/* 8행~: pinch 방법별 */}
              {(pinch?.main_enable
                ? ["LongJ", "1LSC", "2LSC", "3LSC", "4LSC", "pattern1", "pattern2", "pattern3", "pattern4", "pattern5", "pattern6"]
                : ["pattern", "LongJ", "1LSC", "2LSC", "3LSC", "4LSC"]
              ).map((name) => {
                const pm = pinchMethods[name];
                const step = pm?.step || 0;
                const remaining = pm?.remaining || 0;
                const dir = pm?.direction;
                const completed = pm?.completed || false;

                return (
                  <tr key={name}>
                    <td style={{
                      ...dc,
                      color: pinchActive ? (completed ? "#4caf50" : dir ? "#39ff14" : "#555") : "#555",
                      fontWeight: pinchActive && dir ? "bold" : "normal",
                    }}>{name}</td>
                    <td style={{
                      ...dc,
                      color: pinchActive
                        ? (completed ? "#4caf50" : "#f44336")
                        : "#555",
                      fontWeight: pinchActive ? "bold" : "normal",
                    }}>
                      {pinchActive ? (completed ? "done" : `-${remaining.toLocaleString()}P`) : "-"}
                    </td>
                    {Array.from({ length: 10 }, (_, i) => {
                      const stepNum = i + 1;
                      const isCurrentStep = pinchActive && !completed && stepNum === step;
                      const isPastStep = pinchActive && !completed && stepNum < step;
                      return (
                        <td key={i} style={{
                          ...dc,
                          color: !pinchActive ? "#555"
                            : completed ? "#555"
                            : isCurrentStep ? "#4caf50"
                            : isPastStep ? "#f44336"
                            : "#fff",
                          fontWeight: isCurrentStep ? "bold" : "normal",
                          backgroundColor: isCurrentStep ? "rgba(76,175,80,0.15)" : "transparent",
                        }}>
                          {stepNum}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
            );
          })()}

          {/* 모바일: 우측 요약 패널 */}
          {isMobile && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, minWidth: 105 }}>
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
          </Box>
          </>
        );
      })()}

      {/* ===== 하단: GlobalHit - 8개 패턴 세로 나열 ===== */}
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
        {/* globalhitwhole 버튼 */}
        <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
          <Box sx={{ border: "1px solid #4caf50", borderRadius: 1, px: 1.5, py: 0.3, cursor: "pointer" }}>
            <Typography variant="caption" sx={{ fontSize: 11, color: "#4caf50", fontWeight: "bold" }}>globalhitwhole</Typography>
          </Box>
        </Box>
        {globalhitData.map((patData) => {
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
                  display: "flex",
                  alignItems: "center",
                  gap: 0.5,
                  mb: 0.5,
                  border: "1px solid rgba(255,255,255,0.2)",
                  backgroundColor: "background.paper",
                  px: 0.5,
                  py: 0.3,
                  cursor: "pointer",
                  "&:hover": { backgroundColor: "rgba(255,255,255,0.05)" },
                }}
              >
                {/* 글로벌히트소분류 */}
                <Box sx={{ border: "1px solid rgba(255,255,255,0.3)", px: 1, py: 0.2 }}>
                  <Typography variant="caption" sx={{ fontSize: 11, fontWeight: "bold" }}>
                    {pat.split("").map((c, i) => (
                      <Typography
                        key={i}
                        component="span"
                        sx={{ color: c === "P" ? "#1565c0" : "#f44336", fontWeight: "bold", fontSize: 11 }}
                      >
                        {c}
                      </Typography>
                    ))}
                    <Typography component="span" sx={{ fontSize: 10, color: "text.secondary" }}>(123)</Typography>
                  </Typography>
                </Box>

                {/* 회차 */}
                <Box sx={{ border: "1px solid rgba(255,255,255,0.3)", px: 0.8, py: 0.2 }}>
                  <Typography variant="caption" sx={{ fontSize: 10 }}>{results.length}</Typography>
                </Box>

                {/* 3조 각각: SC | 현재단계 | 베팅금액 */}
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

              {/* 3조 격자 - table (서버 데이터 기반) */}
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

      {/* ED 종료 완료 팝업 */}
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

      {/* 새 게임 확인 대화상자 */}
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
