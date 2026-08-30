import { useEffect, useRef, useState } from "react";
import { Box } from "@mui/material";

import {
  isHighStepOverlapWait,
  isMaxMissAtLeast,
  isMissStreakAtLeast,
} from "./strategy-board-alerts.js";

// ── 전략별 현황 전광판 (design-260615-gh-calc.html 260623 신버전 포팅) ──
// 제거된 전략은 빈칸 없이 제외하고 남은 전략만 테이블에 배치한다.
// 행: wait(대기 H녹/M노랑) / pick(P·B 칩) / pct(적중률%) / rec(전적) / rec2(보조)
//     / pick2(보조픽) / pct2(적중률2) / assistRec(어시 총전적) / stage(단계) / idx1(배팅액) / idx2(PnL)
// R쌍 분리(병합 없음). 각 전략 세트 뒤 OLD/NEW 컬럼.
//   NEW = 합성본(A세트→AAR, S세트→SSR#, 서브게임 R2세트→실데이터). OLD = 위치만(빈칸, 추후 연결).
// 실데이터: A/AR/D/G/TN/ONE/TWO/P/B/J/6M/6MX(stats) + S/SR/FOR/FORX 트랙.

const HC_BLUE = "#2f9bff";
const HC_RED = "#ff5b5b";

const COLOR = {
  A: "#0066fe", AR: "#c0504d",
  S1: "#0063d6", S2: "#0063d6", S3: "#0063d6",
  S1R: "#c0504d", S2R: "#c0504d", S3R: "#c0504d",
  SX: "#0063d6", D: "#c0504d", G: "#0063d6",
  허니비: "#c0504d", pattern: "#00a11a", "6M": "#b96a12", "6MX": "#de6a08",
};
const colorOf = (n) => COLOR[n] || (n.endsWith("R") ? "#c0504d" : "#0063d6");
// 헤더 색: 그룹 범위(headColors) 우선, 없으면 colorOf 폴백.
function headColorOf(data, i, n) {
  for (const [a, b, c] of (data.headColors || [])) {
    if (i >= a && i <= b) return c;
  }
  return colorOf(n);
}

const HL = "#ffd54f";
const GSEP = "2px solid #9a9a9a";
const BASE = "1px solid #555";
const GOB_TOP_BG = "rgba(0, 200, 83, 0.55)";
const GOB_LOW_BG = "rgba(255, 213, 79, 0.62)";
const GOB_RANK_BG = {
  1: "rgba(229, 57, 53, 0.72)",
  2: "rgba(21, 101, 216, 0.72)",
  3: "rgba(251, 140, 0, 0.72)",
  4: "rgba(46, 125, 50, 0.72)",
};
const AMOUNT_ZONE_COLORS = { blue: "#2f9bff", white: "#fff", red: "#ff5b5b" };
const GENERATED_PICK_BG = "#ffeb3b";
const MISS_STREAK_BLINK_MIN = 7;
const MAX_MISS_BLINK_MIN = 9;
const MAX_BLINK_DURATION_MS = 5000;
const alertBlinkSx = {
  animation: "ghStrategyAlertBlink 0.8s steps(2, end) infinite",
  "@keyframes ghStrategyAlertBlink": {
    "0%, 100%": { backgroundColor: "#ffeb3b", color: "#111" },
    "50%": { backgroundColor: "#111", color: "#ffeb3b" },
  },
};

// 셀의 노란 박스/그룹선 테두리 계산 (디자인 edgeCls 포팅, span=1 고정 — 병합 없음)
function edgeStyle(data, i, pos) {
  const st = {};
  if (data.gstart && data.gstart.has(i)) st.borderLeft = GSEP;
  (data.hlRanges || []).forEach(([a, b]) => {
    if (i >= a && i <= b) {
      if (i === a) st.borderLeft = `3px solid ${HL}`;
      if (i === b) st.borderRight = `3px solid ${HL}`;
      if (pos === "head") st.borderTop = `3px solid ${HL}`;
      if (pos === "last") st.borderBottom = `3px solid ${HL}`;
    }
  });
  return st;
}

