// Display the server's final combined board direction without recalculating it.
export const resolveBetBoardDirection = (roundState) => (
  roundState?.round_amount_table?.total_side ?? null
);
