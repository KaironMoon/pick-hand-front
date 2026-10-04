const TOKEN_KEY = "pick_hand_token";

export const getSessionToken = () => sessionStorage.getItem(TOKEN_KEY);
export const setSessionToken = (token) => sessionStorage.setItem(TOKEN_KEY, token);
export const clearSessionToken = () => sessionStorage.removeItem(TOKEN_KEY);

// A response for a previous identity must not overwrite a switched session.
export function updateSessionToken(expectedToken, replacementToken) {
  if (!expectedToken || getSessionToken() !== expectedToken) return false;
  setSessionToken(replacementToken);
  return true;
}

export function applyAuthenticatedResponse(response) {
  const expectedToken = response.config.headers.Authorization?.replace(/^Bearer /, "");
  if (!updateSessionToken(expectedToken, response.data.access_token)) {
    throw new Error("인증 상태가 변경되었습니다. 다시 시도해 주세요.");
  }
}
