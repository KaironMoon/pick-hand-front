import { useState } from "react";
import { Box } from "@mui/material";

// ── SQ / SSR / SX 로드 (design-260615-gh-calc.html 포팅, 로드만) ──
// 헤더: 이름 / 단계(H 녹·M 적) / 승률 / 전적 · 39열 × 2행 회차 셀
// 적중 초록·미적 노랑·현재 흰 · P 파랑·B 빨강 · triset: 3칸마다 흰 세로선

const COLOR = {
  SQ1: "#0063d6", SQ2: "#0063d6", SQ3: "#0063d6",
  SSR1: "#0063d6", SSR2: "#0063d6", SSR3: "#0063d6",
  SX1: "#0063d6", SX2: "#0063d6", SX3: "#0063d6",
  P: "#0063d6", B: "#c0504d", J: "#0063d6",
  D: "#c0504d", G: "#0063d6", TN: "#0063d6", ONE: "#0063d6", TWO: "#0063d6",
};
const colorOf = (n) => COLOR[n] || (n.endsWith("R") ? "#c0504d" : "#0063d6");

// SQ 데모(정적) — gh_tracks 없을 때 폴백
const SQ_DEMO = [
  { name: "SQ1", step: "1H", pct: "45.5%", rec: "10/12", filled: 23, pctBg: "#ffeb3b", offset: 0, triset: true },
  { name: "SQ2", step: "4M", pct: "47.6%", rec: "10/11", filled: 24, pctBg: "#ff9800", offset: 1, triset: true },
  { name: "SQ3", step: "1H", pct: "55.0%", rec: "11/9", filled: 25, pctBg: "#ff9800", offset: 2, triset: true },
];
const SSR = [
  { name: "SSR1", step: "1H", pct: "46.2%", rec: "10/12", filled: 22, pctBg: "#ffeb3b", offset: 0, triset: true },
  { name: "SSR2", step: "4M", pct: "48.1%", rec: "11/11", filled: 23, pctBg: "#ff9800", offset: 1, triset: true },
  { name: "SSR3", step: "1H", pct: "52.0%", rec: "11/10", filled: 24, pctBg: "#ff9800", offset: 2, triset: true },
];
const SX = [
  { name: "SX1", step: "1H", pct: "44.8%", rec: "9/12", filled: 21, pctBg: "#ffeb3b", offset: 0, triset: true },
  { name: "SX2", step: "4M", pct: "47.4%", rec: "10/11", filled: 22, pctBg: "#ff9800", offset: 1, triset: true },
  { name: "SX3", step: "1H", pct: "53.3%", rec: "11/9", filled: 23, pctBg: "#ff9800", offset: 2, triset: true },
];

