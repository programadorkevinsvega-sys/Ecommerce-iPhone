const GITHUB_OIDC_ISSUER = "https://token.actions.githubusercontent.com";
const GITHUB_OIDC_JWKS_URL = `${GITHUB_OIDC_ISSUER}/.well-known/jwks`;
const MONITOR_AUDIENCE = "ecommerce-iphone-production-monitor";
const TRUSTED_REPOSITORY = "programadorkevinsvega-sys/Ecommerce-iPhone";
const TRUSTED_OWNER = "programadorkevinsvega-sys";
const TRUSTED_REF = "refs/heads/main";
const TRUSTED_WORKFLOW_REF =
  "programadorkevinsvega-sys/Ecommerce-iPhone/.github/workflows/production-verification.yml@refs/heads/main";
const WORKER_NAME = "ecommerce-iphone";

type GitHubActionsClaims = {
  iss: string;
  aud: string | string[];
  sub: string;
  exp: number;
  iat: number;
  nbf?: number;
  repository: string;
  repository_owner: string;
  ref: string;
  workflow_ref: string;
  event_name: string;
};

type GitHubJwk = JsonWebKey & { kid?: string; kty?: string };
type JwksResponse = { keys?: GitHubJwk[] };

let cachedJwks: { keys: GitHubJwk[]; expiresAt: number } | undefined;
const importedKeys = new Map<string, CryptoKey>();

