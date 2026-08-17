import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControlLabel, MenuItem, TextField, Typography, useMediaQuery, useTheme,
} from "@mui/material";
import { useAtomValue } from "jotai";
import { useNavigate, useSearchParams } from "react-router-dom";

import { userAtom } from "@/store/auth-store";
import apiCaller from "@/services/api-caller";
import autoService from "@/services/auto-service";
import AutoStartDialog from "../t9game/components/AutoStartDialog";
import { claimOverallStopAlert } from "../ghgame/overall-stop-alert.js";
import { Nc2BettingSummaryPanel, Nc2Circle, Nc2RoundAmountTable, calculateNc2CircleGrid } from "./components/Nc2GameBoards.jsx";
import { nc2ItemWinLimitLabel } from "./game-setting-label.js";
import { nc2ItemNumberStyle } from "./item-end-style.js";
import { clearNc2KeepCombination, loadNc2KeepCombination, saveNc2KeepCombination } from "./keep-combination.js";
import { createGameResponseGuard } from "./game-response-guard.js";
import { isNc2ReferenceFixedOpen } from "./reference-sections.js";
import { nc2SetupPath, updateNc2GameSearchParams } from "./slot-navigation.js";
import { nc2DrawdownConditionLabel, nc2ItemLossStopLabel } from "./slot-operating-options.js";
import { nc2ZzzStopLabel } from "./zzz-stop-label.js";
import { betStepRangeLabel } from "./bet-block-setting.js";
import { NC2_GAMES_API } from "@/constants/api-url";
import {
  loadShoeCopySourceType,
  saveShoeCopySourceType,
  SHOE_COPY_SOURCE_STORAGE_KEYS,
  shoeCopyEnterAction,
} from "@/utils/shoe-copy-dialog.js";

const zoneColor = { blue: "#42a5f5", white: "#fff", red: "#ef5350" };
const resultCellColor = { hit: "#00e676", miss: "#ffeb3b", wait: "#fff" };
const GRID_ROWS = 6;
const GRID_COLS = 40;

const buildShoePreviewGrid = (actuals) => {
  const cols = Math.max(1, Math.ceil((actuals?.length || 0) / GRID_ROWS));
  return Array.from({ length: GRID_ROWS }, (_, row) =>
    Array.from({ length: cols }, (__, col) => actuals?.[col * GRID_ROWS + row] || null)
  );
};

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

function PickChip({ value }) {
  if (!value) return null;
  const waiting = value === "W";
  return (
    <Box sx={{
      width: 22, height: 22, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
      color: waiting ? "#000" : "#fff", fontWeight: 900, fontSize: 11,
      backgroundColor: waiting ? "#fff" : value === "P" ? "#1565c0" : "#e53935",
    }}>{value}</Box>
  );
}