const rhSx = { border: "1px solid #666", borderRadius: "4px", textAlign: "center", fontWeight: "bold", padding: "1px 0", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center" };

// 서버 tracks(sc1/sc2/sc3) → 로드 행 데이터로 변환 (S1/S2/S3와 동일 로직)
// startRound: sc1=1, sc2=2, sc3=3 → 셀 인덱스 = round - startRound (offset과 동일)
// prefix: "SQ" | "SR" | "SSR" → 행 이름(SQ1.. / SR1.. / SSR1..)
const HIT_BG = "#2e9e5b";
const MISS_BG = "#ffeb3b";
const WAIT_BG = "#ffffff";
const tracksToRows = (tracks, prefix, pointApplied) => {
  if (!tracks) return null;
  const defs = [
    { name: `${prefix}1`, key: "sc1", offset: 0 },
    { name: `${prefix}2`, key: "sc2", offset: 1 },
    { name: `${prefix}3`, key: "sc3", offset: 2 },
  ];
  // 승률 등수 배경색 (S1/S2/S3 그리드와 동일 로직)
  //  - point 적용 시: total_score 기준 / 미적용: summary.rate 기준
  const metric = (key) => {
    const t = tracks[key];
    if (!t) return null;
    const sm = t.summary || {};
    const tot = (sm.total_hit ?? 0) + (sm.total_miss ?? 0);
    if (tot === 0) return null;
    return pointApplied ? (t.total_score ?? 0) : (sm.rate ?? 0);
  };
  const trackRates = defs
    .map((d) => ({ key: d.key, rate: metric(d.key) }))
    .filter((x) => x.rate !== null)
    .sort((a, b) => b.rate - a.rate);
  const rateBgByKey = (key) => {
    const idx = trackRates.findIndex((x) => x.key === key);
    if (idx === 0) return "#00e676"; // 1등 초록
    if (idx === 1) return "#ff9800"; // 2등 주황
    if (idx === 2) return "#ffeb3b"; // 3등 노랑
    return null;
  };
  return defs.map(({ name, key, offset }) => {
    const t = tracks[key];
    const cells = new Array(78).fill(null); // {pick, bg}
    const sm = t?.summary || {};
    for (const r of (t?.round_data || [])) {
      const idx = r.round - (offset + 1); // startRound = offset+1
      if (idx < 0 || idx >= 78) continue;
      if (r.status === "wait") {
        cells[idx] = { wait: true }; // SX 대기 구간 → "W"
        continue;
      }
      let bg = null;
      if (r.status === "hit") bg = HIT_BG;
      else if (r.status === "miss") bg = MISS_BG;
      else if (r.status === "current") bg = WAIT_BG;
      else if (r.status === "future") bg = "#1c1f25";
      cells[idx] = { pick: r.predict || null, bg };
    }
    const totalHit = sm.total_hit ?? 0;
    const totalMiss = sm.total_miss ?? 0;
    const tot = totalHit + totalMiss;
    const pct = tot > 0 ? `${(totalHit / tot * 100).toFixed(1)}%` : "-";
    const cs = sm.cur_streak || null;
    const step = cs ? `${cs.count}${cs.type === "hit" ? "H" : "M"}` : "";
    return { name, offset, triset: true, cells, step, pct, rec: `${totalHit}/${totalMiss}`, recHit: totalHit, recMiss: totalMiss, pctBg: rateBgByKey(key), stepType: cs?.type || null };
  });
};

// stats(round_picks + series) 기반 로드 1행 (P/B/J/D/G/TN/ONE/TWO 등 비-트랙 섹션).
// roundPicks[key]: 라운드별 픽(P/B/null). series: 라운드별 hit/miss/null. nextPick: 다음 라운드 픽.
const statsToRow = (name, key, stats, roundPicks, nextPick) => {
  const s = stats?.[key];
  const rp = roundPicks?.[key];
  if (!s || !rp) return null;
  const series = s.series || [];
  const cells = new Array(78).fill(null);
  const n = rp.length;
  for (let i = 0; i < n && i < 78; i++) {
    const pick = rp[i];
    if (!pick || pick === "wait") {
      cells[i] = { wait: true }; // 픽 없는 라운드(예: P/B 60% 미만) → W
      continue;
    }
    let bg = null;
    const st = series[i];
    if (st === "hit") bg = HIT_BG;
    else if (st === "miss") bg = MISS_BG;
    cells[i] = { pick, bg };
  }
  // 현재 라운드(다음 픽) = n번째 셀, 흰 배경. 픽 없으면 빈칸(강조 안 함).
  if (nextPick && n < 78) cells[n] = { pick: nextPick, bg: WAIT_BG };
  const total = s.total ?? 0;
  const cs = s.cur_streak_type ? { type: s.cur_streak_type, count: s.cur_streak_count } : null;
  return {
    name, offset: 0, triset: false, cells,
    step: cs ? `${cs.count}${cs.type === "hit" ? "H" : "M"}` : "",
    stepType: cs?.type || null,
    pct: total > 0 ? `${((s.hit ?? 0) / total * 100).toFixed(1)}%` : "-",
    rec: `${s.hit ?? 0}/${s.miss ?? 0}`, recHit: s.hit ?? 0, recMiss: s.miss ?? 0,
    pctBg: null,
  };
};

function RoadCell({ n, c, d }) {
  const off = d.offset || 0;
  let bg, content, color = "#777";
  if (d.cells) {
    // 실데이터 모드: 셀 인덱스 = (위행 n=c → c-1) / (아래행 n=c+39 → 39+c-1)
    const idx = n - 1;
    const cell = d.cells[idx];
    if (cell && cell.wait) {
      // 대기/픽없음 → W. 현재 라운드(흰 배경)면 글자 어둡게.
      bg = cell.bg || undefined;
      color = cell.bg === WAIT_BG ? "#333" : "#555";
      content = "W";
    } else if (cell && cell.pick) {
      bg = cell.bg;
      color = cell.pick === "P" ? "#1565d8" : "#e53935";
      content = cell.pick;
    } else if (cell && cell.bg === WAIT_BG) {
      bg = WAIT_BG;
      content = n + off;
    } else {
      content = n + off;
    }
  } else if (n <= d.filled) {
    bg = n % 3 === 0 ? MISS_BG : HIT_BG; // miss=노랑 / hit=초록
    const pk = n % 2 ? "P" : "B";
    color = pk === "P" ? "#1565d8" : "#e53935";
    content = pk;
  } else if (n === d.filled + 1) {
    bg = "#fff"; // now
    color = "#1565d8";
    content = "P";
  } else {
    content = n + off;
  }
  const isPick = content === "P" || content === "B";
  const vline = d.triset && n % 3 === 0 && c < 39;
  return (
    <Box sx={{
      borderRight: vline ? "2px solid #fff" : "1px solid #3a3a3a",
      borderBottom: "1px solid #3a3a3a",
      fontSize: 10.5, display: "flex", alignItems: "center", justifyContent: "center",
      minHeight: 19, fontWeight: isPick ? "bold" : undefined,
      backgroundColor: bg, color,
    }}>{content}</Box>
  );
}

function Road({ d }) {
  // col-major: 각 컬럼 c(1~39)의 위 셀=c, 아래 셀=c+39
  const cells = [];
  for (let c = 1; c <= 39; c++) {
    cells.push({ n: c, c }, { n: c + 39, c });
  }
  // 단계 H(연승)=녹 / M(연패)=적. 실데이터는 stepType, 데모는 문자열 'H'/'M'
  const stepIsH = d.stepType ? d.stepType === "hit" : d.step.includes("H");
  const hasRec = d.recHit !== undefined;
  return (
    <Box sx={{ display: "flex", alignItems: "stretch", gap: "4px", mb: "5px" }}>
      <Box sx={{ width: 84, flex: "none", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px" }}>
        <Box sx={{ ...rhSx, backgroundColor: "#000", color: d.color || colorOf(d.name) }}>{d.name}</Box>
        <Box sx={{ ...rhSx, backgroundColor: stepIsH ? "#000" : "#c0504d", color: stepIsH ? "#66bb6a" : "#fff" }}>{d.step}</Box>
        <Box sx={{ ...rhSx, color: d.pctBg ? "#000" : "#aaa", backgroundColor: d.pctBg || "#000" }}>{d.pct}</Box>
        <Box sx={{ ...rhSx, backgroundColor: "#000", fontSize: 11 }}>
          {hasRec ? (
            <><span style={{ color: "#01e676" }}>{d.recHit}</span><span style={{ color: "#aaa" }}>/</span><span style={{ color: "#ffeb3b" }}>{d.recMiss}</span></>
          ) : (
            <span style={{ color: "#ffee58" }}>{d.rec}</span>
          )}
        </Box>
      </Box>
      <Box sx={{
        display: "grid", gridTemplateRows: "1fr 1fr", gridAutoFlow: "column", gridAutoColumns: "23px",
        gap: 0, overflowX: "auto", flex: "none", width: "max-content", maxWidth: "100%",
        borderTop: "1px solid #3a3a3a", borderLeft: "1px solid #3a3a3a",
      }}>
        {cells.map(({ n, c }) => <RoadCell key={n} n={n} c={c} d={d} />)}
      </Box>
    </Box>
  );
}

const titleSx = {
  display: "inline-block", border: "2px solid #888", borderRadius: "6px",
  backgroundColor: "#2a2a2a", color: "#ddd", fontWeight: "bold",
  padding: "2px 16px", fontSize: 13,
};

function AssistChk({ label, checked, onChange }) {
  const controlled = checked !== undefined;
  return (
    <Box component="label" sx={{ color: "#cfe0ff", fontSize: 13, display: "flex", alignItems: "center", gap: "6px", cursor: controlled ? "pointer" : "default" }}>
      {controlled
        ? <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        : <input type="checkbox" defaultChecked />}
      {label}
    </Box>
  );
}

// checks: [{ label, checked?, onChange? }] — checked 있으면 제어형
function RoadGroup({ title, rows, checks }) {
  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: "14px", mt: "14px", mb: "6px" }}>
        <Box sx={titleSx}>{title}</Box>
        {checks.map((c) => <AssistChk key={c.label} label={c.label} checked={c.checked} onChange={c.onChange} />)}
      </Box>
      {rows.map((d) => <Road key={d.name} d={d} />)}
    </Box>
  );
}