// ── 테이블 정의 (전략명 + 그룹선/노란박스/헤더색). 값은 실데이터로 채움. ──
// G1: A/AR + S/SR + FOR/FORX 세트.
const G1n = ["A", "AR", "S1", "S1R", "S2", "S2R", "S3", "S3R", "FOR1", "FOR2", "FOR3", "FOR1X", "FOR2X", "FOR3X"];
const G1 = {
  name: G1n,
  tableWidth: 900,
  gstart: new Set([2, 4, 6, 8, 11]),
  hlRanges: [[0, 1], [2, 3], [4, 5], [6, 7], [8, 10], [11, 13]],
  headColors: [[0, 1, HC_BLUE], [2, 3, HC_RED], [4, 5, HC_BLUE], [6, 7, HC_RED], [8, 10, HC_BLUE], [11, 13, HC_RED]],
};
// G2: D/G/TN/ONE/TWO + P/B/J + 6M/6MX + GH/G%.
const G2n = ["D", "G", "TN", "ONE", "TWO", "P", "B", "J", "6M", "6MX", "G(H1)", "G(H2)", "G(%1)", "G(%2)"];
const G2 = {
  name: G2n,
  tableWidth: 840,
  gstart: new Set([5, 8, 10, 12]),
  hlRanges: [[0, 4], [5, 7], [8, 9], [10, 11], [12, 13]],
  headColors: [[0, 4, HC_BLUE], [5, 7, HC_RED], [8, 9, "#de6a08"], [10, 11, HC_BLUE], [12, 13, HC_RED]],
};
// G3: 서브게임 정픽/반대픽.
const G3n = ["허니비", "허니R2", "W111", "위너R2", "M22", "메가R2", "D112", "드림R2", "NC", "NCR"];
const G3 = {
  name: G3n,
  tableWidth: 660,
  gstart: new Set([2, 4, 6, 8]),
  hlRanges: [[0, 1], [2, 3], [4, 5], [6, 7], [8, 9]],
  headColors: [[0, 1, HC_BLUE], [2, 3, HC_RED], [4, 5, HC_BLUE], [6, 7, HC_RED], [8, 9, HC_BLUE]],
};

// ── 셀 렌더 헬퍼 ──
const recHTML = (v) => {
  const m = v.match(/^(\d+)-(\d+)(\/\d+)$/);
  return m ? (<><span>{m[1]}-</span><b style={{ color: "#66bb6a" }}>{m[2]}</b><span>{m[3]}</span></>) : v;
};
const rec2HTML = (v) => {
  const p = v.split("-");
  return p.length === 2 ? (<><span style={{ color: "#66bb6a" }}>{p[0]}</span>-<span style={{ color: "#ffee58" }}>{p[1]}</span></>) : v;
};
const waitCell = (v) => {
  const color = v.includes("H") ? "#66bb6a" : v.includes("M") ? "#ffee58" : undefined;
  return <span style={{ color, fontWeight: color ? "bold" : undefined }}>{v}</span>;
};

const tdSx = { border: BASE, padding: "2px 3px", textAlign: "center", fontSize: 12, whiteSpace: "nowrap", height: 24 };
const thSx = { ...tdSx, fontWeight: "bold", fontSize: 12.5, borderBottom: "2px solid #6a6a6a" };
const dimColor = "#444";

function Chip({ v }) {
  return (
    <Box component="span" sx={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      width: 21, height: 21, borderRadius: "50%", fontWeight: "bold", fontSize: 12, color: "#fff",
      backgroundColor: v === "P" ? "#1565d8" : "#e53935",
    }}>{v}</Box>
  );
}

function PickText({ v }) {
  return v === "P" || v === "B" ? <Chip v={v} /> : <span style={{ color: "#fff", fontWeight: "bold" }}>{v}</span>;
}

function SourceDots({ marks }) {
  if (!Array.isArray(marks) || marks.length === 0) return null;
  return (
    <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: "2px" }}>
      {marks.map((m) => (
        <Box
          component="span"
          key={m.key}
          title={m.label}
          sx={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: "#00e676", display: "inline-block" }}
        />
      ))}
    </Box>
  );
}

function withSourceDots(value, marks) {
  return (
    <Box component="span" sx={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "3px" }}>
      {value}
      <SourceDots marks={marks} />
    </Box>
  );
}

function AssistText({ v }) {
  const col = v === "P" || v === "P(W)" ? "#1565d8" : v === "B" || v === "B(W)" ? "#e53935" : "#fff";
  return <span style={{ color: col, fontWeight: "bold" }}>{v}</span>;
}

const generatedPickSx = (mark) => mark === "signal"
  ? {
      backgroundColor: GENERATED_PICK_BG,
      color: "#111",
      animation: "ghGeneratedSignalBg 0.9s steps(2, end) infinite",
      "@keyframes ghGeneratedSignalBg": {
        "0%, 100%": { backgroundColor: GENERATED_PICK_BG, boxShadow: "inset 0 0 0 2px #fff" },
        "50%": { backgroundColor: "#111", boxShadow: "inset 0 0 0 2px #ccff00" },
      },
    }
  : mark === "reverse"
    ? { backgroundColor: GENERATED_PICK_BG }
    : {};

