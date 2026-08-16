import { Fragment, useEffect, useState } from "react";
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle,
  TextField, Typography,
} from "@mui/material";
import { useNavigate, useSearchParams } from "react-router-dom";

import apiCaller from "@/services/api-caller";
import { NC2_GAMES_API, USER_BET_SETTINGS_API } from "@/constants/api-url";
import { nc2GameReturnPath } from "./slot-navigation.js";
import { buildFixedNc2AssistRules, visibleNc2AssistRows } from "./assist-settings.js";
import { nc2ZzzStopLabel } from "./zzz-stop-label.js";

const GREEN = "#4caf50";
const NC2_CELL_WIDTH = 84;
const cell = { border: "1px solid #c9ccd1", width: NC2_CELL_WIDTH, height: 22, lineHeight: 1.1, textAlign: "center", verticalAlign: "middle", fontSize: 13, padding: "1px 4px", whiteSpace: "nowrap", boxSizing: "border-box" };
const green = { ...cell, background: "#009900", color: "#fff" };
const teal = { ...cell, background: "#33CCCC", color: "#000" };
const blue = { ...cell, color: "#0066FF", fontWeight: "bold" };
const red = { ...cell, color: "#FF0000" };
const method = { ...cell, cursor: "pointer", userSelect: "none" };
const disabled = { ...cell, opacity: .3 };
const empty = { ...cell, background: "#0a0a0a" };
const topCondition = { ...cell, background: "#17365e", color: "#0065fe", fontWeight: "bold" };
const zoneTextCell = (base, group) => ({
  ...base,
  color: group.off ? "#666" : group.color,
});
const ASSIST_OPTIONS = ["회차진행", "6회쉬기", "6+6", "회차반대"];
const NC2_MAX_BET_STEPS = 25;
const AMOUNT_GRID_COLUMNS = 8;
const AMOUNT_GRID_ROWS = Math.ceil(NC2_MAX_BET_STEPS / AMOUNT_GRID_COLUMNS);
const ZZZ_POINT_GRID_COLUMNS = 8;
const ZZZ_POINT_OPTIONS = Array.from({ length: 24 }, (_, index) => Math.round((index + 1) * 2) / 10);
const ZZZ_POINT_GRID_ROWS = Math.ceil(ZZZ_POINT_OPTIONS.length / ZZZ_POINT_GRID_COLUMNS);
const ZZZ_RANDOM_COUNT_OPTIONS = [32, 64, 96, 128];
const DEFAULT_MARTIN_ZZZ = {
  enabled: false, budget: 0, bet_type: "martin", step_min: 1, step_max: 20,
  stop_round: 0, stop_step: 0,
  amounts: Array(NC2_MAX_BET_STEPS).fill(0), cond_lo: 0, cond_hi: 100,
  amounts_blue: Array(NC2_MAX_BET_STEPS).fill(0), amounts_white: Array(NC2_MAX_BET_STEPS).fill(0), amounts_red: Array(NC2_MAX_BET_STEPS).fill(0),
  trigger_points: [], loss_trigger_streak: 4, loss4_extra_points: [],
  reference_count: 128, reference_game_seqs: [], use_zzz1_nc: false,
};
const MARTIN_ZZZ_COUNT = 7;

function Nc2Input({ value, onChange, prefix = "", suffix = "", integer = false, style = cell, disabled: inputDisabled = false }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  if (editing) return <td style={style}><input autoFocus type="number" step={integer ? 1 : .1} value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={() => {
    const parsed = integer ? Math.round(Number(draft)) : Math.round(Number(draft) * 10) / 10;
    setEditing(false); if (Number.isFinite(parsed)) onChange(parsed);
  }} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} style={{ width: 56, background: style === teal || style === green ? "#cfeeee" : "#1a1a1a", border: "1px solid #0066FF", color: style === teal || style === green ? "#000" : "#fff", textAlign: "center", fontSize: 13, borderRadius: 3, outline: "none" }} /></td>;
  return <td style={{ ...style, cursor: inputDisabled ? "default" : "pointer" }} onClick={inputDisabled ? undefined : () => { setDraft(value ? String(value) : ""); setEditing(true); }}>{prefix}{Number(value || 0).toFixed(suffix === "P" ? 1 : 0)}{suffix}</td>;
}

function Nc2SelectCell({ value, options, onChange, style = cell, format = (option) => option }) {
  return <td style={style}><select value={value} onChange={(event) => onChange(event.target.value)} style={{ width: "100%", height: 22, padding: "0 2px", background: "#17365e", color: "#fff", border: "1px solid #45658a", borderRadius: 2, fontSize: 11, fontWeight: "bold" }}>
    {options.map((option) => <option key={option} value={option}>{format(option)}</option>)}
  </select></td>;
}

