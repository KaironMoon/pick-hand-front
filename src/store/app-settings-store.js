import { atom } from "jotai";
import apiCaller from "@/services/api-caller";
import { APP_SETTINGS_API } from "@/constants/api-url";

const CACHE_TTL = 60 * 1000; // 1분

const blockedGamesAtom = atom([]);
const _lastFetchedAtAtom = atom(0);

const fetchBlockedGamesAtom = atom(null, async (get, set) => {
  const now = Date.now();
  const lastFetched = get(_lastFetchedAtAtom);
  if (now - lastFetched < CACHE_TTL) return;

  try {
    const res = await apiCaller.get(APP_SETTINGS_API.BLOCKED_GAMES);
    set(blockedGamesAtom, res.data.blocked_games || []);
  } catch {
    set(blockedGamesAtom, []);
  }
  set(_lastFetchedAtAtom, now);
});

const forceRefreshBlockedGamesAtom = atom(null, async (get, set) => {
  set(_lastFetchedAtAtom, 0);
  try {
    const res = await apiCaller.get(APP_SETTINGS_API.BLOCKED_GAMES);
    set(blockedGamesAtom, res.data.blocked_games || []);
  } catch {
    set(blockedGamesAtom, []);
  }
  set(_lastFetchedAtAtom, Date.now());
});

export { blockedGamesAtom, fetchBlockedGamesAtom, forceRefreshBlockedGamesAtom };
