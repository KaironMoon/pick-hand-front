import { useState } from "react";
import { Box, Typography, useMediaQuery, useTheme } from "@mui/material";

const GRID_ROWS = 6;
const GRID_COLS = 40;

const GLOBALHIT_PATTERNS = ["PPP", "BBB", "PBP", "BPB", "BBP", "PPB", "PBB", "BPP"];

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

// 빅로드 격자 계산
const calculateCircleGrid = (results) => {
  const grid = Array(GRID_ROWS)
    .fill(null)
    .map(() => Array(GRID_COLS).fill(null));

  const picks = results.map((r) => r.value);
  if (!picks || picks.length === 0) return grid;

  let col = 0;
  let row = 0;
  let prevValue = null;
  let verticalStartCol = 0;
  let isBent = false;

  for (let i = 0; i < picks.length; i++) {
    const current = picks[i];

    if (prevValue === null) {
      grid[row][col] = { type: current, filled: true };
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
      grid[row][col] = { type: current, filled: true };
    } else {
      verticalStartCol++;
      col = verticalStartCol;
      row = 0;
      isBent = false;
      if (col >= GRID_COLS) break;
      grid[row][col] = { type: current, filled: true };
    }

    prevValue = current;
  }

  return grid;
};

// 패턴을 60라운드로 반복 생성 (PPP → PPPPPP..., PBP → PBPPBPPBP...)
const generatePatternSequence = (pat, rounds = 60) => {
  const seq = [];
  for (let i = 0; i < rounds; i++) {
    seq.push(pat[i % pat.length]);
  }
  return seq;
};

// 패턴 시퀀스를 빅로드 격자로 변환
const buildPatternGrid = (sequence, rows, cols) => {
  const grid = Array(rows).fill(null).map(() => Array(cols).fill(null));
  let col = 0, row = 0, prevValue = null, verticalStartCol = 0, isBent = false;

  for (let i = 0; i < sequence.length; i++) {
    const current = sequence[i];
    if (prevValue === null) {
      grid[row][col] = { type: current };
      verticalStartCol = col;
    } else if (current === prevValue) {
      if (isBent) { col++; }
      else if (row >= rows - 1) { col++; isBent = true; }
      else if (grid[row + 1]?.[col]) { col++; isBent = true; }
      else { row++; }
      if (col >= cols) break;
      grid[row][col] = { type: current };
    } else {
      verticalStartCol++;
      col = verticalStartCol;
      row = 0;
      isBent = false;
      if (col >= cols) break;
      grid[row][col] = { type: current };
    }
    prevValue = current;
  }
  return grid;
};

