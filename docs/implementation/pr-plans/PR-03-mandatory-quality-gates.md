# PR #22 — Mandatory CI quality gates

**Repository:** `programadorkevinsvega-sys/Ecommerce-iPhone`  
**Branch:** `ci/mandatory-quality-gates` → `main`  
**Status:** Implementation complete. The latest GitHub Actions run
[#41158166160](https://github.com/programadorkevinsvega-sys/Ecommerce-iPhone/actions/runs/41158166160)
passed on head commit
`aab6f34f06cbe25d2e2aa403d887d49d4a7c5916`. The PR remains open and draft.
Main branch protection and Cloudflare Preview resource isolation still require
repository/dashboard administration.

## Implementation

The existing `.github/workflows/payment-consistency.yml` remains the single
pull-request CI workflow. No duplicate workflow or second OpenNext build was
introduced.

The workflow enforces this quality sequence:

1. Checkout, pnpm 12.4.1 setup, Node.js 24.18.0 setup and frozen installation.
2. Explicit toolchain verification through `scripts/verify-install.mjs`.
3. Full dependency audit through `pnpm audit`, without `continue-on-error`.
4. Non-mutating Prettier validation for changed files via
   `pnpm format:check:changed`.
5. Foundation, frontend production-data and architecture checks.
6. ESLint, TypeScript and the complete Vitest unit/integration suite.
7. Local-only D1 preparation and migrations.
8. One OpenNext/Cloudflare build and artifact verification.
9. Playwright against local Wrangler, reusing the already-built Worker output
   instead of triggering another OpenNext build.
10. Positive and negative tests for the production branch guard.

The separate full-repository `pnpm format:check` currently reports 485
pre-existing unformatted baseline files; that unrelated cleanup is excluded
from this PR. The required changed-file formatting gate passed in the latest
run.

A final job named **`CI required`** runs with `always()` and evaluates the
result of both `runner-diagnostics` and `payment-quality`. Any upstream
failure, cancellation or skip causes this aggregate job to fail. Configure
this exact job check as the required GitHub status check for `main`.

## CI/CD ownership remains unchanged

- **GitHub Actions:** installation, audit, format, lint, types, architecture,
  tests, local D1, Playwright, OpenNext build and artifact verification.
- **Cloudflare Workers Builds:** production build/deploy environment, main-only
  production guard, remote D1 migrations and `wrangler deploy`.
- GitHub Actions does not receive Cloudflare deployment credentials, run
  remote D1 migrations or deploy production.

The Cloudflare GitHub App reported a successful Preview build for the latest
PR head `aab6f34f06cbe25d2e2aa403d887d49d4a7c5916` (Build ID
`01575f42-9c04-4b5e-b754-0049a7222bc1`). The PR comment did not expose a
Preview URL. This confirms a successful non-production branch build only; it
does not establish runtime health or resource isolation. The Wrangler
`previews` configuration does not define separate D1, R2 or Queue bindings.
Disable Preview Builds until dedicated non-production resources and bindings
are configured and verified, or finish and test that isolation.

## Acceptance status

- [x] Reuse the existing CI workflow; do not duplicate the PR #30 OpenNext build.
- [x] Use the official non-mutating changed-file formatting check without
      creating unrelated repository-wide formatting churn.
- [x] Publish one stable aggregate status check that rejects failed, cancelled
      and skipped prerequisite jobs.
- [x] Keep production migrations and deployment owned by Cloudflare.
- [x] GitHub Actions run
      [#41158166160](https://github.com/programadorkevinsvega-sys/Ecommerce-iPhone/actions/runs/41158166160)
      passed on the latest PR head:
      `aab6f34f06cbe25d2e2aa403d887d49d4a7c5916`. The
      `payment-quality`, `runner-diagnostics` and `CI required` jobs all
      completed successfully.
- [x] Cloudflare Preview build for the same head completed successfully; no
      Preview URL was provided by the GitHub deployment comment.
- [ ] Require **`CI required`** in the `main` branch ruleset / protection
      rule. Current GitHub inspection reports `main` unprotected and no
      repository rulesets. This requires repository-admin access.
- [ ] Disable Preview Builds or complete and verify separate Preview D1, R2,
      Queue, variable and secret configuration. Current Preview runtime
      isolation is not certified.

## Verification

The latest authoritative GitHub Actions execution is run
[#41158166160](https://github.com/programadorkevinsvega-sys/Ecommerce-iPhone/actions/runs/41158166160).
It passed the frozen install, toolchain check, full audit, changed-file
formatting, foundation/frontend/architecture checks, ESLint, TypeScript, full
Vitest suite, local D1 setup and migrations, single OpenNext build, artifact
verification, Playwright E2E against local Wrangler, production guard tests
and aggregate required-check job.

The separate repository-wide Prettier command remains red on 485 existing
baseline files; the PR's required changed-file formatting check is green.
