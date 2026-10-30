# PR 03 — Mandatory CI quality gates

**Priority:** P0  
**Status:** Planning scaffold only; workflow changes and verification are pending.

## Scope
- Make formatting, linting, type checks, tests, architecture checks, and production build mandatory before deployment.
- Correct build and migration ordering.
- Document and configure required branch protection checks where repository permissions allow.

## Acceptance criteria
- Deployment cannot proceed when a required quality gate fails.
- Migrations run in a safe, explicit order relative to deployment.
- Workflow dependencies and required check names are deterministic.
- CI validates pull requests targeting `main`.

## Verification
Exercise successful and failing workflow paths; confirm required checks and deployment dependencies in GitHub.