// 단순(병합 없음) 행. 빈값은 회색 대시(–). label 있으면 맨 앞 라벨 셀.
function SimpleRow({
  data,
  dataKey,
  render,
  pos,
  label,
  labelColor,
  markKey,
  labelOnClick,
  labelTitle,
  shouldBlink,
}) {
  const bgKey = `${dataKey}Bg`;
  return (
    <tr>
      {label != null && (
        <LblCell
          text={label}
          color={labelColor}
          edge={pos === "last" ? "last" : undefined}
          onClick={labelOnClick}
          title={labelTitle}
        />
      )}
      {data.name.map((n, i) => {
        const v = (data[dataKey] || [])[i] || "";
        const bg = (data[bgKey] || [])[i];
        const pickMark = dataKey === "pick" ? (data.pickMark || [])[i] : null;
        const marks = markKey ? (data[markKey] || [])[i] : null;
        const pickMarkSx = generatedPickSx(pickMark);
        const blink = shouldBlink?.(v, i, data) || false;
        const sx = {
          ...tdSx,
          ...(bg ? { backgroundColor: bg } : {}),
          ...pickMarkSx,
          ...(blink ? alertBlinkSx : {}),
          ...edgeStyle(data, i, pos),
        };
        return v
          ? <Box component="td" key={i} sx={sx}>{withSourceDots(render(v, i, data), marks)}</Box>
          : <Box component="td" key={i} sx={{ ...sx, color: dimColor }}>–</Box>;
      })}
    </tr>
  );
}

// 어시스트 행 (rec2 다음, 시안 pick2 행): P/B 색 글자 + 값 있는 칸만 #16365c 배경. 빈칸은 dim(–).
// 어시스트 픽은 (임시) 원래 픽(pick)과 동일. 실제 어시스트 로직은 추후 처리.
const ASSIST_BG = "#16365c";
const Q_ASSIST_BG = "#60497b";
const assistSourceTitle = (source) => {
  if (!source) return undefined;
  const text = String(source);
  const prefix = "쿼터휴식:";
  const body = text.startsWith(prefix) ? text.slice(prefix.length) : text;
  const displayBody = body
    .replace(/^BF6X(?=:|$)/, "육전X")
    .replace(/^BF6(?=:|$)/, "육전");
  const formatted = displayBody.includes(":") ? displayBody.replace(":", "|") : displayBody;
  return text.startsWith(prefix) ? `${prefix}${formatted}` : formatted;
};
function AssistRow({ data, pos, label, labelColor }) {
  return (
    <tr>
      {label != null && <LblCell text={label} color={labelColor} edge={pos === "last" ? "last" : undefined} />}
      {data.name.map((n, i) => {
        const sx = { ...tdSx, ...edgeStyle(data, i, pos) };
        const v = (data.assist || [])[i] || "";
        const pickMark = (data.assistMark || [])[i];
        const source = (data.assistSource || [])[i];
        const title = assistSourceTitle(source);
        const highStepWait = isHighStepOverlapWait(v, source);
        if (!v) return <Box component="td" key={i} title={title} sx={{ ...sx, color: dimColor }}>–</Box>;
        return (
          <Box component="td" key={i} title={title} sx={{ ...sx, backgroundColor: ASSIST_BG, ...generatedPickSx(pickMark), ...(highStepWait ? alertBlinkSx : {}) }}>
            <AssistText v={v} />
          </Box>
        );
      })}
    </tr>
  );
}

function QAssistRow({ data, pos, label, labelColor }) {
  return (
    <tr>
      {label != null && <LblCell text={label} color={labelColor} edge={pos === "last" ? "last" : undefined} />}
      {data.name.map((n, i) => {
        const sx = { ...tdSx, ...edgeStyle(data, i, pos) };
        const v = (data.qAssist || [])[i] || "";
        const pickMark = (data.qAssistMark || [])[i];
        const source = (data.qAssistSource || [])[i];
        const title = assistSourceTitle(source);
        const highStepWait = isHighStepOverlapWait(v, source);
        if (!v) return <Box component="td" key={i} title={title} sx={{ ...sx, color: dimColor }}>–</Box>;
        return (
          <Box component="td" key={i} title={title} sx={{ ...sx, backgroundColor: Q_ASSIST_BG, ...generatedPickSx(pickMark), ...(highStepWait ? alertBlinkSx : {}) }}>
            <AssistText v={v} />
          </Box>
        );
      })}
    </tr>
  );
}

