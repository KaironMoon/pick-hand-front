import { useState } from "react";
import { Box, Tooltip } from "@mui/material";
import { bigRoadCurrentStatus, isBigRoadWaitRow } from "../bigroad2-wait.js";

const HIT_BG = "#2e9e5b";
const MISS_BG = "#ffeb3b";
const REST_HIT_BG = "#555555";
const REST_MISS_BG = "#555555";
const CURRENT_BG = "#ffffff";
const FUTURE_BG = "#1c1f25";
const BORDER = "1px solid #3a3a3a";
const GENERATED_PICK_BORDER = "#00ff66";
const MARTIN_C_COLOR = "#ff9800";
const CELL_W = 23;
const CELL_H = 19;
const MAX_CELLS = 78;
const HIDE_QUARTER_KEYS = new Set(["D", "G", "TN", "ONE", "TWO", "P", "B"]);
const pickTextColor = (pick, fallback = "#777") => (
  pick === "P" ? "#1565d8" : pick === "B" ? "#e53935" : pick === "W" ? "#222" : fallback
);
const restPickTextColor = (pick, fallback = "#888") => (
  pick === "P" ? "#8fb8f5" : pick === "B" ? "#f2a0a0" : pick === "W" ? "#f7f7f7" : fallback
);

const flip = (p) => (p === "P" ? "B" : p === "B" ? "P" : null);
const fmtValue = (v) => (v === "N/A" ? "-" : v);

const SECTION_DEFS = [
  { id: "A", label: "A멀티", kind: "normal", rows: [["A", "A"], ["AR", "AR"]] },
  { id: "S1", label: "S1멀티", kind: "normal", rows: [["S1", "track:s:sc1"], ["S1R", "track:sr:sc1"]] },
  { id: "S2", label: "S2멀티", kind: "normal", rows: [["S2", "track:s:sc2"], ["S2R", "track:sr:sc2"]] },
  { id: "S3", label: "S3멀티", kind: "normal", rows: [["S3", "track:s:sc3"], ["S3R", "track:sr:sc3"]] },
  { id: "FOR", label: "FOR", kind: "for", rows: [["FOR1", "track:for:sc1", 0], ["FOR2", "track:for:sc2", 1], ["FOR3", "track:for:sc3", 2]] },
  { id: "FORX", label: "FORX", kind: "for", rows: [["FOR1X", "track:sx:sc1", 0], ["FOR2X", "track:sx:sc2", 1], ["FOR3X", "track:sx:sc3", 2]] },
  { id: "DGT", label: "DGT", kind: "normal", rows: [["D", "D"], ["G", "G"], ["TN", "TN"], ["ONE", "ONE"], ["TWO", "TWO"]] },
  { id: "PBJ", label: "PBJ", kind: "normal", rows: [["P", "P"], ["B", "B"], ["J", "J"]] },
  { id: "6MX", label: "6MX", kind: "normal", rows: [["6M", "6M"], ["6MX", "6MX"]] },
  { id: "GH", label: "GH 시리즈", kind: "normal", rows: [["G(H1)", "G(H1)"], ["G(H2)", "G(H2)"]] },
  { id: "GP", label: "G% 시리즈", kind: "normal", rows: [["G(%1)", "G(%1)"], ["G(%2)", "G(%2)"]] },
  { id: "HB", label: "허니비멀티", kind: "subgame", xKey: "허니비", rows: [["허니비", "허니비"], ["허니R2", "허니R2"]] },
  { id: "WH", label: "위너히트멀티", kind: "subgame", xKey: "W111", rows: [["W111", "W111"], ["위너R2", "위너R2"]] },
  { id: "MH", label: "메가히트멀티", kind: "subgame", xKey: "M22", rows: [["M22", "M22"], ["메가R2", "메가R2"]] },
  { id: "DH", label: "드림히트멀티", kind: "subgame", xKey: "D112", rows: [["D112", "D112"], ["드림R2", "드림R2"]] },
  { id: "NC", label: "NC멀티", kind: "normal", rows: [["NC", "NC"], ["NCR", "NCR"]] },
];