// GlobalHit 조별 라운드 계산
// 1조: 1,2,3 | 4,5,6 | 7,8,9 ...
// 2조: 2,3,4 | 5,6,7 | 8,9,10 ...
// 3조: 3,4,5 | 6,7,8 | 9,10,11 ...
const getGroupSets = (groupIndex, totalRounds) => {
  const startRound = groupIndex + 1; // 1조=1, 2조=2, 3조=3
  const sets = [];
  for (let setStart = startRound; setStart <= totalRounds; setStart += 3) {
    const set = [];
    for (let i = 0; i < 3; i++) {
      const round = setStart + i;
      if (round <= totalRounds) {
        set.push(round);
      }
    }
    if (set.length > 0) sets.push(set);
  }
  return sets;
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

  const [results, setResults] = useState([]);
  const [toggles, setToggles] = useState({
    nor1: true,
    m1: true,
    ham: false,
    bk: false,
  });
  const [mode, setMode] = useState("STD"); // STD or PTN
  const [line, setLine] = useState(1); // 1~4 LINE
  const [winLoss, setWinLoss] = useState("2W-0W"); // 승패 표시

  const currentTurn = results.length + 1;
  const grid = calculateCircleGrid(results);

  const handleInput = (inputValue) => {
    const newResult = { value: inputValue };
    setResults([...results, newResult]);
  };

  const handleDeleteOne = () => {
    if (results.length > 0) {
      setResults(results.slice(0, -1));
    }
  };

  const handleDeleteWhole = () => {
    setResults([]);
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
          "& > div": {
            backgroundColor: "background.default",
          },
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
              }}
            >
              {cell && (
                <Circle
                  type={cell.type}
                  filled={cell.filled}
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
          mb: 2,
          flexWrap: "wrap",
        }}
      >
        {/* STD/PTN 토글 */}
        <Box
          onClick={() => setMode(prev => prev === "STD" ? "PTN" : "STD")}
          sx={{
            ...toggleBtnSx,
            backgroundColor: mode === "STD" ? "#ff9800" : "#2196f3",
            color: "#fff",
          }}
        >
          <Typography variant="caption" sx={{ fontSize: 11, fontWeight: "bold" }}>{mode}</Typography>
        </Box>

        {/* LINE 토글 */}
        <Box
          onClick={() => setLine(prev => prev >= 4 ? 1 : prev + 1)}
          sx={{
            ...toggleBtnSx,
            backgroundColor: "#2196f3",
            color: "#fff",
          }}
        >
          <Typography variant="caption" sx={{ fontSize: 11, fontWeight: "bold" }}>{line}LINE</Typography>
        </Box>

        {/* 2W-0W */}
        <Box sx={{ ...toggleBtnSx, cursor: "default" }}>
          <Typography variant="caption" sx={{ fontSize: 11, fontWeight: "bold", color: "#4caf50" }}>{winLoss}</Typography>
        </Box>

        {/* Nor1 */}
        <Box
          onClick={() => setToggles(prev => ({ ...prev, nor1: !prev.nor1 }))}
          sx={{
            ...toggleBtnSx,
            backgroundColor: toggles.nor1 ? "#ff9800" : "background.paper",
            color: toggles.nor1 ? "#000" : "text.primary",
          }}
        >
          <Typography variant="caption" sx={{ fontSize: 11, fontWeight: "bold" }}>Nor1</Typography>
        </Box>

        {/* M1 */}
        <Box
          onClick={() => setToggles(prev => ({ ...prev, m1: !prev.m1 }))}
          sx={{
            ...toggleBtnSx,
            backgroundColor: toggles.m1 ? "#4caf50" : "background.paper",
            color: toggles.m1 ? "#fff" : "text.primary",
          }}
        >
          <Typography variant="caption" sx={{ fontSize: 11, fontWeight: "bold" }}>M1</Typography>
        </Box>

        {/* HAM */}
        <Box
          onClick={() => setToggles(prev => ({ ...prev, ham: !prev.ham }))}
          sx={{
            ...toggleBtnSx,
            backgroundColor: toggles.ham ? "#ff5722" : "background.paper",
            color: toggles.ham ? "#fff" : "text.primary",
          }}
        >
          <Typography variant="caption" sx={{ fontSize: 11, fontWeight: "bold" }}>HAM</Typography>
        </Box>

        {/* BK */}
        <Box
          onClick={() => setToggles(prev => ({ ...prev, bk: !prev.bk }))}
          sx={{
            ...toggleBtnSx,
            backgroundColor: toggles.bk ? "#9c27b0" : "background.paper",
            color: toggles.bk ? "#fff" : "text.primary",
          }}
        >
          <Typography variant="caption" sx={{ fontSize: 11, fontWeight: "bold" }}>BK</Typography>
        </Box>

        {/* 잔액 */}
        <Box sx={{ ...toggleBtnSx, cursor: "default" }}>
          <Typography variant="caption" sx={{ fontSize: 11, fontWeight: "bold", color: "#4caf50" }}>170000P</Typography>
        </Box>

        {/* 픽 표시 */}
        <Box
          sx={{
            width: 85,
            height: 85,
            mx: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "2px solid rgba(255,255,255,0.4)",
            borderRadius: 1,
          }}
        >
          <img src="/wait.png" alt="pick" style={{ width: 77, height: 77, objectFit: "contain" }} />
        </Box>

        {/* 턴 번호 */}
        <Box
          sx={{
            width: 32,
            height: 32,
            border: "1px solid rgba(255,255,255,0.3)",
            borderRadius: 1,
            backgroundColor: "background.paper",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: "bold", fontSize: 13 }}>{currentTurn}</Typography>
        </Box>

        {/* P 버튼 */}
        <Box
          onClick={() => handleInput("P")}
          sx={{
            width: 50,
            height: 50,
            borderRadius: 2,
            backgroundColor: "#1565c0",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontSize: 22,
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
            width: 50,
            height: 50,
            borderRadius: 2,
            backgroundColor: "#f44336",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontSize: 22,
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
            cursor: results.length > 0 ? "pointer" : "default",
            opacity: results.length > 0 ? 1 : 0.4,
          }}
        >
          <Typography variant="caption" sx={{ fontSize: 11 }}>del</Typography>
        </Box>

        {/* undo */}
        <Box
          onClick={results.length > 0 ? handleDeleteWhole : undefined}
          sx={{
            ...controlBtnSx,
            cursor: results.length > 0 ? "pointer" : "default",
            opacity: results.length > 0 ? 1 : 0.4,
          }}
        >
          <Typography variant="caption" sx={{ fontSize: 11 }}>undo</Typography>
        </Box>

        {/* set-up */}
        <Box sx={{ ...controlBtnSx, cursor: "pointer" }}>
          <Typography variant="caption" sx={{ fontSize: 11 }}>set-up</Typography>
        </Box>

        {/* save */}
        <Box
          sx={{
            ...controlBtnSx,
            cursor: results.length > 0 ? "pointer" : "default",
            opacity: results.length > 0 ? 1 : 0.4,
          }}
        >
          <Typography variant="caption" sx={{ fontSize: 11 }}>save</Typography>
        </Box>
      </Box>

      {/* ===== 하단: GlobalHit - 8개 패턴 세로 나열 ===== */}
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
        {/* globalhitwhole 버튼 (전체 하나) */}
        <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
          <Box sx={{ border: "1px solid #4caf50", borderRadius: 1, px: 1.5, py: 0.3, cursor: "pointer" }}>
            <Typography variant="caption" sx={{ fontSize: 11, color: "#4caf50", fontWeight: "bold" }}>globalhitwhole</Typography>
          </Box>
        </Box>
        {GLOBALHIT_PATTERNS.map((pat) => {
          const GH_GRID_ROWS = 2;
          const GH_GRID_COLS = 40;
          const cellSize = 20;

          // 패턴 시퀀스 60라운드 생성 & 빅로드 격자
          const patSequence = generatePatternSequence(pat, 60);
          const patGrid = buildPatternGrid(patSequence, GH_GRID_ROWS, GH_GRID_COLS);

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
                {/* 패턴명(123) */}
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

                {/* 라운드 수 */}
                <Box sx={{ border: "1px solid rgba(255,255,255,0.3)", px: 0.8, py: 0.2 }}>
                  <Typography variant="caption" sx={{ fontSize: 10 }}>45</Typography>
                </Box>

                {/* 3조 각각 SC / Stage / Amount */}
                {[1, 2, 3].map((g) => (
                  <Box key={g} sx={{ display: "flex", gap: 0.3 }}>
                    <Box sx={{ border: "1px solid rgba(255,255,255,0.2)", px: 0.6, py: 0.2 }}>
                      <Typography variant="caption" sx={{ fontSize: 10 }}>SC{g}</Typography>
                    </Box>
                    <Box sx={{ border: "1px solid rgba(255,255,255,0.2)", px: 0.6, py: 0.2 }}>
                      <Typography variant="caption" sx={{ fontSize: 10 }}>9S</Typography>
                    </Box>
                    <Box sx={{ border: "1px solid rgba(255,255,255,0.2)", px: 0.6, py: 0.2 }}>
                      <Typography variant="caption" sx={{ fontSize: 10 }}>150000P</Typography>
                    </Box>
                  </Box>
                ))}

                <Box sx={{ flexGrow: 1 }} />
              </Box>

              {/* 3조 격자 - table */}
              {(() => {
                const colsPerRow = 30;
                const totalCols = colsPerRow + 2;
                const tdStyle = { width: cellSize, height: cellSize, border: "1px solid #555", padding: 0, textAlign: "center" };
                const circleStyle = (val) => ({
                  width: cellSize - 2, height: cellSize - 2, borderRadius: "50%",
                  backgroundColor: val === "P" ? "#1565c0" : "#f44336",
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  color: "#fff", fontSize: 9, fontWeight: "bold",
                });
                return (
                  <table style={{ borderCollapse: "collapse", borderSpacing: 0 }}>
                    <tbody>
                      {[0, 1, 2].map((gi) => {
                        const groupSeq = generatePatternSequence(pat, 60 - gi);
                        const row1 = groupSeq.slice(0, colsPerRow - gi);
                        const row2 = groupSeq.slice(colsPerRow - gi);
                        return [
                          // 조 사이 2px 간격 (첫 조 제외)
                          gi > 0 && <tr key={`${gi}-gap`}><td colSpan={totalCols} style={{ height: 4, padding: 0 }} /></tr>,
                          <tr key={`${gi}-0`}>
                            {Array.from({ length: totalCols }, (_, colIdx) => {
                              const dataIdx = colIdx - gi;
                              const hasData = dataIdx >= 0 && dataIdx < row1.length;
                              const isEmpty = colIdx < gi;
                              const roundNum = gi + 1 + dataIdx;
                              const isGroupEnd = hasData && (roundNum - gi) % 3 === 0;
                              const style = hasData || isEmpty
                                ? { ...tdStyle, ...(isGroupEnd && { borderRight: "2px solid #aaa" }) }
                                : { ...tdStyle, border: "none" };
                              return (
                                <td key={colIdx} style={style}>
                                  {hasData && <div style={circleStyle(row1[dataIdx])}>{roundNum}</div>}
                                </td>
                              );
                            })}
                          </tr>,
                          <tr key={`${gi}-1`}>
                            {Array.from({ length: totalCols }, (_, colIdx) => {
                              const hasData = colIdx < row2.length;
                              const roundNum = gi + 1 + (colsPerRow - gi) + colIdx;
                              const isGroupEnd = hasData && (roundNum - gi) % 3 === 0;
                              const style = hasData
                                ? { ...tdStyle, ...(isGroupEnd && { borderRight: "2px solid #aaa" }) }
                                : { ...tdStyle, border: "none" };
                              return (
                                <td key={colIdx} style={style}>
                                  {hasData && <div style={circleStyle(row2[colIdx])}>{roundNum}</div>}
                                </td>
                              );
                            })}
                          </tr>,
                        ];
                      })}
                    </tbody>
                  </table>
                );
              })()}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
