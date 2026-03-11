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

const initAuthAtom = atom(null, async (get, set) => {
  if (!authService.isAuthenticated()) {
    set(userAtom, null);
    return;
  }
  try {
    const user = await authService.getMe();
    set(userAtom, user);
  } catch {
    authService.logout();
    set(userAtom, null);
  }
});

export { userAtom, isAuthenticatedAtom, loginAtom, logoutAtom, initAuthAtom };