function Nc2Grid({ state }) {
  const actuals = state?.actuals || "";
  const sortedItems = [...(state?.items || [])].sort(
    (left, right) => Number(left.game_seq || 0) - Number(right.game_seq || 0),
  );
  const infoWidths = [30, 58, 52, 42, 48, 50, 58];
  const progressRoundIndex = Number(state?.round_num || 0) < 60 ? Number(state?.round_num || 0) : -1;
  return (
    <Box sx={{ overflow: "auto", maxHeight: "62vh", border: "1px solid #59616d", backgroundColor: "#101318" }}>
      <Box component="table" sx={{ borderCollapse: "separate", borderSpacing: 0, tableLayout: "fixed", width: 2198, minWidth: 2198, fontSize: 11, color: "#fff" }}>
        <thead>
          <tr>
            {["#", "NC", "구분", "단계", "적중률", "금액", "최대연패", ...Array.from({ length: 60 }, (_, i) => i + 1)].map((label, index) => (
              (() => {
                const isProgress = index >= 7 && index - 7 === progressRoundIndex;
                return (
              <Box component="th" key={label} sx={{
                position: "sticky", top: 0, left: index < 3 ? (index === 0 ? 0 : index === 1 ? infoWidths[0] : infoWidths[0] + infoWidths[1]) : undefined,
                zIndex: index < 3 ? 4 : 3,
                width: index < 7 ? infoWidths[index] : 31,
                minWidth: index < 7 ? infoWidths[index] : 31,
                maxWidth: index < 7 ? infoWidths[index] : 31,
                height: 31,
                borderRight: isProgress ? "2px solid #ffb300" : "1px solid #59616d",
                borderLeft: isProgress ? "2px solid #ffb300" : undefined,
                borderBottom: isProgress ? "2px solid #ffb300" : "1px solid #59616d",
                backgroundColor: isProgress ? "#6d4c00" : "#20262e",
                color: isProgress ? "#fff59d" : "#e8edf3",
                boxShadow: isProgress ? "inset 0 0 8px rgba(255,193,7,.45)" : "none",
              }}>{isProgress ? `▶${label}` : label}</Box>
                );
              })()
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedItems.map((item, sortedIndex) => {
            const assistHistory = Array.isArray(item.assist_history) ? item.assist_history : [];
            const sharedInfoSx = { textAlign: "center", borderRight: "1px solid #59616d", borderBottom: "1px solid #59616d" };
            const roundCellSx = (isProgress, status) => ({
              width: 31, height: 27, borderRight: isProgress ? "2px solid #ffb300" : "1px solid #59616d",
              borderLeft: isProgress ? "2px solid #ffb300" : undefined, borderBottom: "1px solid #59616d", textAlign: "center",
              backgroundColor: status === "hit" ? "#2e9e5b" : status === "miss" ? "#5b6068" : status === "wait" ? "#4b3b18" : isProgress ? "rgba(255,193,7,.13)" : "transparent",
            });
            return <Fragment key={item.index}>
              <tr>
                <Box component="td" rowSpan={2} sx={{ position: "sticky", left: 0, zIndex: 2, width: infoWidths[0], minWidth: infoWidths[0], maxWidth: infoWidths[0], ...sharedInfoSx, ...nc2ItemNumberStyle(item) }}>{sortedIndex + 1}</Box>
                <Box component="td" rowSpan={2} sx={{ position: "sticky", left: infoWidths[0], zIndex: 2, width: infoWidths[1], minWidth: infoWidths[1], maxWidth: infoWidths[1], ...sharedInfoSx, backgroundColor: "#181d23", fontWeight: 800 }}>{item.game_seq}</Box>
                <Box component="td" sx={{ position: "sticky", left: infoWidths[0] + infoWidths[1], zIndex: 2, width: infoWidths[2], minWidth: infoWidths[2], ...sharedInfoSx, backgroundColor: "#20262e", color: "#90caf9", fontWeight: 800 }}>생성픽</Box>
                <Box component="td" sx={{ width: infoWidths[3], minWidth: infoWidths[3], ...sharedInfoSx, color: "#555" }}>-</Box>
                <Box component="td" sx={{ width: infoWidths[4], minWidth: infoWidths[4], ...sharedInfoSx }}>{item.generated_rate == null ? "-" : `${item.generated_rate}%`}</Box>
                <Box component="td" sx={{ width: infoWidths[5], minWidth: infoWidths[5], ...sharedInfoSx, color: "#555" }}>-</Box>
                <Box component="td" sx={{ width: infoWidths[6], minWidth: infoWidths[6], ...sharedInfoSx, fontWeight: 800 }}>{Number(item.generated_max_miss_streak || 0)}</Box>
                {Array.from({ length: 60 }, (_, roundIndex) => {
                  const pick = item.shoes?.[roundIndex];
                  const actual = actuals[roundIndex];
                  const status = actual ? (pick === actual ? "hit" : "miss") : null;
                  const isProgress = roundIndex === progressRoundIndex;
                  return <Box component="td" key={roundIndex} title="생성픽" sx={roundCellSx(isProgress, status)}><Box sx={{ display: "flex", justifyContent: "center" }}><PickChip value={pick} /></Box></Box>;
                })}
              </tr>
              <tr>
                <Box component="td" sx={{ position: "sticky", left: infoWidths[0] + infoWidths[1], zIndex: 2, width: infoWidths[2], minWidth: infoWidths[2], ...sharedInfoSx, backgroundColor: "#20262e", color: "#ce93d8", fontWeight: 800 }}>어시픽</Box>
                <Box component="td" sx={{ width: infoWidths[3], minWidth: infoWidths[3], ...sharedInfoSx }}>{item.step}S</Box>
                <Box component="td" sx={{ width: infoWidths[4], minWidth: infoWidths[4], ...sharedInfoSx }}>{item.rate == null ? "-" : `${item.rate}%`}</Box>
                <Box component="td" sx={{ width: infoWidths[5], minWidth: infoWidths[5], ...sharedInfoSx, textAlign: "right", pr: 0.5, color: zoneColor[item.zone] }}>{Number(item.amount || 0).toFixed(1)}</Box>
                <Box component="td" sx={{ width: infoWidths[6], minWidth: infoWidths[6], ...sharedInfoSx, fontWeight: 800 }}>{Number(item.max_miss_streak || 0)}</Box>
                {Array.from({ length: 60 }, (_, roundIndex) => {
                  const actual = actuals[roundIndex];
                  const fallbackPick = item.shoes?.[roundIndex];
                  const stored = assistHistory[roundIndex];
                  const isCurrent = roundIndex === progressRoundIndex;
                  const pick = stored ? stored.pick : actual ? fallbackPick : isCurrent ? (item.assist_pick ?? item.pick) : null;
                  const status = stored?.status || (actual && pick ? (pick === actual ? "hit" : "miss") : isCurrent && !pick ? "wait" : null);
                  const source = stored?.source || (isCurrent ? item.assist_source : "회차진행");
                  return <Box component="td" key={roundIndex} title={source || "어시픽"} sx={roundCellSx(isCurrent, status)}>
                    <Box sx={{ display: "flex", justifyContent: "center" }}><PickChip value={status === "wait" ? "W" : pick} /></Box>
                  </Box>;
                })}
              </tr>
            </Fragment>;
          })}
        </tbody>
      </Box>
    </Box>
  );
}

function MartinZzzBoard({ zzz, actuals, roundHistory }) {
  const historyByRound = new Map((roundHistory || []).map((entry) => [Number(entry.round_num), entry]));
  const currentRound = Math.min(59, String(actuals || "").length);
  const statusItems = [
    ["P/B", `${zzz.p_count || 0}/${zzz.b_count || 0}`],
    ["판정", `${Number(zzz.point || 0).toFixed(1)}P`],
    ["방향", zzz.direction || "-"],
    ["단계", `${zzz.step || 1}단계`],
    ["승률", zzz.rate == null ? "-" : `${Number(zzz.rate).toFixed(1)}% (${zzz.hit || 0}/${zzz.total || 0})`],
    ["구간", { white: "흰색", blue: "파란색", red: "빨간색" }[zzz.zone] || "흰색"],
    ["금액", `${Number(zzz.amount || 0).toFixed(1)}P`],
    ["연패", `${zzz.loss_streak || 0}연패`],
    ["손익", `${Number(zzz.pnl || 0).toFixed(1)}P`],
    ["상태", zzz.ended ? `${zzz.ended_at_round || "-"}회 ${zzz.end_reason === "loss_stop" ? "손실종료" : "종료"}` : "진행"],
    ["종료조건", nc2ZzzStopLabel(zzz.stop_round, zzz.stop_step, zzz.loss_stop_amount)],
  ];
  const componentForRound = (roundIndex) => {
    if (roundIndex === String(actuals || "").length) {
      return {
        direction: zzz.direction,
        amount: zzz.amount || 0,
        point: zzz.point || 0,
        matched: !!zzz.matched,
      };
    }
    return (historyByRound.get(roundIndex + 1)?.zzz_components || []).find(
      (item) => Number(item.index) === Number(zzz.index),
    );
  };
  return <Box sx={{ mb: 1.5, border: "1px solid #7e57c2", backgroundColor: "#120d1b" }}>
    <Box sx={{ display: "flex", flexWrap: "wrap" }}>
      <Box sx={{ px: 1.2, py: .6, backgroundColor: "#7b1fa2", fontSize: 11, fontWeight: 900 }}>{zzz.name || `마틴 ZZZ ${zzz.index}`}</Box>
      {statusItems.map(([label, value]) => <Box key={label} sx={{ px: 1.2, py: .6, borderLeft: "1px solid #4a3d5f", fontSize: 11 }}><Box component="span" sx={{ color: "#aaa", mr: .6 }}>{label}</Box><Box component="span" sx={{ color: label === "금액" || label === "손익" ? "#00e676" : "#fff", fontWeight: 900 }}>{value}</Box></Box>)}
    </Box>
    <Box sx={{ overflowX: "auto", borderTop: "1px solid #4a3d5f" }}>
      <Box component="table" sx={{ borderCollapse: "collapse", tableLayout: "fixed", minWidth: 1920, fontSize: 10 }}><tbody>
      <tr>
        <Box component="th" sx={{ position: "sticky", left: 0, zIndex: 2, width: 64, minWidth: 64, height: 24, backgroundColor: "#251832", borderRight: "1px solid #4a3d5f", borderBottom: "1px solid #4a3d5f" }}>회차</Box>
        {Array.from({ length: 60 }, (_, roundIndex) => {
          const isCurrent = roundIndex === currentRound;
          return <Box component="th" key={roundIndex} sx={{ width: 31, minWidth: 31, height: 24, textAlign: "center", borderRight: isCurrent ? "2px solid #ffb300" : "1px solid #4a3d5f", borderBottom: "1px solid #4a3d5f", backgroundColor: isCurrent ? "#6d4c00" : "#251832", color: isCurrent ? "#fff59d" : "#ddd", boxShadow: isCurrent ? "inset 0 0 8px rgba(255,193,7,.45)" : "none" }}>{isCurrent ? `▶${roundIndex + 1}` : roundIndex + 1}</Box>;
        })}
      </tr>
      <tr>
        <Box component="th" sx={{ position: "sticky", left: 0, zIndex: 2, width: 64, minWidth: 64, backgroundColor: "#251832", borderRight: "1px solid #4a3d5f", borderBottom: "1px solid #4a3d5f", lineHeight: 1.1 }}>NC금액<br />합계</Box>
        {Array.from({ length: 60 }, (_, roundIndex) => {
          const component = componentForRound(roundIndex);
          const direction = component?.direction;
          return <Box component="td" key={roundIndex} sx={{ width: 31, minWidth: 31, height: 24, textAlign: "center", borderRight: roundIndex === currentRound ? "2px solid #ffb300" : "1px solid #4a3d5f", borderBottom: "1px solid #4a3d5f", color: direction === "P" ? "#42a5f5" : direction === "B" ? "#ef5350" : "#777", fontWeight: 900 }}>{component ? Number(component.point || 0).toFixed(1) : ""}</Box>;
        })}
      </tr>
      <tr>
        <Box component="th" sx={{ position: "sticky", left: 0, zIndex: 2, width: 64, minWidth: 64, backgroundColor: "#251832", borderRight: "1px solid #4a3d5f" }}>ZZZ픽</Box>
        {Array.from({ length: 60 }, (_, roundIndex) => {
          const component = componentForRound(roundIndex);
          const direction = component?.matched ? component?.direction : null;
          const actual = String(actuals || "")[roundIndex];
          const status = actual && direction ? (actual === direction ? "hit" : "miss") : null;
          return <Box component="td" key={roundIndex} sx={{ width: 31, minWidth: 31, height: 30, textAlign: "center", borderRight: roundIndex === currentRound ? "2px solid #ffb300" : "1px solid #4a3d5f", backgroundColor: status === "hit" ? resultCellColor.hit : status === "miss" ? resultCellColor.miss : "transparent" }} title={component ? `${Number(component.amount || 0).toFixed(1)}P` : "배팅 없음"}><Box sx={{ display: "flex", justifyContent: "center" }}><PickChip value={direction} /></Box></Box>;
        })}
      </tr></tbody></Box>
    </Box>
  </Box>;
}

function MartinZzzReferenceGrid({ zzz, roundNum }) {
  const progressRoundIndex = Number(roundNum || 0) < 60 ? Number(roundNum || 0) : -1;
  const roundCellSx = (roundIndex) => {
    const isProgress = roundIndex === progressRoundIndex;
    return {
      width: 31,
      minWidth: 31,
      height: 26,
      textAlign: "center",
      borderRight: isProgress ? "2px solid #ffb300" : "1px solid #4a3d5f",
      borderLeft: isProgress ? "2px solid #ffb300" : undefined,
      borderBottom: "1px solid #4a3d5f",
      backgroundColor: isProgress ? "rgba(255,193,7,.13)" : "transparent",
    };
  };
  return <Box sx={{ mb: 1.5, border: "1px solid #7e57c2", backgroundColor: "#120d1b" }}>
    <Box sx={{ px: 1.2, py: .6, backgroundColor: "#7b1fa2", fontSize: 11, fontWeight: 900 }}>{`마틴 ZZZ ${zzz.index} 기준 NC (${zzz.reference_game_seqs?.length || 0})`}</Box>
    <Box sx={{ overflow: "auto", maxHeight: "42vh", borderTop: "1px solid #4a3d5f" }}>
      <Box component="table" sx={{ borderCollapse: "separate", borderSpacing: 0, tableLayout: "fixed", minWidth: 1980, fontSize: 10 }}>
        <thead><tr>
          <Box component="th" sx={{ position: "sticky", top: 0, left: 0, zIndex: 3, width: 62, minWidth: 62, height: 28, backgroundColor: "#251832", borderRight: "1px solid #4a3d5f", borderBottom: "1px solid #4a3d5f" }}>NC</Box>
          {Array.from({ length: 60 }, (_, roundIndex) => {
            const isProgress = roundIndex === progressRoundIndex;
            return <Box component="th" key={roundIndex} sx={{ ...roundCellSx(roundIndex), position: "sticky", top: 0, zIndex: 2, backgroundColor: isProgress ? "#6d4c00" : "#251832", color: isProgress ? "#fff59d" : "#ddd", boxShadow: isProgress ? "inset 0 0 8px rgba(255,193,7,.45)" : "none" }}>{isProgress ? `▶${roundIndex + 1}` : roundIndex + 1}</Box>;
          })}
        </tr></thead>
        <tbody>
        {(zzz.refs || []).map((ref, refIndex) => <tr key={ref.game_seq}>
          <Box component="td" sx={{ position: "sticky", left: 0, zIndex: 1, width: 62, minWidth: 62, textAlign: "center", backgroundColor: "#18121f", borderRight: "1px solid #4a3d5f", borderBottom: "1px solid #4a3d5f" }}>{ref.game_seq || refIndex + 1}</Box>
          {Array.from({ length: 60 }, (_, roundIndex) => <Box component="td" key={roundIndex} sx={roundCellSx(roundIndex)}><Box sx={{ display: "flex", justifyContent: "center" }}><PickChip value={ref.shoes?.[roundIndex]} /></Box></Box>)}
        </tr>)}
      </tbody></Box>
    </Box>
  </Box>;
}

function Nc2ReferenceSections({ state, zzzs }) {
  const [selected, setSelected] = useState({});
  if (isNc2ReferenceFixedOpen(zzzs)) {
    return <Box sx={{ mb: 2, backgroundColor: "#000", p: 1, overflowX: "auto" }}>
      <Nc2Grid state={state} />
    </Box>;
  }
  const sections = [
    ...zzzs.map((zzz) => ({ id: `zzz-${zzz.index}`, label: `ZZZ${zzz.index} NC`, zzz })),
    { id: "existing-nc", label: "기존 NC" },
  ];
  const toggle = (id) => setSelected((previous) => ({ ...previous, [id]: !previous[id] }));
  return <Box sx={{ mb: 2, backgroundColor: "#000", p: 1, overflowX: "auto" }}>
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: .75, mb: 1 }}>
      {sections.map((section) => <Box
        key={section.id}
        component="button"
        type="button"
        onClick={() => toggle(section.id)}
        style={{
          border: selected[section.id] ? "1px solid #00e676" : "1px solid #555",
          borderRadius: 4,
          background: selected[section.id] ? "#14351f" : "#1b1b1b",
          color: selected[section.id] ? "#fff" : "#bbb",
          padding: "4px 9px",
          fontSize: 12,
          cursor: "pointer",
        }}
      >{section.label}</Box>)}
    </Box>
    {!sections.some((section) => selected[section.id]) && <Box sx={{ color: "#777", fontSize: 12, py: 1 }}>표시할 NC 판을 선택하세요.</Box>}
    {sections.map((section) => selected[section.id]
      ? section.zzz
        ? <MartinZzzReferenceGrid key={section.id} zzz={section.zzz} roundNum={state?.round_num} />
        : <Nc2Grid key={section.id} state={state} />
      : null)}
  </Box>;
}