function base64UrlDecode(value: string): Uint8Array<ArrayBuffer> {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function decodeJsonSegment(value: string): Record<string, unknown> | null {
  try {
    return JSON.parse(new TextDecoder().decode(base64UrlDecode(value))) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function audiencesContain(value: string | string[], expected: string): boolean {
  return Array.isArray(value) ? value.includes(expected) : value === expected;
}

export function isTrustedGitHubActionsClaims(
  value: unknown,
  nowMs = Date.now(),
): value is GitHubActionsClaims {
  if (!value || typeof value !== "object") return false;
  const claims = value as Partial<GitHubActionsClaims>;
  const now = Math.floor(nowMs / 1000);

  const refSubject = `repo:${TRUSTED_REPOSITORY}:ref:${TRUSTED_REF}`;
  const productionEnvironmentSubject = `repo:${TRUSTED_REPOSITORY}:environment:production`;
  const subjectMatches =
    claims.sub === refSubject ||
    (claims.event_name === "workflow_dispatch" && claims.sub === productionEnvironmentSubject);

  return (
    claims.iss === GITHUB_OIDC_ISSUER &&
    typeof claims.aud !== "undefined" &&
    audiencesContain(claims.aud, MONITOR_AUDIENCE) &&
    subjectMatches &&
    claims.repository === TRUSTED_REPOSITORY &&
    claims.repository_owner === TRUSTED_OWNER &&
    claims.ref === TRUSTED_REF &&
    claims.workflow_ref === TRUSTED_WORKFLOW_REF &&
    ["check_run", "schedule", "workflow_dispatch"].includes(claims.event_name ?? "") &&
    typeof claims.exp === "number" &&
    claims.exp > now &&
    typeof claims.iat === "number" &&
    claims.iat <= now + 60 &&
    claims.exp - claims.iat <= 900 &&
    (typeof claims.nbf !== "number" || claims.nbf <= now + 60)
  );
}

async function getGitHubJwks(): Promise<GitHubJwk[] | null> {
  if (cachedJwks && cachedJwks.expiresAt > Date.now()) return cachedJwks.keys;

  try {
    const response = await fetch(GITHUB_OIDC_JWKS_URL, {
      headers: { accept: "application/json" },
    });
    if (!response.ok) return null;

    const payload = (await response.json()) as JwksResponse;
    if (!Array.isArray(payload.keys) || payload.keys.length === 0) return null;

    cachedJwks = { keys: payload.keys, expiresAt: Date.now() + 5 * 60 * 1000 };
    return payload.keys;
  } catch {
    return null;
  }
}

async function getVerificationKey(jwk: GitHubJwk): Promise<CryptoKey | null> {
  const kid = typeof jwk.kid === "string" ? jwk.kid : "";
  if (!kid) return null;
  const cached = importedKeys.get(kid);
  if (cached) return cached;

  try {
    const key = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
    importedKeys.set(kid, key);
    return key;
  } catch {
    return null;
  }
}

export async function verifyGitHubActionsMonitorToken(
  authorizationHeader: string | null,
): Promise<GitHubActionsClaims | null> {
  if (!authorizationHeader?.startsWith("Bearer ")) return null;
  const token = authorizationHeader.slice("Bearer ".length).trim();
  if (!token || token.length > 8192) return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [encodedHeader, encodedClaims, encodedSignature] = parts;
  if (!encodedHeader || !encodedClaims || !encodedSignature) return null;

  const header = decodeJsonSegment(encodedHeader);
  const claims = decodeJsonSegment(encodedClaims);
  if (!header || !claims || header.alg !== "RS256" || typeof header.kid !== "string") return null;
  if (!isTrustedGitHubActionsClaims(claims)) return null;

  const jwks = await getGitHubJwks();
  const jwk = jwks?.find((candidate) => candidate.kid === header.kid && candidate.kty === "RSA");
  if (!jwk) return null;

  const key = await getVerificationKey(jwk);
  if (!key) return null;

  try {
    const valid = await crypto.subtle.verify(
      { name: "RSASSA-PKCS1-v1_5" },
      key,
      base64UrlDecode(encodedSignature),
      new TextEncoder().encode(`${encodedHeader}.${encodedClaims}`),
    );
    return valid ? (claims as GitHubActionsClaims) : null;
  } catch {
    return null;
  }
}

export function isWorkersDevHostname(hostname: string): boolean {
  return hostname.toLowerCase().endsWith(".workers.dev");
}

export function isProductionMonitorHostname(hostname: string): boolean {
  const labels = hostname.toLowerCase().split(".");
  return (
    labels.length === 4 &&
    labels[0] === WORKER_NAME &&
    (labels[1]?.length ?? 0) > 0 &&
    labels[2] === "workers" &&
    labels[3] === "dev"
  );
}

function isSafeSlug(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(value);
}

async function hasSmallJsonBody(
  request: Request,
  predicate: (body: Record<string, unknown>) => boolean,
) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) return false;

  try {
    const raw = await request.clone().text();
    if (!raw || new TextEncoder().encode(raw).byteLength > 8192) return false;
    const value = JSON.parse(raw);
    return Boolean(value && typeof value === "object" && !Array.isArray(value) && predicate(value));
  } catch {
    return false;
  }
}

export async function isAllowedProductionMonitorRequest(
  request: Request,
  claims: GitHubActionsClaims,
): Promise<boolean> {
  const url = new URL(request.url);
  if (!isProductionMonitorHostname(url.hostname)) return false;

  const { pathname, searchParams } = url;
  const method = request.method.toUpperCase();
  const manual = claims.event_name === "workflow_dispatch";

  if (method === "GET") {
    if (
      [
        "/",
        "/blog",
        "/faq",
        "/catalog",
        "/contacto",
        "/robots.txt",
        "/sitemap.xml",
        "/api/health/live",
        "/api/health/ready",
        "/api/admin/content",
        "/api/admin/campaigns",
        "/api/admin/coupons",
        "/api/admin/reviews",
        "/api/admin/reviews/reports",
        "/api/admin/audit",
        "/api/admin/auth",
        "/api/admin/notifications/dead-letter",
      ].includes(pathname)
    ) {
      if (pathname === "/catalog")
        return (
          searchParams.size === 0 ||
          (searchParams.size === 1 && (searchParams.get("q") ?? "").length <= 128)
        );
      return searchParams.size === 0;
    }

    if (pathname === "/api/checkout") {
      return searchParams.size === 1 && searchParams.get("foundation_probe") === "1";
    }

    if (pathname === "/api/content") {
      return (
        searchParams.size === 1 &&
        ["blog", "blog-categories", "faqs", "banners", "featured", "landing", "invalid"].includes(
          searchParams.get("kind") ?? "",
        )
      );
    }

    if (pathname.startsWith("/api/content/blog/")) {
      return isSafeSlug(pathname.slice("/api/content/blog/".length));
    }

    if (
      [
        "/api/notifications",
        "/api/notifications/unread-count",
        "/api/notifications/preferences",
        "/api/notifications/realtime",
      ].includes(pathname)
    ) {
      return searchParams.size === 1 && searchParams.get("scope") === "customer";
    }

    for (const prefix of ["/iphone/", "/blog/", "/landing/", "/content/"]) {
      if (pathname.startsWith(prefix)) return isSafeSlug(pathname.slice(prefix.length));
    }

    return false;
  }

  if (method === "POST" && pathname === "/api/admin/notifications/replay") {
    return await hasSmallJsonBody(request, (body) => body.id === "unauthenticated-probe");
  }

  if (manual && method === "POST" && pathname === "/api/admin/auth/login") {
    return await hasSmallJsonBody(
      request,
      (body) => typeof body.email === "string" && typeof body.password === "string",
    );
  }

  if (manual && method === "POST" && pathname === "/api/analytics/events") {
    return await hasSmallJsonBody(request, (body) => {
      const eventId = typeof body.eventId === "string" ? body.eventId : "";
      return (
        /^phase10-(2|3)-/.test(eventId) &&
        ["SessionStarted", "ProductViewed", "SearchPerformed"].includes(String(body.eventType))
      );
    });
  }

  return false;
}

export function resetGitHubMonitorJwksCacheForTests(): void {
  cachedJwks = undefined;
  importedKeys.clear();
}
