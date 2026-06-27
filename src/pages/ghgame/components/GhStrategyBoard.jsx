import { Box } from "@mui/material";

// ── 전략별 현황 전광판 (design-260615-gh-calc.html 260623 신버전 포팅) ──
// 4개 테이블(G1~G4) · 각 16컬럼 · 10행.
// 행: wait(대기 H녹/M노랑) / pick(P·B 칩) / pct(적중률%) / rec(전적) / rec2(보조)
//     / pick2(보조픽) / pct2(적중률2) / stage(단계) / idx1(배팅액) / idx2(PnL)
// R쌍 분리(병합 없음). 각 전략 세트 뒤 OLD/NEW 컬럼.
//   NEW = 합성본(A세트→AAR, S세트→SSR#, 드림R세트→실데이터). OLD = 위치만(빈칸, 추후 연결).
// 실데이터: A/AR/AAR/D/G/TN/ONE/TWO/P/B/J(stats) + SQ/SR/SSR/SX(트랙). 그 외(허니비/W111/NC/6MX 등)는 칸만.

const HC_BLUE = "#2f9bff";
const HC_RED = "#ff5b5b";

const COLOR = {
  A: "#0066fe", AR: "#c0504d",
  SQ1: "#0063d6", SQ2: "#0063d6", SQ3: "#0063d6",
  S1: "#0063d6", S2: "#0063d6", S3: "#0063d6",
  S1R: "#c0504d", S2R: "#c0504d", S3R: "#c0504d",
  SX: "#0063d6", D: "#c0504d", G: "#0063d6",
  허니비: "#c0504d", pattern: "#00a11a", "6MX": "#de6a08",
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
// G1: A/AR 세트 + SQ1/SQ2/SQ3 세트(각 뒤 OLD/NEW). NEW=합성본, OLD=위치만.
const G1n = ["A", "AR", "OLD", "NEW", "SQ1", "S1R", "OLD", "NEW", "SQ2", "S2R", "OLD", "NEW", "SQ3", "S3R", "OLD", "NEW"];
const G1 = {
  name: G1n,
  gstart: new Set([4, 8, 12]),
  hlRanges: [[0, 3], [4, 7], [8, 11], [12, 15]],
  headColors: [[0, 3, HC_BLUE], [4, 7, HC_RED], [8, 11, HC_BLUE], [12, 15, HC_RED]],
};
// G2: SX1/2/3 + 6MX + D/G + TN/ONE/TWO/P/B/J + G(H1)~G(%0)(칸만)
const G2n = ["SX1", "SX2", "SX3", "6MX", "D", "G", "TN", "ONE", "TWO", "P", "B", "J", "G(H1)", "G(H0)", "G(%1)", "G(%0)"];
const G2 = {
  name: G2n,
  gstart: new Set([3, 4, 12]),
  hlRanges: [[0, 0], [1, 1], [2, 2], [3, 3], [4, 8], [9, 11], [12, 15]],
  headColors: [[0, 3, HC_BLUE], [4, 8, HC_RED], [9, 11, HC_BLUE], [12, 15, HC_RED]],
};
// G3: 허니비/W111/M22/D112 세트(각 뒤 OLD/NEW). 백엔드 미구현 → 칸만.
const G3n = ["허니비", "허니R", "OLD", "NEW", "W111", "위너R", "OLD", "NEW", "M22", "메가R", "OLD", "NEW", "D112", "드림R", "OLD", "NEW"];
const G3 = {
  name: G3n,
  gstart: new Set([4, 8, 12]),
  hlRanges: [[0, 3], [4, 7], [8, 11], [12, 15]],
  headColors: [[0, 3, HC_BLUE], [4, 7, HC_RED], [8, 11, HC_BLUE], [12, 15, HC_RED]],
};
// G4: NC세트 + 이전3 + 빈칸. 칸만. (6MX는 G2 SX3 뒤로 이동)
const G4n = ["NC", "NCR", "OLD", "NEW", "이전3", "", "", "", "", "", "", "", "", "", "", ""];
const G4 = {
  name: G4n,
  gstart: new Set([4]),
  hlRanges: [[0, 3], [4, 4]],
  headColors: [[0, 3, HC_BLUE], [4, 4, HC_RED]],
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

// 단순(병합 없음) 행. 빈값은 회색 대시(–).
function SimpleRow({ data, dataKey, render, pos }) {
  return (
    <tr>
      {data.name.map((n, i) => {
        const v = (data[dataKey] || [])[i] || "";
        const sx = { ...tdSx, ...edgeStyle(data, i, pos) };
        return v
          ? <Box component="td" key={i} sx={sx}>{render(v)}</Box>
          : <Box component="td" key={i} sx={{ ...sx, color: dimColor }}>–</Box>;
      })}
    </tr>
  );
}

// 어시스트 행 (rec2 다음, 시안 pick2 행): P/B 색 글자 + 값 있는 칸만 #16365c 배경. 빈칸은 dim(–).
// 어시스트 픽은 (임시) 원래 픽(pick)과 동일. 실제 어시스트 로직은 추후 처리.
const ASSIST_BG = "#16365c";
function AssistRow({ data, pos }) {
  return (
    <tr>
      {data.name.map((n, i) => {
        const sx = { ...tdSx, ...edgeStyle(data, i, pos) };
        // 어시스트 픽 = (임시) 원래 픽과 동일
        const v = (data.assist || [])[i] || (data.pick || [])[i] || "";
        if (!v) return <Box component="td" key={i} sx={{ ...sx, color: dimColor }}>–</Box>;
        const col = v === "P" ? "#1565d8" : v === "B" ? "#e53935" : "#fff";
        return (
          <Box component="td" key={i} sx={{ ...sx, backgroundColor: ASSIST_BG }}>
            <span style={{ color: col, fontWeight: "bold" }}>{v}</span>
          </Box>
        );
      })}
    </tr>
  );
}

function StrategyTable({ data }) {
  return (
    <Box component="table" sx={{ borderCollapse: "collapse", backgroundColor: "#000", tableLayout: "fixed", width: 1180 }}>
      <thead>
        <tr>
          {data.name.map((n, i) => (
            <Box component="th" key={i} sx={{ ...thSx, color: headColorOf(data, i, n), backgroundColor: "#000", ...edgeStyle(data, i, "head") }}>{n}</Box>
          ))}
        </tr>
      </thead>
      <tbody>
        <SimpleRow data={data} dataKey="wait" render={waitCell} pos="mid" />
        <SimpleRow data={data} dataKey="pick" render={(v) => <Chip v={v} />} pos="mid" />
        <SimpleRow data={data} dataKey="pct" render={(v) => <span style={{ color: "#69f0ae", fontWeight: "bold" }}>{v}</span>} pos="mid" />
        <SimpleRow data={data} dataKey="rec" render={(v) => <span style={{ color: "#eaeaea" }}>{recHTML(v)}</span>} pos="mid" />
        <SimpleRow data={data} dataKey="rec2" render={(v) => <span>{rec2HTML(v)}</span>} pos="mid" />
        <AssistRow data={data} pos="mid" />
        <SimpleRow data={data} dataKey="pct2" render={(v) => <span style={{ color: "#69f0ae", fontWeight: "bold" }}>{v}</span>} pos="mid" />
        <SimpleRow data={data} dataKey="stage" render={(v) => <span style={{ color: "#e0e0e0" }}>{v}</span>} pos="mid" />
        <SimpleRow data={data} dataKey="idx1" render={(v) => <span style={{ color: "#fff", fontWeight: "bold" }}>{v}</span>} pos="mid" />
        <SimpleRow data={data} dataKey="idx2" render={(v) => <span style={{ color: String(v).startsWith("-") ? "#ef5350" : "#2e9e5b", fontWeight: "bold" }}>{v}</span>} pos="last" />
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
  if (man === null || man === undefined) return "";
  const v = Math.round((man || 0) * 10) / 10;
  if (v === 0) return "0";
  return Number.isInteger(v) ? `${v}` : `${v.toFixed(1)}`;
};
const betAt = (amounts, step) => {
  if (!amounts || !step) return null;
  const idx = step - 1;
  return idx >= 0 && idx < amounts.length ? amounts[idx] : null;
};
const amountsFor = (ctx, stratKey) => ctx.betAmountsMap && ctx.betAmountsMap[stratKey];

// stats 키 기반 행 데이터 (A/AR/AAR/AARO/D/G/TN/ONE/TWO/P/B/J)
const fromStats = (ctx, key) => {
  const s = ctx.stats?.[key];
  if (!s) return null;
  const total = s.total ?? 0;
  if (total === 0 && !ctx.nextPicks?.[key]) return null;
  const amounts = amountsFor(ctx, key);
  return {
    wait: fmtStreak(s.cur_streak_type, s.cur_streak_count),
    pick: ctx.nextPicks?.[key] || "",
    pct: fmtPct(s.hit ?? 0, total),
    rec: fmtRec(total, s.hit ?? 0, s.miss ?? 0),
    rec2: fmtRec2(s.max_hit_streak ?? 0, s.max_miss_streak ?? 0),
    stage: fmtStage(s.martin_step, s.triple_loss),
    idx1: fmtMan(betAt(amounts, s.martin_step)),
    idx2: fmtMan(s.pnl),
  };
};
// 트랙(sq/sr/ssr/sx) sc# 기반 행 데이터
const fromTrack = (tracks, scKey, amounts) => {
  const t = tracks?.[scKey];
  const sm = t?.summary;
  if (!sm) return null;
  const total = (sm.total_hit ?? 0) + (sm.total_miss ?? 0);
  const cur = (t.round_data || []).find((r) => r.status === "current");
  return {
    wait: fmtStreak(sm.cur_streak?.type, sm.cur_streak?.count),
    pick: cur?.predict || "",
    pct: fmtPct(sm.total_hit ?? 0, total),
    rec: fmtRec(total, sm.total_hit ?? 0, sm.total_miss ?? 0),
    rec2: fmtRec2(sm.max_hit_streak ?? 0, sm.max_miss_streak ?? 0),
    stage: fmtStage(sm.martin_step, sm.triple_loss),
    idx1: fmtMan(betAt(amounts, sm.martin_step)),
    idx2: fmtMan(sm.pnl),
  };
};

// 컬럼명(라벨 + 컬럼 인덱스) → 실데이터 행. 매핑 없으면 null(빈칸).
// OLD는 항상 null(위치만). NEW는 직전 세트 합성본을 연결.
function buildColData(label, i, data, ctx) {
  // stats 직접 매핑
  const STAT_KEYS = { A: "A", AR: "AR", D: "D", G: "G", TN: "TN", ONE: "ONE", TWO: "TWO", J: "J", P: "P", B: "B" };
  if (STAT_KEYS[label]) return fromStats(ctx, STAT_KEYS[label]);
  // SQ1/2/3 (G1 메인) — SQ 트랙
  let m = label.match(/^SQ([123])$/);
  if (m) return fromTrack(ctx.sqTracks, `sc${m[1]}`, amountsFor(ctx, `SQ${m[1]}`));
  // SX1/2/3 (G2) — SX 트랙 sc1/2/3
  m = label.match(/^SX([123])$/);
  if (m) return fromTrack(ctx.sxTracks, `sc${m[1]}`, amountsFor(ctx, `SX${m[1]}`));
  // S1R/S2R/S3R (G1) — SR 트랙
  m = label.match(/^S([123])R$/);
  if (m) return fromTrack(ctx.srTracks, `sc${m[1]}`, amountsFor(ctx, `SQ${m[1]}`));
  // NEW: 직전 세트 합성본 연결 (G1만 실데이터, 나머지 테이블은 칸만)
  if (label === "NEW") {
    if (data === G1) {
      // 컬럼 3 = A세트 NEW → AAR / 컬럼 7/11/15 = S세트 NEW → SSR1/2/3
      if (i === 3) return fromStats(ctx, "AAR");
      const sIdx = { 7: 1, 11: 2, 15: 3 }[i];
      if (sIdx) return fromTrack(ctx.ssrTracks, `sc${sIdx}`, amountsFor(ctx, `SSR${sIdx}`));
    }
    return null;
  }
  // OLD: A세트(컬럼2)→AARO stats / S세트(컬럼6/10/14)→SSRO sc1/2/3 (260627)
  if (label === "OLD") {
    if (data === G1) {
      if (i === 2) return fromStats(ctx, "AARO");
      const sIdx = { 6: 1, 10: 2, 14: 3 }[i];
      if (sIdx) return fromTrack(ctx.ssroTracks, `sc${sIdx}`, amountsFor(ctx, `SSR${sIdx}`));
    }
    return null;  // G3 등 다른 테이블의 OLD는 위치만
  }
  // 그 외(허니비/W111/NC/6MX/G(H1) 등): 위치만
  return null;
}

// 테이블 정의 + 실데이터 → 값이 채워진 data
function withLiveData(base, ctx) {
  const keys = ["wait", "pick", "pct", "rec", "rec2", "assist", "pct2", "stage", "idx1", "idx2"];
  const out = { ...base };
  keys.forEach((k) => { out[k] = base.name.map(() => ""); });
  base.name.forEach((label, i) => {
    if (!label) return; // 빈 컬럼
    const rd = buildColData(label, i, base, ctx);
    if (!rd) return;
    keys.forEach((k) => { if (rd[k] != null) out[k][i] = rd[k]; });
    // ── 어시스트 기반 행 (임시: 어시스트=원래픽이라 원래 값과 동일) ──
    //   원래 픽의 단계는 wait 행(2H/2M 연승·연패)으로 알 수 있으므로,
    //   stage·idx1(현 회차 배팅)·idx2(누적 PnL)는 모두 '어시스트' 기준으로 표시한다.
    //   실제 어시스트 로직 붙으면 어시스트 픽 시리즈로 재산출해 assist_* 값만 교체.
    if (rd.assist == null && rd.pick != null) out.assist[i] = rd.pick;
    if (rd.pct2 == null && rd.pct != null) out.pct2[i] = rd.pct;
    if (rd.assist_stage != null) out.stage[i] = rd.assist_stage;   // 어시스트 단계
    if (rd.assist_idx1 != null) out.idx1[i] = rd.assist_idx1;      // 어시스트 현 회차 배팅
    if (rd.assist_idx2 != null) out.idx2[i] = rd.assist_idx2;      // 어시스트 누적 PnL
  });
  return out;
}

export default function GhStrategyBoard({ stats, nextPicks, sqTracks, srTracks, ssrTracks, ssroTracks, sxTracks, betAmounts, betAmountsMap }) {
  const hasData = !!(stats || sqTracks);
  const ctx = { stats, nextPicks, sqTracks, srTracks, ssrTracks, ssroTracks, sxTracks, betAmounts, betAmountsMap };
  const tables = [G1, G2, G3, G4].map((t) => (hasData ? withLiveData(t, ctx) : t));
  return (
    <Box sx={{ overflowX: "auto", mb: 2 }}>
      <Box sx={{ display: "inline-block", backgroundColor: "#000" }}>
        {tables.map((t, idx) => <StrategyTable key={idx} data={t} />)}
      </Box>
    </Box>
  );
}
