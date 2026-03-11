import { useState, useEffect, useCallback } from "react";
import { Box, Typography, Snackbar, Alert, Dialog, DialogTitle, DialogContent, DialogActions, Button } from "@mui/material";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useBlocker } from "react-router-dom";
import { useAtomValue } from "jotai";
import apiCaller from "@/services/api-caller";
import { SETTINGS_API } from "@/constants/api-url";
import { userAtom } from "@/store/auth-store";

const GREEN = "#4caf50";
const LIGHT_BLUE = "#29b6f6";
const LABEL_COLOR = "#c62828";
const CELL_BORDER = "1px solid #555";
const LABEL_BG = "rgba(255,255,255,0.04)";

const BET_TYPES = ["martin", "kkangbet", "fixed", "cruise"];
const BET_TYPE_LABELS = { martin: "마틴", kkangbet: "깡벳", fixed: "고정벳", cruise: "크루즈" };
const DISABLED_BET_TYPES = ["cruise"];

function calcAmounts(amounts, editedIdx, editedVal, betType, stepMin, stepMax) {
  const newAmounts = [...amounts];
  newAmounts[editedIdx] = editedVal;
  const minIdx = stepMin - 1;
  const maxIdx = stepMax - 1;

  if (betType === "martin" || betType === "kkangbet") {
    // 마틴/깡벳: 2배씩 증가. 입력한 단계 기준으로 위/아래 계산
    for (let i = editedIdx + 1; i <= maxIdx; i++) {
      newAmounts[i] = newAmounts[i - 1] * 2;
    }
    for (let i = editedIdx - 1; i >= minIdx; i--) {
      newAmounts[i] = Math.max(Math.round(newAmounts[i + 1] / 2), 1);
    }
  } else if (betType === "fixed") {
    // 고정벳: 동일 금액
    for (let i = minIdx; i <= maxIdx; i++) {
      newAmounts[i] = editedVal;
    }
  }
  return newAmounts;
}

const cellStyle = {
  border: CELL_BORDER,
  padding: "3px 6px",
  fontSize: 13,
  textAlign: "center",
  whiteSpace: "nowrap",
  minWidth: 70,
};

const labelCellStyle = {
  ...cellStyle,
  fontWeight: "bold",
  color: LABEL_COLOR,
  backgroundColor: LABEL_BG,
  textAlign: "left",
  minWidth: 70,
};

const greenCell = {
  ...cellStyle,
  backgroundColor: GREEN,
  color: "#1b2e1b",
  fontWeight: "bold",
  cursor: "pointer",
};

const blueCell = {
  ...cellStyle,
  backgroundColor: LIGHT_BLUE,
  color: "#fff",
  fontWeight: "bold",
};

const normalCell = { ...cellStyle };

const headerStyle = {
  border: CELL_BORDER,
  padding: "4px 8px",
  fontSize: 14,
  fontWeight: "bold",
  textAlign: "center",
  backgroundColor: "rgba(255,255,255,0.08)",
};

const editableCell = {
  ...cellStyle,
  cursor: "pointer",
  position: "relative",
};