function Nc2SetupTable({ config, onChange, label = "NC2" }) {
  const min = Number(config.step_min || 1);
  const max = Math.min(NC2_MAX_BET_STEPS, Number(config.step_max || 16));
  const lo = Number(config.cond_lo ?? 0);
  const hi = Number(config.cond_hi ?? 100);
  const betType = config.bet_type || "manual";
  const betTypes = [["manual", "수동"], ["martin", "마틴"], ["cruise", "크루즈"], ["labouchere", "라보쉐르"]];
  const distMode = config.dist_mode || "even";
  const distModes = [["even", "균등"], ["asc", "증가"], ["desc", "감소"]];
  const assistRules = buildFixedNc2AssistRules(config.assist_rules);
  const assistRows = visibleNc2AssistRows(assistRules, max);
  const updateAssistRule = (index, value) => {
    const next = assistRules.map((rule) => ({ ...rule }));
    next[index].assist = value;
    onChange({ ...config, assist_rules: next });
  };
  const updateStepMax = (value) => {
    const stepMax = Math.min(NC2_MAX_BET_STEPS, Math.max(value, min));
    onChange({ ...config, step_max: stepMax, assist_rules: assistRules });
  };
  const groups = [
    { key: "white", color: "#fff", off: false, labels: [`${lo}% 이상`, `${hi}% 이하`] },
    { key: "blue", color: "#0066FF", off: lo <= 0, labels: ["0% 이상", `${lo}% 미만`] },
    { key: "red", color: "#FF0000", off: hi >= 100, labels: [`${hi}% 초과`, "100% 이하"] },
  ];
  const updateAmount = (key, index, value) => {
    const field = `amounts_${key}`;
    const amounts = [...(config[field] || Array(NC2_MAX_BET_STEPS).fill(0)), ...Array(NC2_MAX_BET_STEPS).fill(0)].slice(0, NC2_MAX_BET_STEPS);
    if (betType === "martin") {
      for (let step = 0; step < NC2_MAX_BET_STEPS; step += 1) amounts[step] = Math.max(0, Math.round(value * (2 ** (step - index)) * 10) / 10);
    } else {
      amounts[index] = Math.max(0, value);
    }
    onChange({ ...config, [field]: amounts });
  };
  return <table style={{ borderCollapse: "collapse", minWidth: 840, color: "#fff" }}><tbody>
    <tr>
      <td style={red}>{label}</td>
      <td style={config.enabled !== false ? { ...green, cursor: "pointer" } : method} onClick={() => onChange({ ...config, enabled: config.enabled === false })}>{config.enabled !== false ? "사용함" : "사용안함"}</td>
      {betTypes.map(([value, label]) => <td key={value} style={betType === value ? { ...green, cursor: "pointer" } : method} onClick={() => onChange({ ...config, bet_type: value })}>{label}</td>)}
      <Nc2Input value={Number(config.count || 10)} integer suffix="개" style={betType === "labouchere" ? cell : disabled} disabled={betType !== "labouchere"} onChange={(value) => onChange({ ...config, count: Math.max(1, Math.min(16, value)) })} />
      {distModes.map(([value, label]) => <td key={value} style={betType !== "labouchere" ? disabled : distMode === value ? { ...green, cursor: "pointer" } : method} onClick={betType === "labouchere" ? () => onChange({ ...config, dist_mode: value }) : undefined}>{label}</td>)}
    </tr>
    <tr>
      <td style={blue}>P설정</td><td style={green}>최저</td><Nc2Input value={min} integer suffix="단계" style={green} onChange={(value) => onChange({ ...config, step_min: Math.max(1, Math.min(value, max)) })} /><td style={green}>최고</td><Nc2Input value={max} integer suffix="단계" style={green} onChange={updateStepMax} />
      <td colSpan={5} style={cell}></td>
    </tr>
    {groups.flatMap((group) => Array.from({ length: AMOUNT_GRID_ROWS }, (_, part) => <tr key={`${group.key}-${part}`}>
      <td colSpan={2} style={{ ...cell, color: group.off ? "#666" : group.color }}>{group.key === "white" && part < 2 ? <><input type="number" min={0} max={100} value={part === 0 ? lo : hi} onChange={(event) => onChange({ ...config, [part === 0 ? "cond_lo" : "cond_hi"]: Math.max(0, Math.min(100, Number(event.target.value || 0))) })} style={{ width: 42, background: "#1a1a1a", border: "1px solid #555", color: "#fff", textAlign: "center", fontSize: 13, borderRadius: 3, padding: "1px 2px" }} />% {part === 0 ? "이상" : "이하"}</> : group.labels[part] || ""}</td>
      {Array.from({ length: AMOUNT_GRID_COLUMNS }, (_, offset) => { const index = part * AMOUNT_GRID_COLUMNS + offset; if (index >= NC2_MAX_BET_STEPS) return <td key={index} style={empty}></td>; const active = index + 1 >= min && index + 1 <= max; return active ? <Nc2Input key={index} value={(config[`amounts_${group.key}`] || [])[index] || 0} suffix="P" style={{ ...cell, color: group.off ? "#666" : group.color }} onChange={(value) => updateAmount(group.key, index, value)} /> : <td key={index} style={empty}></td>; })}
    </tr>))}
    <tr><td colSpan={10} style={topCondition}>최상위조건설정</td></tr>
    {assistRows.map((rules, rowIndex) => <tr key={`assist-${rowIndex}`}>
      <td colSpan={2} style={rowIndex === 0 ? blue : cell}>{rowIndex === 0 ? "NC2 어시" : ""}</td>
      {Array.from({ length: 4 }, (_, slot) => {
        const rule = rules[slot];
        if (!rule) return <Fragment key={slot}><td style={empty}></td><td style={empty}></td></Fragment>;
        const index = rule.pasi - 2;
        return <Fragment key={rule.pasi}>
          <td style={green}>{rule.pasi}패시</td>
          <Nc2SelectCell value={rule.assist} options={ASSIST_OPTIONS} onChange={(value) => updateAssistRule(index, value)} />
        </Fragment>;
      })}
    </tr>)}
  </tbody></table>;
}

