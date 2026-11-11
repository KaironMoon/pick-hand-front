import { useEffect, useState } from "react";
import apiCaller from "./api-caller";

export const GH_SUPPORT_API = "/api/v1/gh/support";

export function supportAdminUsername(user) {
  return user?.impersonator?.username ?? (user?.role === "admin" ? user.username : null);
}

export function supportError(error, fallback) {
  const detail = error.response?.data?.detail;
  return typeof detail === "string" ? detail : fallback;
}

export function useSupportPoll(path, interval, revision = 0) {
  const [result, setResult] = useState({ data: null, error: null });

  useEffect(() => {
    if (!path) return undefined;
    const controller = new AbortController();
    let running = false;
    const load = async () => {
      if (running || controller.signal.aborted || document.hidden) return;
      running = true;
      try {
        const { data } = await apiCaller.get(path, {}, { signal: controller.signal });
        if (!controller.signal.aborted) setResult({ data, error: null });
      } catch (error) {
        if (!controller.signal.aborted) {
          setResult((current) => ({
            data: [403, 404, 409].includes(error.response?.status) ? null : current.data,
            error,
          }));
        }
      } finally {
        running = false;
      }
    };
    load();
    const timer = setInterval(load, interval);
    document.addEventListener("visibilitychange", load);
    return () => {
      controller.abort();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", load);
    };
  }, [path, interval, revision]);

  return result;
}
