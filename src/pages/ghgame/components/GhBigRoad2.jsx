import { useState } from "react";
import { Box, Tooltip } from "@mui/material";

const HIT_BG = "#2e9e5b";
const MISS_BG = "#ffeb3b";
const REST_HIT_BG = "#555555";
const REST_MISS_BG = "#555555";
const CURRENT_BG = "#ffffff";
const FUTURE_BG = "#1c1f25";
const BORDER = "1px solid #3a3a3a";
const CELL_W = 23;
const CELL_H = 19;
const MAX_CELLS = 78;
const HIDE_QUARTER_KEYS = new Set(["D", "G", "TN", "ONE", "TWO", "P", "B"]);

const flip = (p) => (p === "P" ? "B" : p === "B" ? "P" : null);
const fmtValue = (v) => (v === "N/A" ? "-" : v);

const SECTION_DEFS = [
  { id: "A", label: "A멀티", kind: "normal", rows: [["A", "A"], ["AR", "AR"], ["AARO", "AARO"], ["AARN", "AAR"]] },
  { id: "S1", label: "S1멀티", kind: "normal", rows: [["S1", "track:s:sc1"], ["S1R", "track:sr:sc1"], ["SSRO1", "track:ssro:sc1"], ["SSRN1", "track:ssr:sc1"]] },
  { id: "S2", label: "S2멀티", kind: "normal", rows: [["S2", "track:s:sc2"], ["S2R", "track:sr:sc2"], ["SSRO2", "track:ssro:sc2"], ["SSRN2", "track:ssr:sc2"]] },
  { id: "S3", label: "S3멀티", kind: "normal", rows: [["S3", "track:s:sc3"], ["S3R", "track:sr:sc3"], ["SSRO3", "track:ssro:sc3"], ["SSRN3", "track:ssr:sc3"]] },
  { id: "FOR", label: "FOR", kind: "for", rows: [["FOR1", "track:for:sc1", 0], ["FOR2", "track:for:sc2", 1], ["FOR3", "track:for:sc3", 2]] },
  { id: "FORX", label: "FORX", kind: "for", rows: [["FOR1X", "track:sx:sc1", 0], ["FOR2X", "track:sx:sc2", 1], ["FOR3X", "track:sx:sc3", 2]] },
  { id: "DGT", label: "DGT", kind: "normal", rows: [["D", "D"], ["G", "G"], ["TN", "TN"], ["ONE", "ONE"], ["TWO", "TWO"]] },
  { id: "PBJ", label: "PBJ", kind: "normal", rows: [["P", "P"], ["B", "B"], ["J", "J"]] },
  { id: "G", label: "G시리즈", kind: "normal", rows: [["G(H1)", "G(H1)"], ["G(H0)", "G(H0)"], ["G(%1)", "G(%1)"], ["G(%0)", "G(%0)"]] },
  { id: "HB", label: "허니비멀티", kind: "subgame", xKey: "허니비", rows: [["허니비", "허니비"], ["허니R", "허니R"], ["허니SRO", "허니SRO"], ["허니SRN", "허니SRN"]] },
  { id: "WH", label: "위너히트멀티", kind: "subgame", xKey: "W111", rows: [["W111", "W111"], ["위너R", "위너R"], ["위너SRO", "위너SRO"], ["위너SRN", "위너SRN"]] },
  { id: "MH", label: "메가히트멀티", kind: "subgame", xKey: "M22", rows: [["M22", "M22"], ["메가R", "메가R"], ["메가SRO", "메가SRO"], ["메가SRN", "메가SRN"]] },
  { id: "DH", label: "드림히트멀티", kind: "subgame", xKey: "D112", rows: [["D112", "D112"], ["드림R", "드림R"], ["드림SRO", "드림SRO"], ["드림SRN", "드림SRN"]] },
  { id: "NC", label: "NC멀티", kind: "normal", rows: [["NC", "NC"], ["NCR", "NCR"], ["NCSRO", "NCSRO"], ["NCSRN", "NCSRN"]] },
  { id: "SQ", label: "SQ", kind: "normal", rows: [["SQ1", "track:quarter:sc1"], ["SQ2", "track:quarter:sc2"], ["SQ3", "track:quarter:sc3"]] },
];

