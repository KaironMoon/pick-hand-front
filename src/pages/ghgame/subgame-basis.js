export const getRoundStateSubgameBasis = (roundState) => {
  const basis = roundState?.subgame_basis;
  return basis && typeof basis === "object" && !Array.isArray(basis)
    ? basis
    : {};
};
