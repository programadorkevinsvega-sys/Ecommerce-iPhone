# Production monitoring through a restricted Workers host

**Status:** implemented in code; production acceptance remains pending the first successful production run.

## Why this exists

The GitHub Actions production monitor received a Cloudflare-generated \`403\` challenge at
\`https://iphone.jnmtortas.com/api/health/live\`. The response contained
\`cf-mitigated: challenge\` and a Cloudflare Ray ID. This is evidence that the public
edge challenged the automation; it is not evidence that the Worker runtime failed.

Do not disable WAF, Bot Fight Mode, Super Bot Fight Mode, Managed Rules, or rate limiting
globally to make a CI probe pass.

## Monitoring path

The production Worker keeps its custom domain and additionally enables its account
\`workers.dev\` hostname. This second hostname is not an unrestricted copy of the storefront:

- Every request arriving on any \`*.workers.dev\` hostname is intercepted by the Worker.
- Only the canonical \`ecommerce-iphone.<account-subdomain>.workers.dev\` hostname can pass the monitor allowlist.
- All allowed requests require a short-lived GitHub Actions OIDC JWT.
- The JWT signature is verified with GitHub's published OIDC JWKS.
- Claims are bound to repository \`programadorkevinsvega-sys/Ecommerce-iPhone\`, owner, \`refs/heads/main\`, the exact \`production-verification.yml\` workflow, the monitor audience, and an allowed workflow event.
- The Worker strips the OIDC bearer token before forwarding the request to Next.js.
- Every other path, method, hostname, missing token, invalid token, or disallowed event receives \`404\`.

Preview-style \`workers.dev\` hostnames are restricted too; enabling the monitor host must not accidentally publish a preview as an unrestricted application endpoint.

## Allowed operations

For Cloudflare production-build events and the scheduled smoke:

- liveness and readiness;
- the read-only rate-limit probe on \`GET /api/checkout?foundation_probe=1\`;
- the existing Phase 08 public-content/admin-unauthorized checks;
- SEO reads for robots, sitemap, product/blog pages and FAQ;
- notification authorization-boundary checks, including the fixed unauthenticated replay probe.

For an explicitly dispatched workflow from \`main\`:

- the isolated Phase 10.2/10.3 analytics ingestion probes using only \`phase10-2-_\` / \`phase10-3-_\` event IDs and the existing D1 cleanup path;
- the admin password-to-MFA-challenge check. It does not generate a session and does not automate TOTP enrollment, recovery-code use or privileged step-up.

The OIDC token is short-lived and audience-specific. The monitor workflow is the only permitted workflow identity. The API allowlist is intentionally narrower than the application's route surface.

## Public-edge check remains separate

The workflow still requests \`https://iphone.jnmtortas.com/api/health/live\` without an exception or bypass.

- HTTP 200 with the Worker request ID records public-edge success.
- A verified Cloudflare challenge records \`public_edge_verified=false\` and an inconclusive warning, but does not suppress the authenticated Worker runtime checks.
- A non-Cloudflare application/network failure remains a real failure.

This separation means a green authenticated Worker monitor does not certify that every public visitor can pass Cloudflare's edge challenge. The WAF/Bot policy remains active and requires separate review if it challenges legitimate visitors.

## Configuration required

The production workflow first checks the repository Actions variable
`CLOUDFLARE_WORKERS_DEV_SUBDOMAIN`. Set it to the account subdomain only
(for example, `account-name`, without protocol or hostname) to construct
`https://ecommerce-iphone.<subdomain>.workers.dev` without an API lookup.

The workflow reads `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` from
GitHub Actions secrets. Keep them in repository or organization secrets because
the recurring `smoke` job does not use the `production` Environment. The account
ID is not intrinsically secret, but this workflow currently reads it from the
secret namespace.

If the subdomain variable is absent, the resolver calls
`GET /accounts/{account_id}/workers/subdomain`. This fallback requires
**Workers Scripts Read** on `CLOUDFLARE_API_TOKEN`; do not grant Workers Scripts
Write. Wrangler D1 verification also requires **D1 Read**.

The Wrangler production config sets `workers_dev: true`. Cloudflare must have an
account `workers.dev` subdomain configured. The resolver validates the configured
subdomain and fails closed if it is missing or invalid.

No static monitor secret is added to Cloudflare or GitHub. GitHub Actions requests
a short-lived OIDC token at runtime with `id-token: write`; the Worker validates
it against GitHub's published public keys.

## Operational boundaries

- This monitor does not change Cloudflare zone WAF/Bot settings or allowlist GitHub-hosted runner IPs.
- It does not apply D1 migrations. Cloudflare Workers Builds retains deploy/migration responsibility.
- It does not create payment or refund transactions.
- Analytics 10.4/10.5 use read-only D1 `SELECT` queries. Missing real event classes or a missing provider-confirmed refund produce `INCONCLUSIVE`, never synthetic data.
- Both analytics phases remain `PENDING_MANUAL_REVIEW` until their protected manual workflows pass and QA records final acceptance.
- Real MFA, manual accessibility, real-traffic RUM, queue depth/lag, provider health and rollback/recovery exercises remain separate acceptance activities.