export default function GhSqSsrSxRoads({ sqTracks, srTracks, ssrTracks, sxTracks, pointApplied, stats, roundPicks, nextPicks }) {
  const [showSr, setShowSr] = useState(false); // "sr picture" 토글: 끄면 SSR, 켜면 SR
  // SQ/SR/SSR/SX = 동일 변환(sc1/sc2/sc3). 데이터 없으면 데모값 폴백.
  const sqRows = tracksToRows(sqTracks, "SQ", pointApplied) || SQ_DEMO;
  const srRows = tracksToRows(srTracks, "SR", pointApplied);
  const ssrRows = tracksToRows(ssrTracks, "SSR", pointApplied) || SSR;
  const sxRows = tracksToRows(sxTracks, "SX", pointApplied) || SX;
  // PBJX / DGT = stats 기반 로드 (P/B/J/D/G/TN/ONE/TWO 채움, 6MX는 데이터 없어 제외)
  const statsRow = (name, key) => statsToRow(name, key, stats, roundPicks, nextPicks?.[key]);
  const pbjxRows = [statsRow("P", "P"), statsRow("B", "B"), statsRow("J", "J")].filter(Boolean);
  const dgtRows = [statsRow("D", "D"), statsRow("G", "G"), statsRow("TN", "TN"), statsRow("ONE", "ONE"), statsRow("TWO", "TWO")].filter(Boolean);
  return (
    <Box sx={{ mb: 2 }}>
      <RoadGroup title="SQ" rows={sqRows} checks={[{ label: "assist picture" }]} />
      <RoadGroup
        title={showSr ? "SR" : "SSR"}
        rows={showSr ? (srRows || ssrRows) : ssrRows}
        checks={[
          { label: "sr picture", checked: showSr, onChange: setShowSr },
          { label: "assist picture" },
        ]}
      />
      <RoadGroup title="SX" rows={sxRows} checks={[{ label: "assist picture" }]} />
      {pbjxRows.length > 0 && <RoadGroup title="PBJX" rows={pbjxRows} checks={[]} />}
      {dgtRows.length > 0 && <RoadGroup title="DGT" rows={dgtRows} checks={[]} />}
    </Box>
  );
}