const Q_TRACK_KEYS = {
  s: ["S1", "S2", "S3"],
  sr: ["SR1", "SR2", "SR3"],
  ssr: ["SSR1", "SSR2", "SSR3"],
  ssro: ["SSRO1", "SSRO2", "SSRO3"],
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

function cellsFromStateBigRoad2(rows, nextPick = null, nextStatus = null, actualSeq = "") {
  const cells = new Array(MAX_CELLS).fill(null);
  let activeSlotCount = 0;
  let firstQuarterIdx = null;
  for (let i = 0; i < Math.min(rows?.length || 0, MAX_CELLS); i++) {
    const r = rows[i] || {};
    const pick = r.pick || null;
    const result = r.result;
    const savedStatus = r.status;
    const hasSlot = pick || result;
    if (!hasSlot) continue;
    if (firstQuarterIdx == null) firstQuarterIdx = i;
    activeSlotCount += 1;
    const groupDivider = activeSlotCount % 3 === 0;
    if (result === "hit" || result === "miss") {
      cells[i] = { pick, status: result, savedStatus, round: i + 1, groupDivider };
    } else {
      cells[i] = { rest: true, pick, round: i + 1, groupDivider };
    }
  }
  const idx = (actualSeq?.length || 0);
  if (nextPick && idx >= 0 && idx < MAX_CELLS && !cells[idx]) {
    if (firstQuarterIdx == null) firstQuarterIdx = idx;
    activeSlotCount += 1;
    const groupDivider = activeSlotCount % 3 === 0;
    if (nextStatus === "rest") cells[idx] = { rest: true, pick: nextPick === "W" ? null : nextPick, status: "current", round: idx + 1, groupDivider };
    else if (nextPick === "W") cells[idx] = { wait: true, status: "current", round: idx + 1, groupDivider };
    else cells[idx] = { pick: nextPick, status: "current", round: idx + 1, groupDivider };
  }
  if (firstQuarterIdx != null) {
    for (let i = firstQuarterIdx; i < MAX_CELLS; i++) {
      const groupDivider = (i - firstQuarterIdx + 1) % 3 === 0;
      if (groupDivider) cells[i] = { ...(cells[i] || { round: i + 1 }), groupDivider };
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

function basisCells(rows) {
  const cells = new Array(MAX_CELLS).fill(null);
  for (const row of rows || []) {
    const idx = (row.round || 0) - 1;
    if (idx < 0 || idx >= MAX_CELLS) continue;
    cells[idx] = { basis: row };
  }
  return cells;
}

function stateKeyForSpec(spec) {
  if (!spec?.startsWith("track:")) return spec;
  const [, family, sc] = spec.split(":");
  if (family === "quarter") return `SQ${sc?.slice(-1) || ""}`;
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
  return cellsFromStateBigRoad2(stateRows || [], state?.pick, state?.status, ctx.actualSeq);
}

function getRoundStateQAssist(ctx, key) {
  return key ? ctx.roundState?.sections?.[key]?.assist_q || null : null;
}

function getRoundStateQAssistRows(ctx, key) {
  return getRoundStatePart(ctx, key, "q_assist");
}

function hasRenderableCells(cells) {
  return Array.isArray(cells) && cells.some((cell) => cell?.pick || cell?.wait || cell?.rest);
}

function getQuarterCells(ctx, spec, assist = false) {
  if (!spec || HIDE_QUARTER_KEYS.has(spec)) return null;
  if (!assist) return null;
  const stateKey = stateKeyForSpec(spec);
  const stateRows = getRoundStateQAssistRows(ctx, stateKey);
  const state = getRoundStateQAssist(ctx, stateKey);
  if (!stateRows) return null;
  return cellsFromStateBigRoad2(stateRows, state?.pick, state?.status, ctx.actualSeq);
}

function Cell({ cell, onClick }) {
  let bg;
  let content = cell?.round || "";
  let color = "#777";
  let insetBorder;
  const title = cell?.pick && cell?.round ? `${cell.round}회차` : undefined;
  if (cell?.basis) {
    content = "";
  } else if (cell?.rest) {
    content = fmtValue(cell.pick) || "";
    color = cell.pick === "P" ? "#8fb8f5" : cell.pick === "B" ? "#f2a0a0" : "#888";
    if (cell.savedStatus === "rest" && cell.status === "hit") {
      bg = REST_HIT_BG;
      insetBorder = `inset 0 0 0 3px ${HIT_BG}`;
      color = cell.pick === "P" ? "#9ec5ff" : cell.pick === "B" ? "#ff9b9b" : "#ddd";
    } else if (cell.savedStatus === "rest" && cell.status === "miss") {
      bg = REST_MISS_BG;
      insetBorder = `inset 0 0 0 3px ${MISS_BG}`;
      color = cell.pick === "P" ? "#9ec5ff" : cell.pick === "B" ? "#ff9b9b" : "#ddd";
    } else if (cell.status === "current") {
      color = cell.pick === "P" ? "#1565d8" : cell.pick === "B" ? "#e53935" : "#888";
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
    color = cell.pick === "P" ? "#1565d8" : cell.pick === "B" ? "#e53935" : "#777";
    if (cell.savedStatus === "rest" && cell.status === "hit") {
      bg = REST_HIT_BG;
      insetBorder = `inset 0 0 0 3px ${HIT_BG}`;
      color = cell.pick === "P" ? "#9ec5ff" : cell.pick === "B" ? "#ff9b9b" : "#ddd";
    } else if (cell.savedStatus === "rest" && cell.status === "miss") {
      bg = REST_MISS_BG;
      insetBorder = `inset 0 0 0 3px ${MISS_BG}`;
      color = cell.pick === "P" ? "#9ec5ff" : cell.pick === "B" ? "#ff9b9b" : "#ddd";
    }
    else if (cell.status === "hit") bg = HIT_BG;
    else if (cell.status === "miss") bg = MISS_BG;
    else if (cell.status === "current") bg = CURRENT_BG;
    else if (cell.status === "future") bg = FUTURE_BG;
  }
  const box = (
    <Box onClick={onClick} sx={{
      borderRight: cell?.groupDivider ? "2px solid #3f8cff" : BORDER,
      borderBottom: BORDER,
      boxSizing: "border-box",
      minWidth: CELL_W,
      width: CELL_W,
      height: CELL_H,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: bg,
      boxShadow: insetBorder,
      color,
      fontSize: 10.5,
      fontWeight: content === "P" || content === "B" ? "bold" : undefined,
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

function RoadRow({ label, cells, basis = false, onCellClick }) {
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
        color: basis ? "#ffeb3b" : "#cfe0ff",
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
        {pairCells.map((cell, i) => basis
          ? <BasisCell key={i} cell={cell} />
          : (
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

function Block({ title, children }) {
  return (
    <Box sx={{ mt: 0.5 }}>
      <Box sx={{ color: "#fff", fontSize: 12, fontWeight: "bold", mb: 0.5 }}>{title}</Box>
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
    .filter(([, cells]) => hasRenderableCells(cells));
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
            {hasRenderableCells(qAssistCells) && (
              <RoadRow label={`${label} 쿼터어시스트`} cells={qAssistCells} />
            )}
          </Box>
        );
      })}
    </>
  );
}

function SectionPanel({ section, ctx, selectedBasisMap, onSelectBasis }) {
  return (
    <Box sx={{ mt: 1.5, pb: 1, borderBottom: "1px solid #333" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.75 }}>
        <Box sx={titleSx}>{section.label}</Box>
        {section.id === "NC" && ctx.ncRefShoes && (
          <Box sx={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            border: "1px solid #777",
            borderRadius: "4px",
            backgroundColor: "#111",
            color: "#ffeb3b",
            fontWeight: "bold",
            fontSize: 12,
            px: 1,
            py: 0.35,
          }}>
            {ctx.ncRefShoes}
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