const Q_TRACK_KEYS = {
  s: ["S1", "S2", "S3"],
  sr: ["SR1", "SR2", "SR3"],
  sx: ["FOR1X", "FOR2X", "FOR3X"],
  for: ["FOR1", "FOR2", "FOR3"],
};

const titleSx = {
  display: "inline-flex",
  alignItems: "center",
  minWidth: 70,
  justifyContent: "center",
  border: "2px solid #888",
  borderRadius: "6px",
  backgroundColor: "#2a2a2a",
  color: "#ddd",
  fontWeight: "bold",
  px: 1.5,
  py: 0.35,
  fontSize: 13,
};

function cellsFromStateBigRoad2(rows, nextPick = null, nextStatus = null, actualSeq = "", showGroupDivider = false) {
  const cells = new Array(MAX_CELLS).fill(null);
  let firstDividerIdx = null;
  const currentStatus = typeof nextStatus === "object" && nextStatus !== null ? nextStatus.status : nextStatus;
  const currentGeneratedPickMark = typeof nextStatus === "object" && nextStatus !== null
    ? (nextStatus.generatedPickMark || nextStatus.generated_pick_mark)
    : null;
  for (let i = 0; i < Math.min(rows?.length || 0, MAX_CELLS); i++) {
    const r = rows[i] || {};
    const pick = r.pick || null;
    const result = r.result;
    const savedStatus = r.status;
    const rowGeneratedPickMark = r.generatedPickMark || r.generated_pick_mark || null;
    const waitSlot = isBigRoadWaitRow(r);
    const hasSlot = pick || result || waitSlot;
    if (!hasSlot) continue;
    if (showGroupDivider && firstDividerIdx == null && (pick === "P" || pick === "B")) {
      firstDividerIdx = i;
    }
    if (waitSlot) {
      cells[i] = { wait: true, pick: "W", status: savedStatus, savedStatus, round: i + 1, generatedPickMark: rowGeneratedPickMark };
    } else if (result === "hit" || result === "miss") {
      cells[i] = { pick, status: result, savedStatus, round: i + 1, generatedPickMark: rowGeneratedPickMark };
    } else {
      cells[i] = { rest: true, pick, round: i + 1, generatedPickMark: rowGeneratedPickMark };
    }
  }
  const idx = (actualSeq?.length || 0);
  const hasCurrentPick = nextPick !== undefined && nextPick !== "";
  if (hasCurrentPick && idx >= 0 && idx < MAX_CELLS && !cells[idx]) {
    const currentPick = nextPick == null ? "W" : nextPick;
    if (showGroupDivider && firstDividerIdx == null && (currentPick === "P" || currentPick === "B")) {
      firstDividerIdx = idx;
    }
    const generatedPickMark = currentGeneratedPickMark || null;
    if (currentStatus === "rest") cells[idx] = { rest: true, pick: currentPick, status: "current", round: idx + 1, generatedPickMark };
    else if (currentStatus === "wait" || currentPick === "W") cells[idx] = { wait: true, status: "current", round: idx + 1, generatedPickMark };
    else cells[idx] = { pick: currentPick, status: "current", round: idx + 1, generatedPickMark };
  }
  if (showGroupDivider && firstDividerIdx != null) {
    for (let i = firstDividerIdx; i < MAX_CELLS; i++) {
      if ((i - firstDividerIdx + 1) % 3 === 0) {
        cells[i] = { ...(cells[i] || { round: i + 1 }), groupDivider: true };
      }
    }
  }
  return cells;
}

function sourceCells(actualSeq, offset, reverse = false) {
  const cells = new Array(MAX_CELLS).fill(null);
  for (let i = 0; i < MAX_CELLS; i++) {
    const srcIdx = offset + i;
    const actual = actualSeq?.[srcIdx];
    if (!actual) continue;
    cells[i] = { pick: reverse ? flip(actual) : actual, status: "source", round: srcIdx + 1 };
  }
  return cells;
}

function stateKeyForSpec(spec) {
  if (!spec?.startsWith("track:")) return spec;
  const [, family, sc] = spec.split(":");
  const idx = Number(String(sc || "").replace("sc", "")) - 1;
  return Q_TRACK_KEYS[family]?.[idx] || null;
}

