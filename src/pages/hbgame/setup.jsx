import { useState, useEffect } from "react";
import { Box, Typography, Snackbar, Alert, Dialog, DialogTitle, DialogContent, DialogActions, Button } from "@mui/material";
import { useNavigate, useSearchParams, useBlocker } from "react-router-dom";
import apiCaller from "@/services/api-caller";
import { HB_SETTINGS_API, HB_GAMES_API } from "@/constants/api-url";

const GREEN = "#4caf50";
const LIGHT_BLUE = "#29b6f6";
const LABEL_COLOR = "#c62828";
const CELL_BORDER = "1px solid #555";
const LABEL_BG = "rgba(255,255,255,0.04)";

const BET_TYPES = ["martin", "kkangbet", "fixed", "manual", "cruise"];
const BET_TYPE_LABELS = { martin: "마틴", kkangbet: "깡벳", fixed: "고정벳", manual: "수동", cruise: "크루즈" };
const DISABLED_BET_TYPES = ["cruise"];
const GH_PATTERNS = ["PPP", "BBB", "PBP", "BPB", "PPB", "BBP", "PBB", "BPP"];

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
      {prefix}{(value === undefined || value === null || value === "" || value === 0) ? "" : value}{suffix}
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

export default function HbSetupPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [config, setConfig] = useState(null);
  const [nicknames, setNicknames] = useState([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [snack, setSnack] = useState({ open: false, message: "", severity: "success" });
  const [isPaused, setIsPaused] = useState(false);
  const [pickerTarget, setPickerTarget] = useState(null); // { gIdx, rowIdx }

  const blocker = useBlocker(dirty);

  useEffect(() => {
    if (!dirty) return;
    const handler = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  useEffect(() => {
    Promise.all([
      apiCaller.get(HB_SETTINGS_API.BASE),
      apiCaller.get(HB_GAMES_API.NICKNAMES),
      apiCaller.get(HB_SETTINGS_API.GAME_STATUS),
    ]).then(([settingsRes, nnRes, statusRes]) => {
      setConfig(settingsRes.data.config);
      setNicknames(nnRes.data.nicknames || []);
      setIsPaused(statusRes.data?.is_paused || false);
    });
  }, []);

  const handleSave = async () => {
    if (!dirty) return;
    setSaving(true);
    try {
      const res = await apiCaller.put(HB_SETTINGS_API.BASE, { config });
      setConfig(res.data.config);
      setDirty(false);
      setSnack({ open: true, message: "설정이 저장되었습니다.", severity: "success" });
    } catch (err) {
      setSnack({ open: true, message: err?.response?.data?.detail || "저장 실패", severity: "error" });
    } finally { setSaving(false); }
  };

  const handlePauseResume = async () => {
    try {
      const url = isPaused ? HB_SETTINGS_API.GAME_RESUME : HB_SETTINGS_API.GAME_PAUSE;
      const res = await apiCaller.post(url);
      setIsPaused(res.data.is_paused);
      setSnack({ open: true, message: res.data.message, severity: "success" });
    } catch (err) {
      setSnack({ open: true, message: err?.response?.data?.detail || "요청 실패", severity: "error" });
    }
  };

  const update = (section, key, val) => {
    setConfig((prev) => ({ ...prev, [section]: { ...prev[section], [key]: val } }));
    setDirty(true);
  };

  if (!config) return <Box sx={{ p: 2, color: "#888" }}>불러오는 중...</Box>;

  const hb = config.honeybee || {};
  const gh = config.globalhit || {};
  const disabled = false;

  const hbBetType = (type) => { if (DISABLED_BET_TYPES.includes(type)) return; update("honeybee", "bet_type", type); };
  const ghBetType = (type) => { if (DISABLED_BET_TYPES.includes(type)) return; update("globalhit", "bet_type", type); };

  const hbAmount = (idx, val) => {
    const newAmounts = calcAmounts(hb.amounts || new Array(20).fill(0), idx, val, hb.bet_type, hb.step_min || 1, hb.step_max || 20);
    update("honeybee", "amounts", newAmounts);
  };
  const ghAmount = (idx, val) => {
    const newAmounts = calcAmounts(gh.amounts || new Array(20).fill(0), idx, val, gh.bet_type, gh.step_min || 1, gh.step_max || 20);
    update("globalhit", "amounts", newAmounts);
  };

  const hbPatternToggle = (nn) => {
    const newPats = { ...(hb.patterns || {}) };
    newPats[nn] = !newPats[nn];
    update("honeybee", "patterns", newPats);
  };
  const hbAllPatterns = (val) => {
    const newPats = {};
    nicknames.forEach((nn) => { newPats[nn] = val; });
    update("honeybee", "patterns", newPats);
  };

  const ghPatternToggle = (pat, secIdx) => {
    const newPats = { ...(gh.patterns || {}) };
    const arr = [...(newPats[pat] || [false, false, false])];
    arr[secIdx] = !arr[secIdx];
    newPats[pat] = arr;
    update("globalhit", "patterns", newPats);
  };

  const COLS = 6;

  return (
    <Box sx={{ p: 2 }}>
      {/* 상단 바 */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
        <Box onClick={() => { const gid = searchParams.get("gameId"); navigate(gid ? `/hbgame?gameId=${gid}` : "/hbgame"); }}
          sx={{ display: "inline-flex", alignItems: "center", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 1, px: 1.5, py: 0.5, cursor: "pointer", backgroundColor: "background.paper", "&:hover": { backgroundColor: "rgba(255,255,255,0.1)" } }}>
          <Typography variant="caption" sx={{ fontSize: 12 }}>&larr; 뒤로가기</Typography>
        </Box>
        <Box onClick={handleSave}
          sx={{ display: "inline-flex", alignItems: "center", border: `1px solid ${dirty ? GREEN : "rgba(255,255,255,0.2)"}`, borderRadius: 1, px: 1.5, py: 0.5, cursor: dirty ? "pointer" : "default", backgroundColor: dirty ? GREEN : "transparent", color: dirty ? "#fff" : "#666", opacity: saving ? 0.5 : 1, "&:hover": dirty ? { backgroundColor: "#388e3c" } : {} }}>
          <Typography variant="caption" sx={{ fontSize: 12, fontWeight: "bold" }}>{saving ? "저장 중..." : "저장"}</Typography>
        </Box>
        <Box onClick={handlePauseResume}
          sx={{ display: "inline-flex", alignItems: "center", border: `1px solid ${isPaused ? "#f44336" : "#ff9800"}`, borderRadius: 1, px: 1.5, py: 0.5, cursor: "pointer", backgroundColor: isPaused ? "#f44336" : "#ff9800", color: "#fff", "&:hover": { opacity: 0.85 } }}>
          <Typography variant="caption" sx={{ fontSize: 12, fontWeight: "bold" }}>{isPaused ? "게임 재개" : "게임 중지"}</Typography>
        </Box>
      </Box>

      <Box sx={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "fit-content" }}>
          <tbody>
            {/* ═══ 허니비 (제목 없이, 6열) ═══ */}
            <tr>
              <td style={labelCellStyle}>배팅종류</td>
              {BET_TYPES.map((t) => (
                <ToggleCell key={t} active={hb.bet_type === t} label={BET_TYPE_LABELS[t]} onClick={() => hbBetType(t)} disabled={DISABLED_BET_TYPES.includes(t)} />
              ))}
            </tr>
            <tr>
              <td style={labelCellStyle}>단계설정</td>
              <td style={normalCell}>최저</td>
              <EditableCell value={hb.step_min || 1} onChange={(v) => {
                const upd = { step_min: v };
                if (v >= (hb.step_max || 20)) upd.step_max = v + 1;
                setConfig((prev) => ({ ...prev, honeybee: { ...prev.honeybee, ...upd } }));
                setDirty(true);
              }} suffix="단계" style={greenCell} />
              <td style={normalCell}>최고</td>
              <EditableCell value={hb.step_max || 20} onChange={(v) => {
                const upd = { step_max: v };
                if (v <= (hb.step_min || 1)) upd.step_min = v - 1;
                setConfig((prev) => ({ ...prev, honeybee: { ...prev.honeybee, ...upd } }));
                setDirty(true);
              }} suffix="단계" style={greenCell} />
              <td style={normalCell}></td>
            </tr>
            {[0, 1, 2, 3].map((rowIdx) => (
              <tr key={`hb-amt-${rowIdx}`}>
                {rowIdx === 0 && <td rowSpan={4} style={labelCellStyle}>금액설정</td>}
                {(hb.amounts || new Array(20).fill(0)).slice(rowIdx * 5, rowIdx * 5 + 5).map((amt, i) => {
                  const idx = rowIdx * 5 + i;
                  const step = idx + 1;
                  const inRange = step >= (hb.step_min || 1) && step <= (hb.step_max || 20);
                  return (
                    <EditableCell key={idx} value={inRange ? amt : 0} onChange={(v) => hbAmount(idx, v)}
                      prefix={`${step}:`} suffix="P" style={inRange ? editableCell : normalCell} disabled={!inRange} />
                  );
                })}
              </tr>
            ))}
            <tr>
              <td style={labelCellStyle}>게임설정</td>
              <EditableCell value={hb.game_start || 0} onChange={(v) => update("honeybee", "game_start", v)}
                suffix={(hb.game_start || 0) === 0 ? "1회시작" : "회시작"} style={greenCell} />
              <EditableCell value={hb.game_end || 0} onChange={(v) => update("honeybee", "game_end", v)}
                suffix={(hb.game_end || 0) === 0 ? "끝까지" : "회마감"} style={greenCell} />
              <td style={labelCellStyle}>단계미처리시</td>
              <td style={{ ...(hb.step_carry_over ? greenCell : normalCell), minWidth: 100 }}
                onClick={() => update("honeybee", "step_carry_over", !hb.step_carry_over)}>
                {hb.step_carry_over ? "다음게임적용" : "초기화"}
              </td>
              <td style={normalCell}></td>
            </tr>
            {/* 배팅묶기 그리드 — 12그룹, 6열 × 2세트 */}
            {(() => {
              const allGroups = Array.from({ length: 12 }, (_, i) => (hb.groups || [])[i] || { name: `G${i + 1}`, patterns: [] });
              const usedSet = new Set();
              allGroups.forEach((g) => (g.patterns || []).forEach((p) => { if (p) usedSet.add(p); }));
              const openPicker = (absGIdx, rowIdx) => {
                setPickerTarget({ gIdx: absGIdx, rowIdx });
              };
              return [0, 1].map((setIdx) => {
                const setGroups = allGroups.slice(setIdx * 6, setIdx * 6 + 6);
                const maxRows = Math.max(4, ...setGroups.map((g) => (g.patterns || []).length));
                return [
                  <tr key={`grp-hdr-${setIdx}`}>
                    {setGroups.map((g, i) => {
                      const gNum = setIdx * 6 + i + 1;
                      const hasPatterns = (g.patterns || []).length > 0;
                      return (
                        <td key={i} style={{ ...headerStyle, color: hasPatterns ? GREEN : "#f44336", fontSize: 12 }}>
                          배팅묶기({gNum})
                        </td>
                      );
                    })}
                  </tr>,
                  ...Array.from({ length: maxRows }, (_, rowIdx) => (
                    <tr key={`grp-${setIdx}-${rowIdx}`}>
                      {setGroups.map((g, colIdx) => {
                        const absGIdx = setIdx * 6 + colIdx;
                        const pat = (g.patterns || [])[rowIdx] || "";
                        return (
                          <td key={colIdx}
                            style={{ ...normalCell, color: pat ? "#ccc" : "#555", fontSize: 12, cursor: "pointer", userSelect: "none" }}
                            onClick={() => openPicker(absGIdx, rowIdx)}>
                            {pat || "사용안함"}
                          </td>
                        );
                      })}
                    </tr>
                  )),
                ];
              });
            })()}

            {/* ═══ 글로벌히트 ═══ */}
            <tr><td colSpan={COLS} style={{ ...headerStyle, paddingTop: 12 }}>globalhit</td></tr>
            <tr>
              <td style={labelCellStyle}>배팅종류</td>
              {BET_TYPES.map((t) => (
                <ToggleCell key={t} active={gh.bet_type === t} label={BET_TYPE_LABELS[t]} onClick={() => ghBetType(t)} disabled={DISABLED_BET_TYPES.includes(t)} />
              ))}
            </tr>
            <tr>
              <td style={labelCellStyle}>단계설정</td>
              <td style={normalCell}>최저</td>
              <EditableCell value={gh.step_min || 1} onChange={(v) => {
                const upd = { step_min: v };
                if (v >= (gh.step_max || 20)) upd.step_max = v + 1;
                setConfig((prev) => ({ ...prev, globalhit: { ...prev.globalhit, ...upd } }));
                setDirty(true);
              }} suffix="단계" style={greenCell} />
              <td style={normalCell}>최고</td>
              <EditableCell value={gh.step_max || 20} onChange={(v) => {
                const upd = { step_max: v };
                if (v <= (gh.step_min || 1)) upd.step_min = v - 1;
                setConfig((prev) => ({ ...prev, globalhit: { ...prev.globalhit, ...upd } }));
                setDirty(true);
              }} suffix="단계" style={greenCell} />
              <td style={normalCell}></td>
            </tr>
            {[0, 1, 2, 3].map((rowIdx) => (
              <tr key={`gh-amt-${rowIdx}`}>
                {rowIdx === 0 && <td rowSpan={4} style={labelCellStyle}>금액설정</td>}
                {(gh.amounts || new Array(20).fill(0)).slice(rowIdx * 5, rowIdx * 5 + 5).map((amt, i) => {
                  const idx = rowIdx * 5 + i;
                  const step = idx + 1;
                  const inRange = step >= (gh.step_min || 1) && step <= (gh.step_max || 20);
                  return (
                    <EditableCell key={idx} value={inRange ? amt : 0} onChange={(v) => ghAmount(idx, v)}
                      prefix={`${step}:`} suffix="P" style={inRange ? editableCell : normalCell} disabled={!inRange} />
                  );
                })}
              </tr>
            ))}
            {GH_PATTERNS.map((pat) => (
              <tr key={pat}>
                <td style={{ ...labelCellStyle, fontSize: 12 }}>
                  {pat.split("").map((c, i) => (
                    <span key={i} style={{ color: c === "P" ? "#1565c0" : "#f44336", fontWeight: "bold" }}>{c}</span>
                  ))}
                </td>
                {[0, 1, 2].map((secIdx) => (
                  <ToggleCell key={secIdx}
                    active={gh.patterns?.[pat]?.[secIdx]}
                    label={gh.patterns?.[pat]?.[secIdx] ? `섹션${secIdx + 1}운영하기` : `섹션${secIdx + 1}중지`}
                    onClick={() => ghPatternToggle(pat, secIdx)} />
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
                <EditableCell key={i} value={(gh.game_start || [1, 2, 3])[i]}
                  onChange={(v) => {
                    const arr = [...(gh.game_start || [1, 2, 3])]; arr[i] = v;
                    update("globalhit", "game_start", arr);
                  }}
                  suffix={(gh.game_start || [1, 2, 3])[i] === 0 ? "1회시작" : "회시작"}
                  style={greenCell} />
              ))}
              <td style={normalCell}></td>
              <td style={normalCell}></td>
            </tr>
            <tr>
              <td style={labelCellStyle}>게임마감</td>
              {[0, 1, 2].map((i) => (
                <EditableCell key={i} value={(gh.game_end || [60, 58, 59])[i]}
                  onChange={(v) => {
                    const arr = [...(gh.game_end || [60, 58, 59])]; arr[i] = v;
                    update("globalhit", "game_end", arr);
                  }}
                  suffix={(gh.game_end || [60, 58, 59])[i] === 0 ? "끝까지" : "회마감"}
                  style={greenCell} />
              ))}
              <td style={normalCell}></td>
              <td style={normalCell}></td>
            </tr>
            <tr>
              <td style={labelCellStyle}>단계미처리시</td>
              {[0, 1, 2].map((i) => {
                const arr = Array.isArray(gh.step_carry_over) ? gh.step_carry_over : [!!gh.step_carry_over, !!gh.step_carry_over, !!gh.step_carry_over];
                return (
                  <td key={i} style={{ ...(arr[i] ? greenCell : normalCell), minWidth: 100 }}
                    onClick={() => {
                      const newArr = [...arr]; newArr[i] = !newArr[i];
                      update("globalhit", "step_carry_over", newArr);
                    }}>
                    {arr[i] ? "다음게임적용" : "초기화"}
                  </td>
                );
              })}
              <td style={normalCell}></td>
              <td style={normalCell}></td>
            </tr>
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

      {/* 닉네임 피커 바텀시트 */}
      {pickerTarget && (() => {
        const allGroups = Array.from({ length: 12 }, (_, i) => (hb.groups || [])[i] || { name: `G${i + 1}`, patterns: [] });
        const current = (allGroups[pickerTarget.gIdx]?.patterns || [])[pickerTarget.rowIdx] || null;
        const usedSet = new Set();
        allGroups.forEach((g, gi) => {
          (g.patterns || []).forEach((p, pi) => {
            if (p && !(gi === pickerTarget.gIdx && pi === pickerTarget.rowIdx)) usedSet.add(p);
          });
        });
        const available = nicknames.filter((nn) => !usedSet.has(nn));
        const pick = (value) => {
          const newGroups = allGroups.map((g) => ({ ...g, patterns: [...(g.patterns || [])] }));
          if (value === null) {
            newGroups[pickerTarget.gIdx].patterns.splice(pickerTarget.rowIdx, 1);
          } else {
            while (newGroups[pickerTarget.gIdx].patterns.length <= pickerTarget.rowIdx) newGroups[pickerTarget.gIdx].patterns.push(null);
            newGroups[pickerTarget.gIdx].patterns[pickerTarget.rowIdx] = value;
          }
          newGroups.forEach((g) => {
            while (g.patterns.length > 0 && !g.patterns[g.patterns.length - 1]) g.patterns.pop();
          });
          update("honeybee", "groups", newGroups);
          setPickerTarget(null);
        };
        return (
          <>
            <Box onClick={() => setPickerTarget(null)}
              sx={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1300 }} />
            <Box sx={{
              position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 1301,
              backgroundColor: "#1a1a1a", borderTop: "2px solid #555",
              borderRadius: "12px 12px 0 0", maxHeight: "60vh", overflowY: "auto",
              pb: "env(safe-area-inset-bottom, 16px)",
            }}>
              <Box sx={{ p: 1.5, borderBottom: "1px solid #333", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Typography sx={{ color: "#aaa", fontSize: 13 }}>
                  배팅묶기({pickerTarget.gIdx + 1}) — 슬롯 {pickerTarget.rowIdx + 1}
                </Typography>
                <Box onClick={() => setPickerTarget(null)}
                  sx={{ color: "#888", fontSize: 18, cursor: "pointer", px: 1 }}>✕</Box>
              </Box>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, p: 1.5 }}>
                <Box onClick={() => pick(null)}
                  sx={{
                    flex: "0 0 calc(33.3% - 8px)", py: 1.2, textAlign: "center", borderRadius: 1, cursor: "pointer", fontSize: 13,
                    border: `1px solid ${current === null ? "#f44336" : "#444"}`,
                    backgroundColor: current === null ? "rgba(244,67,54,0.15)" : "transparent",
                    color: current === null ? "#f44336" : "#666",
                  }}>
                  사용안함
                </Box>
                {nicknames.map((nn) => {
                  const isUsed = usedSet.has(nn);
                  const isCurrent = current === nn;
                  return (
                    <Box key={nn} onClick={isUsed ? undefined : () => pick(nn)}
                      sx={{
                        flex: "0 0 calc(33.3% - 8px)", py: 1.2, textAlign: "center", borderRadius: 1, fontSize: 13,
                        cursor: isUsed ? "default" : "pointer",
                        opacity: isUsed ? 0.3 : 1,
                        border: `1px solid ${isCurrent ? GREEN : isUsed ? "#333" : "#444"}`,
                        backgroundColor: isCurrent ? "rgba(76,175,80,0.15)" : "transparent",
                        color: isCurrent ? GREEN : isUsed ? "#555" : "#ccc",
                      }}>
                      {nn}
                    </Box>
                  );
                })}
              </Box>
            </Box>
          </>
        );
      })()}

      <Snackbar open={snack.open} autoHideDuration={3000}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert severity={snack.severity} onClose={() => setSnack((s) => ({ ...s, open: false }))}>{snack.message}</Alert>
      </Snackbar>
    </Box>
  );
}
