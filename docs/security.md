# Security foundation

## Actualización de hardening — 2026-09-21

La superficie de técnicos conserva sesión independiente, token hash, lockout, auditoría y ownership server-side. Se eliminó el acceso directo de las rutas técnicas a repositorios, R2 y runtime adapters; las operaciones pasan por Application y el composition root.

Se añadieron regresiones de lockout activo, ownership de órdenes y limpieza del teléfono opcional del perfil. La certificación global de seguridad continúa pendiente de la matriz completa de RBAC privilege escalation, IDOR/BOLA, concurrencia, rate limiting, regresiones y evidencia productiva.

## Browser hardening

Baseline response headers are centralized in `apps/web/lib/securityHeaders.ts` and configured through `apps/web/next.config.ts`. Document requests receive a per-request CSP nonce from middleware; the Cloudflare Worker preserves the middleware policy and nonce.

Implemented:

- Content-Security-Policy with per-request script/style nonces; no `unsafe-inline` or `unsafe-eval` is enabled.
- `style-src-attr` allows only the exact SHA-256 hash for Next.js Image's non-executable `color:transparent` presentation hint using `unsafe-hashes`; arbitrary inline style attributes remain blocked.
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

## Technician security surface — current state

The technician identity remains isolated from Admin/RBAC. Technician APIs enforce technician session authentication and assignment ownership for technician order operations. Remaining work is regression evidence, production certification and visual hardening around the existing security model; no second authorization model should be introduced in the UI.

## Dependency vulnerability policy

Every dependency in the workspace must be included in the security audit: production, development, and optional dependencies. The release gate runs `pnpm audit` at pnpm's default severity threshold (low), so any known advisory fails the build.

- Do not use `pnpm audit --prod` as the only security check.
- Do not suppress advisories with `audit.ignore`, `auditConfig.ignoreGhsas`, or equivalent exceptions to make CI green.
- Keep `pnpm-lock.yaml` committed and install with `--frozen-lockfile`.
- Upgrade affected direct dependencies to a patched release, then audit the complete resolved dependency graph again.
- A green audit means no advisories were returned by the configured npm registry at that time; it does not prove the absence of undisclosed or future vulnerabilities. Re-run it continuously and after security advisories are published.

## Remediación de Next.js — 2026-10-30

El audit inicial de Cloudflare encontró `next@15.5.25` en el lockfile y cuatro avisos:

- `GHSA-2464-fhr4-w9xw` — crítico, ejecución remota de código en Image Optimization.
- `GHSA-p3m5-59mp-jv5r` — alto, denegación de servicio en App Router / Server Actions.
- `GHSA-4jqv-mc3x-m676` — moderado, cache poisoning de SSG/ISR en aplicaciones self-hosted.
- `GHSA-mcj8-r9mp-w47p` — moderado, cache poisoning de SSG/ISR con sustitución de contenido entre usuarios.

Se fijaron `next` y `eslint-config-next` en `15.5.28` y se actualizaron las integridades y referencias de Next/SWC en `pnpm-lock.yaml`. Next.js publica `15.5.28` como versión corregida para los avisos crítico y alto; incluye también las correcciones previas de la rama 15.5. `sharp` ya está fijado en `0.35.5`, que cumple la versión indicada por el aviso crítico como workaround upstream.

La auditoría del repositorio cubre el árbol completo de dependencias (producción, desarrollo y opcionales) mediante `pnpm audit`. La etapa de auditoría del flujo de validación del PR volvió a pasar sin avisos conocidos. Esto describe el grafo resuelto en esa ejecución y no garantiza la ausencia de vulnerabilidades futuras o no divulgadas; el audit debe seguir siendo una puerta obligatoria en cada cambio. La certificación global de seguridad continúa pendiente de la matriz de regresión y de la aceptación de riesgos descrita abajo.

## Production hardening update — 2026-10-31

The shared security response-header map lives in `apps/web/lib/securityHeaders.ts`. Middleware creates a cryptographically random nonce for each document request, forwards it to Next.js, and returns a matching Content-Security-Policy. The Cloudflare Worker preserves the response CSP rather than replacing it with a static policy. Script and style elements are nonce-bound; `unsafe-inline` and `unsafe-eval` are not enabled.

Next.js Image emits the exact inline presentation hint `style="color:transparent"`. The `style-src-attr` directive permits only its SHA-256 hash through `unsafe-hashes`; this is a narrow exception, not a blanket inline-style allowance. Unit tests pin the hash and Wrangler/Playwright checks monitor browser CSP violations. Worker-owned health, readiness, rate-limit and redirect responses receive the baseline headers.

