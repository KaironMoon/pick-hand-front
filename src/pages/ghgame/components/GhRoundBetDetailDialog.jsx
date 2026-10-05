import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from "@mui/material";

const formatP = (value) => value == null ? "—" : `${Number(value).toFixed(1)}P`;
const sequenceText = (values) => Array.isArray(values) ? values.join(" ") : "—";
const sideText = (value) => value === "P" ? "Player (P)" : value === "B" ? "Banker (B)" : "상계 / 배팅 없음";

export default function GhRoundBetDetailDialog({ open, onClose, round, detail, actualCell, amountMode }) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md" aria-labelledby="gh-round-bet-detail-title">
      <DialogTitle id="gh-round-bet-detail-title">{round}회차 배팅 상세</DialogTitle>
      <DialogContent dividers>
        {!detail ? (
          <Typography color="text.secondary">이 회차의 상세 배팅 기록이 없습니다.</Typography>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
            <Box>
              <Typography variant="subtitle1" fontWeight={700}>계산 배팅액</Typography>
              <Typography>{sideText(detail.side)} · {formatP(detail.amount)}</Typography>
              <Typography sx={{ mt: 0.5, fontFamily: "monospace" }}>{detail.offset_formula}</Typography>
              <Typography color="text.secondary" variant="body2">
                실제 결과: {detail.actual || "미입력"} · 계산 손익: {formatP(detail.pnl)}
              </Typography>
              {detail.bet_unavailable_reason && (
                <Typography color="text.secondary" variant="body2">배팅 보류 상태가 적용된 회차입니다.</Typography>
              )}
            </Box>
            {amountMode === "actual" && (
              <Box>
                <Typography variant="subtitle1" fontWeight={700}>실제 배팅 기록</Typography>
                <Typography>
                  체결: {actualCell?.bet_placed ? "완료" : "없음"} · 표시 금액: {formatP(actualCell?.server_bet_amount_p ?? actualCell?.bet_amount_p)}
                </Typography>
                <Typography color="text.secondary" variant="body2">
                  정산: {actualCell?.settled ? "완료" : "미정산"} · 표시 손익: {formatP(actualCell?.server_pnl_p)}
                </Typography>
                {actualCell?.failure_detail && <Typography color="error">{actualCell.failure_detail}</Typography>}
              </Box>
            )}
            <Box>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>전략별 금액 구성 · 계산 손익</Typography>
              <Box sx={{ overflowX: "auto" }}>
                <Box component="table" sx={{
                  width: "100%", borderCollapse: "collapse", fontSize: 13,
                  "& th, & td": { borderBottom: "1px solid", borderColor: "divider", p: 0.75, textAlign: "right" },
                  "& th:first-of-type, & td:first-of-type": { textAlign: "left" },
                }}>
                  <thead><tr><th scope="col">전략</th><th scope="col">P 금액</th><th scope="col">B 금액</th><th scope="col">손익</th></tr></thead>
                  <tbody>
                    {detail.components?.length === 0 && <tr><td colSpan={4}>해당 회차에 사용 설정된 전략이 없습니다.</td></tr>}
                    {(detail.components || []).map((row) => (
                      <tr key={row.key}><th scope="row">
                        {row.label}
                        {row.usage_recorded === false && <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.75 }}>사용 여부 기록 없음</Typography>}
                      </th><td>{formatP(row.p_amount)}</td><td>{formatP(row.b_amount)}</td><td>{formatP(row.pnl)}</td></tr>
                    ))}
                  </tbody>
                  <tfoot><tr><th scope="row">합계</th><td>{formatP(detail.p_total)}</td><td>{formatP(detail.b_total)}</td><td>{formatP(detail.pnl)}</td></tr></tfoot>
                </Box>
              </Box>
            </Box>
            <Box>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>패턴 발동 근거</Typography>
              {detail.snapshot_source !== "game_start" && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  게임 시작 시 패턴 스냅샷이 없는 기존 게임입니다.
                </Typography>
              )}
              {!detail.patterns?.length ? (
                <Typography color="text.secondary">패턴 발동 기록 없음</Typography>
              ) : detail.patterns.map((strategy) => (
                <Box key={strategy.key} sx={{ mb: 1.5, p: 1.5, border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
                  <Typography fontWeight={700}>{strategy.label} · 최초 {strategy.activation_round}회차 발동</Typography>
                  {strategy.matches.map((match, index) => (
                    <Box key={`${match.rule_no}-${index}`} sx={{ mt: 1.25 }}>
                      <Typography>{match.rule_no}번 패턴 · 배팅 방향 {match.direction}</Typography>
                      <Typography sx={{ fontFamily: "monospace", overflowWrap: "anywhere" }}>설정 패턴: {sequenceText(match.pattern)}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        설정 방향 {match.configured_direction} · {match.match_kind === "inverse" ? "반대 패턴 일치" : "정방향 일치"} · 반대 패턴 포함 {match.include_inverse ? "켜짐" : "꺼짐"}
                      </Typography>
                      <Typography sx={{ fontFamily: "monospace", overflowWrap: "anywhere" }}>
                        일치 결과{match.matched_from_round != null ? ` (${match.matched_from_round}~${match.matched_to_round}회차)` : ""}: {sequenceText(match.matched_sequence)}
                      </Typography>
                      {match.min_miss_streak > 0 && (
                        <Typography variant="body2" color="text.secondary">발동 조건: 메인 빅로드 {match.min_miss_streak}연속 실패 이상</Typography>
                      )}
                    </Box>
                  ))}
                </Box>
              ))}
            </Box>
          </Box>
        )}
      </DialogContent>
      <DialogActions><Button onClick={onClose}>닫기</Button></DialogActions>
    </Dialog>
  );
}
