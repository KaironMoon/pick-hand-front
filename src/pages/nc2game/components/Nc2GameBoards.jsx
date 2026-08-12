import { Box, Tooltip } from "@mui/material";
import { resolvePickMartinSummary } from "../../ghgame/pick-martin-summary.js";

const GRID_ROWS = 6;
const GRID_COLS = 40;
const shouldDisplayAutoError = (status, error = null) => Boolean(status?.phase === "error" || error);
const shouldDisplaySlotAutoError = (slot) => Boolean(slot?.phase === "error" || slot?.auto_status === "error");

export const Nc2Circle = ({ type, filled = true, size = 24, label }) => {
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

export const calculateNc2CircleGrid = (results) => {
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

export function Nc2RoundAmountTable({
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
  const cellCount = Math.max(80, Array.isArray(table.cells) ? table.cells.length : 0);
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
      failureDetail: actualCell.failure_detail || null,
    };
  });
  const fmt = (v) => v === "N/A" ? "-" : Number(v || 0).toFixed(1);
  const finalSide = table.total_side;
  const currentRoundIdx = Math.max(0, Number(roundState?.round_num || 0));
  const totalAmount = amountMode === "actual"
    ? Number(actualCells[currentRoundIdx]?.bet_amount_p || 0)
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
      <Box sx={{ position: "relative", display: "flex", alignItems: "stretch", gap: 0.5, width: "100%" }}>
        {slotBusy && (
          <Box
            role="status"
            aria-live="polite"
            sx={{
              position: "absolute", inset: 0, zIndex: 3, display: "flex",
              alignItems: "center", justifyContent: "center", border: "1px solid #2f9bff",
              borderRadius: 1, backgroundColor: "rgba(8, 10, 13, 0.88)", color: "#7ec8ff",
              fontSize: 12, fontWeight: "bold", cursor: "wait",
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
          <span>BET</span><span>{fmt(totalAmount)}</span>
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
export function Nc2BettingSummaryPanel({
  roundState,
  selectedMode,
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
      .find((cell) => cell?.failure_code)
    : null;
  const hasReplayBetError = !!replayFailure?.failure_code;
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
    { text: "keep", selection: "keep" },
    {
      text: hasAutoError ? "check" : autoStatus?.running ? "stop" : "play",
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
            const clickable = !disabled && !hasAutoError && (selectable || !!cell.play);
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
