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
  LAST_ACTIVE: "/api/v1/hb/games/last-active",
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
  LAST_ACTIVE: "/api/v1/gh/games/last-active",
  LAST_ROUND: (id) => `/api/v1/gh/games/${id}/last-round`,
  STATE: (id) => `/api/v1/gh/games/state/${id}`,
};

const USER_BET_SETTINGS_API = {
  GET: (gameType) => `/api/v1/user-settings/${gameType}`,
  SAVE: (gameType) => `/api/v1/user-settings/${gameType}`,
};

const NC_GAMES_API = {
  START: "/api/v1/nc/games/start",
  ROUND: "/api/v1/nc/games/round",
  ENDING: "/api/v1/nc/games/ending",
  END: "/api/v1/nc/games/end",
  NEXT: "/api/v1/nc/games/next",
  LAST_ACTIVE: "/api/v1/nc/games/last-active",
  LAST_ROUND: (id) => `/api/v1/nc/games/${id}/last-round`,
  STATE: (id) => `/api/v1/nc/games/${id}/state`,
};

const NC_SETTINGS_API = {
  BASE: "/api/v1/nc/settings",
  GAME_PAUSE: "/api/v1/nc/settings/game/pause",
  GAME_RESUME: "/api/v1/nc/settings/game/resume",
  GAME_STATUS: "/api/v1/nc/settings/game/status",
};

const APP_SETTINGS_API = {
  BASE: "/api/v1/app-settings",
  BLOCKED_GAMES: "/api/v1/app-settings/blocked-games",
};

export { API_URL, AUTH_API, USERS_API, SETTINGS_API, HB_SETTINGS_API, HB_GAMES_API, GH_SETTINGS_API, GH_GAMES_API, NC_GAMES_API, NC_SETTINGS_API, USER_BET_SETTINGS_API, APP_SETTINGS_API };
