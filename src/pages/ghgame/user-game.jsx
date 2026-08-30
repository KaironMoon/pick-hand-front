import React, { useState, useEffect, useCallback, useRef } from "react";
import { Box, Typography, useMediaQuery, useTheme, Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Tooltip, Snackbar, Alert, MenuItem } from "@mui/material";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAtomValue } from "jotai";
import { userAtom } from "@/store/auth-store";
import apiCaller from "@/services/api-caller";
import autoService from "@/services/auto-service";
import AutoStartDialog from "../t9game/components/AutoStartDialog";
import GhStrategyBoard from "./components/GhStrategyBoard";
import GhBigRoad2 from "./components/GhBigRoad2";
import {
  autoStatusLookupError,
  createEmptyAutoStatus,
  mergePolledAutoStatus,
  shouldDisplayAutoError,
  shouldDisplayBetFailure,
  shouldDisplaySlotAutoError,
} from "./auto-status";
import { getRoundStateSubgameBasis } from "./subgame-basis.js";
import { claimOverallStopAlert } from "./overall-stop-alert";
import { buildGoalStatusItems, formatGoalIndicator, formatGoalTarget } from "./goal-status.js";
import { resolvePickMartinSummary } from "./pick-martin-summary.js";
import { ghBetStopReasonLabel, ghDrawdownStatusLabel, ghProfitStopStatusLabel, ghSlotLossStatusLabel } from "./slot-operating-options.js";
import {
  GH_KEEP_COUNT_DEFAULT,
  GH_KEEP_COUNT_MAX,
  GH_KEEP_COUNT_MIN,
  ghKeepLabel,
  parseGhKeepCount,
} from "./keep-count.js";
import { GH_GAMES_API, USER_BET_SETTINGS_API } from "@/constants/api-url";
import {
  loadShoeCopySourceType,
  saveShoeCopySourceType,
  SHOE_COPY_SOURCE_STORAGE_KEYS,
  shoeCopyEnterAction,
} from "@/utils/shoe-copy-dialog.js";

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

const buildShoePreviewGrid = (actuals) => {
  const cols = Math.max(1, Math.ceil((actuals?.length || 0) / GRID_ROWS));
  return Array.from({ length: GRID_ROWS }, (_, row) =>
    Array.from({ length: cols }, (__, col) => actuals?.[col * GRID_ROWS + row] || null)
  );
};

const getShoeResultCount = (data) => {
  const shoeResults = data?.round_state_upper?.shoe_results;
  return Array.isArray(shoeResults) ? shoeResults.length : (data?.seq || "").length;
};

const GRID_ROWS = 6;
const GRID_COLS = 40;

function GoalStatusBar({ roundState, autoStatus }) {
  const items = buildGoalStatusItems(
    roundState?.strategy_goals,
    roundState?.overall_stop,
    autoStatus,
  );

  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mb: 2 }}>
      {items.map((item) => {
        const text = formatGoalIndicator(item);
        const title = item.target > 0
          ? `${item.label}: ${formatGoalTarget(item.pnl)} / ${formatGoalTarget(item.target)}P${item.reached ? " (목표 달성)" : ""}`
          : `${item.label}: 목표금액 없음`;
        return (
          <Box
            key={item.key}
            title={title}
            sx={{
              minWidth: 42,
              height: 28,
              px: 0.9,
              border: `1px solid ${item.reached ? "#00e676" : "#59616d"}`,
              borderRadius: 1,
              backgroundColor: item.reached ? "#0e5635" : "#11161d",
              color: item.reached ? "#b9ffd5" : "#fff",
              boxShadow: item.reached
                ? "0 0 7px #00e676, inset 0 0 7px rgba(0,230,118,0.35)"
                : "none",
              opacity: item.dimmed ? 0.28 : 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              fontWeight: "bold",
              whiteSpace: "nowrap",
              userSelect: "none",
            }}
          >
            {text}
          </Box>
        );
      })}
    </Box>
  );
}

const CELL_BG = {
  hit: "#00e676",
  miss: "#ffeb3b",
  wait: "#ffffff",
};

