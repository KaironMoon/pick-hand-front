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

const HB_SETTINGS_API = {
  BASE: "/api/v1/hb/settings",
  GAME_PAUSE: "/api/v1/hb/settings/game/pause",
  GAME_RESUME: "/api/v1/hb/settings/game/resume",
  GAME_STATUS: "/api/v1/hb/settings/game/status",
};

const HB_GAMES_API = {
  START: "/api/v1/hb/games/start",
  ROUND: "/api/v1/hb/games/round",
  ENDING: "/api/v1/hb/games/ending",
  END: "/api/v1/hb/games/end",
  NEXT: "/api/v1/hb/games/next",
  LAST_ROUND: (id) => `/api/v1/hb/games/${id}/last-round`,
  STATE: (id) => `/api/v1/hb/games/state/${id}`,
  NICKNAMES: "/api/v1/hb/games/nicknames",
};

const GH_SETTINGS_API = {
  BASE: "/api/v1/gh/settings",
  GAME_PAUSE: "/api/v1/gh/settings/game/pause",
  GAME_RESUME: "/api/v1/gh/settings/game/resume",
  GAME_STATUS: "/api/v1/gh/settings/game/status",
};

const GH_GAMES_API = {
  START: "/api/v1/gh/games/start",
  ROUND: "/api/v1/gh/games/round",
  ENDING: "/api/v1/gh/games/ending",
  END: "/api/v1/gh/games/end",
  NEXT: "/api/v1/gh/games/next",
  LAST_ROUND: (id) => `/api/v1/gh/games/${id}/last-round`,
  STATE: (id) => `/api/v1/gh/games/state/${id}`,
};

export { API_URL, AUTH_API, USERS_API, SETTINGS_API, HB_SETTINGS_API, HB_GAMES_API, GH_SETTINGS_API, GH_GAMES_API };
