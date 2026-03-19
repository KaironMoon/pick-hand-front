import React, { useState, useEffect, useCallback, useRef } from "react";
import { Box, Typography, useMediaQuery, useTheme } from "@mui/material";
import { useSearchParams, useNavigate } from "react-router-dom";
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

export default function HbUserGamePage() {
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
  const processingRef = useRef(false);

  const currentTurn = results.length + 1;
  const grid = calculateCircleGrid(results);

  const displayPick = betData?.combined?.direction && betData.combined.direction !== "wait" ? betData.combined.direction : null;
  const pickImage = displayPick === "P" ? "/player.png" : displayPick === "B" ? "/banker.png" : "/wait.png";

  useEffect(() => {
    apiCaller.get(HB_GAMES_API.NICKNAMES).then((res) => {
      setNicknames(res.data.nicknames || []);
    });
  }, []);

  const startGame = useCallback(async () => {
    try {
      const res = await apiCaller.post(HB_GAMES_API.START);
      setGameId(res.data.game_id);
      setConfig(res.data.config);
      setSearchParams({ gameId: res.data.game_id }, { replace: true });
    } catch (err) {
      console.error("Failed to start game:", err);
    }
  }, []);

  useEffect(() => {
    const isNew = searchParams.get("new");
    const urlGameId = searchParams.get("gameId");
    if (isNew) {
      setResults([]); setCumPnL({ hb: 0, gh: 0 }); setBetData(null);
      setPickResult({ method: "wait", pick: null, nickname: null });
      setHbPatterns({}); setGlobalhitData([]);
      startGame();
    } else if (urlGameId) {
      restoreGame(parseInt(urlGameId));
    } else {
      startGame();
    }
  }, [searchParams.get("new")]); // eslint-disable-line react-hooks/exhaustive-deps

  const restoreGame = async (gid) => {
    try {
      const res = await apiCaller.get(HB_GAMES_API.STATE(gid));
      const data = res.data;
      setGameId(data.game_id);
      setConfig(data.config);
      setCumPnL(data.cum_pnl || { hb: 0, gh: 0 });
      const seq = data.seq || "";
      setResults(seq.split("").map((v) => ({ value: v, status: "wait" })));
      setPickResult({ method: data.method, pick: data.pick, nickname: data.nickname });
      setHbPatterns(data.hb_patterns || {});
      setGlobalhitData(data.globalhit || []);
      setBetData(data.bet || null);
    } catch (err) {
      console.error("Failed to restore, starting new:", err);
      startGame();
    }
  };

  const handleInput = async (inputValue) => {
    if (!gameId || processingRef.current) return;
    processingRef.current = true;

    let status = "wait";
    if (pickResult.pick) {
      status = pickResult.pick === inputValue ? "hit" : "miss";
    }
    setResults((prev) => [...prev, { value: inputValue, status }]);

    try {
      const res = await apiCaller.post(HB_GAMES_API.ROUND, { game_id: gameId, actual: inputValue });
      const data = res.data;
      setCumPnL({ hb: data.cum_pnl.hb, gh: data.cum_pnl.gh });
      setPickResult({ method: data.method, pick: data.pick, nickname: data.nickname });
      setHbPatterns(data.hb_patterns || {});
      setGlobalhitData(data.globalhit || []);
      setBetData(data.bet || null);
    } catch (err) {
      console.error("Failed to record round:", err);
    } finally {
      processingRef.current = false;
    }
  };

  const handleDeleteOne = useCallback(async () => {
    if (results.length === 0 || !gameId || processingRef.current) return;
    processingRef.current = true;
    try {
      const res = await apiCaller.delete(HB_GAMES_API.LAST_ROUND(gameId));
      const data = res.data;
      setResults(results.slice(0, -1));
      setCumPnL(data.cum_pnl || { hb: 0, gh: 0 });
      setPickResult({ method: data.method, pick: data.pick, nickname: data.nickname });
      setHbPatterns(data.hb_patterns || {});
      setGlobalhitData(data.globalhit || []);
      setBetData(data.bet || null);
    } catch (err) {
      console.error("Failed to delete last round:", err);
    } finally {
      processingRef.current = false;
    }
  }, [gameId, results]);

  const handleNextGame = async () => {
    if (!gameId || results.length === 0) return;
    try {
      const res = await apiCaller.post(HB_GAMES_API.NEXT, null, { params: { game_id: gameId } });
      setResults([]); setBetData(null);
      setPickResult({ method: "wait", pick: null, nickname: null });
      setHbPatterns({}); setGlobalhitData([]);
      setGameId(res.data.game_id);
      setSearchParams({ gameId: res.data.game_id }, { replace: true });
      if (res.data.carry_pnl) {
        setCumPnL(res.data.carry_pnl);
      } else {
        setCumPnL({ hb: 0, gh: 0 });
      }
    } catch (err) {
      console.error("Failed to next game:", err);
    }
  };

  const sortedPatterns = nicknames.length > 0 ? nicknames : Object.keys(hbPatterns).sort();

  return (
    <Box sx={{ p: isMobile ? 0.5 : 2 }}>
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
        {/* 합산 금액 */}
        <Box sx={{ ...toggleBtnSx, border: "2px solid #4caf50", cursor: "default", px: isMobile ? 0.5 : 1.5, minWidth: isMobile ? 50 : 120, justifyContent: "flex-end" }}>
          <Typography variant="caption" sx={{ fontSize: isMobile ? 10 : 12, fontWeight: "bold", color: "#4caf50" }}>
            {betData?.combined ? `${betData.combined.amount.toLocaleString()}P` : "0P"}
          </Typography>
        </Box>

        <Box sx={{ width: "1px", height: 28, backgroundColor: "rgba(255,255,255,0.2)", mx: 0.3 }} />

        {/* 픽이미지 + 턴 + P/B */}
        <Box sx={{ width: isMobile ? 44 : 85, height: isMobile ? 44 : 85, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <img src={pickImage} alt="pick" style={{ width: isMobile ? 40 : 77, height: isMobile ? 40 : 77, objectFit: "contain" }} />
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
        <Box sx={{ width: isMobile ? 32 : 0 }} />
        <Box
          onClick={results.length > 0 ? handleDeleteOne : undefined}
          sx={{ ...controlBtnSx, cursor: results.length > 0 ? "pointer" : "default", opacity: results.length > 0 ? 1 : 0.4 }}
        >
          <Typography variant="caption" sx={{ fontSize: isMobile ? 10 : 13 }}>del</Typography>
        </Box>
        <Box
          onClick={results.length > 0 ? handleNextGame : undefined}
          sx={{ ...controlBtnSx, cursor: results.length > 0 ? "pointer" : "default", opacity: results.length > 0 ? 1 : 0.4, border: "2px solid rgba(255,255,255,0.3)" }}
        >
          <Typography variant="caption" sx={{ fontSize: isMobile ? 10 : 12 }}>next</Typography>
        </Box>
      </Box>

      {/* ===== 총금액 요약 ===== */}
      {(() => {
        const hb = betData?.honeybee;
        const gh = betData?.globalhit;
        const combined = betData?.combined;
        const combinedDir = combined?.direction || "wait";
        const dirColor = combinedDir === "P" ? "#1565c0" : combinedDir === "B" ? "#f44336" : "#888";
        const hbHasBet = (hb?.P || 0) + (hb?.B || 0) > 0;
        const ghHasBet = (gh?.P || 0) + (gh?.B || 0) > 0;
        const totalPnL = cumPnL.hb + cumPnL.gh;

        if (isMobile) {
          const items = [
            { name: "formal", value: combinedDir, color: dirColor, isFormal: true },
            { name: "Honeybee", pnl: cumPnL.hb, active: hbHasBet },
            { name: "globalhit", pnl: cumPnL.gh, active: ghHasBet },
            { name: "합계", pnl: totalPnL, isTotal: true },
          ];
          const rowSx = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 0.5, borderRadius: 1, px: 0.8, py: 0.3, whiteSpace: "nowrap" };
          return (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, mb: 1 }}>
              {items.map((item, i) => {
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
              })}
            </Box>
          );
        }

        return (
          <Box sx={{ display: "flex", alignItems: "stretch", gap: 0.5, mb: 1, flexWrap: "wrap" }}>
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
              const sign = totalPnL > 0 ? "+" : "";
              return (
                <Box sx={{ px: 2, minWidth: 200, backgroundColor: "#00bcd4", borderRadius: 2, display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
                  <Typography variant="caption" sx={{ fontSize: 11, fontWeight: "bold", color: totalPnL < 0 ? "#f44336" : "#000" }}>{`${sign}${totalPnL.toLocaleString()}P`}</Typography>
                </Box>
              );
            })()}
          </Box>
        );
      })()}

    </Box>
  );
}
