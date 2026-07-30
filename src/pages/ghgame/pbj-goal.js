export const PBJ_STRATEGY_KEYS = ["P", "B", "J"];

export const updatePbjStrategy = (config, strategyKey, nextStrategy) => {
  const nextConfig = { ...config, [strategyKey]: nextStrategy };
  if (!PBJ_STRATEGY_KEYS.includes(strategyKey)) return nextConfig;

  const previousTarget = config?.[strategyKey]?.target_man ?? 0;
  const nextTarget = nextStrategy?.target_man ?? 0;
  if (nextTarget === previousTarget) return nextConfig;

  PBJ_STRATEGY_KEYS.forEach((key) => {
    nextConfig[key] = {
      ...(config?.[key] || {}),
      ...(key === strategyKey ? nextStrategy : {}),
      target_man: nextTarget,
    };
  });
  return nextConfig;
};