function getRoundStatePart(ctx, key, part) {
  const rows = key ? ctx.roundState?.sections?.[key]?.bigroad2?.[part] : null;
  return Array.isArray(rows) && rows.length ? rows : null;
}

function getRoundStateTrack(ctx, key, assist = false) {
  const section = key ? ctx.roundState?.sections?.[key] : null;
  if (!section) return null;
  return assist ? section.assist_h : section.base;
}

function getRowCells(ctx, spec, assist = false) {
  const stateKey = stateKeyForSpec(spec);
  const stateRows = getRoundStatePart(ctx, stateKey, assist ? "h_assist" : "picks");
  const state = getRoundStateTrack(ctx, stateKey, assist);
  return cellsFromStateBigRoad2(stateRows || [], state?.pick, { status: bigRoadCurrentStatus(state), generatedPickMark: state?.generated_pick_mark }, ctx.actualSeq);
}

function getRoundStateQAssist(ctx, key) {
  return key ? ctx.roundState?.sections?.[key]?.assist_q || null : null;
}

function getRoundStateQAssistRows(ctx, key) {
  return getRoundStatePart(ctx, key, "q_assist");
}

function getQuarterCells(ctx, spec, assist = false) {
  if (!spec || HIDE_QUARTER_KEYS.has(spec)) return null;
  if (!assist) return null;
  const stateKey = stateKeyForSpec(spec);
  const stateRows = getRoundStateQAssistRows(ctx, stateKey);
  const state = getRoundStateQAssist(ctx, stateKey);
  if (!stateRows && state?.pick === undefined && state?.status === undefined) return null;
  return cellsFromStateBigRoad2(
    stateRows || [],
    state?.pick,
    { status: bigRoadCurrentStatus(state), generatedPickMark: state?.generated_pick_mark },
    ctx.actualSeq,
    true,
  );
}

function getMartinCCells(ctx, spec, part) {
  const stateKey = stateKeyForSpec(spec);
  if (!stateKey || (part === "assist_q" && HIDE_QUARTER_KEYS.has(stateKey))) return null;
  const track = ctx.roundState?.conditional_martins?.martin_c?.tracks?.[`${stateKey}:${part}`];
  if (!track) return null;
  const cells = new Array(MAX_CELLS).fill(null);
  (track.history || []).forEach((entry) => {
    const idx = Number(entry?.round || 0) - 1;
    if (idx < 0 || idx >= MAX_CELLS) return;
    cells[idx] = {
      pick: entry.direction,
      status: entry.status,
      round: idx + 1,
      martinCStep: entry.step,
      martinCAmount: entry.amount,
    };
  });
  const currentIdx = ctx.actualSeq?.length || 0;
  if (track.direction && currentIdx < MAX_CELLS && !cells[currentIdx]) {
    cells[currentIdx] = {
      pick: track.direction,
      status: "current",
      round: currentIdx + 1,
      martinCStep: track.step,
      martinCAmount: track.amount,
    };
  }
  return cells;
}