const GhCircle = ({ type, filled = true, size = 24, label }) => {
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

const calculateGhCircleGrid = (results) => {
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

function GhLossStopStatus({ roundState, autoStatus }) {
  const status = roundState?.globalhit_loss_stop;
  const detail = ghSlotLossStatusLabel(status);
  const drawdownStatus = autoStatus?.running
    ? {
      configured_drawdown_start: autoStatus.drawdown_start_amount,
      effective_drawdown_start: autoStatus.effective_drawdown_start_amount,
      drawdown_percent: autoStatus.drawdown_percent,
      drawdown_armed: Number(autoStatus.drawdown_peak_actual_p || 0) >= Number(autoStatus.effective_drawdown_start_amount || 0),
      drawdown_peak: autoStatus.drawdown_peak_actual_p,
      reason: autoStatus.stop_reason,
    }
    : roundState?.overall_stop;
  const martinRecovery = roundState?.martin_recovery ?? autoStatus?.martin_recovery;
  const recoveryTargets = martinRecovery?.targets || {};
  const recoveryNames = { martin_z: "Z", martin_b: "B", martin_c: "C" };
  const pendingRecovery = Object.entries(recoveryTargets)
    .filter(([, target]) => target?.required && !target?.recovered)
    .map(([key]) => recoveryNames[key] || key);
  const recoveryDetail = martinRecovery?.active
    ? `GH 정지 · 마틴 ${pendingRecovery.join("/")} 첫 적중 회수중`
    : martinRecovery?.completed
      ? "마틴 회수 완료 · 최종 배팅 정지"
      : null;
  const betStopReason = ghBetStopReasonLabel(roundState);
  return (
    <>
      <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap", mb: betStopReason ? 0.5 : 1.5, px: 1, py: 0.7, border: "1px solid rgba(255,193,7,.3)", borderRadius: 1, backgroundColor: "rgba(255,193,7,.035)" }}>
        <Typography variant="caption" sx={{ color: "#ffc107", fontWeight: 900 }}>현재 게임 배팅조건</Typography>
        <Typography variant="caption" sx={{ px: 1, py: 0.35, border: "1px solid rgba(255,193,7,.45)", borderRadius: 1, color: status?.stopped ? "#ff8a80" : "#ffe082", fontWeight: 800 }}>
          슬롯 GH 손실조건: {detail}
        </Typography>
        <Typography variant="caption" sx={{ px: 1, py: 0.35, border: "1px solid rgba(255,193,7,.45)", borderRadius: 1, color: drawdownStatus?.reason === "drawdown_reached" ? "#ff8a80" : "#ffe082", fontWeight: 800 }}>
          손실종료조건: {ghDrawdownStatusLabel(drawdownStatus)}
        </Typography>
        <Typography variant="caption" sx={{ px: 1, py: 0.35, border: "1px solid rgba(255,193,7,.45)", borderRadius: 1, color: roundState?.profit_stop?.stopped ? "#ff8a80" : "#ffe082", fontWeight: 800 }}>
          수익보호: {ghProfitStopStatusLabel(roundState?.profit_stop)}
        </Typography>
        {recoveryDetail && (
          <Typography variant="caption" sx={{ px: 1, py: 0.35, border: "1px solid rgba(255,82,82,.55)", borderRadius: 1, color: martinRecovery?.active ? "#ffcc80" : "#ff8a80", fontWeight: 900 }}>
            정지 처리: {recoveryDetail}
          </Typography>
        )}
      </Box>
      {betStopReason && (
        <Box sx={{ mb: 1.5, px: 1, py: 0.65, border: "1px solid rgba(255,82,82,.5)", borderRadius: 1, backgroundColor: "rgba(255,82,82,.08)" }}>
          <Typography variant="caption" sx={{ color: "#ff8a80", fontWeight: 900 }}>
            GH 배팅 종료 이유: {betStopReason}
          </Typography>
        </Box>
      )}
    </>
  );
}

function GhRoundAmountTable({
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
  slotSelectionBlocked = false,
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
      const hasError = shouldDisplaySlotAutoError(slot);
      return {
        label: String(slotNo),
        active: selected,
        backgroundColor: hasError
          ? "#ffeb3b"
          : slot?.auto_running && slot?.phase === "waiting_new_shoe"
            ? "#6d4c00"
          : slot?.auto_running && slot?.phase === "monitoring"
            ? "#c62828"
            : slot?.auto_running
              ? "#2e7d32"
              : slot?.occupied
                ? "#252a31"
                : "#101318",
        color: hasError ? "#111" : "#fff",
        blink: hasError,
        onClick: () => onSlotSelect?.(slotNo),
        disabled: slotSelectionBlocked,
        title: slot?.occupied
          ? `${slotNo}번 게임 #${slot.game_id}${slot.table_name ? ` / ${slot.table_name}` : ""}`
          : `${slotNo}번 빈 슬롯 — 새 게임 시작`,
      };
    }),
    {
      label: "UP",
      accent: "#ff9800",
      onClick: onSetup,
      disabled: setupDisabled,
      title: setupDisabled ? "관리자 전용 설정" : "배팅 설정",
    },
    { label: "NW", accent: "#2f9bff", onClick: onNew, disabled: newDisabled },
    {
      label: "ED",
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
      amount: Number(actualCell.server_bet_amount_p ?? actualCell.bet_amount_p ?? 0),
      pnl: Number(actualCell.server_pnl_p || 0),
      betPlaced: !!actualCell.bet_placed,
      settled: !!actualCell.settled,
      failureCode: actualCell.failure_code || null,
      failureDetail: actualCell.failure_detail || null,
      globalhit_pnl: Number(actualCell.server_component_pnl_p?.globalhit || 0),
      martin_z_pnl: Number(actualCell.server_component_pnl_p?.martin_z || 0),
      martin_b_pnl: Number(actualCell.server_component_pnl_p?.martin_b || 0),
      martin_c_pnl: Number(actualCell.server_component_pnl_p?.martin_c || 0),
    };
  });
  const fmt = (v) => v === "N/A" ? "-" : Number(v || 0).toFixed(1);
  const finalSide = table.total_side;
  const currentRoundIdx = Math.max(0, Number(roundState?.round_num || 0));
  const totalAmount = amountMode === "actual"
    ? Number(actualTable.server_current_bet_p
      ?? actualCells[currentRoundIdx]?.bet_amount_p
      ?? 0)
    : Number(table.total_amount || 0);
  const totalPnl = amountMode === "actual"
    ? Number(actualTable.server_total_pnl_p || 0)
    : Number(table.total_pnl || 0);
  const pnlBreakdown = amountMode === "actual"
    ? actualTable.server_pnl_breakdown_p || {}
    : table.pnl_breakdown || { globalhit: table.total_pnl || 0 };
  const componentPnls = [
    ["PnL", Number(pnlBreakdown.globalhit || 0)],
    ["Z", Number(pnlBreakdown.martin_z || 0)],
    ["B", Number(pnlBreakdown.martin_b || 0)],
    ["C", Number(pnlBreakdown.martin_c || 0)],
  ];
  const basePnl = componentPnls[0][1];
  const martinPnls = componentPnls.slice(1);
  const pnlColor = (value) => value >= 0 ? "#00e676" : "#ef5350";
  const globalhitAggregate = roundState?.globalhit_aggregate || {};
  const globalhitDirection = globalhitAggregate.direction;
  const globalhitBetAmount = amountMode === "actual"
    ? Number(actualTable.server_globalhit_bet_p ?? globalhitAggregate.amount ?? 0)
    : Number(globalhitAggregate.amount || 0);
  const globalhitDirectionColor = globalhitDirection === "P" ? "#1565d8" : globalhitDirection === "B" ? "#e53935" : "#555";
  const martinContributionAmount = (cell) => [
    cell?.pick_martin_amount,
    cell?.martin_b_amount,
    cell?.martin_c_p_amount,
    cell?.martin_c_b_amount,
  ].reduce((sum, value) => sum + Number(value || 0), 0);
  const currentMartinAmount = martinContributionAmount(strategyCells[currentRoundIdx]);
  const betAmountLabel = amountMode !== "actual" && currentMartinAmount > 0
    ? `${fmt(totalAmount)} (${fmt(currentMartinAmount)})`
    : fmt(totalAmount);
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
      <Box sx={{ position: "relative", display: "flex", alignItems: "stretch", gap: 0.5, width: "100%" }}>
        {slotBusy && (
          <Box
            role="status"
            aria-live="polite"
            sx={{
              position: "absolute",
              inset: 0,
              zIndex: 3,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1px solid #2f9bff",
              borderRadius: 1,
              backgroundColor: "rgba(8, 10, 13, 0.88)",
              color: "#7ec8ff",
              fontSize: 12,
              fontWeight: "bold",
              cursor: "wait",
            }}
          >
            슬롯 전환 중...
          </Box>
        )}
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
              border: `${active ? 2 : 1}px solid ${active ? "#39ff14" : accent || "#707781"}`,
              boxSizing: "border-box",
              borderRadius: 1,
              backgroundColor: pressed
                ? "#ffeb3b"
                : backgroundColor || (active ? "#16365c" : accent ? `${accent}33` : "#101318"),
              color: pressed ? "#1b1b1b" : color || (active ? "#2f9bff" : "#fff"),
              boxShadow: pressed
                ? "0 0 8px #ffeb3b, 0 0 16px rgba(255,235,59,0.6)"
                : active
                  ? "0 0 8px #39ff14, inset 0 0 4px rgba(57,255,20,0.55)"
                  : "none",
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
          <span>BET</span><span>{betAmountLabel}</span>
        </Box>
        <Box sx={{ flex: 1, minWidth: 112, border: "1px solid #3f4650", backgroundColor: "#111821", color: totalPnl >= 0 ? "#00e676" : "#ef5350", fontSize: 11, fontWeight: "bold", px: 0.75, py: 0.35, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span>전체 PNL</span><span>{fmt(totalPnl)}</span>
        </Box>
      </Box>
      <Box sx={{ display: "flex", justifyContent: "flex-end", alignItems: "stretch", gap: 0.5, width: "100%" }}>
        <Box sx={{ width: 28, minWidth: 28, border: "1px solid #3f4650", backgroundColor: globalhitDirectionColor, color: "#fff", fontSize: 13, fontWeight: "bold", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {globalhitDirection || "-"}
        </Box>
        <Box sx={{ width: 145, border: "1px solid #3f4650", backgroundColor: "#111821", color: "#fff", fontSize: 11, fontWeight: "bold", px: 0.75, py: 0.35, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span>글로벌히트 BET</span><span>{fmt(globalhitBetAmount)}</span>
        </Box>
        <Box sx={{ width: 145, border: "1px solid #3f4650", backgroundColor: "#111821", color: pnlColor(basePnl), fontSize: 11, fontWeight: "bold", px: 0.75, py: 0.35, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span>글로벌히트 PNL</span><span>{fmt(basePnl)}</span>
        </Box>
        {martinPnls.map(([label, value]) => (
          <Box key={label} sx={{ width: 112, border: "1px solid #3f4650", backgroundColor: "#111821", color: pnlColor(value), fontSize: 11, fontWeight: "bold", px: 0.75, py: 0.35, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span>{label} PnL</span><span>{fmt(value)}</span>
          </Box>
        ))}
      </Box>
      <Box sx={{ display: "grid", gridTemplateRows: "repeat(10, 31px)", gridAutoFlow: "column", gridAutoColumns: "84px", gap: "2px" }}>
        {Array.from({ length: cellCount }, (_, idx) => {
          const martinAmount = martinContributionAmount(strategyCells[idx]);
          const amountLabel = amountMode !== "actual" && martinAmount > 0
            ? `${fmt(cells[idx]?.amount)} (${fmt(martinAmount)})`
            : fmt(cells[idx]?.amount);
          return (
            <Box key={idx} sx={cellSx(idx)} title={`${idx + 1}회차 / ${amountMode === "actual" ? "실제" : "계산"} ${fmt(cells[idx]?.amount)}P${amountMode !== "actual" ? ` / Z+B+C ${fmt(martinAmount)}P` : ""} / PnL ${fmt(cells[idx]?.globalhit_pnl)} / Z ${fmt(cells[idx]?.martin_z_pnl)} / B ${fmt(cells[idx]?.martin_b_pnl)} / C ${fmt(cells[idx]?.martin_c_pnl)}`}>
              <Box sx={{ color: roundColor(idx), fontSize: 10, fontWeight: "bold", textAlign: "center" }}>{idx + 1}</Box>
              <Box sx={{ color: "#fff", fontSize: martinAmount > 0 && amountMode !== "actual" ? 9 : 11, fontWeight: "bold", textAlign: "right", pr: 0.4, whiteSpace: "nowrap" }}>{amountLabel}</Box>
            </Box>
          );
        })}
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
    failure_detail: data.detail || null,
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

function GhBettingSummaryPanel({
  roundState,
  selectedMode,
  keepCount,
  onModeChange,
  autoStatus,
  onPlay,
  autoError,
  replayActive = false,
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
    .filter((value) => value === "P" || value === "B");
  const counts = normalizedResults.reduce(
    (acc, value) => ({ ...acc, [value]: acc[value] + 1 }),
    { P: 0, B: 0 },
  );
  const {
    step,
    amount,
    direction: displayedDirection,
  } = resolvePickMartinSummary(roundState, autoStatus);
  const pickMartinBorder = displayedDirection === "P"
    ? "#1565c0"
    : displayedDirection === "B"
      ? "#f44336"
      : "#7f7f7f";
  const pickMartinBackground = displayedDirection === "P"
    ? "rgba(21, 101, 192, 0.32)"
    : displayedDirection === "B"
      ? "rgba(244, 67, 54, 0.32)"
      : "#080a0d";
  const yukmaeBoardRows = 6;
  const yukmaeBoardColumns = 13;
  const markerColor = { P: "#1565d8", B: "#f44336" };
  const hasAutoError = shouldDisplayAutoError(autoStatus, autoError);
  const replayRoundNum = Math.max(1, Number(roundState?.round_num || 1));
  const replayCells = roundState?.actual_bet_table?.cells || [];
  const replayFailure = replayActive
    ? [replayCells[replayRoundNum], replayCells[replayRoundNum - 1]]
      .find((cell) => shouldDisplayBetFailure(cell?.failure_code))
    : null;
  const hasReplayBetError = shouldDisplayBetFailure(replayFailure?.failure_code);
  const errorCode = hasAutoError
    ? autoStatus?.error_code || autoError?.code || "auto_error"
    : replayFailure?.failure_code || "auto_error";
  const errorDetail = hasAutoError
    ? autoStatus?.error_detail || autoError?.detail || "자동게임 처리 중 오류가 발생했습니다."
    : replayFailure?.failure_detail || "해당 회차의 카지노 배팅에 실패했습니다.";
  const autoStateCell = hasAutoError || hasReplayBetError
    ? { text: "error", error: true, tooltip: `[${errorCode}] ${errorDetail}` }
    : autoStatus?.running
      ? { text: "ok", autoOk: true }
      : { text: "" };
  const phaseAbbr = {
    standby: "STB",
    waiting_new_shoe: "WAIT",
    monitoring: "MON",
    betting: "BET",
    clearing: "CLR",
    completed: "DONE",
    error: "ERR",
    stopped: "STOP",
  };
  const autoPhase = hasAutoError ? "ERR" : phaseAbbr[autoStatus?.phase] || "—";
  const stopReason = autoStatus?.stop_reason || roundState?.overall_stop?.reason;
  const monitoringReason = stopReason === "goal_reached"
    ? "목표중지"
    : stopReason === "end_round_reached"
      ? "마감중지"
      : stopReason === "active_pot_limit_reached"
        ? "POT중지"
        : stopReason === "round_bet_loss_streak_reached"
          ? "연패중지"
      : null;
  const autoPnl = Number(autoStatus?.pnl_actual_p || 0);
  const autoPnlText = `${autoPnl.toLocaleString(undefined, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}P`;
  const statusCells = [
    { text: "guide" },
    { text: "one", selection: "one" },
    autoStateCell,
    {
      text: `${monitoringReason || autoPhase} ${autoPnlText}`,
      autoInfo: true,
      tooltip: monitoringReason
        ? `${monitoringReason}: 현재 게임은 결과만 기록하며 킵 모드는 다음 게임에서 배팅을 재개합니다.`
        : undefined,
    },
    { text: ghKeepLabel(keepCount, autoStatus), selection: "keep" },
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

      {/* 육매판 — P/B 결과 로드맵 (6행 × 13열) */}
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
  const slotBusyRef = useRef(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [shoeCopyOpen, setShoeCopyOpen] = useState(false);
  const [shoeSourceType, setShoeSourceType] = useState(() => loadShoeCopySourceType(
    SHOE_COPY_SOURCE_STORAGE_KEYS.gh,
    "gh",
  ));
  const [sourceGameInput, setSourceGameInput] = useState("");
  const [shoePreview, setShoePreview] = useState(null);
  const [shoeCopyError, setShoeCopyError] = useState("");
  const [shoeCopyLoading, setShoeCopyLoading] = useState(false);
  const [shoeCopyExecuting, setShoeCopyExecuting] = useState(false);
  const [shoeCopyProgress, setShoeCopyProgress] = useState({ active: false, completed: 0, total: 0 });
  const [replayOpen, setReplayOpen] = useState(false);
  const [replayControlsOpen, setReplayControlsOpen] = useState(false);
  const [replayGameInput, setReplayGameInput] = useState("");
  const [replayPreview, setReplayPreview] = useState(null);
  const [replayLoading, setReplayLoading] = useState(false);
  const [replayError, setReplayError] = useState("");
  const [replay, setReplay] = useState({ active: false, external: false, sourceGameId: null, roundNum: 0, totalRounds: 0 });
  const [replayRoundInput, setReplayRoundInput] = useState("");
  const processingRef = useRef(false);
  const skipRestoreGameIdRef = useRef(null);
  const maxMissPopupRef = useRef(null);
  const [processing, setProcessing] = useState(false);
  const goalAlertedRef = useRef({ a: false, z: false });
  const overallStopAlertedRef = useRef(new Set());

  const [goalDialog, setGoalDialog] = useState({ open: false, msgs: [] });
  const [overallStopDialog, setOverallStopDialog] = useState({
    open: false,
    title: "",
    detail: "",
    modeLabel: "",
  });

  // Auto 모드 (pick-aboo 통합) — t9game/index.jsx에서 포팅
  const [autoFeatureAvailable, setAutoFeatureAvailable] = useState(true);
  const [autoDialogOpen, setAutoDialogOpen] = useState(false);
  const [autoStatus, setAutoStatus] = useState({ running: false, autoSessionId: null });
  const [autoPlayMode, setAutoPlayMode] = useState("one");
  const [keepCount, setKeepCount] = useState(GH_KEEP_COUNT_DEFAULT);
  const [keepCountInput, setKeepCountInput] = useState(String(GH_KEEP_COUNT_DEFAULT));
  const [keepCountOpen, setKeepCountOpen] = useState(false);
  const [amountViewMode, setAmountViewMode] = useState("calculated");
  const [autoError, setAutoError] = useState(null);
  const [rejectMsg, setRejectMsg] = useState(null);  // 베팅 거부 레이어 팝업
  const [legacyRestoreBlocked, setLegacyRestoreBlocked] = useState(false);
  const [myPickhandId, setMyPickhandId] = useState(null);

  const strategyResults = results.filter((result) => result.value === "P" || result.value === "B");

  useEffect(() => {
    const displayedRound = replay.active ? replay.roundNum : strategyResults.length;
    setReplayRoundInput(displayedRound > 0 ? String(displayedRound) : "");
  }, [replay.active, replay.roundNum, strategyResults.length]);
  const currentTurn = strategyResults.length + 1;
  const inputLocked = processing || legacyRestoreBlocked || (replay.active && replay.external);
  // LEGACY COMPAT ONLY: displaySnapshot 별칭은 남은 레거시 보조표용이다.
  // 새 화면/상태 판단/픽 표시/닷 표시에는 사용 금지. 필요한 데이터는 서버에서 roundState에 추가한다.
  const displaySnapshot = picksSnapshot;
  const roundAmountCells = roundState?.round_amount_table?.cells || [];
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
  const grid = calculateGhCircleGrid(gridResults);

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

  const showOverallStopAlert = useCallback((targetGameId, reason, mode, stopDetail) => {
    const alert = claimOverallStopAlert(
      overallStopAlertedRef.current,
      targetGameId,
      reason,
      mode,
      stopDetail,
    );
    if (alert) setOverallStopDialog({ open: true, ...alert });
  }, []);

  useEffect(() => {
    if (Number(roundState?.round_num || 0) !== 0) return;
    showOverallStopAlert(
      gameId,
      roundState?.overall_stop?.reason,
      "manual",
      roundState?.overall_stop,
    );
  }, [gameId, roundState?.round_num, roundState?.overall_stop, showOverallStopAlert]);

  const displayPick = (() => {
    const umComb = betData?.user_martin?.combined?.direction;
    if (umComb && umComb !== "wait") return umComb;
    const adComb = betData?.combined?.direction;
    return adComb && adComb !== "wait" ? adComb : null;
  })();
  const pickImage = displayPick === "P" ? "/player.png" : displayPick === "B" ? "/banker.png" : "/wait.png";

  const applyGameData = useCallback((data, { preserveGameId = false } = {}) => {
    setLegacyRestoreBlocked(false);
    if (!preserveGameId) setGameId(data.game_id);
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
    setBetData(data.bet ? { ...data.bet, user_martin: data.user_martin } : null);
    setUserSummary(data.user_summary || null);
    setUserMartinDashboard(data.user_martin_dashboard || null);
  }, []);

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
      setAutoError(null);
      setAutoStatus(createEmptyAutoStatus());
      // 새 게임 응답을 전체 적용해 이전 게임의 results/빅로드/손익/베팅 상태를 함께 초기화한다.
      applyGameData(res.data);
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
  }, [applyGameData, navigate, refreshGameSlots, setSearchParams]);

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

  const openMaxMissPopup = () => {
    const targetGameId = replay.active ? replay.sourceGameId : gameId;
    if (!targetGameId) return;
    const roundQuery = replay.active ? `&round=${encodeURIComponent(replay.roundNum)}` : "";
    const popup = window.open(
      `/ghgame/max-miss?gameId=${encodeURIComponent(targetGameId)}${roundQuery}`,
      "gh-max-miss",
      "popup=yes,width=1120,height=720,resizable=yes,scrollbars=yes",
    );
    if (popup) {
      maxMissPopupRef.current = popup;
      popup.focus();
    }
    else setRejectMsg("팝업이 차단되었습니다. 이 사이트의 팝업을 허용해주세요.");
  };

  useEffect(() => {
    const popup = maxMissPopupRef.current;
    if (!popup || popup.closed) return;
    const targetGameId = replay.active ? replay.sourceGameId : gameId;
    if (!targetGameId) return;
    const roundQuery = replay.active ? `&round=${encodeURIComponent(replay.roundNum)}` : "";
    popup.location.replace(`/ghgame/max-miss?gameId=${encodeURIComponent(targetGameId)}${roundQuery}`);
  }, [gameId, replay.active, replay.roundNum, replay.sourceGameId]);

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
          setAutoStatus((prev) => mergePolledAutoStatus(prev, st));
        }
      } catch (e) {
        if (e?.response?.status === 503) {
          setAutoFeatureAvailable(false);
        } else {
          setAutoError(autoStatusLookupError(autoStatus));
        }
      }
    };
    tick();
    const id = setInterval(tick, 5000);  // auto-status 폴링 1s → 5s로 완화 (호출량 감소 260603)
    return () => { cancelled = true; clearInterval(id); };
  }, [gameId, autoFeatureAvailable, autoStatus.running]);

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
              stop_reason: data.stop_reason ?? prev.stop_reason,
              pending_direction: data.pending_direction ?? null,
              pending_amount_p: data.pending_amount_p ?? 0,
              pending_amount_won: data.pending_amount_won ?? 0,
              drawdown_start_amount: data.drawdown_start_amount_p ?? prev.drawdown_start_amount,
              effective_drawdown_start_amount: data.effective_drawdown_start_amount_p ?? prev.effective_drawdown_start_amount,
              drawdown_percent: data.drawdown_percent ?? prev.drawdown_percent,
              drawdown_peak_actual_p: data.drawdown_peak_actual_p ?? prev.drawdown_peak_actual_p,
              martin_recovery: data.martin_recovery ?? prev.martin_recovery,
            }));
            showOverallStopAlert(
              data.game_id || gameId,
              data.stop_reason,
              "auto",
              data,
            );
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
              stop_reason: ["goal_reached", "drawdown_reached", "end_round_reached", "active_pot_limit_reached", "round_bet_loss_streak_reached"].includes(data.reason)
                ? data.reason
                : prev.stop_reason,
              active_pot_count: data.active_pot_count ?? prev.active_pot_count,
              pot_stop_count: data.pot_stop_count ?? prev.pot_stop_count,
              martin_recovery: data.martin_recovery ?? prev.martin_recovery,
            }));
            showOverallStopAlert(
              data.game_id || gameId,
              data.reason,
              "auto",
              data,
            );
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
              phase: data.phase || "betting",
              round_count: 0,
              pnl_total: 0,
              pnl_actual: 0,
              pnl_total_p: 0,
              pnl_actual_p: 0,
              stop_reason: data.stop_reason || null,
              active_pot_count: data.active_pot_count ?? null,
              pot_stop_count: data.pot_stop_count ?? prev.pot_stop_count ?? 0,
              keep_shoes_remaining: data.keep_shoes_remaining ?? prev.keep_shoes_remaining,
            }));
            showOverallStopAlert(
              data.game_id,
              data.stop_reason,
              "auto",
            );
            console.info(`[Auto] 재시작: new_session=${data.auto_session_id} game=${data.game_id}`);
          } else if (t === "bet_attempt") {
            setRoundStateUpper((prev) => applyActualBetAttempt(prev, data));
          } else if (t === "bet_settled") {
            // PNL은 프론트에서 합산하지 않고 서버 계산 결과를 다시 조회한다.
            restoreGame(data.game_id || gameId);
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

  }, [autoFeatureAvailable, autoStatus.running, autoStatus.autoSessionId, gameId, showOverallStopAlert]);

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
      if (autoPlayMode === "keep") {
        setKeepCountInput(String(keepCount));
        setKeepCountOpen(true);
        return;
      }
      setAutoDialogOpen(true);
    }
  };

  const confirmKeepCount = () => {
    const parsed = parseGhKeepCount(keepCountInput);
    if (parsed == null) return;
    setKeepCount(parsed);
    setAutoPlayMode("keep");
    setKeepCountOpen(false);
    setAutoDialogOpen(true);
  };

  const handleInput = async (inputValue) => {
    if (!gameId || processingRef.current) return;
    if (replay.active && replay.external) return;
    const wasCurrentReplay = replay.active;
    processingRef.current = true;
    setProcessing(true);

    if (wasCurrentReplay) {
      await restoreGame(gameId);
      setReplay({ active: false, external: false, sourceGameId: null, roundNum: 0, totalRounds: 0 });
    }

    // hit/miss 여부는 서버가 판정해 내려준다(응답의 round_status_current). 입력 직후엔 미정(wait)으로 낙관적 추가 후 응답으로 확정.
    const effectivePick = wasCurrentReplay ? null : betData?.user_martin?.combined?.direction || betData?.combined?.direction;
    setResults((prev) => [...prev, { value: inputValue, status: "wait", statusAr: "wait", aPick: effectivePick && effectivePick !== "wait" ? effectivePick : null, decalShadow: decalPick !== null || shadowPick !== null }]);
    setBetData(null);

    try {
      const res = await apiCaller.post(GH_GAMES_API.ROUND, { game_id: gameId, actual: inputValue });
      const data = res.data;
      const nextStrategyRound = results.filter((result) => result.value === "P" || result.value === "B").length + 1;
      if (!wasCurrentReplay && inputValue !== "T" && data.round_num !== undefined && data.round_num !== nextStrategyRound) {
        alert("서버/클라이언트 불일치가 감지되어 페이지를 리로드합니다.");
        window.location.reload();
        return;
      }
      if (inputValue === "T") {
        setRoundStateUpper(data.round_state_upper || null);
        setRoundStateLower(data.round_state_lower || null);
        return;
      }
      if (wasCurrentReplay) {
        applyGameData(data);
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
      showOverallStopAlert(
        gameId,
        data.round_state_upper?.overall_stop?.reason,
        "manual",
      );

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
    setAutoStatus(createEmptyAutoStatus());
    setAutoError(null);
  };

  const syncAutoStatusFromSlot = (slot) => {
    setAutoStatus({
      running: !!slot?.auto_running,
      autoSessionId: slot?.auto_session_id || null,
      phase: slot?.phase || null,
      table_name: slot?.table_name || null,
      play_mode: slot?.play_mode || "one",
      keep_shoes_remaining: slot?.keep_shoes_remaining ?? null,
      actual_bet_scale: slot?.actual_bet_scale || 1,
      martin_recovery: roundState?.martin_recovery || null,
    });
    setAutoError(slot?.phase === "error" ? {
      code: slot.error_code || "auto_error",
      detail: slot.error_detail || "자동게임 처리 중 오류가 발생했습니다.",
    } : null);
  };

  const handleSlotSelect = async (slotNo) => {
    if (slotBusyRef.current) return;
    slotBusyRef.current = true;
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
      slotBusyRef.current = false;
      setSlotBusy(false);
    }
  };

  // new game: 현재 슬롯에서 carry-over 없이 교체
  const handleNewGameConfirm = async () => {
    setShowNewConfirm(false);
    if (!gameId || !selectedSlotNo || autoStatus.running) return;
    setProcessing(true);
    try {
      setReplay({ active: false, external: false, sourceGameId: null, roundNum: 0, totalRounds: 0 });
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

  const applyReplayState = useCallback((data, external) => {
    applyGameData(data, { preserveGameId: true });
    setReplay({
      active: true,
      external,
      sourceGameId: data.game_id,
      roundNum: data.round_num,
      totalRounds: data.total_rounds,
    });
  }, [applyGameData]);

  const fetchReplayState = useCallback(async (sourceGameId, targetRound, external) => {
    const params = targetRound == null ? {} : { round_num: targetRound };
    const res = await apiCaller.get(GH_GAMES_API.REPLAY(sourceGameId), params);
    applyReplayState(res.data, external);
    return res.data;
  }, [applyReplayState]);

  const openReplay = () => {
    setReplayGameInput("");
    setReplayPreview(null);
    setReplayError("");
    setReplayOpen(true);
  };

  const loadReplayPreview = async () => {
    const entered = replayGameInput.trim();
    const external = entered !== "";
    const sourceGameId = external ? Number(entered) : gameId;
    if (!Number.isInteger(sourceGameId) || sourceGameId <= 0) {
      setReplayError("올바른 게임번호를 입력하세요.");
      return;
    }
    setReplayLoading(true);
    setReplayError("");
    try {
      const res = await apiCaller.get(GH_GAMES_API.REPLAY(sourceGameId));
      setReplayPreview({ data: res.data, external });
    } catch (err) {
      setReplayPreview(null);
      setReplayError(err.response?.data?.detail || "리플레이 데이터를 불러오지 못했습니다.");
    } finally {
      setReplayLoading(false);
    }
  };

  const confirmReplay = () => {
    if (!replayPreview) return;
    applyReplayState(replayPreview.data, replayPreview.external);
    setReplayOpen(false);
  };

  const moveReplay = async (delta) => {
    if (replayLoading || !gameId) return;
    const sourceGameId = replay.active ? replay.sourceGameId : gameId;
    const external = replay.active ? replay.external : false;
    const currentRound = replay.active ? replay.roundNum : strategyResults.length;
    const totalRounds = replay.active ? replay.totalRounds : strategyResults.length;
    const targetRound = Math.max(1, Math.min(totalRounds, currentRound + delta));
    if (replay.active && targetRound === currentRound) return;
    setReplayLoading(true);
    try {
      await fetchReplayState(sourceGameId, targetRound, external);
    } catch (err) {
      setRejectMsg(err.response?.data?.detail || "리플레이 회차를 불러오지 못했습니다.");
    } finally {
      setReplayLoading(false);
    }
  };

  const moveReplayTo = async (value = replayRoundInput) => {
    if (replayLoading || !gameId) return;
    const sourceGameId = replay.active ? replay.sourceGameId : gameId;
    const external = replay.active ? replay.external : false;
    const totalRounds = replay.active ? replay.totalRounds : strategyResults.length;
    const targetRound = Number(value);
    if (!Number.isInteger(targetRound) || targetRound < 1 || targetRound > totalRounds) {
      setRejectMsg(`회차는 1~${totalRounds} 사이로 입력해주세요.`);
      return;
    }
    setReplayLoading(true);
    try {
      await fetchReplayState(sourceGameId, targetRound, external);
    } catch (err) {
      setRejectMsg(err.response?.data?.detail || "리플레이 회차를 불러오지 못했습니다.");
    } finally {
      setReplayLoading(false);
    }
  };

  const exitReplay = async () => {
    if (!replay.active) return;
    setReplayLoading(true);
    try {
      await restoreGame(gameId);
      setReplay({ active: false, external: false, sourceGameId: null, roundNum: 0, totalRounds: 0 });
    } finally {
      setReplayLoading(false);
    }
  };

  const openShoeCopy = () => {
    if (autoStatus.running) {
      setRejectMsg("오토 실행 중에는 기존 슈 입력 기능을 사용할 수 없습니다.");
      return;
    }
    setSourceGameInput("");
    setShoePreview(null);
    setShoeCopyError("");
    setShoeCopyOpen(true);
  };

  const loadShoePreview = async () => {
    const sourceGameId = Number(sourceGameInput);
    if (!Number.isInteger(sourceGameId) || sourceGameId <= 0) {
      setShoeCopyError("올바른 게임번호를 입력하세요.");
      return;
    }
    setShoeCopyLoading(true);
    setShoeCopyError("");
    try {
      const res = await apiCaller.get(GH_GAMES_API.SHOE_COPY_PREVIEW(sourceGameId), {
        source_game_type: shoeSourceType,
      });
      setShoePreview(res.data);
    } catch (err) {
      setShoePreview(null);
      setShoeCopyError(err.response?.data?.detail || "기존 슈를 조회하지 못했습니다.");
    } finally {
      setShoeCopyLoading(false);
    }
  };

  const executeShoeCopy = async () => {
    if (!shoePreview || !gameId || !selectedSlotNo || shoeCopyExecuting) return;
    if (autoStatus.running) {
      setShoeCopyOpen(false);
      setRejectMsg("오토 실행 중에는 기존 슈 입력 기능을 사용할 수 없습니다.");
      return;
    }
    setShoeCopyExecuting(true);
    setProcessing(true);
    setShoeCopyError("");
    setShoeCopyProgress({
      active: true,
      completed: Math.min(getShoeResultCount({ round_state_upper: roundStateUpper }), shoePreview.result_count),
      total: shoePreview.result_count,
    });
    let stateRefreshTimer = null;
    let stateRefreshPromise = null;
    let keepRefreshing = false;
    try {
      setShoeCopyOpen(false);

      keepRefreshing = true;
      const scheduleStateRefresh = () => {
        stateRefreshTimer = window.setTimeout(() => {
          stateRefreshPromise = apiCaller.get(GH_GAMES_API.STATE(gameId) + "?mode=user")
            .then((stateRes) => {
              applyGameData(stateRes.data);
              setShoeCopyProgress((prev) => ({
                ...prev,
                completed: Math.min(getShoeResultCount(stateRes.data), prev.total),
              }));
            })
            .catch(() => {})
            .finally(() => {
              stateRefreshPromise = null;
              if (keepRefreshing) scheduleStateRefresh();
            });
        }, 5000);
      };
      scheduleStateRefresh();

      const processRes = await apiCaller.post(
        GH_GAMES_API.SHOE_COPY_PROCESS,
        {
          source_game_type: shoePreview.source_game_type,
          source_game_id: shoePreview.source_game_id,
          game_id: gameId,
        },
        { timeout: 5 * 60 * 1000 },
      );
      const data = processRes.data;
      keepRefreshing = false;
      if (stateRefreshTimer) window.clearTimeout(stateRefreshTimer);
      if (stateRefreshPromise) await stateRefreshPromise;
      await restoreGame(gameId);
      await refreshGameSlots();
      setShoeCopyProgress({
        active: false,
        completed: data.completed_results,
        total: data.total_results,
      });
      if (!data.completed) {
        const detail = typeof data.error === "string" ? data.error : JSON.stringify(data.error);
        window.alert(
          `기존 슈 입력 중 오류가 발생했습니다.\n` +
          `${data.completed_results}개 결과 입력 완료 / ${data.failed_result_index}번째 결과 처리 실패\n` +
          `사유: ${detail}`
        );
      } else {
        window.alert(`기존 슈 입력 완료 (${data.completed_results}/${data.total_results})`);
      }
    } catch (err) {
      const detail = err.response?.data?.detail;
      const code = typeof detail === "object" ? detail?.error : null;
      if (code === "auto_running_stop_first") {
        setShoeCopyProgress((prev) => ({ ...prev, active: false }));
        setShoeCopyOpen(false);
        setRejectMsg("오토 실행 중에는 기존 슈 입력 기능을 사용할 수 없습니다.");
      } else if (err.code === "ECONNABORTED" || err.code === "ETIMEDOUT") {
        try {
          await restoreGame(gameId);
          setShoeCopyProgress((prev) => ({ ...prev, active: false }));
          setRejectMsg("처리 응답이 지연되고 있습니다. 현재 게임 상태를 갱신했습니다.");
        } catch {
          setShoeCopyProgress((prev) => ({ ...prev, active: false }));
          setShoeCopyError("처리 응답이 지연되고 있습니다. 잠시 후 슬롯 상태를 다시 확인해주세요.");
        }
      } else {
        setShoeCopyProgress((prev) => ({ ...prev, active: false }));
        setShoeCopyError(typeof detail === "string" ? detail : "기존 슈 입력을 실행하지 못했습니다.");
      }
    } finally {
      keepRefreshing = false;
      if (stateRefreshTimer) window.clearTimeout(stateRefreshTimer);
      setShoeCopyExecuting(false);
      setProcessing(false);
    }
  };

  const handleCloseSlotConfirm = async () => {
    setShowEndConfirm(false);
    if (!selectedSlotNo || !gameId || autoStatus.running || slotBusyRef.current) return;
    slotBusyRef.current = true;
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
      slotBusyRef.current = false;
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
    || replay.active
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
    || replay.active
    || !gameId
    || !selectedSlotNo
    || selectedSlotNo === 1
    || occupiedSlotCount <= 1
  );
  const endDisabledReason = selectedSlotNo === 1
    ? "1번 슬롯은 종료할 수 없습니다"
    : replay.active
      ? "리플레이를 먼저 종료해주세요"
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
        <span style={{ fontSize: 14, fontWeight: "bold", color: "#fff" }}>Globalhit</span>
        {gameId && <span style={{ fontSize: 11, color: "#888" }}>#{gameId}</span>}
        {replay.active && (
          <span style={{ fontSize: 12, color: "#ffb300", fontWeight: "bold", marginLeft: 8 }}>
            {`리플레이 중 #${replay.sourceGameId} · ${replay.roundNum}/${replay.totalRounds}회차`}
          </span>
        )}
        {autoStatus.running && (selectedGameSlot?.table_name || autoStatus.table_name) && (
          <span style={{ fontSize: 11, color: "#66bb6a", fontWeight: "bold", marginLeft: 8 }}>
            {selectedGameSlot?.table_name || autoStatus.table_name}
          </span>
        )}
      </Box>
      <GoalStatusBar roundState={roundState} autoStatus={autoStatus} />
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
                {cell && <GhCircle type={cell.type} filled={true} size={isMobile ? 12 : 22} label={cell.idx + 1} />}
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
                          <Typography variant="caption" sx={{ fontSize: 11, fontWeight: "bold", color: "#fff" }}>A</Typography>
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
                          <Typography variant="caption" sx={{ fontSize: 11, fontWeight: "bold", color: "#fff" }}>Z</Typography>
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
                    {amountViewMode === "actual" ? "BT" : "RE"}
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

                {/* 행1-2: 배팅금액판과 실제 주문에 합산되는 조건부 마틴 B/C */}
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexWrap: "wrap" }}>
                  {(() => {
                    const martinB = roundState?.conditional_martins?.martin_b || {};
                    const amount = Number(martinB.amount || 0);
                    const direction = martinB.direction || "";
                    return (
                      <>
                        <Box sx={tagSx("#7b1fa2")} title="마틴B (배팅액 합산)">
                          <Typography variant="caption" sx={{ fontSize: 11, fontWeight: "bold", color: "#fff" }}>B</Typography>
                        </Box>
                        <Box sx={{ ...fieldSx, minWidth: 84, px: 0.6 }}>
                          <Typography variant="caption" sx={{ fontSize: 10, color: "#ba68c8" }}>
                            {martinB.active ? `${martinB.step || 1}S` : "대기"}
                          </Typography>
                          <Typography variant="caption" sx={{ fontSize: 11, fontWeight: "bold", color: amount > 0 ? "#ce93d8" : "#666" }}>
                            {amount > 0 ? `${amount.toLocaleString()}${direction}` : "0"}
                          </Typography>
                        </Box>
                      </>
                    );
                  })()}
                  {(() => {
                    const martinC = roundState?.conditional_martins?.martin_c || {};
                    const amount = Number(martinC.amount || 0);
                    const direction = martinC.direction || "";
                    return (
                      <>
                        <Box sx={tagSx("#ef6c00")} title="마틴C 합산 (배팅액 합산)">
                          <Typography variant="caption" sx={{ fontSize: 11, fontWeight: "bold", color: "#fff" }}>C</Typography>
                        </Box>
                        <Box sx={{ ...fieldSx, minWidth: 84, px: 0.6 }}>
                          <Typography variant="caption" sx={{ fontSize: 10, color: "#ffb74d" }}>합산</Typography>
                          <Typography variant="caption" sx={{ fontSize: 11, fontWeight: "bold", color: amount > 0 ? "#ff9800" : "#666" }}>
                            {amount > 0 ? `${amount.toLocaleString()}${direction}` : "0"}
                          </Typography>
                        </Box>
                      </>
                    );
                  })()}
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
                      </>
                    );
                  })()}
                  {(() => {
                    const enabled = results.length > 0 && !processing && !replay.active;
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
            keepCount={keepCount}
            onModeChange={setAutoPlayMode}
            autoStatus={autoStatus}
            onPlay={handleAutoToggle}
            autoError={autoError}
            replayActive={replay.active}
            disabled={slotBusy || !gameId || legacyRestoreBlocked || replay.active}
          />
          </Box>

          <GhRoundAmountTable
            roundState={roundState}
            amountMode={amountViewMode}
            onSetup={() => navigate(`/ghgame/user-setup${gameId ? `?gameId=${gameId}` : ""}`)}
            setupDisabled={!isAdmin || replay.active}
            onNew={() => setShowNewConfirm(true)}
            newDisabled={processing || slotBusy || autoStatus.running || !gameId || !selectedSlotNo || (replay.active && !replay.external)}
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
            slotSelectionBlocked={slotBusy || replay.active}
            onEnd={() => setShowEndConfirm(true)}
            endDisabled={endDisabled}
            endDisabledReason={endDisabledReason}
          />

          </Box>
          {/* /1|2 row */}

          {isAdmin && (
            <Box sx={{
              display: "flex", alignItems: "center", gap: 1, mb: 1.5, px: 1, py: 0.7,
              border: "1px solid rgba(255,193,7,0.45)", borderRadius: 1,
              backgroundColor: "rgba(255,193,7,0.06)", flexWrap: "wrap",
            }}>
              <Typography variant="caption" sx={{ color: "#ffc107", fontWeight: "bold" }}>어드민 도구</Typography>
              <Button
                size="small"
                variant="outlined"
                color="warning"
                disabled={processing || slotBusy || autoStatus.running || replay.active || !gameId || !selectedSlotNo}
                onClick={openShoeCopy}
              >
                기존 슈 입력
              </Button>
              {autoStatus.running && (
                <Typography variant="caption" sx={{ color: "text.secondary" }}>오토 실행 중에는 사용할 수 없습니다.</Typography>
              )}
              {shoeCopyProgress.total > 0 && (
                <Typography variant="caption" sx={{ color: shoeCopyProgress.active ? "#ffc107" : "#4caf50", fontWeight: "bold" }}>
                  {shoeCopyProgress.active ? "기존 슈 입력 중" : "기존 슈 입력 완료"}
                  {` ${shoeCopyProgress.completed}/${shoeCopyProgress.total}`}
                </Typography>
              )}
              <Button
                size="small"
                variant="outlined"
                onClick={() => setReplayControlsOpen((open) => !open)}
                disabled={processing || replayLoading || !gameId}
              >
                리플레이
              </Button>
              <Button size="small" variant="outlined" color="secondary" onClick={openMaxMissPopup} disabled={!roundStateLower}>
                고연패 현황
              </Button>
              {(replay.active || replayControlsOpen) && (
                <>
                  <Button size="small" onClick={() => moveReplay(-10)} disabled={replayLoading || (replay.active ? replay.roundNum : strategyResults.length) <= 1}>-10</Button>
                  <Button size="small" onClick={() => moveReplay(-1)} disabled={replayLoading || (replay.active ? replay.roundNum : strategyResults.length) <= 1}>이전</Button>
                  <Button size="small" onClick={() => moveReplay(1)} disabled={!replay.active || replayLoading || replay.roundNum >= replay.totalRounds}>다음</Button>
                  <Button size="small" onClick={() => moveReplay(10)} disabled={!replay.active || replayLoading || replay.roundNum >= replay.totalRounds}>+10</Button>
                  <TextField
                    size="small"
                    type="number"
                    value={replayRoundInput}
                    onChange={(event) => setReplayRoundInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") moveReplayTo();
                    }}
                    inputProps={{ min: 1, max: replay.active ? replay.totalRounds : strategyResults.length }}
                    sx={{ width: 82 }}
                    disabled={replayLoading}
                  />
                  <Button size="small" onClick={() => moveReplayTo()} disabled={replayLoading || !replayRoundInput}>이동</Button>
                  <Button size="small" onClick={openReplay} disabled={replayLoading}>다른 게임</Button>
                  {replay.active && (
                    <Button size="small" color="warning" onClick={exitReplay} disabled={replayLoading}>리플레이 종료</Button>
                  )}
                </>
              )}
            </Box>
          )}

          {isAdmin && <GhLossStopStatus roundState={roundState} autoStatus={autoStatus} />}

          {isAdmin && roundStateLower && (
            <>
              {/* ===== 어드민 전용 하단 전략별 현황 전광판 ===== */}
              <GhStrategyBoard
                roundState={roundStateLower}
              />

              {/* ===== 어드민 전용 하단 빅로드2 ===== */}
              <GhBigRoad2
                roundState={roundStateLower}
                subgameBasis={getRoundStateSubgameBasis(roundStateLower)}
                ncRefShoes={roundStateLower?.nc_ref_shoes}
                ncRefShoeNo={roundStateLower?.nc_ref_shoe_no}
                ncRefControls={{
                  value: roundStateLower?.nc_ref_shoe_no ?? "",
                  setupValue: roundStateLower?.nc_ref_setup_game_seq ?? "랜덤",
                  readOnly: true,
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

      <Dialog open={replayOpen} onClose={() => !replayLoading && setReplayOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>게임 리플레이</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: "text.secondary", mb: 1.5 }}>
            게임번호를 비우면 현재 게임을, 입력하면 해당 게임을 리플레이합니다.
          </Typography>
          <TextField
            autoFocus
            fullWidth
            size="small"
            type="number"
            label="다른 게임번호 (선택)"
            value={replayGameInput}
            disabled={replayLoading}
            onChange={(event) => {
              setReplayGameInput(event.target.value);
              setReplayPreview(null);
              setReplayError("");
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") loadReplayPreview();
            }}
          />
          <Button variant="outlined" sx={{ mt: 1 }} disabled={replayLoading} onClick={loadReplayPreview}>
            {replayLoading ? "조회 중..." : "조회"}
          </Button>
          {replayError && (
            <Typography variant="body2" sx={{ color: "#f44336", mt: 1 }}>{replayError}</Typography>
          )}
          {replayPreview && (() => {
            const state = replayPreview.data.round_state_upper;
            const actuals = (state?.shoe_results || [])
              .map((item) => typeof item === "string" ? item : item?.actual)
              .filter((actual) => actual === "P" || actual === "B" || actual === "T");
            const previewGrid = buildShoePreviewGrid(actuals);
            const previewCols = previewGrid[0]?.length || 1;
            return (
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  {`게임 #${replayPreview.data.game_id} · ${replayPreview.data.status} · ${replayPreview.data.total_rounds}회차`}
                </Typography>
                <Box sx={{ overflowX: "auto", pb: 1 }}>
                  <Box sx={{
                    display: "grid", gridTemplateColumns: `repeat(${previewCols}, 24px)`,
                    gridTemplateRows: `repeat(${GRID_ROWS}, 24px)`, gridAutoFlow: "column",
                    gap: "1px", width: "fit-content", backgroundColor: "#616161", border: "1px solid #616161",
                  }}>
                    {Array.from({ length: previewCols }, (_, col) =>
                      Array.from({ length: GRID_ROWS }, (__, row) => {
                        const actual = previewGrid[row][col];
                        const color = actual === "P" ? "#1565c0" : actual === "B" ? "#f44336" : "#2e7d32";
                        return (
                          <Box key={`${row}-${col}`} sx={{ width: 24, height: 24, backgroundColor: "background.default", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            {actual && (
                              <Box sx={{ width: 20, height: 20, borderRadius: "50%", backgroundColor: color, color: "#fff", fontSize: 10, fontWeight: "bold", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                {actual}
                              </Box>
                            )}
                          </Box>
                        );
                      })
                    )}
                  </Box>
                </Box>
              </Box>
            );
          })()}
        </DialogContent>
        <DialogActions>
          <Button disabled={replayLoading} onClick={() => setReplayOpen(false)}>취소</Button>
          <Button variant="contained" disabled={replayLoading || !replayPreview} onClick={confirmReplay}>
            리플레이 시작
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={shoeCopyOpen}
        onClose={() => !shoeCopyExecuting && setShoeCopyOpen(false)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>기존 슈 입력</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", gap: 1, alignItems: "center", mt: 0.5, mb: 2, flexWrap: "wrap" }}>
            <TextField
              select
              size="small"
              label="원본 게임"
              value={shoeSourceType}
              disabled={shoeCopyExecuting}
              onChange={(event) => {
                const sourceType = event.target.value;
                setShoeSourceType(sourceType);
                saveShoeCopySourceType(SHOE_COPY_SOURCE_STORAGE_KEYS.gh, sourceType);
                setShoePreview(null);
                setShoeCopyError("");
              }}
              sx={{ minWidth: 150 }}
            >
              <MenuItem value="gh">글로벌히트</MenuItem>
              <MenuItem value="nc2">트리플나인</MenuItem>
            </TextField>
            <TextField
              autoFocus
              size="small"
              label="기존 게임번호"
              type="number"
              value={sourceGameInput}
              disabled={shoeCopyExecuting}
              onChange={(event) => {
                setSourceGameInput(event.target.value);
                setShoePreview(null);
                setShoeCopyError("");
              }}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                const action = shoeCopyEnterAction({
                  preview: shoePreview,
                  sourceType: shoeSourceType,
                  sourceGameInput,
                  busy: shoeCopyLoading || shoeCopyExecuting,
                });
                if (action === "execute") executeShoeCopy();
                else if (action === "lookup") loadShoePreview();
              }}
            />
            <Button variant="outlined" disabled={shoeCopyLoading || shoeCopyExecuting} onClick={loadShoePreview}>
              {shoeCopyLoading ? "조회 중..." : "조회"}
            </Button>
          </Box>

          {shoeCopyError && (
            <Typography variant="body2" sx={{ color: "#f44336", mb: 1 }}>{shoeCopyError}</Typography>
          )}

          {shoePreview && (() => {
            const previewGrid = buildShoePreviewGrid(shoePreview.actuals);
            const previewCols = previewGrid[0]?.length || 1;
            return (
              <>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  {`${shoePreview.source_game_label || "글로벌히트"} #${shoePreview.source_game_id} · ${shoePreview.round_count}회차 · 전체 결과 ${shoePreview.result_count}개`}
                </Typography>
                <Box sx={{ overflowX: "auto", pb: 1 }}>
                  <Box sx={{
                    display: "grid", gridTemplateColumns: `repeat(${previewCols}, 24px)`,
                    gridTemplateRows: `repeat(${GRID_ROWS}, 24px)`, gridAutoFlow: "column",
                    gap: "1px", width: "fit-content", backgroundColor: "#616161", border: "1px solid #616161",
                  }}>
                    {Array.from({ length: previewCols }, (_, col) =>
                      Array.from({ length: GRID_ROWS }, (__, row) => {
                        const actual = previewGrid[row][col];
                        const color = actual === "P" ? "#1565c0" : actual === "B" ? "#f44336" : "#2e7d32";
                        return (
                          <Box key={`${row}-${col}`} sx={{ width: 24, height: 24, backgroundColor: "background.default", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            {actual && (
                              <Box sx={{ width: 20, height: 20, borderRadius: "50%", backgroundColor: color, color: "#fff", fontSize: 10, fontWeight: "bold", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                {actual}
                              </Box>
                            )}
                          </Box>
                        );
                      })
                    )}
                  </Box>
                </Box>
                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                  현재 게임에 입력된 결과 수만큼 건너뛰고, 그다음 결과부터 이어서 입력합니다.
                </Typography>
              </>
            );
          })()}
        </DialogContent>
        <DialogActions>
          <Button disabled={shoeCopyExecuting} onClick={() => setShoeCopyOpen(false)}>취소</Button>
          <Button variant="contained" color="warning" disabled={!shoePreview || shoeCopyExecuting} onClick={executeShoeCopy}>
            {shoeCopyExecuting ? "입력 중..." : "현재 게임에 이어서 입력"}
          </Button>
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

      <Dialog
        open={overallStopDialog.open}
        onClose={() => setOverallStopDialog((prev) => ({ ...prev, open: false }))}
      >
        <DialogTitle sx={{ fontWeight: "bold" }}>
          {overallStopDialog.title}
        </DialogTitle>
        <DialogContent>
          <Typography>{overallStopDialog.detail}</Typography>
          <Typography sx={{ mt: 1, fontSize: "0.85rem", color: "text.secondary" }}>
            {overallStopDialog.modeLabel} 게임 · 픽 계산과 결과 기록은 계속됩니다.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setOverallStopDialog((prev) => ({ ...prev, open: false }))}
            variant="contained"
          >
            확인
          </Button>
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

      <Dialog open={keepCountOpen} onClose={() => setKeepCountOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>KEEP 반복 횟수</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            size="small"
            type="number"
            label="실행할 슈 수"
            value={keepCountInput}
            onChange={(event) => setKeepCountInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") confirmKeepCount();
            }}
            inputProps={{ min: GH_KEEP_COUNT_MIN, max: GH_KEEP_COUNT_MAX, step: 1 }}
            error={keepCountInput !== "" && parseGhKeepCount(keepCountInput) == null}
            helperText={`${GH_KEEP_COUNT_MIN}~${GH_KEEP_COUNT_MAX}회 · 1회는 ONE을 사용하세요`}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setKeepCountOpen(false)}>취소</Button>
          <Button variant="contained" disabled={parseGhKeepCount(keepCountInput) == null} onClick={confirmKeepCount}>확인</Button>
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
            keep_shoes_remaining: resp.keep_shoes_remaining ?? null,
            actual_bet_scale: resp.actual_bet_scale || 1,
            stop_reason: resp.stop_reason || null,
            active_pot_count: resp.active_pot_count ?? null,
            pot_stop_count: resp.pot_stop_count ?? 0,
            goal_amount: resp.goal_amount ?? 0,
          });
          showOverallStopAlert(
            gameId,
            resp.stop_reason,
            "auto",
            resp,
          );
          if (resp.slot_no) setSelectedSlotNo(resp.slot_no);
          refreshGameSlots().catch(() => {});
        }}
        onError={setAutoError}
        gameId={gameId}
        pickhandId={myPickhandId}
        gameType="gh"
        playMode={autoPlayMode}
        keepCount={keepCount}
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
