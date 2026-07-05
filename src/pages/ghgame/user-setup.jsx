import { useState, useEffect } from "react";
import { Box, Typography, Snackbar, Alert, Dialog, DialogTitle, DialogContent, DialogActions, Button } from "@mui/material";
import { useNavigate, useSearchParams, useBlocker } from "react-router-dom";
import apiCaller from "@/services/api-caller";
import { USER_BET_SETTINGS_API } from "@/constants/api-url";

const GREEN = "#4caf50";
const LABEL_COLOR = "#c62828";
const CELL_BORDER = "1px solid #555";
const LABEL_BG = "rgba(255,255,255,0.04)";

const BET_TYPES = ["martin", "kkangbet", "fixed", "manual", "cruise"];
const BET_TYPE_LABELS = { martin: "마틴", kkangbet: "깡벳", fixed: "고정벳", manual: "수동", cruise: "크루즈" };
const DISABLED_BET_TYPES = ["cruise"];

const headerStyle = {
  border: CELL_BORDER, padding: "4px 8px", fontSize: 14, fontWeight: "bold",
  textAlign: "center", backgroundColor: "rgba(255,255,255,0.08)",
};
const cellStyle = {
  border: CELL_BORDER, padding: "3px 6px", fontSize: 13, textAlign: "center",
  whiteSpace: "nowrap", minWidth: 70,
};
const labelCellStyle = {
  ...cellStyle, fontWeight: "bold", color: LABEL_COLOR, backgroundColor: LABEL_BG, textAlign: "left", minWidth: 70,
};
const greenCell = {
  ...cellStyle, backgroundColor: GREEN, color: "#1b2e1b", fontWeight: "bold", cursor: "pointer",
};
const normalCell = { ...cellStyle };
const editableCell = { ...cellStyle, cursor: "pointer", position: "relative" };
const disabledHeaderStyle = {
  ...headerStyle, opacity: 0.4,
};
const fmtP1 = (value) => {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n.toFixed(1) : "0.0";
};

function calcAmounts(amounts, editedIdx, editedVal, betType, stepMin, stepMax) {
  const newAmounts = [...amounts];
  newAmounts[editedIdx] = editedVal;
  const minIdx = stepMin - 1;
  const maxIdx = stepMax - 1;
  if (betType === "martin" || betType === "kkangbet") {
    for (let i = editedIdx + 1; i <= maxIdx; i++) newAmounts[i] = newAmounts[i - 1] * 2;
    for (let i = editedIdx - 1; i >= minIdx; i--) newAmounts[i] = Math.max(Math.round(newAmounts[i + 1] / 2), 1);
  } else if (betType === "fixed") {
    for (let i = minIdx; i <= maxIdx; i++) newAmounts[i] = editedVal;
  }
  return newAmounts;
}

function EditableCell({ value, onChange, prefix = "", suffix = "", style = normalCell, disabled = false }) {
  const [editing, setEditing] = useState(false);
  const [tempVal, setTempVal] = useState(String(value));
  const handleClick = () => { if (disabled) return; setTempVal(String(value)); setEditing(true); };
  const handleBlur = () => {
    setEditing(false);
    const num = parseInt(tempVal, 10);
    if (!isNaN(num) && num !== value) onChange(num);
  };
  const handleKeyDown = (e) => { if (e.key === "Enter") e.target.blur(); else if (e.key === "Escape") setEditing(false); };
  if (editing) {
    return (
      <td style={style}>
        <input autoFocus value={tempVal} onChange={(e) => setTempVal(e.target.value)} onBlur={handleBlur} onKeyDown={handleKeyDown}
          size={Math.max(tempVal.length, 1)}
          style={{
            width: `${Math.max(tempVal.length, 1)}ch`, boxSizing: "content-box", padding: 0, margin: 0,
            background: "transparent", border: "none", borderBottom: "1px solid #4caf50",
            color: style === greenCell ? "#1b2e1b" : "#fff", textAlign: "center", fontSize: 13, outline: "none",
          }}
        />
      </td>
    );
  }
  return (
    <td style={style} onClick={handleClick}>
      {prefix}{suffix === "P" ? fmtP1(value) : ((value === undefined || value === null || value === "" || value === 0) ? "" : value.toLocaleString())}{suffix}
    </td>
  );
}

function ToggleCell({ active, label, onClick, disabled = false }) {
  const disabledStyle = { ...normalCell, color: "#555", cursor: "not-allowed" };
  return (
    <td style={disabled ? disabledStyle : active ? greenCell : normalCell} onClick={disabled ? undefined : onClick}>
      {label}
    </td>
  );
}

