# oxlint + oxfmt Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add oxlint and oxfmt as devDependencies with npm scripts for local use and a dedicated GitHub Actions workflow to enforce them on push/PR.

**Architecture:** Install both tools as devDependencies, wire three npm scripts (`lint`, `format`, `format:check`) into `package.json`, and add a new `.github/workflows/lint.yml` that runs lint and format-check on every push and pull request to `main`.

**Tech Stack:** oxlint 1.70.0, oxfmt 0.55.0, GitHub Actions

---

## File Map

| File | Action |
|------|--------|
| `package.json` | Modify — add devDependencies and scripts |
| `package-lock.json` | Modified by npm automatically |
| `.github/workflows/lint.yml` | Create |

---

### Task 1: Install oxlint and oxfmt

**Files:**
- Modify: `package.json`
- Modified automatically: `package-lock.json`

- [ ] **Step 1: Install both packages as devDependencies**

```bash
npm install --save-dev oxlint oxfmt
```

Expected output: something like `added N packages` with no errors.

- [ ] **Step 2: Verify oxlint binary works**

```bash
./node_modules/.bin/oxlint --version
```

Expected: prints a version string like `oxlint v1.70.0`.

If you get `Cannot find native binding`, see the recovery note below.

- [ ] **Step 3: Verify oxfmt binary works**

```bash
./node_modules/.bin/oxfmt --version
```

Expected: prints a version string like `oxfmt 0.55.0`.

If you get `Cannot find native binding`, see the recovery note below.

> **Recovery for native binding errors (both tools):** Both oxlint and oxfmt use platform-specific native bindings installed as optional dependencies. There is a [known npm bug](https://github.com/npm/cli/issues/4828) where optional dependencies are sometimes skipped on incremental installs. Fix: `rm -rf node_modules && npm install`. This reinstalls everything cleanly, including the optional bindings.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add oxlint and oxfmt as devDependencies"
```

---

### Task 2: Add npm scripts

**Files:**
- Modify: `package.json` (scripts section)

- [ ] **Step 1: Add the three scripts to `package.json`**

Open `package.json` and add to the `scripts` object:

```json
"lint": "oxlint src",
"format": "oxfmt src",
"format:check": "oxfmt --check src"
```

The full `scripts` block should look like:

```json
"scripts": {
  "start": "node src/index.js",
  "build": "tsc -p .",
  "typecheck": "tsc -p . --noEmit",
  "clean": "rm src/*.js",
  "docker": "npm install && npm run build && docker compose up -d",
  "lint": "oxlint src",
  "format": "oxfmt src",
  "format:check": "oxfmt --check src"
}
```

- [ ] **Step 2: Verify `npm run lint` runs without error**

```bash
npm run lint
```

Expected: oxlint scans the `src/` directory and exits 0 (or reports lint warnings/errors if any exist in the source — fix any errors it reports before continuing).

- [ ] **Step 3: Verify `npm run format` runs without error**

```bash
npm run format
```

Expected: oxfmt formats files in `src/` in place and exits 0.

- [ ] **Step 4: Verify `npm run format:check` runs without error**

```bash
npm run format:check
```

Expected: exits 0. If it exits non-zero, files were reformatted in step 3 but not staged — run `npm run format` again and re-check.

- [ ] **Step 5: Commit**

```bash
git add package.json
git commit -m "chore: add lint, format, and format:check npm scripts"
```

---

### Task 3: Create GitHub Actions lint workflow

**Files:**
- Create: `.github/workflows/lint.yml`

- [ ] **Step 1: Create `.github/workflows/lint.yml`**

```yaml
name: Lint

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

permissions:
  contents: read

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version-file: ".nvmrc"

      - run: npm ci

      - name: Lint
        run: npm run lint

      - name: Check formatting
        run: npm run format:check
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/lint.yml
git commit -m "ci: add oxlint and oxfmt check workflow"
```
