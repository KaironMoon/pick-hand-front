import apiCaller from "./api-caller";
import { MAINTENANCE_API } from "@/constants/api-url";

const maintenanceService = {
  async getStatus() {
    const response = await apiCaller.get(MAINTENANCE_API.STATUS);
    return response.data;
  },

  async updateStatus(payload) {
    const response = await apiCaller.put(MAINTENANCE_API.STATUS, payload);
    return response.data;
  },

  async getRunningUsers() {
    const response = await apiCaller.get(MAINTENANCE_API.RUNNING_USERS);
    return response.data;
  },

  async forceStopUser(userId) {
    const response = await apiCaller.post(MAINTENANCE_API.FORCE_STOP_USER(userId));
    return response.data;
  },
};

export default maintenanceService;