function Cell({ cell, onClick }) {
  let bg;
  let content = cell?.round || "";
  let color = "#777";
  let insetBorder;
  const title = cell?.pick && cell?.round
    ? `${cell.round}회차${cell.martinCStep ? ` · C ${cell.martinCStep}S · ${Number(cell.martinCAmount || 0).toLocaleString()}P` : ""}`
    : undefined;
  const generatedPickMark = cell?.generatedPickMark || cell?.generated_pick_mark;
  if (cell?.basis) {
    content = "";
  } else if (cell?.rest) {
    const restPick = cell.pick == null || cell.pick === "" ? "W" : cell.pick;
    content = fmtValue(restPick) || "";
    color = restPickTextColor(restPick);
    if (cell.savedStatus === "rest" && cell.status === "hit") {
      bg = REST_HIT_BG;
      insetBorder = `inset 0 0 0 3px ${HIT_BG}`;
      color = restPick === "P" ? "#9ec5ff" : restPick === "B" ? "#ff9b9b" : restPick === "W" ? "#fff" : "#ddd";
    } else if (cell.savedStatus === "rest" && cell.status === "miss") {
      bg = REST_MISS_BG;
      insetBorder = `inset 0 0 0 3px ${MISS_BG}`;
      color = restPick === "P" ? "#9ec5ff" : restPick === "B" ? "#ff9b9b" : restPick === "W" ? "#fff" : "#ddd";
    } else if (cell.status === "current") {
      color = pickTextColor(restPick, "#888");
      bg = CURRENT_BG;
    }
  } else if (cell?.wait) {
    content = "W";
    color = "#555";
    if (cell.status === "current") {
      color = "#333";
      bg = CURRENT_BG;
    }
  } else if (cell?.pick) {
    content = fmtValue(cell.pick);
    color = pickTextColor(cell.pick);
    if (cell.savedStatus === "rest" && cell.status === "hit") {
      bg = REST_HIT_BG;
      insetBorder = `inset 0 0 0 3px ${HIT_BG}`;
      color = cell.pick === "P" ? "#9ec5ff" : cell.pick === "B" ? "#ff9b9b" : cell.pick === "W" ? "#fff" : "#ddd";
    } else if (cell.savedStatus === "rest" && cell.status === "miss") {
      bg = REST_MISS_BG;
      insetBorder = `inset 0 0 0 3px ${MISS_BG}`;
      color = cell.pick === "P" ? "#9ec5ff" : cell.pick === "B" ? "#ff9b9b" : cell.pick === "W" ? "#fff" : "#ddd";
    }
    else if (cell.status === "hit") bg = HIT_BG;
    else if (cell.status === "miss") bg = MISS_BG;
    else if (cell.status === "current") bg = CURRENT_BG;
    else if (cell.status === "future") bg = FUTURE_BG;
  }
  if ((content == null || content === "") && (cell?.pick === "W" || cell?.status === "wait" || cell?.savedStatus === "wait")) {
    content = "W";
    color = bg === CURRENT_BG ? "#333" : "#f7f7f7";
  }
  const glowBorder = generatedPickMark ? `0 0 8px ${GENERATED_PICK_BORDER}` : null;
  const boxShadow = [insetBorder, glowBorder].filter(Boolean).join(", ") || undefined;
  const box = (
    <Box onClick={onClick} sx={{
      borderRight: cell?.groupDivider ? "2px solid #3f8cff" : BORDER,
      borderBottom: BORDER,
      boxSizing: "border-box",
      position: "relative",
      zIndex: generatedPickMark ? 2 : 1,
      minWidth: CELL_W,
      width: CELL_W,
      height: CELL_H,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: bg,
      boxShadow,
      outline: generatedPickMark ? `2px solid ${GENERATED_PICK_BORDER}` : undefined,
      outlineOffset: "-2px",
      ...(generatedPickMark === "signal" ? {
        animation: "ghBigRoadSignalBorder 0.9s steps(2, end) infinite",
        "@keyframes ghBigRoadSignalBorder": {
          "0%, 100%": { outlineColor: GENERATED_PICK_BORDER, boxShadow: [insetBorder, `0 0 10px ${GENERATED_PICK_BORDER}`].filter(Boolean).join(", ") },
          "50%": { outlineColor: "#ffffff", boxShadow: [insetBorder, "0 0 3px #ffffff"].filter(Boolean).join(", ") },
        },
      } : {}),
      color,
      fontSize: 10.5,
      fontWeight: content === "P" || content === "B" || content === "W" ? "bold" : undefined,
      cursor: onClick ? "pointer" : "default",
    }}>{content}</Box>
  );
  if (!title) return box;
  return (
    <Tooltip
      title={title}
      arrow
      placement="top"
      disableInteractive
      enterDelay={0}
      enterNextDelay={0}
      leaveDelay={0}
      TransitionProps={{ timeout: 0 }}
    >
      {box}
    </Tooltip>
  );
}

