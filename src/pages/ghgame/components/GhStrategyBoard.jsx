import { Box } from "@mui/material";

// ── 전략별 현황 전광판 (design-260615-gh-calc.html 260623 신버전 포팅) ──
// 4개 테이블(G1~G4) · 각 16컬럼 · 10행.
// 행: wait(대기 H녹/M노랑) / pick(P·B 칩) / pct(적중률%) / rec(전적) / rec2(보조)
//     / pick2(보조픽) / pct2(적중률2) / assistRec(어시 총전적) / stage(단계) / idx1(배팅액) / idx2(PnL)
// R쌍 분리(병합 없음). 각 전략 세트 뒤 OLD/NEW 컬럼.
//   NEW = 합성본(A세트→AAR, S세트→SSR#, 드림R세트→실데이터). OLD = 위치만(빈칸, 추후 연결).
// 실데이터: A/AR/AAR/D/G/TN/ONE/TWO/P/B/J(stats) + SQ/SR/SSR/SX(트랙). 그 외(허니비/W111/NC/6MX 등)는 칸만.

const HC_BLUE = "#2f9bff";
const HC_RED = "#ff5b5b";

const COLOR = {
  A: "#0066fe", AR: "#c0504d",
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
const GOB_TOP_BG = "rgba(0, 200, 83, 0.55)";
const GOB_LOW_BG = "rgba(255, 213, 79, 0.62)";
const AMOUNT_ZONE_COLORS = { blue: "#2f9bff", white: "#fff", red: "#ff5b5b" };

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
// G1: A/AR 세트 + S1/S2/S3 세트. 각 세트 OLD/NEW = AARO/AARN, SSROn/SSRNn. (260628)
const G1n = ["A", "AR", "AARO", "AARN", "S1", "S1R", "SSRO1", "SSRN1", "S2", "S2R", "SSRO2", "SSRN2", "S3", "S3R", "SSRO3", "SSRN3"];
const G1 = {
  name: G1n,
  gstart: new Set([4, 8, 12]),
  hlRanges: [[0, 3], [4, 7], [8, 11], [12, 15]],
  headColors: [[0, 3, HC_BLUE], [4, 7, HC_RED], [8, 11, HC_BLUE], [12, 15, HC_RED]],
};
// G2: FOR1/2/3(따라) + FOR1X/2X/3X(반대) + D/G/TN/ONE/TWO + P/B/J/6MX + 빈칸1
// FOR1/2/3·FOR1X/2X/3X 각각 한 묶음(노란박스). 헤더색은 묶음별 번갈아(파/빨).
const G2n = ["FOR1", "FOR2", "FOR3", "FOR1X", "FOR2X", "FOR3X", "D", "G", "TN", "ONE", "TWO", "P", "B", "J", "6MX", ""];
const G2 = {
  name: G2n,
  gstart: new Set([3, 6, 11, 14]),
  hlRanges: [[0, 2], [3, 5], [6, 10], [11, 13], [14, 14]],
  headColors: [[0, 2, HC_BLUE], [3, 5, HC_RED], [6, 10, HC_BLUE], [11, 13, HC_RED], [14, 14, "#de6a08"]],
};
// G3: G(H1~%0)(칸만) + 허니비/W111/M22 세트(정픽/R/SRO/SRN).
const G3n = ["G(H1)", "G(H0)", "G(%1)", "G(%0)", "허니비", "허니R", "허니SRO", "허니SRN", "W111", "위너R", "위너SRO", "위너SRN", "M22", "메가R", "메가SRO", "메가SRN"];
const G3 = {
  name: G3n,
  gstart: new Set([4, 8, 12]),
  hlRanges: [[0, 3], [4, 7], [8, 11], [12, 15]],
  headColors: [[0, 3, HC_BLUE], [4, 7, HC_RED], [8, 11, HC_BLUE], [12, 15, HC_RED]],
};
// G4: D112세트 + NC세트(정픽/R/SRO/SRN) + SQ1/2/3(쿼터배팅, S와 픽 공유) + 빈칸 5.
const G4n = ["D112", "드림R", "드림SRO", "드림SRN", "NC", "NCR", "NCSRO", "NCSRN", "SQ1", "SQ2", "SQ3", "", "", "", "", ""];
const G4 = {
  name: G4n,
  gstart: new Set([4, 8]),
  hlRanges: [[0, 3], [4, 7], [8, 10]],
  headColors: [[0, 3, HC_RED], [4, 7, HC_BLUE], [8, 10, HC_BLUE]],
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

// 단순(병합 없음) 행. 빈값은 회색 대시(–). label 있으면 맨 앞 라벨 셀.
function SimpleRow({ data, dataKey, render, pos, label, labelColor, markKey }) {
  const bgKey = `${dataKey}Bg`;
  return (
    <tr>
      {label != null && <LblCell text={label} color={labelColor} edge={pos === "last" ? "last" : undefined} />}
      {data.name.map((n, i) => {
        const v = (data[dataKey] || [])[i] || "";
        const bg = (data[bgKey] || [])[i];
        const marks = markKey ? (data[markKey] || [])[i] : null;
        const sx = { ...tdSx, ...(bg ? { backgroundColor: bg } : {}), ...edgeStyle(data, i, pos) };
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
function AssistRow({ data, pos, label, labelColor }) {
  return (
    <tr>
      {label != null && <LblCell text={label} color={labelColor} edge={pos === "last" ? "last" : undefined} />}
      {data.name.map((n, i) => {
        const sx = { ...tdSx, ...edgeStyle(data, i, pos) };
        const v = (data.assist || [])[i] || "";
        const title = (data.assistSource || [])[i] || undefined;
        if (!v) return <Box component="td" key={i} sx={{ ...sx, color: dimColor }}>–</Box>;
        return (
          <Box component="td" key={i} title={title} sx={{ ...sx, backgroundColor: ASSIST_BG }}>
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
        const title = (data.qAssistSource || [])[i] || undefined;
        if (!v) return <Box component="td" key={i} sx={{ ...sx, color: dimColor }}>–</Box>;
        return (
          <Box component="td" key={i} title={title} sx={{ ...sx, backgroundColor: Q_ASSIST_BG }}>
            <AssistText v={v} />
          </Box>
        );
      })}
    </tr>
  );
}

// 행 라벨 (왼쪽 고정 컬럼). [텍스트, 글자색]. 어시스트 블록만 빨강. (시안 동일)
const LBL_RED = "#ff5252";
const lblSx = { ...tdSx, color: "#fff", fontWeight: "bold", background: "#141414", textAlign: "right",
  position: "sticky", left: 0, zIndex: 2,
  borderLeft: `3px solid ${HL}`, borderRight: `3px solid ${HL}` };
function LblCell({ text, color = "#fff", edge }) {
  const sx = { ...lblSx, color };
  if (edge === "head") sx.borderTop = `3px solid ${HL}`;
  if (edge === "last") sx.borderBottom = `3px solid ${HL}`;
  const Tag = edge === "head" ? "th" : "td";
  return <Box component={Tag} sx={sx}>{text}</Box>;
}

function StrategyTable({ data }) {
  return (
    <Box component="table" sx={{ borderCollapse: "collapse", backgroundColor: "#000", tableLayout: "fixed", width: 1020 }}>
      <thead>
        <tr>
          <LblCell text="섹션" edge="head" />
          {data.name.map((n, i) => (
            <Box component="th" key={i} sx={{ ...thSx, color: headColorOf(data, i, n), backgroundColor: "#000", ...edgeStyle(data, i, "head") }}>
              <Box component="span" sx={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "3px" }}>
                {n}
              </Box>
            </Box>
          ))}
        </tr>
      </thead>
      <tbody>
        <SimpleRow data={data} dataKey="wait" render={waitCell} pos="mid" label="연속" markKey="waitSourceMarks" />
        <SimpleRow data={data} dataKey="pick" render={(v) => <Chip v={v} />} pos="mid" label="생성" />
        <SimpleRow data={data} dataKey="stage1" render={(v) => <span style={{ color: "#e0e0e0" }}>{v}</span>} pos="mid" label="단계-AS" />
        <SimpleRow data={data} dataKey="pct" render={(v) => <span style={{ color: "#69f0ae", fontWeight: "bold" }}>{v}</span>} pos="mid" label="적중율" markKey="pctSourceMarks" />
        <SimpleRow data={data} dataKey="rec" render={(v) => <span style={{ color: "#eaeaea" }}>{recHTML(v)}</span>} pos="mid" label="총전적" />
        <SimpleRow data={data} dataKey="rec2" render={(v) => <span>{rec2HTML(v)}</span>} pos="mid" label="최다" />
        <AssistRow data={data} pos="mid" label="어시H픽" labelColor={LBL_RED} />
        <SimpleRow data={data} dataKey="wait2" render={waitCell} pos="mid" label="연속" labelColor={LBL_RED} />
        <SimpleRow data={data} dataKey="pct2" render={(v) => <span style={{ color: "#69f0ae", fontWeight: "bold" }}>{v}</span>} pos="mid" label="적중율" labelColor={LBL_RED} />
        <SimpleRow data={data} dataKey="assistRec" render={(v) => <span style={{ color: "#eaeaea" }}>{recHTML(v)}</span>} pos="mid" label="총전적" labelColor={LBL_RED} />
        <SimpleRow data={data} dataKey="stage" render={(v) => <span style={{ color: "#e0e0e0" }}>{v}</span>} pos="mid" label="단계-AS" labelColor={LBL_RED} />
        <SimpleRow data={data} dataKey="idx1" render={(v, i, row) => amountText(v, row.idx1Zone?.[i])} pos="mid" label="회차P" labelColor={LBL_RED} />
        <SimpleRow data={data} dataKey="idx2" render={(v) => <span style={{ color: String(v).startsWith("-") ? "#ef5350" : "#2e9e5b", fontWeight: "bold" }}>{v}</span>} pos="mid" label="누적P" labelColor={LBL_RED} />
        <QAssistRow data={data} pos="mid" label="어시Q픽" />
        <SimpleRow data={data} dataKey="qWait2" render={waitCell} pos="mid" label="연속" />
        <SimpleRow data={data} dataKey="qPct2" render={(v) => <span style={{ color: "#69f0ae", fontWeight: "bold" }}>{v}</span>} pos="mid" label="적중율" />
        {/* 쿼터 블록 */}
        <SimpleRow data={data} dataKey="qrec" render={(v) => <span style={{ color: "#eaeaea" }}>{recHTML(v)}</span>} pos="mid" label="쿼터전적" />
        <SimpleRow data={data} dataKey="qstage" render={(v) => <span style={{ color: "#e0e0e0" }}>{v}</span>} pos="mid" label="단계-AS" />
        <SimpleRow data={data} dataKey="qidx1" render={(v, i, row) => amountText(v, row.qidx1Zone?.[i])} pos="mid" label="쿼터P" />
        <SimpleRow data={data} dataKey="qidx2" render={(v) => <span style={{ color: String(v).startsWith("-") ? "#ef5350" : "#2e9e5b", fontWeight: "bold" }}>{v}</span>} pos="last" label="누적P" />
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
  AAR: "AARN",
  AARO: "AARO",
  S1: "S1", S2: "S2", S3: "S3",
  SR1: "S1R", SR2: "S2R", SR3: "S3R",
  SSR1: "SSRN1", SSR2: "SSRN2", SSR3: "SSRN3",
  SSRO1: "SSRO1", SSRO2: "SSRO2", SSRO3: "SSRO3",
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
  return {
    wait: fmtStreak(s.cur_streak_type, s.cur_streak_count),
    pick: fmtValue(s.pick),
    assist: fmtValue(hs?.pick),
    assistSource: hs?.source,
    wait2: hs ? fmtStreak(hs.cur_streak_type, hs.cur_streak_count) : (as ? fmtStreak(as.cur_streak_type, as.cur_streak_count) : undefined),
    pct2: as ? fmtPct(as.hit ?? 0, assistTotal) : undefined,
    assistRec: as ? fmtRec(assistTotal, as.hit ?? 0, as.miss ?? 0) : undefined,
    pct: fmtPct(s.hit ?? 0, total),
    rec: fmtRec(total, s.hit ?? 0, s.miss ?? 0),
    rec2: fmtRec2(s.max_hit_streak ?? 0, s.max_miss_streak ?? 0),
    stage1: fmtStage(s.step, 0),
    stage: as ? fmtStage(as.step, 0) : "",
    idx1: as ? fmtMan(as.amount ?? (amounts ? betAt(amounts, as.step, stepMin) : null)) : "",
    idx1Zone: as?.amount_zone,
    idx2: as && as.pnl !== null && as.pnl !== undefined ? fmtMan(as.pnl) : "",
    ...(HIDE_QUARTER_KEYS.has(key) ? {} : { ...quarterAssistRow(qData, qAssistPickText(qas, qs), qs), qAssistSource: qs?.source ?? qas?.source }),
    ...(HIDE_QUARTER_KEYS.has(key) ? {} : quarterRow(qData, amounts, stepMin)),
    ...(HIDE_QUARTER_KEYS.has(key) ? {} : { qidx1Zone: qData?.amount_zone }),
  };
};
const fromSection = (ctx, key) => fromStats(ctx, key);

// 컬럼명(라벨 + 컬럼 인덱스) → 실데이터 행. 매핑 없으면 null(빈칸).
// OLD는 항상 null(위치만). NEW는 직전 세트 합성본을 연결.
function buildColData(label, i, data, ctx) {
  // stats 직접 매핑 (서브게임 허니비/W111/M22/D112 포함 — 정픽만, R쌍은 위치만)
  const STAT_KEYS = { A: "A", AR: "AR", D: "D", G: "G", TN: "TN", ONE: "ONE", TWO: "TWO", J: "J", P: "P", B: "B" };
  if (STAT_KEYS[label]) return fromStats(ctx, STAT_KEYS[label]);
  // 서브게임 세트: 정픽/R/SRO/SRN — stats 키가 라벨과 동일. (허니비/허니R/허니SRO/허니SRN 등 + NC계열)
  const SUBGAME_LABELS = ["허니비", "허니R", "허니SRO", "허니SRN", "W111", "위너R", "위너SRO", "위너SRN",
    "M22", "메가R", "메가SRO", "메가SRN", "D112", "드림R", "드림SRO", "드림SRN",
    "NC", "NCR", "NCSRO", "NCSRN"];
  if (SUBGAME_LABELS.includes(label)) return fromStats(ctx, label);
  // G(H1/H0/%1/%0) — 다른 섹션 메트릭으로 산출된 픽.
  const G_LABEL_KEY = { "G(H1)": "G(H1)", "G(H0)": "G(H0)", "G(%1)": "G(%1)", "G(%0)": "G(%0)" };
  if (G_LABEL_KEY[label]) return fromStats(ctx, G_LABEL_KEY[label]);
  let m = label.match(/^FOR([123])X$/);
  if (m) return fromSection(ctx, `FOR${m[1]}X`);
  m = label.match(/^FOR([123])$/);
  if (m) return fromSection(ctx, `FOR${m[1]}`);
  m = label.match(/^S([123])R$/);
  if (m) return fromSection(ctx, `SR${m[1]}`);
  m = label.match(/^S([123])$/);
  if (m) return fromSection(ctx, `S${m[1]}`);
  m = label.match(/^SQ([123])$/);
  if (m) return fromSection(ctx, `SQ${m[1]}`);
  // AARN(A세트 NEW) → AAR 합성 stats / AARO(A세트 OLD) → AARO stats
  if (label === "AARN") return fromStats(ctx, "AAR");
  if (label === "AARO") return fromStats(ctx, "AARO");
  // SSRN1/2/3(S세트 NEW) → SSR 트랙 / SSRO1/2/3(S세트 OLD) → SSRO 트랙
  m = label.match(/^SSRN([123])$/);
  if (m) return fromSection(ctx, `SSR${m[1]}`);
  m = label.match(/^SSRO([123])$/);
  if (m) return fromSection(ctx, `SSRO${m[1]}`);
  // OLD/NEW(G3 등 다른 테이블) 및 그 외(허니비/W111/NC/6MX/G(H1)): 위치만
  return null;
}

// 테이블 정의 + 실데이터 → 값이 채워진 data
function withLiveData(base, ctx) {
  const keys = ["wait", "pick", "stage1", "pct", "rec", "rec2", "assist", "assistSource", "wait2", "pct2", "assistRec", "stage", "idx1", "idx2",
    "qAssist", "qAssistSource", "qWait2", "qPct2",
    "qrec", "qstage", "qidx1", "qidx2",
    "idx1Zone", "qidx1Zone"];
  const out = { ...base };
  keys.forEach((k) => { out[k] = base.name.map(() => ""); });
  out.waitBg = base.name.map(() => "");
  out.pctBg = base.name.map(() => "");
  const markWaitHit = new Map();
  const markWaitMiss = new Map();
  const markPct = new Map();
  const gobMarks = ctx.roundState?.gob_marks || {};
  (gobMarks.H1 || []).forEach((key) => addGobBg(markWaitHit, gobLabelOf(key), GOB_TOP_BG));
  (gobMarks.H0 || []).forEach((key) => addGobBg(markWaitMiss, gobLabelOf(key), GOB_LOW_BG));
  (gobMarks.PCT1 || []).forEach((key) => addGobBg(markPct, gobLabelOf(key), GOB_TOP_BG));
  (gobMarks.PCT0 || []).forEach((key) => addGobBg(markPct, gobLabelOf(key), GOB_LOW_BG));
  out.waitSourceMarks = base.name.map(() => []);
  out.pctSourceMarks = base.name.map(() => []);
  const subgameSrnKeys = new Set(["허니SRN", "위너SRN", "메가SRN", "드림SRN", "NCSRN"]);
  const subgameSroKeys = new Set(["허니SRO", "위너SRO", "메가SRO", "드림SRO", "NCSRO"]);
  const addSourceMark = (target, src, key, label) => {
    const selected = src?.tie === "x" ? src?.x : src?.tie === "xr" ? src?.xr : null;
    if (!selected) return;
    base.name.forEach((name, idx) => {
      if (name === selected) target[idx] = [...(target[idx] || []), { key, label }];
    });
  };
  Object.entries(ctx.roundState?.xx_sources || {}).forEach(([key, src]) => {
    if (!src?.x || !src?.xr) return;
    if (key === "AAR" || /^SSRN[123]$/.test(key) || subgameSrnKeys.has(key)) {
      addSourceMark(out.waitSourceMarks, src, key, key === "AAR" ? "AARN" : key);
    } else if (key === "AARO" || /^SSRO[123]$/.test(key) || subgameSroKeys.has(key)) {
      addSourceMark(out.pctSourceMarks, src, key, key);
    }
  });
  base.name.forEach((label, i) => {
    if (!label) return; // 빈 컬럼
    if (markPct.has(label)) out.pctBg[i] = markPct.get(label);
    const rd = buildColData(label, i, base, ctx);
    if (!rd) return;
    keys.forEach((k) => { if (rd[k] != null) out[k][i] = rd[k]; });
    const waitValue = String(out.wait[i] || "");
    if (markWaitHit.has(label) && waitValue.endsWith("H")) {
      out.waitBg[i] = markWaitHit.get(label);
    } else if (markWaitMiss.has(label) && waitValue.endsWith("M")) {
      out.waitBg[i] = markWaitMiss.get(label);
    }
  });
  return out;
}

export default function GhStrategyBoard({ roundState }) {
  const hasData = !!roundState?.sections;
  const ctx = { roundState };
  const tables = [G1, G2, G3, G4].map((t) => (hasData ? withLiveData(t, ctx) : t));
  return (
    <Box sx={{ overflowX: "auto", mb: 2 }}>
      <Box sx={{ display: "inline-block", backgroundColor: "#000" }}>
        {tables.map((t, idx) => <StrategyTable key={idx} data={t} />)}
      </Box>
    </Box>
  );
}
