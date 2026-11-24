// Apply server-authored presentation patches only. No pick/PNL calculations.
export function applyViewPatch(previous, patch) {
  if (patch == null) return previous;
  if (patch.op === "replace") return patch.value;
  if (patch.op === "object") {
    const next = { ...previous };
    for (const key of patch.remove) delete next[key];
    for (const [key, change] of Object.entries(patch.set)) {
      Object.defineProperty(next, key, {
        value: applyViewPatch(previous?.[key], change), enumerable: true, writable: true, configurable: true,
      });
    }
    return next;
  }
  if (patch.op === "array") {
    const next = previous.slice(0, patch.length);
    next.length = patch.length;
    for (const [index, change] of patch.set) next[index] = applyViewPatch(previous[index], change);
    return next;
  }
  throw new Error("Unsupported GH view patch");
}

export function createIncrementalView() {
  let current = null;
  return {
    reset(data = null) { current = data ? { gameId: Number(data.game_id), token: null, data } : null; },
    request(gameId, { full = false } = {}) {
      return {
        incremental_response: true,
        ...(!full && current?.gameId === Number(gameId) && current.token ? { response_base: current.token } : {}),
      };
    },
    accept(wire) {
      const meta = wire._view;
      if (!meta) {
        this.reset(wire);
        return wire;
      }
      const gameId = Number(wire.game_id);
      if (meta.version !== 1 || Number(meta.game_id) !== gameId) throw new Error("Invalid GH view response");
      let next;
      if (meta.kind === "patch") {
        if (current?.gameId !== gameId || current.token !== meta.base || current.role !== meta.role) {
          const error = new Error("GH view baseline changed");
          error.code = "GH_VIEW_RESYNC";
          throw error;
        }
        next = applyViewPatch(current.data, wire.patch);
      } else if (meta.kind === "full") {
        if (!meta.fixed && current?.gameId === gameId && (meta.base ?? null) !== current.token) {
          const error = new Error("GH replacement view is stale");
          error.code = "GH_VIEW_RESYNC";
          throw error;
        }
        if (!meta.fixed && current?.gameId === gameId && current.role != null && current.role !== meta.role) {
          const error = new Error("GH view role changed");
          error.code = "GH_VIEW_RESYNC";
          throw error;
        }
        const { _view, ...data } = wire;
        next = data;
        if (!meta.fixed && current?.gameId === gameId && (current.role == null || current.role === meta.role)) {
          if (current.data.config !== undefined) next.config = current.data.config;
          const fixed = current.data.round_state_lower?.user_options_snapshot;
          if (fixed !== undefined && next.round_state_lower && !next.options_dynamic) {
            next.round_state_lower = { ...next.round_state_lower, user_options_snapshot: fixed };
          }
        }
      } else throw new Error("Unsupported GH view response");
      // Keep unchanged nested objects by identity so memoized boards can reuse them.
      current = { gameId, role: meta.role, token: meta.token, data: next };
      return { ...next, _view: meta };
    },
  };
}
