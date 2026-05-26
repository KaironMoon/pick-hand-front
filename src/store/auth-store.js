import { atom } from "jotai";
import authService from "@/services/auth-service";
import apiCaller from "@/services/api-caller";
import { ABOO_API } from "@/constants/api-url";

const userAtom = atom(null);

const isAuthenticatedAtom = atom((get) => get(userAtom) !== null);

// 모바일 앱(WebView) bridge — pragmatic_id로 쓸 username을 native에 전달.
// pick-hand-mobile §4.5 자동화. 웹 단독 환경에선 ReactNativeWebView가 없어 no-op.
function _notifyNativeBridge(user, token) {
  try {
    if (typeof window !== "undefined" && window.ReactNativeWebView?.postMessage) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: "pick_hand_auth",
        username: user?.username,
        token,
      }));
    }
  } catch {/* ignore */}
}

// 로그인 직후 pragmatic_id = username 자동 등록(§4.5 옵션 B).
// 503/409는 무해(기능 off 또는 이미 등록됨), 그 외 에러도 silent — 로그인 흐름 막지 않음.
async function _autoRegisterPragmaticId(username) {
  try {
    await apiCaller.put(ABOO_API.PRAGMATIC_ID, { pragmatic_id: username });
  } catch {/* ignore */}
}

const loginAtom = atom(null, async (get, set, { username, password }) => {
  const user = await authService.login(username, password);
  set(userAtom, user);
  const token = authService.getToken();
  _notifyNativeBridge(user, token);
  await _autoRegisterPragmaticId(user?.username || username);
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
      _notifyNativeBridge(user, authService.getToken());
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