function MartinZSetupTable({ martin, onChange }) {
  const enabled = !!martin.enabled;
  const min = Math.max(1, Number(martin.step_min || 1));
  const max = Math.min(NC2_MAX_BET_STEPS, Math.max(min, Number(martin.step_max || 20)));
  const betType = martin.bet_type || "martin";
  const amounts = [...(martin.amounts || []), ...Array(NC2_MAX_BET_STEPS).fill(0)].slice(0, NC2_MAX_BET_STEPS);
  const betTypes = [["martin", "마틴"], ["kkangbet", "깡벳"], ["fixed", "고정벳"], ["manual", "수동"], ["cruise", "크루즈"]];
  const updateAmount = (index, value) => {
    const next = [...amounts];
    next[index] = Math.max(0, Math.round(value * 10) / 10);
    if (betType === "martin" || betType === "kkangbet") {
      for (let idx = index + 1; idx < max; idx += 1) next[idx] = Math.round(next[idx - 1] * 20) / 10;
      for (let idx = index - 1; idx >= min - 1; idx -= 1) next[idx] = Math.max(.1, Math.round(next[idx + 1] * 5) / 10);
    } else if (betType === "fixed") {
      for (let idx = min - 1; idx < max; idx += 1) next[idx] = next[index];
    }
    onChange({ ...martin, amounts: next });
  };
  return <table style={{ borderCollapse: "collapse", minWidth: 504, color: "#fff" }}><tbody>
    <tr>
      <td style={{ ...red, background: "#c62828", color: "#fff" }}>마틴 Z</td>
      <td style={enabled ? { ...green, cursor: "pointer" } : method} onClick={() => onChange({ ...martin, enabled: !enabled })}>{enabled ? "사용함" : "사용안함"}</td>
      <Nc2Input value={martin.budget || 0} prefix="목표:" suffix="P" style={enabled ? teal : disabled} disabled={!enabled} onChange={(value) => onChange({ ...martin, budget: Math.max(0, value) })} />
      <td colSpan={3} style={cell}>트리플나인 전용</td>
    </tr>
    <tr>
      <td style={blue}>배팅종류</td>
      {betTypes.map(([value, label]) => {
        const unavailable = value === "cruise";
        return <td key={value} style={unavailable ? disabled : betType === value ? { ...green, cursor: "pointer" } : method} onClick={unavailable ? undefined : () => onChange({ ...martin, bet_type: value })}>{label}</td>;
      })}
    </tr>
    <tr>
      <td style={blue}>단계설정</td><td style={green}>최저</td>
      <Nc2Input value={min} integer suffix="단계" style={green} onChange={(value) => onChange({ ...martin, step_min: Math.max(1, Math.min(NC2_MAX_BET_STEPS, Math.min(value, max))) })} />
      <td style={green}>최고</td>
      <Nc2Input value={max} integer suffix="단계" style={green} onChange={(value) => onChange({ ...martin, step_max: Math.max(min, Math.min(NC2_MAX_BET_STEPS, value)) })} />
      <td style={cell}></td>
    </tr>
    {Array.from({ length: 5 }, (_, row) => <tr key={`martin-z-${row}`}>
      {row === 0 && <td rowSpan={5} style={blue}>금액설정</td>}
      {Array.from({ length: 5 }, (_, offset) => {
        const index = row * 5 + offset;
        const step = index + 1;
        const active = enabled && step >= min && step <= max;
        return <Nc2Input key={index} value={active ? amounts[index] : 0} prefix={`${step}:`} suffix="P" style={active ? cell : empty} disabled={!active} onChange={(value) => updateAmount(index, value)} />;
      })}
    </tr>)}
  </tbody></table>;
}

