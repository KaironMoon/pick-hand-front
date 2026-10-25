import { useEffect, useRef, useState } from "react";
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Tooltip, Typography } from "@mui/material";

import { autoRiskSummary, finalBetCapSummary } from "./AutoRiskSettings";

const formatAmount = (value) => value.toLocaleString(undefined, {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

function errorMessage(error, fallback) {
  const detail = error?.response?.data?.detail;
  return typeof detail === "string" ? detail : fallback;
}

export default function GhAutoTotalControl({ total, goal, risk, betCap, canEditGoal, onSaveGoal, onSaveRisk, onReset }) {
  const configuredGoal = Number(risk?.configured_auto_total_goal_amount ?? 0);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [notice, setNotice] = useState(null);
  const [riskDraft, setRiskDraft] = useState({});

  useEffect(() => {
    if (!dirty) setDraft(configuredGoal > 0 ? String(configuredGoal) : "");
  }, [configuredGoal, dirty]);

  const showDialog = () => {
    setDraft(configuredGoal > 0 ? String(configuredGoal) : "");
    setRiskDraft({
      auto_total_drawdown_start_amount: risk?.configured_auto_total_drawdown_start_amount ?? 0,
      auto_total_drawdown_percent: risk?.auto_total_drawdown_percent ?? 0,
      auto_total_stopped_slot_count: risk?.auto_total_stopped_slot_count ?? 0,
      auto_total_stopped_slot_pnl: risk?.configured_auto_total_stopped_slot_pnl ?? 0,
    });
    setDirty(false);
    setNotice(null);
    setOpen(true);
  };

  const runAction = async (action, success, failure) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setNotice(null);
    try {
      await action();
      setNotice({ severity: "success", message: success });
    } catch (error) {
      setNotice({ severity: "error", message: errorMessage(error, failure) });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const saveGoal = (value) => runAction(async () => {
    await onSaveGoal(value);
    setDirty(false);
  }, value === 0 ? "목표액을 삭제했습니다." : "목표액을 저장했습니다.", "목표액을 저장하지 못했습니다.");

  const resetTotal = () => {
    if (busyRef.current || !window.confirm("오토 합계를 0으로 리셋합니다. 확인?")) return;
    runAction(onReset, "오토 합계를 초기화했습니다.", "오토 합계를 초기화하지 못했습니다.");
  };

  return (
    <>
      <Box sx={{ position: "relative", flex: "0 0 auto" }}>
        <Tooltip title={<Box sx={{ whiteSpace: "pre-line" }}>{`${autoRiskSummary(risk)}\n${finalBetCapSummary(betCap)}`}</Box>}>
        <Box component="button" type="button" onClick={showDialog}
          aria-label="오토 합계 설정" aria-haspopup="dialog" aria-expanded={open}
          sx={{
            display: "flex", alignItems: "center", gap: 0.5, p: 0, border: 0,
            backgroundColor: "transparent", cursor: "pointer", color: "inherit",
            "&:focus-visible": { outline: "2px solid #90caf9", outlineOffset: 2 },
          }}>
          <Box component="span" sx={{
            borderRadius: 1, px: 0.5, backgroundColor: "#1565c0", display: "flex",
            alignItems: "center", justifyContent: "center", minWidth: 44, height: 20,
            fontSize: 11, fontWeight: "bold", color: "#fff",
          }}>오토 합계</Box>
          <Box component="span" sx={{
            position: "relative",
            boxSizing: "border-box", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 1,
            px: 1, py: 0.2, minWidth: 55, height: 24, display: "flex", alignItems: "center",
            justifyContent: "flex-end", fontSize: 12, fontWeight: "bold",
            color: total > 0 ? "#00e676" : total < 0 ? "#ef5350" : "#666",
          }}>
            {goal > 0 && (
              <Box component="span" sx={{
                position: "absolute", bottom: "calc(100% + 2px)", left: "50%", transform: "translateX(-50%)", zIndex: 1,
                px: 0.75, py: "1px", borderRadius: "4px", backgroundColor: "#1565c0", color: "#fff",
                fontSize: 10, fontWeight: "normal", lineHeight: "14px", whiteSpace: "nowrap", pointerEvents: "none",
                "&::after": {
                  content: '""', position: "absolute", top: "100%", left: "50%", marginLeft: "-3px",
                  borderLeft: "3px solid transparent", borderRight: "3px solid transparent",
                  borderTop: "3px solid #1565c0",
                },
              }}>
                목표 {formatAmount(goal)}P
              </Box>
            )}
            {formatAmount(total)}P
          </Box>
        </Box>
        </Tooltip>
      </Box>

      <Dialog open={open} onClose={() => { if (!busyRef.current) setOpen(false); }} fullWidth maxWidth="xs"
        aria-labelledby="gh-auto-total-title">
        <DialogTitle id="gh-auto-total-title" sx={{ fontWeight: "bold" }}>오토 합계 설정</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">현재 오토 합계</Typography>
          <Typography sx={{ mt: 0.5, mb: 2, fontSize: 24, fontWeight: "bold" }}>
            {formatAmount(total)}P
          </Typography>
          <Box component="form" onSubmit={(event) => {
            event.preventDefault();
            if (canEditGoal) saveGoal(Number(draft));
          }}>
            <TextField fullWidth size="small" label="목표금액 (P) · ×1 기준" type="number" value={draft}
              disabled={busy || !canEditGoal} inputProps={{ min: 0, step: 0.1 }}
              onChange={(event) => {
                setDraft(event.target.value);
                setDirty(true);
                setNotice(null);
              }}
              helperText={goal > 0 ? `실제 목표 ${formatAmount(goal)}P · 0은 사용 안 함` : "목표액 미설정 · 0은 사용 안 함"}
            />
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
              모든 슬롯의 오토 합계가 목표 이상이면 모든 GH 슬롯 오토 정지 · 공통 실배팅 배율 적용
            </Typography>
            <Box sx={{ display: "flex", gap: 1, mt: 1.5 }}>
              <Button type="submit" variant="contained" disabled={busy || !canEditGoal || draft.trim() === ""}>
                목표액 저장
              </Button>
              <Button color="error" disabled={busy || !canEditGoal || configuredGoal <= 0} onClick={() => saveGoal(0)}>
                목표액 삭제
              </Button>
            </Box>
          </Box>
          <Box component="form" sx={{ mt: 3, pt: 2, borderTop: "1px solid", borderColor: "divider" }}
            onSubmit={(event) => {
              event.preventDefault();
              runAction(() => onSaveRisk(riskDraft), "전체 오토 종료 조건을 저장했습니다.", "전체 오토 종료 조건을 저장하지 못했습니다.");
            }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>P 달성 후 최고 PNL 손실 시 정지</Typography>
            {[
              ["auto_total_drawdown_start_amount", "감시 시작 금액 (P) · ×1 기준"],
              ["auto_total_drawdown_percent", "최고 PNL 대비 손실률 (%)", 100],
              ["auto_total_stopped_slot_count", "종료 슬롯 수 (개)", 6],
              ["auto_total_stopped_slot_pnl", "종료 슬롯 조건의 합계 PNL (P) · ×1 기준"],
            ].map(([key, label, max], index) => (
              <Box key={key}>
                {index === 2 && <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>종료 슬롯 수 & 합계 PNL 달성 시 정지</Typography>}
                <TextField fullWidth size="small" type="number" label={label}
                  value={riskDraft[key] ?? 0} disabled={busy || !canEditGoal}
                  inputProps={{ min: key === "auto_total_stopped_slot_pnl" ? undefined : 0, max, step: key.includes("count") ? 1 : 0.1 }} sx={{ mb: 1.5 }}
                  onChange={(event) => {
                    setRiskDraft((prev) => ({ ...prev, [key]: event.target.value }));
                    setNotice(null);
                  }} />
              </Box>
            ))}
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.5 }}>
              각 조건의 두 값이 모두 충족되면 전체 GH 오토가 정지됩니다. 0은 사용 안 함입니다.
              금액에는 공통 실배팅 배율을 적용하며 슬롯 수와 손실률에는 적용하지 않습니다.
              종료 슬롯은 현재 연결된 슬롯의 마지막 오토가 종료된 슬롯입니다.
              종료 슬롯 조건의 합계 PNL은 음수도 입력할 수 있으며, 설정값 이상이면 조건을 충족합니다.
            </Typography>
            <Button type="submit" variant="contained" disabled={busy || !canEditGoal}>종료 조건 저장</Button>
          </Box>
          <Box sx={{ mt: 3, pt: 2, borderTop: "1px solid", borderColor: "divider" }}>
            <Button variant="outlined" disabled={busy} onClick={resetTotal}>합계 초기화</Button>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
              오토 합계를 0으로 초기화합니다. 목표액은 유지됩니다.
            </Typography>
          </Box>
          {notice && <Alert severity={notice.severity} sx={{ mt: 2 }}>{notice.message}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={() => setOpen(false)}>닫기</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
