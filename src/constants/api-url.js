const API_URL = "";

const AUTH_API = {
  LOGIN: "/api/v1/auth/login",
  ME: "/api/v1/auth/me",
};

const USERS_API = {
  BASE: "/api/v1/users",
  DETAIL: (id) => `/api/v1/users/${id}`,
};

const SETTINGS_API = {
  BASE: "/api/v1/settings",
  GAME_START: "/api/v1/settings/game/start",
  GAME_END: "/api/v1/settings/game/end",
  GAME_PAUSE: "/api/v1/settings/game/pause",
  GAME_RESUME: "/api/v1/settings/game/resume",
  GAME_STATUS: "/api/v1/settings/game/status",
};

export { API_URL, AUTH_API, USERS_API, SETTINGS_API };
