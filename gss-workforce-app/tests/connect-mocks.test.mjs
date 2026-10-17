// Mocked end-to-end tests for the Pipedream Connect serverless functions.
// - Supabase auth is faked at the fetch layer (valid user for Bearer "good-token").
// - Pipedream API is faked at the fetch layer with two accounts:
//   acct_own (user-1) and acct_other (user-2).
let WS = globalThis.WebSocket;
if (!WS) {
  try { ({ default: WS } = await import("ws")); globalThis.WebSocket = WS; } catch {}
}

process.env.SUPABASE_URL = "https://test.supabase.co";
process.env.SUPABASE_ANON_KEY = "test-anon";
process.env.PIPEDREAM_CLIENT_ID = "pd-client-id";
process.env.PIPEDREAM_CLIENT_SECRET = "pd-client-secret";
process.env.PIPEDREAM_PROJECT_ID = "proj_9lsZN6Y";

const calls = [];
const ACCOUNTS = [
  { id: "acct_own", name: "own sheet", externalId: "user-1", app: { name: "Google Sheets", nameSlug: "google_sheets" }, createdAt: "2026-10-01T00:00:00Z", updatedAt: "2026-10-02T00:00:00Z", healthy: true, dead: false },
  { id: "acct_other", name: "other mail", externalId: "user-2", app: { name: "Gmail", nameSlug: "gmail" }, createdAt: "2026-10-01T00:00:00Z", updatedAt: "2026-10-02T00:00:00Z", healthy: true, dead: false },
];

global.fetch = async (url, init = {}) => {
  const u = String(url);
  calls.push({ url: u, method: init.method || "GET", body: init.body, headers: init.headers });
  const jsonRes = (body, status = 200) => ({
    ok: status < 400, status,
    json: async () => body,
    text: async () => JSON.stringify(body),
    headers: { get: () => "application/json" },
  });
  if (u.includes("supabase")) {
    const auth = (init.headers && init.headers.Authorization) || "";
    if (auth.includes("good-token")) {
      return jsonRes({ id: "user-1", email: "test@gss.local" });
    }
    return jsonRes({ msg: "invalid" }, 401);
  }
  if (u.includes("api.pipedream.com")) {
    if (u.endsWith("/oauth/token")) {
      return jsonRes({ access_token: "pd_access_token", token_type: "bearer", expires_in: 3600 });
    }
    if (u.endsWith("/tokens")) {
      return jsonRes({ token: "tok_mock_123", expiresAt: "2026-10-17T12:00:00Z", connectLinkUrl: "https://pipedream.com/connect-link/mock" });
    }
    if (u.includes("/accounts/") && (init.method || "") === "DELETE") {
      return { ok: true, status: 204, json: async () => null, text: async () => "" };
    }
    if (u.includes("/users/user-1/accounts")) {
      return jsonRes([ACCOUNTS[0]]);
    }
    if (u.includes("/users/user-2/accounts")) {
      return jsonRes([ACCOUNTS[1]]);
    }
    if (u.includes("/accounts")) {
      return jsonRes(ACCOUNTS);
    }
  }
  return jsonRes({ error: "unmocked " + u }, 500);
};

const res = () => ({
  code: 0, body: null,
  status(s) { this.code = s; return this; },
  json(b) { this.body = b; return this; },
  setHeader() {},
});
const authReq = (body) => ({ method: "POST", headers: { authorization: "Bearer good-token" }, body });

const tokenH = (await import("../api/connect-token.js")).default;
const accountsH = (await import("../api/connect-accounts.js")).default;
let failures = 0;
const check = (name, cond, extra) => { if (!cond) failures++; console.log((cond ? "PASS" : "FAIL") + " " + name + (cond ? "" : " " + JSON.stringify(extra))); };

// 1. token creation for the signed-in user
let r = res();
await tokenH(authReq({ external_user_id: "attacker-id" }), r);
const pdTokenCall = calls.find(c => c.url.endsWith("/tokens"));
check("token endpoint 200", r.code === 200 && r.body.token === "tok_mock_123", r);
check("external_user_id comes from session (user-1), not client body", pdTokenCall && pdTokenCall.body.includes("user-1") && !pdTokenCall.body.includes("attacker-id"), pdTokenCall);
check("project id in URL", pdTokenCall && pdTokenCall.url.includes("proj_9lsZN6Y"), pdTokenCall);
const envHeader = pdTokenCall && pdTokenCall.headers && typeof pdTokenCall.headers.entries === "function"
  ? [...pdTokenCall.headers.entries()].find(([k]) => k === "x-pd-environment") : null;
check("production env header", envHeader && envHeader[1] === "production", pdTokenCall && pdTokenCall.headers);

// 2. list accounts — per-user endpoint, returns only the signed-in user's
r = res();
await accountsH(authReq({}), r);
check("list 200", r.code === 200, r);
check("list returns only user-1's account", r.body?.accounts?.length === 1 && r.body?.accounts[0]?.id === "acct_own", r.body);
const own = (r.body?.accounts || []).find(a => a.id === "acct_own");
check("slim mapping camelCase + no credentials", own && own.externalId === "user-1" && own.createdAt === "2026-10-01T00:00:00Z" && !("credentials" in own), own);

// 3. delete another user's account -> 404
r = res();
await accountsH(authReq({ account_id: "acct_other" }), r);
check("delete foreign account blocked (404)", r.code === 404, r);

// 4. delete own account -> 200 + delete called for the right id
calls.length = 0;
r = res();
await accountsH(authReq({ account_id: "acct_own" }), r);
const delCall = calls.find(c => (c.method === "DELETE"));
check("delete own account 200", r.code === 200 && r.body.deleted === "acct_own", r);
check("DELETE sent to Pipedream for acct_own", delCall && delCall.url.includes("acct_own"), delCall);

// 5. unauthenticated -> 401
r = res();
await tokenH({ method: "POST", headers: {}, body: {} }, r);
check("no auth 401", r.code === 401, r);

// 6. client-supplied external_user_id ignored (already covered in 1) + GET 405
r = res();
await tokenH({ method: "GET", headers: {} }, r);
check("GET 405", r.code === 405, r);

// 7. upstream Pipedream failure -> 502
global.fetch = async (url, init = {}) => {
  const u = String(url);
  if (u.includes("supabase")) {
    const auth = (init.headers && init.headers.Authorization) || "";
    return auth.includes("good-token")
      ? { ok: true, status: 200, json: async () => ({ id: "user-1", email: "test@gss.local" }) }
      : { ok: false, status: 401, json: async () => ({ msg: "invalid" }) };
  }
  return { ok: false, status: 500, json: async () => ({ error: "upstream down" }), text: async () => "upstream down" };
};
r = res();
await tokenH(authReq({}), r);
check("upstream failure -> 502 with message", r.code === 502 && /failed/i.test(r.body?.error || ""), r);

// 8. unconfigured (no client id/secret) -> 500 with guidance
delete process.env.PIPEDREAM_CLIENT_ID;
r = res();
await tokenH(authReq({}), r);
check("unconfigured -> 500 with guidance", r.code === 500 && /PIPEDREAM_CLIENT_ID/.test(r.body?.error || ""), r);

console.log(failures === 0 ? "\nALL TESTS PASSED" : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
