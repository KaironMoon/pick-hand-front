import { Box, Button, Checkbox, Tooltip } from "@mui/material";

export default function GhBetPauseControls({ mode, settings, disabled, onToggle, onSave, tileSx }) {
  const playing = mode === "play";
  const standard = (settings?.bet_control_mode || "standard") === "standard";
  const controlsDisabled = disabled || !standard;
  const settingsDisabled = controlsDisabled || mode === "manual_stop";
  const entryWins = settings?.bet_entry_wins ?? 2;
  const compactTileSx = { ...tileSx, minHeight: 23, fontSize: 10, px: 0.5, py: 0.25, gap: 0.5, flexShrink: 0 };
  const checkboxSx = { p: 0.25, "& .MuiSvgIcon-root": { fontSize: 18 } };

  const countInput = (key, saved, min, inputDisabled, label) => (
    <input key={`${key}:${saved}`} type="number" aria-label={label} min={min} step="1" defaultValue={saved} disabled={inputDisabled}
      onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
      onBlur={(event) => {
        if (inputDisabled) return;
        const value = Number(event.currentTarget.value);
        if (!Number.isSafeInteger(value) || value < min || value === saved) {
          event.currentTarget.value = saved;
          return;
        }
        onSave(key, value).then((success) => {
          if (!success && event.target.isConnected) event.target.value = saved;
        });
      }}
      style={{ width: 34, boxSizing: "border-box", fontSize: 11, padding: "1px 2px", color: "#fff", background: "#16213e", border: "1px solid #59616d" }}
    />
  );

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.375, flexWrap: "nowrap", whiteSpace: "nowrap", width: "100%", minWidth: 0, boxSizing: "border-box", pl: 4, overflowX: "auto" }}>
      <Tooltip title="BET PLAY/STOP · 연패 STOP · 연승 START 활성화">
        <span>
          <Checkbox size="small" checked={standard} disabled={disabled} sx={checkboxSx}
            inputProps={{ "aria-label": "기존 배팅 제어" }}
            onChange={() => { if (!standard) onSave("bet_control_mode", "standard"); }} />
        </span>
      </Tooltip>
      <Button variant="outlined" size="small" disabled={controlsDisabled}
        aria-label={playing ? "실배팅 중지" : "실배팅 재개"} aria-pressed={!playing}
        onClick={() => onToggle(playing ? "manual_stop" : "play")}
        sx={{ ...compactTileSx, minWidth: 70, justifyContent: "center", color: playing ? "#00e676" : "#ffd54f" }}>
        {playing ? "BET PLAY" : "BET STOP"}
      </Button>
      {[
        ["bet_pause_losses", "연패 STOP", "#ffd54f"],
        ["bet_resume_wins", "연승 START", "#00e676"],
      ].map(([key, label, color]) => (
        <Box key={key} component="label" sx={{ ...compactTileSx, color, opacity: settingsDisabled ? 0.4 : 1 }}>
          <span>{label}</span>
          {countInput(key, settings?.[key] ?? 0, 0, settingsDisabled, label)}
        </Box>
      ))}
      <Tooltip title={`${entryWins}연승 후 1회 배팅 · 패배 후 다시 ${entryWins}연승 대기`}>
        <span>
          <Checkbox size="small" checked={!standard} disabled={disabled} sx={checkboxSx}
            inputProps={{ "aria-label": "연승 시 배팅" }}
            onChange={() => { if (standard) onSave("bet_control_mode", "win_only"); }} />
        </span>
      </Tooltip>
      <Box component="label" sx={{ ...compactTileSx, color: "#00e676", opacity: standard ? 0.4 : 1 }}>
        {countInput("bet_entry_wins", entryWins, 2, disabled || standard, "배팅 진입 연승 횟수")}
        <span>연승 시 배팅</span>
      </Box>
      <Button variant="outlined" size="small" disabled sx={{ ...compactTileSx, minWidth: 58, justifyContent: "center" }}>
        픽체인지
      </Button>
    </Box>
  );
}