API request IDs are validated and forwarded from middleware to route handlers. The Worker preserves the middleware response ID so route logs and `X-Request-Id` remain aligned. Checkout passes that ID into the order application and the transactional Notification Outbox; `request_id` is persisted by migration `0045_production_hardening.sql` and is propagated into the notification queue event when present. Analytics producers also preserve optional request IDs. Structured Worker/application errors redact sensitive context and omit raw stack traces; Queue logs do not include message bodies.

Sensitive admin mutations require password reauthentication through a short-lived, scope-bound step-up grant. The grant stores hashes, is bound to the current admin session, expires after five minutes, and is audited. It is enforced for payment refunds/voids, admin-user/permission management and settings writes. **This is password-based reauthentication, not MFA**: no second factor or provider-backed MFA has been integrated.

Playwright scans the storefront home, cart, checkout and admin login for accessible names, image alternatives, document language, a main landmark and Axe rules tagged WCAG 2.0/2.1/2.2 A/AA. These automated checks are targeted regressions, not a WCAG 2.2 AA certification. Full keyboard journeys, contrast/reflow review and assistive-technology testing still require manual acceptance.

The scheduled browser performance smoke reports TTFB, DOMContentLoaded, load, LCP, CLS and Event Timing interaction samples. Its current thresholds include TTFB 800 ms, DOMContentLoaded 2,500 ms, load 4,000 ms, LCP 2,500 ms, CLS 0.1 and interaction P98 200 ms. Event Timing lab samples are not field INP; missing measurements remain inconclusive. Cloudflare edge challenges are classified as inconclusive rather than as a storefront pass or regression. No production Web Vitals improvement is claimed without actual measurements.

The full workspace audit and build/test pipeline remain required on the final PR head. Cloudflare owns the configured Worker deployment and remote D1 migration sequence; GitHub Actions prepares isolated local D1 only and does not apply production migrations. Cloudflare Preview URLs are currently disabled, so a successful Preview build can be recorded but cannot be exercised through a public Preview URL.

**Open acceptance items:** provider-backed MFA plus recovery/break-glass policy; manual accessibility review; reproducible field/lab Web Vitals evidence; final-head CI and Cloudflare Preview evidence. Global security certification remains pending.

## Admin MFA — TOTP obligatorio

A partir de la migración `0047_admin_mfa_and_step_up_single_use.sql`, toda cuenta administrativa debe completar inscripción TOTP antes de recibir una sesión autenticada. La contraseña por sí sola devuelve un desafío temporal; no crea `admin_sessions`. La resolución de sesión en D1 exige una credencial MFA habilitada, por lo que las sesiones antiguas sin segundo factor dejan de autorizar solicitudes.

- TOTP compatible con RFC 6238: HMAC-SHA1, 6 dígitos y períodos de 30 segundos.
- Ventana de tolerancia: paso anterior, actual o siguiente; el último paso aceptado se persiste para impedir replay.
- Secreto TOTP cifrado con AES-256-GCM en D1. La clave de cifrado es un Worker Secret por entorno; nunca se guarda en Git, en D1 ni en logs.
- Desafíos de autenticación/enrolamiento: cinco minutos y un máximo de cinco intentos.
- Diez códigos de recuperación de 128 bits. D1 conserva hashes SHA-256; cada código se consume una sola vez y solo se muestra al emitir/regenerar.
- Login emite sesión únicamente después de verificar TOTP o un código de recuperación válido.
- Operaciones privilegiadas requieren contraseña y un segundo factor válido; el grant queda vinculado a admin, hash de sesión y scope, expira en cinco minutos y se consume atómicamente una sola vez.
- Desactivar MFA exige contraseña y factor vigente, invalida códigos/grants y revoca todas las sesiones; el siguiente login vuelve a exigir enrolamiento.

El código TOTP de RFC 6238, la persistencia de D1, el replay prevention, los códigos de recuperación, el bloqueo de desafíos y la revocación tienen pruebas unitarias/integración. La prueba manual de inscripción con una aplicación autenticadora real y la aceptación operativa de los secretos de Cloudflare se deben realizar antes de habilitar el cambio en producción.

La recuperación de emergencia cuando el administrador pierde tanto el autenticador como sus códigos requiere verificación de identidad fuera de banda por el responsable de Cloudflare. El procedimiento está documentado en `docs/cloudflare-deployment.md`; no existe un bypass de MFA accesible mediante un endpoint público.
