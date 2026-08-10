export const createEmptyAutoStatus = () => ({
  running: false,
  autoSessionId: null,
  phase: null,
  stop_reason: null,
  active_pot_count: null,
  pot_stop_count: 0,
  goal_amount: 0,
  error_code: null,
  error_detail: null,
  pending_direction: null,
  pending_amount_p: 0,
  pending_amount_won: 0,
});

export const shouldDisplayAutoError = (status, error = null) => Boolean(
  status?.running
  && (status?.phase === "error" || error)
);

export const shouldDisplaySlotAutoError = (slot) => Boolean(
  slot?.phase === "error" || slot?.auto_status === "error"
);

export const shouldDisplayBetFailure = (failureCode) => Boolean(
  failureCode && failureCode !== "phase_not_betting"
);

export const autoStatusLookupError = (status) => (
  status?.running
    ? {
        code: "status_lookup_failed",
        detail: "자동게임 상태를 확인하지 못했습니다.",
      }
    : null
);

export const mergePolledAutoStatus = (previous, status) => {
  const hasSession = Boolean(status?.auto_session_id);
  return {
    ...previous,
    running: Boolean(status?.running),
    autoSessionId: status?.auto_session_id || null,
    lastEventAt: status?.last_event_at,
    betsAttempted: status?.bets_attempted,
    betsSucceeded: status?.bets_succeeded,
    betsFailed: status?.bets_failed,
    phase: hasSession ? status?.phase ?? null : null,
    actual_bet_scale:
      status?.actual_bet_scale ?? previous?.actual_bet_scale ?? 1,
    pnl_total: status?.pnl_total ?? previous?.pnl_total,
    pnl_actual: status?.pnl_actual ?? previous?.pnl_actual,
    pnl_total_p: status?.pnl_total_p ?? previous?.pnl_total_p,
    pnl_actual_p: status?.pnl_actual_p ?? previous?.pnl_actual_p,
    round_count: status?.round_count ?? previous?.round_count,
    table_name: status?.table_name ?? previous?.table_name,
    play_mode: status?.play_mode ?? previous?.play_mode,
    stop_reason:
      status?.stop_reason ?? previous?.stop_reason ?? null,
    active_pot_count:
      status?.active_pot_count ?? previous?.active_pot_count ?? null,
    pot_stop_count:
      status?.pot_stop_count ?? previous?.pot_stop_count ?? 0,
    goal_amount:
      status?.goal_amount ?? previous?.goal_amount ?? 0,
    pending_direction:
      status?.pending_direction ?? null,
    pending_amount_p:
      status?.pending_amount_p ?? 0,
    pending_amount_won:
      status?.pending_amount_won ?? 0,
    error_code: hasSession ? status?.error_code ?? null : null,
    error_detail: hasSession ? status?.error_detail ?? null : null,
  };
};
