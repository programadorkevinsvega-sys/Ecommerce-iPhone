# Security foundation

## Application

- Security response headers are configured in `apps/web/next.config.ts`.
- API requests are restricted to the same request origin for browser state-changing calls.
- API preflight handling is explicit and rejects disallowed origins before the route executes.
- Every API response receives a validated or generated `X-Request-Id` for tracing.
- API responses are marked `no-store` to avoid accidental caching of customer/admin data.
- Errors should be translated at the presentation boundary; domain errors must not expose infrastructure details.
- Secrets are excluded from Git and documented through `.env.example` only by name.

## Authorization

Admin roles and a server-side authorization policy contract live in `modules/admin/application/Rbac.ts`.

## Abuse protection

The application layer exposes a `RateLimiter` port. Cloudflare WAF/rate-limiting rules remain an edge/platform control and should protect authentication, checkout, payment webhooks and other abuse-sensitive routes.

## Auditability

The application layer exposes an `AuditLogger` port for security-sensitive actions such as role changes, price changes, refunds and service operations.

## Sensitive device data

IMEI/serial information must be treated as private service data: never expose it in public URLs, catalog pages, logs or analytics events. Access should be authorized and auditable.