// 행 라벨 (왼쪽 고정 컬럼). [텍스트, 글자색]. 어시스트 블록만 빨강. (시안 동일)
const LBL_RED = "#ff5252";
const LBL_ORANGE = "#ff9800";
const lblSx = { ...tdSx, color: "#fff", fontWeight: "bold", background: "#141414", textAlign: "right",
  position: "sticky", left: 0, zIndex: 2,
  borderLeft: `3px solid ${HL}`, borderRight: `3px solid ${HL}` };
function LblCell({ text, color = "#fff", edge, onClick, title }) {
  const sx = { ...lblSx, color, ...(onClick ? { cursor: "pointer", userSelect: "none" } : {}) };
  if (edge === "head") sx.borderTop = `3px solid ${HL}`;
  if (edge === "last") sx.borderBottom = `3px solid ${HL}`;
  const Tag = edge === "head" ? "th" : "td";
  return <Box component={Tag} sx={sx} onClick={onClick} title={title}>{text}</Box>;
}

function StrategyTable({ data, showLabels = true, maxBlinkActive, onMaxLabelClick }) {
  const rowLabel = (text) => showLabels ? text : undefined;
  const tableWidth = data.tableWidth || (showLabels ? 1020 : 960);
  return (
    <Box component="table" sx={{ borderCollapse: "collapse", backgroundColor: "#000", tableLayout: "fixed", width: tableWidth }}>
      <thead>
        <tr>
          {showLabels && <LblCell text="섹션" edge="head" />}
          {data.name.map((n, i) => (
            <Box component="th" key={i} sx={{
              ...thSx,
              color: data.headBg?.[i] ? "#111" : headColorOf(data, i, n),
              fontWeight: data.headBg?.[i] ? 900 : thSx.fontWeight,
              backgroundColor: data.headBg?.[i] || "#000",
              ...edgeStyle(data, i, "head"),
            }}>
              <Box component="span" sx={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "3px" }}>
                {n}
              </Box>
            </Box>
          ))}
        </tr>
      </thead>
      <tbody>
        <SimpleRow data={data} dataKey="wait" render={waitCell} pos="mid" label={rowLabel("연속")} markKey="waitSourceMarks" />
        <SimpleRow data={data} dataKey="pick" render={(v) => <Chip v={v} />} pos="mid" label={rowLabel("생성")} />
        <SimpleRow data={data} dataKey="stage1" render={(v) => <span style={{ color: "#e0e0e0" }}>{v}</span>} pos="mid" label={rowLabel("단계-AS")} />
        <SimpleRow data={data} dataKey="pct" render={(v) => <span style={{ color: "#69f0ae", fontWeight: "bold" }}>{v}</span>} pos="mid" label={rowLabel("적중율")} markKey="pctSourceMarks" />
        <SimpleRow data={data} dataKey="rec" render={(v) => <span style={{ color: "#eaeaea" }}>{recHTML(v)}</span>} pos="mid" label={rowLabel("총전적")} />
        <SimpleRow data={data} dataKey="rec2" render={(v) => <span>{rec2HTML(v)}</span>} pos="mid" label={rowLabel("최다")} />
        <AssistRow data={data} pos="mid" label={rowLabel("어시H픽")} labelColor={LBL_RED} />
        <SimpleRow data={data} dataKey="wait2" render={waitCell} pos="mid" label={rowLabel("연속")} labelColor={LBL_RED}
          shouldBlink={(v) => isMissStreakAtLeast(v, MISS_STREAK_BLINK_MIN)} />
        <SimpleRow data={data} dataKey="pct2" render={(v) => <span style={{ color: "#69f0ae", fontWeight: "bold" }}>{v}</span>} pos="mid" label={rowLabel("적중율")} labelColor={LBL_RED} />
        <SimpleRow data={data} dataKey="assistRec" render={(v) => <span style={{ color: "#eaeaea" }}>{recHTML(v)}</span>} pos="mid" label={rowLabel("총전적")} labelColor={LBL_RED} />
        <SimpleRow data={data} dataKey="assistRec2" render={(v) => <span>{rec2HTML(v)}</span>} pos="mid" label={rowLabel("최다")} labelColor={LBL_RED}
          labelOnClick={showLabels ? onMaxLabelClick : undefined} labelTitle="회차·쿼터 최다 9M 이상을 5초간 점멸"
          shouldBlink={(v) => maxBlinkActive && isMaxMissAtLeast(v, MAX_MISS_BLINK_MIN)} />
        <SimpleRow data={data} dataKey="stage" render={(v) => <span style={{ color: "#e0e0e0" }}>{v}</span>} pos="mid" label={rowLabel("단계-AS")} labelColor={LBL_RED} />
        <SimpleRow data={data} dataKey="idx1" render={(v, i, row) => amountText(v, row.idx1Zone?.[i])} pos="mid" label={rowLabel("회차P")} labelColor={LBL_RED} />
        <SimpleRow data={data} dataKey="idx2" render={(v) => <span style={{ color: String(v).startsWith("-") ? "#ef5350" : "#2e9e5b", fontWeight: "bold" }}>{v}</span>} pos="mid" label={rowLabel("누적P")} labelColor={LBL_RED} />
        <SimpleRow data={data} dataKey="martinCStepH" render={(v) => <span style={{ color: LBL_ORANGE, fontWeight: "bold" }}>{v}</span>} pos="mid" label={rowLabel("마틴C 단계")} labelColor={LBL_ORANGE} />
        <SimpleRow data={data} dataKey="martinCAmountH" render={(v) => <span style={{ color: LBL_ORANGE, fontWeight: "bold" }}>{v}</span>} pos="mid" label={rowLabel("마틴C 금액")} labelColor={LBL_ORANGE} />
        <QAssistRow data={data} pos="mid" label={rowLabel("어시Q픽")} />
        <SimpleRow data={data} dataKey="qWait2" render={waitCell} pos="mid" label={rowLabel("쿼터연속")}
          shouldBlink={(v) => isMissStreakAtLeast(v, MISS_STREAK_BLINK_MIN)} />
        <SimpleRow data={data} dataKey="qPct2" render={(v) => <span style={{ color: "#69f0ae", fontWeight: "bold" }}>{v}</span>} pos="mid" label={rowLabel("적중율")} />
        {/* 쿼터 블록 */}
        <SimpleRow data={data} dataKey="qrec" render={(v) => <span style={{ color: "#eaeaea" }}>{recHTML(v)}</span>} pos="mid" label={rowLabel("쿼터전적")} />
        <SimpleRow data={data} dataKey="qrec2" render={(v) => <span>{rec2HTML(v)}</span>} pos="mid" label={rowLabel("최다")}
          labelOnClick={showLabels ? onMaxLabelClick : undefined} labelTitle="회차·쿼터 최다 9M 이상을 5초간 점멸"
          shouldBlink={(v) => maxBlinkActive && isMaxMissAtLeast(v, MAX_MISS_BLINK_MIN)} />
        <SimpleRow data={data} dataKey="qstage" render={(v) => <span style={{ color: "#e0e0e0" }}>{v}</span>} pos="mid" label={rowLabel("단계-AS")} />
        <SimpleRow data={data} dataKey="qidx1" render={(v, i, row) => amountText(v, row.qidx1Zone?.[i])} pos="mid" label={rowLabel("쿼터P")} />
        <SimpleRow data={data} dataKey="qidx2" render={(v) => <span style={{ color: String(v).startsWith("-") ? "#ef5350" : "#2e9e5b", fontWeight: "bold" }}>{v}</span>} pos="mid" label={rowLabel("누적P")} />
        <SimpleRow data={data} dataKey="martinCStepQ" render={(v) => <span style={{ color: LBL_ORANGE, fontWeight: "bold" }}>{v}</span>} pos="mid" label={rowLabel("마틴C 단계")} labelColor={LBL_ORANGE} />
        <SimpleRow data={data} dataKey="martinCAmountQ" render={(v) => <span style={{ color: LBL_ORANGE, fontWeight: "bold" }}>{v}</span>} pos="last" label={rowLabel("마틴C 금액")} labelColor={LBL_ORANGE} />
      </tbody>
    </Box>
  );
}

