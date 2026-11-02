import { expect, test } from "@playwright/test";

declare const require: (id: string) => { source: string };
const axe = require("axe-core");

test.describe("platform hardening", () => {
  test("Worker-owned response includes security headers and a stable request ID", async ({
    request,
  }) => {
    const requestId = "pr26_worker_health_0001";
    const response = await request.get("/api/health/live", {
      headers: { "x-request-id": requestId },
    });
    const headers = response.headers();

    expect(response.status()).toBe(200);
    expect(headers["x-request-id"]).toBe(requestId);
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["strict-transport-security"]).toContain("max-age=31536000");
    expect(headers["permissions-policy"]).toContain("camera=()");
    expect(headers["content-security-policy"]).toContain("default-src 'self'");
    expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    const scriptSrc = headers["content-security-policy"]
      .split(";")
      .find((directive) => directive.trim().startsWith("script-src "));
    expect(scriptSrc).not.toContain("unsafe-inline");
    expect(scriptSrc).not.toContain("unsafe-eval");
  });

  test("API handlers return the same valid request ID used by middleware", async ({ request }) => {
    const requestId = "pr26_api_trace_0001";
    const response = await request.get("/api/cart", {
      headers: { "x-request-id": requestId },
    });

    expect(response.headers()["x-request-id"]).toBe(requestId);
  });

  test("HTML responses use nonces without CSP violations", async ({ page }) => {
    const cspViolations: string[] = [];
    page.on("console", (message) => {
      if (
        message.type() === "error" &&
        message.text().includes("violates the following Content Security Policy directive")
      ) {
        cspViolations.push(message.text());
      }
    });
    const response = await page.goto("/");
    expect(response?.ok()).toBe(true);
    const policy = response?.headers()["content-security-policy"] ?? "";
    const nonce = policy.match(/'nonce-([^']+)'/)?.[1];
    expect(nonce).toBeTruthy();

    const result = await page.locator("script:not([src])").evaluateAll((scripts) => {
      const executableScripts = scripts.filter((script) => {
        const type = (script.getAttribute("type") ?? "").trim().toLowerCase();
        return (
          type === "" ||
          type === "module" ||
          type === "text/javascript" ||
          type === "application/javascript"
        );
      });
      return {
        count: executableScripts.length,
        nonces: executableScripts.map((script) => (script as HTMLScriptElement).nonce),
      };
    });
    expect(result.count).toBeGreaterThan(0);
    expect(result.nonces.every((value) => value === nonce)).toBe(true);
    const scriptSrc = policy
      .split(";")
      .find((directive) => directive.trim().startsWith("script-src "));
    expect(scriptSrc).toContain(`'nonce-${nonce}'`);
    expect(scriptSrc).not.toContain("unsafe-inline");
    expect(scriptSrc).not.toContain("unsafe-eval");
    const styleSrc = policy
      .split(";")
      .find((directive) => directive.trim().startsWith("style-src "));
    expect(styleSrc).toContain(`'nonce-${nonce}'`);
    expect(styleSrc).not.toContain("unsafe-inline");
    expect(styleSrc).not.toContain("unsafe-eval");
    const styleNonces = await page
      .locator("style")
      .evaluateAll((styles) => styles.map((style) => (style as HTMLStyleElement).nonce));
    expect(styleNonces.every((value) => value === nonce)).toBe(true);

    const styleAttr = policy
      .split(";")
      .find((directive) => directive.trim().startsWith("style-src-attr "));
    expect(styleAttr).toContain("'unsafe-hashes'");
    expect(styleAttr).toContain("'sha256-zlqnbDt84zf1iSefLU/ImC54isoprH/MRiVZGskwexk='");
    expect(styleAttr).not.toContain("unsafe-inline");
    expect(cspViolations).toEqual([]);
  });

  test("critical pages expose accessible names and image alternatives", async ({ page }) => {
    const routes = [
      "/",
      "/catalog",
      "/iphone/iphone-17-pro-max",
      "/cart",
      "/checkout",
      "/admin/login",
    ];
    const axeViolationsByRoute: Array<{
      route: string;
      violations: Array<{
        id: string;
        impact: string | null;
        help: string;
        targets: string[];
      }>;
    }> = [];

    for (const route of routes) {
      const response = await page.goto(route);
      expect(response?.status() ?? 0, route).toBeLessThan(500);
      await expect(page.locator("html"), route).toHaveAttribute("lang", "es");
      await expect(page.locator("main"), route).toHaveCount(1);

      const unnamedControls = await page
        .locator('a, button, input:not([type="hidden"]), select, textarea')
        .evaluateAll((elements) =>
          elements.flatMap((element) => {
            const labelledBy = element.getAttribute("aria-labelledby");
            const referencedName = labelledBy
              ? labelledBy
                  .split(/\s+/)
                  .map((id) => document.getElementById(id)?.textContent?.trim() ?? "")
                  .filter(Boolean)
                  .join(" ")
              : "";
            const associatedLabel =
              element.closest("label")?.textContent?.trim() ??
              ("labels" in element
                ? Array.from((element as HTMLInputElement).labels ?? [])
                    .map((label) => label.textContent?.trim() ?? "")
                    .filter(Boolean)
                    .join(" ")
                : "");
            const name =
              element.getAttribute("aria-label")?.trim() ||
              referencedName ||
              associatedLabel ||
              element.textContent?.trim() ||
              element.getAttribute("title")?.trim() ||
              (element instanceof HTMLInputElement ? element.value.trim() : "");
            return name ? [] : [element.tagName.toLowerCase()];
          }),
        );

      expect(unnamedControls, route).toEqual([]);
      await expect(page.locator("img:not([alt])"), route).toHaveCount(0);
      const unapprovedInlineStyles = await page.locator("[style]").evaluateAll((elements) =>
        elements
          .filter((element) => {
            const inlineStyle = element.getAttribute("style")?.trim() ?? "";
            if (!inlineStyle) return false;

            // Next.js emits this presentation hint on optimized images; it is not an app style.
            if (
              element instanceof HTMLImageElement &&
              inlineStyle.replace(/\s/g, "") === "color:transparent" &&
              element.hasAttribute("alt")
            ) {
              return false;
            }

            // Next.js versions render the route announcer as either a custom element
            // or a visually-hidden div with this stable framework-owned ID.
            if (
              element.id === "__next-route-announcer__" ||
              element.closest("#__next-route-announcer__") ||
              element.closest("next-route-announcer")
            ) {
              return false;
            }
            return true;
          })
          .map((element) => ({
            tag: element.tagName.toLowerCase(),
            id: element.id,
            style: element.getAttribute("style"),
          })),
      );
      expect(unapprovedInlineStyles, route).toEqual([]);

      const policy = response?.headers()["content-security-policy"] ?? "";
      expect(policy.split(",").filter(Boolean), route).toHaveLength(1);
      const nonce = policy.match(/'nonce-([^']+)'/)?.[1];
      expect(nonce, route).toBeTruthy();
      if (!nonce) throw new Error(`Missing CSP nonce on ${route}`);
      await page.evaluate(
        ({ source, nonceValue }) => {
          const script = document.createElement("script");
          script.nonce = nonceValue;
          script.textContent = source;
          document.head.appendChild(script);
        },
        { source: axe.source, nonceValue: nonce },
      );
      const axeViolations = await page.evaluate(async () => {
        const api = (
          window as unknown as {
            axe: {
              run: (
                root: Document,
                options: unknown,
              ) => Promise<{
                violations: Array<{
                  id: string;
                  impact: string | null;
                  help: string;
                  nodes: Array<{ target: string[] }>;
                }>;
              }>;
            };
          }
        ).axe;
        const report = await api.run(document, {
          runOnly: {
            type: "tag",
            values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"],
          },
        });
        return report.violations.map((violation) => ({
          id: violation.id,
          impact: violation.impact,
          help: violation.help,
          targets: violation.nodes.flatMap((node) => node.target),
        }));
      });
      if (axeViolations.length > 0) {
        axeViolationsByRoute.push({ route, violations: axeViolations });
      }
    }

    expect(axeViolationsByRoute, "WCAG A/AA violations across critical routes").toEqual([]);
  });

  test("the first keyboard focus target has an accessible name", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    const accessibleName = await page.evaluate(() => {
      const element = document.activeElement;
      if (!(element instanceof HTMLElement)) return "";
      const labelledBy = element.getAttribute("aria-labelledby");
      const referenced = labelledBy
        ? labelledBy
            .split(/\s+/)
            .map((id) => document.getElementById(id)?.textContent?.trim() ?? "")
            .filter(Boolean)
            .join(" ")
        : "";
      return (
        element.getAttribute("aria-label")?.trim() ||
        referenced ||
        element.closest("label")?.textContent?.trim() ||
        element.textContent?.trim() ||
        element.getAttribute("title")?.trim() ||
        ""
      );
    });
    expect(accessibleName).not.toBe("");
  });
  test("keyboard traversal preserves visible focus and supports reverse navigation", async ({
    page,
  }) => {
    const routes = [
      "/",
      "/catalog",
      "/iphone/iphone-17-pro-max",
      "/cart",
      "/checkout",
      "/admin/login",
    ];
    for (const route of routes) {
      await page.goto(route);
      await page.keyboard.press("Tab");
      const first = await page.evaluate(() => {
        const element = document.activeElement;
        if (!(element instanceof HTMLElement)) return null;
        const style = getComputedStyle(element);
        return {
          signature: [
            element.tagName,
            element.id,
            element.getAttribute("href"),
            element.getAttribute("name"),
            element.textContent?.trim().slice(0, 32),
          ].join("|"),
          visible:
            element.getClientRects().length > 0 &&
            (element.matches(":focus-visible") ||
              (style.outlineStyle !== "none" && Number.parseFloat(style.outlineWidth) > 0)),
        };
      });
      expect(first, route).not.toBeNull();
      expect(first?.visible, `focus indicator on ${route}`).toBe(true);
      await page.keyboard.press("Tab");
      expect(await page.evaluate(() => document.activeElement instanceof HTMLElement), route).toBe(
        true,
      );
      await page.keyboard.press("Shift+Tab");
      const returned = await page.evaluate(() => {
        const element = document.activeElement;
        if (!(element instanceof HTMLElement)) return "";
        return [
          element.tagName,
          element.id,
          element.getAttribute("href"),
          element.getAttribute("name"),
          element.textContent?.trim().slice(0, 32),
        ].join("|");
      });
      expect(returned, route).toBe(first?.signature);
      await page.keyboard.press("Escape");
      expect(await page.evaluate(() => document.activeElement instanceof HTMLElement), route).toBe(
        true,
      );
    }
  });

  test("admin login form can be operated without a pointer", async ({ page }) => {
    await page.goto("/admin/login");
    await page.keyboard.press("Tab");
    await expect(page.locator("#admin-login-email")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.locator("#admin-login-password")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Iniciar sesión" })).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(page.locator("#admin-login-password")).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(page.locator("#admin-login-email")).toBeFocused();
    expect(await page.locator("#admin-login-email").getAttribute("required")).not.toBeNull();
  });

  test("critical storefront pages reflow without horizontal document overflow", async ({
    page,
  }) => {
    for (const route of ["/", "/catalog", "/iphone/iphone-17-pro-max", "/cart", "/checkout"]) {
      await page.goto(route);
      for (const width of [640, 320]) {
        await page.setViewportSize({ width, height: 900 });
        const dimensions = await page.evaluate(() => ({
          document: document.documentElement.scrollWidth,
          body: document.body.scrollWidth,
        }));
        expect(dimensions.document, `${route} document at ${width}px`).toBeLessThanOrEqual(
          width + 1,
        );
        expect(dimensions.body, `${route} body at ${width}px`).toBeLessThanOrEqual(width + 1);
      }
    }
  });

  test("Web Vitals ingestion validates an allowlisted field metric", async ({ request }) => {
    const invalid = await request.post("/api/analytics/web-vitals", {
      data: {
        metric: "FID",
        metricId: "pr26-vitals-invalid",
        value: 12,
        route: "/",
        deviceType: "desktop",
      },
    });
    expect(invalid.status()).toBe(400);
    const accepted = await request.post("/api/analytics/web-vitals", {
      data: {
        metric: "LCP",
        metricId: "pr26-vitals-field-01",
        value: 2300,
        route: "/",
        deviceType: "desktop",
      },
    });
    expect(accepted.status()).toBe(202);
    expect(await accepted.json()).toMatchObject({ accepted: true });
  });

  test("Web Vitals aggregate report is not public", async ({ request }) => {
    const response = await request.get("/api/admin/analytics/web-vitals?days=28");
    expect(response.status()).toBe(401);
  });

  test("step-up endpoint rejects missing admin sessions before evaluating credentials", async ({
    request,
  }) => {
    const response = await request.post("/api/admin/auth/step-up", {
      data: { password: "not-a-real-password", scope: "payments:refund" },
    });
    expect(response.status()).toBe(401);
    expect(await response.json()).toMatchObject({
      error: "Tu sesión ya no es válida. Inicia sesión nuevamente.",
    });
  });

  test("MFA challenge and recovery endpoints fail closed without an authenticated challenge", async ({
    request,
  }) => {
    const challenge = await request.get("/api/admin/auth/mfa/challenge");
    expect(challenge.status()).toBe(401);

    const verify = await request.post("/api/admin/auth/mfa/verify", { data: { code: "123456" } });
    expect(verify.status()).toBe(401);

    const status = await request.get("/api/admin/auth/mfa/status");
    expect(status.status()).toBe(401);

    const recovery = await request.post("/api/admin/auth/mfa/recovery", {
      data: { password: "not-a-real-password", code: "123456" },
    });
    expect(recovery.status()).toBe(401);

    const disable = await request.post("/api/admin/auth/mfa/disable", {
      data: { password: "not-a-real-password", code: "123456" },
    });
    expect(disable.status()).toBe(401);
  });

  test("readiness probes D1, R2 and Notification Hub and distinguishes configured Queues", async ({
    request,
  }) => {
    const response = await request.get("/api/health/ready");
    const payload = (await response.json()) as {
      status: string;
      ready: boolean;
      dependencies: Record<string, string>;
    };

    expect(response.status()).toBe(200);
    expect(payload.status).toBe("ready");
    expect(payload.ready).toBe(true);
    expect(payload.dependencies).toMatchObject({
      d1: "ok",
      r2: "ok",
      eventsQueue: "configured",
      notificationsQueue: "configured",
      notificationsDlqQueue: "configured",
      notificationHub: "ok",
    });
  });

  test("CORS rejects untrusted preflight and mutating origins", async ({ request }) => {
    const live = await request.get("/api/health/live");
    const allowedOrigin = new URL(live.url()).origin;

    const sameOriginPreflight = await request.fetch("/api/checkout", {
      method: "OPTIONS",
      headers: {
        origin: allowedOrigin,
        "access-control-request-method": "POST",
      },
    });
    expect(sameOriginPreflight.status()).toBe(204);
    expect(sameOriginPreflight.headers()["access-control-allow-origin"]).toBe(allowedOrigin);
    expect(sameOriginPreflight.headers()["access-control-allow-credentials"]).toBe("true");

    const deniedPreflight = await request.fetch("/api/checkout", {
      method: "OPTIONS",
      headers: {
        origin: "https://attacker.example",
        "access-control-request-method": "POST",
      },
    });
    expect(deniedPreflight.status()).toBe(403);
    expect(deniedPreflight.headers()["access-control-allow-origin"]).toBeUndefined();
    await expect(deniedPreflight.json()).resolves.toMatchObject({
      error: { code: "ORIGIN_NOT_ALLOWED" },
    });

    const deniedMutation = await request.post("/api/checkout", {
      headers: { origin: "https://attacker.example" },
      data: {},
    });
    expect(deniedMutation.status()).toBe(403);
    await expect(deniedMutation.json()).resolves.toMatchObject({
      error: { code: "ORIGIN_NOT_ALLOWED" },
    });
  });

  test("client runtime error reports accept only bounded metadata", async ({ request }) => {
    const accepted = await request.post("/api/observability/client-error", {
      data: {
        digest: "NEXT_RENDER_FAILURE_01",
        routeGroup: "/iphone/iphone-18-pro-max",
      },
    });
    expect(accepted.status()).toBe(202);
    await expect(accepted.json()).resolves.toMatchObject({ accepted: true });
    expect(accepted.headers()["cache-control"]).toBe("no-store");

    const malformed = await request.post("/api/observability/client-error", {
      headers: { "content-type": "application/json" },
      data: Buffer.from("{", "utf8"),
    });
    expect(malformed.status()).toBe(400);

    const wrongContentType = await request.post("/api/observability/client-error", {
      headers: { "content-type": "text/plain" },
      data: "error",
    });
    expect(wrongContentType.status()).toBe(415);
  });

});
