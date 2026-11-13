import apiCaller from "@/services/api-caller";
import { getSessionToken } from "@/services/auth-session";

export const autoTabId = globalThis.crypto?.randomUUID?.();

const errorTypes = new Set(["SyntaxError", "TypeError", "NetworkError", "AxiosError", "Error"]);

export function reportAutoDiagnostic(context, stage, { error, response, closeCode } = {}) {
  const token = getSessionToken();
  if (!token) return;
  const httpResponse = response || error?.response;
  const diagnostic = {
    ...context,
    tab_id: autoTabId,
    stage,
    close_code: closeCode || undefined,
    http_status: httpResponse?.status,
    state_request_id: httpResponse?.headers?.["x-request-id"],
    error_type: error ? (errorTypes.has(error.name) ? error.name : "Error") : undefined,
  };
  fetch(`${apiCaller.baseUrl.replace(/\/$/, "")}/api/v1/diagnostics/auto-client`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(diagnostic),
    keepalive: true,
  }).then((result) => {
    if (!result.ok) console.warn("Auto diagnostic upload rejected", result.status, diagnostic);
  }).catch(() => {
    console.warn("Auto diagnostic upload failed", diagnostic);
  });
}
