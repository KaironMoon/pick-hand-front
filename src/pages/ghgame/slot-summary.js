export const resolveSlotPnl = (slot, gameId, roundState, autoStatus) => {
  if (slot?.occupied && Number(slot.game_id) === Number(gameId) && roundState) {
    return autoStatus?.running
      ? (roundState.actual_bet_table?.server_total_pnl_p ?? 0)
      : (roundState.round_amount_table?.total_pnl ?? 0);
  }
  // The slots API selects actual/calculated PNL using each slot's Auto status.
  return slot?.total_pnl ?? 0;
};
