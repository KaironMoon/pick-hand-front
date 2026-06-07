/**
 * pick-aboo 통합 자동 베팅 서비스 — mvp-aboo-integration.md §6.2 wrapper.
 *
 * 모든 호출은 백엔드 AUTO_BETTING_ENABLED 플래그에 따라 503 가능.
 * UI 측에서 503은 "기능 미활성" 안내로 처리.
 */
import apiCaller from "./api-caller";
import { ABOO_API } from "@/constants/api-url";

const autoService = {
  async getSessionStatus(pragmaticId) {
    const resp = await apiCaller.get(ABOO_API.SESSION_STATUS, { pragmatic_id: pragmaticId });
    return resp.data;
  },

  async updatePragmaticId(pragmaticId) {
    const resp = await apiCaller.put(ABOO_API.PRAGMATIC_ID, { pragmatic_id: pragmaticId });
    return resp.data;
  },

  async startAuto({ gameId, pragmaticId, tableId, server, gameType = "gh" }) {
    const resp = await apiCaller.post(ABOO_API.AUTO_START, {
      game_id: gameId,
      pragmatic_id: pragmaticId,
      table_id: tableId,
      server: server || null,
      game_type: gameType,
    });
    return resp.data;
  },

  async stopAuto(autoSessionId) {
    const resp = await apiCaller.post(ABOO_API.AUTO_STOP, { auto_session_id: autoSessionId });
    return resp.data;
  },

  async getAutoStatus(gameId) {
    const resp = await apiCaller.get(ABOO_API.AUTO_STATUS, { game_id: gameId });
    return resp.data;
  },

  async discoverTables(pragmaticId, refresh = false) {
    const resp = await apiCaller.get(ABOO_API.DISCOVER_TABLES, {
      pragmatic_id: pragmaticId,
      refresh,
    });
    return resp.data; // { tables: [...], count, refresh_cooldown }
  },
};

export default autoService;
