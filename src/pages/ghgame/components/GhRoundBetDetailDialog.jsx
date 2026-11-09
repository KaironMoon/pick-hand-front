import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { GH_GAMES_API } from "@/constants/api-url";
import apiCaller from "@/services/api-caller";

const formatP = (value) => value == null || value === "N/A" ? "—" : `${Number(value).toFixed(1)}P`;
const sequenceText = (values) => Array.isArray(values) ? values.join(" ") : "—";
const sideText = (value) => value === "P" ? "Player (P)" : value === "B" ? "Banker (B)" : "배팅 없음";

function wagerText({ side, amount, status, actual, wager_state: state }) {
  if (state === "held") return "보류";
  if (state === "offset") return "상계 · 0.0P";
  if (!(Number(amount) > 0)) return "배팅 없음";
  const result = status === "hit" ? "승" : status === "miss" ? "패" : actual === "T" ? "타이" : null;
  return [sideText(side), formatP(amount), result].filter(Boolean).join(" · ");
}

function LabouchereSequences({ entries, loading, error }) {
  return (
    <Box sx={{ mt: 1 }}>
      <Typography variant="body2" fontWeight={700}>라보쉐르 배열</Typography>
      {entries?.length ? entries.map(({ label, sequence }, index) => (
        <Typography key={`${label}-${index}`} variant="body2" sx={{ overflowWrap: "anywhere" }}>
          {label} · [{sequence.join(", ")}]
        </Typography>
      )) : (
        <Typography variant="body2" color={error ? "error" : "text.secondary"}>
          {loading ? "배열 불러오는 중…" : error ? "배열을 불러오지 못했습니다." : "배열 기록 없음"}
        </Typography>
      )}
    </Box>
  );
}

