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
      {prefix}{(value === undefined || value === null || value === "" || value === 0) ? "" : value.toLocaleString()}{suffix}
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
    const next = failCount >= 5 ? 2 : failCount + 1;
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
              <>
                <Box onClick={() => {
                  const val = prompt("설정 금액 (P)", String(martin.budget || 0));
                  if (val !== null) {
                    const num = parseInt(val.replace(/,/g, ""), 10);
                    if (!isNaN(num)) onChange({ ...martin, budget: num });
                  }
                }} sx={{
                  backgroundColor: GREEN, color: "#1b2e1b", fontWeight: "bold",
                  borderRadius: 1, px: 1.5, py: 0.5, fontSize: 14, cursor: "pointer",
                }}>
                  설정:{(martin.budget || 0).toLocaleString()}P
                </Box>
                <Box onClick={() => onChange({ ...martin, enabled: false })} sx={{
                  backgroundColor: "#333", color: "#888",
                  borderRadius: 1, px: 1, py: 0.5, fontSize: 12, cursor: "pointer",
                  "&:hover": { backgroundColor: "#444" },
                }}>
                  OFF
                </Box>
              </>
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

function MartinSection({ name, label, martin, onChange, disabled, labelColor: labelColorProp }) {
  const enabled = martin.enabled;
  const betType = (type) => { if (DISABLED_BET_TYPES.includes(type)) return; onChange({ ...martin, bet_type: type }); };
  const amount = (idx, val) => {
    const newAmounts = calcAmounts(martin.amounts || new Array(20).fill(0), idx, val, martin.bet_type, martin.step_min || 1, martin.step_max || 20);
    onChange({ ...martin, amounts: newAmounts });
  };

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
              <>
                <Box onClick={() => {
                  const val = prompt("설정 금액 (P)", String(martin.budget || 0));
                  if (val !== null) {
                    const num = parseInt(val.replace(/,/g, ""), 10);
                    if (!isNaN(num)) onChange({ ...martin, budget: num });
                  }
                }} sx={{
                  backgroundColor: GREEN, color: "#1b2e1b", fontWeight: "bold",
                  borderRadius: 1, px: 1.5, py: 0.5, fontSize: 14, cursor: "pointer",
                }}>
                  설정:{(martin.budget || 0).toLocaleString()}P
                </Box>
                <Box onClick={() => onChange({ ...martin, enabled: false })} sx={{
                  backgroundColor: "#333", color: "#888",
                  borderRadius: 1, px: 1, py: 0.5, fontSize: 12, cursor: "pointer",
                  "&:hover": { backgroundColor: "#444" },
                }}>
                  OFF
                </Box>
              </>
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
            onClick={() => betType(t)} disabled={DISABLED_BET_TYPES.includes(t)} />
        ))}
      </tr>
      {/* 단계설정 */}
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
      {/* 금액설정 */}
      {[0, 1, 2, 3].map((rowIdx) => (
        <tr key={`${name}-amt-${rowIdx}`}>
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

const GAME_LABELS = { t9: "트리플나인", hb: "허니비", gh: "글로벌히트", nc: "나이스초이스", wh: "위너히트", mh: "메가히트", dh: "드림히트" };
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

export default function UserSetupPage({ gameType }) {
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
    const gid = searchParams.get("gameId");
    const backPaths = GAME_BACK_PATHS[gameType];
    const path = backPaths.user;
    navigate(gid ? `${path}?gameId=${gid}` : path);
  };

  const updateMartin = (key, martin) => {
    setConfig((prev) => ({ ...prev, [key]: martin }));
    setDirty(true);
  };

  if (!config) return <Box sx={{ p: 2, color: "#888" }}>불러오는 중...</Box>;

  const martinA = config.martin_a || { ...DEFAULT_MARTIN, enabled: true };
  const martinZ = config.martin_z || { ...DEFAULT_MARTIN };
  const allp = config.allp || { ...DEFAULT_MARTIN };
  const allb = config.allb || { ...DEFAULT_MARTIN };
  const fail = config.fail || { ...DEFAULT_FAIL };

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

      <Box sx={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "fit-content" }}>
          <tbody>
            <MartinSection name="martin_a" label="마틴A" martin={martinA} onChange={(m) => updateMartin("martin_a", m)} />
            <tr><td colSpan={6} style={{ height: 12 }}></td></tr>
            <MartinSection name="martin_z" label="마틴Z" martin={martinZ} onChange={(m) => updateMartin("martin_z", m)} />
            {gameType === "gh" && (
              <>
                <tr><td colSpan={6} style={{ height: 12 }}></td></tr>
                <MartinSection name="allp" label="AllP" martin={allp} onChange={(m) => updateMartin("allp", m)} labelColor="#6a1b9a" />
                <tr><td colSpan={6} style={{ height: 12 }}></td></tr>
                <MartinSection name="allb" label="AllB" martin={allb} onChange={(m) => updateMartin("allb", m)} labelColor="#00695c" />
                <tr><td colSpan={6} style={{ height: 12 }}></td></tr>
                <FailSection martin={fail} onChange={(m) => updateMartin("fail", m)} />
              </>
            )}
          </tbody>
        </table>
      </Box>

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
