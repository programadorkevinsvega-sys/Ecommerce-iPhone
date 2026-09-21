const baseUrl = (process.env.PRODUCTION_URL ?? "https://iphone.jnmtortas.com").replace(/\/$/, "");
const allowedEmail = process.env.ADMIN_RBAC_ALLOWED_EMAIL;
const allowedPassword = process.env.ADMIN_RBAC_ALLOWED_PASSWORD;
const deniedEmail = process.env.ADMIN_RBAC_DENIED_EMAIL;
const deniedPassword = process.env.ADMIN_RBAC_DENIED_PASSWORD;

if (!allowedEmail || !allowedPassword || !deniedEmail || !deniedPassword) {
  throw new Error("Missing production RBAC verification credentials");
}

function cookieFrom(response) {
  const value = response.headers.get("set-cookie");
  if (!value) return "";
  return value.split(";")[0];
}

async function request(path, init = {}) {
  return fetch(`${baseUrl}${path}`, {
    redirect: "manual",
    ...init,
    headers: {
      accept: "application/json",
      ...(init.headers ?? {}),
    },
  });
}

async function login(email, password) {
  const response = await request("/api/admin/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (response.status !== 200) throw new Error(`login failed: ${response.status}`);
  const cookie = cookieFrom(response);
  if (!cookie) throw new Error("login did not return an admin session cookie");
  return cookie;
}

async function main() {
  const unauthenticated = await request("/api/admin/audit");
  if (unauthenticated.status !== 401) throw new Error(`expected 401 without session, got ${unauthenticated.status}`);

  const allowedCookie = await login(allowedEmail, allowedPassword);
  const allowedAudit = await request("/api/admin/audit", { headers: { cookie: allowedCookie } });
  if (allowedAudit.status !== 200) throw new Error(`expected 200 for authorized admin, got ${allowedAudit.status}`);

  const deniedCookie = await login(deniedEmail, deniedPassword);
  const deniedAudit = await request("/api/admin/audit", { headers: { cookie: deniedCookie } });
  if (deniedAudit.status !== 403) throw new Error(`expected 403 for restricted admin, got ${deniedAudit.status}`);

  const allowedCurrent = await request("/api/admin/auth", { headers: { cookie: allowedCookie } });
  if (allowedCurrent.status !== 200) throw new Error(`expected 200 for authenticated admin, got ${allowedCurrent.status}`);

  const logout = await request("/api/admin/auth", {
    method: "DELETE",
    headers: { cookie: allowedCookie },
  });
  if (logout.status !== 200) throw new Error(`expected 200 on admin logout, got ${logout.status}`);

  const revoked = await request("/api/admin/audit", { headers: { cookie: allowedCookie } });
  if (revoked.status !== 401) throw new Error(`expected 401 after session revocation, got ${revoked.status}`);

  console.log("admin production smoke: PASS");
  console.log("401 unauthenticated: PASS");
  console.log("200 authorized: PASS");
  console.log("403 restricted: PASS");
  console.log("session revocation: PASS");
}

await main();
