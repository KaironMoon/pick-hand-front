import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { Alert, Box, Button, Checkbox, FormControlLabel, Typography } from "@mui/material";
import apiCaller from "@/services/api-caller";
import { USER_BET_SETTINGS_API } from "@/constants/api-url";

const GRADES = [[1, "1등급", "#ef5350"], [2, "2등급", "#42a5f5"], [3, "3등급", "#ba68c8"], [0, "신호없음", "inherit"]];
const DEFAULT_FILTERS = { win_rate_threshold: 0, loss_streak_threshold: 0 };
const STAGE_ROWS = ["#64b5f6", "#81c784", "#ffb74d", "#ce93d8", "#4dd0e1"]
  .map((color, index) => ({ color, start: 15 + index * 10, end: 24 + index * 10 }));
const conditionLabel = (option, target) => {
  if (target >= 15 && target <= 24) {
    return { H: "⊙적중시", M: "⊙미적중시", "*": "⊙관계없음" }[option.key];
  }
  return `${option.label.split(" · ").at(-1)}${option.key.endsWith("*") ? "" : " 시"}`;
};

const ManualPickSignalOptions = forwardRef(function ManualPickSignalOptions({ targetUserId, onDirtyChange, onReadyChange, saving = false }, ref) {
  const url = targetUserId ? USER_BET_SETTINGS_API.ADMIN_MANUAL_SIGNALS(targetUserId) : USER_BET_SETTINGS_API.MANUAL_SIGNALS;
  const [enabled, setEnabled] = useState(false);
  const [target, setTarget] = useState(15);
  const [rules, setRules] = useState({});
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [options, setOptions] = useState([]);
  const [memoTitle, setMemoTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  const ready = !settingsLoading && !loading && !error;
  useEffect(() => { onReadyChange?.(ready); }, [ready, onReadyChange]);
  useImperativeHandle(ref, () => ({ rules, filters, markSaved: () => setDirty(false) }), [rules, filters]);

  useEffect(() => {
    let active = true;
    setSettingsLoading(true);
    apiCaller.get(url).then(({ data }) => {
      if (!active) return;
      setEnabled(data.enabled);
      setRules(data.rules);
      setFilters({ ...DEFAULT_FILTERS, ...data.filters });
      setDirty(false);
    }).catch((err) => {
      if (active) {
        setEnabled(false);
        setError(err.response?.data?.detail || "신호 설정을 불러오지 못했습니다.");
      }
    }).finally(() => { if (active) setSettingsLoading(false); });
    return () => { active = false; };
  }, [url]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setOptions([]);
    setError("");
    apiCaller.get(`${url}?target_step=${target}`).then(({ data }) => {
      if (!active) return;
      setEnabled(data.enabled);
      setOptions(data.options);
      setMemoTitle(data.title);
    }).catch((err) => {
      if (active) setError(err.response?.data?.detail || "결과 조합을 불러오지 못했습니다.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [url, target]);

  if (!enabled && !settingsLoading) return error ? <Alert severity="error">{error}</Alert> : null;

  const groups = Array.from(options.reduce((map, option) => {
    if (!map.has(option.group_key)) {
      map.set(option.group_key, { key: option.group_key, label: option.group_label, rows: [] });
    }
    map.get(option.group_key).rows.push(option);
    return map;
  }, new Map()).values());

  const selectGrade = (key, grade, checked) => {
    setRules((prev) => {
      const combinations = { ...prev[target] };
      if (checked) combinations[key] = grade;
      else delete combinations[key];
      return { ...prev, [target]: combinations };
    });
    setDirty(true);
  };
  const selectFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: Number(value) }));
    setDirty(true);
  };

  return <Box component="section" aria-label="수동픽 신호 설정" sx={{ p: 2, border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>수동픽 신호 설정</Typography>
      <Box>
        <Typography sx={{ mb: 1 }}>모든 슬롯에 공통 적용됩니다. 각 조건에서 등급 하나를 선택하세요.</Typography>
        <Typography variant="body2" sx={{ mb: 2, color: "text.secondary" }}>관계없음은 해당 회차 결과를 따지지 않습니다. 앞 회차부터 적중·미적중 조건이 관계없음보다 우선합니다. 선택된 등급을 다시 누르면 지정이 해제됩니다.</Typography>
        <Box sx={{ mb: 2 }}>
          <Typography id="signal-target-label" sx={{ mb: 1 }}>테두리 표시 단계</Typography>
          <Box role="group" aria-labelledby="signal-target-label" sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {STAGE_ROWS.map(({ color, start, end }) => <Box key={start}
              sx={{ display: "grid", gridTemplateColumns: "repeat(10, minmax(0, 1fr))", gap: { xs: 0.5, sm: 1 }, maxWidth: 680 }}>
              {Array.from({ length: end - start + 1 }, (_, index) => start + index).map((step) => <Button
                key={step} variant="outlined" size="small" disabled={saving}
                aria-label={`${step}단계`} aria-pressed={target === step} onClick={() => setTarget(step)}
                sx={{
                  minWidth: 0, px: 0.5, borderColor: color, fontWeight: target === step ? 700 : 500,
                  color: target === step ? "#111" : color, backgroundColor: target === step ? color : `${color}18`,
                  "&:hover": { borderColor: color, backgroundColor: target === step ? color : `${color}33` },
                }}>{step}</Button>)}
            </Box>)}
          </Box>
        </Box>
        <Box sx={{ border: "1px solid #ef5350", borderRadius: 1, p: 1.5, mb: 2 }}>
          <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 2 }}>
            <Box component="label" sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
              <Box component="select" aria-label="수동픽 신호 승률 기준" value={filters.win_rate_threshold}
                disabled={saving || settingsLoading} onChange={(e) => selectFilter("win_rate_threshold", e.target.value)}
                sx={{ backgroundColor: "#161b22", color: "#fff", border: "1px solid #888", borderRadius: 1, p: 0.75 }}>
                <option value={0}>사용안함</option>
                {Array.from({ length: 100 }, (_, index) => index + 1).map((rate) => <option key={rate} value={rate}>{rate}%</option>)}
              </Box>
              <Typography component="span">글로벌히트 빅로드 승률이 기준 이하이면 신호 숨김 · 회복 시 다시 표시</Typography>
            </Box>
            <Box component="label" sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
              <Box component="select" aria-label="수동픽 신호 연패 기준" value={filters.loss_streak_threshold}
                disabled={saving || settingsLoading} onChange={(e) => selectFilter("loss_streak_threshold", e.target.value)}
                sx={{ backgroundColor: "#161b22", color: "#fff", border: "1px solid #888", borderRadius: 1, p: 0.75 }}>
                <option value={0}>사용안함</option>
                {Array.from({ length: 80 }, (_, index) => index + 1).map((count) => <option key={count} value={count}>{count}연패</option>)}
              </Box>
              <Typography component="span">지정 연패 이상 발생하면 해당 게임의 신호 중지</Typography>
            </Box>
          </Box>
          <Typography variant="body2" sx={{ mt: 1, color: "text.secondary" }}>
            모든 단계에 공통 적용합니다. 1~4회차와 배팅이 없는 회차는 집계에서 제외하며, 연패로 중지된 게임은 승률이 회복되어도 신호를 다시 표시하지 않습니다.
          </Typography>
        </Box>
        {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
        {loading || settingsLoading ? <Typography>불러오는 중...</Typography> : <>
          <Typography sx={{ fontWeight: "bold", my: 2 }}>★{memoTitle}</Typography>
          <Box sx={{ overflowX: "auto", containerType: "inline-size" }}>
            <Box sx={{
              display: "grid", gridTemplateColumns: "minmax(520px, 1fr)", gap: 3, alignItems: "start",
              "@container (min-width: 1100px)": { gridTemplateColumns: "repeat(2, minmax(520px, 1fr))" },
            }}>
            {groups.map((group) => <Box key={group.key} component="section"
              aria-label={group.label} sx={{ minWidth: 520, gridColumn: groups.length === 1 ? "1 / -1" : undefined }}>
              <Typography component="h3" sx={{ mb: 0.5, fontSize: "inherit", whiteSpace: "pre-line" }}>
                {group.label}
              </Typography>
              {group.rows.map((option) => <Box key={option.key} role="group" aria-label={option.label}
                sx={{ display: "grid", gridTemplateColumns: "160px repeat(3, 85px) 105px", alignItems: "center", minHeight: 30 }}>
                <Typography sx={{ whiteSpace: "nowrap" }}>{conditionLabel(option, target)}</Typography>
                {GRADES.map(([grade, label, color]) => <FormControlLabel key={grade}
                  sx={{ m: 0, color, whiteSpace: "nowrap", gap: 0.5 }} label={label}
                  control={<Checkbox size="small" disabled={saving} disableRipple
                    icon={<Box component="span" aria-hidden="true" sx={{ fontSize: 20, lineHeight: 1 }}>□</Box>}
                    checkedIcon={<Box component="span" aria-hidden="true" sx={{ fontSize: 20, lineHeight: 1 }}>■</Box>}
                    checked={rules[target]?.[option.key] === grade}
                    onChange={(event) => selectGrade(option.key, grade, event.target.checked)}
                    inputProps={{ "aria-label": `${option.label} ${label}` }}
                    sx={{ p: 0.25, color, "&.Mui-checked": { color } }} />}
                />)}
              </Box>)}
            </Box>)}
            </Box>
          </Box>
        </>}
      </Box>
  </Box>;
});

export default ManualPickSignalOptions;
