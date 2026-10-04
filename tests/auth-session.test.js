import assert from "node:assert/strict";
import test from "node:test";
import {
  applyAuthenticatedResponse, clearSessionToken, getSessionToken, setSessionToken, updateSessionToken,
} from "../src/services/auth-session.js";

const storage = new Map();
globalThis.sessionStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: (key) => storage.delete(key),
};

test("identity changes replace only the session that made the request", () => {
  setSessionToken("admin");
  applyAuthenticatedResponse({ config: { headers: { Authorization: "Bearer admin" } }, data: { access_token: "target" } });
  assert.equal(getSessionToken(), "target");
  assert.equal(updateSessionToken("admin", "late-admin-refresh"), false);
  assert.equal(getSessionToken(), "target");
  applyAuthenticatedResponse({ config: { headers: { Authorization: "Bearer target" } }, data: { access_token: "returned-admin" } });
  assert.equal(getSessionToken(), "returned-admin");
  assert.equal(updateSessionToken("target", "late-target-refresh"), false);
  assert.equal(getSessionToken(), "returned-admin");
});

test("a stale transition response cannot switch the current session", () => {
  setSessionToken("new-session");
  assert.throws(() => applyAuthenticatedResponse({ config: { headers: { Authorization: "Bearer old-session" } }, data: { access_token: "old-target" } }));
  assert.equal(getSessionToken(), "new-session");
});

test("logout and missing credentials cannot be undone by token refresh", () => {
  setSessionToken("target");
  clearSessionToken();
  assert.equal(getSessionToken(), null);
  assert.equal(updateSessionToken("target", "late-refresh"), false);
  assert.equal(updateSessionToken(null, "unexpected-token"), false);
  assert.equal(getSessionToken(), null);
});
