# Design: Add oxlint and oxfmt

**Date:** 2026-06-16

## Overview

Add the Oxc linter (oxlint) and Oxc formatter (oxfmt) to the project as devDependencies, wire them into npm scripts, and enforce them in a dedicated GitHub Actions CI workflow.

## Dependencies

Install as `devDependencies`:

- `oxlint` — the Oxc linter
- The Oxc formatter package (exact npm package name to be verified at install time; the Oxc project formatter is sometimes published under `@oxc/oxfmt` or similar — confirm against the current npm registry before installing)

## npm scripts

Add to `package.json`:

```json
"lint": "oxlint src",
"format": "oxfmt src",
"format:check": "oxfmt --check src"
```

- `lint` — runs oxlint over all files in `src/`
- `format` — auto-formats files in place (local developer use)
- `format:check` — checks formatting without modifying files (used in CI)

## GitHub Actions workflow

New file: `.github/workflows/lint.yml`

- **Triggers:** `push` and `pull_request` targeting `main`
- **Job:** `lint` on `ubuntu-latest`
- **Steps:**
  1. `actions/checkout@v4`
  2. `actions/setup-node@v4` with `node-version-file: ".nvmrc"` (consistent with the existing sync-stars workflow)
  3. `npm ci`
  4. `npm run lint`
  5. `npm run format:check`

## What is not in scope

- Pre-commit hooks (husky / lint-staged) — out of scope per design decision
- Auto-fix in CI — CI checks only; developers run `npm run format` locally
- Linting the existing CI workflow or config files — oxlint targets JS/TS source only
