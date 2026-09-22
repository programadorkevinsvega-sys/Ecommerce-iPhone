const BASE_URL = process.env.PRODUCTION_URL ?? "https://iphone.jnmtortas.com";

async function request(path, init = {}) {
  const response = await fetch(new URL(path, BASE_URL), {
    redirect: "manual",
    ...init,
    headers: {
      accept: "application/json",
      ...(init.headers ?? {}),
    },
  });
  let body = "";
  try { body = await response.text(); } catch {}
  return { response, body };
}

const checks = [];

async function expectStatus(name, path, status, init) {
  const { response, body } = await request(path, init);
  const ok = response.status === status;
  checks.push({ name, expected: status, actual: response.status, ok, body: body.slice(0, 200) });
  if (!ok) throw new Error(`${name}: expected ${status}, got ${response.status}`);
}

await expectStatus("live health", "/api/health/live", 200);
await expectStatus("notification inbox auth", "/api/notifications?scope=customer", 401);
await expectStatus("notification unread auth", "/api/notifications/unread-count?scope=customer", 401);
await expectStatus("notification preferences auth", "/api/notifications/preferences?scope=customer", 401);
await expectStatus("notification websocket upgrade required", "/api/notifications/realtime?scope=customer", 426);
await expectStatus("notification dead letter auth", "/api/admin/notifications/dead-letter", 401);
await expectStatus("notification replay auth", "/api/admin/notifications/replay", 401, { method: "POST", body: JSON.stringify({ id: "unauthenticated-probe" }), headers: { "content-type": "application/json" } });

console.log(JSON.stringify({ ok: true, baseUrl: BASE_URL, checks }, null, 2));