// ── 실데이터 포맷터 ──
const fmtStreak = (type, count) => {
  if (!type || !count) return "";
  return `${count}${type === "hit" ? "H" : "M"}`;
};
const fmtPct = (hit, total) => (total > 0 ? `${(hit / total * 100).toFixed(1)}%` : "");
const fmtRec = (total, hit, miss) => `${total}-${hit}/${miss}`;
const fmtRec2 = (mh, mm) => `${mh}-${mm}`;
const fmtStage = (step, triple) => (step ? `${step}S-${triple ?? 0}` : "");
const fmtMan = (man) => {
  if (man === "N/A") return "-";
  if (man === null || man === undefined) return "";
  const v = Math.round((man || 0) * 10) / 10;
  return v.toFixed(1);
};
const fmtValue = (v) => (v === "N/A" ? "-" : (v || ""));
const zoneColor = (zone, fallback = "#fff") => AMOUNT_ZONE_COLORS[zone] || fallback;
const amountText = (v, zone, fallback = "#fff") => (
  <span style={{ color: zoneColor(zone, fallback), fontWeight: "bold" }}>{v}</span>
);
const betAt = (amounts, step, stepMin = 1) => {
  if (!amounts || !step) return null;
  if (step < (stepMin || 1)) return 0;
  const idx = step - 1;
  return idx >= 0 && idx < amounts.length ? amounts[idx] : null;
};
const amountsFor = (ctx, stratKey) => {
  if (ctx.roundState?.strategy_enabled?.[stratKey] === false) return null;
  return ctx.roundState?.bet_amounts_map && ctx.roundState.bet_amounts_map[stratKey];
};
const stepMinFor = (ctx, stratKey) => (ctx.roundState?.bet_step_min_map && ctx.roundState.bet_step_min_map[stratKey]) || 1;
const HIDE_QUARTER_KEYS = new Set(["D", "G", "TN", "ONE", "TWO", "P", "B"]);
const assistFor = (ctx, key) => ({
  _key: key,
  next: sectionFor(ctx, key)?.assist_h?.pick,
  source: sectionFor(ctx, key)?.assist_h?.source,
  stats: sectionFor(ctx, key)?.assist_h,
});
const qAssistFor = (ctx, key) => {
  const qas = sectionFor(ctx, key)?.assist_q;
  return qas ? { ...qas, _key: key } : null;
};
const qAssistStreakFor = (ctx, qas) => {
  const key = qas?._key;
  return key ? ctx.roundState?.sections?.[key]?.assist_q : null;
};
const sectionFor = (ctx, key) => (key ? ctx.roundState?.sections?.[key] : null);
const assistStateFor = (ctx, assist) => sectionFor(ctx, assist?._key)?.assist_h || null;
const qAssistStateFor = (ctx, qas) => sectionFor(ctx, qas?._key)?.assist_q || null;
const GOB_KEY_TO_LABEL = {
  S1: "S1", S2: "S2", S3: "S3",
  SR1: "S1R", SR2: "S2R", SR3: "S3R",
  FOR1: "FOR1", FOR2: "FOR2", FOR3: "FOR3",
  FOR1X: "FOR1X", FOR2X: "FOR2X", FOR3X: "FOR3X",
};
const gobLabelOf = (key) => GOB_KEY_TO_LABEL[key] || key;
const addGobBg = (map, label, color) => {
  const prev = map.get(label);
  if (!prev || prev === color) {
    map.set(label, color);
    return;
  }
  map.set(label, `linear-gradient(90deg, ${prev} 0 50%, ${color} 50% 100%)`);
};

