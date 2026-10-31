# PR #22 — Mandatory CI quality gates

**Repository:** `programadorkevinsvega-sys/Ecommerce-iPhone`  
**Branch:** `ci/mandatory-quality-gates` → `main`  
**Status:** Implementation committed to the existing PR branch. GitHub Actions revalidation and repository branch-protection configuration remain outstanding.

## Implementation

The existing `.github/workflows/payment-consistency.yml` remains the single pull-request CI workflow. No duplicate workflow or second OpenNext build was introduced.

The workflow retains the quality sequence already delivered by the merged CI/CD PRs:

1. Checkout, pnpm 12.4.1 setup, Node.js 24.18.0 setup and frozen installation.
2. Explicit toolchain verification through `scripts/verify-install.mjs`.
3. Full dependency audit through `pnpm audit`, without `continue-on-error`.
4. Non-mutating Prettier validation for changed files via `pnpm format:check:changed`.
5. Foundation, frontend production-data and architecture checks.
6. ESLint, TypeScript and the complete Vitest unit/integration suite.
7. Local-only D1 preparation and migrations.
8. One OpenNext/Cloudflare build and artifact verification.
9. Playwright against local Wrangler, reusing the already-built Worker output instead of triggering another OpenNext build.
10. Positive and negative tests for the production branch guard.

The separate full-repository `pnpm format:check` currently reports 485 pre-existing unformatted baseline files; that unrelated cleanup is excluded from this PR.

A final job named **`CI required`** runs with `always()` and evaluates the result of both `runner-diagnostics` and `payment-quality`. Any upstream failure, cancellation or skip causes this aggregate job to fail. Configure this exact job check as the required GitHub status check for `main`.

## CI/CD ownership remains unchanged

- **GitHub Actions:** installation, audit, format, lint, types, architecture/contracts, tests, local D1, Playwright, OpenNext build and artifact verification.
- **Cloudflare Workers Builds:** deploy build environment, main-only production guard, remote D1 migrations and `wrangler deploy`.
- GitHub Actions does not receive Cloudflare deployment credentials, run remote D1 migrations or deploy production.
- A Cloudflare Preview build for this branch was observed, confirming that Preview Builds are enabled in the dashboard. The Preview build was not a production deployment, but runtime resource isolation is not certified because the Wrangler `previews` block has no separate D1/R2/Queue bindings. Disable Preview Builds manually until isolated resources are configured and verified.

## Acceptance status

- [x] Reuse the existing CI workflow; do not duplicate the PR #30 OpenNext build.
- [x] Use the official non-mutating changed-file formatting check without creating unrelated repository-wide formatting churn.
- [x] Publish one stable aggregate status check that rejects failed, cancelled and skipped prerequisite jobs.
- [x] Keep production migrations and deployment owned by Cloudflare.
- [x] GitHub Actions `Repository CI` and `CI required` passed on the latest implementation commit `12d8441e63af5ba0e95b1f99a7b0444ea9dc882d` (run `41157718606`).
- [ ] Require **`CI required`** in the `main` branch ruleset / protection rule: manual repository-admin action. The last inspected GitHub branch metadata reported `main` as unprotected and no repository rulesets.

## Verification commands

GitHub Actions executes the repository's official commands from the workflow. Local validation from this execution environment was not possible because outbound access to GitHub was unavailable; the pushed PR checks must provide the authoritative execution evidence.
