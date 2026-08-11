export const resolvePickMartinSummary = (roundState, autoStatus) => {
  const pickMartin = roundState?.pick_martin;

  return {
    step: pickMartin?.step || 1,
    amount: pickMartin?.amount ?? 0,
    direction: autoStatus?.running
      ? autoStatus?.pending_direction
      : pickMartin?.direction,
  };
};
