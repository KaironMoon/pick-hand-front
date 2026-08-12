import { Fragment, useEffect, useState } from "react";
import { Alert, Box, Typography } from "@mui/material";
import { useNavigate, useSearchParams } from "react-router-dom";

import apiCaller from "@/services/api-caller";
import { USER_BET_SETTINGS_API } from "@/constants/api-url";
import { nc2GameReturnPath } from "./slot-navigation.js";

const GREEN = "#4caf50";
const cell = { border: "1px solid #c9ccd1", width: 84, height: 22, lineHeight: 1.1, textAlign: "center", verticalAlign: "middle", fontSize: 13, padding: "1px 4px", whiteSpace: "nowrap", boxSizing: "border-box" };
const green = { ...cell, background: "#009900", color: "#fff" };
const teal = { ...cell, background: "#33CCCC", color: "#000" };
const blue = { ...cell, color: "#0066FF", fontWeight: "bold" };
const red = { ...cell, color: "#FF0000" };
const method = { ...cell, cursor: "pointer", userSelect: "none" };
const disabled = { ...cell, opacity: .3 };
const empty = { ...cell, background: "#0a0a0a" };
const topCondition = { ...cell, background: "#17365e", color: "#0065fe", fontWeight: "bold" };
const ASSIST_OPTIONS = ["회차진행", "6회쉬기", "6+6", "회차반대"];

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

function Nc2SetupTable({ config, onChange }) {
  const min = Number(config.step_min || 1);
  const max = Math.min(20, Number(config.step_max || 16));
  const lo = Number(config.cond_lo ?? 0);
  const hi = Number(config.cond_hi ?? 100);
  const betType = config.bet_type || "manual";
  const betTypes = [["manual", "수동"], ["martin", "마틴"], ["cruise", "크루즈"], ["labouchere", "라보쉐르"]];
  const distMode = config.dist_mode || "even";
  const distModes = [["even", "균등"], ["asc", "증가"], ["desc", "감소"]];
  const assistRules = [
    { pasi: 2, assist: "회차진행", ...((config.assist_rules || [])[0] || {}) },
    { pasi: 3, assist: "회차진행", ...((config.assist_rules || [])[1] || {}) },
    { pasi: 4, assist: "회차진행", ...((config.assist_rules || [])[2] || {}) },
    { pasi: 5, assist: "회차진행", ...((config.assist_rules || [])[3] || {}) },
  ];
  const pasiOptions = Array.from({ length: Math.max(1, max - 1) }, (_, index) => index + 2);
  const updateAssistRule = (index, field, value) => {
    const next = assistRules.map((rule) => ({ ...rule }));
    next[index][field] = field === "pasi" ? Number(value) : value;
    onChange({ ...config, assist_rules: next });
  };
  const updateStepMax = (value) => {
    const stepMax = Math.min(20, Math.max(value, min));
    const nextRules = assistRules.map((rule) => ({ ...rule, pasi: Math.max(2, Math.min(Math.max(2, stepMax), Number(rule.pasi || 2))) }));
    onChange({ ...config, step_max: stepMax, assist_rules: nextRules });
  };
  const groups = [
    { key: "white", color: "#fff", off: false, labels: [`${lo}% 이상`, `${hi}% 이하`] },
    { key: "blue", color: "#0066FF", off: lo <= 0, labels: ["0% 이상", `${lo}% 미만`] },
    { key: "red", color: "#FF0000", off: hi >= 100, labels: [`${hi}% 초과`, "100% 이하"] },
  ];
  const updateAmount = (key, index, value) => {
    const field = `amounts_${key}`;
    const amounts = [...(config[field] || Array(20).fill(0)), ...Array(20).fill(0)].slice(0, 20);
    if (betType === "martin") {
      for (let step = 0; step < 20; step += 1) amounts[step] = Math.max(0, Math.round(value * (2 ** (step - index)) * 10) / 10);
    } else {
      amounts[index] = Math.max(0, value);
    }
    onChange({ ...config, [field]: amounts });
  };
  return <table style={{ borderCollapse: "collapse", minWidth: 840, color: "#fff" }}><tbody>
    <tr>
      <td style={red}>NC2</td>
      <td style={config.enabled !== false ? { ...green, cursor: "pointer" } : method} onClick={() => onChange({ ...config, enabled: config.enabled === false })}>{config.enabled !== false ? "사용함" : "사용안함"}</td>
      {betTypes.map(([value, label]) => <td key={value} style={betType === value ? { ...green, cursor: "pointer" } : method} onClick={() => onChange({ ...config, bet_type: value })}>{label}</td>)}
      <Nc2Input value={Number(config.count || 10)} integer suffix="개" style={betType === "labouchere" ? cell : disabled} disabled={betType !== "labouchere"} onChange={(value) => onChange({ ...config, count: Math.max(1, Math.min(16, value)) })} />
      {distModes.map(([value, label]) => <td key={value} style={betType !== "labouchere" ? disabled : distMode === value ? { ...green, cursor: "pointer" } : method} onClick={betType === "labouchere" ? () => onChange({ ...config, dist_mode: value }) : undefined}>{label}</td>)}
    </tr>
    <tr>
      <td style={blue}>P설정</td><td style={green}>최저</td><Nc2Input value={min} integer suffix="단계" style={green} onChange={(value) => onChange({ ...config, step_min: Math.max(1, Math.min(value, max)) })} /><td style={green}>최고</td><Nc2Input value={max} integer suffix="단계" style={green} onChange={updateStepMax} />
      <td colSpan={5} style={cell}></td>
    </tr>
    <tr>
      <td colSpan={2} style={blue}>NC2 어시</td>
      {assistRules.map((rule, index) => <Fragment key={index}>
        <Nc2SelectCell value={rule.pasi} options={pasiOptions} format={(value) => `${value}패시`} onChange={(value) => updateAssistRule(index, "pasi", value)} style={green} />
        <Nc2SelectCell value={rule.assist} options={ASSIST_OPTIONS} onChange={(value) => updateAssistRule(index, "assist", value)} />
      </Fragment>)}
    </tr>
    {groups.flatMap((group) => [0, 1, 2].map((part) => <tr key={`${group.key}-${part}`}>
      <td colSpan={2} style={{ ...cell, color: group.off ? "#666" : group.color }}>{group.key === "white" && part < 2 ? <><input type="number" min={0} max={100} value={part === 0 ? lo : hi} onChange={(event) => onChange({ ...config, [part === 0 ? "cond_lo" : "cond_hi"]: Math.max(0, Math.min(100, Number(event.target.value || 0))) })} style={{ width: 42, background: "#1a1a1a", border: "1px solid #555", color: "#fff", textAlign: "center", fontSize: 13, borderRadius: 3, padding: "1px 2px" }} />% {part === 0 ? "이상" : "이하"}</> : group.labels[part] || ""}</td>
      {Array.from({ length: 8 }, (_, offset) => { const index = part * 8 + offset; if (index >= 20) return <td key={index} style={empty}></td>; const active = index + 1 >= min && index + 1 <= max; return active ? <Nc2Input key={index} value={(config[`amounts_${group.key}`] || [])[index] || 0} suffix="P" style={{ ...cell, color: group.off ? "#666" : group.color }} onChange={(value) => updateAmount(group.key, index, value)} /> : <td key={index} style={empty}></td>; })}
    </tr>))}
    <tr><td colSpan={10} style={topCondition}>최상위조건설정</td></tr>
  </tbody></table>;
}

