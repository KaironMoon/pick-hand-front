import { Box, Tooltip, Typography } from "@mui/material";

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
    ? `GH·모든 마틴을 합친 최종 실배팅액이 설정 상한 × 실배팅 배율을 초과하면 상한 적용 · ×1 기준 ${cap}P`
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
  const input = (key, label, max, width = 90) => (
    <input type="number" aria-label={label} min="0" max={max}
      step={key.includes("count") ? "1" : "0.1"} value={config[key] ?? 0}
      onChange={(event) => onChange(key, event.target.value)}
      style={{ width, padding: "4px 6px", background: "#16213e", color: "#fff", border: "1px solid #2a3a5a", borderRadius: 4, fontSize: 12 }} />
  );
  return <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, py: 1 }}>
    <Tooltip title={<Box sx={{ whiteSpace: "pre-line" }}>{autoRiskSummary(config)}</Box>}>
      <Typography variant="caption" sx={{ width: "fit-content", fontWeight: "bold" }}>전체 오토 종료 조건 · 공통 ⓘ</Typography>
    </Tooltip>
    <Box sx={{ display: "flex", gap: 2, alignItems: "center", flexWrap: "wrap" }}>
      {input("auto_total_drawdown_start_amount", "전체 오토 감시 시작 (P)")}
      <Typography variant="caption" sx={{ fontSize: 11, color: "#888" }}>P 이상 달성 시 최고 PNL에서</Typography>
      {input("auto_total_drawdown_percent", "전체 오토 최고 PNL 손실률 (%)", 100, 70)}
      <Typography variant="caption" sx={{ fontSize: 11, color: "#888" }}>% 이상 손실 나면 전체 GH 오토 정지</Typography>
      {(!Number(config.auto_total_drawdown_start_amount) || !Number(config.auto_total_drawdown_percent))
        && <Typography variant="caption" sx={{ fontSize: 10, color: "#888" }}>(사용안함)</Typography>}
    </Box>
    <Box sx={{ display: "flex", gap: 2, alignItems: "center", flexWrap: "wrap" }}>
      <Typography variant="caption" sx={{ fontSize: 12, color: "#aaa", minWidth: 110 }}>종료슬롯 수 & PNL</Typography>
      <Typography variant="caption">슬롯이</Typography>
      {input("auto_total_stopped_slot_count", "종료 슬롯 수 (개)", 6, 60)}
      <Typography variant="caption">개 종료하고 오토합계</Typography>
      {input("auto_total_stopped_slot_pnl", "오토 합계 PNL (P)")}
      <Typography variant="caption">P 달성하면 전체 GH 오토 정지</Typography>
    </Box>
    <Typography variant="caption" color="text.secondary">종료 슬롯은 현재 연결된 슬롯의 마지막 오토가 종료된 슬롯입니다. 두 조건 모두 충족 시 정지하며 0은 사용안함입니다. 합계 초기화 시 최고 PNL도 초기화됩니다.</Typography>
    <Tooltip title={finalBetCapSummary(config.auto_final_bet_cap_amount)}>
      <Box sx={{ display: "flex", gap: 2, alignItems: "center", flexWrap: "wrap" }}>
        <Typography variant="caption" sx={{ fontSize: 12, color: "#aaa", minWidth: 110 }}>회차별 최종 배팅 상한 (P) · 공통</Typography>
        {input("auto_final_bet_cap_amount", "회차별 최종 배팅 상한 (P)", undefined, 140)}
        <Typography variant="caption">GH·모든 마틴을 합친 최종 실배팅액에 상한 적용 · 0은 사용안함</Typography>
      </Box>
    </Tooltip>
    <Typography variant="caption" color="text.secondary">모든 금액은 ×1 기준으로 설정하며 실제 적용 금액은 공통 실배팅 배율에 따라 조정됩니다. 슬롯 수와 손실률(%)에는 배율을 적용하지 않습니다.</Typography>
  </Box>;
}
