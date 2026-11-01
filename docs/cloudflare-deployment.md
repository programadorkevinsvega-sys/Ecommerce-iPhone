# Cloudflare deployment

## Production environment

Canonical production domain: https://iphone.jnmtortas.com.

The repository uses one remote production environment in Cloudflare Workers. There is no remote staging environment yet.

| Resource     | Name                      |
| ------------ | ------------------------- |
| Worker       | `ecommerce-iphone`        |
| D1           | `ecommerce-iphone`        |
| R2           | `ecommerce-iphone-media`  |
| Events Queue | `ecommerce-iphone-events` |

Toolchain:

- Node.js `24.18.0`
- pnpm `12.4.1`
- Next.js `15.5.28`
- `@opennextjs/cloudflare 1.20.14`
- Wrangler `4.155.0`
- workerd compatibility date `2026-09-09`

## CI/CD ownership

**GitHub Actions owns CI and automated tests. Cloudflare Workers Builds owns production D1 migrations and Worker deployment.**

### GitHub Actions — CI before merge

The workflow `.github/workflows/payment-consistency.yml` runs on pull requests to `main` and pushes to `main`. It performs:

1. Reproducible install with `pnpm install --frozen-lockfile`; the install lifecycle runs `scripts/verify-install.mjs`, and CI runs it again as an explicit named gate.
2. Complete dependency audit with `pnpm audit` (production, development and optional dependencies).
3. Changed-file Prettier validation through `pnpm format:check:changed` (the repository-wide `pnpm format:check` remains available for full-tree maintenance).
4. Repository foundations, frontend production-data and architecture checks.
5. ESLint and TypeScript as dedicated CI gates.
6. Complete Vitest unit/integration suite.
7. A local-only fixture bootstrap for legacy product parent rows required by migration `0009`, then the complete D1 migration history in local mode.
8. The single OpenNext build command, `pnpm cloudflare:build`, followed by `pnpm verify:cloudflare:build` to validate the prerender manifest, static HTML pages, Worker bundle and assets.
9. Playwright against local Wrangler using the already-built Worker output. In CI the Playwright web server starts `wrangler dev --local` directly and does not invoke another OpenNext build.

Pull-request CI has no Cloudflare or production credentials. The E2E database is local, initialized from repository migrations and their test/catalog seed data. CI never applies remote D1 migrations and never deploys a Worker.

The workflow exposes one stable aggregate job check named **`CI required`**. It runs with `always()` and succeeds only when both `runner-diagnostics` and `payment-quality` succeed. A failed, cancelled or skipped upstream job makes the aggregate check fail.

### Required merge protection for `main`

The workflow triggers CI, but it cannot make its own result mandatory for merging. Configure this separately in **Settings → Rules → Rulesets** (or **Settings → Branches → Branch protection rules**) for the `main` branch:

1. Require status checks to pass before merging.
2. Add the exact GitHub Actions check **`CI required`** from **Repository CI** as a required check. Do not rely only on the individual `payment-quality` job.
3. Do not grant bypass actors for this rule; include administrators / enable the ruleset's bypass protection.
4. Block force pushes and branch deletion. Requiring the branch to be up to date before merging is recommended.

This is repository administration state and is not configured by a workflow file. Until the rule is enabled in GitHub, CI will run on pull requests but a failing check is not guaranteed to block a merge.

### Cloudflare Workers Builds — production CD

Every push to the configured production branch `main` triggers Workers Builds. Cloudflare runs the configured Build command, then the Deploy command. The repository's Deploy command is `pnpm cloudflare:deploy`, which delegates to `pnpm cloudflare:deploy:production` and performs these operations in order:

1. Verify that Cloudflare Workers Builds reports `WORKERS_CI_BRANCH=main` (non-main branches are rejected).
2. Apply unapplied production D1 migrations with `pnpm db:migrate:production`.
3. Publish the Worker with `pnpm exec wrangler deploy --env=""`.

The production migration and Worker deployment therefore execute inside Cloudflare Workers Builds, using the API token configured for that Worker in Cloudflare. GitHub Actions does not need `CLOUDFLARE_ACCOUNT_ID` or `CLOUDFLARE_API_TOKEN` to deploy.

