import { atom } from "jotai";
import authService from "@/services/auth-service";

const userAtom = atom(null);

const isAuthenticatedAtom = atom((get) => get(userAtom) !== null);

const loginAtom = atom(null, async (get, set, { username, password }) => {
  const user = await authService.login(username, password);
  set(userAtom, user);
  return user;
});

const logoutAtom = atom(null, async (get, set) => {
  authService.logout();
  set(userAtom, null);
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const initAuthAtom = atom(null, async (get, set) => {
  if (!authService.isAuthenticated()) {
    set(userAtom, null);
    return;
  }

  const MAX_RETRIES = 10;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const user = await authService.getMe();
      set(userAtom, user);
      return;
    } catch {
      if (attempt < MAX_RETRIES) {
        await sleep(5000);
      }
    }
  }
  // 모든 재시도 실패 → 로그아웃
  authService.logout();
  set(userAtom, null);
});

export { userAtom, isAuthenticatedAtom, loginAtom, logoutAtom, initAuthAtom };
