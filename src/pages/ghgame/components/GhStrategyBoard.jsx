import { Box } from "@mui/material";

// ── 전략별 현황 전광판 (design-260615-gh-calc.html 포팅, 테이블만) ──
// 행: 전략명 / 대기(H 녹·M 노랑) / 픽(P·B 칩) / 단계 / 픽번호 / 적중률% / 번호2 / 전적 / 보조
// ①단 G1: 값 채움 / ②단 G2·③단 G3: 위치만(빈칸)

const COLOR = {
  A: "#0066fe", AR: "#c0504d", SQ1: "#0063d6", SQ2: "#0063d6", SQ3: "#0063d6",
  S1: "#0063d6", S2: "#0063d6", S3: "#0063d6",
  SR1: "#c0504d", SR2: "#c0504d", SR3: "#c0504d",
  SX1: "#0063d6", SX2: "#0063d6", SX3: "#0063d6", D: "#c0504d", G: "#0063d6",
  허니비: "#c0504d", pattern: "#00a11a", "6MX": "#de6a08",
};
const colorOf = (n) => COLOR[n] || (n.endsWith("R") ? "#c0504d" : "#0063d6");

const G1 = {
  // A AR | SQ1 SQ2 SQ3 | S1 SR1 | S2 SR2 | S3 SR3 | SX1 SX2 SX3 | D G
  // S1/S2/S3 = SQ1/SQ2/SQ3와 같은 값(라벨만 다름). S+SR이 한 묶음(병합).
  name: ["A", "AR", "SQ1", "SQ2", "SQ3", "S1", "SR1", "S2", "SR2", "S3", "SR3", "SX1", "SX2", "SX3", "D", "G"],
  // 그룹 구분선: SQ1(2), S1(5), SX1(11), D(14)
  gstart: new Set([2, 5, 11, 14]),
  // R쌍 병합(stage/idx 셀): A(0)+AR / S1(5)+SR1 / S2(7)+SR2 / S3(9)+SR3
  mergeAt: new Set([0, 5, 7, 9]),
  // 노란 박스: A+AR / SQ1·SQ2·SQ3 개별 / S1+SR1 / S2+SR2 / S3+SR3 / SX·D·G 개별
  hlRanges: [[0, 1], [2, 2], [3, 3], [4, 4], [5, 6], [7, 8], [9, 10], [11, 11], [12, 12], [13, 13], [14, 14], [15, 15]],
  // stage/idx1/idx2 = 픽 미산출(디자인 더미). 병합 자리(A·S1·S2·S3)에만 값, 옆칸은 빈칸.
  //          A     AR  SQ1     SQ2     SQ3     S1      SR1 S2      SR2 S3      SR3 SX1   SX2   SX3   D   G
  stage: ["1S-1", "", "1S-1", "1S-1", "1S-1", "1S-0", "", "1S-0", "", "1S-2", "", "1S", "1S", "1S", "", ""],
  idx1: ["10000.5", "", "10000", "10001", "10002", "10007", "", "10007", "", "10007", "", "10007", "10008", "10009", "", ""],
  idx2: ["10000", "", "10002", "10003", "10004", "10005", "", "10005", "", "10005", "", "10008", "10009", "10010", "", ""],
};
const G2 = {
  name: ["TN", "ONE", "TWO", "P", "B", "J", "6MX", "허니비", "허니R", "W111", "위너R", "M22", "메가R", "D122", "드림R", "pattern"],
  gstart: new Set([7, 9, 11, 13, 15]),
  hlRanges: [[0, 0], [1, 1], [2, 2], [3, 3], [4, 4], [5, 5], [6, 6], [7, 8], [9, 10], [11, 12], [13, 14], [15, 15]],
};
const G3 = {
  name: ["N1", "N1R", "N2", "N2R", "N3", "N3R", "N4", "N4R", "N5", "N5R", "N6", "N6R", "N7", "N7R", "N8", "N8R"],
  gstart: new Set([2, 4, 6, 8, 10, 12, 14]),
  hlRanges: [[0, 1], [2, 3], [4, 5], [6, 7], [8, 9], [10, 11], [12, 13], [14, 15]],
};

const MERGE = { stage: 1, idx1: 1, idx2: 1 };
const HL = "#ffd54f";
const GSEP = "2px solid #9a9a9a";
const BASE = "1px solid #555";