function BasisPanel({ basis }) {
  if (!basis?.prev_picks) {
    return <Box sx={{
      width: 280,
      height: 28,
      border: "1px solid #222",
      backgroundColor: "#060606",
    }} />;
  }
  const picks = String(basis.prev_picks).slice(-11).split("");
  return (
    <Box sx={{
      width: "fit-content",
      height: 28,
      display: "flex",
      alignItems: "center",
      gap: "4px",
      px: 0.25,
      backgroundColor: "#060606",
      overflow: "hidden",
    }}>
      {picks.map((p, i) => <PickChip key={`${p}-${i}`} v={p} />)}
      <BasisMeta>{basis.pick_no || ""}</BasisMeta>
      <BasisMeta color="#ffeb3b">{basis.nickname || ""}</BasisMeta>
      <PickChip v={basis.pick} boxed />
    </Box>
  );
}

function BasisMeta({ children, color = "#ddd" }) {
  return (
    <Box sx={{
      minWidth: 32,
      height: 20,
      border: "1px solid #333",
      borderRadius: "3px",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      color,
      backgroundColor: "#111",
      fontSize: 10,
      fontWeight: "bold",
      px: 0.5,
    }}>{children}</Box>
  );
}

function PickChip({ v, boxed = false }) {
  if (v !== "P" && v !== "B") return null;
  return (
    <Box component="span" sx={{
      width: 17,
      height: 17,
      borderRadius: "50%",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#fff",
      fontSize: 10,
      fontWeight: "bold",
      backgroundColor: v === "P" ? "#1565d8" : "#e53935",
      flex: "none",
      ...(boxed ? { border: "1px solid #333" } : {}),
    }}>{v}</Box>
  );
}

function RoadRow({ label, cells, basis = false, onCellClick, labelColor }) {
  if (basis) {
    const currentBasis = [...(cells || [])].reverse().find((cell) => cell?.basis?.prev_picks)?.basis;
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: "4px", mb: "3px", minHeight: 28 }}>
        <Box sx={{
          width: 96,
          flex: "none",
          border: "1px solid #666",
          borderRadius: "4px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#ffeb3b",
          fontSize: 11,
          fontWeight: "bold",
          height: 24,
        }}>{label}</Box>
        <BasisPanel basis={currentBasis} />
      </Box>
    );
  }
  const pairCells = [];
  for (let c = 0; c < 39; c++) {
    pairCells.push(cells[c] || { round: c + 1 }, cells[c + 39] || { round: c + 40 });
  }
  return (
    <Box sx={{ display: "flex", alignItems: "stretch", gap: "4px", mb: "3px" }}>
      <Box sx={{
        width: 96,
        flex: "none",
        border: "1px solid #666",
        borderRadius: "4px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: labelColor || (basis ? "#ffeb3b" : "#cfe0ff"),
        fontSize: 11,
        fontWeight: "bold",
      }}>{label}</Box>
      <Box sx={{
        display: "grid",
        gridTemplateRows: "1fr 1fr",
        gridAutoFlow: "column",
        gridAutoColumns: basis ? "280px" : `${CELL_W}px`,
        borderTop: BORDER,
        borderLeft: BORDER,
        overflowX: "auto",
        maxWidth: "calc(100vw - 140px)",
      }}>
        {pairCells.map((cell, i) => (
          <Cell
            key={i}
            cell={cell}
            onClick={onCellClick && cell?.round ? () => onCellClick(cell.round) : undefined}
          />
        ))}
      </Box>
    </Box>
  );
}

function Block({ title, children, color = "#fff" }) {
  return (
    <Box sx={{ mt: 0.5 }}>
      <Box sx={{ color, fontSize: 12, fontWeight: "bold", mb: 0.5 }}>{title}</Box>
      {children}
    </Box>
  );
}