function MartinZSetupTable({ martin, onChange }) {
  const enabled = !!martin.enabled;
  const min = Math.max(1, Number(martin.step_min || 1));
  const max = Math.min(20, Math.max(min, Number(martin.step_max || 20)));
  const betType = martin.bet_type || "martin";
  const amounts = [...(martin.amounts || []), ...Array(20).fill(0)].slice(0, 20);
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
      <td colSpan={3} style={cell}>나이스초이스2 전용</td>
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
      <Nc2Input value={min} integer suffix="단계" style={green} onChange={(value) => onChange({ ...martin, step_min: Math.max(1, Math.min(20, Math.min(value, max))) })} />
      <td style={green}>최고</td>
      <Nc2Input value={max} integer suffix="단계" style={green} onChange={(value) => onChange({ ...martin, step_max: Math.max(min, Math.min(20, value)) })} />
      <td style={cell}></td>
    </tr>
    {Array.from({ length: 4 }, (_, row) => <tr key={`martin-z-${row}`}>
      {row === 0 && <td rowSpan={4} style={blue}>금액설정</td>}
      {Array.from({ length: 5 }, (_, offset) => {
        const index = row * 5 + offset;
        const step = index + 1;
        const active = enabled && step >= min && step <= max;
        return <Nc2Input key={index} value={active ? amounts[index] : 0} prefix={`${step}:`} suffix="P" style={active ? cell : empty} disabled={!active} onChange={(value) => updateAmount(index, value)} />;
      })}
    </tr>)}
  </tbody></table>;
}

export default function Nc2UserSetupPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [config, setConfig] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

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

  const save = async () => {
    if (!dirty || saving) return;
    setSaving(true); setError("");
    try {
      const response = await apiCaller.put(USER_BET_SETTINGS_API.SAVE("nc2"), { config });
      setConfig(response.data.config);
      setDirty(false);
      setMessage("저장했습니다. NW로 새 게임을 시작하면 적용됩니다.");
    } catch (err) {
      setError(err.response?.data?.detail || "설정을 저장하지 못했습니다.");
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
        <Typography variant="caption" sx={{ color: "#bbb", fontWeight: "bold" }}>나이스초이스2 설정</Typography>
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
      <Box sx={{ overflowX: "auto", pb: 2 }}>
        <Nc2SetupTable config={config} onChange={updateConfig} />
      </Box>
      <Box sx={{ overflowX: "auto", pb: 2 }}>
        <MartinZSetupTable
          martin={config.martin_z || { enabled: false, budget: 0, bet_type: "martin", step_min: 1, step_max: 20, amounts: Array(20).fill(0) }}
          onChange={(martin_z) => updateConfig({ ...config, martin_z })}
        />
      </Box>
    </Box>
  );
}