// 인라인 편집 셀
function EditableCell({ value, onChange, prefix = "", suffix = "", style = normalCell, disabled = false }) {
  const [editing, setEditing] = useState(false);
  const [tempVal, setTempVal] = useState(String(value));

  const handleClick = () => {
    if (disabled) return;
    setTempVal(String(value));
    setEditing(true);
  };

  const handleBlur = () => {
    setEditing(false);
    const num = parseInt(tempVal, 10);
    if (!isNaN(num) && num !== value) {
      onChange(num);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.target.blur();
    } else if (e.key === "Escape") {
      setEditing(false);
    }
  };

  if (editing) {
    return (
      <td style={style}>
        <input
          autoFocus
          value={tempVal}
          onChange={(e) => setTempVal(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          size={Math.max(tempVal.length, 1)}
          style={{
            width: `${Math.max(tempVal.length, 1)}ch`,
            boxSizing: "content-box",
            padding: 0,
            margin: 0,
            background: "transparent",
            border: "none",
            borderBottom: "1px solid #4caf50",
            color: style === greenCell ? "#1b2e1b" : "#fff",
            textAlign: "center",
            fontSize: 13,
            outline: "none",
          }}
        />
      </td>
    );
  }

  return (
    <td style={style} onClick={handleClick}>
      {prefix}{prefix === "" && !value ? "" : value}{suffix}
    </td>
  );
}

// 토글 셀 (배팅종류, 섹션 on/off 등)
function ToggleCell({ active, label, onClick, disabled = false }) {
  const disabledStyle = { ...normalCell, color: "#555", cursor: "not-allowed" };
  return (
    <td
      style={disabled ? disabledStyle : active ? greenCell : normalCell}
      onClick={disabled ? undefined : onClick}
    >
      {label}
    </td>
  );
}

// Section 1 & 3: Triplenine / Pinch
function BettingSection({ title, data, onChange, disabled }) {
  if (!data) return null;

  const handleBetType = (type) => {
    if (disabled || DISABLED_BET_TYPES.includes(type)) return;
    onChange({ ...data, bet_type: type });
  };

  const handleAmount = (idx, val) => {
    const newAmounts = calcAmounts(data.amounts, idx, val, data.bet_type, data.step_min, data.step_max);
    onChange({ ...data, amounts: newAmounts });
  };

  return (
    <table style={{ borderCollapse: "collapse", width: "fit-content", marginBottom: 16 }}>
      <thead>
        <tr><td colSpan={7} style={headerStyle}>{title}</td></tr>
      </thead>
      <tbody>
        <tr>
          <td style={labelCellStyle}>배팅종류</td>
          {BET_TYPES.map((t) => (
            <ToggleCell key={t} active={data.bet_type === t} label={BET_TYPE_LABELS[t]} onClick={() => handleBetType(t)} disabled={disabled || DISABLED_BET_TYPES.includes(t)} />
          ))}
          <td style={normalCell}></td>
          <td style={normalCell}></td>
        </tr>
        <tr>
          <td style={labelCellStyle}>단계설정</td>
          <td style={normalCell}>최저</td>
          <EditableCell value={data.step_min} onChange={(v) => {
            const update = { ...data, step_min: v };
            if (v >= data.step_max) update.step_max = v + 1;
            onChange(update);
          }} suffix="단계" style={greenCell} disabled={disabled} />
          <td style={normalCell}>최고</td>
          <EditableCell value={data.step_max} onChange={(v) => {
            const update = { ...data, step_max: v };
            if (v <= data.step_min) update.step_min = v - 1;
            onChange(update);
          }} suffix="단계" style={greenCell} disabled={disabled} />
          <td style={normalCell}></td>
          <td style={normalCell}></td>
        </tr>
        {[0, 1, 2, 3].map((rowIdx) => (
          <tr key={`amt-${rowIdx}`}>
            {rowIdx === 0 && <td rowSpan={4} style={labelCellStyle}>금액설정</td>}
            {data.amounts.slice(rowIdx * 5, rowIdx * 5 + 5).map((amt, i) => {
              const idx = rowIdx * 5 + i;
              const step = idx + 1;
              const inRange = step >= data.step_min && step <= data.step_max;
              return (
                <EditableCell
                  key={idx}
                  value={inRange ? amt : 0}
                  onChange={(v) => handleAmount(idx, v)}
                  prefix={`${step}:`}
                  suffix="P"
                  style={inRange ? editableCell : normalCell}
                  disabled={disabled || !inRange}
                />
              );
            })}
            <td style={normalCell}></td>
          </tr>
        ))}
        <tr>
          <td style={labelCellStyle}>게임설정</td>
          <EditableCell value={data.game_start} onChange={(v) => onChange({ ...data, game_start: v })} suffix={data.game_start === 0 ? "1회시작" : "회시작"} prefix={data.game_start === 0 ? "" : undefined} style={greenCell} disabled={disabled} />
          <EditableCell value={data.game_end} onChange={(v) => onChange({ ...data, game_end: v })} suffix={data.game_end === 0 ? "끝까지" : "회마감"} prefix={data.game_end === 0 ? "" : undefined} style={greenCell} disabled={disabled} />
          <td style={labelCellStyle}>단계미처리시</td>
          <td
            style={{ ...(data.step_carry_over ? greenCell : normalCell), minWidth: 100 }}
            onClick={disabled ? undefined : () => onChange({ ...data, step_carry_over: !data.step_carry_over })}
          >
            {data.step_carry_over ? "다음게임적용" : "초기화"}
          </td>
          <td style={normalCell}></td>
          <td style={normalCell}></td>
        </tr>
      </tbody>
    </table>
  );
}

const PINCH_METHODS = ["pattern", "LongJ", "1LSC", "2LSC", "3LSC", "4LSC"];

// 트리플나인 총 손실액 계산
function calcTotalLoss(tnData) {
  if (!tnData) return 0;
  let total = 0;
  for (let i = tnData.step_min - 1; i <= tnData.step_max - 1 && i < tnData.amounts.length; i++) {
    total += tnData.amounts[i];
  }
  return total;
}

// Section 3: Pinch (BettingSection + 손실 분배)
function PinchSection({ data, onChange, disabled, triplenineData }) {
  if (!data) return null;

  const totalLoss = calcTotalLoss(triplenineData);
  const rawDist = data.pinch_distribution || { pattern: 0, LongJ: 0, "1LSC": 0, "2LSC": 0, "3LSC": 0, "4LSC": 0 };
  // 4LSC는 항상 잔여분으로 동적 계산
  const lastMethod = PINCH_METHODS[PINCH_METHODS.length - 1];
  const othersSum = PINCH_METHODS.slice(0, -1).reduce((sum, m) => sum + (rawDist[m] || 0), 0);
  const dist = { ...rawDist, [lastMethod]: Math.max(totalLoss - othersSum, 0) };

  const handleBetType = (type) => {
    if (disabled || DISABLED_BET_TYPES.includes(type)) return;
    onChange({ ...data, bet_type: type });
  };

  const handleAmount = (idx, val) => {
    const newAmounts = calcAmounts(data.amounts, idx, val, data.bet_type, data.step_min, data.step_max);
    onChange({ ...data, amounts: newAmounts });
  };

  const handleDistChange = (method, val) => {
    const newDist = { ...dist, [method]: val };
    // 마지막 방법(4LSC)은 잔여를 자동 흡수
    const lastMethod = PINCH_METHODS[PINCH_METHODS.length - 1];
    if (method !== lastMethod) {
      const othersSum = PINCH_METHODS.slice(0, -1).reduce((sum, m) => sum + (newDist[m] || 0), 0);
      newDist[lastMethod] = Math.max(totalLoss - othersSum, 0);
    }
    onChange({ ...data, pinch_distribution: newDist });
  };

  const handleEqualSplit = () => {
    if (disabled) return;
    const base = Math.floor(totalLoss / PINCH_METHODS.length);
    const remainder = totalLoss - base * PINCH_METHODS.length;
    const newDist = {};
    PINCH_METHODS.forEach((m, i) => {
      newDist[m] = base + (i === PINCH_METHODS.length - 1 ? remainder : 0);
    });
    onChange({ ...data, pinch_distribution: newDist });
  };

  const distSum = PINCH_METHODS.reduce((sum, m) => sum + (dist[m] || 0), 0);
  const remaining = totalLoss - distSum;

  return (
    <table style={{ borderCollapse: "collapse", width: "fit-content", marginBottom: 16 }}>
      <thead>
        <tr><td colSpan={7} style={headerStyle}>pinch</td></tr>
      </thead>
      <tbody>
        <tr>
          <td style={labelCellStyle}>배팅종류</td>
          {BET_TYPES.map((t) => (
            <ToggleCell key={t} active={data.bet_type === t} label={BET_TYPE_LABELS[t]} onClick={() => handleBetType(t)} disabled={disabled || DISABLED_BET_TYPES.includes(t)} />
          ))}
          <td style={normalCell}></td>
          <td style={normalCell}></td>
        </tr>
        <tr>
          <td style={labelCellStyle}>단계설정</td>
          <td style={normalCell}>최저</td>
          <EditableCell value={data.step_min} onChange={(v) => {
            const update = { ...data, step_min: v };
            if (v >= data.step_max) update.step_max = v + 1;
            onChange(update);
          }} suffix="단계" style={greenCell} disabled={disabled} />
          <td style={normalCell}>최고</td>
          <EditableCell value={data.step_max} onChange={(v) => {
            const update = { ...data, step_max: v };
            if (v <= data.step_min) update.step_min = v - 1;
            onChange(update);
          }} suffix="단계" style={greenCell} disabled={disabled} />
          <td style={normalCell}></td>
          <td style={normalCell}></td>
        </tr>
        {[0, 1, 2, 3].map((rowIdx) => (
          <tr key={`amt-${rowIdx}`}>
            {rowIdx === 0 && <td rowSpan={4} style={labelCellStyle}>금액설정</td>}
            {data.amounts.slice(rowIdx * 5, rowIdx * 5 + 5).map((amt, i) => {
              const idx = rowIdx * 5 + i;
              const step = idx + 1;
              const inRange = step >= data.step_min && step <= data.step_max;
              return (
                <EditableCell
                  key={idx}
                  value={inRange ? amt : 0}
                  onChange={(v) => handleAmount(idx, v)}
                  prefix={`${step}:`}
                  suffix="P"
                  style={inRange ? editableCell : normalCell}
                  disabled={disabled || !inRange}
                />
              );
            })}
            <td style={normalCell}></td>
          </tr>
        ))}
        <tr>
          <td style={labelCellStyle}>게임설정</td>
          <EditableCell value={data.game_start} onChange={(v) => onChange({ ...data, game_start: v })} suffix={data.game_start === 0 ? "1회시작" : "회시작"} prefix={data.game_start === 0 ? "" : undefined} style={greenCell} disabled={disabled} />
          <EditableCell value={data.game_end} onChange={(v) => onChange({ ...data, game_end: v })} suffix={data.game_end === 0 ? "끝까지" : "회마감"} prefix={data.game_end === 0 ? "" : undefined} style={greenCell} disabled={disabled} />
          <td style={labelCellStyle}>단계미처리시</td>
          <td
            style={{ ...(data.step_carry_over ? greenCell : normalCell), minWidth: 100 }}
            onClick={disabled ? undefined : () => onChange({ ...data, step_carry_over: !data.step_carry_over })}
          >
            {data.step_carry_over ? "다음게임적용" : "초기화"}
          </td>
          <td style={normalCell}></td>
          <td style={normalCell}></td>
        </tr>
        {/* 손실 분배 */}
        <tr>
          <td style={{ ...labelCellStyle, color: "#ff9800" }}>손실분배</td>
          {PINCH_METHODS.map((m) => (
            <td key={m} style={{ ...normalCell, color: "#00bcd4", fontWeight: "bold" }}>{m}</td>
          ))}
        </tr>
        <tr>
          <td style={labelCellStyle}>
            <span style={{ fontSize: 9, color: "#888" }}>{totalLoss.toLocaleString()}P</span>
            {!disabled && (
              <span
                style={{ fontSize: 9, color: "#4caf50", cursor: "pointer", marginLeft: 4 }}
                onClick={handleEqualSplit}
              >
                [균등]
              </span>
            )}
          </td>
          {PINCH_METHODS.map((m, i) => {
            const isLast = i === PINCH_METHODS.length - 1;
            return (
              <EditableCell
                key={m}
                value={dist[m] || 0}
                onChange={(v) => handleDistChange(m, v)}
                suffix="P"
                style={isLast ? { ...editableCell, color: "#ff9800" } : editableCell}
                disabled={disabled || isLast}
              />
            );
          })}
        </tr>
        {remaining !== 0 && (
          <tr>
            <td colSpan={7} style={{ ...normalCell, color: "#f44336", fontSize: 9, textAlign: "left" }}>
              잔여: {remaining.toLocaleString()}P (합계가 총 손실액과 다릅니다)
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

// Section 2: GlobalHit
function GlobalHitSection({ data, onChange, disabled }) {
  if (!data) return null;
  const patterns = ["PPP", "BBB", "PBP", "BPB", "PPB", "BBP", "PBB", "BPP"];

  const handleBetType = (type) => {
    if (disabled || DISABLED_BET_TYPES.includes(type)) return;
    onChange({ ...data, bet_type: type });
  };

  const handleAmount = (idx, val) => {
    const newAmounts = calcAmounts(data.amounts, idx, val, data.bet_type, data.step_min, data.step_max);
    onChange({ ...data, amounts: newAmounts });
  };

  const handlePatternToggle = (pat, secIdx) => {
    if (disabled) return;
    const newPatterns = { ...data.patterns };
    const arr = [...newPatterns[pat]];
    arr[secIdx] = !arr[secIdx];
    newPatterns[pat] = arr;
    onChange({ ...data, patterns: newPatterns });
  };

  const handleGameStart = (secIdx, val) => {
    const newStarts = [...data.game_start];
    newStarts[secIdx] = val;
    onChange({ ...data, game_start: newStarts });
  };

  const handleGameEnd = (secIdx, val) => {
    const newEnds = [...data.game_end];
    newEnds[secIdx] = val;
    onChange({ ...data, game_end: newEnds });
  };

  return (
    <table style={{ borderCollapse: "collapse", width: "fit-content", marginBottom: 16 }}>
      <thead>
        <tr><td colSpan={6} style={headerStyle}>globalhit</td></tr>
      </thead>
      <tbody>
        <tr>
          <td style={labelCellStyle}>배팅종류</td>
          {BET_TYPES.map((t) => (
            <ToggleCell key={t} active={data.bet_type === t} label={BET_TYPE_LABELS[t]} onClick={() => handleBetType(t)} disabled={disabled || DISABLED_BET_TYPES.includes(t)} />
          ))}
          <td style={normalCell}></td>
        </tr>
        <tr>
          <td style={labelCellStyle}>단계설정</td>
          <td style={normalCell}>최저</td>
          <EditableCell value={data.step_min} onChange={(v) => {
            const update = { ...data, step_min: v };
            if (v >= data.step_max) update.step_max = v + 1;
            onChange(update);
          }} suffix="단계" style={greenCell} disabled={disabled} />
          <td style={normalCell}>최고</td>
          <EditableCell value={data.step_max} onChange={(v) => {
            const update = { ...data, step_max: v };
            if (v <= data.step_min) update.step_min = v - 1;
            onChange(update);
          }} suffix="단계" style={greenCell} disabled={disabled} />
          <td style={normalCell}></td>
        </tr>
        {[0, 1, 2, 3].map((rowIdx) => (
          <tr key={`gh-amt-${rowIdx}`}>
            {rowIdx === 0 && <td rowSpan={4} style={labelCellStyle}>금액설정</td>}
            {data.amounts.slice(rowIdx * 5, rowIdx * 5 + 5).map((amt, i) => {
              const idx = rowIdx * 5 + i;
              const step = idx + 1;
              const inRange = step >= data.step_min && step <= data.step_max;
              return (
                <EditableCell
                  key={idx}
                  value={inRange ? amt : 0}
                  onChange={(v) => handleAmount(idx, v)}
                  prefix={`${step}:`}
                  suffix="P"
                  style={inRange ? editableCell : normalCell}
                  disabled={disabled || !inRange}
                />
              );
            })}
          </tr>
        ))}
        {patterns.map((pat) => (
          <tr key={pat}>
            <td style={{ ...labelCellStyle, fontSize: 12 }}>
              {pat.split("").map((c, i) => (
                <span key={i} style={{ color: c === "P" ? "#1565c0" : "#f44336", fontWeight: "bold" }}>{c}</span>
              ))}
            </td>
            {[0, 1, 2].map((secIdx) => (
              <ToggleCell
                key={secIdx}
                active={data.patterns?.[pat]?.[secIdx]}
                label={data.patterns?.[pat]?.[secIdx] ? `섹션${secIdx + 1}운영하기` : `섹션${secIdx + 1}중지`}
                onClick={() => handlePatternToggle(pat, secIdx)}
                disabled={disabled}
              />
            ))}
            <td style={normalCell}></td>
            <td style={normalCell}></td>
          </tr>
        ))}
        <tr>
          <td style={labelCellStyle}>게임설정</td>
          {["섹션1", "섹션2", "섹션3"].map((s, i) => (
            <td key={i} style={labelCellStyle}>{s}</td>
          ))}
          <td style={normalCell}></td>
          <td style={normalCell}></td>
        </tr>
        <tr>
          <td style={labelCellStyle}>게임시작</td>
          {[0, 1, 2].map((i) => (
            <EditableCell key={i} value={data.game_start[i]} onChange={(v) => handleGameStart(i, v)} suffix={data.game_start[i] === 0 ? "(1회시작)" : "회시작"} style={greenCell} disabled={disabled} />
          ))}
          <td style={normalCell}></td>
          <td style={normalCell}></td>
        </tr>
        <tr>
          <td style={labelCellStyle}>게임마감</td>
          {[0, 1, 2].map((i) => (
            <EditableCell key={i} value={data.game_end[i]} onChange={(v) => handleGameEnd(i, v)} suffix={data.game_end[i] === 0 ? "(끝까지)" : "회마감"} style={greenCell} disabled={disabled} />
          ))}
          <td style={normalCell}></td>
          <td style={normalCell}></td>
        </tr>
        <tr>
          <td style={labelCellStyle}>단계미처리시</td>
          {[0, 1, 2].map((i) => (
            <td
              key={i}
              style={{ ...(data.step_carry_over ? greenCell : normalCell), minWidth: 100 }}
              onClick={disabled ? undefined : () => onChange({ ...data, step_carry_over: !data.step_carry_over })}
            >
              {data.step_carry_over ? "다음게임적용" : "초기화"}
            </td>
          ))}
          <td style={normalCell}></td>
          <td style={normalCell}></td>
        </tr>
      </tbody>
    </table>
  );
}

export default function SetupPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const user = useAtomValue(userAtom);
  const isAdmin = user?.role === "admin";

  const [config, setConfig] = useState(null);
  const [isLocked, setIsLocked] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [activeGames, setActiveGames] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [snack, setSnack] = useState({ open: false, message: "", severity: "success" });

  const disabled = !isAdmin || isLocked;

  // 라우트 이탈 차단
  const blocker = useBlocker(dirty);

  // 브라우저 새로고침/닫기 차단
  useEffect(() => {
    if (!dirty) return;
    const handler = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await apiCaller.get(SETTINGS_API.BASE);
      setConfig(res.data.config);
      setIsLocked(res.data.is_locked);
      setIsPaused(res.data.is_paused);
      setActiveGames(res.data.active_games);
    } catch (err) {
      console.error("Failed to fetch settings:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async () => {
    if (!dirty || disabled) return;
    setSaving(true);
    try {
      const res = await apiCaller.put(SETTINGS_API.BASE, { config });
      setConfig(res.data.config);
      setIsLocked(res.data.is_locked);
      setIsPaused(res.data.is_paused);
      setDirty(false);
      setSnack({ open: true, message: "설정이 저장되었습니다.", severity: "success" });
    } catch (err) {
      const msg = err.response?.data?.detail || "저장에 실패했습니다.";
      setSnack({ open: true, message: msg, severity: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handlePauseResume = async () => {
    try {
      const url = isPaused ? SETTINGS_API.GAME_RESUME : SETTINGS_API.GAME_PAUSE;
      const res = await apiCaller.post(url);
      setIsPaused(res.data.is_paused);
      setIsLocked(res.data.is_locked);
      setActiveGames(res.data.active_games);
      setSnack({ open: true, message: res.data.message, severity: "success" });
    } catch (err) {
      const msg = err.response?.data?.detail || "요청에 실패했습니다.";
      setSnack({ open: true, message: msg, severity: "error" });
    }
  };

  const updateSection = (section, newData) => {
    setConfig((prev) => ({ ...prev, [section]: newData }));
    setDirty(true);
  };

  if (loading) return <Box sx={{ p: 2, color: "#888" }}>불러오는 중...</Box>;

  return (
    <Box sx={{ p: 2 }}>
      {/* 상단 바 */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
        <Box
          onClick={() => { const gid = searchParams.get("gameId"); navigate(gid ? `/t9game?gameId=${gid}` : "/t9game"); }}
          sx={{
            display: "inline-flex",
            alignItems: "center",
            border: "1px solid rgba(255,255,255,0.3)",
            borderRadius: 1,
            px: 1.5,
            py: 0.5,
            cursor: "pointer",
            backgroundColor: "background.paper",
            "&:hover": { backgroundColor: "rgba(255,255,255,0.1)" },
          }}
        >
          <Typography variant="caption" sx={{ fontSize: 12 }}>&larr; 뒤로가기</Typography>
        </Box>

        {isAdmin && (
          <Box
            onClick={handleSave}
            sx={{
              display: "inline-flex",
              alignItems: "center",
              border: `1px solid ${dirty ? GREEN : "rgba(255,255,255,0.2)"}`,
              borderRadius: 1,
              px: 1.5,
              py: 0.5,
              cursor: dirty && !disabled ? "pointer" : "default",
              backgroundColor: dirty ? GREEN : "transparent",
              color: dirty ? "#fff" : "#666",
              opacity: saving ? 0.5 : 1,
              "&:hover": dirty && !disabled ? { backgroundColor: "#388e3c" } : {},
            }}
          >
            <Typography variant="caption" sx={{ fontSize: 12, fontWeight: "bold" }}>
              {saving ? "저장 중..." : "저장"}
            </Typography>
          </Box>
        )}

        {isAdmin && (
          <Box
            onClick={handlePauseResume}
            sx={{
              display: "inline-flex",
              alignItems: "center",
              border: `1px solid ${isPaused ? "#f44336" : "#ff9800"}`,
              borderRadius: 1,
              px: 1.5,
              py: 0.5,
              cursor: "pointer",
              backgroundColor: isPaused ? "#f44336" : "#ff9800",
              color: "#fff",
              "&:hover": { opacity: 0.85 },
            }}
          >
            <Typography variant="caption" sx={{ fontSize: 12, fontWeight: "bold" }}>
              {isPaused ? "게임 재개" : "게임 중지"}
            </Typography>
          </Box>
        )}

        {isLocked && (
          <Typography variant="caption" sx={{ color: "#f44336", fontSize: 11 }}>
            게임 진행 중 ({activeGames}명) - 설정 변경 불가
          </Typography>
        )}

        {isPaused && !isLocked && (
          <Typography variant="caption" sx={{ color: "#ff9800", fontSize: 11 }}>
            게임 중지 상태 - 새 게임 시작 차단됨
          </Typography>
        )}

        {!isAdmin && (
          <Typography variant="caption" sx={{ color: "#888", fontSize: 11 }}>
            관리자만 설정을 변경할 수 있습니다 (읽기 전용)
          </Typography>
        )}
      </Box>

      {/* 테이블 */}
      <Box sx={{ overflowX: "auto" }}>
        <BettingSection
          title="Triplenine"
          data={config?.triplenine}
          onChange={(d) => updateSection("triplenine", d)}
          disabled={disabled}
        />
        <GlobalHitSection
          data={config?.globalhit}
          onChange={(d) => updateSection("globalhit", d)}
          disabled={disabled}
        />
        <PinchSection
          data={config?.pinch}
          onChange={(d) => updateSection("pinch", d)}
          disabled={disabled}
          triplenineData={config?.triplenine}
        />
      </Box>

      {/* 이탈 경고 다이얼로그 */}
      <Dialog
        open={blocker.state === "blocked"}
        PaperProps={{ sx: { backgroundColor: "#1a1a1a", border: "1px solid #333" } }}
      >
        <DialogTitle sx={{ color: "#fff" }}>저장하지 않은 변경사항</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: "#ccc" }}>
            저장하지 않은 변경사항이 있습니다. 페이지를 나가시겠습니까?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => blocker.reset()} sx={{ color: "#888" }}>취소</Button>
          <Button onClick={() => blocker.proceed()} variant="contained"
            sx={{ backgroundColor: "#d32f2f", "&:hover": { backgroundColor: "#b71c1c" } }}>나가기</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snack.open}
        autoHideDuration={3000}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity={snack.severity} onClose={() => setSnack((s) => ({ ...s, open: false }))}>
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