function NormalSection({ section, ctx, selectedBasis, onSelectBasis }) {
  const isSub = section.kind === "subgame";
  const latestBasis = isSub
    ? [...(ctx.subgameBasis?.[section.xKey] || [])].reverse().find((row) => row?.prev_picks)
    : null;
  const basisForDisplay = selectedBasis || latestBasis || null;
  const qAssistRows = section.rows
    .map(([label, key]) => [label, getQuarterCells(ctx, key, true)])
    .filter(([, cells]) => Array.isArray(cells));
  return (
    <>
      <Block title="original">
        {section.rows.map(([label, key], idx) => (
          <Box key={`o-${label}`}>
            <RoadRow
              label={label}
              cells={getRowCells(ctx, key, false)}
              onCellClick={isSub && idx === 0 ? (round) => onSelectBasis(section.xKey, round) : undefined}
            />
            {isSub && idx === 0 && (
              <RoadRow label="근거" basis cells={[{ basis: basisForDisplay }]} />
            )}
          </Box>
        ))}
      </Block>
      <Block title="회차어시스트">
        {section.rows.map(([label, key]) => (
          <RoadRow key={`a-${label}`} label={label} cells={getRowCells(ctx, key, true)} />
        ))}
      </Block>
      {qAssistRows.length > 0 && (
        <Block title="쿼터어시스트">
          {qAssistRows.map(([label, cells]) => (
            <RoadRow key={`qa-${label}`} label={label} cells={cells} />
          ))}
        </Block>
      )}
      <Block title="마틴C" color={MARTIN_C_COLOR}>
        {section.rows.map(([label, key]) => {
          const hCells = getMartinCCells(ctx, key, "assist_h");
          const qCells = getMartinCCells(ctx, key, "assist_q");
          return (
            <Box key={`mc-${label}`}>
              {Array.isArray(hCells) && <RoadRow label={`${label}-H C`} cells={hCells} labelColor={MARTIN_C_COLOR} />}
              {Array.isArray(qCells) && <RoadRow label={`${label}-Q C`} cells={qCells} labelColor={MARTIN_C_COLOR} />}
            </Box>
          );
        })}
      </Block>
    </>
  );
}

function ForSection({ section, ctx }) {
  return (
    <>
      {section.rows.map(([label, key, offset]) => {
        const qAssistCells = getQuarterCells(ctx, key, true);
        return (
          <Box key={label} sx={{ mb: 1 }}>
            <RoadRow label={`${label} source`} cells={sourceCells(ctx.actualSeq, offset, false)} />
            <RoadRow label={`${label} original`} cells={getRowCells(ctx, key, false)} />
            <RoadRow label={`${label} 회차어시스트`} cells={getRowCells(ctx, key, true)} />
            {Array.isArray(qAssistCells) && (
              <RoadRow label={`${label} 쿼터어시스트`} cells={qAssistCells} />
            )}
            {Array.isArray(getMartinCCells(ctx, key, "assist_h")) && (
              <RoadRow label={`${label}-H C`} cells={getMartinCCells(ctx, key, "assist_h")} labelColor={MARTIN_C_COLOR} />
            )}
            {Array.isArray(getMartinCCells(ctx, key, "assist_q")) && (
              <RoadRow label={`${label}-Q C`} cells={getMartinCCells(ctx, key, "assist_q")} labelColor={MARTIN_C_COLOR} />
            )}
          </Box>
        );
      })}
    </>
  );
}