// 쿼터(3회묶음 1승) 블록: 쿼터전적/단계/쿼터P/누적P
const quarterRow = (q, amounts, stepMin = 1) => {
  if (!q) return {};
  const step = q.martin_step ?? q.step;
  const amount = q.amount;
  return {
    qrec: `${q.total_q ?? 0}-${q.win_q ?? 0}/${q.lose_q ?? 0}`,
    qrec2: fmtRec2(q.max_hit_streak ?? 0, q.max_miss_streak ?? 0),
    qstage: fmtStage(step, 0),
    qidx1: amount !== null && amount !== undefined ? fmtMan(amount) : "",
    qidx2: q.pnl !== null && q.pnl !== undefined ? fmtMan(q.pnl) : "",
  };
};
const quarterAssistRow = (q, pick, streak = null) => {
  if (!q) return { qAssist: pick || "" };
  const total = q.rate_total ?? q.total ?? q.total_q ?? 0;
  const hit = q.rate_hit ?? q.hit ?? q.win_q ?? 0;
  return {
    qAssist: pick || "",
    qWait2: fmtStreak(streak?.cur_streak_type, streak?.cur_streak_count),
    qPct2: fmtPct(hit, total),
  };
};
const qAssistPickText = (qas, state = null) => {
  const pick = fmtValue(state?.pick ?? qas?.pick);
  return (state?.source || qas?.source || "").startsWith("쿼터휴식") && (pick === "P" || pick === "B") ? `${pick}(W)` : pick;
};