**Required Cloudflare token permission:** the automatically generated Workers Builds token does not include D1 access by default. In Cloudflare, open **My Profile → API Tokens**, edit the token selected under the Worker’s **Settings → Build → API token**, and grant **Account → D1 → Edit**. Keep the existing Workers Scripts edit permission required to deploy the Worker. Without D1 Edit, the migration step will fail even though Worker upload permissions are correct.

The workflow `.github/workflows/production-verification.yml` separately runs scheduled/manual HTTP smoke checks after deployment. Deeper Phase 10.2–10.5 probes, which write synthetic analytics/cart rows and clean them up, are opt-in via `workflow_dispatch`. Authenticated admin/RBAC verification is also opt-in and uses dedicated GitHub Secrets.

The existing `.github/workflows/performance.yml` runs Playwright performance smoke checks from GitHub Actions on a schedule or manually.

### Cloudflare Workers Builds — build and deploy

Configure **Workers & Pages → ecommerce-iphone → Settings → Build**:

| Field             | Value                                                     |
| ----------------- | --------------------------------------------------------- |
| Production branch | `main`                                                    |
| Build command     | `pnpm install --frozen-lockfile && pnpm build:cloudflare` |
| Deploy command    | `pnpm cloudflare:deploy`                                  |
| Root directory    | empty (monorepo root)                                     |

GitHub Actions runs `pnpm cloudflare:build` and verifies its generated static pages and Worker artifacts before merge. Cloudflare must still run the build command to create the deployable Worker artifact in its own build environment; this is artifact production, not a replacement for the GitHub CI gates. The Cloudflare build does not run the repository audit, full Vitest suite, local D1 bootstrap, Playwright E2E suite or production smoke probes.

The Deploy command is the only production deployment path. It runs the main-branch guard, applies remote D1 migrations, and publishes the Worker. Keep `main` as the production branch in the Cloudflare dashboard. The guard reads the `WORKERS_CI_BRANCH` variable injected by Workers Builds, so builds from any other branch are rejected.