function SectionPanel({ section, ctx, selectedBasisMap, onSelectBasis }) {
  const nc = ctx.ncRefControls || {};
  return (
    <Box sx={{ mt: 1.5, pb: 1, borderBottom: "1px solid #333" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.75 }}>
        <Box sx={titleSx}>{section.label}</Box>
        {section.id === "NC" && ctx.ncRefShoes && (
          <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
            <Box
              component="input"
              aria-label="현재 게임 NC 번호"
              title="현재 게임 NC 번호"
              value={nc.value ?? ""}
              disabled={nc.busy}
              readOnly={nc.readOnly}
              onChange={(e) => nc.onChange?.(e.target.value)}
              sx={{
                width: 72,
                border: "1px solid #777",
                borderRadius: "4px",
                backgroundColor: "#111",
                color: "#ffeb3b",
                fontWeight: "bold",
                fontSize: 12,
                px: 1,
                py: 0.35,
              }}
            />
            <Box
              component="input"
              aria-label="셋업 NC 번호"
              title="셋업 NC 번호"
              value={nc.setupValue ?? "랜덤"}
              readOnly
              sx={{
                width: 72,
                border: "1px solid #777",
                borderRadius: "4px",
                backgroundColor: "#111",
                color: "#81d4fa",
                fontWeight: "bold",
                fontSize: 12,
                px: 1,
                py: 0.35,
              }}
            />
            <Box component="button" type="button" disabled={nc.readOnly || nc.busy || nc.dirty} onClick={nc.onToggleLock} style={{
              border: nc.locked ? "1px solid #00e676" : "1px solid #777",
              borderRadius: 4,
              background: nc.locked ? "#14351f" : "#111",
              color: nc.locked ? "#00e676" : "#ddd",
              fontSize: 12,
              padding: "3px 7px",
              cursor: nc.readOnly || nc.busy || nc.dirty ? "default" : "pointer",
              opacity: nc.readOnly || nc.busy || nc.dirty ? 0.45 : 1,
            }}>고정</Box>
            <Box component="button" type="button" disabled={nc.readOnly || nc.busy || !nc.dirty} onClick={nc.onConfirm} style={{
              border: "1px solid #4caf50",
              borderRadius: 4,
              background: "#102416",
              color: "#9be7a7",
              fontSize: 12,
              padding: "3px 7px",
              cursor: nc.readOnly || nc.busy || !nc.dirty ? "default" : "pointer",
              opacity: nc.readOnly || nc.busy || !nc.dirty ? 0.45 : 1,
            }}>확인</Box>
            <Box component="button" type="button" disabled={nc.readOnly || nc.busy || !nc.dirty} onClick={nc.onCancel} style={{
              border: "1px solid #777",
              borderRadius: 4,
              background: "#111",
              color: "#ddd",
              fontSize: 12,
              padding: "3px 7px",
              cursor: nc.readOnly || nc.busy || !nc.dirty ? "default" : "pointer",
              opacity: nc.readOnly || nc.busy || !nc.dirty ? 0.45 : 1,
            }}>취소</Box>
          </Box>
        )}
      </Box>
      {section.kind === "for"
        ? <ForSection section={section} ctx={ctx} />
        : <NormalSection
            section={section}
            ctx={ctx}
            selectedBasis={selectedBasisMap[section.xKey]}
            onSelectBasis={onSelectBasis}
          />}
    </Box>
  );
}

export default function GhBigRoad2({
  roundState,
  subgameBasis,
  ncRefShoes,
  ncRefShoeNo,
  ncRefControls,
  actualSeq,
}) {
  const [selected, setSelected] = useState({});
  const [selectedBasisMap, setSelectedBasisMap] = useState({});
  const toggle = (id) => setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  const selectBasis = (xKey, round) => {
    const rows = subgameBasis?.[xKey] || [];
    const basis = rows.find((row) => row.round === round);
    setSelectedBasisMap((prev) => ({ ...prev, [xKey]: basis || null }));
  };
  const active = SECTION_DEFS.filter((s) => selected[s.id]);
  const ctx = {
    roundState,
    subgameBasis,
    ncRefShoes: ncRefShoeNo || ncRefShoes,
    ncRefControls,
    actualSeq: actualSeq || "",
  };
  return (
    <Box sx={{ mb: 2, backgroundColor: "#000", p: 1, overflowX: "auto" }}>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mb: 1 }}>
        {SECTION_DEFS.map((s) => (
          <Box
            key={s.id}
            component="button"
            type="button"
            onClick={() => toggle(s.id)}
            style={{
              border: selected[s.id] ? "1px solid #00e676" : "1px solid #555",
              borderRadius: 4,
              background: selected[s.id] ? "#14351f" : "#1b1b1b",
              color: selected[s.id] ? "#fff" : "#bbb",
              padding: "4px 9px",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            {s.label}
          </Box>
        ))}
      </Box>
      {active.length === 0
        ? <Box sx={{ color: "#777", fontSize: 12, py: 1 }}>표시할 섹션을 선택하세요.</Box>
        : active.map((section) => (
          <SectionPanel
            key={section.id}
            section={section}
            ctx={ctx}
            selectedBasisMap={selectedBasisMap}
            onSelectBasis={selectBasis}
          />
        ))}
    </Box>
  );
}