// roundState.sections 기반 행 데이터
const fromStats = (ctx, key) => {
  const section = sectionFor(ctx, key);
  const s = section?.base;
  if (!s) return null;
  const total = s.total ?? 0;
  if (total === 0 && !s.pick) return null;
  const amounts = amountsFor(ctx, key);
  const stepMin = stepMinFor(ctx, key);
  const as = section?.assist_h;
  const qas = qAssistFor(ctx, key);
  const hs = section?.assist_h;
  const qs = qAssistStateFor(ctx, qas);
  const qData = qs || qas;
  const assistTotal = as?.total ?? 0;
  const hHighStepWait = hs?.bet_unavailable_reason === "high_step_overlap_wait";
  const qHighStepWait = qs?.bet_unavailable_reason === "high_step_overlap_wait";
  const highStepWaitTitle = "(고단계 중첩정지)";
  const martinC = ctx.roundState?.conditional_martins?.martin_c?.tracks || {};
  const martinCH = martinC[`${key}:assist_h`];
  const martinCQ = martinC[`${key}:assist_q`];
  return {
    wait: fmtStreak(s.cur_streak_type, s.cur_streak_count),
    pick: fmtValue(s.pick),
    pickMark: s.generated_pick_mark,
    assist: hHighStepWait && (hs?.pick === "P" || hs?.pick === "B") ? `${hs.pick}(W)` : fmtValue(hs?.pick),
    assistMark: hs?.generated_pick_mark,
    assistSource: hHighStepWait ? highStepWaitTitle : hs?.source,
    wait2: hs ? fmtStreak(hs.cur_streak_type, hs.cur_streak_count) : (as ? fmtStreak(as.cur_streak_type, as.cur_streak_count) : undefined),
    pct2: as ? fmtPct(as.hit ?? 0, assistTotal) : undefined,
    assistRec: as ? fmtRec(assistTotal, as.hit ?? 0, as.miss ?? 0) : undefined,
    assistRec2: as ? fmtRec2(as.max_hit_streak ?? 0, as.max_miss_streak ?? 0) : undefined,
    pct: fmtPct(s.hit ?? 0, total),
    rec: fmtRec(total, s.hit ?? 0, s.miss ?? 0),
    rec2: fmtRec2(s.max_hit_streak ?? 0, s.max_miss_streak ?? 0),
    stage1: fmtStage(s.step, 0),
    stage: as ? fmtStage(as.step, 0) : "",
    idx1: as ? (hHighStepWait ? "-" : fmtMan(as.amount ?? (amounts ? betAt(amounts, as.step, stepMin) : null))) : "",
    idx1Zone: as?.amount_zone,
    idx2: as && as.pnl !== null && as.pnl !== undefined ? fmtMan(as.pnl) : "",
    martinCStepH: martinCH?.active ? `${martinCH.step || 1}S` : "",
    martinCAmountH: martinCH?.active ? fmtMan(martinCH.amount ?? 0) : "",
    ...(HIDE_QUARTER_KEYS.has(key) ? {} : {
      ...quarterAssistRow(
        qData,
        qHighStepWait && (qs?.pick === "P" || qs?.pick === "B") ? `${qs.pick}(W)` : qAssistPickText(qas, qs),
        qs,
      ),
      qAssistSource: qHighStepWait ? highStepWaitTitle : (qs?.source ?? qas?.source),
      qAssistMark: qs?.generated_pick_mark,
    }),
    ...(HIDE_QUARTER_KEYS.has(key) ? {} : quarterRow(qData, amounts, stepMin)),
    ...(HIDE_QUARTER_KEYS.has(key) || !qHighStepWait ? {} : { qidx1: "-" }),
    ...(HIDE_QUARTER_KEYS.has(key) ? {} : { qidx1Zone: qData?.amount_zone }),
    ...(HIDE_QUARTER_KEYS.has(key) ? {} : {
      martinCStepQ: martinCQ?.active ? `${martinCQ.step || 1}S` : "",
      martinCAmountQ: martinCQ?.active ? fmtMan(martinCQ.amount ?? 0) : "",
    }),
  };
};
const fromSection = (ctx, key) => fromStats(ctx, key);

// 컬럼명(라벨 + 컬럼 인덱스) → 실데이터 행. 매핑 없으면 null(빈칸).
// OLD는 항상 null(위치만). NEW는 직전 세트 합성본을 연결.
function buildColData(label, i, data, ctx) {
  // stats 직접 매핑 (서브게임 허니비/W111/M22/D112 포함 — 정픽만, R쌍은 위치만)
  const STAT_KEYS = { A: "A", AR: "AR", D: "D", G: "G", TN: "TN", ONE: "ONE", TWO: "TWO", J: "J", P: "P", B: "B", "6M": "6M", "6MX": "6MX" };
  if (STAT_KEYS[label]) return fromStats(ctx, STAT_KEYS[label]);
  // 서브게임 세트: 정픽/R2/SR2O/SRN — stats 키가 라벨과 동일. NC 계열은 기존 키 유지.
  const SUBGAME_LABELS = ["허니비", "허니R2", "W111", "위너R2", "M22", "메가R2",
    "D112", "드림R2", "NC", "NCR"];
  if (SUBGAME_LABELS.includes(label)) return fromStats(ctx, label);
  // G(H1~H4/%1~%4) — 다른 섹션 메트릭으로 산출된 픽.
  if (/^G\((H|%)[1-4]\)$/.test(label)) return fromStats(ctx, label);
  let m = label.match(/^FOR([123])X$/);
  if (m) return fromSection(ctx, `FOR${m[1]}X`);
  m = label.match(/^FOR([123])$/);
  if (m) return fromSection(ctx, `FOR${m[1]}`);
  m = label.match(/^S([123])R$/);
  if (m) return fromSection(ctx, `SR${m[1]}`);
  m = label.match(/^S([123])$/);
  if (m) return fromSection(ctx, `S${m[1]}`);
  // 아직 별도 매핑이 없는 컬럼은 위치만 유지한다.
  return null;
}