export default function Nc2UserGamePage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const user = useAtomValue(userAtom);
  const navigate = useNavigate();
  const isAdmin = user?.role === "admin";
  const [searchParams, setSearchParams] = useSearchParams();
  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [keptGameSeqs, setKeptGameSeqs] = useState(loadNc2KeepCombination);
  const [sourceGameId, setSourceGameId] = useState("");
  const [autoOpen, setAutoOpen] = useState(false);
  const [autoPlayMode, setAutoPlayMode] = useState("keep");
  const [autoStatus, setAutoStatus] = useState({ running: false });
  const [autoStatusError, setAutoStatusError] = useState(null);
  const [amountViewMode, setAmountViewMode] = useState("calculated");
  const [replayControlsOpen, setReplayControlsOpen] = useState(false);
  const [replay, setReplay] = useState({ active: false, sourceGameId: null, originGameId: null, roundNum: 0, totalRounds: 0 });
  const [replayOpen, setReplayOpen] = useState(false);
  const [replayGameInput, setReplayGameInput] = useState("");
  const [replayPreview, setReplayPreview] = useState(null);
  const [replayLoading, setReplayLoading] = useState(false);
  const [replayError, setReplayError] = useState("");
  const [roundInput, setRoundInput] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const [gameSlots, setGameSlots] = useState([]);
  const [selectedSlotNo, setSelectedSlotNo] = useState(null);
  const [slotBusy, setSlotBusy] = useState(false);
  const slotBusyRef = useRef(false);
  const gameResponseGuardRef = useRef(null);
  if (gameResponseGuardRef.current === null) {
    gameResponseGuardRef.current = createGameResponseGuard();
  }
  const [shoeCopyOpen, setShoeCopyOpen] = useState(false);
  const [shoeSourceType, setShoeSourceType] = useState(() => loadShoeCopySourceType(
    SHOE_COPY_SOURCE_STORAGE_KEYS.nc2,
    "nc2",
  ));
  const [shoeSourceId, setShoeSourceId] = useState("");
  const [shoePreview, setShoePreview] = useState(null);
  const [shoeCopyLoading, setShoeCopyLoading] = useState(false);
  const [shoeCopyError, setShoeCopyError] = useState("");
  const overallStopAlertedRef = useRef(new Set());
  const [overallStopDialog, setOverallStopDialog] = useState({
    open: false,
    detail: "",
    modeLabel: "",
  });
  const state = game?.round_state;
  const nc2BetRangeStoppedCount = (state?.items || []).filter(
    (item) => item?.bet_range_stopped,
  ).length;
  const martinZBetRangeStopped = !!state?.martin_z_bet_range_stop?.stopped;
  const keepCombination = Array.isArray(keptGameSeqs) && keptGameSeqs.length > 0;

  const loadShoePreview = async () => {
    const sourceId = Number(shoeSourceId);
    if (!Number.isInteger(sourceId) || sourceId <= 0) { setShoeCopyError("올바른 게임번호를 입력하세요."); return; }
    setShoeCopyLoading(true); setShoeCopyError("");
    try {
      const response = await apiCaller.get(NC2_GAMES_API.SHOE_COPY_PREVIEW(sourceId), { source_game_type: shoeSourceType });
      setShoePreview(response.data);
    } catch (err) { setShoePreview(null); setShoeCopyError(err.response?.data?.detail || "기존 슈를 조회하지 못했습니다."); }
    finally { setShoeCopyLoading(false); }
  };

  const executeShoeCopy = async () => {
    if (!shoePreview || !game?.game_id) return;
    setShoeCopyLoading(true); setLoading(true); setShoeCopyError("");
    try {
      const response = await apiCaller.post(NC2_GAMES_API.SHOE_COPY_PROCESS, {
        source_game_type: shoePreview.source_game_type, source_game_id: shoePreview.source_game_id, game_id: game.game_id,
      }, { timeout: 5 * 60 * 1000 });
      await restore(game.game_id);
      if (response.data.completed) { setShoeCopyOpen(false); window.alert(`기존 슈 입력 완료 (${response.data.completed_results}/${response.data.total_results})`); }
      else setShoeCopyError(`${response.data.completed_results}개 입력 후 실패: ${response.data.error}`);
    } catch (err) { setShoeCopyError(err.response?.data?.detail || "기존 슈 입력을 실행하지 못했습니다."); }
    finally { setShoeCopyLoading(false); setLoading(false); }
  };

  const applyGame = useCallback((data, { activate = false } = {}) => {
    if (activate) gameResponseGuardRef.current.activate(data?.game_id);
    setGame(data);
    if (data?.game_id) {
      setSearchParams(
        (current) => updateNc2GameSearchParams(current, {
          gameId: data.game_id,
          slotNo: data.slot_no,
        }),
        { replace: true },
      );
    }
  }, [setSearchParams]);

  const showOverallStopAlert = useCallback((targetGameId, reason, mode) => {
    const alert = claimOverallStopAlert(
      overallStopAlertedRef.current,
      targetGameId,
      reason,
      mode,
    );
    if (alert) {
      setOverallStopDialog({
        open: true,
        detail: alert.detail,
        modeLabel: alert.modeLabel,
      });
    }
  }, []);

  useEffect(() => {
    if (replay.active) return;
    const targetGameId = game?.game_id;
    const reason = state?.overall_stop?.reason || autoStatus?.stop_reason;
    const isPrematureManualGoal = (
      !autoStatus?.running
      && reason === "goal_reached"
      && Number(game?.config?.auto_goal_amount || 0) > 0
      && Number(state?.pnl || 0) < Number(game?.config?.auto_goal_amount || 0)
    );
    if (isPrematureManualGoal) {
      overallStopAlertedRef.current.delete(String(targetGameId));
      setOverallStopDialog((previous) => ({ ...previous, open: false }));
      return;
    }
    showOverallStopAlert(
      targetGameId,
      reason,
      autoStatus?.running ? "auto" : "manual",
    );
  }, [
    autoStatus?.running,
    autoStatus?.stop_reason,
    game?.config?.auto_goal_amount,
    game?.game_id,
    replay.active,
    showOverallStopAlert,
    state?.overall_stop?.reason,
    state?.pnl,
  ]);

  const handleKeepCombinationChange = useCallback((event) => {
    const enabled = event.target.checked;
    if (!enabled) {
      setKeptGameSeqs(null);
      clearNc2KeepCombination();
      return;
    }
    const gameSeqs = (state?.items || []).map((item) => Number(item.game_seq));
    if (!gameSeqs.length || gameSeqs.some((value) => !Number.isInteger(value) || value <= 0)) {
      setError("유지할 NC 조합값이 없습니다.");
      return;
    }
    setKeptGameSeqs(gameSeqs);
    saveNc2KeepCombination(gameSeqs);
  }, [state?.items]);

  const restore = useCallback(async (gameId, { activate = false } = {}) => {
    if (activate) gameResponseGuardRef.current.activate(gameId);
    const ticket = gameResponseGuardRef.current.begin(gameId);
    const response = await apiCaller.get(NC2_GAMES_API.STATE(gameId));
    if (!gameResponseGuardRef.current.canApply(ticket)) return null;
    applyGame(response.data);
    return response.data;
  }, [applyGame]);

  const refreshGameSlots = useCallback(async () => {
    const response = await apiCaller.get(NC2_GAMES_API.SLOTS);
    const slots = Array.isArray(response.data?.slots) ? response.data.slots : [];
    setGameSlots(slots);
    return slots;
  }, []);

  const clearCurrentGame = useCallback(() => {
    gameResponseGuardRef.current.clear();
    setGame(null);
    setAutoStatus({ running: false });
    setAutoStatusError(null);
    setReplay({ active: false, sourceGameId: null, originGameId: null, roundNum: 0, totalRounds: 0 });
  }, []);

  const syncAutoStatusFromSlot = useCallback((slot) => {
    setAutoStatus({
      running: !!slot?.auto_running,
      auto_session_id: slot?.auto_session_id || null,
      phase: slot?.phase || null,
      table_name: slot?.table_name || null,
      play_mode: slot?.play_mode || "one",
      actual_bet_scale: slot?.actual_bet_scale || 1,
    });
    setAutoStatusError(slot?.phase === "error" ? {
      code: slot.error_code || "auto_error",
      detail: slot.error_detail || "자동게임 처리 중 오류가 발생했습니다.",
    } : null);
  }, []);

  const start = useCallback(async ({ source = null, slotNo = null, replaceGameId = null } = {}) => {
    setLoading(true); setError("");
    try {
      const response = await apiCaller.post(NC2_GAMES_API.START, {
        keep_combination: keepCombination,
        reference_game_seqs: source ? null : keptGameSeqs,
        source_game_id: source,
        slot_no: slotNo,
        replace_game_id: replaceGameId,
      });
      applyGame(response.data, { activate: true });
      if (keepCombination && source) {
        const nextGameSeqs = (response.data?.round_state?.items || [])
          .map((item) => Number(item.game_seq));
        if (nextGameSeqs.length) {
          setKeptGameSeqs(nextGameSeqs);
          saveNc2KeepCombination(nextGameSeqs);
        }
      }
      if (response.data.slot_no) setSelectedSlotNo(response.data.slot_no);
      if (source) setSourceGameId("");
      setReplay({ active: false, sourceGameId: null, originGameId: null, roundNum: 0, totalRounds: 0 });
      await refreshGameSlots();
      return response.data;
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "NC2 게임을 시작하지 못했습니다.");
      throw err;
    } finally { setLoading(false); }
  }, [applyGame, keepCombination, keptGameSeqs, refreshGameSlots]);

  useEffect(() => {
    let cancelled = false;
    const initialize = async () => {
      try {
        const slots = await refreshGameSlots();
        if (cancelled) return;
        const gameId = Number(searchParams.get("gameId"));
        const urlSlotNo = Number(searchParams.get("slot"));
        if (gameId > 0) {
          const slot = slots.find((item) => item.game_id === gameId);
          setSelectedSlotNo(slot?.slot_no ?? null);
          if (slot) {
            setSearchParams(
              (current) => updateNc2GameSearchParams(current, { gameId, slotNo: slot.slot_no }),
              { replace: true },
            );
          }
          if (slot) syncAutoStatusFromSlot(slot);
          await restore(gameId, { activate: true });
          return;
        }
        if (Number.isInteger(urlSlotNo) && urlSlotNo >= 1 && urlSlotNo <= 6) {
          const slot = slots.find((item) => item.slot_no === urlSlotNo);
          setSelectedSlotNo(urlSlotNo);
          if (slot?.occupied) {
            syncAutoStatusFromSlot(slot);
            await restore(slot.game_id, { activate: true });
          } else {
            clearCurrentGame();
          }
          return;
        }
        const firstOccupied = slots.find((item) => item.occupied);
        if (firstOccupied) {
          setSelectedSlotNo(firstOccupied.slot_no);
          setSearchParams(
            (current) => updateNc2GameSearchParams(current, {
              gameId: firstOccupied.game_id,
              slotNo: firstOccupied.slot_no,
            }),
            { replace: true },
          );
          syncAutoStatusFromSlot(firstOccupied);
          await restore(firstOccupied.game_id, { activate: true });
        } else {
          setSelectedSlotNo(1);
          clearCurrentGame();
          setSearchParams({ slot: 1 }, { replace: true });
        }
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.detail || "NC2 상태를 불러오지 못했습니다.");
      }
    };
    initialize();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!game?.game_id) return undefined;
    let cancelled = false;
    const poll = () => autoService.getAutoStatus(game.game_id, "nc2").then((status) => {
      if (cancelled || !gameResponseGuardRef.current.isActive(game.game_id)) return;
      setAutoStatus(status);
      setAutoStatusError(null);
      if (status.running && (status.play_mode === "one" || status.play_mode === "keep")) {
        setAutoPlayMode(status.play_mode);
      }
      if (status.running) {
        restore(game.game_id).catch(() => {});
      }
      refreshGameSlots().catch(() => {});
    }).catch((err) => {
      if (cancelled) return;
      setAutoStatusError({
        code: "auto_status_lookup_failed",
        detail: err.response?.data?.detail || "오토 실행 상태를 확인하지 못했습니다.",
      });
    });
    poll();
    const timer = setInterval(poll, 3000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [game?.game_id, refreshGameSlots, restore]);

  useEffect(() => {
    setAmountViewMode(autoStatus.running ? "actual" : "calculated");
  }, [autoStatus.running]);

  // GH와 동일하게 오토 이벤트를 실시간 구독하고, 결과 확정 시 서버 상태를 다시 읽는다.
  useEffect(() => {
    if (!game?.game_id || !autoStatus.running) return undefined;
    const token = sessionStorage.getItem("pick_hand_token");
    if (!token) return undefined;

    const base = import.meta.env.VITE_API_BASE_URL || window.location.origin;
    const wsUrl = `${base.replace(/^http/, "ws")}/ws/auto?token=${encodeURIComponent(token)}`;
    let ws;
    let pingTimer;
    let reconnectTimer;
    let cancelled = false;

    const refreshEventGame = (gameId, activate = false) => {
      if (!gameId) return;
      restore(gameId, { activate }).catch(() => {});
    };
    const connect = () => {
      if (cancelled) return;
      ws = new WebSocket(wsUrl);
      ws.onopen = () => {
        setAutoStatusError(null);
        pingTimer = setInterval(() => {
          try { ws.send("ping"); } catch (_) {}
        }, 30000);
      };
      ws.onmessage = (event) => {
        try {
          if (!gameResponseGuardRef.current.isActive(game.game_id)) return;
          const message = JSON.parse(event.data);
          const type = message.type;
          const data = message.data || {};
          if (type !== "pong") {
            const currentGameId = Number(game.game_id);
            const eventGameId = Number(data.game_id);
            const sourceGameId = Number(data.source_game_id);
            const currentSessionId = autoStatus.auto_session_id;
            const belongsToCurrentAuto = (
              (Number.isFinite(eventGameId) && eventGameId === currentGameId)
              || (Number.isFinite(sourceGameId) && sourceGameId === currentGameId)
              || (currentSessionId && data.auto_session_id === currentSessionId)
              || (currentSessionId && data.source_auto_session_id === currentSessionId)
            );
            if (!belongsToCurrentAuto) return;
          }

          if (type === "round_committed") {
            const eventGameId = data.game_id || game.game_id;
            refreshEventGame(eventGameId, Number(eventGameId) !== Number(game.game_id));
            setAutoStatus((previous) => ({
              ...previous,
              phase: data.phase ?? previous.phase,
              round_count: data.round_count ?? previous.round_count,
              pnl_total: data.pnl_total ?? previous.pnl_total,
              pnl_actual: data.pnl_actual ?? previous.pnl_actual,
              pnl_total_p: data.pnl_total_p ?? previous.pnl_total_p,
              pnl_actual_p: data.pnl_actual_p ?? previous.pnl_actual_p,
              stop_reason: data.stop_reason ?? previous.stop_reason,
              pending_direction: data.pending_direction ?? null,
              pending_amount_p: data.pending_amount_p ?? 0,
              pending_amount_won: data.pending_amount_won ?? 0,
            }));
          } else if (type === "shoe_result_recorded") {
            refreshEventGame(data.game_id || game.game_id);
          } else if (type === "phase_changed") {
            setAutoStatus((previous) => ({
              ...previous,
              phase: data.phase ?? previous.phase,
              round_count: data.round_count ?? previous.round_count,
              pnl_total: data.pnl_total ?? previous.pnl_total,
              pnl_actual: data.pnl_actual ?? previous.pnl_actual,
              pnl_total_p: data.pnl_total_p ?? previous.pnl_total_p,
              pnl_actual_p: data.pnl_actual_p ?? previous.pnl_actual_p,
              stop_reason: data.stop_reason ?? data.reason ?? previous.stop_reason,
            }));
            if (data.game_id && Number(data.game_id) !== Number(game.game_id)) {
              refreshEventGame(data.game_id, true);
            }
          } else if (type === "game_switched" && data.new_game_id) {
            refreshEventGame(data.new_game_id, true);
          } else if (type === "auto_restarted") {
            setAutoStatus((previous) => ({
              ...previous,
              running: true,
              auto_session_id: data.auto_session_id,
              phase: data.phase || "betting",
              round_count: 0,
              pnl_total: 0,
              pnl_actual: 0,
              pnl_total_p: 0,
              pnl_actual_p: 0,
              stop_reason: data.stop_reason || null,
            }));
            refreshEventGame(data.game_id, true);
          } else if (type === "bet_attempt") {
            setGame((previous) => previous ? {
              ...previous,
              round_state: applyActualBetAttempt(previous.round_state, data),
            } : previous);
          } else if (type === "bet_settled") {
            setGame((previous) => previous ? {
              ...previous,
              round_state: applyActualBetSettlement(previous.round_state, data),
            } : previous);
          } else if (type === "bet_rejected") {
            setError("배팅이 거부되었습니다 (카지노 미체결)");
            refreshEventGame(data.game_id || game.game_id);
          }
        } catch (_) {}
      };
      ws.onclose = () => {
        clearInterval(pingTimer);
        if (!cancelled) reconnectTimer = setTimeout(connect, 5000);
      };
      ws.onerror = () => {
        setAutoStatusError({
          code: "realtime_connection_error",
          detail: "오토 실시간 연결에 문제가 발생했습니다. 상태 조회로 복구 중입니다.",
        });
        try { ws.close(); } catch (_) {}
      };
    };
    connect();

    return () => {
      cancelled = true;
      clearInterval(pingTimer);
      clearTimeout(reconnectTimer);
      try { ws?.close(); } catch (_) {}
    };
  }, [autoStatus.running, autoStatus.auto_session_id, game?.game_id, restore]);

  const record = async (actual) => {
    if (!game?.game_id || loading || replay.active) return;
    setLoading(true); setError("");
    const ticket = gameResponseGuardRef.current.begin(game.game_id);
    try {
      const response = await apiCaller.post(NC2_GAMES_API.ROUND, { game_id: game.game_id, actual });
      if (gameResponseGuardRef.current.canApply(ticket)) applyGame(response.data);
    }
    catch (err) { setError(err.response?.data?.detail || "결과 입력 실패"); }
    finally { setLoading(false); }
  };

  const deleteLastRound = async () => {
    if (!game?.game_id || loading || replay.active || autoStatus.running || Number(state?.round_num || 0) <= 0) return;
    setLoading(true); setError("");
    const ticket = gameResponseGuardRef.current.begin(game.game_id);
    try {
      const response = await apiCaller.delete(NC2_GAMES_API.LAST_ROUND(game.game_id));
      if (gameResponseGuardRef.current.canApply(ticket)) applyGame(response.data);
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(detail?.error === "auto_running_stop_first"
        ? "오토를 먼저 정지해야 마지막 회차를 삭제할 수 있습니다."
        : typeof detail === "string" ? detail : "마지막 회차 삭제 실패");
    } finally { setLoading(false); }
  };

  const newGame = async () => {
    if (!selectedSlotNo || slotBusyRef.current || loading) return;
    slotBusyRef.current = true;
    setSlotBusy(true);
    try {
      const previousGameId = game?.game_id;
      setNewOpen(false);
      await start({
        source: sourceGameId ? Number(sourceGameId) : null,
        slotNo: selectedSlotNo,
        replaceGameId: previousGameId || null,
      });
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "새 게임을 시작하지 못했습니다.");
    } finally {
      slotBusyRef.current = false;
      setSlotBusy(false);
    }
  };

  const handleSlotSelect = async (slotNo) => {
    if (slotBusyRef.current || replay.active) return;
    slotBusyRef.current = true;
    setSlotBusy(true);
    setError("");
    try {
      const slot = gameSlots.find((item) => item.slot_no === slotNo);
      setSelectedSlotNo(slotNo);
      setSearchParams(
        (current) => updateNc2GameSearchParams(current, { slotNo, gameId: null }),
        { replace: true },
      );
      if (slot?.occupied) {
        syncAutoStatusFromSlot(slot);
        await restore(slot.game_id, { activate: true });
      } else {
        clearCurrentGame();
        await start({ slotNo });
      }
      await refreshGameSlots();
    } catch (err) {
      const code = err.response?.data?.detail?.error;
      setError(code === "game_slot_occupied"
        ? "다른 요청에서 슬롯이 먼저 사용됐습니다. 슬롯 상태를 새로고침합니다."
        : "게임 슬롯을 전환하지 못했습니다.");
      await refreshGameSlots().catch(() => {});
    } finally {
      slotBusyRef.current = false;
      setSlotBusy(false);
    }
  };

  const closeSelectedSlot = async () => {
    setEndOpen(false);
    if (!selectedSlotNo || !game?.game_id || autoStatus.running || slotBusyRef.current) return;
    slotBusyRef.current = true;
    setSlotBusy(true);
    try {
      await apiCaller.post(NC2_GAMES_API.SLOT_CLOSE(selectedSlotNo));
      clearCurrentGame();
      const slots = await refreshGameSlots();
      const nextSlot = slots.find((item) => item.occupied && item.auto_running)
        || slots.find((item) => item.occupied);
      if (nextSlot) {
        setSelectedSlotNo(nextSlot.slot_no);
        syncAutoStatusFromSlot(nextSlot);
        await restore(nextSlot.game_id, { activate: true });
      }
    } catch (err) {
      const code = err.response?.data?.detail?.error;
      setError(code === "auto_running_stop_first"
        ? "오토를 먼저 정지해야 게임을 종료할 수 있습니다."
        : code === "primary_game_slot_required"
          ? "1번 슬롯은 종료할 수 없습니다."
          : code === "last_game_slot_required"
            ? "마지막 게임 슬롯은 종료할 수 없습니다."
            : "게임을 종료하지 못했습니다.");
    } finally {
      slotBusyRef.current = false;
      setSlotBusy(false);
    }
  };

  const openReplay = () => {
    setReplayGameInput("");
    setReplayPreview(null);
    setReplayError("");
    setReplayOpen(true);
  };

  const loadReplayPreview = async () => {
    const entered = replayGameInput.trim();
    const source = entered ? Number(entered) : replay.active ? replay.sourceGameId : game?.game_id;
    if (!Number.isInteger(source) || source <= 0) {
      setReplayError("올바른 게임번호를 입력하세요.");
      return;
    }
    setReplayLoading(true);
    setReplayError("");
    try {
      const response = await apiCaller.get(NC2_GAMES_API.REPLAY(source));
      setReplayPreview(response.data);
    } catch (err) {
      setReplayPreview(null);
      setReplayError(err.response?.data?.detail || "리플레이 데이터를 불러오지 못했습니다.");
    } finally {
      setReplayLoading(false);
    }
  };

  const confirmReplay = () => {
    if (!replayPreview) return;
    const originGameId = replay.active ? replay.originGameId : game?.game_id;
    gameResponseGuardRef.current.clear();
    setGame(replayPreview);
    setReplay({
      active: true,
      sourceGameId: replayPreview.game_id,
      originGameId,
      roundNum: Number(replayPreview.round_state?.round_num || 0),
      totalRounds: Number(replayPreview.total_rounds || 0),
    });
    setRoundInput(String(replayPreview.round_state?.round_num || 0));
    setReplayOpen(false);
  };

  const moveReplay = async (target) => {
    if (replayLoading) return;
    const source = replay.active ? replay.sourceGameId : game?.game_id;
    const total = replay.active ? replay.totalRounds : Number(state?.round_num || 0);
    const round = Math.max(1, Math.min(total, Number(target)));
    setReplayLoading(true);
    try {
      const response = await apiCaller.get(NC2_GAMES_API.REPLAY(source), { round_num: round });
      setGame(response.data);
      setReplay((previous) => ({
        active: true,
        sourceGameId: source,
        originGameId: previous.active ? previous.originGameId : game?.game_id,
        roundNum: round,
        totalRounds: response.data.total_rounds,
      }));
      setRoundInput(String(round));
    } catch (err) {
      setError(err.response?.data?.detail || "리플레이 회차를 불러오지 못했습니다.");
    } finally {
      setReplayLoading(false);
    }
  };

  const exitReplay = async () => {
    const originGameId = replay.originGameId;
    if (!originGameId) return;
    setReplayLoading(true);
    try {
      await restore(originGameId, { activate: true });
      setReplay({ active: false, sourceGameId: null, originGameId: null, roundNum: 0, totalRounds: 0 });
      setRoundInput("");
    } finally {
      setReplayLoading(false);
    }
  };

  const handleAutoToggle = async () => {
    if (autoStatus.running && autoStatus.auto_session_id) {
      await autoService.stopAuto(autoStatus.auto_session_id);
      setAutoStatus({ running: false });
      await refreshGameSlots();
      return;
    }

    const hasRounds = Number(state?.round_num || 0) > 0;
    if (hasRounds) {
      const ok = window.confirm(
        "현재 게임에 이미 진행된 라운드가 있습니다.\n\n" +
        "Auto는 새 게임에서 시작하는 것을 권장합니다.\n" +
        "취소 후 [NW] 버튼으로 새 게임을 만든 뒤 다시 시작하세요.\n\n" +
        "그래도 현재 게임에서 진행하시겠습니까?"
      );
      if (!ok) return;
    }
    setAutoOpen(true);
  };

  const overallBettingStopped = state?.overall_stop?.stopped === true;
  const aggregate = overallBettingStopped
    ? { ...(state?.next_bet || {}), direction: null, amount: 0, p_total: 0, b_total: 0 }
    : state?.next_bet || {};
  const pickMartin = overallBettingStopped
    ? { ...(state?.pick_martin || {}), direction: null, amount: 0 }
    : state?.pick_martin || {};
  const currentRound = replay.active ? replay.roundNum : Number(state?.round_num || 0);
  const finalLabel = aggregate.direction ? `${aggregate.direction} ${Number(aggregate.amount || 0).toFixed(1)}P` : "대기 0P";
  const summary = useMemo(() => ({ P: aggregate.p_total || 0, B: aggregate.b_total || 0 }), [aggregate.p_total, aggregate.b_total]);
  const bigRoad = useMemo(() => {
    const historyByRound = new Map(
      (state?.round_history || []).map((entry) => [Number(entry.round_num), entry]),
    );
    return calculateNc2CircleGrid(
      [...String(state?.actuals || "")].map((value, idx) => ({
        value,
        status: historyByRound.get(idx + 1)?.status || "wait",
        idx,
      })),
    );
  }, [state?.actuals, state?.round_history]);
  const pCount = [...String(state?.actuals || "")].filter((value) => value === "P").length;
  const bCount = Number(state?.round_num || 0) - pCount;
  const inputLocked = !game || loading || replay.active;
  const deleteDisabled = inputLocked || autoStatus.running || Number(state?.round_num || 0) <= 0;
  const occupiedSlotCount = gameSlots.filter((slot) => slot.occupied).length;
  const endDisabled = loading || slotBusy || autoStatus.running || replay.active
    || !game?.game_id || !selectedSlotNo || selectedSlotNo === 1 || occupiedSlotCount <= 1;
  const endDisabledReason = selectedSlotNo === 1
    ? "1번 슬롯은 종료할 수 없습니다"
    : replay.active
      ? "리플레이를 먼저 종료해주세요"
      : autoStatus.running
        ? "오토를 먼저 정지해야 게임을 종료할 수 있습니다"
        : occupiedSlotCount <= 1
          ? "마지막 게임 슬롯은 종료할 수 없습니다"
          : loading || slotBusy
            ? "현재 요청을 처리 중입니다"
            : "종료할 게임 슬롯이 없습니다";
  const panelSx = { border: "1px solid rgba(255,255,255,.3)", borderRadius: 1, backgroundColor: "#101318" };
  const pbSx = (backgroundColor) => ({ width: 48, height: 48, borderRadius: 2, backgroundColor, color: "#fff", fontSize: 24, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", cursor: inputLocked ? "not-allowed" : "pointer", opacity: inputLocked ? .4 : 1, "&:hover": { opacity: .85 }, "&:active": { transform: "scale(.95)" } });
  const ghRoundState = useMemo(() => {
    const actuals = String(state?.actuals || "");
    const historyByRound = new Map(
      (state?.round_history || []).map((entry) => [Number(entry.round_num), entry]),
    );
    const cells = Array.from({ length: Math.max(80, actuals.length + 1) }, (_, idx) => {
      const history = historyByRound.get(idx + 1);
      const isCurrent = idx === actuals.length;
      return {
        round: idx + 1,
        amount: history ? Number(history.amount || 0) : isCurrent ? Number(aggregate.amount || 0) : 0,
        martinZIncluded: history
          ? Number(history.bonus_amount || 0) > 0
          : isCurrent && Number(aggregate.bonus_amount || 0) > 0,
        martinZAmount: history
          ? Number(history.bonus_amount || 0)
          : isCurrent ? Number(aggregate.bonus_amount || 0) : 0,
        scaledMartinZAmount: history
          ? Number(history.scaled_bonus_amount || 0)
          : isCurrent ? Number(aggregate.scaled_bonus_amount || 0) : 0,
        pnl: history ? Number(history.pnl || 0) : 0,
        total_pnl: history ? Number(history.total_pnl || 0) : 0,
        actual: history?.actual || actuals[idx] || null,
        pick: history?.direction || (isCurrent ? aggregate.direction : null),
        status: history?.status || null,
      };
    });
    return {
      round_num: Number(state?.round_num || 0),
      shoe_results: [...actuals],
      pick_martin: {
        step: Number(pickMartin.step || 1),
        direction: pickMartin.direction || aggregate.direction,
        amount: Number(pickMartin.amount || 0),
      },
      round_amount_table: {
        cells,
        total_side: aggregate.direction,
        total_amount: Number(aggregate.amount || 0),
        total_pnl: Number(state?.pnl || 0),
      },
      actual_bet_table: state?.actual_bet_table || {},
    };
  }, [state, aggregate.direction, aggregate.amount, aggregate.bonus_amount, aggregate.scaled_bonus_amount, pickMartin.step, pickMartin.direction, pickMartin.amount]);

  return (
    <Box sx={{ p: isMobile ? .5 : 2 }}>
      <Box sx={{ mb: 1, display: "flex", alignItems: "center", gap: 1 }}>
        <span style={{ fontSize: 14, fontWeight: "bold", color: "#fff" }}>TripleNine</span>
        {game?.game_id && <span style={{ fontSize: 11, color: "#888" }}>#{game.game_id}</span>}
        {game?.game_id && autoStatus.table_name && <span style={{ fontSize: 11, color: "#bbb", fontWeight: 700 }}>{autoStatus.table_name}</span>}
        {replay.active && <span style={{ fontSize: 12, color: "#ffb300", fontWeight: "bold", marginLeft: 8 }}>{`리플레이 중 #${replay.sourceGameId} · ${replay.roundNum}/${replay.totalRounds}회차`}</span>}
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: `repeat(${GRID_COLS}, ${isMobile ? 16 : 26}px)`, gridTemplateRows: `repeat(${GRID_ROWS}, ${isMobile ? 16 : 26}px)`, gap: "1px", mb: 2, backgroundColor: "#616161", border: "1px solid #616161", width: "fit-content" }}>
        {bigRoad.flatMap((row, r) => row.map((cell, c) => <Box key={`${r}-${c}`} sx={{ backgroundColor: cell ? (resultCellColor[cell.status] || "#fff") : "background.default", display: "flex", alignItems: "center", justifyContent: "center", ...(r === 3 ? { borderTop: "2px solid #87ceeb" } : {}) }}>{cell && <Nc2Circle type={cell.type} filled size={isMobile ? 12 : 22} label={cell.idx + 1} />}</Box>))}
      </Box>

      <Box sx={{ display: "flex", flexDirection: "row", gap: 1, alignItems: "flex-start", mb: 2, overflowX: "auto", overflowY: "hidden" }}>
        <Box sx={{ flex: "0 0 auto", display: "flex", flexDirection: "column", gap: 1 }}>
          <Box sx={{ display: "flex", gap: .5, alignItems: "center", flexWrap: "wrap" }}>
            <Box sx={{ borderRadius: 1, px: .5, height: 20, minWidth: 44, backgroundColor: "#1565c0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 900 }}>A</Box>
            <Box sx={{ ...panelSx, minWidth: 55, height: 24, px: 1, display: "flex", alignItems: "center", justifyContent: "flex-end", color: Number(summary.P) > 0 ? "#4caf50" : "#666", fontSize: 12, fontWeight: 900 }}>{Number(summary.P).toFixed(1)}</Box>
            <Box sx={{ borderRadius: 1, px: .5, height: 20, minWidth: 44, backgroundColor: "#c62828", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 900 }}>Z</Box>
            <Box sx={{ ...panelSx, minWidth: 80, height: 24, px: .6, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: .5, color: Number(pickMartin.amount) > 0 ? "#4caf50" : "#666", fontSize: 11, fontWeight: 900 }}><span style={{ color: "#888", fontSize: 10 }}>{Number(pickMartin.step || 1)}S</span>{Number(pickMartin.amount || 0).toFixed(1)}{pickMartin.direction || ""}</Box>
            <Box sx={{ width: 32, height: 32, border: "1px solid #8e24aa", borderRadius: 1, backgroundColor: "#101318", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 13, opacity: .4 }}>≡0</Box>
            <Box
              role="button"
              tabIndex={0}
              title={amountViewMode === "actual" ? "실제 베팅 금액 표시 중" : "전략 계산 금액 표시 중"}
              onClick={() => setAmountViewMode((previous) => previous === "actual" ? "calculated" : "actual")}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  setAmountViewMode((previous) => previous === "actual" ? "calculated" : "actual");
                }
              }}
              sx={{
                width: 32, height: 32,
                border: `1px solid ${amountViewMode === "actual" ? "#00a85a" : "#2f80ed"}`,
                borderRadius: 1,
                backgroundColor: amountViewMode === "actual" ? "#10271d" : "#101318",
                color: amountViewMode === "actual" ? "#00e676" : "#64b5f6",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 900, fontSize: 13, cursor: "pointer",
              }}
            >{amountViewMode === "actual" ? "BT" : "RE"}</Box>
            {Number(autoStatus.actual_bet_scale) === 0.1 && (
              <Box
                title="실제 카지노 주문액에 ×0.1 적용 중"
                sx={{ width: 38, minWidth: 38, height: 32, border: "1px solid #00a85a", borderRadius: 1, backgroundColor: "#10271d", color: "#00e676", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 900, whiteSpace: "nowrap" }}
              >×0.1</Box>
            )}
          </Box>
          <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
            <Box sx={{ ...panelSx, width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900 }}>{currentRound + 1}</Box>
            <Box sx={pbSx("#1565c0")} onClick={() => !inputLocked && record("P")}>P</Box>
            <Box sx={{ ...panelSx, width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900 }}>{pCount}</Box>
            <Box sx={pbSx("#f44336")} onClick={() => !inputLocked && record("B")}>B</Box>
            <Box sx={{ ...panelSx, width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900 }}>{bCount}</Box>
            <Box
              role="button"
              tabIndex={deleteDisabled ? undefined : 0}
              title={autoStatus.running ? "오토를 먼저 정지해주세요" : deleteDisabled ? "삭제할 회차가 없습니다" : "마지막 회차 삭제"}
              onClick={deleteDisabled ? undefined : deleteLastRound}
              onKeyDown={deleteDisabled ? undefined : (event) => {
                if (event.key === "Enter" || event.key === " ") deleteLastRound();
              }}
              sx={{
                ...panelSx,
                px: 1.5,
                height: 40,
                display: "flex",
                alignItems: "center",
                color: deleteDisabled ? "#666" : "#fff",
                cursor: deleteDisabled ? "not-allowed" : "pointer",
                opacity: deleteDisabled ? .45 : 1,
                "&:hover": deleteDisabled ? undefined : { borderColor: "#f44336", color: "#ff8a80" },
                "&:active": deleteDisabled ? undefined : { transform: "scale(.96)" },
              }}
            >del</Box>
          </Box>
          <Nc2BettingSummaryPanel
            roundState={ghRoundState}
            selectedMode={autoPlayMode}
            onModeChange={setAutoPlayMode}
            autoStatus={autoStatus}
            onPlay={handleAutoToggle}
            autoError={autoStatusError}
            replayActive={replay.active}
            disabled={!game || replay.active}
          />
        </Box>

        <Nc2RoundAmountTable
          roundState={ghRoundState}
          amountMode={amountViewMode}
          onSetup={() => navigate(nc2SetupPath(selectedSlotNo))}
          onNew={() => setNewOpen(true)}
          newDisabled={loading || slotBusy || autoStatus.running || replay.active || !selectedSlotNo}
          gameSlots={gameSlots}
          selectedSlotNo={selectedSlotNo}
          onSlotSelect={handleSlotSelect}
          slotBusy={slotBusy}
          slotSelectionBlocked={slotBusy || replay.active}
          onEnd={() => setEndOpen(true)}
          endDisabled={endDisabled}
          endDisabledReason={endDisabledReason}
          restrictedView={!isAdmin}
        />
      </Box>

      {isAdmin && <>
      <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap", mb: .7, px: 1, py: .7, border: "1px solid rgba(255,193,7,.45)", borderRadius: 1, backgroundColor: "rgba(255,193,7,.06)" }}>
        <Typography variant="caption" sx={{ color: "#ffc107", fontWeight: 900 }}>어드민 도구</Typography>
        <Typography
          variant="caption"
          title="현재 선택된 게임이 생성될 때 저장된 번호별 종료설정"
          sx={{ px: 1, py: .35, border: "1px solid rgba(255,193,7,.55)", borderRadius: 1, color: "#ffe082", fontWeight: 900 }}
        >현재 게임 승리 종료 설정: {nc2ItemWinLimitLabel(game?.config)}</Typography>
        <FormControlLabel
          sx={{ m: 0, mr: .5, "& .MuiFormControlLabel-label": { fontSize: 12 } }}
          control={<Checkbox size="small" sx={{ p: .5 }} checked={keepCombination} onChange={handleKeepCombinationChange} />}
          label="NC 조합 유지"
        />
        <TextField
          size="small"
          type="number"
          label="NC 게임번호"
          value={sourceGameId}
          onChange={(event) => setSourceGameId(event.target.value)}
          inputProps={{ min: 1 }}
          sx={{ width: 142, "& .MuiInputBase-root": { height: 32 }, "& .MuiInputBase-input": { fontSize: 12, py: .5 } }}
        />
        <Button size="small" variant="outlined" color="warning" onClick={() => setNewOpen(true)} disabled={!sourceGameId || loading || autoStatus.running || replay.active}>이 조합으로 새 게임</Button>
        <Button size="small" variant="outlined" color="warning" onClick={() => { setShoeSourceId(""); setShoePreview(null); setShoeCopyError(""); setShoeCopyOpen(true); }} disabled={loading || autoStatus.running || replay.active || !game?.game_id}>기존 슈 불러오기</Button>
        <Button size="small" variant="outlined" onClick={() => setReplayControlsOpen((open) => !open)} disabled={loading || replayLoading || !game?.game_id}>리플레이</Button>
        {autoStatus.running && <Typography variant="caption" sx={{ color: "text.secondary" }}>오토 실행 중에는 NC 조합을 변경할 수 없습니다.</Typography>}
        {(replay.active || replayControlsOpen) && <>
          <Button size="small" onClick={() => moveReplay(currentRound - 10)} disabled={replayLoading || currentRound <= 1}>-10</Button>
          <Button size="small" onClick={() => moveReplay(currentRound - 1)} disabled={replayLoading || currentRound <= 1}>이전</Button>
          <Button size="small" onClick={() => moveReplay(currentRound + 1)} disabled={!replay.active || replayLoading || currentRound >= replay.totalRounds}>다음</Button>
          <Button size="small" onClick={() => moveReplay(currentRound + 10)} disabled={!replay.active || replayLoading || currentRound >= replay.totalRounds}>+10</Button>
          <TextField size="small" type="number" value={roundInput} onChange={(event) => setRoundInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") moveReplay(roundInput); }} inputProps={{ min: 1, max: replay.active ? replay.totalRounds : currentRound }} sx={{ width: 82, "& .MuiInputBase-root": { height: 32 }, "& .MuiInputBase-input": { fontSize: 12, py: .5 } }} disabled={replayLoading} />
          <Button size="small" onClick={() => moveReplay(roundInput)} disabled={replayLoading || roundInput === ""}>이동</Button>
          <Button size="small" onClick={openReplay} disabled={replayLoading}>다른 게임</Button>
          {replay.active && <Button size="small" color="warning" onClick={exitReplay} disabled={replayLoading}>리플레이 종료</Button>}
        </>}
      </Box>
      <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap", mb: 1.5, px: 1, py: .7, border: "1px solid rgba(255,193,7,.3)", borderRadius: 1, backgroundColor: "rgba(255,193,7,.035)" }}>
        <Typography variant="caption" sx={{ color: "#ffc107", fontWeight: 900 }}>현재 게임 배팅조건</Typography>
        <Typography variant="caption" sx={{ px: 1, py: .35, border: "1px solid rgba(255,193,7,.45)", borderRadius: 1, color: "#ffe082", fontWeight: 800 }}>
          NC2: {game?.config ? betStepRangeLabel(
            game.config.bet_block_after_round,
            game.config.bet_allowed_step_min,
            game.config.bet_allowed_step_max,
          ) : "-"} · 배팅중지 {nc2BetRangeStoppedCount}개
        </Typography>
        <Typography variant="caption" sx={{ px: 1, py: .35, border: "1px solid rgba(255,193,7,.45)", borderRadius: 1, color: "#ffe082", fontWeight: 800 }}>
          마틴 Z: {game?.config ? betStepRangeLabel(
            game.config.martin_z?.bet_block_after_round,
            game.config.martin_z?.bet_allowed_step_min,
            game.config.martin_z?.bet_allowed_step_max,
          ) : "-"} · {martinZBetRangeStopped ? "배팅중지" : "정상"}
        </Typography>
        <Typography variant="caption" sx={{ px: 1, py: .35, border: "1px solid rgba(255,193,7,.45)", borderRadius: 1, color: "#ffe082", fontWeight: 800 }}>
          손실종료조건: {game?.config ? nc2DrawdownConditionLabel(game.config) : "-"}
        </Typography>
        <Typography variant="caption" sx={{ px: 1, py: .35, border: "1px solid rgba(255,193,7,.45)", borderRadius: 1, color: "#ffe082", fontWeight: 800 }}>
          번호별 손실종료: {game?.config ? nc2ItemLossStopLabel(game.config) : "-"}
        </Typography>
      </Box>
      </>}

      {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
      {isAdmin && (state?.martin_zzzs || []).filter((zzz) => zzz?.enabled).map((zzz) => <MartinZzzBoard
        key={zzz.index}
        zzz={zzz}
        actuals={state.actuals}
        roundHistory={state.round_history}
      />)}
      {isAdmin && state && <Nc2ReferenceSections
        state={state}
        zzzs={(state.martin_zzzs || []).filter((zzz) => zzz?.enabled)}
      />}

      <Dialog
        open={overallStopDialog.open}
        onClose={() => setOverallStopDialog((previous) => ({ ...previous, open: false }))}
      >
        <DialogTitle sx={{ fontWeight: "bold" }}>게임이 종료되었습니다.</DialogTitle>
        <DialogContent>
          <Typography>{overallStopDialog.detail}</Typography>
          <Typography sx={{ mt: 1, fontSize: "0.85rem", color: "text.secondary" }}>
            {overallStopDialog.modeLabel} 게임 · 픽 계산과 결과 기록은 계속됩니다.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            variant="contained"
            onClick={() => setOverallStopDialog((previous) => ({ ...previous, open: false }))}
          >확인</Button>
        </DialogActions>
      </Dialog>

      <AutoStartDialog open={autoOpen} onClose={() => setAutoOpen(false)} onStarted={(status) => {
        setAutoStatus({ ...status, running: status?.running ?? status?.status === "running" });
        setAutoStatusError(null);
        refreshGameSlots().catch(() => {});
      }} onError={(value) => setError(value.detail)} gameId={game?.game_id} pickhandId={user?.pickhand_id || user?.username} gameType="nc2" playMode="keep" />
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
          {replayError && <Typography variant="body2" sx={{ color: "#f44336", mt: 1 }}>{replayError}</Typography>}
          {replayPreview && (() => {
            const previewState = replayPreview.round_state || {};
            const previewGrid = buildShoePreviewGrid(String(previewState.actuals || ""));
            const previewCols = previewGrid[0]?.length || 1;
            return <Box sx={{ mt: 2 }}>
              <Typography variant="body2" sx={{ mb: 1 }}>
                {`게임 #${replayPreview.game_id} · ${replayPreview.status} · ${replayPreview.total_rounds}회차`}
              </Typography>
              <Box sx={{ overflowX: "auto", pb: 1 }}>
                <Box sx={{ display: "grid", gridTemplateColumns: `repeat(${previewCols}, 24px)`, gridTemplateRows: `repeat(${GRID_ROWS}, 24px)`, gridAutoFlow: "column", gap: "1px", width: "fit-content", backgroundColor: "#616161", border: "1px solid #616161" }}>
                  {Array.from({ length: previewCols }, (_, col) => Array.from({ length: GRID_ROWS }, (__, row) => {
                    const actual = previewGrid[row][col];
                    const color = actual === "P" ? "#1565c0" : "#f44336";
                    return <Box key={`${row}-${col}`} sx={{ width: 24, height: 24, backgroundColor: "background.default", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {actual && <Box sx={{ width: 20, height: 20, borderRadius: "50%", backgroundColor: color, color: "#fff", fontSize: 10, fontWeight: "bold", display: "flex", alignItems: "center", justifyContent: "center" }}>{actual}</Box>}
                    </Box>;
                  }))}
                </Box>
              </Box>
            </Box>;
          })()}
        </DialogContent>
        <DialogActions>
          <Button disabled={replayLoading} onClick={() => setReplayOpen(false)}>취소</Button>
          <Button variant="contained" disabled={replayLoading || !replayPreview} onClick={confirmReplay}>리플레이 시작</Button>
        </DialogActions>
      </Dialog>
      <Dialog open={newOpen} onClose={() => setNewOpen(false)}>
        <DialogTitle>NC2 새 게임</DialogTitle>
        <DialogContent><Typography>{sourceGameId ? `게임 #${sourceGameId}의 NC 조합을 그대로 사용합니다.` : keepCombination ? `현재 ${state?.items?.length || 128}개 NC 조합을 그대로 유지합니다.` : "설정한 개수의 NC를 새로 선정합니다."}</Typography></DialogContent>
        <DialogActions><Button onClick={() => setNewOpen(false)}>취소</Button><Button variant="contained" onClick={newGame} disabled={loading || slotBusy}>시작</Button></DialogActions>
      </Dialog>
      <Dialog open={endOpen} onClose={() => setEndOpen(false)}>
        <DialogTitle>게임 종료</DialogTitle>
        <DialogContent>
          <Typography>{selectedSlotNo}번 게임을 종료하고 빈 슬롯으로 만듭니다.</Typography>
          <Typography>게임 기록은 삭제하지 않고 보존합니다.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEndOpen(false)}>취소</Button>
          <Button variant="contained" color="error" onClick={closeSelectedSlot}>종료</Button>
        </DialogActions>
      </Dialog>
      <Dialog open={shoeCopyOpen} onClose={() => !shoeCopyLoading && setShoeCopyOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>기존 슈 불러오기</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", gap: 1, mt: .5, mb: 2, flexWrap: "wrap" }}>
            <TextField select size="small" label="원본 게임" value={shoeSourceType} onChange={(event) => { const sourceType = event.target.value; setShoeSourceType(sourceType); saveShoeCopySourceType(SHOE_COPY_SOURCE_STORAGE_KEYS.nc2, sourceType); setShoePreview(null); setShoeCopyError(""); }} sx={{ minWidth: 150 }}>
              <MenuItem value="nc2">트리플나인</MenuItem><MenuItem value="gh">글로벌히트</MenuItem>
            </TextField>
            <TextField autoFocus size="small" type="number" label="기존 게임번호" value={shoeSourceId} onChange={(event) => { setShoeSourceId(event.target.value); setShoePreview(null); setShoeCopyError(""); }} onKeyDown={(event) => { if (event.key !== "Enter") return; event.preventDefault(); const action = shoeCopyEnterAction({ preview: shoePreview, sourceType: shoeSourceType, sourceGameInput: shoeSourceId, busy: shoeCopyLoading }); if (action === "execute") executeShoeCopy(); else if (action === "lookup") loadShoePreview(); }} />
            <Button variant="outlined" disabled={shoeCopyLoading} onClick={loadShoePreview}>조회</Button>
          </Box>
          {shoeCopyError && <Alert severity="error" sx={{ mb: 1 }}>{shoeCopyError}</Alert>}
          {shoePreview && (() => {
            const previewGrid = buildShoePreviewGrid(shoePreview.actuals);
            const previewCols = previewGrid[0]?.length || 1;
            return <><Typography variant="body2" sx={{ mb: 1 }}>{`${shoePreview.source_game_label} #${shoePreview.source_game_id} · ${shoePreview.round_count}회차 · 전체 결과 ${shoePreview.result_count}개`}</Typography><Box sx={{ overflowX: "auto", pb: 1 }}><Box sx={{ display: "grid", gridTemplateColumns: `repeat(${previewCols}, 24px)`, gridTemplateRows: `repeat(${GRID_ROWS}, 24px)`, gridAutoFlow: "column", gap: "1px", width: "fit-content", backgroundColor: "#616161", border: "1px solid #616161" }}>{Array.from({ length: previewCols }, (_, col) => Array.from({ length: GRID_ROWS }, (__, row) => { const actual = previewGrid[row][col]; const color = actual === "P" ? "#1565c0" : actual === "B" ? "#f44336" : "#2e7d32"; return <Box key={`${row}-${col}`} sx={{ width: 24, height: 24, backgroundColor: "background.default", display: "flex", alignItems: "center", justifyContent: "center" }}>{actual && <Box sx={{ width: 20, height: 20, borderRadius: "50%", backgroundColor: color, color: "#fff", fontSize: 10, fontWeight: "bold", display: "flex", alignItems: "center", justifyContent: "center" }}>{actual}</Box>}</Box>; }))}</Box></Box></>;
          })()}
        </DialogContent>
        <DialogActions><Button onClick={() => setShoeCopyOpen(false)} disabled={shoeCopyLoading}>취소</Button><Button variant="contained" color="warning" onClick={executeShoeCopy} disabled={!shoePreview || shoeCopyLoading}>현재 게임에 이어서 입력</Button></DialogActions>
      </Dialog>
    </Box>
  );
}