// 셀의 노란 박스/그룹선 테두리 계산 (디자인 edgeCls 포팅)
function edgeStyle(data, i, pos, span = 1) {
  const end = i + span - 1;
  const st = {};
  if (data.gstart && data.gstart.has(i)) st.borderLeft = GSEP;
  (data.hlRanges || []).forEach(([a, b]) => {
    if (end >= a && i <= b) {
      if (i <= a) st.borderLeft = `3px solid ${HL}`;
      if (end >= b) st.borderRight = `3px solid ${HL}`;
      if (pos === "head") st.borderTop = `3px solid ${HL}`;
      if (pos === "last") st.borderBottom = `3px solid ${HL}`;
    }
  });
  return st;
}

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

// 병합(stage/idx1/idx2) 처리 행
function MergeRow({ data, dataKey, render, pos }) {
  const names = data.name;
  const arr = data[dataKey] || [];
  const cells = [];
  for (let i = 0; i < names.length; i++) {
    const v = arr[i] || "";
    if (MERGE[dataKey] && v && data.mergeAt && data.mergeAt.has(i) && (arr[i + 1] === "" || arr[i + 1] === undefined) && i + 1 < names.length) {
      cells.push(<Box component="td" key={i} colSpan={2} sx={{ ...tdSx, ...edgeStyle(data, i, pos, 2) }}>{render(v)}</Box>);
      i++;
    } else if (v === "") {
      cells.push(<Box component="td" key={i} sx={{ ...tdSx, color: dimColor, ...edgeStyle(data, i, pos, 1) }}>–</Box>);
    } else {
      cells.push(<Box component="td" key={i} sx={{ ...tdSx, ...edgeStyle(data, i, pos, 1) }}>{render(v)}</Box>);
    }
  }
  return <tr>{cells}</tr>;
}

// 단순(병합 없음) 행
function SimpleRow({ data, dataKey, render, pos }) {
  return (
    <tr>
      {data.name.map((n, i) => {
        const v = (data[dataKey] || [])[i] || "";
        const sx = { ...tdSx, ...edgeStyle(data, i, pos, 1) };
        return v
          ? <Box component="td" key={i} sx={sx}>{render(v)}</Box>
          : <Box component="td" key={i} sx={{ ...sx, color: dimColor }}>–</Box>;
      })}
    </tr>
  );
}

function StrategyTable({ data }) {
  return (
    <Box component="table" sx={{ borderCollapse: "collapse", backgroundColor: "#000", tableLayout: "fixed", width: 1000 }}>
      <thead>
        <tr>
          {data.name.map((n, i) => (
            <Box component="th" key={i} sx={{ ...thSx, color: colorOf(n), backgroundColor: "#000", ...edgeStyle(data, i, "head", 1) }}>{n}</Box>
          ))}
        </tr>
      </thead>
      <tbody>
        <SimpleRow data={data} dataKey="wait" render={waitCell} pos="mid" />
        <SimpleRow data={data} dataKey="pick" render={(v) => <Chip v={v} />} pos="mid" />
        <MergeRow data={data} dataKey="stage" render={(v) => <span style={{ color: "#e0e0e0" }}>{v}</span>} pos="mid" />
        <MergeRow data={data} dataKey="idx1" render={(v) => <span style={{ color: "#fff" }}>{v}</span>} pos="mid" />
        <SimpleRow data={data} dataKey="pct" render={(v) => <span style={{ color: "#69f0ae", fontWeight: "bold" }}>{v}</span>} pos="mid" />
        <MergeRow data={data} dataKey="idx2" render={(v) => <span style={{ color: String(v).startsWith("-") ? "#ef5350" : "#69f0ae" }}>{v}</span>} pos="mid" />
        <SimpleRow data={data} dataKey="rec" render={(v) => <span style={{ color: "#eaeaea" }}>{recHTML(v)}</span>} pos="mid" />
        <SimpleRow data={data} dataKey="rec2" render={(v) => <span>{rec2HTML(v)}</span>} pos="last" />
      </tbody>
    </Box>
  );
}

