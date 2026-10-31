import { expect, test } from "@playwright/test";

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
    expect(headers["content-security-policy"]).not.toContain("unsafe-eval");
  });

  test("API handlers return the same valid request ID used by middleware", async ({ request }) => {
    const requestId = "pr26_api_trace_0001";
    const response = await request.get("/api/cart", {
      headers: { "x-request-id": requestId },
    });

    expect(response.headers()["x-request-id"]).toBe(requestId);
  });

  test("storefront exposes a named document, main landmark and accessible controls", async ({
    page,
  }) => {
    const response = await page.goto("/");
    expect(response?.ok()).toBe(true);
    await expect(page.locator("html")).toHaveAttribute("lang", "es");
    await expect(page.locator("main")).toHaveCount(1);

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

    expect(unnamedControls).toEqual([]);
    await expect(page.locator("img:not([alt])")).toHaveCount(0);
  });
});