// 테이블 정의 + 실데이터 → 값이 채워진 data
function withLiveData(base, ctx) {
  const keys = ["wait", "pick", "stage1", "pct", "rec", "rec2", "assist", "assistSource", "wait2", "pct2", "assistRec", "assistRec2", "stage", "idx1", "idx2",
    "qAssist", "qAssistSource", "qWait2", "qAssistWait", "qPct2",
    "qrec", "qrec2", "qstage", "qidx1", "qidx2",
    "idx1Zone", "qidx1Zone", "pickMark", "assistMark", "qAssistMark",
    "martinCStepH", "martinCAmountH", "martinCStepQ", "martinCAmountQ"];
  const out = { ...base };
  keys.forEach((k) => { out[k] = base.name.map(() => ""); });
  out.headBg = base.name.map(() => "");
  out.waitBg = base.name.map(() => "");
  out.pctBg = base.name.map(() => "");
  const markWaitHit = new Map();
  const markWaitMiss = new Map();
  const markPct = new Map();
  const gobMarks = ctx.roundState?.gob_marks || {};
  [1, 2, 3, 4].forEach((rank) => {
    const bg = GOB_RANK_BG[rank] || GOB_TOP_BG;
    if ((gobMarks[`GH${rank}`] || []).length) {
      const idx = base.name.indexOf(`G(H${rank})`);
      if (idx >= 0) out.headBg[idx] = bg;
    }
    if ((gobMarks[`GP${rank}`] || []).length) {
      const idx = base.name.indexOf(`G(%${rank})`);
      if (idx >= 0) out.headBg[idx] = bg;
    }
    (gobMarks[`GH${rank}`] || []).forEach((key) => addGobBg(markWaitHit, gobLabelOf(key), bg));
    (gobMarks[`GP${rank}`] || []).forEach((key) => addGobBg(markPct, gobLabelOf(key), bg));
  });
  out.waitSourceMarks = base.name.map(() => []);
  out.pctSourceMarks = base.name.map(() => []);
  base.name.forEach((label, i) => {
    if (!label) return; // 빈 컬럼
    if (markPct.has(label)) out.pctBg[i] = markPct.get(label);
    const rd = buildColData(label, i, base, ctx);
    if (!rd) return;
    keys.forEach((k) => { if (rd[k] != null) out[k][i] = rd[k]; });
    const waitValue = String(out.wait[i] || "");
    if (markWaitHit.has(label)) {
      out.waitBg[i] = markWaitHit.get(label);
    } else if (markWaitMiss.has(label) && waitValue.endsWith("M")) {
      out.waitBg[i] = markWaitMiss.get(label);
    }
  });
  return out;
}

export default function GhStrategyBoard({ roundState }) {
  const [maxBlinkActive, setMaxBlinkActive] = useState(false);
  const maxBlinkTimerRef = useRef(null);
  useEffect(() => () => clearTimeout(maxBlinkTimerRef.current), []);
  const handleMaxLabelClick = () => {
    clearTimeout(maxBlinkTimerRef.current);
    setMaxBlinkActive(true);
    maxBlinkTimerRef.current = setTimeout(() => {
      setMaxBlinkActive(false);
      maxBlinkTimerRef.current = null;
    }, MAX_BLINK_DURATION_MS);
  };
  const hasData = !!roundState?.sections;
  const ctx = { roundState };
  const tables = [G1, G2, G3].map((t) => (hasData ? withLiveData(t, ctx) : t));
  return (
    <Box sx={{ overflowX: "auto", mb: 2 }}>
      <Box sx={{ display: "inline-grid", gridTemplateColumns: "repeat(2, max-content)", backgroundColor: "#000" }}>
        {tables.map((t, idx) => (
          <StrategyTable
            key={idx}
            data={t}
            showLabels={idx % 2 === 0}
            maxBlinkActive={maxBlinkActive}
            onMaxLabelClick={handleMaxLabelClick}
          />
        ))}
      </Box>
    </Box>
  );
}
