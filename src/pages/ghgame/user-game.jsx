import React, { useState, useEffect, useCallback, useRef } from "react";
import { Box, Typography, useMediaQuery, useTheme, Dialog, DialogTitle, DialogContent, DialogActions, Button, Tooltip, Snackbar, Alert } from "@mui/material";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAtomValue } from "jotai";
import { userAtom } from "@/store/auth-store";
import apiCaller from "@/services/api-caller";
import autoService from "@/services/auto-service";
import AutoStartDialog from "../t9game/components/AutoStartDialog";
import GhStrategyBoard from "./components/GhStrategyBoard";
import GhBigRoad2 from "./components/GhBigRoad2";
import { GH_GAMES_API, USER_BET_SETTINGS_API } from "@/constants/api-url";

// blink 애니메이션
const blinkKeyframes = `@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.2; } }`;
if (typeof document !== "undefined" && !document.getElementById("gh-blink-style")) {
  const style = document.createElement("style");
  style.id = "gh-blink-style";
  style.textContent = blinkKeyframes;
  document.head.appendChild(style);
}

const LSC_COLOR = "#000000";  // LSC: 검정 (모든 배경에서 고대비)
const DS_COLOR = "#FF6600";   // 데칼/그림자: 형광 주황
const NC_REF_LOCK_KEY = "gh_nc_ref_locked_game_seq";

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
        border: "1px solid", borderColor: colors[type],
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
    const decalShadow = !!results[i].decalShadow;
    if (prevValue === null) {
      grid[row][col] = { type: current, status, idx: i, decalShadow };
      verticalStartCol = col;
    } else if (current === prevValue) {
      if (isBent) { col++; }
      else if (row >= GRID_ROWS - 1) { col++; isBent = true; }
      else if (grid[row + 1][col]) { col++; isBent = true; }
      else { row++; }
      if (col >= GRID_COLS) break;
      grid[row][col] = { type: current, status, idx: i, decalShadow };
    } else {
      verticalStartCol++;
      col = verticalStartCol;
      row = 0;
      isBent = false;
      if (col >= GRID_COLS) break;
      grid[row][col] = { type: current, status, idx: i, decalShadow };
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

const buildResultRows = ({
  seq = "",
  roundState,
  picks = [],
  statuses = [],
  statusesAr = [],
  dsMarks = [],
}) => {
  const storedShoeResults = roundState?.shoe_results;
  const shoeValues = Array.isArray(storedShoeResults)
    ? storedShoeResults
      .map((item) => typeof item === "string" ? item : item?.actual)
      .filter((value) => value === "P" || value === "B" || value === "T")
    : [];
  const values = shoeValues.length > 0 ? shoeValues : String(seq || "").split("");
  let strategyIdx = 0;
  return values.map((value) => {
    if (value === "T") {
      return { value, status: "wait", statusAr: "wait", aPick: null, decalShadow: false };
    }
    const idx = strategyIdx++;
    return {
      value,
      status: statuses[idx] || "wait",
      statusAr: statusesAr[idx] || "wait",
      aPick: picks[idx] || null,
      decalShadow: !!(dsMarks[idx]?.decal_pick || dsMarks[idx]?.shadow_pick),
    };
  });
};

function RoundAmountTable({
  roundState,
  amountMode,
  onSetup,
  setupDisabled = false,
  onNew,
  newDisabled = false,
  labHmDisabled = true,
  labHmPressed,
  onLabouchereHit,
  onLabouchereMiss,
  gameSlots = [],
  selectedSlotNo,
  onSlotSelect,
  slotBusy = false,
  onEnd,
  endDisabled = true,
  endDisabledReason,
}) {
  const table = roundState?.round_amount_table || {};
  const actualTable = roundState?.actual_bet_table || {};
  const toolbarButtons = [
    {
      label: "H",
      backgroundColor: "#2e7d32",
      pressed: labHmPressed === "H",
      onClick: onLabouchereHit,
      disabled: labHmDisabled,
      title: "라보 H: 양끝 제거, PnL +베팅액",
    },
    {
      label: "M",
      backgroundColor: "#c62828",
      pressed: labHmPressed === "M",
      onClick: onLabouchereMiss,
      disabled: labHmDisabled,
      title: "라보 M: 끝에 베팅액 추가, PnL -베팅액",
    },
    ...Array.from({ length: 6 }, (_, idx) => {
      const slotNo = idx + 1;
      const slot = gameSlots.find((item) => item.slot_no === slotNo);
      const selected = selectedSlotNo === slotNo;
      const hasError = slot?.phase === "error" || slot?.auto_status === "error";
      return {
        label: String(slotNo),
        active: selected,
        backgroundColor: selected
          ? "#16365c"
          : hasError
            ? "#5b2020"
            : slot?.auto_running
              ? "#17482f"
              : slot?.occupied
                ? "#252a31"
                : "#101318",
        color: selected ? "#2f9bff" : slot?.auto_running ? "#00e676" : "#fff",
        blink: hasError,
        onClick: () => onSlotSelect?.(slotNo),
        disabled: slotBusy,
        title: slot?.occupied
          ? `${slotNo}번 게임 #${slot.game_id}${slot.table_name ? ` / ${slot.table_name}` : ""}`
          : `${slotNo}번 빈 슬롯 — 새 게임 시작`,
      };
    }),
    {
      label: "셋",
      accent: "#ff9800",
      onClick: onSetup,
      disabled: setupDisabled,
      title: setupDisabled ? "관리자 전용 설정" : "배팅 설정",
    },
    { label: "뉴", accent: "#2f9bff", onClick: onNew, disabled: newDisabled },
    {
      label: "끝",
      accent: "#d32f2f",
      onClick: onEnd,
      disabled: endDisabled,
      title: endDisabled ? endDisabledReason : "현재 게임 종료 후 슬롯 비우기",
    },
  ];
  const cellCount = 80;
  const strategyCells = table.cells || [];
  const actualCells = actualTable.cells || [];
  const cells = Array.from({ length: cellCount }, (_, idx) => {
    const strategyCell = strategyCells[idx] || {
      round: idx + 1,
      amount: 0,
      pnl: 0,
      status: null,
      actual: null,
      pick: null,
    };
    if (amountMode !== "actual") return strategyCell;
    const actualCell = actualCells[idx] || {};
    return {
      ...strategyCell,
      amount: Number(actualCell.bet_amount_p || 0),
      pnl: Number(actualCell.actual_pnl_p || 0),
      betPlaced: !!actualCell.bet_placed,
      settled: !!actualCell.settled,
      failureCode: actualCell.failure_code || null,
    };
  });
  const fmt = (v) => v === "N/A" ? "-" : Number(v || 0).toFixed(1);
  const finalSide = table.total_side;
  const totalAmount = amountMode === "actual"
    ? Number(actualTable.total_amount_p || 0)
    : Number(table.total_amount || 0);
  const totalPnl = amountMode === "actual"
    ? Number(actualTable.total_pnl_p || 0)
    : Number(table.total_pnl || 0);
  const finalSideColor = finalSide === "P" ? "#1565d8" : finalSide === "B" ? "#e53935" : "#555";
  const cellSx = (idx) => {
    const cell = cells[idx] || {};
    const hasResult = !!cell.actual;
    const hasJudgement = cell.status === "hit" || cell.status === "miss";
    return {
      width: 84,
      height: 31,
      border: "1px solid #3f4650",
      // 실제 배팅 여부와 픽 판정은 별개다. 실 모드에서 금액이 0이어도
      // 배팅금액판 픽의 hit/miss 결과 색상은 그대로 보여준다.
      backgroundColor: hasResult && hasJudgement
        ? (cell.status === "hit" ? "#2e9e5b" : "#5b6068")
        : "#101318",
      display: "grid",
      gridTemplateColumns: "22px 1fr",
      alignItems: "center",
      overflow: "hidden",
    };
  };
  const roundColor = (idx) => {
    const v = cells[idx]?.pick ?? cells[idx]?.side;
    if (v === "P") return "#1565d8";
    if (v === "B") return "#e53935";
    return "#777";
  };
  return (
    <Box sx={{ flex: "0 0 auto", display: "flex", flexDirection: "column", gap: 1.4, p: 0.5, backgroundColor: "#0d1014", borderRadius: 1 }}>
      <Box sx={{ display: "flex", alignItems: "stretch", gap: 0.5, width: "100%" }}>
        {toolbarButtons.map(({
          label,
          color,
          active,
          accent,
          backgroundColor,
          pressed,
          blink,
          onClick,
          disabled,
          title,
        }) => (
          <Box
            key={label}
            aria-label={label}
            title={title}
            role={onClick ? "button" : undefined}
            tabIndex={onClick && !disabled ? 0 : undefined}
            onClick={onClick && !disabled ? onClick : undefined}
            onKeyDown={onClick && !disabled ? (event) => {
              if (event.key === "Enter" || event.key === " ") onClick();
            } : undefined}
            sx={{
              width: 32,
              minWidth: 32,
              height: 32,
              border: `1px solid ${accent || "#707781"}`,
              borderRadius: 1,
              backgroundColor: pressed
                ? "#ffeb3b"
                : backgroundColor || (active ? "#16365c" : accent ? `${accent}33` : "#101318"),
              color: pressed ? "#1b1b1b" : color || (active ? "#2f9bff" : "#fff"),
              boxShadow: pressed ? "0 0 8px #ffeb3b, 0 0 16px rgba(255,235,59,0.6)" : "none",
              transform: pressed ? "scale(0.95)" : "none",
              transition: "background-color 0.15s, box-shadow 0.15s, transform 0.15s, color 0.15s",
              ...(blink ? { animation: "blink 0.8s infinite" } : {}),
              fontSize: label.length > 2 ? 10 : 13,
              fontWeight: "bold",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              userSelect: "none",
              cursor: disabled ? "not-allowed" : onClick ? "pointer" : "default",
              opacity: disabled ? 0.4 : 1,
            }}
          >
            {label}
          </Box>
        ))}
        <Box sx={{ width: 28, border: "1px solid #3f4650", backgroundColor: finalSideColor, color: "#fff", fontSize: 13, fontWeight: "bold", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {finalSide || "-"}
        </Box>
        <Box sx={{ flex: 1, minWidth: 112, border: "1px solid #3f4650", backgroundColor: "#111821", color: "#fff", fontSize: 11, fontWeight: "bold", px: 0.75, py: 0.35, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span>합산</span><span>{fmt(totalAmount)}</span>
        </Box>
        <Box sx={{ flex: 1, minWidth: 112, border: "1px solid #3f4650", backgroundColor: "#111821", color: totalPnl >= 0 ? "#00e676" : "#ef5350", fontSize: 11, fontWeight: "bold", px: 0.75, py: 0.35, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span>PnL</span><span>{fmt(totalPnl)}</span>
        </Box>
      </Box>
      <Box sx={{ display: "grid", gridTemplateRows: "repeat(10, 31px)", gridAutoFlow: "column", gridAutoColumns: "84px", gap: "2px" }}>
        {Array.from({ length: cellCount }, (_, idx) => (
          <Box key={idx} sx={cellSx(idx)} title={`${idx + 1}회차 / ${amountMode === "actual" ? "실제" : "계산"} ${fmt(cells[idx]?.amount)}P / PnL ${fmt(cells[idx]?.pnl)}P`}>
            <Box sx={{ color: roundColor(idx), fontSize: 10, fontWeight: "bold", textAlign: "center" }}>{idx + 1}</Box>
            <Box sx={{ color: "#fff", fontSize: 11, fontWeight: "bold", textAlign: "right", pr: 0.4 }}>{fmt(cells[idx]?.amount)}</Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function applyActualBetAttempt(roundState, data) {
  if (!roundState) return roundState;
  const table = roundState.actual_bet_table || {};
  const cells = Array.from({ length: 80 }, (_, idx) => (
    table.cells?.[idx] || {
      round: idx + 1,
      bet_amount_won: 0,
      bet_amount_p: 0,
      actual_pnl_won: 0,
      actual_pnl_p: 0,
      bet_placed: false,
      settled: false,
    }
  ));
  const idx = Math.min(Math.max(0, Number(roundState.round_num || 0)), cells.length - 1);
  const previous = cells[idx] || {};
  const placed = !!data.placed;
  const amountWon = placed ? Number(data.amount_won || 0) : 0;
  const amountP = placed ? Number(data.amount_p || 0) : 0;
  cells[idx] = {
    ...previous,
    round: idx + 1,
    external_game_id: data.ext_game_id || null,
    bet_side: data.direction || null,
    bet_amount_won: amountWon,
    bet_amount_p: amountP,
    actual_pnl_won: 0,
    actual_pnl_p: 0,
    bet_placed: placed,
    settled: false,
    failure_code: data.code || null,
  };
  return {
    ...roundState,
    actual_bet_table: {
      ...table,
      has_auto_history: true,
      cells,
      total_amount_won: Number(table.total_amount_won || 0)
        - Number(previous.bet_amount_won || 0)
        + amountWon,
      total_amount_p: Number(table.total_amount_p || 0)
        - Number(previous.bet_amount_p || 0)
        + amountP,
    },
  };
}

function applyActualBetSettlement(roundState, data) {
  if (!roundState?.actual_bet_table?.cells) return roundState;
  const table = roundState.actual_bet_table;
  const cells = [...table.cells];
  const idx = cells.findIndex(
    (cell) => cell?.external_game_id === data.external_game_id,
  );
  if (idx < 0) return roundState;
  const previous = cells[idx] || {};
  const pnlWon = Number(data.actual_pnl_won || 0);
  const pnlP = Number(data.actual_pnl_p || 0);
  cells[idx] = {
    ...previous,
    actual_pnl_won: pnlWon,
    actual_pnl_p: pnlP,
    settled: true,
  };
  return {
    ...roundState,
    actual_bet_table: {
      ...table,
      cells,
      total_pnl_won: Number(table.total_pnl_won || 0)
        - Number(previous.actual_pnl_won || 0)
        + pnlWon,
      total_pnl_p: Number(table.total_pnl_p || 0)
        - Number(previous.actual_pnl_p || 0)
        + pnlP,
    },
  };
}

function GhBettingSummaryPanel({
  roundState,
  selectedMode,
  onModeChange,
  autoStatus,
  onPlay,
  autoError,
  disabled = false,
}) {
  const storedShoeResults = roundState?.shoe_results;
  const normalizedResults = (
    Array.isArray(storedShoeResults)
      ? storedShoeResults
      : typeof storedShoeResults === "string"
        ? storedShoeResults.split("")
        : []
  )
    .map((item) => typeof item === "string" ? item : item?.actual)
    .filter((value) => value === "P" || value === "B" || value === "T");
  const counts = normalizedResults.reduce(
    (acc, value) => ({ ...acc, [value]: acc[value] + 1 }),
    { P: 0, B: 0, T: 0 },
  );
  const pickMartin = roundState?.pick_martin;
  const step = pickMartin?.step || 1;
  const amount = pickMartin?.amount ?? 0;
  const pickMartinBorder = pickMartin?.direction === "P"
    ? "#1565c0"
    : pickMartin?.direction === "B"
      ? "#f44336"
      : "#7f7f7f";
  const pickMartinBackground = pickMartin?.direction === "P"
    ? "rgba(21, 101, 192, 0.32)"
    : pickMartin?.direction === "B"
      ? "rgba(244, 67, 54, 0.32)"
      : "#080a0d";
  const yukmaeBoardRows = 6;
  const yukmaeBoardColumns = 13;
  const markerColor = { P: "#1565d8", B: "#f44336", T: "#00a85a" };
  const hasAutoError = autoStatus?.phase === "error" || !!autoError;
  const errorCode = autoStatus?.error_code || autoError?.code || "auto_error";
  const errorDetail = autoStatus?.error_detail || autoError?.detail || "자동게임 처리 중 오류가 발생했습니다.";
  const autoStateCell = hasAutoError
    ? { text: "error", error: true, tooltip: `[${errorCode}] ${errorDetail}` }
    : autoStatus?.running
      ? { text: "ok", autoOk: true }
      : { text: "" };
  const phaseAbbr = {
    monitoring: "MON",
    betting: "BET",
    clearing: "CLR",
    completed: "DONE",
    error: "ERR",
    stopped: "STOP",
  };
  const autoPhase = hasAutoError ? "ERR" : phaseAbbr[autoStatus?.phase] || "—";
  const autoPnl = Number(autoStatus?.pnl_actual_p || 0);
  const autoPnlText = `${autoPnl.toLocaleString(undefined, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}P`;
  const statusCells = [
    { text: "guide" },
    { text: "one", selection: "one" },
    autoStateCell,
    { text: `${autoPhase} ${autoPnlText}`, autoInfo: true },
    { text: "keep", selection: "keep" },
    {
      text: autoStatus?.running ? "stop" : "play",
      play: true,
      stop: !!autoStatus?.running,
    },
  ];

  return (
    <Box sx={{ width: "fit-content", maxWidth: "100%", mb: 2 }}>
      <Box sx={{ display: "flex", alignItems: "stretch", gap: 1, mb: 1 }}>
        <Box sx={{ width: 135, display: "flex", flexDirection: "column", gap: 0.5 }}>
          <Box sx={{
            width: "100%",
            height: 38,
            border: `2px solid ${pickMartinBorder}`,
            borderRadius: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-around",
            backgroundColor: pickMartinBackground,
            color: "#aaa",
            fontSize: 13,
            fontWeight: "bold",
          }}>
            <span>{step}S</span>
            <span>{Number(amount || 0).toFixed(1)}P</span>
          </Box>

          <Box sx={{
            width: "100%",
            height: 36,
            border: "2px solid #9aa2ad",
            backgroundColor: "#080a0d",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 0.5,
            fontSize: 17,
            fontWeight: "bold",
          }}>
            <span style={{ color: "#fff" }}>{normalizedResults.length}</span>
            <span style={{ color: "#2f80ed" }}>-</span>
            <span style={{ color: "#2f80ed" }}>{counts.P}</span>
            <span style={{ color: "#2f80ed" }}>-</span>
            <span style={{ color: "#f44336" }}>{counts.B}</span>
            <span style={{ color: "#2f80ed" }}>-</span>
            <span style={{ color: "#00a85a" }}>{counts.T}</span>
          </Box>
        </Box>

        <Box sx={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 76px)",
          gridTemplateRows: "repeat(2, 38px)",
          borderTop: "1px solid #707781",
          borderLeft: "1px solid #707781",
          backgroundColor: "#080a0d",
        }}>
          {statusCells.map((cell, idx) => {
            const selected = cell.selection === selectedMode;
            const selectable = !!cell.selection && !autoStatus?.running;
            const clickable = !disabled && (selectable || !!cell.play);
            const activate = () => {
              if (selectable) onModeChange?.(cell.selection);
              if (cell.play) onPlay?.();
            };
            return (
              <Tooltip key={idx} title={cell.tooltip || ""} enterTouchDelay={0} arrow>
              <Box
                role={clickable ? "button" : undefined}
                tabIndex={clickable ? 0 : undefined}
                aria-pressed={selectable ? selected : undefined}
                onClick={clickable ? activate : undefined}
                onKeyDown={clickable ? (event) => {
                  if (event.key === "Enter" || event.key === " ") activate();
                } : undefined}
                sx={{
                  borderRight: "1px solid #707781",
                  borderBottom: "1px solid #707781",
                  backgroundColor: cell.stop ? "#4a1717" : selected || cell.autoOk ? "#16365c" : cell.error ? "#ffeb3b" : "#080a0d",
                  color: cell.stop ? "#ff5b5b" : selected || cell.autoOk ? "#2f80ed" : cell.error ? "#111" : "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: cell.autoInfo ? 10 : 15,
                  fontWeight: cell.autoInfo ? "bold" : undefined,
                  cursor: clickable ? "pointer" : cell.error ? "help" : "default",
                  opacity: disabled && cell.play ? 0.4 : 1,
                  userSelect: "none",
                  ...(cell.error && {
                    fontWeight: "bold",
                    animation: "autoErrorBlink 0.8s steps(2, end) infinite",
                    "@keyframes autoErrorBlink": {
                      "0%, 100%": { backgroundColor: "#ffeb3b", color: "#111" },
                      "50%": { backgroundColor: "#080a0d", color: "#ffeb3b" },
                    },
                  }),
                }}
              >
                {cell.text}
              </Box>
              </Tooltip>
            );
          })}
        </Box>
      </Box>

      {/* 육매판 — P/B/T 결과 로드맵 (6행 × 13열) */}
      <Box sx={{
        width: "fit-content",
        p: 1.25,
        borderRadius: 4,
        backgroundColor: "#fff",
        overflowX: "auto",
      }}>
        <Box sx={{
          display: "grid",
          gridTemplateColumns: `repeat(${yukmaeBoardColumns}, 27px)`,
          gridTemplateRows: `repeat(${yukmaeBoardRows}, 27px)`,
          gridAutoFlow: "column",
          borderTop: "1px solid #d6d9dd",
          borderLeft: "1px solid #d6d9dd",
          width: "fit-content",
        }}>
          {Array.from({ length: yukmaeBoardColumns * yukmaeBoardRows }, (_, idx) => {
            const value = normalizedResults[idx];
            return (
              <Box
                key={idx}
                sx={{
                  width: 27,
                  height: 27,
                  borderRight: "1px solid #d6d9dd",
                  borderBottom: "1px solid #d6d9dd",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {value && (
                  <Box sx={{
                    width: 23,
                    height: 23,
                    borderRadius: "50%",
                    backgroundColor: markerColor[value],
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 13,
                    fontWeight: "bold",
                  }}>
                    {value}
                  </Box>
                )}
              </Box>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
}

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
  const [topGhSections, setTopGhSections] = useState([]);
  const [topNextRound, setTopNextRound] = useState(null);
  const [lscMatches, setLscMatches] = useState([]);
  const [decalPick, setDecalPick] = useState(null);
  const [shadowPick, setShadowPick] = useState(null);
  const [decalAxis, setDecalAxis] = useState(null);
  const [shadowAxis, setShadowAxis] = useState(null);
  const [roundDsList, setRoundDsList] = useState([]);
  const [lscPick, setLscPick] = useState(null);
  const [roundLscList, setRoundLscList] = useState([]);
  const [twoPick, setTwoPick] = useState(null);
  const [roundTwoList, setRoundTwoList] = useState([]);
  // DO NOT USE FOR NEW UI: picks_snapshot은 서버 상태 갱신 입력 전용 레거시 payload다.
  // 상단 운영 화면과 하단 분석 화면은 각각 분리된 round_state 응답만 사용한다.
  // 기존 보조 컴포넌트가 아직 남아 있어 state로 보관하지만, 신규 참조를 추가하지 말 것.
  const [picksSnapshot, setPicksSnapshot] = useState(null);
  const [roundStateUpper, setRoundStateUpper] = useState(null);
  const [roundStateLower, setRoundStateLower] = useState(null);
  const roundState = roundStateUpper;
  const [batExpanded, setBatExpanded] = useState({}); // {`gi-ri`: true} — Bat 셀 전체 표시 토글
  const [trackStreakHidden, setTrackStreakHidden] = useState({}); // {sckey: true} — 트랙 연승/연패 셀 숨김 토글
  const [betData, setBetData] = useState(null);
  const [gameId, setGameId] = useState(null);
  const [config, setConfig] = useState(null);
  const [cumPnL, setCumPnL] = useState({ gh: 0, user_a: 0, user_z: 0, user_s: 0, allp: 0, allb: 0, fail: 0, hnh: 0, one: 0, two: 0, labouchere: 0 });
  const [showNewConfirm, setShowNewConfirm] = useState(false);
  const [resumeGame, setResumeGame] = useState(null);
  const [userSummary, setUserSummary] = useState(null);
  const [userMartinDashboard, setUserMartinDashboard] = useState(null);
  const [labSeqOpen, setLabSeqOpen] = useState(false);
  const [labHmPressed, setLabHmPressed] = useState(null); // "H" | "M" | null
  const [gameSlots, setGameSlots] = useState([]);
  const [selectedSlotNo, setSelectedSlotNo] = useState(null);
  const [slotBusy, setSlotBusy] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const processingRef = useRef(false);
  const skipRestoreGameIdRef = useRef(null);
  const [processing, setProcessing] = useState(false);
  const goalAlertedRef = useRef({ a: false, z: false });

  const [goalDialog, setGoalDialog] = useState({ open: false, msgs: [] });

  // Auto 모드 (pick-aboo 통합) — t9game/index.jsx에서 포팅
  const [autoFeatureAvailable, setAutoFeatureAvailable] = useState(true);
  const [autoDialogOpen, setAutoDialogOpen] = useState(false);
  const [autoStatus, setAutoStatus] = useState({ running: false, autoSessionId: null });
  const [autoPlayMode, setAutoPlayMode] = useState("one");
  const [amountViewMode, setAmountViewMode] = useState("calculated");
  const [autoError, setAutoError] = useState(null);
  const [rejectMsg, setRejectMsg] = useState(null);  // 베팅 거부 레이어 팝업
  const [legacyRestoreBlocked, setLegacyRestoreBlocked] = useState(false);
  const [myPickhandId, setMyPickhandId] = useState(null);
  const [ncRefDraft, setNcRefDraft] = useState(() => (typeof window !== "undefined" ? localStorage.getItem(NC_REF_LOCK_KEY) || "" : ""));
  const [ncRefOriginal, setNcRefOriginal] = useState("");
  const [ncRefLocked, setNcRefLocked] = useState(() => !!(typeof window !== "undefined" && localStorage.getItem(NC_REF_LOCK_KEY)));
  const [ncRefBusy, setNcRefBusy] = useState(false);

  const strategyResults = results.filter((result) => result.value === "P" || result.value === "B");
  const currentTurn = strategyResults.length + 1;
  const ncRefDirty = String(ncRefDraft || "") !== String(ncRefOriginal || "");
  const syncNcRefNo = useCallback((state) => {
    const no = state?.nc_ref_shoe_no;
    if (no === undefined || no === null) return;
    const value = String(no);
    setNcRefOriginal(value);
    setNcRefDraft(value);
  }, []);
  const inputLocked = processing || legacyRestoreBlocked;
  // LEGACY COMPAT ONLY: displaySnapshot 별칭은 남은 레거시 보조표용이다.
  // 새 화면/상태 판단/픽 표시/닷 표시에는 사용 금지. 필요한 데이터는 서버에서 roundState에 추가한다.
  const displaySnapshot = picksSnapshot;
  const roundAmountCells = roundState?.round_amount_table?.cells || [];
  useEffect(() => {
    const no = roundState?.nc_ref_shoe_no;
    if (no === undefined || no === null || ncRefDirty) return;
    syncNcRefNo(roundState);
  }, [roundState?.nc_ref_shoe_no]);
  const amountTableStatusFor = (idx) => {
    const cell = roundAmountCells[idx] || {};
    const pick = cell.pick ?? cell.side;
    const actual = cell.actual ?? strategyResults[idx]?.value;
    if (cell.status === "hit" || cell.status === "miss") return cell.status;
    if ((pick === "P" || pick === "B") && (actual === "P" || actual === "B")) {
      return pick === actual ? "hit" : "miss";
    }
    return "wait";
  };
  // 빅로드1: 지난 회차의 실제 결과 P/B를 표시하고, 배경색은 금액 합산표의 적/미적으로 결정한다.
  const gridResults = strategyResults.map((r, i) => ({ ...r, status: amountTableStatusFor(i) }));
  const grid = calculateCircleGrid(gridResults);

  // LEGACY COMPAT ONLY: 하단 보조 표시용. 현재 판/전략보드/빅로드 표시는 roundState 사용.
  const roundArList = displaySnapshot?.round_picks?.AR || [];
  const roundJList = displaySnapshot?.round_picks?.J || [];

  const checkGoalAlert = useCallback((summary, strategyGoals) => {
    const ref = goalAlertedRef.current;
    const aReached = summary?.martin_a?.goal_reached;
    const zReached = summary?.martin_z?.goal_reached;
    const msgs = [];
    if (aReached && !ref.a) msgs.push("마틴 A");
    if (zReached && !ref.z) msgs.push("마틴 Z");
    ref.a = !!aReached;
    ref.z = !!zReached;
    const goalLabels = {
      AAR: "A멀티", SSR1: "S1세트", SSR2: "S2세트", SSR3: "S3세트",
      FOR: "FOR세트", FORX: "FORX세트", SQ: "SQ세트",
      GOBH: "GH 시리즈", GOBP: "G% 시리즈",
      "허니비": "허니비", W111: "위너히트", M22: "메가히트", D112: "드림히트", NC: "나이스초이스",
    };
    Object.entries(strategyGoals || {}).forEach(([key, goal]) => {
      const refKey = `strategy:${key}`;
      if (goal?.reached && !ref[refKey]) msgs.push(goalLabels[key] || key);
      ref[refKey] = !!goal?.reached;
    });
    if (msgs.length > 0) setGoalDialog({ open: true, msgs });
  }, []);

  const displayPick = (() => {
    const umComb = betData?.user_martin?.combined?.direction;
    if (umComb && umComb !== "wait") return umComb;
    const adComb = betData?.combined?.direction;
    return adComb && adComb !== "wait" ? adComb : null;
  })();
  const pickImage = displayPick === "P" ? "/player.png" : displayPick === "B" ? "/banker.png" : "/wait.png";

  const applyGameData = useCallback((data) => {
    setLegacyRestoreBlocked(false);
    setGameId(data.game_id);
    setConfig(data.config);
    setCumPnL(data.cum_pnl || { gh: 0, user_a: 0, user_z: 0, user_s: 0, allp: 0, allb: 0, fail: 0, hnh: 0, one: 0, two: 0, labouchere: 0 });
    const seq = data.seq || "";
    const picks = data.round_picks || [];
    const statuses = data.round_status || [];
    const statusesAr = data.round_status_ar || [];
    const dsMarks = data.round_decal_shadow || [];
    setResults(buildResultRows({
      seq,
      roundState: data.round_state_upper,
      picks,
      statuses,
      statusesAr,
      dsMarks,
    }));
    setGlobalhitData(data.globalhit || []);
    setTopGhSections(data.top_gh_sections || []); setTopNextRound(data.top_next_round ?? null); setLscMatches(data.lsc_matches || []); setLscPick(data.lsc_pick ?? null); setRoundLscList(data.round_lsc_picks || []); setTwoPick(data.two_pick ?? null); setRoundTwoList(data.round_two_picks || []); setPicksSnapshot(data.picks_snapshot || null); setRoundStateUpper(data.round_state_upper || null); setRoundStateLower(data.round_state_lower || null); setDecalPick(data.decal_pick ?? null); setShadowPick(data.shadow_pick ?? null); setDecalAxis(data.decal_axis ?? null); setShadowAxis(data.shadow_axis ?? null); setRoundDsList(data.round_decal_shadow || []);
    syncNcRefNo(data.round_state_upper);
    setBetData(data.bet ? { ...data.bet, user_martin: data.user_martin } : null);
    setUserSummary(data.user_summary || null);
    setUserMartinDashboard(data.user_martin_dashboard || null);
  }, [syncNcRefNo]);

  const refreshGameSlots = useCallback(async () => {
    const res = await apiCaller.get(GH_GAMES_API.SLOTS);
    const slots = Array.isArray(res.data?.slots) ? res.data.slots : [];
    setGameSlots(slots);
    return slots;
  }, []);

  const startGame = useCallback(async ({ slotNo = null, replaceGameId = null } = {}) => {
    try {
      goalAlertedRef.current = { a: false, z: false };
      const body = slotNo
        ? { slot_no: slotNo, replace_game_id: replaceGameId || null }
        : null;
      const res = await apiCaller.post(GH_GAMES_API.START + "?mode=user", body);
      const lockedNcRef = typeof window !== "undefined" ? localStorage.getItem(NC_REF_LOCK_KEY) : null;
      let lockedApplied = false;
      if (lockedNcRef) {
        try {
          await apiCaller.post(GH_GAMES_API.NC_REF(res.data.game_id), { game_seq: Number(lockedNcRef) });
          const stateRes = await apiCaller.get(GH_GAMES_API.STATE(res.data.game_id) + "?mode=user");
          applyGameData(stateRes.data);
          lockedApplied = true;
        } catch (err) {
          localStorage.removeItem(NC_REF_LOCK_KEY);
          setNcRefLocked(false);
          setRejectMsg(err.response?.data?.detail || "고정된 NC 번호를 적용하지 못했습니다.");
        }
      }
      if (!lockedApplied) {
        setLegacyRestoreBlocked(false);
        setGameId(res.data.game_id);
        setConfig(res.data.config);
        setGlobalhitData(res.data.globalhit || []);
        setTopGhSections(res.data.top_gh_sections || []); setTopNextRound(res.data.top_next_round ?? null);
        setPicksSnapshot(res.data.picks_snapshot || null); setRoundStateUpper(res.data.round_state_upper || null); setRoundStateLower(res.data.round_state_lower || null);
        syncNcRefNo(res.data.round_state_upper);
      }
      skipRestoreGameIdRef.current = res.data.game_id;
      setSearchParams({ gameId: res.data.game_id }, { replace: true });
      if (res.data.slot_no) setSelectedSlotNo(res.data.slot_no);
      await refreshGameSlots();
      return res.data;
    } catch (err) {
      console.error("Failed to start game:", err);
      if (err.response?.status === 400) {
        alert(err.response.data?.detail || "배팅 설정이 필요합니다.");
        navigate("/ghgame/user-setup");
        return;
      }
      throw err;
    }
  }, [applyGameData, navigate, refreshGameSlots, setSearchParams, syncNcRefNo]);

  useEffect(() => {
    let cancelled = false;
    const isNew = searchParams.get("new");
    const urlGameId = searchParams.get("gameId");
    const urlSlotNo = Number(searchParams.get("slot"));
    const initialize = async () => {
      try {
        const slots = await refreshGameSlots();
        if (cancelled) return;
        if (isNew) {
          const empty = slots.find((slot) => !slot.occupied);
          if (empty) await startGame({ slotNo: empty.slot_no });
          return;
        }
        if (urlGameId) {
          const gid = parseInt(urlGameId);
          const slot = slots.find((item) => item.game_id === gid);
          setSelectedSlotNo(slot?.slot_no ?? null);
          if (skipRestoreGameIdRef.current === gid) {
            skipRestoreGameIdRef.current = null;
          } else {
            await restoreGame(gid);
          }
          return;
        }
        if (Number.isInteger(urlSlotNo) && urlSlotNo >= 1 && urlSlotNo <= 6) {
          setSelectedSlotNo(urlSlotNo);
          const selected = slots.find((slot) => slot.slot_no === urlSlotNo);
          if (!selected?.occupied) clearCurrentGameView();
          return;
        }
        const firstOccupied = slots.find((slot) => slot.occupied);
        if (firstOccupied) {
          setSelectedSlotNo(firstOccupied.slot_no);
          setSearchParams({ gameId: firstOccupied.game_id }, { replace: true });
          await restoreGame(firstOccupied.game_id);
        }
      } catch (err) {
        if (!cancelled) console.error("Failed to initialize game slots:", err);
      }
    };
    initialize();
    return () => { cancelled = true; };
  }, [searchParams.get("new"), searchParams.get("gameId"), searchParams.get("slot")]);

  const restoreGame = async (gid) => {
    try {
      const res = await apiCaller.get(GH_GAMES_API.STATE(gid) + "?mode=user");
      applyGameData(res.data);
    } catch (err) {
      if (err.response?.status === 409) {
        setGameId(gid);
        setLegacyRestoreBlocked(true);
        setResults([]);
        setBetData(null);
        setUserSummary(null);
        setUserMartinDashboard(null);
        setRoundStateUpper(null);
        setRoundStateLower(null);
        setRejectMsg(err.response?.data?.detail || "이 게임은 복원할 수 없습니다.");
        return;
      }
      console.error("Failed to restore game:", err);
      setRejectMsg("게임판을 불러오지 못했습니다. 슬롯 상태를 다시 확인해주세요.");
      refreshGameSlots().catch(() => {});
    }
  };

  const handleNcRefChange = (value) => {
    setNcRefDraft(value.replace(/[^\d]/g, ""));
    if (ncRefLocked) {
      setNcRefLocked(false);
      if (typeof window !== "undefined") localStorage.removeItem(NC_REF_LOCK_KEY);
    }
  };

  const handleNcRefCancel = () => {
    setNcRefDraft(ncRefOriginal);
  };

  const handleNcRefConfirm = async () => {
    if (!gameId || !ncRefDirty || ncRefBusy) return;
    const nextNo = Number(ncRefDraft);
    if (!Number.isInteger(nextNo) || nextNo <= 0) {
      setRejectMsg("NC 번호를 올바르게 입력해주세요.");
      setNcRefDraft(ncRefOriginal);
      return;
    }
    setNcRefBusy(true);
    try {
      await apiCaller.post(GH_GAMES_API.NC_REF(gameId), { game_seq: nextNo });
      await restoreGame(gameId);
      setNcRefOriginal(String(nextNo));
      setNcRefDraft(String(nextNo));
    } catch (err) {
      setRejectMsg(err.response?.data?.detail || "NC 번호를 적용하지 못했습니다.");
      setNcRefDraft(ncRefOriginal);
    } finally {
      setNcRefBusy(false);
    }
  };

  const handleNcRefLockToggle = () => {
    if (ncRefDirty || ncRefBusy || !ncRefOriginal) return;
    const next = !ncRefLocked;
    setNcRefLocked(next);
    if (typeof window !== "undefined") {
      if (next) localStorage.setItem(NC_REF_LOCK_KEY, ncRefOriginal);
      else localStorage.removeItem(NC_REF_LOCK_KEY);
    }
  };

  // ─── Auto 모드 (pick-aboo 통합) — t9game/index.jsx 패턴 동일 ───
  // pickhand_id: userAtom에서 직접. fallback으로 username 사용
  // (auth-store.js가 로그인 시 username을 pickhand_id로 자동 등록한다는 가정)
  useEffect(() => {
    setMyPickhandId(user?.pickhand_id || user?.username || null);
  }, [user]);

  useEffect(() => {
    setAmountViewMode(autoStatus.running ? "actual" : "calculated");
  }, [autoStatus.running]);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const slots = await refreshGameSlots();
        if (!cancelled && gameId) {
          const current = slots.find((slot) => slot.game_id === Number(gameId));
          if (current) setSelectedSlotNo(current.slot_no);
        }
      } catch (err) {
        if (!cancelled) console.error("Failed to refresh game slots:", err);
      }
    };
    const id = setInterval(tick, 5000);
    return () => { cancelled = true; clearInterval(id); };
  }, [gameId, refreshGameSlots]);

  // Auto 상태 폴링 (1초)
  useEffect(() => {
    if (!gameId || !autoFeatureAvailable) return undefined;
    let cancelled = false;
    const tick = async () => {
      try {
        const st = await autoService.getAutoStatus(gameId);
        if (!cancelled) {
          if (st.running && (st.play_mode === "one" || st.play_mode === "keep")) {
            setAutoPlayMode(st.play_mode);
          }
          setAutoError(st.phase === "error" ? {
            code: st.error_code || "auto_error",
            detail: st.error_detail || "자동게임 처리 중 오류가 발생했습니다.",
          } : null);
          setAutoStatus((prev) => ({
            ...prev,
            running: !!st.running,
            autoSessionId: st.auto_session_id || null,
            lastEventAt: st.last_event_at,
            betsAttempted: st.bets_attempted,
            betsSucceeded: st.bets_succeeded,
            betsFailed: st.bets_failed,
            phase: st.phase ?? prev.phase,
            actual_bet_scale: st.actual_bet_scale ?? prev.actual_bet_scale ?? 1,
            pnl_total: st.pnl_total ?? prev.pnl_total,
            pnl_actual: st.pnl_actual ?? prev.pnl_actual,
            pnl_total_p: st.pnl_total_p ?? prev.pnl_total_p,
            pnl_actual_p: st.pnl_actual_p ?? prev.pnl_actual_p,
            round_count: st.round_count ?? prev.round_count,
            table_name: st.table_name ?? prev.table_name,
            play_mode: st.play_mode ?? prev.play_mode,
            error_code: st.error_code ?? null,
            error_detail: st.error_detail ?? null,
          }));
        }
      } catch (e) {
        if (e?.response?.status === 503) {
          setAutoFeatureAvailable(false);
        } else {
          setAutoError({ code: "status_lookup_failed", detail: "자동게임 상태를 확인하지 못했습니다." });
        }
      }
    };
    tick();
    const id = setInterval(tick, 5000);  // auto-status 폴링 1s → 5s로 완화 (호출량 감소 260603)
    return () => { cancelled = true; clearInterval(id); };
  }, [gameId, autoFeatureAvailable]);

  // ── Auto WebSocket 구독 (실시간 이벤트 푸시) ───────────
  useEffect(() => {
    if (!autoFeatureAvailable) return undefined;
    if (!autoStatus.running) return undefined;
    const token = sessionStorage.getItem("pick_hand_token");
    if (!token) return undefined;

    const base = import.meta.env.VITE_API_BASE_URL || window.location.origin;
    // base가 http://x:9001 → ws://x:9001/ws/auto
    const wsBase = base.replace(/^http/, "ws");
    const wsUrl = `${wsBase}/ws/auto?token=${encodeURIComponent(token)}`;

    let ws;
    let pingTimer;
    let cancelled = false;

    const connect = () => {
      if (cancelled) return;
      ws = new WebSocket(wsUrl);
      ws.onopen = () => {
        setAutoError(null);
        // keepalive ping 30초마다
        pingTimer = setInterval(() => {
          try { ws.send("ping"); } catch (_) {}
        }, 30000);
      };
      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          const t = msg.type;
          const data = msg.data || {};
          if (t !== "pong") {
            const currentGameId = Number(gameId);
            const eventGameId = Number(data.game_id);
            const sourceGameId = Number(data.source_game_id);
            const currentSessionId = autoStatus.autoSessionId;
            const belongsToCurrentAuto = (
              (Number.isFinite(eventGameId) && eventGameId === currentGameId)
              || (Number.isFinite(sourceGameId) && sourceGameId === currentGameId)
              || (currentSessionId && data.auto_session_id === currentSessionId)
              || (currentSessionId && data.source_auto_session_id === currentSessionId)
            );
            if (!belongsToCurrentAuto) return;
          }
          if (t === "round_committed") {
            // 라운드 추가 → restoreGame 호출이 가장 안전 (전체 state 동기화)
            if (data.game_id) restoreGame(data.game_id);
            // autoStatus 동기화 — phase / round_count / pnl_total / pnl_actual
            setAutoStatus((prev) => ({
              ...prev,
              phase: data.phase ?? prev.phase,
              round_count: data.round_count ?? prev.round_count,
              pnl_total: data.pnl_total ?? prev.pnl_total,
              pnl_actual: data.pnl_actual ?? prev.pnl_actual,
              pnl_total_p: data.pnl_total_p ?? prev.pnl_total_p,
              pnl_actual_p: data.pnl_actual_p ?? prev.pnl_actual_p,
            }));
          } else if (t === "shoe_result_recorded") {
            // Tie는 전략 회차를 만들지 않으므로 최신 round_state만 다시 불러온다.
            if (data.game_id) restoreGame(data.game_id);
          } else if (t === "phase_changed") {
            setAutoStatus((prev) => ({
              ...prev,
              phase: data.phase,
              pnl_total: data.pnl_total ?? prev.pnl_total,
              pnl_actual: data.pnl_actual ?? prev.pnl_actual,
              pnl_total_p: data.pnl_total_p ?? prev.pnl_total_p,
              pnl_actual_p: data.pnl_actual_p ?? prev.pnl_actual_p,
              round_count: data.round_count ?? prev.round_count,
            }));
            if (data.game_id && data.game_id !== gameId) {
              setGameId(data.game_id);
              setSearchParams({ gameId: data.game_id }, { replace: true });
            }
          } else if (t === "game_switched") {
            setGameId(data.new_game_id);
            setSearchParams({ gameId: data.new_game_id }, { replace: true });
            restoreGame(data.new_game_id);
          } else if (t === "auto_restarted") {
            // 새 슈에서 Auto 자동 재시작 — 새 session_id로 갱신, running 유지
            setAutoStatus((prev) => ({
              ...prev,
              running: true,
              autoSessionId: data.auto_session_id,
              phase: "betting",
              round_count: 0,
              pnl_total: 0,
              pnl_actual: 0,
              pnl_total_p: 0,
              pnl_actual_p: 0,
            }));
            console.info(`[Auto] 재시작: new_session=${data.auto_session_id} game=${data.game_id}`);
          } else if (t === "bet_attempt") {
            setRoundStateUpper((prev) => applyActualBetAttempt(prev, data));
          } else if (t === "bet_settled") {
            setRoundStateUpper((prev) => applyActualBetSettlement(prev, data));
          } else if (t === "session_ended") {
            const reasonMap = {
              casino_shoe_ended: "카지노 슈 종료",
            };
            console.info(
              `[Auto] 종료: ${reasonMap[data.reason] || data.reason} | 실 PnL=${data.final_pnl_actual} | 라운드=${data.round_count} | 새 게임=${data.new_game_id ?? '생성 실패'}`,
            );
            // running 유지 — 자동 재시작이 따라올 수 있음. 진짜 정지는 status poll(5s)이 잡거나 stop 버튼이 처리.
          } else if (t === "bet_rejected") {
            // 카지노가 베팅을 받지 않음(미체결) → 실 PnL 보정됨. 레이어 팝업 안내.
            setRejectMsg("베팅이 거부되었습니다 (카지노 미체결)");
            if (data.game_id) restoreGame(data.game_id);
          }
        } catch (e) {
          // ignore
        }
      };
      ws.onclose = () => {
        clearInterval(pingTimer);
        if (!cancelled && autoStatus.running) {
          // 자동 재연결 5초
          setTimeout(connect, 5000);
        }
      };
      ws.onerror = () => {
        setAutoError({ code: "realtime_connection_error", detail: "자동게임 실시간 연결에 문제가 발생했습니다." });
        try { ws.close(); } catch (_) {}
      };
    };
    connect();

    return () => {
      cancelled = true;
      clearInterval(pingTimer);
      try { ws && ws.close(); } catch (_) {}
    };

  }, [autoFeatureAvailable, autoStatus.running, autoStatus.autoSessionId, gameId]);

  const handleAutoToggle = async () => {
    if (!autoFeatureAvailable) return;
    if (autoStatus.running && autoStatus.autoSessionId) {
      try {
        await autoService.stopAuto(autoStatus.autoSessionId);
        setAutoStatus({ running: false, autoSessionId: null });
        setAutoError(null);
        await refreshGameSlots();
      } catch (e) {
        console.warn("auto stop failed", e);
        setAutoError({ code: "auto_stop_failed", detail: "자동게임을 정지하지 못했습니다." });
      }
    } else {
      // 새 게임에서 시작하는 게 안전 — 진행 중인 게임이면 경고
      const hasRounds = (results?.length || 0) > 0;
      if (hasRounds) {
        const ok = window.confirm(
          "현재 게임에 이미 진행된 라운드가 있습니다.\n\n" +
          "Auto는 새 게임에서 시작하는 것을 권장합니다.\n" +
          "취소 후 [new] 버튼으로 새 게임을 만든 뒤 다시 시작하세요.\n\n" +
          "그래도 현재 게임에서 진행하시겠습니까?"
        );
        if (!ok) return;
      }
      setAutoDialogOpen(true);
    }
  };

  const handleInput = async (inputValue) => {
    if (!gameId || processingRef.current) return;
    processingRef.current = true;
    setProcessing(true);

    // hit/miss 여부는 서버가 판정해 내려준다(응답의 round_status_current). 입력 직후엔 미정(wait)으로 낙관적 추가 후 응답으로 확정.
    const effectivePick = betData?.user_martin?.combined?.direction || betData?.combined?.direction;
    setResults((prev) => [...prev, { value: inputValue, status: "wait", statusAr: "wait", aPick: effectivePick && effectivePick !== "wait" ? effectivePick : null, decalShadow: decalPick !== null || shadowPick !== null }]);
    setBetData(null);

    try {
      const res = await apiCaller.post(GH_GAMES_API.ROUND, { game_id: gameId, actual: inputValue });
      const data = res.data;
      const nextStrategyRound = results.filter((result) => result.value === "P" || result.value === "B").length + 1;
      if (inputValue !== "T" && data.round_num !== undefined && data.round_num !== nextStrategyRound) {
        alert("서버/클라이언트 불일치가 감지되어 페이지를 리로드합니다.");
        window.location.reload();
        return;
      }
      if (inputValue === "T") {
        setRoundStateUpper(data.round_state_upper || null);
        setRoundStateLower(data.round_state_lower || null);
        return;
      }
      // 방금 입력한 라운드의 hit/miss를 서버 판정값으로 확정 (프론트 자체 계산 안 함)
      if (data.round_status_current) {
        setResults((prev) => prev.map((r, i) => (i === prev.length - 1
          ? { ...r, status: data.round_status_current, statusAr: data.round_status_ar_current || r.statusAr }
          : r)));
      }
      setCumPnL({ gh: data.cum_pnl.gh, user_a: data.cum_pnl.user_a || 0, user_z: data.cum_pnl.user_z || 0, user_s: data.cum_pnl.user_s || 0, allp: data.cum_pnl.allp || 0, allb: data.cum_pnl.allb || 0, fail: data.cum_pnl.fail || 0, hnh: data.cum_pnl.hnh || 0, one: data.cum_pnl.one || 0, two: data.cum_pnl.two || 0, labouchere: data.cum_pnl.labouchere || 0 });
      setGlobalhitData(data.globalhit || []);
      setTopGhSections(data.top_gh_sections || []); setTopNextRound(data.top_next_round ?? null); setLscMatches(data.lsc_matches || []); setLscPick(data.lsc_pick ?? null); setRoundLscList(data.round_lsc_picks || []); setTwoPick(data.two_pick ?? null); setRoundTwoList(data.round_two_picks || []); setPicksSnapshot(data.picks_snapshot || null); setRoundStateUpper(data.round_state_upper || null); setRoundStateLower(data.round_state_lower || null); setDecalPick(data.decal_pick ?? null); setShadowPick(data.shadow_pick ?? null); setDecalAxis(data.decal_axis ?? null); setShadowAxis(data.shadow_axis ?? null); setRoundDsList(data.round_decal_shadow || []);
      setBetData(data.bet ? { ...data.bet, user_martin: data.user_martin } : null);
      setUserSummary(data.user_summary || null);
      setUserMartinDashboard(data.user_martin_dashboard || null);
      checkGoalAlert(data.user_summary, data.round_state_upper?.strategy_goals);

    } catch (err) {
      console.error("Failed to record round:", err);
      setResults((prev) => prev.slice(0, -1));
      if (err.response?.status === 409) {
        setRejectMsg(err.response?.data?.detail || "이 게임은 계속 진행할 수 없습니다.");
        return;
      }
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
      const res = await apiCaller.delete(GH_GAMES_API.LAST_ROUND(gameId));
      const data = res.data;
      if (data.tie_deleted) {
        setResults((prev) => prev.slice(0, -1));
        setRoundStateUpper(data.round_state_upper || null);
        setRoundStateLower(data.round_state_lower || null);
        return;
      }
      if (data.seq !== undefined && Array.isArray(data.round_picks)) {
        const seq = data.seq || "";
        const picks = data.round_picks || [];
        const statuses = data.round_status || [];
        const statusesAr = data.round_status_ar || [];
        const dsMarks = data.round_decal_shadow || [];
        setResults(buildResultRows({
          seq,
          roundState: data.round_state_upper,
          picks,
          statuses,
          statusesAr,
          dsMarks,
        }));
      } else {
        setResults(results.slice(0, -1));
      }
      setCumPnL(data.cum_pnl || { gh: 0, user_a: 0, user_z: 0, user_s: 0, allp: 0, allb: 0, fail: 0, hnh: 0, one: 0, two: 0, labouchere: 0 });
      setGlobalhitData(data.globalhit || []);
      setTopGhSections(data.top_gh_sections || []); setTopNextRound(data.top_next_round ?? null); setLscMatches(data.lsc_matches || []); setLscPick(data.lsc_pick ?? null); setRoundLscList(data.round_lsc_picks || []); setTwoPick(data.two_pick ?? null); setRoundTwoList(data.round_two_picks || []); setPicksSnapshot(data.picks_snapshot || null); setRoundStateUpper(data.round_state_upper || null); setRoundStateLower(data.round_state_lower || null); setDecalPick(data.decal_pick ?? null); setShadowPick(data.shadow_pick ?? null); setDecalAxis(data.decal_axis ?? null); setShadowAxis(data.shadow_axis ?? null); setRoundDsList(data.round_decal_shadow || []);
      setBetData(data.bet ? { ...data.bet, user_martin: data.user_martin } : null);
      setUserSummary(data.user_summary || null);
      setUserMartinDashboard(data.user_martin_dashboard || null);
    } catch (err) {
      console.error("Failed to delete last round:", err);
    } finally {
      processingRef.current = false;
      setProcessing(false);
    }
  }, [gameId, results]);

  const clearCurrentGameView = () => {
    setGameId(null);
    setResults([]);
    setCumPnL({ gh: 0, user_a: 0, user_z: 0, user_s: 0, allp: 0, allb: 0, fail: 0, hnh: 0, one: 0, two: 0, labouchere: 0 });
    setBetData(null);
    setUserSummary(null);
    setUserMartinDashboard(null);
    setGlobalhitData([]);
    setTopGhSections([]);
    setTopNextRound(null);
    setPicksSnapshot(null);
    setRoundStateUpper(null);
    setRoundStateLower(null);
    setLegacyRestoreBlocked(false);
    setAutoStatus({ running: false, autoSessionId: null });
    setAutoError(null);
  };

  const syncAutoStatusFromSlot = (slot) => {
    setAutoStatus({
      running: !!slot?.auto_running,
      autoSessionId: slot?.auto_session_id || null,
      phase: slot?.phase || null,
      table_name: slot?.table_name || null,
      play_mode: slot?.play_mode || "one",
      actual_bet_scale: slot?.actual_bet_scale || 1,
    });
    setAutoError(slot?.phase === "error" ? {
      code: slot.error_code || "auto_error",
      detail: slot.error_detail || "자동게임 처리 중 오류가 발생했습니다.",
    } : null);
  };

  const handleSlotSelect = async (slotNo) => {
    if (slotBusy) return;
    const slot = gameSlots.find((item) => item.slot_no === slotNo);
    setSlotBusy(true);
    try {
      setSelectedSlotNo(slotNo);
      if (slot?.occupied) {
        syncAutoStatusFromSlot(slot);
        skipRestoreGameIdRef.current = slot.game_id;
        setSearchParams({ gameId: slot.game_id }, { replace: true });
        await restoreGame(slot.game_id);
      } else {
        clearCurrentGameView();
        await startGame({ slotNo });
      }
      await refreshGameSlots();
    } catch (err) {
      const code = err.response?.data?.detail?.error;
      setRejectMsg(
        code === "game_slot_occupied"
          ? "다른 요청에서 슬롯이 먼저 사용됐습니다. 슬롯 상태를 새로고침합니다."
          : "게임 슬롯을 전환하지 못했습니다.",
      );
      await refreshGameSlots().catch(() => {});
    } finally {
      setSlotBusy(false);
    }
  };

  // new game: 현재 슬롯에서 carry-over 없이 교체
  const handleNewGameConfirm = async () => {
    setShowNewConfirm(false);
    if (!gameId || !selectedSlotNo || autoStatus.running) return;
    setProcessing(true);
    try {
      await apiCaller.post(GH_GAMES_API.END, null, { params: { game_id: gameId } });
      await startGame({ slotNo: selectedSlotNo, replaceGameId: gameId });
      await refreshGameSlots();
    } catch (err) {
      const code = err.response?.data?.detail?.error;
      setRejectMsg(
        code === "auto_running_stop_first"
          ? "오토를 먼저 정지한 뒤 새 게임을 시작해주세요."
          : "새 게임으로 교체하지 못했습니다.",
      );
    } finally {
      setProcessing(false);
    }
  };

  const handleCloseSlotConfirm = async () => {
    setShowEndConfirm(false);
    if (!selectedSlotNo || !gameId || autoStatus.running || slotBusy) return;
    setSlotBusy(true);
    try {
      await apiCaller.post(GH_GAMES_API.SLOT_CLOSE(selectedSlotNo));
      clearCurrentGameView();
      const remainingSlots = await refreshGameSlots();
      const nextSlot = (
        remainingSlots.find((slot) => slot.occupied && slot.auto_running)
        || remainingSlots.find((slot) => slot.occupied)
      );
      if (nextSlot) {
        setSelectedSlotNo(nextSlot.slot_no);
        syncAutoStatusFromSlot(nextSlot);
        skipRestoreGameIdRef.current = nextSlot.game_id;
        setSearchParams({ gameId: nextSlot.game_id }, { replace: true });
        await restoreGame(nextSlot.game_id);
      }
    } catch (err) {
      const code = err.response?.data?.detail?.error;
      setRejectMsg(
        code === "auto_running_stop_first"
          ? "오토를 먼저 정지해야 게임을 종료할 수 있습니다."
          : code === "primary_game_slot_required"
            ? "1번 슬롯은 종료할 수 없습니다."
          : code === "last_game_slot_required"
            ? "마지막 게임 슬롯은 종료할 수 없습니다."
          : "게임을 종료하지 못했습니다.",
      );
    } finally {
      setSlotBusy(false);
    }
  };

  const labouchere = betData?.user_martin?.labouchere;
  const labouchereSequence = Array.isArray(labouchere?.sequence) ? labouchere.sequence : [];
  const labHmDisabled = (
    !gameId
    || legacyRestoreBlocked
    || !labouchere?.enabled
    || !!labouchere?.paused
    || labouchereSequence.length === 0
    || Number(labouchere?.amount || 0) <= 0
    || processing
    || labHmPressed !== null
  );
  const triggerLabouchereResult = async (which) => {
    if (labHmDisabled) return;
    const url = which === "H"
      ? GH_GAMES_API.LABOUCHERE_HIT(gameId)
      : GH_GAMES_API.LABOUCHERE_MISS(gameId);
    setLabHmPressed(which);
    try {
      await apiCaller.post(url);
      const res = await apiCaller.get(GH_GAMES_API.STATE(gameId) + "?mode=user");
      const data = res.data;
      setBetData(data.bet ? { ...data.bet, user_martin: data.user_martin } : null);
      if (data.cum_pnl) {
        setCumPnL((prev) => ({ ...prev, ...data.cum_pnl }));
      }
    } catch (err) {
      console.error(`Labouchere ${which} failed:`, err);
    } finally {
      setTimeout(() => setLabHmPressed(null), 500);
    }
  };
  const selectedGameSlot = gameSlots.find((slot) => slot.slot_no === selectedSlotNo);
  const occupiedSlotCount = gameSlots.filter((slot) => slot.occupied).length;
  const endDisabled = (
    processing
    || slotBusy
    || autoStatus.running
    || legacyRestoreBlocked
    || !gameId
    || !selectedSlotNo
    || selectedSlotNo === 1
    || occupiedSlotCount <= 1
  );
  const endDisabledReason = selectedSlotNo === 1
    ? "1번 슬롯은 종료할 수 없습니다"
    : autoStatus.running
      ? "오토를 먼저 정지해야 게임을 종료할 수 있습니다"
      : occupiedSlotCount <= 1
        ? "마지막 게임 슬롯은 종료할 수 없습니다"
        : processing || slotBusy
          ? "현재 요청을 처리 중입니다"
          : "종료할 게임 슬롯이 없습니다";

  return (
    <Box sx={{ p: isMobile ? 0.5 : 2 }}>
      <Box sx={{ mb: 1, display: "flex", alignItems: "center", gap: 1 }}>
        <span style={{ fontSize: 14, fontWeight: "bold", color: "#fff" }}>글로벌히트</span>
        {gameId && <span style={{ fontSize: 11, color: "#888" }}>#{gameId}</span>}
        {(selectedGameSlot?.table_name || autoStatus.table_name) && (
          <span style={{ fontSize: 11, color: "#66bb6a", fontWeight: "bold", marginLeft: 8 }}>
            {selectedGameSlot?.table_name || autoStatus.table_name}
          </span>
        )}
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
          row.map((cell, colIndex) => {
            const isMiddleRow = rowIndex === 3;
            const isLscMatch = cell && Array.isArray(lscMatches) && lscMatches.some(
              (m) => cell.idx >= m.start && cell.idx < m.end
            );
            const isAxis = cell && (
              (decalAxis && cell.idx >= decalAxis[0] && cell.idx < decalAxis[1]) ||
              (shadowAxis && cell.idx >= shadowAxis[0] && cell.idx < shadowAxis[1])
            );
            const triSize = isMobile ? 7 : 10;
            return (
              <Box
                key={`${rowIndex}-${colIndex}`}
                sx={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  backgroundColor: cell ? (CELL_BG[cell.status] || "background.default") : "background.default",
                  ...(isMiddleRow && { borderTop: "2px solid #87ceeb" }),
                  position: "relative",
                }}
              >
                {isLscMatch && (
                  <Box sx={{
                    position: "absolute", top: 0, left: 0,
                    width: 0, height: 0,
                    borderTop: `${triSize}px solid ${LSC_COLOR}`,
                    borderRight: `${triSize}px solid transparent`,
                  }} />
                )}
                {isAxis && (
                  <Box sx={{
                    position: "absolute", bottom: 0, left: 0,
                    width: 0, height: 0,
                    borderBottom: `${triSize}px solid ${DS_COLOR}`,
                    borderRight: `${triSize}px solid transparent`,
                  }} />
                )}
                {cell && <Circle type={cell.type} filled={true} size={isMobile ? 12 : 22} label={cell.idx + 1} />}
              </Box>
            );
          })
        )}
      </Box>

      {/* ===== 새 레이아웃 (자리만, 정적 HTML — 기능 미연결) =====
           [ 1 ][ 2 ]
           [   3   ]
      */}
      {(() => {
        // 3번: S1/S2/S3 78셀 그리드 (39열 × 2행 = 78셀, 1~39 / 40~78)
        const COLS = 39;
        const buildRow = (start) => Array.from({ length: COLS }, (_, k) => start + k);
        const HIT_BG = "#01e676";   // 초록
        const MISS_BG = "#ffeb3b";  // 노랑
        const WAIT_BG = "#ffffff";  // 흰색 (현재 회차)
        const resBg = (r) => r === "hit" ? HIT_BG : r === "miss" ? MISS_BG : WAIT_BG;

        // s_tracks 데이터 (sc1/sc2/sc3) — S 로드 + 누적 그래프용 (260628 SQ→S 리네임)
        const sqTracks = picksSnapshot?.s_tracks?.tracks;
        const srTracks = picksSnapshot?.sr_tracks?.tracks;
        const ssrTracks = picksSnapshot?.ssr_tracks?.tracks;
        const ssroTracks = picksSnapshot?.ssro_tracks?.tracks;
        const sxTracks = picksSnapshot?.sx_tracks?.tracks;
        const forTracks = picksSnapshot?.for_tracks?.tracks;
        const quarterTracks = picksSnapshot?.quarter_tracks?.tracks;

        return (
          <>
          {/* 1|2 row */}
          <Box sx={{ display: "flex", flexDirection: "row", gap: 1, alignItems: "flex-start", mb: 2 }}>

          <Box sx={{ flex: "0 0 auto", display: "flex", flexDirection: "column", gap: 1 }}>
          {/* ===== 1: 배팅부 (구 디자인 스타일에 맞춰 정적 자리만) ===== */}
          {(() => {
            // 구 디자인 토큰
            const tagSx = (bg) => ({ borderRadius: 1, px: 0.5, py: 0, backgroundColor: bg, display: "flex", alignItems: "center", justifyContent: "center", minWidth: 44, height: 20 });
            const fieldSx = { border: "1px solid rgba(255,255,255,0.3)", borderRadius: 1, px: 1, py: 0.2, minWidth: 102, height: 24, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 0.5 };
            const turnBoxSx = { width: 40, height: 40, border: "2px solid rgba(255,255,255,0.3)", borderRadius: 1, backgroundColor: "#333", display: "flex", alignItems: "center", justifyContent: "center" };
            const pbBtnSx = (bg) => ({
              width: 48, height: 48, borderRadius: 2, backgroundColor: bg,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontSize: 24, fontWeight: "bold",
              cursor: inputLocked ? "not-allowed" : "pointer",
              opacity: inputLocked ? 0.4 : 1, pointerEvents: inputLocked ? "none" : "auto",
              "&:hover": { opacity: inputLocked ? 0.4 : 0.85 },
              "&:active": { transform: "scale(0.95)" },
            });
            const ctrlBtnSx = (borderColor, fg) => ({ ...controlBtnSx, border: `2px solid ${borderColor}`, color: fg || "#fff", display: "flex", alignItems: "center", justifyContent: "center", minWidth: 50 });
            const compactBtnSx = (borderColor, fg = "#fff") => ({
              width: 32,
              minWidth: 32,
              height: 32,
              border: `1px solid ${borderColor}`,
              borderRadius: 1,
              backgroundColor: "#101318",
              color: fg,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 13,
              fontWeight: "bold",
              userSelect: "none",
            });

            return (
              <Box sx={{ flex: "0 0 auto", display: "flex", flexDirection: "column", gap: 1, px: 0, py: 0.5 }}>
                {/* 행1: 마틴A + (마틴Z 또는 크루즈) */}
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexWrap: "wrap" }}>
                  {/* 마틴A */}
                  {(() => {
                    const td = betData?.user_martin?.martin_a;
                    const amt = td?.amount || 0;
                    return (
                      <React.Fragment>
                        <Box sx={tagSx("#1565c0")}>
                          <Typography variant="caption" sx={{ fontSize: 11, fontWeight: "bold", color: "#fff" }}>마틴A</Typography>
                        </Box>
                        <Box sx={{ ...fieldSx, minWidth: 55 }}>
                          <Typography variant="caption" sx={{ fontSize: 12, fontWeight: "bold", color: amt > 0 ? "#4caf50" : "#666" }}>
                            {amt > 0 ? amt.toLocaleString() : "0"}
                          </Typography>
                        </Box>
                      </React.Fragment>
                    );
                  })()}
                  {/* 라보쉐르 활성이면 크루즈/마틴Z 대신 라보쉐르 표시 */}
                  {betData?.user_martin?.labouchere?.enabled ? (() => {
                    const lb = betData.user_martin.labouchere;
                    const lbAmt = lb?.amount || 0;
                    const lbPaused = !!lb?.paused;
                    const refreshState = async () => {
                      const res = await apiCaller.get(GH_GAMES_API.STATE(gameId) + "?mode=user");
                      const data = res.data;
                      setBetData(data.bet ? { ...data.bet, user_martin: data.user_martin } : null);
                      if (data.cum_pnl) {
                        setCumPnL((prev) => ({ ...prev, ...data.cum_pnl }));
                      }
                    };
                    const handleResetClick = async () => {
                      if (!gameId) return;
                      if (!window.confirm("초기 시퀀스로 리셋합니까?")) return;
                      try {
                        await apiCaller.post(GH_GAMES_API.LABOUCHERE_RESET(gameId));
                        await refreshState();
                      } catch (err) {
                        console.error("Labouchere reset failed:", err);
                      }
                    };
                    const handlePauseToggle = async () => {
                      if (!gameId) return;
                      try {
                        await apiCaller.post(GH_GAMES_API.LABOUCHERE_PAUSE_TOGGLE(gameId));
                        await refreshState();
                      } catch (err) {
                        console.error("Labouchere pause toggle failed:", err);
                      }
                    };
                    const tagBg = lbPaused ? "#555" : "#8e24aa";
                    const amtColor = lbPaused ? "#666" : "#4caf50";
                    return (
                      <React.Fragment>
                        <Box sx={{ ...tagSx(tagBg), cursor: "pointer" }} onClick={handlePauseToggle} title={lbPaused ? "다시 활성화" : "라보쉐르 일시정지"}>
                          <Typography variant="caption" sx={{ fontSize: 11, fontWeight: "bold", color: "#fff" }}>라보</Typography>
                        </Box>
                        <Box sx={{ ...fieldSx, cursor: "pointer", opacity: lbPaused ? 0.5 : 1, minWidth: 55 }} onClick={handleResetClick} title="클릭하여 초기 시퀀스로 리셋">
                          <Typography variant="caption" sx={{ fontSize: 12, fontWeight: "bold", color: amtColor }}>
                            {lbAmt.toLocaleString()}
                          </Typography>
                        </Box>
                      </React.Fragment>
                    );
                  })() : betData?.user_martin?.cruise?.enabled ? (() => {
                    const cr = betData.user_martin.cruise;
                    const cStep = cr?.step || 1;
                    const cAmt = cr?.amount || 0;
                    const cPaused = !!cr?.paused;
                    const cruiseLabel = (idx) => {
                      if (idx === 0) return "1";
                      if (idx === 1) return "2";
                      if (idx % 2 === 0) return `${idx / 2 + 1}-2`;
                      return `${(idx + 1) / 2 + 1}`;
                    };
                    const refreshState = async () => {
                      const res = await apiCaller.get(GH_GAMES_API.STATE(gameId) + "?mode=user");
                      const data = res.data;
                      setBetData(data.bet ? { ...data.bet, user_martin: data.user_martin } : null);
                      if (data.cum_pnl) {
                        setCumPnL((prev) => ({ ...prev, ...data.cum_pnl }));
                      }
                    };
                    const handleResetClick = async () => {
                      if (!gameId) return;
                      if (!window.confirm("1단계로 돌아갑니까?")) return;
                      try {
                        await apiCaller.post(GH_GAMES_API.CRUISE_RESET(gameId));
                        await refreshState();
                      } catch (err) {
                        console.error("Cruise reset failed:", err);
                      }
                    };
                    const handlePauseToggle = async () => {
                      if (!gameId) return;
                      try {
                        await apiCaller.post(GH_GAMES_API.CRUISE_PAUSE_TOGGLE(gameId));
                        await refreshState();
                      } catch (err) {
                        console.error("Cruise pause toggle failed:", err);
                      }
                    };
                    const tagBg = cPaused ? "#555" : "#0097a7";
                    const amtColor = cPaused ? "#666" : "#4caf50";
                    return (
                      <React.Fragment>
                        <Box sx={{ ...tagSx(tagBg), cursor: "pointer" }} onClick={handlePauseToggle} title={cPaused ? "다시 활성화" : "단계 증가 일시정지"}>
                          <Typography variant="caption" sx={{ fontSize: 11, fontWeight: "bold", color: "#fff" }}>크루즈</Typography>
                        </Box>
                        <Box sx={{ ...fieldSx, cursor: "pointer", opacity: cPaused ? 0.5 : 1 }} onClick={handleResetClick} title="클릭하여 1단계로 리셋">
                          <Typography variant="caption" sx={{ fontSize: 10, color: "#888" }}>{cruiseLabel(cStep - 1)}</Typography>
                          <Typography variant="caption" sx={{ fontSize: 12, fontWeight: "bold", color: amtColor }}>
                            {cAmt.toLocaleString()}
                          </Typography>
                        </Box>
                      </React.Fragment>
                    );
                  })() : (() => {
                    const td = betData?.user_martin?.martin_z;
                    const amt = td?.amount || 0;
                    const dir = td?.direction || "";
                    const step = td?.step || 1;
                    return (
                      <React.Fragment>
                        <Box sx={tagSx("#c62828")}>
                          <Typography variant="caption" sx={{ fontSize: 11, fontWeight: "bold", color: "#fff" }}>마틴Z</Typography>
                        </Box>
                        <Box sx={{ ...fieldSx, minWidth: 80, px: 0.6 }}>
                          <Typography variant="caption" sx={{ fontSize: 10, color: "#888" }}>{step}S</Typography>
                          <Typography variant="caption" sx={{ fontSize: 11, fontWeight: "bold", color: amt > 0 ? "#4caf50" : "#666" }}>
                            {amt > 0 ? `${amt.toLocaleString()}${dir}` : "0"}
                          </Typography>
                        </Box>
                      </React.Fragment>
                    );
                  })()}
                  {(() => {
                    const enabled = !!labouchere?.enabled && !!gameId;
                    return (
                      <Box
                        role={enabled ? "button" : undefined}
                        tabIndex={enabled ? 0 : undefined}
                        title={enabled ? "전체 라보쉐르 시퀀스 보기" : "라보쉐르 비활성"}
                        onClick={enabled ? () => setLabSeqOpen(true) : undefined}
                        onKeyDown={enabled ? (event) => {
                          if (event.key === "Enter" || event.key === " ") setLabSeqOpen(true);
                        } : undefined}
                        sx={{
                          ...compactBtnSx("#8e24aa"),
                          cursor: enabled ? "pointer" : "not-allowed",
                          opacity: enabled ? 1 : 0.4,
                        }}
                      >
                        ≡{labouchereSequence.length}
                      </Box>
                    );
                  })()}
                  {(() => {
                    const jBase = roundState?.j_summary || {};
                    const total = Number(jBase.total || 0);
                    const hit = Number(jBase.hit || 0);
                    const rate = total > 0 ? hit / total : null;
                    const blink = rate !== null && rate >= 0.6;
                    return (
                      <Box
                        title={rate === null ? "J 승률: 기록 없음" : `J 승률: ${(rate * 100).toFixed(1)}% (${hit}/${total})`}
                        sx={{
                          ...compactBtnSx("#707781"),
                          ...(blink ? {
                            animation: "jBlink 0.8s infinite",
                            "@keyframes jBlink": { "0%, 100%": { opacity: 1 }, "50%": { opacity: 0.3 } },
                          } : {}),
                        }}
                      >
                        J
                      </Box>
                    );
                  })()}
                  <Box
                    role="button"
                    tabIndex={0}
                    title={amountViewMode === "actual" ? "실제 베팅 금액 표시 중" : "전략 계산 금액 표시 중"}
                    onClick={() => setAmountViewMode((prev) => prev === "actual" ? "calculated" : "actual")}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        setAmountViewMode((prev) => prev === "actual" ? "calculated" : "actual");
                      }
                    }}
                    sx={{
                      ...compactBtnSx(amountViewMode === "actual" ? "#00a85a" : "#2f80ed"),
                      color: amountViewMode === "actual" ? "#00e676" : "#64b5f6",
                      cursor: "pointer",
                    }}
                  >
                    {amountViewMode === "actual" ? "실" : "계"}
                  </Box>
                  {Number(autoStatus.actual_bet_scale) === 0.1 && (
                    <Box
                      title="실제 카지노 주문액에 ×0.1 적용 중"
                      sx={{
                        width: 38,
                        minWidth: 38,
                        height: 32,
                        border: "1px solid #00a85a",
                        borderRadius: 1,
                        backgroundColor: "#10271d",
                        color: "#00e676",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 10,
                        fontWeight: "bold",
                        whiteSpace: "nowrap",
                      }}
                    >
                      ×0.1
                    </Box>
                  )}
                </Box>

                {/* 행2: 회차 + P/B/T 결과 입력 + 횟수 + del */}
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Box sx={turnBoxSx}>
                    <Typography variant="body2" sx={{ fontWeight: "bold", fontSize: 16 }}>{currentTurn}</Typography>
                  </Box>
                  {(() => {
                    const pCount = results.filter((r) => r.value === "P").length;
                    const bCount = results.filter((r) => r.value === "B").length;
                    const tot = pCount + bCount;
                    const pBlink = tot > 0 && pCount / tot >= 0.6;
                    const bBlink = tot > 0 && bCount / tot >= 0.6;
                    const blinkSx = { animation: "pbBlink 0.8s infinite", "@keyframes pbBlink": { "0%, 100%": { opacity: 1 }, "50%": { opacity: 0.3 } } };
                    return (
                      <>
                        <Box sx={pbBtnSx("#1565c0")} onClick={() => handleInput("P")}>P</Box>
                        <Box sx={{ ...turnBoxSx, width: 38, height: 38, ...(pBlink ? blinkSx : {}) }}>
                          <Typography variant="body2" sx={{ fontWeight: "bold", fontSize: 14 }}>{pCount}</Typography>
                        </Box>
                        <Box sx={pbBtnSx("#f44336")} onClick={() => handleInput("B")}>B</Box>
                        <Box sx={{ ...turnBoxSx, width: 38, height: 38, ...(bBlink ? blinkSx : {}) }}>
                          <Typography variant="body2" sx={{ fontWeight: "bold", fontSize: 14 }}>{bCount}</Typography>
                        </Box>
                        <Box sx={pbBtnSx("#00a85a")} onClick={() => handleInput("T")}>T</Box>
                      </>
                    );
                  })()}
                  {(() => {
                    const enabled = results.length > 0 && !processing;
                    return (
                      <Box
                        onClick={enabled ? handleDeleteOne : undefined}
                        sx={{ ...ctrlBtnSx("rgba(255,255,255,0.3)", "#666"), cursor: processing ? "not-allowed" : enabled ? "pointer" : "default", opacity: processing ? 0.4 : enabled ? 1 : 0.4, pointerEvents: processing ? "none" : "auto" }}
                      >
                        <Typography variant="caption" sx={{ fontSize: 13 }}>del</Typography>
                      </Box>
                    );
                  })()}
                </Box>

              </Box>
            );
          })()}
          <GhBettingSummaryPanel
            roundState={roundState}
            selectedMode={autoPlayMode}
            onModeChange={setAutoPlayMode}
            autoStatus={autoStatus}
            onPlay={handleAutoToggle}
            autoError={autoError}
            disabled={slotBusy || !gameId || legacyRestoreBlocked}
          />
          </Box>

          <RoundAmountTable
            roundState={roundState}
            amountMode={amountViewMode}
            onSetup={() => navigate(`/ghgame/user-setup${gameId ? `?gameId=${gameId}` : ""}`)}
            setupDisabled={!isAdmin}
            onNew={() => setShowNewConfirm(true)}
            newDisabled={processing || slotBusy || autoStatus.running || !gameId || !selectedSlotNo}
            labouchere={labouchere}
            onLabouchereSequence={gameId ? () => setLabSeqOpen(true) : null}
            labHmDisabled={labHmDisabled}
            labHmPressed={labHmPressed}
            onLabouchereHit={() => triggerLabouchereResult("H")}
            onLabouchereMiss={() => triggerLabouchereResult("M")}
            gameSlots={gameSlots}
            selectedSlotNo={selectedSlotNo}
            onSlotSelect={handleSlotSelect}
            slotBusy={slotBusy}
            onEnd={() => setShowEndConfirm(true)}
            endDisabled={endDisabled}
            endDisabledReason={endDisabledReason}
          />

          </Box>
          {/* /1|2 row */}

          {isAdmin && roundStateLower && (
            <>
              {/* ===== 어드민 전용 하단 전략별 현황 전광판 ===== */}
              <GhStrategyBoard
                roundState={roundStateLower}
              />

              {/* ===== 어드민 전용 하단 빅로드2 ===== */}
              <GhBigRoad2
                roundState={roundStateLower}
                subgameBasis={displaySnapshot?.subgame_basis}
                ncRefShoes={roundStateLower?.nc_ref_shoes}
                ncRefShoeNo={roundStateLower?.nc_ref_shoe_no}
                ncRefControls={{
                  value: ncRefDraft,
                  dirty: ncRefDirty,
                  locked: ncRefLocked,
                  busy: ncRefBusy,
                  onChange: handleNcRefChange,
                  onConfirm: handleNcRefConfirm,
                  onCancel: handleNcRefCancel,
                  onToggleLock: handleNcRefLockToggle,
                }}
                actualSeq={strategyResults.map((r) => r.value).join("")}
              />
            </>
          )}
          </>
        );
      })()}

      {/* 새 게임 확인 대화상자 */}
      {/* 이전 게임 복원 확인 */}
      <Dialog open={!!resumeGame} onClose={() => { const gid = resumeGame?.game_id; setResumeGame(null); if (gid) restoreGame(gid); }}>
        <DialogTitle sx={{ fontWeight: "bold" }}>이전 게임 복원</DialogTitle>
        <DialogContent>
          <Typography>진행 중인 게임이 있습니다. (#{resumeGame?.game_id}, {resumeGame?.round_count}회차)</Typography>
          <Typography>이어서 하시겠습니까?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={async () => { const gid = resumeGame.game_id; setResumeGame(null); try { await apiCaller.post(GH_GAMES_API.END, null, { params: { game_id: gid } }); } catch {} startGame(); }}>새 게임</Button>
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

      <Dialog open={showEndConfirm} onClose={() => setShowEndConfirm(false)}>
        <DialogTitle sx={{ fontWeight: "bold" }}>게임 종료</DialogTitle>
        <DialogContent>
          <Typography>{selectedSlotNo}번 게임을 종료하고 빈 슬롯으로 만듭니다.</Typography>
          <Typography>게임 기록은 삭제하지 않고 보존합니다.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowEndConfirm(false)}>취소</Button>
          <Button onClick={handleCloseSlotConfirm} color="error" variant="contained">종료</Button>
        </DialogActions>
      </Dialog>

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
              const umAHasBet = (umA?.amount || 0) > 0;
              const umZHasBet = (umZ?.amount || 0) > 0;
              const barSx = { border: "1px solid rgba(255,255,255,0.3)", borderRadius: 2, px: 2, py: 0.3, display: "flex", alignItems: "center", justifyContent: "space-between", flex: 1 };
              return (
                <Box sx={{ display: "flex", gap: 0.5, mb: 0.5 }}>
                  <Box sx={{ ...barSx, minWidth: 0, justifyContent: "center" }}>
                    <Typography variant="caption" sx={{ fontSize: 11, fontWeight: "bold", color: fAColor }}>{`formal(${fADir})`}</Typography>
                  </Box>
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
                // 방향은 서버가 내려준 mDir 그대로 사용 (프론트 금액비교 제거)
                const fDir = mDir;
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
                // 전체에서 가장 높은 단계 셀 찾기
                let maxStepKey = null;
                let maxStepVal = stepMin;
                if (!isUnified && ghPatterns) {
                  ghPatterns.forEach((pat) => {
                    [0, 1, 2].forEach((sec) => {
                      const { step } = getStepAmt(pat, sec);
                      if (step > maxStepVal) { maxStepVal = step; maxStepKey = `${pat}-${sec + 1}`; }
                    });
                  });
                }
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
                        {Array.from({ length: 8 }, (_, i) => <td key={i} style={{ ...dc }}></td>)}
                      </tr>
                      {dash && [[ghPatterns[0], ghPatterns[1]], [ghPatterns[2], ghPatterns[3]], [ghPatterns[4], ghPatterns[5]], [ghPatterns[6], ghPatterns[7]]].map((pair, ri) => (
                        <tr key={`gh-${ri}`}>
                          {pair.map((pat, pi) => (
                            <React.Fragment key={pat}>
                              {pi > 0 && <td style={{ ...dc, width: 8 }}></td>}
                              {[0, 1, 2].map((sec) => {
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
                              })}
                            </React.Fragment>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </Box>
                  </Box>
                );
              };
              /* ── 마틴Z 간소화: 단계 + 금액만 표시 ── */
              const martinZSimple = () => {
                if (!umZ && !dashZ) return null;
                const mDir = umZ?.direction || "wait";
                const mAmt = umZ?.amount || 0;
                const mP = mDir === "P" ? mAmt : 0;
                const mB = mDir === "B" ? mAmt : 0;
                // 방향은 서버가 내려준 mDir 그대로 사용 (프론트 금액비교 제거)
                const fDir = mDir;
                const fColor = fDir === "P" ? "#1565c0" : fDir === "B" ? "#f44336" : "#888";
                const mHasBet = mAmt > 0;
                const mDimStyle = mHasBet ? {} : { filter: "grayscale(100%)", opacity: 0.7 };
                const amounts = dashZ?.amounts || [];
                const stepMin = dashZ?.step_min || 1;
                const curStep = dashZ?.step || stepMin;
                const curAmt = (curStep >= 1 && curStep <= amounts.length) ? amounts[curStep - 1] : 0;
                return (
                  <Box sx={{ mb: 0.5 }}>
                    <table style={{ borderCollapse: "collapse", width: "fit-content" }}>
                      <tbody>
                        <tr>
                          <td style={{ ...dcB, color: fColor }}>{`formal(${fDir})`}</td>
                          <td style={{ ...dcB, color: "#c62828", ...mDimStyle }}>마틴Z</td>
                          <td style={{ ...dc, color: "#1565c0", ...mDimStyle }}>{`${mP.toLocaleString()}P`}</td>
                          <td style={{ ...dc, color: "#f44336", ...mDimStyle }}>{`${mB.toLocaleString()}P`}</td>
                          <td style={{ ...dcB, color: "#fff" }}>{currentTurn}</td>
                          <td style={{ ...dcB, color: "#ffeb3b" }}>{`${curStep}S`}</td>
                          <td style={{ ...dc, color: "#ffeb3b", fontWeight: "bold" }}>{`${curAmt.toLocaleString()}P`}</td>
                        </tr>
                      </tbody>
                    </table>
                  </Box>
                );
              };
              return (
                <>
                  {martinTable("마틴A", umA, "#1565c0", dashA, false)}
                  {martinZSimple()}
                </>
              );
            })()}


            {/* GlobalHit 패턴별 상세 — 마틴A / 마틴Z 독립 블록 */}
            {(() => {
              const cellSize = 20;
              const colsPerRow = 30;
              const totalCols = colsPerRow + 2;
              const GH_CELL_BG = { hit: "#00e676", wait: "#fff" };
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

              const renderPatternBlock = (label, labelColor, dash, isUnified) => {
                // 전체에서 가장 높은 단계 셀 찾기 (동율 포함)
                const topKeys = new Set();
                let topStep = dash?.step_min || 1;
                if (!isUnified && dash?.steps) {
                  Object.entries(dash.steps).forEach(([k, v]) => {
                    if (v > topStep) { topStep = v; topKeys.clear(); topKeys.add(k); }
                    else if (v === topStep && v > (dash?.step_min || 1)) { topKeys.add(k); }
                  });
                }
                return (
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
                                  <Typography variant="caption" sx={{ fontSize: 10, ...(topKeys.has(`${pat}-${gi + 1}`) && { color: "#ffeb3b", fontWeight: "bold", animation: "blink 1s infinite" }) }}>SC{gi + 1}</Typography>
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
              };

              return (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {renderPatternBlock("마틴A", "#1565c0", dashA, false)}
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

      <Dialog open={labSeqOpen} onClose={() => setLabSeqOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: "bold" }}>라보쉐르 시퀀스</DialogTitle>
        <DialogContent>
          {(() => {
            const lb = betData?.user_martin?.labouchere;
            const seq = Array.isArray(lb?.sequence) ? lb.sequence : [];
            const sum = seq.reduce((a, b) => a + (b || 0), 0);
            const cumLab = cumPnL?.labouchere || 0;
            const bet = lb?.amount || 0;
            return (
              <Box>
                <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mb: 1.5 }}>
                  <Typography sx={{ fontSize: 13 }}>남은 항목: <b>{seq.length}</b></Typography>
                  <Typography sx={{ fontSize: 13 }}>남은 합: <b>{sum.toLocaleString()}</b></Typography>
                  <Typography sx={{ fontSize: 13 }}>현재 베팅: <b>{bet.toLocaleString()}</b></Typography>
                  <Typography sx={{ fontSize: 13, color: cumLab >= 0 ? "#4caf50" : "#f44336" }}>
                    누적 PnL: {cumLab > 0 ? "+" : ""}{cumLab.toLocaleString()}P
                  </Typography>
                </Box>
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                  {seq.length === 0 ? (
                    <Typography sx={{ fontSize: 13, color: "#888" }}>시퀀스가 비어있습니다 (목표 달성).</Typography>
                  ) : seq.map((v, i) => (
                    <Box key={i} sx={{
                      border: "1px solid rgba(255,255,255,0.2)",
                      borderRadius: 1, px: 0.8, py: 0.3, fontSize: 12,
                      backgroundColor: (i === 0 || i === seq.length - 1) ? "rgba(142,36,170,0.25)" : "transparent",
                      color: (i === 0 || i === seq.length - 1) ? "#ce93d8" : "#ccc",
                      fontWeight: (i === 0 || i === seq.length - 1) ? "bold" : "normal",
                    }}>
                      {v}
                    </Box>
                  ))}
                </Box>
              </Box>
            );
          })()}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLabSeqOpen(false)}>닫기</Button>
        </DialogActions>
      </Dialog>

      {/* Auto 베팅 시작 모달 — mvp-aboo-integration.md §5.1 */}
      <AutoStartDialog
        open={autoDialogOpen}
        onClose={() => setAutoDialogOpen(false)}
        onStarted={(resp) => {
          setAutoError(null);
          setAutoStatus({
            running: true,
            autoSessionId: resp.auto_session_id,
            phase: resp.phase,
            play_mode: resp.play_mode,
            actual_bet_scale: resp.actual_bet_scale || 1,
          });
          if (resp.slot_no) setSelectedSlotNo(resp.slot_no);
          refreshGameSlots().catch(() => {});
        }}
        onError={setAutoError}
        gameId={gameId}
        pickhandId={myPickhandId}
        gameType="gh"
        playMode={autoPlayMode}
      />

      {/* 베팅 거부 레이어 팝업 */}
      <Snackbar
        open={!!rejectMsg}
        autoHideDuration={5000}
        onClose={() => setRejectMsg(null)}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert severity="warning" variant="filled" onClose={() => setRejectMsg(null)}>
          {rejectMsg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
