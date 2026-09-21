# Security foundation

## Browser hardening

Security response headers are configured in `apps/web/next.config.ts`.

Implemented:

- Content-Security-Policy.
- HSTS.
- X-Content-Type-Options.
- X-Frame-Options.
- Referrer-Policy.
- Permissions-Policy.
- Cross-Origin-Opener-Policy.
- Cross-Origin-Resource-Policy.
- X-DNS-Prefetch-Control.
- `poweredByHeader: false`.
- Next image `remotePatterns: []`.

Product images are restricted to same-origin media paths; arbitrary remote image hosts are not enabled.

## Authentication and authorization

### Admin

Admin RBAC is server-side in `modules/admin/application/Rbac.ts`.

Admin sessions are HttpOnly, Secure and SameSite=Strict, with persisted token hashes, expiration, revocation, lockout and audit.

### Technician

Technicians are separate operational identities:

- `technician_users`
- `technician_sessions`
- `technician_audit_events`
- cookie `technician_session`
- 12-hour session lifetime
- previous sessions revoked after successful login
- five failed attempts -> 15-minute lockout
- inactive accounts rejected
- no public self-registration

Technician APIs enforce authenticated assignment ownership. A technician cannot use the technical session to become an admin or access `/admin` authorization.

## Input hardening

Shared normalization/validation lives in `apps/web/lib/inputValidation.ts`.

```text
input
  ↓
normalización
  ↓
validación
  ↓
application/API
  ↓
safe error presentation
```

Client HTML constraints are only UX/accessibility. Sensitive APIs validate again server-side.

## Ownership / IDOR

Customer order lookup is bounded by the authenticated customer.

Technician order lookup/mutation is bounded by the assigned technician.

Administrative mutations are bounded by effective RBAC permissions.

Remaining work is regression/certification evidence for malformed identifiers, privilege escalation, BOLA/IDOR and concurrency cases.

## Device privacy

IMEI and serial values are private service data.

- Never expose complete values publicly.
- Never place complete values in URLs.
- Avoid complete values in logs/analytics.
- Show only masked suffixes where sufficient.
- Audit protected access.

## Payments

Payment state is never trusted from browser redirects.

Provider webhooks are cryptographically verified and provider resources are reconciled server-side before financial state transitions.

## Abuse protection

Cloudflare:

- API rate limiter: 120 requests / 60s.
- Sensitive rate limiter: 20 requests / 60s.

Application protections additionally cover admin and technician authentication.

## Certification state

Security implementation is advanced, but **global certification remains pending**.

Required final regression matrix:

- [ ] architecture boundaries
- [ ] input validation
- [ ] admin auth/session/lockout
- [ ] technician auth/session/lockout
- [ ] RBAC privilege escalation
- [ ] customer IDOR/BOLA
- [ ] technician assignment isolation
- [ ] CSRF/Origin
- [ ] rate limiting
- [ ] webhook verification
- [ ] secrets/dependencies
- [ ] production smoke/security verification
