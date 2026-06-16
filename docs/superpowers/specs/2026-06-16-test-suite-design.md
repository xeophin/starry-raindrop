# Test Suite Design

**Date:** 2026-06-16
**Project:** starry-raindrop
**Scope:** Add a Vitest-based test suite with unit and integration tests, wired into CI

---

## Context

`starry-raindrop` is a small TypeScript/ESM tool that syncs GitHub starred repos to a Raindrop.io collection. All meaningful logic lives in `src/main.ts`. There are currently no tests.

---

## Architecture

### Refactor: extract pure functions from `main()`

`main.ts` currently inlines all logic inside one async function. Two pure functions are extracted to make unit testing possible:

**`mapStarToRaindrop(star: ActualStar, collectionId: string): RaindropItem`**
(`ActualStar` and `RaindropItem` are currently inline types in `main.ts` — they will be named and exported as part of this refactor so the extracted functions can reference them.)
Converts a single GitHub starred repo into the Raindrop.io item format. Handles:
- Field mapping: `full_name` → title, `html_url` → link, `starred_at` → created, `description` → excerpt
- Tag pipeline: `["github", language, ...topics]`, compacted and lowercased via lodash

**`filterNewRaindrops(chunk: RaindropItem[], duplicates: { link: string }[]): RaindropItem[]`**
Given a chunk of raindrop items and the existing duplicates returned by the Raindrop API, returns only the items not already saved.

`main()` is updated to call these functions instead of inlining the logic. Both are exported from `main.ts`.

### Test file structure

```
src/
  __tests__/
    main.unit.test.ts       # unit tests for mapStarToRaindrop and filterNewRaindrops
    main.integration.test.ts # integration tests for main() with mocked APIs
```

---

## Unit Tests (`main.unit.test.ts`)

Tests for `mapStarToRaindrop`:
- Maps all fields correctly (title, link, created, excerpt, collectionId)
- Tags include `"github"` + language + topics, all lowercased
- Null/missing language is excluded from tags
- Empty topics array produces just `["github"]`
- Language with no topics produces `["github", "<language>"]`

Tests for `filterNewRaindrops`:
- Returns all items when duplicates list is empty
- Excludes items whose link matches a duplicate
- Returns empty array when all items are duplicates
- Handles partial overlap (some duplicates, some new)

---

## Integration Tests (`main.integration.test.ts`)

Mocking strategy:
- `vi.mock('axios')` — intercepts `axios.create()`, controls `.post()` return values
- `vi.mock('octokit')` — stubs `octokit.paginate()` return value
- `process.env` vars (`GH_TOKEN`, `RAINDROP_TOKEN`, `RAINDROP_COLLECTION_ID`) set in test setup

Test cases calling `main()`:
- **Happy path — new repos**: 2 stars, no duplicates → `POST /raindrops` called once with both
- **All duplicates**: 2 stars, both already exist → `POST /raindrops` never called
- **Partial duplicates**: 3 stars, 1 duplicate → 2 items posted
- **Chunking**: 150 stars → two `POST /raindrops` calls (chunks of 100 and 50)
- **Empty stars**: 0 stars → no Raindrop API calls

---

## Framework

**Vitest** — chosen for native ESM and TypeScript support with zero configuration. Jest-compatible API. Built-in `vi.mock()` for module mocking.

Added to `package.json`:
- `devDependencies`: `vitest`
- `scripts.test`: `vitest run`

---

## CI

New workflow: `.github/workflows/test.yml`
- Triggers on `push` and `pull_request` (all branches)
- Steps: `actions/checkout`, `actions/setup-node` (node-version-file: `.nvmrc`), `npm ci`, `npm test`
- No secrets required — all API calls are mocked

The existing `sync-stars.yml` (scheduled sync with real secrets) is unchanged.
