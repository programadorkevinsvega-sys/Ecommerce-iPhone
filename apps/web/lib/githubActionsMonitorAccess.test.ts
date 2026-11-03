import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isAllowedProductionMonitorRequest,
  isProductionMonitorHostname,
  isWorkersDevHostname,
  isTrustedGitHubActionsClaims,
  resetGitHubMonitorJwksCacheForTests,
  verifyGitHubActionsMonitorToken,
} from "./githubActionsMonitorAccess";

const audience = "ecommerce-iphone-production-monitor";
const repository = "programadorkevinsvega-sys/Ecommerce-iPhone";
const workflowRef =
  "programadorkevinsvega-sys/Ecommerce-iPhone/.github/workflows/production-verification.yml@refs/heads/main";

function base64Url(value: string | Uint8Array): string {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function claims(overrides: Record<string, unknown> = {}) {
  const now = Math.floor(Date.now() / 1000);
  return {
    iss: "https://token.actions.githubusercontent.com",
    aud: audience,
    sub: `repo:${repository}:ref:refs/heads/main`,
    exp: now + 300,
    iat: now,
    repository,
    repository_owner: "programadorkevinsvega-sys",
    ref: "refs/heads/main",
    workflow_ref: workflowRef,
    event_name: "check_run",
    ...overrides,
  };
}

describe("GitHub Actions production monitor access", () => {
  let privateKey: CryptoKey;
  let publicJwk: JsonWebKey & { kid?: string; kty?: string };

  beforeAll(async () => {
    const pair = await crypto.subtle.generateKey(
      {
        name: "RSASSA-PKCS1-v1_5",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      true,
      ["sign", "verify"],
    );
    privateKey = pair.privateKey;
    publicJwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
    publicJwk.kid = "monitor-test-key";
    publicJwk.kty = "RSA";
  });

  beforeEach(() => {
    resetGitHubMonitorJwksCacheForTests();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ keys: [publicJwk] }), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
      ),
    );
  });

  async function signedToken(tokenClaims: Record<string, unknown>) {
    const header = base64Url(JSON.stringify({ alg: "RS256", kid: "monitor-test-key", typ: "JWT" }));
    const payload = base64Url(JSON.stringify(tokenClaims));
    const signingInput = `${header}.${payload}`;
    const signature = await crypto.subtle.sign(
      { name: "RSASSA-PKCS1-v1_5" },
      privateKey,
      new TextEncoder().encode(signingInput),
    );
    return `${signingInput}.${base64Url(new Uint8Array(signature))}`;
  }

  it("accepts only the repository production verification workflow on main", () => {
    expect(isTrustedGitHubActionsClaims(claims())).toBe(true);
    expect(isTrustedGitHubActionsClaims(claims({ ref: "refs/heads/feature" }))).toBe(false);
    expect(isTrustedGitHubActionsClaims(claims({ repository: "attacker/repository" }))).toBe(false);
    expect(
      isTrustedGitHubActionsClaims(claims({ workflow_ref: "attacker.yml@refs/heads/main" })),
    ).toBe(false);
    expect(isTrustedGitHubActionsClaims(claims({ event_name: "pull_request" }))).toBe(false);
    expect(
      isTrustedGitHubActionsClaims(
        claims({
          event_name: "workflow_dispatch",
          sub: `repo:${repository}:environment:production`,
        }),
      ),
    ).toBe(true);
    expect(
      isTrustedGitHubActionsClaims(
        claims({ event_name: "check_run", sub: `repo:${repository}:environment:production` }),
      ),
    ).toBe(false);
    expect(isTrustedGitHubActionsClaims(claims({ aud: "wrong-audience" }))).toBe(false);
  });

  it("accepts the exact workers.dev host shape only", () => {
    expect(isProductionMonitorHostname("ecommerce-iphone.account.workers.dev")).toBe(true);
    expect(isProductionMonitorHostname("other-worker.account.workers.dev")).toBe(false);
    expect(isProductionMonitorHostname("ecommerce-iphone.workers.dev")).toBe(false);
    expect(isProductionMonitorHostname("ecommerce-iphone.account.example.com")).toBe(false);
  });

  it("verifies the GitHub-signed OIDC token", async () => {
    const token = await signedToken(claims());
    const verified = await verifyGitHubActionsMonitorToken(`Bearer ${token}`);
    expect(verified?.repository).toBe(repository);
    expect(verified?.workflow_ref).toBe(workflowRef);
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  });

  it("rejects a token with an invalid signature or an untrusted claim", async () => {
    const token = await signedToken(claims());
    const [encodedHeader, encodedClaims, encodedSignature] = token.split(".");
    if (!encodedHeader || !encodedClaims || !encodedSignature) {
      throw new Error("Signed monitor token must contain three JWT segments.");
    }
    // Change a significant signature bit. Mutating the final Base64URL character can
    // alter only unused padding bits and leave the decoded RSA signature unchanged.
    const tamperedSignature = (encodedSignature[0] === "A" ? "B" : "A") + encodedSignature.slice(1);
    const tampered = `${encodedHeader}.${encodedClaims}.${tamperedSignature}`;
    expect(await verifyGitHubActionsMonitorToken(`Bearer ${tampered}`)).toBeNull();

    const wrongRepository = await signedToken(claims({ repository: "attacker/repository" }));
    expect(await verifyGitHubActionsMonitorToken(`Bearer ${wrongRepository}`)).toBeNull();
  });

  it("permits only low-impact smoke paths for check_run events", async () => {
    const trusted = claims() as ReturnType<typeof claims> & {
      iss: string;
      aud: string;
      sub: string;
      exp: number;
      iat: number;
      repository: string;
      repository_owner: string;
      ref: string;
      workflow_ref: string;
      event_name: string;
    };
    expect(
      await isAllowedProductionMonitorRequest(
        new Request("https://ecommerce-iphone.account.workers.dev/api/health/ready"),
        trusted,
      ),
    ).toBe(true);
    expect(
      await isAllowedProductionMonitorRequest(
        new Request("https://ecommerce-iphone.account.workers.dev/api/admin/auth/login", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email: "admin@example.test", password: "example" }),
        }),
        trusted,
      ),
    ).toBe(false);
    expect(
      await isAllowedProductionMonitorRequest(
        new Request("https://ecommerce-iphone.account.workers.dev/api/analytics/events", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ eventId: "arbitrary", eventType: "Purchase" }),
        }),
        trusted,
      ),
    ).toBe(false);
  });

  it("allows the read-only revenue authorization probe only for manual production runs", async () => {
    const automated = claims() as ReturnType<typeof claims> & {
      iss: string;
      aud: string;
      sub: string;
      exp: number;
      iat: number;
      repository: string;
      repository_owner: string;
      ref: string;
      workflow_ref: string;
      event_name: string;
    };
    const manual = claims({ event_name: "workflow_dispatch" }) as typeof automated;
    const url = "https://ecommerce-iphone.account.workers.dev/api/admin/analytics/revenue";

    expect(await isAllowedProductionMonitorRequest(new Request(url), automated)).toBe(false);
    expect(await isAllowedProductionMonitorRequest(new Request(url), manual)).toBe(true);
    expect(await isAllowedProductionMonitorRequest(new Request(`${url}?period=30`), manual)).toBe(
      false,
    );
    expect(
      await isAllowedProductionMonitorRequest(new Request(url, { method: "POST" }), manual),
    ).toBe(false);
  });

  it("allows explicit deep-production and MFA probes only from workflow_dispatch", async () => {
    const manual = claims({ event_name: "workflow_dispatch" }) as ReturnType<typeof claims> & {
      iss: string;
      aud: string;
      sub: string;
      exp: number;
      iat: number;
      repository: string;
      repository_owner: string;
      ref: string;
      workflow_ref: string;
      event_name: string;
    };
    expect(
      await isAllowedProductionMonitorRequest(
        new Request("https://ecommerce-iphone.account.workers.dev/api/admin/auth/login", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email: "admin@example.test", password: "example" }),
        }),
        manual,
      ),
    ).toBe(true);
    expect(
      await isAllowedProductionMonitorRequest(
        new Request("https://ecommerce-iphone.account.workers.dev/api/analytics/events", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ eventId: "phase10-3-probe-1", eventType: "ProductViewed" }),
        }),
        manual,
      ),
    ).toBe(true);
    expect(
      await isAllowedProductionMonitorRequest(
        new Request("https://ecommerce-iphone.account.workers.dev/api/analytics/events", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ eventId: "customer-event-1", eventType: "Purchase" }),
        }),
        manual,
      ),
    ).toBe(false);
  });
});