function MartinZZZSetupTable({ index, martin, zzz1, onChange, onRandom, onImport, busy }) {
  const source = martin || {};
  const legacyAmounts = Array.isArray(source.amounts) ? source.amounts : [];
  const value = {
    ...DEFAULT_MARTIN_ZZZ,
    ...source,
    ...Object.fromEntries(["blue", "white", "red"].map((zone) => {
      const key = `amounts_${zone}`;
      return [key, Array.isArray(source[key]) ? source[key] : legacyAmounts];
    })),
  };
  const enabled = !!value.enabled;
  const min = Math.max(1, Number(value.step_min || 1));
  const max = Math.min(NC2_MAX_BET_STEPS, Math.max(min, Number(value.step_max || 20)));
  const lo = Number(value.cond_lo ?? DEFAULT_MARTIN_ZZZ.cond_lo);
  const hi = Number(value.cond_hi ?? DEFAULT_MARTIN_ZZZ.cond_hi);
  const sharesZzz1Nc = index > 0 && !!value.use_zzz1_nc;
  const refs = sharesZzz1Nc
    ? (Array.isArray(zzz1?.reference_game_seqs) ? zzz1.reference_game_seqs : [])
    : (Array.isArray(value.reference_game_seqs) ? value.reference_game_seqs : []);
  const [importOpen, setImportOpen] = useState(false);
  const [sourceGameId, setSourceGameId] = useState("");
  const [importError, setImportError] = useState("");
  const [randomCount, setRandomCount] = useState(
    ZZZ_RANDOM_COUNT_OPTIONS.includes(Number(sharesZzz1Nc ? zzz1?.reference_count : source.reference_count))
      ? Number(sharesZzz1Nc ? zzz1?.reference_count : source.reference_count) : 128,
  );
  const betTypes = [["martin", "마틴"], ["kkangbet", "깡벳"], ["fixed", "고정벳"], ["manual", "수동"]];

  useEffect(() => {
    const referenceCount = Number(sharesZzz1Nc ? zzz1?.reference_count : source.reference_count);
    if (ZZZ_RANDOM_COUNT_OPTIONS.includes(referenceCount)) setRandomCount(referenceCount);
  }, [sharesZzz1Nc, source.reference_count, zzz1?.reference_count]);

  const togglePoint = (key, point) => {
    const selected = (value[key] || []).map(Number);
    const next = selected.includes(point) ? selected.filter((item) => item !== point) : [...selected, point].sort((a, b) => a - b);
    onChange({ ...value, [key]: next });
  };
  const updateAmount = (zone, index, amount) => {
    const key = `amounts_${zone}`;
    const amounts = [...(value[key] || []), ...Array(NC2_MAX_BET_STEPS).fill(0)].slice(0, NC2_MAX_BET_STEPS);
    const next = [...amounts];
    next[index] = Math.max(0, Math.round(amount * 10) / 10);
    if (value.bet_type === "martin" || value.bet_type === "kkangbet") {
      for (let idx = index + 1; idx < max; idx += 1) next[idx] = Math.round(next[idx - 1] * 20) / 10;
      for (let idx = index - 1; idx >= min - 1; idx -= 1) next[idx] = Math.max(.1, Math.round(next[idx + 1] * 5) / 10);
    } else if (value.bet_type === "fixed") {
      for (let idx = min - 1; idx < max; idx += 1) next[idx] = next[index];
    }
    onChange({ ...value, [key]: next });
  };
  const updateReference = (index, raw) => {
    const next = [...refs];
    next[index] = raw === "" ? null : Number(raw);
    while (next.length && (next[next.length - 1] == null || next[next.length - 1] === "")) next.pop();
    onChange({ ...value, reference_game_seqs: next });
  };
  const updateReferenceCount = (count) => {
    setRandomCount(count);
    onChange({ ...value, reference_count: count, reference_game_seqs: refs.slice(0, count) });
  };
  const duplicateValues = new Set(refs.filter((item, index) => item && refs.indexOf(item) !== index).map(Number));
  const pointRows = (key, label) => <>
    {Array.from({ length: ZZZ_POINT_GRID_ROWS }, (_, row) => <tr key={`${key}-${row}`}>
      {row === 0 && <td rowSpan={ZZZ_POINT_GRID_ROWS} colSpan={2} style={{ ...blue, whiteSpace: "normal", lineHeight: 1.15 }}>{label}</td>}
      {Array.from({ length: ZZZ_POINT_GRID_COLUMNS }, (__, offset) => {
        const point = ZZZ_POINT_OPTIONS[row * ZZZ_POINT_GRID_COLUMNS + offset];
        if (!point) return <td key={offset} style={empty}></td>;
        const selected = (value[key] || []).map(Number).includes(point);
        return <td key={point} style={selected ? { ...teal, color: "#0066FF", fontWeight: "bold", cursor: "pointer" } : method} onClick={() => togglePoint(key, point)}>{point.toFixed(1)}</td>;
      })}
    </tr>)}
  </>;
  const amountGroups = [
    { key: "white", color: "#fff", off: false, labels: null },
    { key: "blue", color: "#0066FF", off: lo <= 0, labels: ["0% 이상", `${lo}% 미만`, ""] },
    { key: "red", color: "#FF0000", off: hi >= 100, labels: [`${hi}% 초과`, "100% 이하", ""] },
  ];

  return <Box>
    <Box sx={{ overflowX: "auto", pb: 1 }}>
      <table style={{ borderCollapse: "collapse", minWidth: NC2_CELL_WIDTH * 10, color: "#fff" }}><tbody>
        <tr>
          <td style={{ ...red, background: "#7b1fa2", color: "#fff" }}>마틴 ZZZ {index + 1}</td>
          <td style={enabled ? { ...green, cursor: "pointer" } : method} onClick={() => onChange({ ...value, enabled: !enabled })}>{enabled ? "사용함" : "사용안함"}</td>
          <Nc2Input value={value.budget || 0} prefix="목표:" suffix="P" style={enabled ? teal : disabled} disabled={!enabled} onChange={(budget) => onChange({ ...value, budget: Math.max(0, budget) })} />
          <td colSpan={3} style={cell}>{index === 0 ? "나이스초이스2 전용" : <label style={{ cursor: "pointer", display: "inline-flex", gap: 5, alignItems: "center" }}><input type="checkbox" checked={sharesZzz1Nc} onChange={(event) => onChange({ ...value, use_zzz1_nc: event.target.checked })} />ZZZ 1번 NC 사용</label>}</td>
          <Nc2Input value={value.stop_round || 0} prefix="회차:" integer style={cell} onChange={(stop_round) => onChange({ ...value, stop_round: Math.max(0, Math.min(60, stop_round)) })} />
          <Nc2Input value={value.stop_step || 0} prefix="패:" integer style={cell} onChange={(stop_step) => onChange({ ...value, stop_step: Math.max(0, Math.min(max, stop_step)) })} />
          <td colSpan={2} style={{ ...cell, color: "#888", fontSize: 10 }}>{nc2ZzzStopLabel(value.stop_round, value.stop_step)}</td>
        </tr>
        {pointRows("trigger_points", "베팅포인트")}
        <tr><td style={blue}>베팅종류</td>{betTypes.map(([type, label]) => <td key={type} style={value.bet_type === type ? { ...green, cursor: "pointer" } : method} onClick={() => onChange({ ...value, bet_type: type })}>{label}</td>)}<td colSpan={5} style={empty}></td></tr>
        <tr>
          <td style={blue}>단계설정</td><td style={green}>최저</td>
          <Nc2Input value={min} integer suffix="단계" style={green} onChange={(step_min) => onChange({ ...value, step_min: Math.max(1, Math.min(step_min, max)) })} />
          <td style={green}>최고</td>
          <Nc2Input value={max} integer suffix="단계" style={green} onChange={(step_max) => onChange({ ...value, step_max: Math.max(min, Math.min(NC2_MAX_BET_STEPS, step_max)) })} />
          <td colSpan={5} style={empty}></td>
        </tr>
        {amountGroups.flatMap((group) => Array.from({ length: AMOUNT_GRID_ROWS }, (_, row) => <tr key={`zzz-${group.key}-${row}`}>
          <td colSpan={2} style={zoneTextCell(cell, group)}>
            {group.key === "white" && row < 2 ? <><input type="number" min={0} max={100} value={row === 0 ? lo : hi} onChange={(event) => onChange({ ...value, [row === 0 ? "cond_lo" : "cond_hi"]: Math.max(0, Math.min(100, Number(event.target.value || 0))) })} style={{ width: 42, background: "#1a1a1a", border: "1px solid #555", color: "#fff", textAlign: "center", fontSize: 13, borderRadius: 3, padding: "1px 2px" }} />% {row === 0 ? "이상" : "이하"}</> : group.labels?.[row] || ""}
          </td>
          {Array.from({ length: AMOUNT_GRID_COLUMNS }, (__, offset) => {
            const index = row * AMOUNT_GRID_COLUMNS + offset;
            if (index >= NC2_MAX_BET_STEPS) return <td key={index} style={zoneTextCell(empty, group)}></td>;
            const active = index + 1 >= min && index + 1 <= max;
            const amounts = value[`amounts_${group.key}`] || [];
            return <Nc2Input key={index} value={active ? amounts[index] : 0} suffix="P" style={zoneTextCell(active ? cell : empty, group)} disabled={!active} onChange={(amount) => updateAmount(group.key, index, amount)} />;
          })}
        </tr>))}
        {pointRows("loss4_extra_points", <><input type="number" min={1} max={20} value={value.loss_trigger_streak || 4} onChange={(event) => onChange({ ...value, loss_trigger_streak: Math.max(1, Math.min(20, Number(event.target.value || 1))) })} style={{ width: 32, background: "#1a1a1a", border: "1px solid #555", color: "#fff", textAlign: "center", fontSize: 12, borderRadius: 3, padding: "1px" }} />연패시<br />추가포인트</>)}
        <tr>
          <td colSpan={2} style={blue}>ZZZ 기준 NC 번호</td>
          <td colSpan={8} style={{ ...cell, height: "auto", padding: 4, whiteSpace: "normal" }}>
            <Box sx={{ display: "flex", gap: .7, alignItems: "center", justifyContent: "center", flexWrap: "wrap" }}>
              <TextField select size="small" label="랜덤 개수" value={randomCount} disabled={sharesZzz1Nc} onChange={(event) => updateReferenceCount(Number(event.target.value))} SelectProps={{ native: true }} sx={{ width: 105, "& .MuiInputBase-root": { height: 32 } }}>
                {ZZZ_RANDOM_COUNT_OPTIONS.map((count) => <option key={count} value={count}>{count}개</option>)}
              </TextField>
              <Button size="small" variant="contained" disabled={busy || sharesZzz1Nc} onClick={() => onRandom(randomCount)}>랜덤으로 다시 고르기</Button>
              <Button size="small" variant="outlined" disabled={busy || sharesZzz1Nc} onClick={() => { setImportError(""); setImportOpen(true); }}>나초2에서 가져오기</Button>
              <Button size="small" color="warning" disabled={busy || sharesZzz1Nc || refs.length === 0} onClick={() => onChange({ ...value, reference_game_seqs: [] })}>전체 초기화</Button>
              <Typography variant="caption" sx={{ color: "#aaa" }}>{refs.filter((item) => Number(item) > 0).length}/{randomCount}개</Typography>
            </Box>
          </td>
        </tr>
        {Array.from({ length: Math.ceil(randomCount / 10) }, (_, row) => <tr key={`zzz-ref-row-${row}`}>
          {Array.from({ length: 10 }, (__, offset) => {
            const index = row * 10 + offset;
            if (index >= randomCount) return <td key={index} style={empty}></td>;
            const ref = refs[index] ?? "";
            const invalid = ref !== "" && (!Number.isInteger(Number(ref)) || Number(ref) <= 0 || duplicateValues.has(Number(ref)));
            return <td key={index} style={{ ...cell, padding: 0, border: invalid ? "1px solid #f44336" : cell.border, background: "#15191f" }}>
              <Box sx={{ display: "flex", alignItems: "center" }}>
                <Box sx={{ width: 25, flexShrink: 0, color: "#777", fontSize: 9, textAlign: "center" }}>{index + 1}</Box>
                <input type="number" min="1" value={ref} disabled={sharesZzz1Nc} onChange={(event) => updateReference(index, event.target.value)} style={{ width: "100%", minWidth: 0, height: 24, border: 0, outline: "none", background: "transparent", color: invalid ? "#ff5252" : sharesZzz1Nc ? "#999" : "#fff", textAlign: "center", fontSize: 11 }} />
              </Box>
            </td>;
          })}
        </tr>)}
      </tbody></table>
    </Box>

    <Dialog open={importOpen} onClose={() => { if (!busy) { setImportError(""); setImportOpen(false); } }}>
      <DialogTitle>나초2 NC 번호 가져오기</DialogTitle>
      <DialogContent>
        <TextField autoFocus fullWidth type="number" label="나초2 게임번호" value={sourceGameId} onChange={(event) => { setSourceGameId(event.target.value); setImportError(""); }} inputProps={{ min: 1 }} sx={{ mt: 1 }} />
        {importError && <Alert severity="error" sx={{ mt: 1.5 }}>{importError}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button disabled={busy} onClick={() => { setImportError(""); setImportOpen(false); }}>취소</Button>
        <Button disabled={busy || !sourceGameId} variant="contained" onClick={async () => {
          const result = await onImport(Number(sourceGameId));
          if (result.ok) {
            setImportError(""); setImportOpen(false); setSourceGameId("");
          } else {
            setImportError(result.error);
          }
        }}>가져오기</Button>
      </DialogActions>
    </Dialog>
  </Box>;
}

export default function Nc2UserSetupPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [config, setConfig] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [referenceBusy, setReferenceBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const martinZzzs = Array.from({ length: MARTIN_ZZZ_COUNT }, (_, index) => {
    const saved = Array.isArray(config?.martin_zzzs)
      ? config.martin_zzzs[index]
      : index === 0 ? config?.martin_zzz : {};
    return {
      ...DEFAULT_MARTIN_ZZZ,
      ...saved,
      use_zzz1_nc: index > 0 && (saved?.use_zzz1_nc ?? true),
    };
  });
  const nc2Setups = Array.from({ length: 6 }, (_, index) => {
    const saved = Array.isArray(config?.nc2_setups) ? config.nc2_setups[index] : null;
    return saved || config || {};
  });

  useEffect(() => {
    apiCaller.get(USER_BET_SETTINGS_API.GET("nc2"))
      .then((response) => setConfig(response.data.config))
      .catch((err) => setError(err.response?.data?.detail || "설정을 불러오지 못했습니다."));
  }, []);

  const updateConfig = (next) => {
    setConfig(next);
    setDirty(true);
    setMessage("");
  };

  const errorMessage = (err, fallback) => {
    const detail = err.response?.data?.detail;
    return typeof detail === "string" ? detail : detail?.message || fallback;
  };

  const updateMartinZzzs = (nextZzzs) => updateConfig({
    ...config,
    martin_zzzs: nextZzzs,
    martin_zzz: nextZzzs[0],
  });

  const updateNc2Setup = (index, nextSetup) => {
    const nextSetups = nc2Setups.map((setup) => ({ ...setup }));
    nextSetups[index] = nextSetup;
    updateConfig({ ...config, nc2_setups: nextSetups });
  };

  const randomizeZzzReferences = async (index, count) => {
    setReferenceBusy(true); setError("");
    try {
      const response = await apiCaller.post(NC2_GAMES_API.REFERENCE_RANDOM, { count });
      const next = martinZzzs.map((item) => ({ ...item }));
      next[index] = { ...next[index], reference_count: response.data.count, reference_game_seqs: response.data.game_seqs };
      updateMartinZzzs(next);
    } catch (err) {
      setError(errorMessage(err, "랜덤 NC 번호를 선정하지 못했습니다."));
    } finally { setReferenceBusy(false); }
  };

  const importZzzReferences = async (index, gameId) => {
    setReferenceBusy(true); setError("");
    try {
      const response = await apiCaller.get(NC2_GAMES_API.REFERENCE_FROM_GAME(gameId));
      const next = martinZzzs.map((item) => ({ ...item }));
      next[index] = { ...next[index], reference_count: response.data.count, reference_game_seqs: response.data.game_seqs, reference_source: { type: "nc2_game", game_id: response.data.source_game_id } };
      updateMartinZzzs(next);
      return { ok: true, error: "" };
    } catch (err) {
      return { ok: false, error: errorMessage(err, "나초2 게임의 NC 번호를 가져오지 못했습니다.") };
    } finally { setReferenceBusy(false); }
  };

  const save = async () => {
    if (!dirty || saving) return;
    setSaving(true); setError("");
    try {
      let validatedZzzs = martinZzzs.map((item) => ({ ...item }));
      for (let index = 0; index < validatedZzzs.length; index += 1) {
        const zzz = validatedZzzs[index];
        if (!zzz.enabled) continue;
        if (!(zzz.trigger_points || []).length) throw new Error(`마틴 ZZZ ${index + 1} 베팅포인트를 한 개 이상 선택하세요.`);
        const referenceOwner = index > 0 && zzz.use_zzz1_nc ? validatedZzzs[0] : zzz;
        const gameSeqs = (referenceOwner.reference_game_seqs || []).filter((item) => item !== "" && item != null).map(Number);
        if (!gameSeqs.length) throw new Error(`마틴 ZZZ ${index + 1} 기준 NC 번호를 한 개 이상 입력하세요.`);
        if (gameSeqs.some((item) => !Number.isInteger(item) || item <= 0) || new Set(gameSeqs).size !== gameSeqs.length || gameSeqs.length > 128) {
          throw new Error(`마틴 ZZZ ${index + 1} NC 번호는 중복 없는 양수로 최대 128개까지 입력할 수 있습니다.`);
        }
        const validation = await apiCaller.post(NC2_GAMES_API.REFERENCE_VALIDATE, { game_seqs: gameSeqs });
        validatedZzzs[index] = { ...zzz, reference_count: validation.data.count, reference_game_seqs: validation.data.game_seqs };
      }
      const nextConfig = {
        ...config,
        nc2_setups: nc2Setups,
        martin_zzzs: validatedZzzs,
        martin_zzz: validatedZzzs[0],
      };
      const response = await apiCaller.put(USER_BET_SETTINGS_API.SAVE("nc2"), { config: nextConfig });
      setConfig(response.data.config);
      setDirty(false);
      setMessage("저장했습니다. NW로 새 게임을 시작하면 적용됩니다.");
    } catch (err) {
      setError(err.response ? errorMessage(err, "설정을 저장하지 못했습니다.") : err.message || "설정을 저장하지 못했습니다.");
    } finally { setSaving(false); }
  };

  if (!config) return <Box sx={{ p: 2, color: "#888" }}>{error || "불러오는 중..."}</Box>;

  return (
    <Box sx={{ p: 2 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
        <Box onClick={() => navigate(nc2GameReturnPath(searchParams.get("slot")))} sx={{ display: "inline-flex", alignItems: "center", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 1, px: 1.5, py: .5, cursor: "pointer", backgroundColor: "background.paper", "&:hover": { backgroundColor: "rgba(255,255,255,0.1)" } }}>
          <Typography variant="caption" sx={{ fontSize: 12 }}>&larr; 뒤로가기</Typography>
        </Box>
        <Box onClick={save} sx={{ display: "inline-flex", alignItems: "center", border: `1px solid ${dirty ? GREEN : "rgba(255,255,255,0.2)"}`, borderRadius: 1, px: 1.5, py: .5, cursor: dirty ? "pointer" : "default", backgroundColor: dirty ? GREEN : "transparent", color: dirty ? "#fff" : "#666", opacity: saving ? .5 : 1, "&:hover": dirty ? { backgroundColor: "#388e3c" } : {} }}>
          <Typography variant="caption" sx={{ fontSize: 12, fontWeight: "bold" }}>{saving ? "저장 중..." : "저장"}</Typography>
        </Box>
        <Typography variant="caption" sx={{ color: "#bbb", fontWeight: "bold" }}>트리플나인 설정</Typography>
      </Box>

      {message && <Alert severity="success" sx={{ mb: 1 }}>{message}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1, mb: 2, p: 1, border: "1px solid rgba(255,255,255,0.2)", borderRadius: 1 }}>
        <Typography variant="caption" sx={{ fontSize: 11, color: "#bbb", fontWeight: "bold" }}>운영 옵션</Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Typography variant="caption" sx={{ fontSize: 12, color: "#aaa", minWidth: 110 }}>나이스초이스 개수</Typography>
          {[128, 96, 64, 32].map((count) => {
            const selected = Number(config.reference_count ?? 128) === count;
            return <Box key={count} role="button" tabIndex={0} onClick={() => updateConfig({ ...config, reference_count: count })} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") updateConfig({ ...config, reference_count: count }); }} sx={{ minWidth: 58, px: 1, py: .45, borderRadius: 1, border: `1px solid ${selected ? "#00a85a" : "#555"}`, backgroundColor: selected ? "#17482f" : "#171a1f", color: selected ? "#00e676" : "#aaa", textAlign: "center", fontSize: 12, fontWeight: "bold", cursor: "pointer", userSelect: "none" }}>{count}개</Box>;
          })}
          <Typography variant="caption" sx={{ fontSize: 10, color: "#666" }}>새 조합을 선정할 때 적용</Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Typography variant="caption" sx={{ fontSize: 12, color: "#aaa", minWidth: 110 }}>번호별 종료설정</Typography>
          <input type="number" min="1" max="60" step="1" value={config.item_win_limit ?? 60} onChange={(event) => {
            const value = Math.round(Number(event.target.value || 1));
            updateConfig({ ...config, item_win_limit: Math.max(1, Math.min(60, value)) });
          }} style={{ width: 140, padding: "4px 6px", background: "#16213e", color: "#fff", border: "1px solid #2a3a5a", borderRadius: 4, fontSize: 12 }} />
          <Typography variant="caption" sx={{ fontSize: 10, color: "#666" }}>각 NC 어시픽의 누적 승수 도달 시 배팅 종료</Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Typography variant="caption" sx={{ fontSize: 12, color: "#aaa", minWidth: 110 }}>실배팅 배율</Typography>
          {[1, .1].map((scale) => {
            const selected = Number(config.auto_actual_bet_scale ?? 1) === scale;
            return <Box key={scale} role="button" tabIndex={0} onClick={() => updateConfig({ ...config, auto_actual_bet_scale: scale })} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") updateConfig({ ...config, auto_actual_bet_scale: scale }); }} sx={{ minWidth: 58, px: 1, py: .45, borderRadius: 1, border: `1px solid ${selected ? "#00a85a" : "#555"}`, backgroundColor: selected ? "#17482f" : "#171a1f", color: selected ? "#00e676" : "#aaa", textAlign: "center", fontSize: 12, fontWeight: "bold", cursor: "pointer", userSelect: "none" }}>×{scale}</Box>;
          })}
          <Typography variant="caption" sx={{ fontSize: 10, color: "#666" }}>전략 계산액은 유지하고 실제 카지노 주문액에만 적용</Typography>
        </Box>
        {[
          { key: "auto_goal_amount", label: "전체 목표금액 (P)", step: .1, help: "전체 실 PNL이 목표에 도달하면 다음 회차부터 배팅 중지" },
          { key: "auto_end_round", label: "미달 마감 회차", step: 1, help: "설정 회차까지 배팅하고 다음 회차부터 배팅 중지" },
        ].map((item) => <Box key={item.key} sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Typography variant="caption" sx={{ fontSize: 12, color: "#aaa", minWidth: 110 }}>{item.label}</Typography>
          <input type="number" min="0" step={item.step} value={config[item.key] ?? 0} onChange={(event) => {
            const raw = item.step === 1 ? parseInt(event.target.value || "0", 10) : parseFloat(event.target.value || "0");
            updateConfig({ ...config, [item.key]: Math.max(0, raw || 0) });
          }} style={{ width: 140, padding: "4px 6px", background: "#16213e", color: "#fff", border: "1px solid #2a3a5a", borderRadius: 4, fontSize: 12 }} />
          {Number(config[item.key] || 0) === 0 && <Typography variant="caption" sx={{ fontSize: 10, color: "#888" }}>(사용안함)</Typography>}
          <Typography variant="caption" sx={{ fontSize: 10, color: "#666" }}>{item.help}</Typography>
        </Box>)}
      </Box>
      {nc2Setups.map((setup, index) => <Box key={`nc2-s${index + 1}`} sx={{ overflowX: "auto", pb: 2 }}>
        <Nc2SetupTable
          config={setup}
          label={`NC2 S${index + 1}`}
          onChange={(nextSetup) => updateNc2Setup(index, nextSetup)}
        />
      </Box>)}
      <Box sx={{ overflowX: "auto", pb: 2 }}>
        <MartinZSetupTable
          martin={config.martin_z || { enabled: false, budget: 0, bet_type: "martin", step_min: 1, step_max: 20, amounts: Array(NC2_MAX_BET_STEPS).fill(0) }}
          onChange={(martin_z) => updateConfig({ ...config, martin_z })}
        />
      </Box>
      {martinZzzs.map((martin, index) => <MartinZZZSetupTable
        key={index}
        index={index}
        martin={martin}
        zzz1={martinZzzs[0]}
        onChange={(nextMartin) => {
          const next = martinZzzs.map((item) => ({ ...item }));
          next[index] = nextMartin;
          updateMartinZzzs(next);
        }}
        onRandom={(count) => randomizeZzzReferences(index, count)}
        onImport={(gameId) => importZzzReferences(index, gameId)}
        busy={referenceBusy || saving}
      />)}
    </Box>
  );
}