// ── 실데이터 채우기 ──
// 픽까지(대기=streak / 픽 / 승률 / 전적)만 채움. stage·idx1·idx2는 디자인값 유지.
const fmtStreak = (type, count) => {
  if (!type || !count) return "";
  return `${count}${type === "hit" ? "H" : "M"}`;
};
const fmtPct = (hit, total) => (total > 0 ? `${(hit / total * 100).toFixed(1)}%` : "");
// 전적: {전}-{승}/{패} (recHTML이 승=초록·패=노랑 파싱)
const fmtRec = (total, hit, miss) => `${total}-${hit}/${miss}`;
// 보조: 최대연승-최대연패
const fmtRec2 = (mh, mm) => `${mh}-${mm}`;
// 단계: {마틴단계}S-{3연패수}
const fmtStage = (step, triple) => (step ? `${step}S-${triple ?? 0}` : "");
// 배팅액/PnL: 이미 만원 단위(1=1만원, 0.1=1천원). 0이면 "0", 정수 아니면 소수1자리.
const fmtMan = (man) => {
  if (man === null || man === undefined) return "";
  const v = Math.round((man || 0) * 10) / 10;
  if (v === 0) return "0";
  return Number.isInteger(v) ? `${v}` : `${v.toFixed(1)}`;
};
// 단계별 배팅액 조회 (전략별 amounts, 없으면 공용 폴백)
const betAt = (amounts, step) => {
  if (!amounts || !step) return null;
  const idx = step - 1;
  return idx >= 0 && idx < amounts.length ? amounts[idx] : null;
};
// 전략키별 amounts 조회 (만원 단위). 셋업 없으면 undefined → 빈칸.
const amountsFor = (ctx, stratKey) => ctx.betAmountsMap && ctx.betAmountsMap[stratKey];

// stats 키 기반 행 데이터
const fromStats = (stats, nextPicks, key, amounts) => {
  const s = stats?.[key];
  if (!s) return null;
  const total = s.total ?? 0;
  return {
    wait: fmtStreak(s.cur_streak_type, s.cur_streak_count),
    pick: nextPicks?.[key] || "",
    stage: fmtStage(s.martin_step, s.triple_loss),
    idx1: fmtMan(betAt(amounts, s.martin_step)),
    pct: fmtPct(s.hit ?? 0, total),
    idx2: fmtMan(s.pnl),
    rec: fmtRec(total, s.hit ?? 0, s.miss ?? 0),
    rec2: fmtRec2(s.max_hit_streak ?? 0, s.max_miss_streak ?? 0),
    pnl: s.pnl ?? 0,
  };
};
// 트랙(sq/sr/ssr/sx) sc# 기반 행 데이터
const fromTrack = (tracks, scKey, amounts) => {
  const t = tracks?.[scKey];
  const sm = t?.summary;
  if (!sm) return null;
  const total = (sm.total_hit ?? 0) + (sm.total_miss ?? 0);
  // 트랙 픽: 현재 라운드(current) 셀의 predict
  const cur = (t.round_data || []).find((r) => r.status === "current");
  return {
    wait: fmtStreak(sm.cur_streak?.type, sm.cur_streak?.count),
    pick: cur?.predict || "",
    stage: fmtStage(sm.martin_step, sm.triple_loss),
    idx1: fmtMan(betAt(amounts, sm.martin_step)),
    pct: fmtPct(sm.total_hit ?? 0, total),
    idx2: fmtMan(sm.pnl),
    rec: fmtRec(total, sm.total_hit ?? 0, sm.total_miss ?? 0),
    rec2: fmtRec2(sm.max_hit_streak ?? 0, sm.max_miss_streak ?? 0),
    pnl: sm.pnl ?? 0,
  };
};