**Important:** production Deploy and non-production Preview builds are independent controls. Cloudflare uses a separate Preview command when Preview Builds are enabled; it defaults to `npx wrangler preview`. See the [Cloudflare Build configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/) and [branch control guide](https://developers.cloudflare.com/workers/ci-cd/builds/build-branches/).

### Previews for non-production branches

**Operational state observed on 2026-10-31:** the Cloudflare GitHub App reported a
successful Preview build for commit
`aab6f34f06cbe25d2e2aa403d887d49d4a7c5916` on branch
`ci/mandatory-quality-gates` (Build ID
`01575f42-9c04-4b5e-b754-0049a7222bc1`; check details URL under
`/production/previews/ci-mandatory-quality-gates/builds/`). The project
operator has since confirmed that a dedicated Preview domain is configured in
Cloudflare. Therefore, the earlier GitHub comment text "No Preview URL" is
stale as an indicator of domain availability: the Cloudflare GitHub App's
deployment comment may leave its URL cell blank even though the Preview
hostname is configured.

The Preview hostname is managed in Cloudflare and is not declared in the
repository's current Wrangler configuration. Do not infer or substitute the
production hostname or a `workers.dev` URL. Copy the exact Preview hostname
from Cloudflare before publishing it in project documentation or using it for
runtime checks. A configured domain is not, by itself, proof that the Preview
application is healthy or that its data resources are isolated.

A Cloudflare Preview is separate from a production Worker version or active
deployment. Non-production branches run the Preview command, not the production
Deploy command. The successful Preview build check is build evidence only: it
does not prove the Preview runtime's resource isolation or application health.

**Resource isolation is not yet certified.** The existence of the Preview domain does not change the repository configuration: its top-level Wrangler
configuration binds production D1, R2 and Queues resources, while its
`previews` block is empty and does not declare separate D1, R2 or Queue
producer bindings. A successful Preview build must not be treated as evidence
that the preview runtime is safely isolated. Cloudflare documents that
Previews sharing the same D1 database ID, R2 bucket name or Queue name share
those resources.

Until dedicated non-production resources and Preview bindings are provisioned
and verified, do not use the Preview domain for operations that write to D1,
R2 or Queues. To prevent accidental access while those resources remain
unverified, disable **Enable Preview Builds** in
**Workers & Pages → ecommerce-iphone → Settings → Build → Branch control**.
Alternatively, keep previews enabled only after configuring separate Preview
D1, R2 and Queue resources, Preview-specific variables/secrets, and validating
the Preview URL and its access boundaries. Do not point Preview traffic or
producers at production resources. Queue consumers and production Cron/Routes
remain separate platform concerns and must not be assumed to be preview-isolated.

Pull-request E2E validation is performed in GitHub Actions against local
Wrangler with local D1. A remote Cloudflare Preview is not required for CI.

## Versioned commands

- `pnpm build:cloudflare`: compile the Worker bundle; no tests and no deploy.
- `pnpm cloudflare:build`: the single OpenNext production build in GitHub Actions; Cloudflare runs its own build in the deployment environment to produce the deployable Worker artifact.
- `pnpm verify:cloudflare:build`: verify that Next.js static-page output, the OpenNext Worker bundle and static assets were generated before CI starts Playwright.
- `pnpm cloudflare:deploy`: Workers Builds production hook; main-only guard, production D1 migrations, then Wrangler deploy.
- `pnpm cloudflare:deploy:production`: main-only guard, production D1 migrations, then Wrangler deploy.
- `pnpm deploy:production`: local/manual build followed by the same main-only guarded production deploy.
- `pnpm db:migrate:local`: apply migrations to local D1.
- `pnpm db:prepare:e2e`: create local-only legacy parent rows needed by historical migrations, then apply the complete D1 migration history for E2E.
- `pnpm format:check:changed`: Prettier validation for files changed by the current Git diff.
- `pnpm format:check`: full-repository Prettier check; existing baseline files may require separate cleanup.
- `pnpm test`: Vitest.
- `pnpm test:e2e`: Playwright against local Wrangler.

## Production bindings

- `DB` → `ecommerce-iphone`
- `MEDIA_BUCKET` → `ecommerce-iphone-media`
- `EVENTS_QUEUE` → `ecommerce-iphone-events`
- `NOTIFICATIONS_QUEUE` → `ecommerce-iphone-notifications`
- `NOTIFICATIONS_DLQ_QUEUE` → `ecommerce-iphone-notifications-dlq`
- `API_RATE_LIMITER` → 120 requests / 60s
- `SENSITIVE_RATE_LIMITER` → 20 requests / 60s
- `APP_ENV` → `production`

## Secrets

Keep Worker secrets out of Git and CI logs:

- `RESEND_API_KEY`
- `ADMIN_BOOTSTRAP_TOKEN`
- payment provider credentials.

Configure Worker secrets with `wrangler secret put <SECRET_NAME>`. Configure only the secrets actually required by production verification (such as dedicated admin/RBAC test credentials) as GitHub repository secrets. The Cloudflare deploy token is managed by Workers Builds in Cloudflare, not stored in GitHub Actions.

## Migrations and rollback

Production migrations are applied by the Cloudflare Workers Builds Deploy command immediately before publishing the Worker. Never edit an applied migration; add a new numbered migration.

Rollback remains manual through `.github/workflows/rollback.yml` and must be followed by a passing `pnpm verify:production`.

## Admin MFA — secretos y preparación previa al despliegue

La migración `0047_admin_mfa_and_step_up_single_use.sql` crea el almacenamiento de credenciales cifradas, desafíos y hashes de recuperación, y añade el consumo de un solo uso a los grants de step-up. **Antes de desplegar esta migración y el nuevo login, configura la llave del Worker**. Sin ella, el login falla de forma cerrada (HTTP 503) y no emite sesiones.

### Inicialización por entorno

1. Genera 32 bytes aleatorios en un equipo de administración seguro:

   ```bash
   openssl rand -base64 32
   ```

2. Copia el resultado (no lo guardes en el repositorio) y configura el Worker de producción:

   ```bash
   pnpm exec wrangler secret put ADMIN_MFA_ENCRYPTION_KEY
   ```

   Pega el valor base64 generado cuando Wrangler lo solicite. Verifica que el secreto esté asociado al Worker `ecommerce-iphone` y a la cuenta correcta.

3. La versión inicial de la llave es `1` por defecto. No es necesario ponerla en `wrangler.jsonc`; si se define explícitamente, debe ser `ADMIN_MFA_ENCRYPTION_KEY_VERSION=1` como variable normal, nunca como secreto separado.

4. Crea una llave diferente para cada entorno Preview/local que vaya a procesar logins MFA. No reutilices la llave de producción. Para desarrollo local, usa el archivo local `.dev.vars` ignorado por Git y nunca compartas su contenido.

5. Confirma que el Worker Secret está disponible antes de habilitar el build/deploy que contiene la migración 0047. Cloudflare Workers Builds continúa siendo quien aplica la migración D1 remota; GitHub Actions solo la prueba en una base local.

### Rotación de llave

La versión 2 permite rotación sin guardar secretos en Git:

1. Guarda la llave actual v1 de forma segura.
2. Establece la nueva llave base64 en `ADMIN_MFA_ENCRYPTION_KEY`, establece `ADMIN_MFA_ENCRYPTION_KEY_PREVIOUS` con la llave v1 y fija la variable `ADMIN_MFA_ENCRYPTION_KEY_VERSION=2`.
3. Despliega el Worker. Cada acceso MFA que lea una credencial v1 la descifra con la llave anterior y reescribe el secreto cifrado con la llave v2.
4. Conserva la llave anterior hasta comprobar en D1 que no quedan filas v1:

   ```sql
   SELECT key_version, COUNT(*) AS credentials
   FROM admin_mfa_credentials
   GROUP BY key_version;
   ```

5. Solo cuando el resultado confirme que todas las credenciales usan v2, elimina `ADMIN_MFA_ENCRYPTION_KEY_PREVIOUS`. No retires la llave antigua antes de completar esa comprobación.

Mantén una copia de respaldo segura de la llave activa. Perder la única llave que cifra las credenciales impide validar los autenticadores existentes.

### Recuperación de emergencia (break-glass)

No existe un endpoint público para saltar MFA. Si una persona administradora pierde el autenticador y todos sus códigos de recuperación:

1. Verifica su identidad y autorización por un canal fuera de banda; registra quién aprobó y quién ejecutó el procedimiento.
2. Usa una sesión administrativa de Cloudflare con acceso D1 remoto y confirma el ID exacto de la cuenta administrativa.
3. Ejecuta un reset dirigido a ese ID. Sustituye `ADMIN_ID_VERIFICADO` por el ID confirmado:

   ```sql
   INSERT INTO admin_audit_log
     (id,admin_user_id,action,resource_type,resource_id,payload_json,ip_hash)
   VALUES
     (lower(hex(randomblob(16))), 'ADMIN_ID_VERIFICADO',
      'ADMIN_MFA_BREAK_GLASS_RESET', 'admin_user', 'ADMIN_ID_VERIFICADO',
      '{"reason":"operator-verified recovery"}', NULL);

   DELETE FROM admin_mfa_recovery_codes WHERE admin_user_id='ADMIN_ID_VERIFICADO';
   DELETE FROM admin_mfa_challenges WHERE admin_user_id='ADMIN_ID_VERIFICADO';
   DELETE FROM admin_step_up_grants WHERE admin_user_id='ADMIN_ID_VERIFICADO';
   DELETE FROM admin_mfa_credentials WHERE admin_user_id='ADMIN_ID_VERIFICADO';
   UPDATE admin_sessions
     SET revoked_at=CURRENT_TIMESTAMP
     WHERE admin_user_id='ADMIN_ID_VERIFICADO' AND revoked_at IS NULL;
   ```

   Ejecuta estas sentencias en una operación D1 remota controlada; conserva el registro de auditoría y la evidencia de aprobación.

4. El siguiente login del administrador exigirá inscripción TOTP nueva. No restaures sesiones anteriores ni entregues un código temporal por correo.

El comando remoto de emergencia es una operación manual de Cloudflare con revisión y aprobación, **no forma parte de CI ni del pipeline de despliegue**.

### Configuración RUM

`NEXT_PUBLIC_WEB_VITALS_SAMPLE_RATE` es una variable de build de Next.js. Por defecto la aplicación muestrea el 10% de las páginas; se puede definir en Build variables de Workers Builds. El workflow Lighthouse la pone en `0` para que las pruebas sintéticas no se guarden como RUM. No la declares como sustituto de un Worker Secret ni la confundas con `APP_ENV`.
