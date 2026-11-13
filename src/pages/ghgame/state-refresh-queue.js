export function createStateRefreshQueue() {
  const requests = new Map();

  return function refresh(gameId, generation, options, load) {
    const current = requests.get(gameId);
    if (current) {
      const pending = current.pending ?? createBatch(generation, options, load);
      pending.options = pending.generation === generation
        ? {
            partial: pending.options.partial && options.partial,
            diagnostic: options.diagnostic ?? pending.options.diagnostic,
          }
        : options;
      pending.generation = generation;
      pending.load = load;
      current.pending = pending;
      return pending.done;
    }

    const first = createBatch(generation, options, load);
    const request = { pending: null };
    requests.set(gameId, request);
    async function drain() {
      let next = first;
      try {
        while (next) {
          try {
            next.resolve(await next.load(next.generation, next.options));
          } catch (error) {
            next.reject(error);
          }
          next = request.pending;
          request.pending = null;
        }
      } finally {
        requests.delete(gameId);
      }
    }
    void drain();
    return first.done;
  };
}

function createBatch(generation, options, load) {
  const batch = { generation, options, load };
  batch.done = new Promise((resolve, reject) => {
    batch.resolve = resolve;
    batch.reject = reject;
  });
  return batch;
}