// G1/G2 이름 → 실데이터 행. 매핑 없으면 null(디자인값 유지 안 하고 빈칸 처리).
function buildRowData(name, ctx) {
  const { stats, nextPicks, sqTracks, srTracks, ssrTracks, sxTracks } = ctx;
  // stats 직접 매핑되는 섹션 (P/B 포함 — 서버가 60% 비율 기준으로 round/next 픽 산출)
  const STAT_KEYS = { A: "A", AR: "AR", AAR: "AAR", D: "D", G: "G", TN: "TN", ONE: "ONE", TWO: "TWO", J: "J", P: "P", B: "B" };
  if (STAT_KEYS[name]) {
    const key = STAT_KEYS[name];
    return fromStats(stats, nextPicks, key, amountsFor(ctx, key));  // 전략키별 amounts
  }
  // SSR/SR을 S보다 먼저 매칭(S1이 SR1보다 앞서지 않게). S1/S2/S3 = SQ(sc#)와 동일.
  const M = name.match(/^(SQ|SSR|SR|SX|S)([123])$/);
  if (M) {
    const sc = `sc${M[2]}`;
    const tracks = { SQ: sqTracks, S: sqTracks, SR: srTracks, SSR: ssrTracks, SX: sxTracks }[M[1]];
    // 전략키: S→SQ로 정규화(같은 sc 트랙). SR은 박스 없음 → 폴백.
    const stratKey = ({ S: "SQ", SQ: "SQ", SSR: "SSR", SX: "SX" }[M[1]] || M[1]) + M[2];
    return fromTrack(tracks, sc, amountsFor(ctx, stratKey));
  }
  return null;
}

// base(디자인 data)에 실데이터 덮어쓰기 — wait/pick/stage/pct/rec.
// stage는 병합 구조 표현이라, 데이터 없는 행은 base 더미값을 유지(비우지 않음).
function withLiveData(base, ctx) {
  const wait = [...(base.wait || base.name.map(() => ""))];
  const pick = [...(base.pick || base.name.map(() => ""))];
  const stage = [...(base.stage || base.name.map(() => ""))];
  const idx1 = [...(base.idx1 || base.name.map(() => ""))];
  const pct = [...(base.pct || base.name.map(() => ""))];
  const idx2 = [...(base.idx2 || base.name.map(() => ""))];
  const rec = [...(base.rec || base.name.map(() => ""))];
  const rec2 = [...(base.rec2 || base.name.map(() => ""))];
  // 병합(colSpan) 행: 병합 시작칸(mergeAt)에만 값, 옆칸은 빈칸. 단독칸은 그대로.
  const setMerged = (arr, i, val) => {
    const isPair = base.mergeAt && (base.mergeAt.has(i) || base.mergeAt.has(i - 1));
    if (!isPair || base.mergeAt.has(i)) arr[i] = val;
    else arr[i] = ""; // 병합 옆칸 → 비움
  };
  // 병합 셀(단계/배팅액/PnL)은 합성 전략 값으로 표시:
  //   A+AR 칸 → AAR / S1+SR1 → SSR1 / S2+SR2 → SSR2 / S3+SR3 → SSR3
  const MERGE_SOURCE = { A: "AAR", S1: "SSR1", S2: "SSR2", S3: "SSR3" };
  base.name.forEach((nm, i) => {
    const rd = buildRowData(nm, ctx);
    if (!rd) { // 데이터 없는 행: 비병합 행만 비우고 stage/idx(병합 더미)는 유지
      wait[i] = ""; pick[i] = ""; pct[i] = ""; rec[i] = ""; rec2[i] = "";
      return;
    }
    wait[i] = rd.wait; pick[i] = rd.pick; pct[i] = rd.pct; rec[i] = rd.rec; rec2[i] = rd.rec2;
    // 병합 시작칸이면 stage/idx는 합성 전략(AAR/SSR#) 값으로
    const src = MERGE_SOURCE[nm];
    const md = (src && buildRowData(src, ctx)) || rd;
    setMerged(stage, i, md.stage);
    setMerged(idx1, i, md.idx1);
    setMerged(idx2, i, md.idx2);
  });
  return { ...base, wait, pick, stage, idx1, pct, idx2, rec, rec2 };
}

export default function GhStrategyBoard({ stats, nextPicks, sqTracks, srTracks, ssrTracks, sxTracks, betAmounts, betAmountsMap }) {
  const hasData = !!(stats || sqTracks);
  const ctx = { stats, nextPicks, sqTracks, srTracks, ssrTracks, sxTracks, betAmounts, betAmountsMap };
  const g1 = hasData ? withLiveData(G1, ctx) : G1;
  const g2 = hasData ? withLiveData(G2, ctx) : G2;
  return (
    <Box sx={{ overflowX: "auto", mb: 2 }}>
      <Box sx={{ display: "inline-block", backgroundColor: "#000" }}>
        <StrategyTable data={g1} />
        <StrategyTable data={g2} />
        <StrategyTable data={G3} />
      </Box>
    </Box>
  );
}