function FailSection({ martin, onChange }) {
  const enabled = martin.enabled;
  const failCount = martin.fail_count || 2;
  const toggleFail = () => {
    const next = failCount >= 8 ? 2 : failCount + 1;
    onChange({ ...martin, fail_count: next });
  };
  const betType = (type) => { if (DISABLED_BET_TYPES.includes(type)) return; onChange({ ...martin, bet_type: type }); };
  const amount = (idx, val) => {
    const newAmounts = calcAmounts(martin.amounts || new Array(20).fill(0), idx, val, martin.bet_type, martin.step_min || 1, martin.step_max || 20);
    onChange({ ...martin, amounts: newAmounts });
  };

  return (
    <>
      <tr>
        <td colSpan={6} style={{ border: "none", padding: "0 0 6px 0" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Box sx={{
              backgroundColor: "#e65100", color: "#fff", fontWeight: "bold",
              borderRadius: 1, px: 1.5, py: 0.5, fontSize: 14,
            }}>
              fail
            </Box>
            <Box onClick={toggleFail} sx={{
              backgroundColor: "#ff6d00", color: "#fff", fontWeight: "bold",
              borderRadius: 1, px: 1.5, py: 0.5, fontSize: 14, cursor: "pointer",
              "&:hover": { backgroundColor: "#ff8f00" },
            }}>
              fail {failCount}
            </Box>
            {enabled ? (
              <Box onClick={() => onChange({ ...martin, enabled: false })} sx={{
                backgroundColor: GREEN, color: "#1b2e1b", fontWeight: "bold",
                borderRadius: 1, px: 1.5, py: 0.5, fontSize: 14, cursor: "pointer",
              }}>
                사용함
              </Box>
            ) : (
              <Box onClick={() => onChange({ ...martin, enabled: true })} sx={{
                backgroundColor: "#333", color: "#888",
                borderRadius: 1, px: 1.5, py: 0.5, fontSize: 14, cursor: "pointer",
              }}>
                사용안함
              </Box>
            )}
          </Box>
        </td>
      </tr>
      <tr>
        <td style={labelCellStyle}>배팅종류</td>
        {BET_TYPES.map((t) => (
          <ToggleCell key={t} active={martin.bet_type === t} label={BET_TYPE_LABELS[t]}
            onClick={() => betType(t)} disabled={DISABLED_BET_TYPES.includes(t)} />
        ))}
      </tr>
      <tr>
        <td style={labelCellStyle}>단계설정</td>
        <td style={normalCell}>최저</td>
        <EditableCell value={martin.step_min || 1} onChange={(v) => {
          const upd = { ...martin, step_min: v };
          if (v >= (martin.step_max || 20)) upd.step_max = v + 1;
          onChange(upd);
        }} suffix="단계" style={greenCell} />
        <td style={normalCell}>최고</td>
        <EditableCell value={martin.step_max || 20} onChange={(v) => {
          const upd = { ...martin, step_max: v };
          if (v <= (martin.step_min || 1)) upd.step_min = v - 1;
          onChange(upd);
        }} suffix="단계" style={greenCell} />
        <td style={normalCell}></td>
      </tr>
      {[0, 1, 2, 3].map((rowIdx) => (
        <tr key={`fail-amt-${rowIdx}`}>
          {rowIdx === 0 && <td rowSpan={4} style={labelCellStyle}>금액설정</td>}
          {(martin.amounts || new Array(20).fill(0)).slice(rowIdx * 5, rowIdx * 5 + 5).map((amt, i) => {
            const idx = rowIdx * 5 + i;
            const step = idx + 1;
            const inRange = step >= (martin.step_min || 1) && step <= (martin.step_max || 20);
            return (
              <EditableCell key={idx} value={inRange ? amt : 0} onChange={(v) => amount(idx, v)}
                prefix={`${step}:`} suffix="P" style={inRange ? editableCell : normalCell} disabled={!inRange} />
            );
          })}
        </tr>
      ))}
    </>
  );
}

// 크루즈 단계 라벨: 0→"1", 1→"2", 2→"2-2", 3→"3", 4→"3-2", 5→"4", 6→"4-2", ...
function cruiseStepLabel(idx) {
  if (idx === 0) return "1";
  if (idx === 1) return "2";
  // idx >= 2
  // 짝수 idx (2,4,6,...) → "2-2", "3-2", "4-2", ...
  // 홀수 idx (3,5,7,...) → "3", "4", "5", ...
  if (idx % 2 === 0) return `${idx / 2 + 1}-2`;
  return `${(idx + 1) / 2 + 1}`;
}

function MartinSection({ name, label, martin, onChange, disabled, labelColor: labelColorProp }) {
  const isCruise = name === "cruise";
  const enabled = martin.enabled;
  // 크루즈는 29 단계(15-2까지)를 위해 6행×5칸 = 30칸 사용, 다른 섹션은 4행×5 = 20
  const totalSteps = isCruise ? 30 : 20;
  const totalRows = isCruise ? 6 : 4;
  const defaultStepMax = isCruise ? 29 : 20;
  // 크루즈 섹션은 cruise만 선택 가능, 다른 섹션은 cruise를 못 고름
  const sectionDisabledBetTypes = isCruise
    ? BET_TYPES.filter((t) => t !== "cruise")
    : DISABLED_BET_TYPES;
  const betType = (type) => { if (sectionDisabledBetTypes.includes(type)) return; onChange({ ...martin, bet_type: type }); };
  const amount = (idx, val) => {
    const base = martin.amounts || [];
    const padded = base.length >= totalSteps ? base : [...base, ...new Array(totalSteps - base.length).fill(0)];
    const newAmounts = calcAmounts(padded, idx, val, martin.bet_type, martin.step_min || 1, martin.step_max || defaultStepMax);
    onChange({ ...martin, amounts: newAmounts });
  };
  // 크루즈 섹션: bet_type=cruise + step_max=29 강제
  useEffect(() => {
    if (!isCruise) return;
    const upd = {};
    if (martin.bet_type !== "cruise") upd.bet_type = "cruise";
    if ((martin.step_max || 0) < 29) upd.step_max = 29;
    if (Object.keys(upd).length > 0) {
      onChange({ ...martin, ...upd });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCruise, martin.bet_type, martin.step_max]);

  const sectionDisabled = disabled || !enabled;

  const labelColor = labelColorProp || (name === "martin_a" ? "#c62828" : "#1565c0");

  return (
    <>
      {/* 헤더: 마틴명 + 설정금액 or 사용안함 (테이블 밖 둥근 박스) */}
      <tr>
        <td colSpan={6} style={{ border: "none", padding: "0 0 6px 0" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Box sx={{
              backgroundColor: labelColor, color: "#fff", fontWeight: "bold",
              borderRadius: 1, px: 1.5, py: 0.5, fontSize: 14,
            }}>
              {label}
            </Box>
            {enabled ? (
              <Box onClick={() => onChange({ ...martin, enabled: false })} sx={{
                backgroundColor: GREEN, color: "#1b2e1b", fontWeight: "bold",
                borderRadius: 1, px: 1.5, py: 0.5, fontSize: 14, cursor: "pointer",
              }}>
                사용함
              </Box>
            ) : (
              <Box onClick={() => onChange({ ...martin, enabled: true })} sx={{
                backgroundColor: "#333", color: "#888",
                borderRadius: 1, px: 1.5, py: 0.5, fontSize: 14, cursor: "pointer",
              }}>
                사용안함
              </Box>
            )}
          </Box>
        </td>
      </tr>

      {/* 배팅종류 */}
      <tr>
        <td style={labelCellStyle}>배팅종류</td>
        {BET_TYPES.map((t) => (
          <ToggleCell key={t} active={martin.bet_type === t} label={BET_TYPE_LABELS[t]}
            onClick={() => betType(t)} disabled={sectionDisabledBetTypes.includes(t)} />
        ))}
      </tr>
      {/* 단계설정 */}
      <tr>
        <td style={labelCellStyle}>단계설정</td>
        <td style={normalCell}>최저</td>
        <EditableCell value={martin.step_min || 1} onChange={(v) => {
          const upd = { ...martin, step_min: v };
          if (v >= (martin.step_max || defaultStepMax)) upd.step_max = v + 1;
          onChange(upd);
        }} suffix="단계" style={greenCell} />
        <td style={normalCell}>최고</td>
        <EditableCell value={martin.step_max || defaultStepMax} onChange={(v) => {
          const upd = { ...martin, step_max: v };
          if (v <= (martin.step_min || 1)) upd.step_min = v - 1;
          onChange(upd);
        }} suffix="단계" style={greenCell} />
        <td style={normalCell}></td>
      </tr>
      {/* 금액설정 */}
      {(() => {
        // amounts를 totalSteps 길이로 padding (기존 저장값이 20일 수 있음)
        const baseAmounts = martin.amounts || [];
        const paddedAmounts = baseAmounts.length >= totalSteps
          ? baseAmounts
          : [...baseAmounts, ...new Array(totalSteps - baseAmounts.length).fill(0)];
        return Array.from({ length: totalRows }, (_, rowIdx) => rowIdx).map((rowIdx) => (
          <tr key={`${name}-amt-${rowIdx}`}>
            {rowIdx === 0 && <td rowSpan={totalRows} style={labelCellStyle}>금액설정</td>}
            {Array.from({ length: 5 }, (_, i) => {
              const idx = rowIdx * 5 + i;
              const step = idx + 1;
              const inRange = step >= (martin.step_min || 1) && step <= (martin.step_max || defaultStepMax) && idx < (isCruise ? 29 : 20);
              const stepLabel = isCruise ? cruiseStepLabel(idx) : `${step}`;
              // 크루즈는 idx 29(=30번째 칸) 이상은 안 보이게
              if (isCruise && idx >= 29) {
                return <td key={idx} style={normalCell}></td>;
              }
              const amt = paddedAmounts[idx] || 0;
              return (
                <EditableCell key={idx} value={inRange ? amt : 0} onChange={(v) => amount(idx, v)}
                  prefix={`${stepLabel}:`} suffix="P" style={inRange ? editableCell : normalCell} disabled={!inRange} />
              );
            })}
          </tr>
        ));
      })()}
    </>
  );
}

const DIST_MODES = ["even", "asc", "desc"];
const DIST_LABELS = { even: "균등", asc: "증가", desc: "감소" };

function generateLabouchereSequence(target, count, mode) {
  if (!target || target <= 0 || !count || count <= 0) return [];
  if (mode === "even") {
    const base = Math.floor(target / count);
    const rem = target - base * count;
    return Array.from({ length: count }, (_, i) => base + (i < rem ? 1 : 0));
  }
  // asc/desc: 선형 분배
  // 1+2+...+count = count*(count+1)/2 = S, scale = target / S
  // 각 셀 = round(i * scale), 마지막 셀에서 합 보정
  const S = (count * (count + 1)) / 2;
  const weights = mode === "asc"
    ? Array.from({ length: count }, (_, i) => i + 1)
    : Array.from({ length: count }, (_, i) => count - i);
  const seq = weights.map((w) => Math.max(1, Math.round((w * target) / S)));
  // 합 보정
  const sum = seq.reduce((a, b) => a + b, 0);
  const diff = target - sum;
  if (diff !== 0) {
    // 마지막(asc)/첫(desc) 셀에 차이 반영
    const adjIdx = mode === "asc" ? count - 1 : 0;
    seq[adjIdx] = Math.max(1, seq[adjIdx] + diff);
  }
  return seq;
}

function LabouchereCell({ value, onChange, style }) {
  const [editing, setEditing] = useState(false);
  const [tempVal, setTempVal] = useState(String(value));
  const handleClick = () => { setTempVal(String(value)); setEditing(true); };
  const handleBlur = () => {
    setEditing(false);
    const num = parseInt(tempVal, 10);
    if (!isNaN(num) && num !== value) onChange(num);
  };
  const handleKeyDown = (e) => { if (e.key === "Enter") e.target.blur(); else if (e.key === "Escape") setEditing(false); };
  if (editing) {
    return (
      <td style={style}>
        <input autoFocus value={tempVal} onChange={(e) => setTempVal(e.target.value)} onBlur={handleBlur} onKeyDown={handleKeyDown}
          size={Math.max(tempVal.length, 1)}
          style={{
            width: `${Math.max(tempVal.length, 1)}ch`, boxSizing: "content-box", padding: 0, margin: 0,
            background: "transparent", border: "none", borderBottom: "1px solid #4caf50",
            color: "#fff", textAlign: "center", fontSize: 13, outline: "none",
          }}
        />
      </td>
    );
  }
  return (
    <td style={style} onClick={handleClick}>
      {fmtP1(value)}P
    </td>
  );
}

function LabouchereSection({ labouchere, onChange }) {
  const enabled = labouchere.enabled;
  const target = labouchere.target || 0;
  const count = labouchere.count || 10;
  const mode = labouchere.mode || "even";
  const sequence = labouchere.sequence || [];

  const regenerate = (nextTarget = target, nextCount = count, nextMode = mode) => {
    const seq = generateLabouchereSequence(nextTarget, nextCount, nextMode);
    onChange({ ...labouchere, target: nextTarget, count: nextCount, mode: nextMode, sequence: seq });
  };

  const editCell = (idx, val) => {
    const next = [...(sequence.length === count ? sequence : new Array(count).fill(0))];
    next[idx] = Math.max(0, val);
    onChange({ ...labouchere, sequence: next });
  };

  const sumDisplay = (sequence || []).reduce((a, b) => a + (b || 0), 0);
  const sumOk = sumDisplay === target;

  // 한 행에 5칸씩 표시
  const COLS = 5;
  const rows = Math.max(1, Math.ceil(count / COLS));

  return (
    <>
      <tr>
        <td colSpan={6} style={{ border: "none", padding: "0 0 6px 0" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Box sx={{
              backgroundColor: "#8e24aa", color: "#fff", fontWeight: "bold",
              borderRadius: 1, px: 1.5, py: 0.5, fontSize: 14,
            }}>
              라보쉐르
            </Box>
            {enabled ? (
              <Box onClick={() => onChange({ ...labouchere, enabled: false })} sx={{
                backgroundColor: GREEN, color: "#1b2e1b", fontWeight: "bold",
                borderRadius: 1, px: 1.5, py: 0.5, fontSize: 14, cursor: "pointer",
              }}>
                사용함
              </Box>
            ) : (
              <Box onClick={() => onChange({ ...labouchere, enabled: true })} sx={{
                backgroundColor: "#333", color: "#888",
                borderRadius: 1, px: 1.5, py: 0.5, fontSize: 14, cursor: "pointer",
              }}>
                사용안함
              </Box>
            )}
            <Box sx={{
              backgroundColor: sumOk ? "rgba(76,175,80,0.15)" : "rgba(255,152,0,0.15)",
              color: sumOk ? "#81c784" : "#ffb74d",
              borderRadius: 1, px: 1, py: 0.3, fontSize: 12,
            }}>
              합계 {sumDisplay} / 목표 {target}
            </Box>
          </Box>
        </td>
      </tr>
      <tr>
        <td style={labelCellStyle}>목표/갯수</td>
        <td style={normalCell}>목표</td>
        <EditableCell value={target} onChange={(v) => regenerate(v, count, mode)} suffix="P" style={greenCell} />
        <td style={normalCell}>갯수</td>
        <EditableCell value={count} onChange={(v) => regenerate(target, Math.max(2, Math.min(50, v)), mode)} suffix="개" style={greenCell} />
        <td style={normalCell}></td>
      </tr>
      <tr>
        <td style={labelCellStyle}>분배방식</td>
        {DIST_MODES.map((m) => (
          <ToggleCell key={m} active={mode === m} label={DIST_LABELS[m]} onClick={() => regenerate(target, count, m)} />
        ))}
        <td style={normalCell}></td>
        <td style={normalCell}></td>
      </tr>
      {Array.from({ length: rows }, (_, rowIdx) => (
        <tr key={`lab-seq-${rowIdx}`}>
          {rowIdx === 0 && <td rowSpan={rows} style={labelCellStyle}>시퀀스</td>}
          {Array.from({ length: COLS }, (_, i) => {
            const idx = rowIdx * COLS + i;
            if (idx >= count) return <td key={i} style={{ ...normalCell, minWidth: 40, color: "#555" }}>0P</td>;
            const v = sequence[idx] || 0;
            return (
              <LabouchereCell
                key={i}
                value={v}
                onChange={(nv) => editCell(idx, nv)}
                style={{ ...editableCell, minWidth: 40, padding: "3px 4px" }}
              />
            );
          })}
        </tr>
      ))}
    </>
  );
}

// ─── 전략별 셋업 박스 (260620) ───
// 목업(setup_page_mockup.html) 기준. 각 전략이 독립 진행방식·P배열·목표금액·베팅운용을 갖는다.
// full(AAR/SSR1~3): row7에 old/new + 동률시 + 어시스트. short(SQ/SX/D/G/TN/ONE/TWO): 어시스트만.
const STRAT_BET_TYPES = ["manual", "martin", "cruise", "labouchere"];
const STRAT_BET_LABELS = { manual: "수동", martin: "마틴", cruise: "크루즈", labouchere: "라보쉐르" };
const STRAT_DIST_MODES = ["even", "asc", "desc"];
const STRAT_DIST_LABELS = { even: "균등", asc: "증가", desc: "감소" };

// 어시스트 셀렉트 옵션 (setup_page_mockup.html ASSIST_OPTS, 260624)
const ASSIST_OPTS = [
  "해당반대", "해당진행", "대기진행",
  "G(H1)", "G(H0)", "G(%1)", "G(%0)",
  "A멀티(H1)", "S1멀티(H1)", "S2멀티(H1)", "S3멀티(H1)",
  "HB멀티(H1)", "WH멀티(H1)", "MH멀티(H1)", "DH멀티(H1)",
];
// 패시 어시스트 행 (2~15패시). 최고 16단계면 15패시까지 표시.
const PASI_LEVELS = Array.from({ length: 14 }, (_, i) => i + 2);
function defaultPasi() {
  return PASI_LEVELS.map((lvl) => ({
    level: lvl,
    assist1: "해당진행",
    pct: lvl === 2 ? 5 : lvl === 6 ? 55 : 0,
    q_level: lvl,
    assist2: "해당진행",
  }));
}

const DEFAULT_STRATEGY_SETUP = {
  enabled: false,
  bet_type: "manual",
  step_min: 1,
  step_max: 16,        // 조건부 P배열은 16칸(흰/파/빨 각 1~16)
  // 조건부 P배열: 흰색 하한/상한(%) 직접 입력. 파랑(0~lo-1)/빨강(hi+1~100)은 파생.
  cond_lo: 0,          // 흰색 하한 (% 이상)
  cond_hi: 100,        // 흰색 상한 (% 이하)
  amounts_white: new Array(16).fill(0),
  amounts_blue: new Array(16).fill(0),
  amounts_red: new Array(16).fill(0),
  // (구) 단일 amounts — 라보쉐르/하위호환 위해 유지
  amounts: new Array(20).fill(0),
  count: 10,
  dist_mode: "even",
  sequence: [],
  target_man: 0,
  bet_start: 1,
  bet_close: 40,
  bet_extend: 55,
  unsettled_stop: 0,
  // full(멀티판) 전용
  multi_sections: { A: true, AR: true, OLD: true, NEW: true },  // 사용함 여부
  tie_old: "G(H1)",   // 동률시 어시스트 (OLD)
  tie_new: "G(%1)",   // 동률시 어시스트 (NEW)
  priority_version: "new",
  tie_priority: "A",
  // 최상위조건설정 + 패시 어시스트 (멀티/일반판 공통)
  miss_threshold: 5,    // NMiss
  miss_occur: 2,        // 발생 N회
  miss_wait: 9,         // N회대기
  pasi: defaultPasi(),
  assist: false,
};
function defaultStrategySetup() {
  return {
    ...DEFAULT_STRATEGY_SETUP,
    amounts: new Array(20).fill(0),
    amounts_white: new Array(16).fill(0),
    amounts_blue: new Array(16).fill(0),
    amounts_red: new Array(16).fill(0),
    multi_sections: { A: true, AR: true, OLD: true, NEW: true },
    pasi: defaultPasi(),
    sequence: [],
  };
}

// 렌더 순서 + variant. full(old/new+동률시+어시스트): AAR(A-AR), SSR1~3(S-SR). short: 나머지.
const STRATEGY_SETUP_BOXES = [
  { key: "AAR", variant: "full", aarLabel: "A-AR", label: "A멀티", sections: ["A", "AR", "AARO", "AARN"] },
  { key: "SSR1", variant: "full", aarLabel: "S-SR", label: "S1세트", sections: ["S1", "SR1", "SSRO1", "SSRN1"] },
  { key: "SSR2", variant: "full", aarLabel: "S-SR", label: "S2세트", sections: ["S2", "SR2", "SSRO2", "SSRN2"] },
  { key: "SSR3", variant: "full", aarLabel: "S-SR", label: "S3세트", sections: ["S3", "SR3", "SSRO3", "SSRN3"] },
  // FOR/SQ 세트: 한 박스 + 멀티섹션(공유 배당). 대표키 amounts를 멤버가 공유(백엔드 별칭).
  { key: "FOR", variant: "full", label: "FOR세트", sections: ["FOR1", "FOR2", "FOR3"] },
  { key: "FORX", variant: "full", label: "FORX세트", sections: ["FOR1X", "FOR2X", "FOR3X"] },
  { key: "SQ", variant: "full", label: "SQ세트", sections: ["SQ1", "SQ2", "SQ3"] },
  { key: "GOB", variant: "full", label: "G시리즈", sections: ["G(H1)", "G(H0)", "G(%1)", "G(%0)"] },
  // 서브게임: full 멀티판 (정/R/SRO/SRN + 공유 배당)
  { key: "허니비", variant: "full", label: "허니비", sections: ["허니비", "허니R", "허니SRO", "허니SRN"] },
  { key: "W111", variant: "full", label: "위너히트", sections: ["W111", "위너R", "위너SRO", "위너SRN"] },
  { key: "M22", variant: "full", label: "메가히트", sections: ["M22", "메가R", "메가SRO", "메가SRN"] },
  { key: "D112", variant: "full", label: "드림히트", sections: ["D112", "드림R", "드림SRO", "드림SRN"] },
  { key: "NC", variant: "full", label: "나이스초이스", sections: ["NC", "NCR", "NCSRO", "NCSRN"] },
  { key: "D", variant: "short" },
  { key: "G", variant: "short" },
  { key: "TN", variant: "short" },
  { key: "ONE", variant: "short" },
  { key: "TWO", variant: "short" },
  { key: "P", variant: "short" },
  { key: "B", variant: "short" },
  { key: "J", variant: "short" },
];

// 목업 셀 스타일 (setup_page_mockup.html). 10열 통일, 84px 셀.
const mkCell = { border: "1px solid #c9ccd1", width: 84, height: 22, lineHeight: 1.1, textAlign: "center", verticalAlign: "middle", fontSize: 13, padding: "1px 4px", whiteSpace: "nowrap", boxSizing: "border-box" };
const mkGreen = { ...mkCell, background: "#009900", color: "#fff" };
const mkTeal = { ...mkCell, background: "#33CCCC", color: "#000", cursor: "pointer" };
const mkBlue = { ...mkCell, color: "#0066FF", fontWeight: "bold" };
const mkRed = { ...mkCell, color: "#FF0000" };
const mkMethod = { ...mkCell, cursor: "pointer", userSelect: "none" };
const mkDisabled = { ...mkCell, opacity: 0.3, pointerEvents: "none" };
const mkEmpty = { ...mkCell, background: "#0a0a0a", cursor: "default" };

// 인라인 숫자 입력 헬퍼 셀 (목업 editStage/editCount/editVal/editP 통합).
// suffix: 표시 접미사. range:[min,max]면 정수 클램프, 없으면 0.1 소수. pno: 좌상단 작은 단계번호.
function MkInput({ value, onChange, suffix = "", range, style, disabled, render }) {
  const [editing, setEditing] = useState(false);
  const [tmp, setTmp] = useState("");
  const start = () => { if (disabled) return; setTmp(value === 0 || value == null ? "" : String(value)); setEditing(true); };
  const commit = () => {
    setEditing(false);
    let v = parseFloat(tmp);
    if (isNaN(v)) v = range ? range[0] : 0;
    if (range) { v = Math.round(v); if (v < range[0]) v = range[0]; if (v > range[1]) v = range[1]; }
    else v = Math.round(v * 10) / 10;
    if (v !== value) onChange(v);
  };
  const key = (e) => { if (e.key === "Enter") e.target.blur(); else if (e.key === "Escape") setEditing(false); };
  if (editing) {
    // 인풋 배경/글자색을 셀 배경에 맞춤 (teal·green 셀은 밝은 바탕+검정, 그 외 어두운 바탕+흰색).
    const onLight = style === mkTeal || style === mkGreen;
    return (
      <td style={style}>
        <input autoFocus type="number" step={range ? "1" : "0.1"} value={tmp}
          onChange={(e) => setTmp(e.target.value)} onBlur={commit} onKeyDown={key}
          style={{ width: 56, background: onLight ? "#cfeeee" : "#1a1a1a", border: "1px solid #0066FF",
            color: onLight ? "#000" : "#fff", textAlign: "center", fontSize: 13, borderRadius: 3, outline: "none" }} />
      </td>
    );
  }
  return (
    <td style={{ ...style, cursor: disabled ? "default" : "pointer" }} onClick={start}>
      {render ? render(value) : `${suffix === "P" ? fmtP1(value) : (value == null ? "" : value)}${suffix}`}
    </td>
  );
}

// ─── 셋업 시안(setup_page_mockup.html 260625) 추가 스타일/헬퍼 ───
const mkNavy = { ...mkCell, background: "#16365c", color: "#fff", cursor: "pointer" };  // P배열 채움 후 보조
const mkAssistHdr = { ...mkCell, background: "#17365e", color: "#0065fe", fontWeight: "bold" };  // 최상위조건설정 헤더
const mkAssist2 = { ...mkCell, background: "#17365e" };  // 어시스트2 셀
const mkPctHdr = { ...mkCell, background: "#17365e", color: "#ff6b6b", fontWeight: "bold" };
const mkDim = { ...mkCell, color: "#777" };
const mkCondOff = { color: "#666" };  // 구간 없음(회색)

// 어시스트 셀렉트 (목업 assistSelectHTML)
function AssistSelect({ value, onChange, sx }) {
  const normalized = ASSIST_OPTS.includes(value) ? value : ASSIST_OPTS[0];
  return (
    <select value={normalized} onChange={(e) => onChange(e.target.value)}
      style={{ background: "#16365c", color: "#fff", border: "1px solid #2f5b8f", borderRadius: 3,
        fontSize: 12, padding: "1px 2px", width: "96%", cursor: "pointer", outline: "none",
        fontFamily: "D2Coding, Consolas, Menlo, monospace", ...sx }}>
      {ASSIST_OPTS.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

// 작은 숫자 인풋(미스/발생/회대기/%). 시안의 .missin/.pct-in
function NumIn({ value, onChange, min, max, color = "#0065fe", width = 30, bg = "#0d2440" }) {
  return (
    <input type="number" value={value ?? 0} min={min} max={max}
      onChange={(e) => {
        let v = parseInt(e.target.value || "0", 10) || 0;
        if (v < min) v = min; if (v > max) v = max;
        onChange(v);
      }}
      style={{ width, background: bg, border: "1px solid #2f5b8f", color, fontWeight: "bold",
        textAlign: "center", fontSize: 12, borderRadius: 3, padding: 0 }} />
  );
}

function StrategySetupSection({ name, strat, onChange, variant, sections }) {
  // 단위: 만원. 입력값 그대로 저장(1=1만원, 0.1=1천원). 전광판/백엔드도 만원 단위로 통일.
  const s = strat || defaultStrategySetup();
  const isFull = variant === "full";
  const isLab = s.bet_type === "labouchere";
  const stepMin = s.step_min || 1;
  const stepMax = s.step_max || 16;
  const count = s.count || 10;

  // 조건부 P배열: 흰색 lo/hi 직접 입력, 파랑/빨강 파생.
  const condLo = s.cond_lo ?? 0;
  const condHi = s.cond_hi ?? 100;
  const blueOff = condLo <= 0;     // 하한 0 → 파랑 구간 없음(회색)
  const redOff = condHi >= 100;    // 상한 100 → 빨강 구간 없음(회색)

  const setMethod = (t) => {
    if (t === "labouchere") {
      const seq = generateLabouchereSequence(s.target_man, count, s.dist_mode || "even");
      const arr = new Array(16).fill(0);
      seq.forEach((v, i) => { const idx = (stepMin - 1) + i; if (idx >= 0 && idx < 16) arr[idx] = v; });
      onChange({ ...s, bet_type: t, amounts_white: arr, amounts_blue: [...arr], amounts_red: [...arr] });
    } else onChange({ ...s, bet_type: t });
  };
  const regenLab = (patch) => {
    const next = { ...s, ...patch };
    const seq = generateLabouchereSequence(next.target_man, next.count || count, next.dist_mode || "even");
    const arr = new Array(16).fill(0);
    seq.forEach((v, i) => { const idx = (next.step_min || stepMin) - 1 + i; if (idx >= 0 && idx < 16) arr[idx] = v; });
    onChange({ ...next, sequence: seq, amounts_white: arr, amounts_blue: [...arr], amounts_red: [...arr] });
  };

  // 그룹별(white/blue/red) P배열 편집. 마틴이면 입력칸 기준 앞 절반·뒤 2배 자동채움.
  const groupKey = { white: "amounts_white", blue: "amounts_blue", red: "amounts_red" };
  const editP = (group, idx, val) => {
    const key = groupKey[group];
    const arr = [...(s[key] || new Array(16).fill(0))];
    if (s.bet_type === "martin") {
      for (let k = 0; k < 16; k++) arr[k] = Math.round(val * Math.pow(2, k - idx) * 10) / 10;
    } else arr[idx] = val;
    onChange({ ...s, [key]: arr });
  };
  const inRange = (step) => step >= stepMin && step <= stepMax;
  const pRender = (v) => `${fmtP1(v)}P`;

  // 조건부 P배열 한 그룹(2줄: 1~8, 9~16) 렌더
  const condRows = (group, condLabel, condColor, off) => {
    const key = groupKey[group];
    const arr = s[key] || new Array(16).fill(0);
    const txtStyle = off ? mkCondOff : (condColor ? { color: condColor } : {});
    return [0, 1].map((half) => (
      <tr key={`${name}-${group}-${half}`} style={off ? { opacity: 1 } : undefined}>
        {/* 조건칸(colSpan2): half0=하한/이상, half1=상한/이하 */}
        <td colSpan={2} style={{ ...mkCell, whiteSpace: "nowrap", ...txtStyle }}>
          {group === "white" ? (
            <>
              <input type="number" value={half === 0 ? condLo : condHi} min={0} max={100}
                onChange={(e) => {
                  let v = parseInt(e.target.value || "0", 10) || 0;
                  if (v < 0) v = 0; if (v > 100) v = 100;
                  onChange(half === 0 ? { ...s, cond_lo: v } : { ...s, cond_hi: v });
                }}
                style={{ width: 42, background: "#1a1a1a", border: "1px solid #555", color: "#fff",
                  textAlign: "center", fontSize: 13, borderRadius: 3, padding: "1px 2px" }} />
              %<span style={{ marginLeft: 3 }}>{half === 0 ? "이상" : "이하"}</span>
            </>
          ) : (
            <span>{condLabel[half]}%<span style={{ marginLeft: 3 }}>{half === 0 ? "이상" : "이하"}</span></span>
          )}
        </td>
        {Array.from({ length: 8 }, (_, i) => {
          const idx = half * 8 + i;        // 1~8, 9~16
          const step = idx + 1;
          // 최저~최고 단계 밖은 비활성(회색·입력불가). 칸은 시안처럼 그대로 보임.
          if (!inRange(step)) return <td key={idx} style={mkEmpty}></td>;
          const amt = arr[idx] || 0;
          return (
            <MkInput key={idx} value={amt} onChange={(v) => editP(group, idx, v)}
              render={pRender} style={{ ...mkCell, cursor: "pointer", ...txtStyle }} />
          );
        })}
      </tr>
    ));
  };

  const toggleMulti = (k) => onChange({ ...s, multi_sections: { ...(s.multi_sections || {}), [k]: !(s.multi_sections?.[k] ?? true) } });
  const setPasi = (i, patch) => {
    const pasi = (s.pasi || defaultPasi()).map((p, j) => (j === i ? { ...p, ...patch } : p));
    onChange({ ...s, pasi });
  };
  const pasi = s.pasi || defaultPasi();
  const visiblePasi = pasi
    .map((p, i) => ({ p, originalIndex: i }))
    .filter(({ p, originalIndex }) => (p.level ?? (originalIndex + 2)) < stepMax);

  return (
    <>
      {/* 1행: 전략명 | 사용함 | 수동 마틴 크루즈 라보쉐르 | 갯수 | 균등 증가 감소 */}
      <tr>
        <td style={mkRed}>{name}</td>
        <td style={s.enabled ? { ...mkGreen, cursor: "pointer", userSelect: "none" } : { ...mkMethod }}
          onClick={() => onChange({ ...s, enabled: !s.enabled })}>
          {s.enabled ? "사용함" : "사용안함"}
        </td>
        {STRAT_BET_TYPES.map((t) => (
          <td key={t} style={s.bet_type === t ? { ...mkGreen, cursor: "pointer" } : mkMethod} onClick={() => setMethod(t)}>
            {STRAT_BET_LABELS[t]}
          </td>
        ))}
        <MkInput value={count} onChange={(v) => regenLab({ count: Math.max(1, Math.min(16, v)) })} suffix="개"
          range={[1, 16]} style={isLab ? mkCell : mkDisabled} disabled={!isLab} />
        {STRAT_DIST_MODES.map((m) => (
          <td key={m} style={!isLab ? mkDisabled : (s.dist_mode === m ? { ...mkGreen, cursor: "pointer" } : mkMethod)}
            onClick={isLab ? () => regenLab({ dist_mode: m }) : undefined}>
            {STRAT_DIST_LABELS[m]}
          </td>
        ))}
      </tr>
      {/* 2행: P설정 | 최저 (단계) 최고 (단계) */}
      <tr>
        <td style={mkBlue}>P설정</td>
        <td style={mkGreen}>최저</td>
        <MkInput value={stepMin} suffix="단계" range={[1, 16]} style={mkGreen} onChange={(v) => {
          const upd = { ...s, step_min: v };
          if (v > stepMax) upd.step_max = v;
          onChange(upd);
        }} />
        <td style={mkGreen}>최고</td>
        <MkInput value={stepMax} suffix="단계" range={[1, 16]} style={mkGreen} onChange={(v) => {
          const upd = { ...s, step_max: v };
          if (v < stepMin) upd.step_min = v;
          onChange(upd);
        }} />
        <td style={mkCell}></td><td style={mkCell}></td><td style={mkCell}></td><td style={mkCell}></td><td style={mkCell}></td>
      </tr>
      {/* 3~8행: 조건부 P배열 (흰/파/빨) */}
      {condRows("white", null, null, false)}
      {condRows("blue", ["0", String(condLo - 1)], "#0066FF", blueOff)}
      {condRows("red", [String(condHi + 1), "100"], "#FF0000", redOff)}
      {/* 9행: 목표금액 베팅시작 베팅마감 마감연장 마감미처리 */}
      <tr>
        <td style={mkRed}>목표금액</td>
        <MkInput value={s.target_man || 0} suffix="P" style={mkTeal}
          onChange={(v) => isLab ? regenLab({ target_man: v }) : onChange({ ...s, target_man: v })} />
        <td style={mkRed}>베팅시작</td>
        <MkInput value={s.bet_start || 1} suffix="R" range={[1, 12]} style={mkTeal} onChange={(v) => onChange({ ...s, bet_start: v })} />
        <td style={mkRed}>베팅마감</td>
        <MkInput value={s.bet_close || 40} suffix="R" range={[40, 55]} style={mkTeal} onChange={(v) => onChange({ ...s, bet_close: v })} />
        <td style={mkRed}>마감연장</td>
        <MkInput value={s.bet_extend || 55} suffix="R" range={[55, 70]} style={mkTeal} onChange={(v) => onChange({ ...s, bet_extend: v })} />
        <td style={mkRed}>마감미처리</td>
        <MkInput value={s.unsettled_stop || 0} suffix="S 종료" style={mkTeal} onChange={(v) => onChange({ ...s, unsettled_stop: v })} />
      </tr>
      {/* 10행(full만): 멀티섹션 — 박스별 라벨 (A멀티: A AR AARO AARN / SQn세트: SQn SRn SSROn SSRNn) */}
      {isFull && (() => {
        const secs = sections || ["A", "AR", "AARO", "AARN"];
        const pad = 8 - secs.length * 2;  // 멀티섹션(2) + 섹션×2 = 10 맞추기. 3섹션이면 2칸 빈칸
        return (
        <tr>
          <td colSpan={2} style={mkBlue}>멀티섹션</td>
          {secs.map((k, idx) => {
            // 위치별 색: 0=파랑, 1=빨강, 2=파랑(OLD계), 3=초록(NEW계)
            const lblSx = idx === 1 ? mkRed : idx === 3 ? { ...mkCell, color: "#33CC33", fontWeight: "bold" } : mkBlue;
            const on = s.multi_sections?.[k] ?? true;
            return [
              <td key={`${k}-l`} style={lblSx}>{k}</td>,
              <td key={`${k}-v`} style={on ? { ...mkGreen, cursor: "pointer" } : mkMethod} onClick={() => toggleMulti(k)}>
                {on ? "사용함" : "사용안함"}
              </td>,
            ];
          })}
          {pad > 0 && <td colSpan={pad} style={mkCell}></td>}
        </tr>
        );
      })()}
      {/* 11행(full만): 동률시어시스트지정 */}
      {isFull && (
        <tr>
          <td colSpan={2} style={mkRed}>동률시어시스트지정</td>
          <td colSpan={2} style={mkDim}>해당없음</td>
          <td colSpan={2} style={mkDim}>해당없음</td>
          <td colSpan={2} style={mkNavy}><AssistSelect value={s.tie_old} onChange={(v) => onChange({ ...s, tie_old: v })} /></td>
          <td colSpan={2} style={mkNavy}><AssistSelect value={s.tie_new} onChange={(v) => onChange({ ...s, tie_new: v })} /></td>
        </tr>
      )}
      {/* 12행: 최상위조건설정 헤더 */}
      <tr>
        <td colSpan={3} style={mkAssistHdr}>최상위조건설정</td>
        <td colSpan={2} style={mkRed}>연패발생</td>
        <td colSpan={2} style={{ ...mkRed, background: "#16365c", color: "#015fe5" }}>어시 H픽</td>
        <td colSpan={1} style={{ ...mkRed, background: "#60497b" }}>연패발생</td>
        <td colSpan={2} style={{ ...mkAssistHdr, background: "#60497b", color: "#e5281a" }}>어시Q픽</td>
      </tr>
      {/* 13행: 5Miss / 발생N회 / N회대기 + 2패시 */}
      {visiblePasi.map(({ p, originalIndex }, i) => {
        const isFirst = i === 0;  // 2패시 = 13행 (좌측에 5Miss 블록)
        return (
          <tr key={`${name}-pasi-${p.level}`}>
            {isFirst ? (
              <>
                <td style={mkAssistHdr}><NumIn value={s.miss_threshold ?? 5} min={2} max={10} onChange={(v) => onChange({ ...s, miss_threshold: v })} />Miss</td>
                <td style={mkAssistHdr}>발생<NumIn value={s.miss_occur ?? 2} min={1} max={10} onChange={(v) => onChange({ ...s, miss_occur: v })} />회</td>
                <td style={mkAssistHdr}><NumIn value={s.miss_wait ?? 9} min={1} max={20} onChange={(v) => onChange({ ...s, miss_wait: v })} />회대기</td>
              </>
            ) : (
              <td colSpan={3} style={mkCell}></td>
            )}
            <td colSpan={2} style={{ ...mkRed, background: "#16365c", color: "#fff" }}>
              <NumIn value={p.level ?? (originalIndex + 2)} min={1} max={20} color="#fff" width={38} bg="#16365c" onChange={(v) => setPasi(originalIndex, { level: v })} />패시
            </td>
            <td style={{ ...mkCell, background: "#16365c" }}><AssistSelect value={p.assist1} onChange={(v) => setPasi(originalIndex, { assist1: v })} /></td>
            <td style={{ ...mkCell, background: "#16365c", color: "#fff" }}>1회</td>
            <td colSpan={1} style={{ ...mkNavy, background: "#60497b", color: "#fff" }}>
              <NumIn value={p.q_level ?? p.level ?? (originalIndex + 2)} min={1} max={20} color="#fff" width={38} bg="#60497b" onChange={(v) => setPasi(originalIndex, { q_level: v })} />패시
            </td>
            <td style={{ ...mkAssist2, background: "#60497b" }}>
              <AssistSelect value={p.assist2} onChange={(v) => setPasi(originalIndex, { assist2: v })} sx={{ background: "#60497b", color: "#fff", borderColor: "#8067a0", fontWeight: "bold" }} />
            </td>
            <td style={{ ...mkAssist2, background: "#60497b", color: "#fff" }}>1회</td>
          </tr>
        );
      })}
    </>
  );
}

// ─── 글로벌히트 Point/복원 표 (260525 요청) ───
const GH_POINT_PATTERNS = ["PPP", "BBB", "PPB", "BBP", "PBP", "BPB", "PBB", "BPP"];
// 표시 전용 원안 승점 (3라운드1조). 편집 불가 · 복원 기준.
const GH_ORIG_POINTS = [
  { key: "1shit", val: "3P" },
  { key: "2shit", val: "2P" },
  { key: "3shit", val: "1P" },
  { key: "3miss", val: "-6P" },
];
// 3연적중 발동 조건 (제목 토글): 3연적중(=3연승)~10연승 + 2연패~10연패 (사용안함 없음)
const GH_TRIGGER_OPTS = [
  "3연적중", "4연승", "5연승", "6연승", "7연승", "8연승", "9연승", "10연승",
  "2연패", "3연패", "4연패", "5연패", "6연패", "7연패", "8연패", "9연패", "10연패",
];
// 강제 픽 (셀 토글): 사용안함 + 자기 자신 제외한 7패턴 (행마다 다름 — PointSection 내 forceOptsFor 사용)
// 회차적중 1~5P / 회차미적 0~−5P 토글
const GH_HIT_OPTS = [1, 2, 3, 4, 5];
const GH_MISS_OPTS = [0, -1, -2, -3, -4, -5];

function defaultGhPoint() {
  const patterns = {};
  GH_POINT_PATTERNS.forEach((p) => {
    patterns[p] = { inout: "IN", force_pick: null };  // IN/OUT·3연적중은 패턴별
  });
  // 회차적중/회차미적은 전역(모든 패턴 공통)
  return { hit_point: 1, miss_point: 0, applied: false, force_trigger: "3연적중", patterns };
}

function PatLabel({ pat }) {
  return (
    <span style={{ fontWeight: "bold" }}>
      {pat.split("").map((c, i) => (
        <span key={i} style={{ color: c === "P" ? "#5b9bd5" : "#e06666" }}>{c}</span>
      ))}
    </span>
  );
}

function PointSection({ ghPoint, onChange, onRestore }) {
  const pts = ghPoint?.patterns || {};
  const get = (pat) => pts[pat] || { inout: "IN", force_pick: null };
  const setPat = (pat, upd) => onChange({ ...ghPoint, patterns: { ...pts, [pat]: { ...get(pat), ...upd } } });
  // 회차적중/회차미적 = 전역 (모든 패턴 공통). IN/OUT·3연적중만 패턴별.
  const hitPoint = ghPoint?.hit_point ?? 1;
  const missPoint = ghPoint?.miss_point ?? 0;
  // "회차단위 적용" = 헤더 클릭으로 토글되는 명시적 플래그 (마스터 enable/disable).
  // 셀 값 변경은 파라미터 조정일 뿐 자동 켜지지 않음 — 켜야 회차단위 점수, 끄면 옛날 3라운드1조 승점.
  const applied = !!ghPoint?.applied;
  const toggleApplied = () => onChange({ ...ghPoint, applied: !applied });
  const trigger = ghPoint?.force_trigger ?? GH_TRIGGER_OPTS[0];
  const cycleTrigger = () => {
    const i = GH_TRIGGER_OPTS.indexOf(trigger);
    onChange({ ...ghPoint, force_trigger: GH_TRIGGER_OPTS[(i + 1) % GH_TRIGGER_OPTS.length] });
  };
  const cycleForce = (pat) => {
    // 자기 자신 제외한 7패턴 + 사용안함
    const opts = [null, ...GH_POINT_PATTERNS.filter((p) => p !== pat)];
    const cur = get(pat).force_pick ?? null;
    const i = opts.indexOf(cur);
    setPat(pat, { force_pick: opts[(i + 1) % opts.length] });
  };
  const toggleInout = (pat) => setPat(pat, { inout: get(pat).inout === "OUT" ? "IN" : "OUT" });

  const dispHeader = { ...headerStyle, opacity: 0.5 };
  const indHeader = (on) => ({ ...headerStyle, backgroundColor: on ? "rgba(76,175,80,0.4)" : headerStyle.backgroundColor });
  const outCell = { ...cellStyle, backgroundColor: "rgba(198,40,40,0.25)", color: "#e57373", cursor: "pointer", fontWeight: "bold" };

  return (
    <table style={{ borderCollapse: "collapse", width: "fit-content" }}>
      <tbody>
        <tr>
          <td colSpan={9} style={{ border: "none", padding: "0 0 6px 0" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Box sx={{ backgroundColor: GREEN, color: "#1b2e1b", fontWeight: "bold", borderRadius: 1, px: 1.5, py: 0.5, fontSize: 14 }}>point</Box>
              <Box onClick={onRestore} sx={{ backgroundColor: "#333", color: "#ccc", fontWeight: "bold", borderRadius: 1, px: 1.5, py: 0.5, fontSize: 14, cursor: "pointer", "&:hover": { backgroundColor: "#444" } }}>복원</Box>
            </Box>
          </td>
        </tr>
        <tr>
          <td style={headerStyle}></td>
          <td style={dispHeader}>1shit</td>
          <td style={dispHeader}>2shit</td>
          <td style={dispHeader}>3shit</td>
          <td style={dispHeader}>3miss</td>
          <td style={headerStyle}>IN/OUT</td>
          <td style={{ ...indHeader(applied), cursor: "pointer" }} onClick={toggleApplied} title="회차단위 적용 토글">회차적중</td>
          <td style={{ ...indHeader(applied), cursor: "pointer" }} onClick={toggleApplied} title="회차단위 적용 토글">회차미적</td>
          <td style={{ ...headerStyle, cursor: "pointer" }} onClick={cycleTrigger} title="발동조건: 클릭으로 변경 (3연적중~10연승 / 2연패~10연패)">{trigger}</td>
        </tr>
        {GH_POINT_PATTERNS.map((pat) => {
          const c = get(pat);
          const out = c.inout === "OUT";
          return (
            <tr key={pat}>
              <td style={labelCellStyle}><PatLabel pat={pat} /></td>
              {GH_ORIG_POINTS.map((o) => (
                <td key={o.key} style={{ ...normalCell, color: "#888" }}>{o.val}</td>
              ))}
              <td style={out ? outCell : greenCell} onClick={() => toggleInout(pat)}>{out ? "OUT" : "IN"}</td>
              <td style={editableCell} onClick={() => onChange({ ...ghPoint, hit_point: GH_HIT_OPTS[(GH_HIT_OPTS.indexOf(hitPoint) + 1) % GH_HIT_OPTS.length] })}>{hitPoint}P</td>
              <td style={editableCell} onClick={() => onChange({ ...ghPoint, miss_point: GH_MISS_OPTS[(GH_MISS_OPTS.indexOf(missPoint) + 1) % GH_MISS_OPTS.length] })}>{missPoint}P</td>
              <td style={editableCell} onClick={() => cycleForce(pat)}>
                {c.force_pick ? <PatLabel pat={c.force_pick} /> : <span style={{ color: "#777" }}>사용안함</span>}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

const GAME_BACK_PATHS = {
  t9: { admin: "/t9game", user: "/t9game/user" },
  hb: { admin: "/hbgame", user: "/hbgame/user" },
  gh: { admin: "/ghgame", user: "/ghgame/user" },
  nc: { admin: "/ncgame", user: "/ncgame/user" },
  wh: { admin: "/whgame", user: "/whgame/user" },
  mh: { admin: "/mhgame", user: "/mhgame/user" },
  dh: { admin: "/dhgame", user: "/dhgame/user" },
};

const DEFAULT_MARTIN = {
  enabled: false,
  budget: 0,
  bet_type: "martin",
  step_min: 1,
  step_max: 20,
  amounts: new Array(20).fill(0),
};
const DEFAULT_FAIL = {
  ...DEFAULT_MARTIN,
  fail_count: 2,
};

// 260608 리뉴얼용 GH 전용 페이지 — common/user-setup.jsx 복사본 (다른 게임은 common 그대로 사용)
export default function GhUserSetupPage() {
  const gameType = "gh";
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [config, setConfig] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [snack, setSnack] = useState({ open: false, message: "", severity: "success" });

  const blocker = useBlocker(dirty);

  useEffect(() => {
    if (!dirty) return;
    const handler = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  useEffect(() => {
    apiCaller.get(USER_BET_SETTINGS_API.GET(gameType)).then((res) => {
      setConfig(res.data.config);
    });
  }, [gameType]);

  const handleSave = async () => {
    if (!dirty) return;
    setSaving(true);
    try {
      const res = await apiCaller.put(USER_BET_SETTINGS_API.SAVE(gameType), { config });
      setConfig(res.data.config);
      setDirty(false);
      setSnack({ open: true, message: "설정이 저장되었습니다.", severity: "success" });
    } catch (err) {
      setSnack({ open: true, message: err?.response?.data?.detail || "저장 실패", severity: "error" });
    } finally { setSaving(false); }
  };

  const handleBack = () => {
    const backPaths = GAME_BACK_PATHS[gameType];
    const path = backPaths.user;
    const gid = searchParams.get("gameId");
    navigate(gid ? `${path}?gameId=${gid}` : path);
  };

  const updateMartin = (key, martin) => {
    setConfig((prev) => ({ ...prev, [key]: martin }));
    setDirty(true);
  };

  // Point 복원: IN/OUT→IN, 회차적중→1, 회차미적→0. 3연적중(force_trigger/force_pick)은 유지.
  const restoreGhPoint = () => {
    setConfig((prev) => {
      const cur = (prev && prev.gh_point) || defaultGhPoint();
      const patterns = { ...(cur.patterns || {}) };
      GH_POINT_PATTERNS.forEach((p) => {
        patterns[p] = { ...(patterns[p] || {}), inout: "IN" };  // force_pick 유지
      });
      // 회차점수(전역) 1/0 복원 + 명시적 applied 해제 → 옛날 3라운드1조 승점으로. force_trigger 유지.
      return { ...prev, gh_point: { ...cur, hit_point: 1, miss_point: 0, applied: false, patterns } };
    });
    setDirty(true);
  };

  if (!config) return <Box sx={{ p: 2, color: "#888" }}>불러오는 중...</Box>;

  const martinA = config.martin_a || { ...DEFAULT_MARTIN, enabled: true };
  const martinZ = config.martin_z || { ...DEFAULT_MARTIN };
  const cruise = config.cruise || { ...DEFAULT_MARTIN };
  const martinS = config.martin_s || { ...DEFAULT_MARTIN };
  const allp = config.allp || { ...DEFAULT_MARTIN };
  const allb = config.allb || { ...DEFAULT_MARTIN };
  const fail = config.fail || { ...DEFAULT_FAIL };
  const hnh = config.hnh || { ...DEFAULT_MARTIN };
  const one = config.one || { ...DEFAULT_MARTIN };
  const two = config.two || { ...DEFAULT_MARTIN };
  const labouchere = config.labouchere || { enabled: false, target: 0, count: 10, mode: "even", sequence: [] };
  const ghPoint = config.gh_point || defaultGhPoint();

  return (
    <Box sx={{ p: 2 }}>
      {/* 상단 바 */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
        <Box onClick={handleBack}
          sx={{ display: "inline-flex", alignItems: "center", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 1, px: 1.5, py: 0.5, cursor: "pointer", backgroundColor: "background.paper", "&:hover": { backgroundColor: "rgba(255,255,255,0.1)" } }}>
          <Typography variant="caption" sx={{ fontSize: 12 }}>&larr; 뒤로가기</Typography>
        </Box>
        <Box onClick={handleSave}
          sx={{ display: "inline-flex", alignItems: "center", border: `1px solid ${dirty ? GREEN : "rgba(255,255,255,0.2)"}`, borderRadius: 1, px: 1.5, py: 0.5, cursor: dirty ? "pointer" : "default", backgroundColor: dirty ? GREEN : "transparent", color: dirty ? "#fff" : "#666", opacity: saving ? 0.5 : 1, "&:hover": dirty ? { backgroundColor: "#388e3c" } : {} }}>
          <Typography variant="caption" sx={{ fontSize: 12, fontWeight: "bold" }}>{saving ? "저장 중..." : "저장"}</Typography>
        </Box>
      </Box>

      {gameType === "gh" && (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1, mb: 2, p: 1, border: "1px solid rgba(255,255,255,0.2)", borderRadius: 1 }}>
          <Typography variant="caption" sx={{ fontSize: 11, color: "#bbb", fontWeight: "bold" }}>오토 운영 옵션</Typography>

          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Typography variant="caption" sx={{ fontSize: 12, color: "#aaa", minWidth: 110 }}>목표액 (원)</Typography>
            <input
              type="number"
              value={config.auto_goal_amount ?? 0}
              onChange={(e) => {
                const v = parseInt(e.target.value || "0", 10) || 0;
                setConfig((prev) => ({ ...prev, auto_goal_amount: v }));
                setDirty(true);
              }}
              style={{ width: 140, padding: "4px 6px", background: "#16213e", color: "#fff", border: "1px solid #2a3a5a", borderRadius: 4, fontSize: 12 }}
            />
            <Typography variant="caption" sx={{ fontSize: 10, color: "#666" }}>
              0이면 무제한. 누적 PnL이 이 값 이상이면 자동 종료.
            </Typography>
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Typography variant="caption" sx={{ fontSize: 12, color: "#aaa", minWidth: 110 }}>종료 회차</Typography>
            <input
              type="number"
              value={config.auto_end_round ?? 0}
              onChange={(e) => {
                const v = parseInt(e.target.value || "0", 10) || 0;
                setConfig((prev) => ({ ...prev, auto_end_round: v }));
                setDirty(true);
              }}
              style={{ width: 140, padding: "4px 6px", background: "#16213e", color: "#fff", border: "1px solid #2a3a5a", borderRadius: 4, fontSize: 12 }}
            />
            <Typography variant="caption" sx={{ fontSize: 10, color: "#666" }}>
              0이면 무제한. 베팅 시작 후 이 회차에 도달하면 종료.
            </Typography>
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Typography variant="caption" sx={{ fontSize: 12, color: "#aaa", minWidth: 110 }}>단계 해소</Typography>
            <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={!!config.auto_clear_stage}
                onChange={(e) => {
                  setConfig((prev) => ({ ...prev, auto_clear_stage: e.target.checked }));
                  setDirty(true);
                }}
              />
              <Typography variant="caption" sx={{ fontSize: 12, color: "#ddd" }}>
                종료회차 도달 시 단계가 1단계 아니면 적중까지 연장
              </Typography>
            </label>
          </Box>
        </Box>
      )}

      <Box sx={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "fit-content" }}>
          <tbody>
            <MartinSection name="martin_a" label="마틴A" martin={martinA} onChange={(m) => updateMartin("martin_a", m)} />
            <tr><td colSpan={6} style={{ height: 12 }}></td></tr>
            <MartinSection name="martin_z" label="마틴Z" martin={martinZ} onChange={(m) => updateMartin("martin_z", m)} />
          </tbody>
        </table>
      </Box>

      {/* 전략별 셋업 박스 (260620) — 마틴Z 아래. full: AAR/SSR1~3 / short: SQ/SX/D/G/TN/ONE/TWO */}
      {gameType === "gh" && (
        <Box sx={{ overflowX: "auto", mt: 2 }}>
          {STRATEGY_SETUP_BOXES.map((b) => (
            <Box key={b.key} sx={{ mb: 1.5 }}>
              {/* 라벨 박스 (전략명 + variant 구분색) */}
              <Box sx={{ display: "inline-block", backgroundColor: b.variant === "full" ? "#c62828" : "#1565c0",
                color: "#fff", fontWeight: "bold", borderRadius: 1, px: 1.5, py: 0.3, fontSize: 13, mb: 0.5 }}>
                {b.label || b.key}
              </Box>
              <table style={{ borderCollapse: "collapse", tableLayout: "fixed", width: 840 }}>
                {/* 시안과 동일: 10열 × 84px 고정 격자 → colSpan 섞여도 네모반듯 */}
                <colgroup>
                  {Array.from({ length: 10 }, (_, i) => <col key={i} style={{ width: 84 }} />)}
                </colgroup>
                <tbody>
                  <StrategySetupSection
                    name={b.label || b.key} variant={b.variant} aarLabel={b.aarLabel} sections={b.sections}
                    strat={config[b.key] || defaultStrategySetup()}
                    onChange={(o) => updateMartin(b.key, o)} />
                </tbody>
              </table>
            </Box>
          ))}
        </Box>
      )}

      <Box sx={{ overflowX: "auto", mt: 2 }}>
        <table style={{ borderCollapse: "collapse", width: "fit-content" }}>
          <tbody>
            {gameType === "gh" && (
              <>
                <LabouchereSection labouchere={labouchere} onChange={(m) => updateMartin("labouchere", m)} />
                <tr><td colSpan={6} style={{ height: 12 }}></td></tr>
                <MartinSection name="cruise" label="크루즈" martin={cruise} onChange={(m) => updateMartin("cruise", m)} labelColor="#0097a7" />
                <tr><td colSpan={6} style={{ height: 12 }}></td></tr>
                <MartinSection name="martin_s" label="마틴S" martin={martinS} onChange={(m) => updateMartin("martin_s", m)} labelColor="#795548" />
              </>
            )}
            {gameType === "gh" && (
              <>
                <tr><td colSpan={6} style={{ height: 12 }}></td></tr>
                <MartinSection name="allp" label="AllP" martin={allp} onChange={(m) => updateMartin("allp", m)} labelColor="#6a1b9a" />
                <tr><td colSpan={6} style={{ height: 12 }}></td></tr>
                <MartinSection name="allb" label="AllB" martin={allb} onChange={(m) => updateMartin("allb", m)} labelColor="#00695c" />
                <tr><td colSpan={6} style={{ height: 12 }}></td></tr>
                <FailSection martin={fail} onChange={(m) => updateMartin("fail", m)} />
                <tr><td colSpan={6} style={{ height: 12 }}></td></tr>
                <MartinSection name="hnh" label="HnH" martin={hnh} onChange={(m) => updateMartin("hnh", m)} labelColor="#558b2f" />
                <tr><td colSpan={6} style={{ height: 12 }}></td></tr>
                <MartinSection name="one" label="ONE/TWO" martin={one} onChange={(m) => { updateMartin("one", m); updateMartin("two", m); }} labelColor="#00838f" />
              </>
            )}
          </tbody>
        </table>
      </Box>

      {gameType === "gh" && (
        <Box sx={{ overflowX: "auto", mt: 3 }}>
          <PointSection ghPoint={ghPoint} onChange={(v) => updateMartin("gh_point", v)} onRestore={restoreGhPoint} />
        </Box>
      )}

      {/* 이탈 경고 */}
      <Dialog open={blocker.state === "blocked"}
        PaperProps={{ sx: { backgroundColor: "#1a1a1a", border: "1px solid #333" } }}>
        <DialogTitle sx={{ color: "#fff" }}>저장하지 않은 변경사항</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: "#ccc" }}>저장하지 않은 변경사항이 있습니다. 페이지를 나가시겠습니까?</Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => blocker.reset()} sx={{ color: "#888" }}>취소</Button>
          <Button onClick={() => blocker.proceed()} variant="contained"
            sx={{ backgroundColor: "#d32f2f", "&:hover": { backgroundColor: "#b71c1c" } }}>나가기</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snack.open} autoHideDuration={3000}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert severity={snack.severity} onClose={() => setSnack((s) => ({ ...s, open: false }))}>{snack.message}</Alert>
      </Snackbar>
    </Box>
  );
}
