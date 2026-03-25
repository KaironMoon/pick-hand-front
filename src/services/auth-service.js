import apiCaller from "./api-caller";
import { AUTH_API } from "@/constants/api-url";

const TOKEN_KEY = "pick_hand_token";

const authService = {
  async login(username, password) {
    const response = await apiCaller.post(AUTH_API.LOGIN, { username, password });
    const { access_token, user } = response.data;
    sessionStorage.setItem(TOKEN_KEY, access_token);
    return user;
  },

  logout() {
    sessionStorage.removeItem(TOKEN_KEY);
  },

  getToken() {
    return sessionStorage.getItem(TOKEN_KEY);
  },

  async getMe() {
    const response = await apiCaller.get(AUTH_API.ME);
    return response.data;
  },

  isAuthenticated() {
    return !!sessionStorage.getItem(TOKEN_KEY);
  },
};

export default authService;
