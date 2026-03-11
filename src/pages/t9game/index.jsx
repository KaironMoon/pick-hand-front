import React, { useState, useEffect, useCallback } from "react";
import { Box, Typography, useMediaQuery, useTheme, Dialog, DialogTitle, DialogContent, DialogActions, Button } from "@mui/material";
import { useNavigate } from "react-router-dom";
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
const Circle = ({ type, filled = true, size = 24 }) => {
  const colors = { P: "#1565c0", B: "#f44336" };
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
        fontSize: size * 0.5,
        fontWeight: "bold",
        color: filled ? "#fff" : colors[type],
      }}
    >
      {type}
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
      grid[row][col] = { type: current, status };
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
      grid[row][col] = { type: current, status };
    } else {
      verticalStartCol++;
      col = verticalStartCol;
      row = 0;
      isBent = false;
      if (col >= GRID_COLS) break;
      grid[row][col] = { type: current, status };
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

  const [results, setResults] = useState([]);
  const [pickResult, setPickResult] = useState({ method: "wait", pick: null });
  const [globalhitData, setGlobalhitData] = useState([]);
  const [betData, setBetData] = useState(null);
  const [gameId, setGameId] = useState(null);
  const [cumPnL, setCumPnL] = useState({ tn: 0, gh: 0, pinch: 0 });
  const [toggles, setToggles] = useState({
    nor1: true,
    m1: true,
    ham: false,
    bk: false,
  });
  const [mode, setMode] = useState("STD"); // STD or PTN
  const [line, setLine] = useState(1); // 1~4 LINE
  const [winLoss, setWinLoss] = useState("2W-0W"); // 승패 표시

  // ED 종료 모드
  const [endingMode, setEndingMode] = useState(false);
  const [endingSnapshot, setEndingSnapshot] = useState(null); // { tn: bool, gh: Set<"PPP-0">, pinch: Set<"pattern"> }
  const [endingDone, setEndingDone] = useState(false); // 팝업 표시용

  const currentTurn = results.length + 1;
  const grid = calculateCircleGrid(results);

  // 픽 이미지 결정
  const pickImage = pickResult.pick === "P" ? "/player.png" : pickResult.pick === "B" ? "/banker.png" : "/wait.png";

  // 게임 시작
  const startGame = useCallback(async () => {
    try {
      const res = await apiCaller.post("/api/v1/games/start");
      setGameId(res.data.game_id);
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

  // 페이지 로드 시 게임 시작
  useEffect(() => {
    startGame();
  }, [startGame]);

  // P/B 입력 → 서버에 라운드 기록 + 다음 상태 수신
  const handleInput = async (inputValue) => {
    if (!gameId) return;

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
      const { globalhit, bet, ...pick } = data;
      setPickResult({ method: pick.method, pick: pick.pick });
      setGlobalhitData(globalhit || []);
      setBetData(bet || null);

      // 종료 모드: 모든 추적 배팅이 step 1로 돌아왔는지 체크
      if (endingMode && endingSnapshot) {
        if (checkEndingComplete(data)) {
          setEndingDone(true);
        }
      }
    } catch (err) {
      console.error("Failed to record round:", err);
    }
  };

  // 마지막 1개 삭제 (서버 + 프론트 동기화)
  const handleDeleteOne = useCallback(async () => {
    if (results.length === 0 || !gameId) return;

    try {
      const res = await apiCaller.delete(`/api/v1/games/${gameId}/last-round`);
      const data = res.data;

      setResults(results.slice(0, -1));
      setCumPnL({
        tn: data.cum_pnl.tn,
        gh: data.cum_pnl.gh,
        pinch: data.cum_pnl.pinch,
      });

      const { globalhit, bet, ...pick } = data;
      setPickResult({ method: pick.method, pick: pick.pick });
      setGlobalhitData(globalhit || []);
      setBetData(bet || null);
    } catch (err) {
      console.error("Failed to delete round:", err);
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
    setBetData(null);
    setPickResult({ method: "wait", pick: null });
    setGlobalhitData([]);
    startGame();
  };

  // next game: 현재 게임 종료 + 단계 미처리 정보 포함하여 새 게임 시작
  const handleNextGame = async () => {
    if (!gameId) return;

    // 현재 step > 1인 배팅 수집 (미처리 단계)
    const tn = betData?.triplenine;
    const gh = betData?.globalhit;
    const pinch = betData?.pinch;

    const carryOver = { tn_step: 0, gh: [], pinch: [] };
    if (tn && tn.step > 1) carryOver.tn_step = tn.step;
    if (gh?.details) {
      gh.details.forEach((d) => {
        if (d.step > 1) carryOver.gh.push({ pattern: d.pattern, group: d.group, step: d.step });
      });
    }
    if (pinch?.methods) {
      Object.entries(pinch.methods).forEach(([method, m]) => {
        if (m.step > 1) carryOver.pinch.push({ method, step: m.step });
      });
    }

    const hasCarryOver = carryOver.tn_step > 0 || carryOver.gh.length > 0 || carryOver.pinch.length > 0;

    // 현재 게임 종료
    try {
      await apiCaller.post("/api/v1/games/end", null, { params: { game_id: gameId } });
    } catch (err) {
      console.error("Failed to end game:", err);
    }

    // 상태 초기화
    setEndingMode(false);
    setEndingSnapshot(null);
    setEndingDone(false);
    setResults([]);
    setCumPnL({ tn: 0, gh: 0, pinch: 0 });
    setBetData(null);
    setPickResult({ method: "wait", pick: null });
    setGlobalhitData([]);

    // 새 게임 시작 (미처리 단계 전달)
    try {
      const res = await apiCaller.post("/api/v1/games/start", {
        carry_over: hasCarryOver ? carryOver : null,
      });
      setGameId(res.data.game_id);
      // 초기 픽 조회
      const pickRes = await apiCaller.post("/api/v1/pick", { seq: "" });
      const { globalhit, bet, ...pick } = pickRes.data;
      setPickResult(pick);
      setGlobalhitData(globalhit || []);
      setBetData(bet || null);
    } catch (err) {
      console.error("Failed to start next game:", err);
    }
  };

  return (
    <Box sx={{ p: 2 }}>
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
          row.map((cell, colIndex) => (
            <Box
              key={`${rowIndex}-${colIndex}`}
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: cell ? (CELL_BG[cell.status] || "background.default") : "background.default",
              }}
            >
              {cell && (
                <Circle
                  type={cell.type}
                  filled={true}
                  size={isMobile ? 12 : 22}
                />
              )}
            </Box>
          ))
        )}
      </Box>

      {/* ===== 중단: 인터페이스 (한 줄) ===== */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.5,
          mb: 1,
          flexWrap: "wrap",
        }}
      >
        {/* 픽 방법 표시 */}
        <Box sx={{ ...toggleBtnSx, border: "2px solid #4caf50", width: 60 }}>
          <Typography variant="caption" sx={{ fontSize: 11, fontWeight: "bold" }}>{pickResult.method || "wait"}</Typography>
        </Box>

        {/* M3 */}
        <Box sx={{ ...toggleBtnSx, border: "2px solid #4caf50" }}>
          <Typography variant="caption" sx={{ fontSize: 11, fontWeight: "bold" }}>M3</Typography>
        </Box>

        {/* global */}
        <Box sx={{ ...toggleBtnSx, border: "2px solid #4caf50" }}>
          <Typography variant="caption" sx={{ fontSize: 11, fontWeight: "bold" }}>global</Typography>
        </Box>

        {/* pinch */}
        <Box sx={{ ...toggleBtnSx, border: "2px solid #4caf50" }}>
          <Typography variant="caption" sx={{ fontSize: 11, fontWeight: "bold" }}>pinch</Typography>
        </Box>

        {/* ED (종료 모드) */}
        <Box
          onClick={handleEndingMode}
          sx={{
            ...toggleBtnSx,
            backgroundColor: endingMode ? "#ff6f00" : "#b71c1c",
            borderRadius: 2,
            border: endingMode ? "2px solid #ffab00" : "none",
            px: 1.5,
            cursor: "pointer",
            animation: endingMode ? "pulse 1.5s infinite" : "none",
            "@keyframes pulse": {
              "0%": { opacity: 1 },
              "50%": { opacity: 0.6 },
              "100%": { opacity: 1 },
            },
          }}
        >
          <Typography variant="caption" sx={{ fontSize: 13, fontWeight: "bold", color: "#fff" }}>
            {endingMode ? "ED..." : "ED"}
          </Typography>
        </Box>

        {/* BT */}
        <Box sx={{ ...toggleBtnSx, backgroundColor: "#1565c0", borderRadius: 2, border: "none", px: 1.5 }}>
          <Typography variant="caption" sx={{ fontSize: 13, fontWeight: "bold", color: "#fff" }}>BT</Typography>
        </Box>

        {/* 베팅금액 */}
        <Box sx={{ ...toggleBtnSx, border: "2px solid #4caf50", cursor: "default", px: 1.5, minWidth: 120, justifyContent: "flex-end" }}>
          <Typography variant="caption" sx={{ fontSize: 12, fontWeight: "bold", color: "#4caf50" }}>
            {betData?.combined ? `${betData.combined.amount.toLocaleString()}P` : "0P"}
          </Typography>
        </Box>

        {/* 픽 표시 */}
        <Box
          sx={{
            width: 85,
            height: 85,
            mx: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <img src={pickImage} alt="pick" style={{ width: 77, height: 77, objectFit: "contain" }} />
          <Typography variant="caption" sx={{ fontSize: 9, color: "text.secondary", mt: -0.5 }}>
            {pickResult.method}
          </Typography>
        </Box>

        {/* 턴 번호 */}
        <Box
          sx={{
            width: 40,
            height: 40,
            border: "2px solid rgba(255,255,255,0.3)",
            borderRadius: 1,
            backgroundColor: "#333",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: "bold", fontSize: 16 }}>{currentTurn}</Typography>
        </Box>

        {/* P 버튼 */}
        <Box
          onClick={() => handleInput("P")}
          sx={{
            width: 55,
            height: 55,
            borderRadius: 2,
            backgroundColor: "#1565c0",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontSize: 24,
            fontWeight: "bold",
            cursor: "pointer",
            "&:hover": { opacity: 0.85 },
            "&:active": { transform: "scale(0.95)" },
          }}
        >
          P
        </Box>

        {/* B 버튼 */}
        <Box
          onClick={() => handleInput("B")}
          sx={{
            width: 55,
            height: 55,
            borderRadius: 2,
            backgroundColor: "#f44336",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontSize: 24,
            fontWeight: "bold",
            cursor: "pointer",
            "&:hover": { opacity: 0.85 },
            "&:active": { transform: "scale(0.95)" },
          }}
        >
          B
        </Box>

        {/* del */}
        <Box
          onClick={results.length > 0 ? handleDeleteOne : undefined}
          sx={{
            ...controlBtnSx,
            ml: 5,
            cursor: results.length > 0 ? "pointer" : "default",
            opacity: results.length > 0 ? 1 : 0.4,
          }}
        >
          <Typography variant="caption" sx={{ fontSize: 13 }}>del</Typography>
        </Box>

        {/* set-up */}
        <Box onClick={() => navigate("/t9game/setup")} sx={{ ...controlBtnSx, cursor: "pointer", border: "2px solid rgba(255,255,255,0.3)" }}>
          <Typography variant="caption" sx={{ fontSize: 12 }}>set-up</Typography>
        </Box>

        {/* next game */}
        <Box
          onClick={results.length > 0 ? handleNextGame : undefined}
          sx={{
            ...controlBtnSx,
            cursor: results.length > 0 ? "pointer" : "default",
            opacity: results.length > 0 ? 1 : 0.4,
            border: "2px solid rgba(255,255,255,0.3)",
          }}
        >
          <Typography variant="caption" sx={{ fontSize: 12 }}>next game</Typography>
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

        const dc = { border: "1px solid #555", padding: "3px 12px", fontSize: 10, textAlign: "center", whiteSpace: "nowrap" };
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
          {/* 최상단: 요약 바 */}
          <Box sx={{ display: "flex", alignItems: "stretch", gap: 0.5, mb: 0.5, flexWrap: "wrap" }}>
            <Box sx={{ border: "1px solid rgba(255,255,255,0.3)", borderRadius: 2, px: 1.5, display: "flex", alignItems: "center" }}>
              <Typography variant="caption" sx={{ fontSize: 11, fontWeight: "bold", color: dirColor }}>{`formal(${combinedDir})`}</Typography>
            </Box>
            {[
              { name: "Triplenine", pnl: cumPnL.tn },
              { name: "globalhit", pnl: cumPnL.gh },
              { name: "pinch", pnl: cumPnL.pinch },
            ].map((item, i) => {
              const clr = item.pnl > 0 ? "#4caf50" : item.pnl < 0 ? "#f44336" : "#fff";
              const sign = item.pnl > 0 ? "+" : "";
              return (
                <Box key={i} sx={{ border: "1px solid rgba(255,255,255,0.3)", borderRadius: 2, px: 2, minWidth: 200, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <Typography variant="caption" sx={{ fontSize: 11, fontWeight: "bold", color: "#fff" }}>{item.name}</Typography>
                  <Typography variant="caption" sx={{ fontSize: 11, fontWeight: "bold", color: clr }}>{`${sign}${item.pnl.toLocaleString()}P`}</Typography>
                </Box>
              );
            })}
            {(() => {
              const totalPnL = cumPnL.tn + cumPnL.gh + cumPnL.pinch;
              const bgColor = "#00bcd4";
              const sign = totalPnL > 0 ? "+" : "";
              return (
                <Box sx={{ px: 2, minWidth: 200, backgroundColor: bgColor, borderRadius: 2, display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
                  <Typography variant="caption" sx={{ fontSize: 11, fontWeight: "bold", color: totalPnL < 0 ? "#f44336" : "#000" }}>{`${sign}${totalPnL.toLocaleString()}P`}</Typography>
                </Box>
              );
            })()}
          </Box>

          {/* 메인 상황판 테이블 */}
          <table style={{ borderCollapse: "collapse", width: "fit-content", marginBottom: 12 }}>
            <tbody>
              {/* 1행: 섹션 상세 */}
              <tr>
                <td style={{ ...dcB, color: "#00bcd4" }}>Triplenine</td>
                <td style={{ ...dc, color: "#1565c0" }}>{`${(tn?.direction === "P" ? (tn?.amount || 0) : 0).toLocaleString()}P`}</td>
                <td style={{ ...dc, color: "#f44336" }}>{`${(tn?.direction === "B" ? (tn?.amount || 0) : 0).toLocaleString()}P`}</td>
                <td style={{ ...dcB, color: "#00bcd4" }}>globalhit</td>
                <td style={{ ...dc, color: "#1565c0" }}>{`${(gh?.P || 0).toLocaleString()}P`}</td>
                <td style={{ ...dc, color: "#f44336" }}>{`${(gh?.B || 0).toLocaleString()}P`}</td>
                <td style={{ ...dcB, color: "#00bcd4" }}>pinch</td>
                <td style={{ ...dc, color: "#1565c0" }}>{`${pinchP.toLocaleString()}P`}</td>
                <td style={{ ...dc, color: "#f44336" }}>{`${pinchB.toLocaleString()}P`}</td>
                <td style={{ ...dcB, color: "#fff" }}>{currentTurn}</td>
                <td style={{ ...dc, color: "#1565c0" }}>{`${((tn?.direction === "P" ? (tn?.amount || 0) : 0) + (gh?.P || 0) + pinchP).toLocaleString()}P`}</td>
                <td style={{ ...dc, color: "#f44336" }}>{`${((tn?.direction === "B" ? (tn?.amount || 0) : 0) + (gh?.B || 0) + pinchB).toLocaleString()}P`}</td>
              </tr>

              {/* 2~5행: 글로벌히트 패턴별 (2패턴×3섹션 = 12열) */}
              {[[ghPatterns[0], ghPatterns[1]], [ghPatterns[2], ghPatterns[3]], [ghPatterns[4], ghPatterns[5]], [ghPatterns[6], ghPatterns[7]]].map((pair, ri) => (
                <tr key={`gh-${ri}`}>
                  {pair.map((pat) =>
                    [0, 1, 2].map((sec) => (
                      <React.Fragment key={`${pat}-${sec}`}>
                        <td style={{ ...dc }}>
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
                          return <td style={{ ...dc, color: clr }}>{`${getPatSec(pat, sec).toLocaleString()}P`}</td>;
                        })()}
                      </React.Fragment>
                    ))
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

              {/* 8~13행: pinch 방법별 */}
              {["pattern", "LongJ", "1LSC", "2LSC", "3LSC", "4LSC"].map((name) => {
                const pm = pinchMethods[name];
                const step = pm?.step || 0;
                const remaining = pm?.remaining || 0;
                const dir = pm?.direction;
                const completed = pm?.completed || false;

                return (
                  <tr key={name}>
                    <td style={{ ...dc, color: pinchActive ? (completed ? "#4caf50" : "#fff") : "#555" }}>{name}</td>
                    <td style={{
                      ...dc,
                      color: pinchActive
                        ? (completed ? "#4caf50" : dir === "P" ? "#1565c0" : dir === "B" ? "#f44336" : "#888")
                        : "#555",
                      fontWeight: pinchActive ? "bold" : "normal",
                    }}>
                      {pinchActive ? (completed ? "done" : `${remaining.toLocaleString()}P`) : "-"}
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
          const circleStyle = (predict) => ({
            width: cellSize - 2, height: cellSize - 2, borderRadius: "50%",
            backgroundColor: predict === "P" ? "#1565c0" : "#f44336",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontSize: 9, fontWeight: "bold",
          });

          return (
            <Box key={pat}>
              {/* 헤더 바 */}
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0.5,
                  mb: 0.5,
                  border: "1px solid rgba(255,255,255,0.2)",
                  backgroundColor: "background.paper",
                  px: 0.5,
                  py: 0.3,
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
                      <Typography variant="caption" sx={{ fontSize: 10 }}>{g.step ?? 0}S</Typography>
                    </Box>
                    <Box sx={{ border: "1px solid rgba(255,255,255,0.3)", px: 0.8, py: 0.2 }}>
                      <Typography variant="caption" sx={{ fontSize: 10 }}>
                        {(() => {
                          const detail = betData?.globalhit?.details?.find(
                            (d) => d.pattern === pat && d.group === gi + 1
                          );
                          return detail ? `${detail.amount.toLocaleString()}P` : `${(g.bet ?? 0).toLocaleString()}P`;
                        })()}
                      </Typography>
                    </Box>
                  </Box>
                ))}

                <Box sx={{ flexGrow: 1 }} />
              </Box>

              {/* 3조 격자 - table (서버 데이터 기반) */}
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
                              {hasData && <div style={circleStyle(item.predict)}>{roundNum}</div>}
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
                              {hasData && <div style={circleStyle(item.predict)}>{roundNum}</div>}
                            </td>
                          );
                        })}
                      </tr>,
                    ];
                  })}
                </tbody>
              </table>
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
    </Box>
  );
}
