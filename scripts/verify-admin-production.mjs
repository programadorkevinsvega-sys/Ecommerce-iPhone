const baseUrl = (process.env.PRODUCTION_URL ?? "https://iphone.jnmtortas.com").replace(/\/$/, "");
const allowedEmail = process.env.ADMIN_RBAC_ALLOWED_EMAIL ?? process.env.ADMIN_EMAIL;
const allowedPassword = process.env.ADMIN_RBAC_ALLOWED_PASSWORD ?? process.env.ADMIN_PASSWORD;
const deniedEmail = process.env.ADMIN_RBAC_DENIED_EMAIL;
const deniedPassword = process.env.ADMIN_RBAC_DENIED_PASSWORD;

if (!allowedEmail || !allowedPassword) {
  throw new Error("Missing production admin credentials: set ADMIN_EMAIL and ADMIN_PASSWORD or the explicit ADMIN_RBAC_ALLOWED_* variables");
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

async function currentAdmin(cookie) {
  const response = await request("/api/admin/auth", { headers: { cookie } });
  if (response.status !== 200) throw new Error(`current admin check failed: ${response.status}`);
  return response.json();
}

async function main() {
  const unauthenticated = await request("/api/admin/audit");
  if (unauthenticated.status !== 401) throw new Error(`expected 401 without session, got ${unauthenticated.status}`);

  const allowedCookie = await login(allowedEmail, allowedPassword);
  const principal = await currentAdmin(allowedCookie);

  const allowedAudit = await request("/api/admin/audit", { headers: { cookie: allowedCookie } });
  if (allowedAudit.status !== 200) throw new Error(`expected 200 for authorized admin, got ${allowedAudit.status}`);

  if (deniedEmail || deniedPassword) {
    if (!deniedEmail || !deniedPassword) throw new Error("Both ADMIN_RBAC_DENIED_EMAIL and ADMIN_RBAC_DENIED_PASSWORD are required together");
    const deniedCookie = await login(deniedEmail, deniedPassword);
    const deniedAudit = await request("/api/admin/audit", { headers: { cookie: deniedCookie } });
    if (deniedAudit.status !== 403) throw new Error(`expected 403 for restricted admin, got ${deniedAudit.status}`);
  } else if (principal?.admin?.role !== "SUPER_ADMIN") {
    const restricted = await request("/api/admin/users", { headers: { cookie: allowedCookie } });
    if (restricted.status !== 403) throw new Error(`expected 403 for ADMIN lacking admins:manage, got ${restricted.status}`);
  } else {
    throw new Error("Restricted production admin credentials are required to certify 403 because the supplied account is SUPER_ADMIN");
  }

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
  console.log("403 authorization boundary: PASS");
  console.log("session revocation: PASS");
}

await main();