function BetBreakdown({ title, detail }) {
  return (
    <Box component="section" sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Typography variant="subtitle1" fontWeight={700}>{title}</Typography>
      {detail.kp_assist && (
        <Box>
          <Typography variant="subtitle1" fontWeight={700}>KP 어시스트 적용 내역</Typography>
          <Typography>
            {detail.kp_assist.step > 0 ? `어시스트 ${detail.kp_assist.step}단계` : "어시스트 집계 대기 / 종료"} · 적용 옵션: {detail.kp_assist.option}
          </Typography>
          <Typography>
            GH+마틴Z+KP 상계 방향: {detail.kp_assist.base_direction || "없음"}
            {" → "}방향 적용 후 배팅: {detail.kp_assist.direction ? `${detail.kp_assist.direction} · ${formatP(detail.kp_assist.amount)}` : "배팅 없음"}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            어시스트 단계 판정: {sideText(detail.kp_assist.source_direction)} · {formatP(detail.kp_assist.source_amount)}
            {" · "}결과: {detail.kp_assist.source_status === "hit" ? "승" : detail.kp_assist.source_status === "miss" ? "패" : detail.actual === "T" ? "타이 · 단계 유지" : detail.actual ? "집계 제외 · 단계 유지" : "미입력"}
          </Typography>
        </Box>
      )}
      <Box>
        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
          전략별 금액 구성 · 계산 손익
        </Typography>
        <Typography variant="body2" sx={{ mb: 1, fontFamily: "monospace" }}>{detail.offset_formula}</Typography>
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
      {Boolean(detail.martin_b_bets?.length) && (
        <Box>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>마틴B 본베팅 · 어시베팅 내역</Typography>
          {detail.martin_b_bets.map((bet) => (
            <Box key={bet.pattern_no} sx={{ mb: 1.5, p: 1.5, border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
              <Typography fontWeight={700}>
                {bet.pattern_no}번 · {bet.step}단계 · 승수 귀속: {bet.pattern_no}번
              </Typography>
              {bet.untriggered_action === "assist" && (
                <Typography variant="body2" color="text.secondary">지정회차까지 패턴 미발동으로 어시 전환</Typography>
              )}
              <Box sx={{ overflowX: "auto", mt: 1 }}>
                <Box component="table" sx={{ width: "100%", borderCollapse: "collapse", fontSize: 13,
                  "& th, & td": { p: 0.75, textAlign: "left", borderBottom: "1px solid", borderColor: "divider" } }}>
                  <thead><tr><th scope="col">구분</th><th scope="col">사용 패턴</th><th scope="col">일치 패턴</th><th scope="col">방향</th><th scope="col">금액</th></tr></thead>
                  <tbody>{bet.matches.map((match) => (
                    <tr key={match.rule_no}>
                      <td>{match.bet_role === "main" ? "본베팅" : "어시베팅"}</td>
                      <td>{match.pattern_label}번</td>
                      <td style={{ fontFamily: "monospace" }}>{sequenceText(match.matched_sequence)}</td>
                      <td>{match.direction}</td><td>{formatP(match.amount)}</td>
                    </tr>
                  ))}</tbody>
                </Box>
              </Box>
              <Typography sx={{ mt: 1 }}>
                번호 내 합산: {bet.offset ? "상계" : sideText(bet.direction)} · {formatP(bet.amount)}
                {" · "}결과: {bet.status === "hit" ? "승" : bet.status === "miss" ? "패" : detail.actual === "T" ? "타이" : "—"}
                {" · "}손익: {formatP(bet.pnl)}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
      <Box>
        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>글로벌히트 생성픽 근거</Typography>
        {!detail.globalhit_generated_picks?.length ? (
          <Typography color="text.secondary">이 회차에 저장된 생성픽 근거가 없습니다.</Typography>
        ) : (
          <Box sx={{ overflowX: "auto" }}>
            <Box component="table" sx={{
              width: "100%", borderCollapse: "collapse", fontSize: 13,
              "& th, & td": { borderBottom: "1px solid", borderColor: "divider", p: 0.75, textAlign: "left" },
            }}>
              <thead><tr><th scope="col">전략</th><th scope="col">번호</th><th scope="col">약칭</th><th scope="col">패턴</th><th scope="col">픽</th></tr></thead>
              <tbody>{detail.globalhit_generated_picks.map((row) => (
                <tr key={row.key}>
                  <th scope="row">{row.key} · {row.label}</th>
                  <td>{row.number ?? "—"}</td><td>{row.nickname ?? "—"}</td>
                  <td style={{ fontFamily: "monospace", overflowWrap: "anywhere" }}>
                    {row.pattern}
                    {row.condition && <Typography variant="caption" color="text.secondary" display="block">{row.condition}</Typography>}
                  </td>
                  <td>{row.pick ?? "—"}</td>
                </tr>
              ))}</tbody>
            </Box>
          </Box>
        )}
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
            <Typography fontWeight={700}>
              {strategy.label} · {strategy.activation_round}회차 적용 · {strategy.rule_numbers.join("번, ")}번 패턴
            </Typography>
            {strategy.p_amount != null && strategy.b_amount != null && (
              <Typography>
                패턴 금액: P {formatP(strategy.p_amount)} − B {formatP(strategy.b_amount)}
                {" → "}{strategy.offset ? "상계" : strategy.direction} {formatP(strategy.net_amount)}
              </Typography>
            )}
            {strategy.offset && <Typography color="warning.main">반대 방향 패턴이 서로 상계되었습니다.</Typography>}
            {strategy.applied_p_amount != null && (
              <Typography variant="body2" color="text.secondary">
                계산 반영: P {formatP(strategy.applied_p_amount)} · B {formatP(strategy.applied_b_amount)}
              </Typography>
            )}
            {strategy.matches.map((match, index) => (
              <Box key={`${match.rule_no}-${index}`} sx={{ mt: 1.25 }}>
                <Typography>{match.rule_no}번 패턴 · 배팅 방향 {match.direction}{match.amount != null ? ` · ${formatP(match.amount)}` : ""}</Typography>
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
  );
}

export default function GhRoundBetDetailDialog({ open, onClose, gameId, completedRounds, round, detail, actualCell, amountMode, virtualBet }) {
  const [labouchere, setLabouchere] = useState(null);
  const canLoad = open && gameId && round && detail && round <= completedRounds + 1;
  const lookupKey = canLoad ? `${gameId}-${round}-${detail.actual ?? ""}` : null;
  useEffect(() => {
    if (!lookupKey) return;
    const controller = new AbortController();
    apiCaller.get(GH_GAMES_API.ROUND_LABOUCHERE(gameId, round), { include_virtual_detail: true }, { signal: controller.signal })
      .then(({ data }) => {
        if (!controller.signal.aborted) setLabouchere({ key: lookupKey, data });
      })
      .catch(() => {
        if (!controller.signal.aborted) setLabouchere({ key: lookupKey, error: true });
      });
    return () => controller.abort();
  }, [gameId, round, lookupKey]);
  const sequenceResult = labouchere?.key === lookupKey ? labouchere : null;
  const sequenceLoading = Boolean(lookupKey && !sequenceResult);
  const virtualDetail = sequenceResult?.data?.virtual_detail;
  const virtualWager = virtualDetail ?? virtualBet;
  const hasOrderRecord = Boolean(actualCell?.external_game_id || actualCell?.bet_placed || actualCell?.failure_code);
  const showOrder = hasOrderRecord || amountMode === "actual";
  const placed = Boolean(actualCell?.bet_placed);
  const held = !placed && (detail?.wager_state === "held" || detail?.bet_unavailable_reason || actualCell?.failure_code === "gh_bet_paused");
  const realWager = held ? { wager_state: "held", pnl: 0 } : showOrder ? {
    side: placed ? actualCell.bet_side : null,
    amount: placed ? actualCell.bet_amount_p : 0,
    pnl: placed && actualCell.settled ? actualCell.actual_pnl_p : placed ? null : 0,
    status: placed ? actualCell.status : null,
    actual: detail?.actual,
  } : detail;
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md" aria-labelledby="gh-round-bet-detail-title">
      <DialogTitle id="gh-round-bet-detail-title">{round}회차 배팅 상세</DialogTitle>
      <DialogContent dividers>
        {!detail ? (
          <Typography color="text.secondary">이 회차의 상세 배팅 기록이 없습니다.</Typography>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                실제 결과: {detail.actual || "미입력"}
              </Typography>
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
                <Box>
                  <Typography variant="subtitle1" fontWeight={700}>{showOrder ? "실배팅 (BET)" : "계산 배팅 (RE)"}</Typography>
                  <Typography>{wagerText(realWager)}</Typography>
                  <Typography color="text.secondary" variant="body2">손익: {formatP(realWager.pnl)}</Typography>
                  {hasOrderRecord && (
                    <Typography color="text.secondary" variant="body2">
                      체결: {actualCell.bet_placed ? "완료" : "없음"} · 정산: {actualCell.settled ? "완료" : "미정산"}
                    </Typography>
                  )}
                  {actualCell?.failure_detail && <Typography color="error">{actualCell.failure_detail}</Typography>}
                  <LabouchereSequences entries={sequenceResult?.data?.real} loading={sequenceLoading} error={sequenceResult?.error} />
                </Box>
                <Box>
                  <Typography variant="subtitle1" fontWeight={700}>가상 배팅 (VBET)</Typography>
                  {virtualWager ? <>
                    <Typography>{sequenceLoading && !Number(virtualWager.amount) ? "가상 배팅 확인 중…" : wagerText(virtualWager)}</Typography>
                    <Typography color="text.secondary" variant="body2">가상 손익: {formatP(virtualWager.pnl)}</Typography>
                  </> : <Typography color="text.secondary" variant="body2">이 회차의 가상 배팅 기록이 없습니다.</Typography>}
                  {sequenceResult?.error && <Typography color="error" variant="body2">가상 배팅 근거를 불러오지 못했습니다.</Typography>}
                  <LabouchereSequences entries={sequenceResult?.data?.virtual} loading={sequenceLoading} error={sequenceResult?.error} />
                </Box>
              </Box>
            </Box>
            {!held && <BetBreakdown title="전략 계산 근거 (RE)" detail={detail} />}
            {virtualDetail && <BetBreakdown title="가상 배팅 근거 (VBET)" detail={virtualDetail} />}
          </Box>
        )}
      </DialogContent>
      <DialogActions><Button onClick={onClose}>닫기</Button></DialogActions>
    </Dialog>
  );
}
