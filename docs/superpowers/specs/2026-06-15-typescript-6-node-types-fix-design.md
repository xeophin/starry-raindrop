# Fix TypeScript 6.0 Node Type Globals (XEO-717)

## Problem

Dependabot auto-merged a major TypeScript bump (5.9.3 → 6.0.3) alongside minor/patch updates. TypeScript 6.0 no longer auto-includes `@types/node` globals — `process`, `console`, etc. are now absent because `@types/node` is only a transitive dependency and isn't declared in `tsconfig.json`. The CI workflow fails at the `npm run build` step with `TS2591`/`TS2584` errors.

## Fix

### 1. Add `@types/node` as a dev dependency

Install `@types/node@^22` (matching the Node 22 runtime declared in `.nvmrc`). This makes the dependency explicit rather than relying on a transitive install from `ts-node`.

### 2. Declare node types in `tsconfig.json`

Add `"types": ["node"]` to `compilerOptions`. This is the TypeScript 6 way to opt in to Node.js global type augmentations.

### 3. Separate major-version bumps in dependabot

Update `.github/dependabot.yml` to put major-version npm updates in a dedicated group with `update-types: ["minor", "patch"]` on the existing auto-merge group, so future major bumps create separate PRs that require manual review rather than auto-merging.

## Out of Scope

- No source code changes needed; the errors are purely type-declaration gaps.
- No changes to the workflow YAML.
