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

// 단순(병합 없음) 행. 빈값은 회색 대시(–). label 있으면 맨 앞 라벨 셀.
function SimpleRow({ data, dataKey, render, pos, label, labelColor }) {
  const bgKey = `${dataKey}Bg`;
  return (
    <tr>
      {label != null && <LblCell text={label} color={labelColor} edge={pos === "last" ? "last" : undefined} />}
      {data.name.map((n, i) => {
        const v = (data[dataKey] || [])[i] || "";
        const bg = (data[bgKey] || [])[i];
        const sx = { ...tdSx, ...(bg ? { backgroundColor: bg } : {}), ...edgeStyle(data, i, pos) };
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
function AssistRow({ data, pos, label, labelColor }) {
  return (
    <tr>
      {label != null && <LblCell text={label} color={labelColor} edge={pos === "last" ? "last" : undefined} />}
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
                {data.sourceMarks?.[i] && (
                  <Box component="span" sx={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: "#00e676", display: "inline-block" }} />
                )}
              </Box>
            </Box>
          ))}
        </tr>
      </thead>
      <tbody>
        <SimpleRow data={data} dataKey="wait" render={waitCell} pos="mid" label="연속" />
        <SimpleRow data={data} dataKey="pick" render={(v) => <Chip v={v} />} pos="mid" label="생성" />
        <SimpleRow data={data} dataKey="stage1" render={(v) => <span style={{ color: "#e0e0e0" }}>{v}</span>} pos="mid" label="단계-AS" />
        <SimpleRow data={data} dataKey="pct" render={(v) => <span style={{ color: "#69f0ae", fontWeight: "bold" }}>{v}</span>} pos="mid" label="적중율" />
        <SimpleRow data={data} dataKey="rec" render={(v) => <span style={{ color: "#eaeaea" }}>{recHTML(v)}</span>} pos="mid" label="총전적" />
        <SimpleRow data={data} dataKey="rec2" render={(v) => <span>{rec2HTML(v)}</span>} pos="mid" label="최다" />
        <AssistRow data={data} pos="mid" label="어시H픽" labelColor={LBL_RED} />
        <SimpleRow data={data} dataKey="wait2" render={waitCell} pos="mid" label="연속" labelColor={LBL_RED} />
        <SimpleRow data={data} dataKey="pct2" render={(v) => <span style={{ color: "#69f0ae", fontWeight: "bold" }}>{v}</span>} pos="mid" label="적중율" labelColor={LBL_RED} />
        <SimpleRow data={data} dataKey="assistRec" render={(v) => <span style={{ color: "#eaeaea" }}>{recHTML(v)}</span>} pos="mid" label="총전적" labelColor={LBL_RED} />
        <SimpleRow data={data} dataKey="stage" render={(v) => <span style={{ color: "#e0e0e0" }}>{v}</span>} pos="mid" label="단계-AS" labelColor={LBL_RED} />
        <SimpleRow data={data} dataKey="idx1" render={(v) => <span style={{ color: "#fff", fontWeight: "bold" }}>{v}</span>} pos="mid" label="회차P" labelColor={LBL_RED} />
        <SimpleRow data={data} dataKey="idx2" render={(v) => <span style={{ color: String(v).startsWith("-") ? "#ef5350" : "#2e9e5b", fontWeight: "bold" }}>{v}</span>} pos="mid" label="누적P" labelColor={LBL_RED} />
        <SimpleRow data={data} dataKey="qAssist" render={(v) => <PickText v={v} />} pos="mid" label="어시Q픽" labelColor={LBL_RED} />
        <SimpleRow data={data} dataKey="qWait2" render={waitCell} pos="mid" label="연속" labelColor={LBL_RED} />
        <SimpleRow data={data} dataKey="qPct2" render={(v) => <span style={{ color: "#69f0ae", fontWeight: "bold" }}>{v}</span>} pos="mid" label="적중율" labelColor={LBL_RED} />
        {/* 쿼터 블록 */}
        <SimpleRow data={data} dataKey="qrec" render={(v) => <span style={{ color: "#eaeaea" }}>{recHTML(v)}</span>} pos="mid" label="쿼터전적" />
        <SimpleRow data={data} dataKey="qstage" render={(v) => <span style={{ color: "#e0e0e0" }}>{v}</span>} pos="mid" label="단계-AS" />
        <SimpleRow data={data} dataKey="qidx1" render={(v) => <span style={{ color: "#fff", fontWeight: "bold" }}>{v}</span>} pos="mid" label="쿼터P" />
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
const GOB_KEY_TO_LABEL = {
  S1: "S1", S2: "S2", S3: "S3",
  SR1: "S1R", SR2: "S2R", SR3: "S3R",
  SSR1: "SSRN1", SSR2: "SSRN2", SSR3: "SSRN3",
  SSRO1: "SSRO1", SSRO2: "SSRO2", SSRO3: "SSRO3",
  FOR1: "FOR1", FOR2: "FOR2", FOR3: "FOR3",
  FORX1: "FOR1X", FORX2: "FOR2X", FORX3: "FOR3X",
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
const quarterRow = (q, amounts) => {
  if (!q) return {};
  return {
    qrec: `${q.total_q ?? 0}-${q.win_q ?? 0}/${q.lose_q ?? 0}`,
    qstage: fmtStage(q.martin_step, 0),
    qidx1: fmtMan(betAt(amounts, q.martin_step)),
    qidx2: fmtMan(q.pnl),
  };
};
const quarterAssistRow = (q, pick) => {
  if (!q) return {};
  const total = q.total_q ?? 0;
  return {
    qAssist: q.next_action === "wait" ? "W" : (pick || ""),
    qWait2: fmtStreak(q.cur_streak?.type, q.cur_streak?.count),
    qPct2: fmtPct(q.win_q ?? 0, total),
  };
};

// stats 키 기반 행 데이터 (A/AR/AAR/AARO/D/G/TN/ONE/TWO/P/B/J)
const fromStats = (ctx, key) => {
  const s = ctx.stats?.[key];
  if (!s) return null;
  const total = s.total ?? 0;
  if (total === 0 && !ctx.nextPicks?.[key]) return null;
  const amounts = amountsFor(ctx, key);
  const as = ctx.assistStats?.[key];
  const assistTotal = as?.total ?? 0;
  return {
    wait: fmtStreak(s.cur_streak_type, s.cur_streak_count),
    pick: ctx.nextPicks?.[key] || "",
    assist: ctx.assistNextPicks?.[key] || ctx.nextPicks?.[key] || "",
    wait2: as ? fmtStreak(as.cur_streak_type, as.cur_streak_count) : undefined,
    pct2: as ? fmtPct(as.hit ?? 0, assistTotal) : undefined,
    assistRec: as ? fmtRec(assistTotal, as.hit ?? 0, as.miss ?? 0) : undefined,
    pct: fmtPct(s.hit ?? 0, total),
    rec: fmtRec(total, s.hit ?? 0, s.miss ?? 0),
    rec2: fmtRec2(s.max_hit_streak ?? 0, s.max_miss_streak ?? 0),
    stage1: fmtStage(s.martin_step, s.triple_loss),   // 생성(원래픽) 단계
    stage: fmtStage(s.martin_step, s.triple_loss),    // 어시스트 단계 (임시: 동일)
    idx1: fmtMan(betAt(amounts, s.martin_step)),
    idx2: fmtMan(s.pnl),
    // 어시Q픽은 별도 행 데이터로 두되, 실제 어시Q 로직 전까지는 생성 쿼터와 동일하게 표시한다.
    ...quarterAssistRow(s.quarter, ctx.nextPicks?.[key] || ""),
    ...quarterRow(s.quarter, amounts),
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
    stage1: fmtStage(sm.martin_step, sm.triple_loss),
    stage: fmtStage(sm.martin_step, sm.triple_loss),
    idx1: fmtMan(betAt(amounts, sm.martin_step)),
    idx2: fmtMan(sm.pnl),
    ...quarterAssistRow(sm.quarter, cur?.predict || ""),
    ...quarterRow(sm.quarter, amounts),
  };
};

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
  // FOR1X/2X/3X (G2) — 전 도막 반대픽 트랙(sxTracks) sc1/2/3
  let m = label.match(/^FOR([123])X$/);
  if (m) return fromTrack(ctx.sxTracks, `sc${m[1]}`, amountsFor(ctx, `FOR${m[1]}X`));
  // FOR1/2/3 (G4) — 전 도막 따라가기 트랙(forTracks) sc1/2/3
  m = label.match(/^FOR([123])$/);
  if (m) return fromTrack(ctx.forTracks, `sc${m[1]}`, amountsFor(ctx, `FOR${m[1]}`));
  // S1R/S2R/S3R (G1) — SR 트랙 (S1보다 먼저 매치)
  m = label.match(/^S([123])R$/);
  if (m) return fromTrack(ctx.srTracks, `sc${m[1]}`, amountsFor(ctx, `S${m[1]}`));
  // S1/S2/S3 (G1 메인) — S 트랙 (회차배팅). 260628 SQ→S 리네임
  m = label.match(/^S([123])$/);
  if (m) return fromTrack(ctx.sqTracks, `sc${m[1]}`, amountsFor(ctx, `S${m[1]}`));
  // SQ1/2/3 (G4) — 쿼터배팅. 픽/연속/적중율/전적은 S와 동일(같은 트랙).
  //   쿼터 블록(쿼터전적/단계/쿼터P/누적P)은 quarterTracks(3회묶음 1승 판정).
  m = label.match(/^SQ([123])$/);
  if (m) {
    const sc = `sc${m[1]}`;
    const base = fromTrack(ctx.sqTracks, sc, amountsFor(ctx, `S${m[1]}`)) || {};
    const q = ctx.quarterTracks?.[sc]?.summary;
    if (q) {
      const amts = amountsFor(ctx, `SQ${m[1]}`);
      base.qrec = `${q.total_q ?? 0}-${q.win_q ?? 0}/${q.lose_q ?? 0}`;
      base.qstage = fmtStage(q.martin_step, 0);
      base.qidx1 = fmtMan(betAt(amts, q.martin_step));
      base.qidx2 = fmtMan(q.pnl);
      Object.assign(base, quarterAssistRow(q, base.pick || ""));
    }
    return base;
  }
  // AARN(A세트 NEW) → AAR 합성 stats / AARO(A세트 OLD) → AARO stats
  if (label === "AARN") return fromStats(ctx, "AAR");
  if (label === "AARO") return fromStats(ctx, "AARO");
  // SSRN1/2/3(S세트 NEW) → SSR 트랙 / SSRO1/2/3(S세트 OLD) → SSRO 트랙
  m = label.match(/^SSRN([123])$/);
  if (m) return fromTrack(ctx.ssrTracks, `sc${m[1]}`, amountsFor(ctx, `SSR${m[1]}`));
  m = label.match(/^SSRO([123])$/);
  if (m) return fromTrack(ctx.ssroTracks, `sc${m[1]}`, amountsFor(ctx, `SSR${m[1]}`));
  // OLD/NEW(G3 등 다른 테이블) 및 그 외(허니비/W111/NC/6MX/G(H1)): 위치만
  return null;
}

// 테이블 정의 + 실데이터 → 값이 채워진 data
function withLiveData(base, ctx) {
  const keys = ["wait", "pick", "stage1", "pct", "rec", "rec2", "assist", "wait2", "pct2", "assistRec", "stage", "idx1", "idx2",
    "qAssist", "qWait2", "qPct2",
    "qrec", "qstage", "qidx1", "qidx2"];
  const out = { ...base };
  keys.forEach((k) => { out[k] = base.name.map(() => ""); });
  out.waitBg = base.name.map(() => "");
  out.pctBg = base.name.map(() => "");
  const markWaitHit = new Map();
  const markWaitMiss = new Map();
  const markPct = new Map();
  (ctx.gobMarks?.H1 || []).forEach((key) => addGobBg(markWaitHit, gobLabelOf(key), GOB_TOP_BG));
  (ctx.gobMarks?.H0 || []).forEach((key) => addGobBg(markWaitMiss, gobLabelOf(key), GOB_LOW_BG));
  (ctx.gobMarks?.PCT1 || []).forEach((key) => addGobBg(markPct, gobLabelOf(key), GOB_TOP_BG));
  (ctx.gobMarks?.PCT0 || []).forEach((key) => addGobBg(markPct, gobLabelOf(key), GOB_LOW_BG));
  out.sourceMarks = base.name.map(() => false);
  const markByPair = new Map();
  Object.entries(ctx.xxSources || {}).forEach(([key, src]) => {
    const pairKey = `${src?.x || ""}|${src?.xr || ""}`;
    if (!src?.x || !src?.xr) return;
    if (!/RN$|AAR$|SSRN[123]$/.test(key)) return;
    if (!markByPair.has(pairKey)) markByPair.set(pairKey, src);
  });
  markByPair.forEach((src) => {
    const selected = src?.tie === "x" ? src?.x : src?.tie === "xr" ? src?.xr : null;
    if (!selected) return;
    base.name.forEach((label, i) => {
      if (label === selected) out.sourceMarks[i] = true;
    });
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
    // ── 어시스트 기반 행 (임시: 어시스트=원래픽이라 원래 값과 동일) ──
    //   stage·idx1·idx2는 어시스트 기준. 실제 어시스트 로직 붙으면 assist_* 값만 교체.
    if (rd.assist == null && rd.pick != null) out.assist[i] = rd.pick;      // 어시스트 픽
    if (rd.wait2 == null && rd.wait != null) out.wait2[i] = rd.wait;        // 어시스트 연속
    if (rd.pct2 == null && rd.pct != null) out.pct2[i] = rd.pct;            // 어시스트 적중율
    if (rd.assistRec == null && rd.rec != null) out.assistRec[i] = rd.rec;   // 어시스트 총전적
    if (rd.assist_stage != null) out.stage[i] = rd.assist_stage;
    if (rd.assist_idx1 != null) out.idx1[i] = rd.assist_idx1;
    if (rd.assist_idx2 != null) out.idx2[i] = rd.assist_idx2;
  });
  return out;
}

export default function GhStrategyBoard({ stats, nextPicks, assistNextPicks, assistStats, sqTracks, srTracks, ssrTracks, ssroTracks, sxTracks, forTracks, quarterTracks, betAmounts, betAmountsMap, xxSources, gobMarks }) {
  const hasData = !!(stats || sqTracks);
  const ctx = { stats, nextPicks, assistNextPicks, assistStats, sqTracks, srTracks, ssrTracks, ssroTracks, sxTracks, forTracks, quarterTracks, betAmounts, betAmountsMap, xxSources, gobMarks };
  const tables = [G1, G2, G3, G4].map((t) => (hasData ? withLiveData(t, ctx) : t));
  return (
    <Box sx={{ overflowX: "auto", mb: 2 }}>
      <Box sx={{ display: "inline-block", backgroundColor: "#000" }}>
        {tables.map((t, idx) => <StrategyTable key={idx} data={t} />)}
      </Box>
    </Box>
  );
}
