const normalizeGameId = (value) => {
  const gameId = Number(value);
  return Number.isInteger(gameId) && gameId > 0 ? gameId : null;
};

export const createGameResponseGuard = () => {
  let activeGameId = null;
  let activeGeneration = 0;
  let requestSequence = 0;
  const latestRequestByGame = new Map();

  return {
    activate(value) {
      activeGameId = normalizeGameId(value);
      activeGeneration += 1;
      return activeGameId;
    },

    clear() {
      activeGameId = null;
      activeGeneration += 1;
    },

    isActive(value) {
      return normalizeGameId(value) === activeGameId;
    },

    begin(value) {
      const gameId = normalizeGameId(value);
      const sequence = ++requestSequence;
      if (gameId !== null) latestRequestByGame.set(gameId, sequence);
      return {
        gameId,
        sequence,
        generation: gameId === activeGameId ? activeGeneration : null,
      };
    },

    canApply(ticket) {
      return ticket?.gameId !== null
        && ticket?.gameId === activeGameId
        && ticket?.generation === activeGeneration
        && latestRequestByGame.get(ticket.gameId) === ticket.sequence;
    },
  };
};
