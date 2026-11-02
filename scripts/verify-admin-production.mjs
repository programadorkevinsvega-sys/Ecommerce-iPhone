const baseUrl = (process.env.PRODUCTION_URL ?? "https://iphone.jnmtortas.com").replace(/\/$/, "");
const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;
const { getProductionMonitorHeaders } = await import("./production-monitor-auth.mjs");
const monitorHeaders = await getProductionMonitorHeaders(baseUrl);

if (!email || !password) {
  throw new Error("Missing production admin credentials: set ADMIN_EMAIL and ADMIN_PASSWORD.");
}

function cookieFrom(response, name) {
  const headers = response.headers.getSetCookie?.() ?? [response.headers.get("set-cookie") ?? ""];
  const value = headers.find((header) => header.startsWith(`${name}=`));
  return value ? value.split(";")[0] : "";
}

async function request(path, init = {}) {
  return fetch(`${baseUrl}${path}`, {
    redirect: "manual",
    ...init,
    headers: {
      accept: "application/json",
      ...(init.headers ?? {}),
      ...monitorHeaders,
    },
  });
}

async function main() {
  const unauthenticated = await request("/api/admin/audit");
  if (unauthenticated.status !== 401) {
    throw new Error(`expected 401 without an admin session, got ${unauthenticated.status}`);
  }

  const login = await request("/api/admin/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (login.status !== 202) {
    throw new Error(
      `expected password verification to return an MFA challenge (202), got ${login.status}`,
    );
  }

  const loginBody = await login.json();
  if (loginBody?.mfaRequired !== true || typeof loginBody?.enrollmentRequired !== "boolean") {
    throw new Error("admin login did not return the mandatory MFA challenge contract");
  }

  const challengeCookie = cookieFrom(login, "admin_mfa_challenge");
  if (!challengeCookie) throw new Error("admin MFA challenge cookie was not issued");
  if (cookieFrom(login, "admin_session")) {
    throw new Error("password-only login must never issue an admin session");
  }

  const challengeSession = await request("/api/admin/auth", {
    headers: { cookie: challengeCookie },
  });
  if (challengeSession.status !== 401) {
    throw new Error(
      `MFA challenge cookie must not authenticate an admin session; got ${challengeSession.status}`,
    );
  }

  const protectedResource = await request("/api/admin/audit", {
    headers: { cookie: challengeCookie },
  });
  if (protectedResource.status !== 401) {
    throw new Error(`expected 401 before TOTP verification, got ${protectedResource.status}`);
  }

  if (loginBody.enrollmentRequired) {
    console.log("MFA gate: PASS; account enrollment is still required.");
  } else {
    console.log("MFA gate: PASS; password-only login produced a challenge, not a session.");
  }
  console.log("Unauthenticated admin API: 401 PASS");
  console.log("MFA challenge cookie cannot access admin APIs: 401 PASS");
  console.log("No admin session issued before TOTP: PASS");
  console.log(
    "Manual operational acceptance remains required for authenticator login, recovery code consumption and privileged step-up.",
  );
}

await main();
