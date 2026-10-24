import { Box, TextField, Tooltip, Typography } from "@mui/material";

export function autoRiskSummary(config = {}) {
  const start = Number(config.auto_total_drawdown_start_amount || 0);
  const percent = Number(config.auto_total_drawdown_percent || 0);
  const count = Number(config.auto_total_stopped_slot_count || 0);
  const pnl = Number(config.auto_total_stopped_slot_pnl || 0);
  return [
    start > 0 && percent > 0
      ? `오토 합계 ${start}P 달성 후 최고 PNL에서 ${percent}% 이상 하락하면 전체 GH 오토 정지`
      : "오토 최고 PNL 손실 종료: 사용안함",
    count > 0 && pnl > 0
      ? `종료 슬롯 ${count}개 이상이고 전체 오토 합계 PNL ${pnl}P 이상이면 전체 GH 오토 정지`
      : "종료 슬롯 수 + PNL 종료: 사용안함",
  ].join("\n");
}

export function finalBetCapSummary(value) {
  const cap = Number(value || 0);
  return cap > 0
    ? `GH·모든 마틴을 합친 최종 실배팅액이 ${cap}P를 초과하면 ${cap}P로 배팅 · 실배팅 배율 적용 후 판정`
    : "회차별 최종 배팅 상한: 사용안함";
}

export function martinZPatternPrioritySummary(value = "all") {
  const descriptions = {
    all: "전부 · 현행대로 일치 패턴을 모두 반영",
    longest: "긴 것 우선 · 일치한 패턴 중 가장 긴 패턴 하나만 반영",
    shortest: "짧은 것 우선 · 일치한 패턴 중 가장 짧은 패턴 하나만 반영",
  };
  return `마틴Z 끝일치 패턴 선택: ${descriptions[value] || descriptions.all} · 정방향·B↔P 반전 포함`;
}

export function martinZRateSummary(config = {}, status = {}) {
  const threshold = Number(status.win_rate_threshold ?? config.win_rate_threshold ?? 0);
  if (threshold <= 0) return "마틴Z 승률 조건: 사용안함";
  return `마틴Z 승률 ${threshold}% 미만이면 단계 유지·0.0P, ${threshold}% 이상이면 정상 배팅 복귀`
    + " · 현재 슈의 마틴Z 가상 승패 포함, 타이·대기 제외"
    + (status.win_rate != null ? ` · 현재 ${status.win_rate}% (${status.win_rate_wins}/${status.win_rate_total})` : "")
    + (status.win_rate_blocked ? " · 0.0P 배팅중" : "");
}

export default function AutoRiskSettings({ config, onChange }) {
  const input = (key, label, max) => (
    <TextField size="small" type="number" label={label} value={config[key] ?? 0}
      inputProps={{ min: 0, max, step: key.includes("count") ? 1 : 0.1 }}
      onChange={(event) => onChange(key, Number(event.target.value))}
      sx={{ width: 150 }} />
  );
  return <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, py: 1 }}>
    <Tooltip title={<Box sx={{ whiteSpace: "pre-line" }}>{autoRiskSummary(config)}</Box>}>
      <Typography variant="caption" sx={{ width: "fit-content", fontWeight: "bold" }}>전체 오토 종료 조건 · 공통 ⓘ</Typography>
    </Tooltip>
    <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
      {input("auto_total_drawdown_start_amount", "감시 시작 (P)")}
      {input("auto_total_drawdown_percent", "최고 PNL 손실률 (%)", 100)}
      <Typography variant="caption">달성 후 최고 PNL 대비 설정 손실률 이상이면 전체 GH 오토 정지</Typography>
    </Box>
    <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
      {input("auto_total_stopped_slot_count", "종료 슬롯 수 (개)", 6)}
      {input("auto_total_stopped_slot_pnl", "오토 합계 PNL (P)")}
      <Typography variant="caption">두 조건을 모두 달성하면 전체 GH 오토 정지 · 0은 사용안함</Typography>
    </Box>
    <Typography variant="caption" color="text.secondary">종료 슬롯은 현재 연결된 슬롯의 마지막 오토가 종료된 슬롯입니다. 합계 초기화 시 최고 PNL도 초기화됩니다. 공통 조건은 배율을 적용하지 않습니다.</Typography>
    <Tooltip title={finalBetCapSummary(config.auto_final_bet_cap_amount)}>
      <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
        {input("auto_final_bet_cap_amount", "회차별 최종 배팅 상한 (P)")}
        <Typography variant="caption">선택 슬롯의 최종 실배팅액이 설정값보다 클 때만 지정 금액으로 배팅 · 0은 사용안함</Typography>
      </Box>
    </Tooltip>
  </Box>;
}
