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
    const routes = ["/", "/cart", "/checkout", "/admin/login"];

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
      expect(axeViolations, `WCAG A/AA violations on ${route}`).toEqual([]);
    }
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
});
