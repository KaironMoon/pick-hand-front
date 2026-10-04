import apiCaller from "./api-caller";
import { AUTH_API, USERS_API } from "@/constants/api-url";
import {
  applyAuthenticatedResponse, clearSessionToken, getSessionToken, setSessionToken,
} from "./auth-session";

const authService = {
  async login(username, password) {
    const response = await apiCaller.post(AUTH_API.LOGIN, { username, password });
    const { access_token, user } = response.data;
    setSessionToken(access_token);
    return user;
  },

  logout() {
    clearSessionToken();
  },

  getToken() {
    return getSessionToken();
  },

  async getMe() {
    const response = await apiCaller.get(AUTH_API.ME);
    // 토큰 갱신
    if (response.data.access_token) {
      applyAuthenticatedResponse(response);
    }
    return response.data;
  },

  isAuthenticated() {
    return !!getSessionToken();
  },

  async impersonate(userId) {
    const response = await apiCaller.post(USERS_API.IMPERSONATE(userId));
    applyAuthenticatedResponse(response);
    return response.data.user;
  },

  async stopImpersonating() {
    const response = await apiCaller.post(AUTH_API.STOP_IMPERSONATING);
    applyAuthenticatedResponse(response);
    return response.data.user;
  },
};

export default authService;
