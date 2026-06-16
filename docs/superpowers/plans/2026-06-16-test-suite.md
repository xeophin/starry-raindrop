# Test Suite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Vitest-based test suite with unit and integration tests for `src/main.ts`, wired into GitHub Actions CI.

**Architecture:** Extract two pure functions (`mapStarToRaindrop`, `filterNewRaindrops`) and shared types from `main()` so they can be unit-tested in isolation. Write integration tests that mock axios and Octokit to exercise the full `main()` flow without touching real APIs. Add a separate CI workflow that runs tests on every push/PR.

**Tech Stack:** Vitest, TypeScript, ESM modules (`"type": "module"`), GitHub Actions

---

## File Map

| Action | Path | Purpose |
|--------|------|---------|
| Modify | `package.json` | Add `vitest` dev dep, add `"test"` script |
| Modify | `src/main.ts` | Export types `StarredRepo`, `ActualStar`, `RaindropItem`; extract and export `mapStarToRaindrop` and `filterNewRaindrops`; update `main()` call sites |
| Create | `src/__tests__/main.unit.test.ts` | Unit tests for the two pure functions |
| Create | `src/__tests__/main.integration.test.ts` | Integration tests for `main()` with mocked APIs |
| Create | `.github/workflows/test.yml` | CI workflow: runs `npm test` on push and PR |

---

## Task 1: Install Vitest

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install vitest as a dev dependency**

```bash
npm install --save-dev vitest
```

Expected: `package.json` now has `"vitest"` under `devDependencies`.

- [ ] **Step 2: Add the test script to `package.json`**

In `package.json`, add `"test"` to the `scripts` section:

```json
{
  "scripts": {
    "start": "node src/index.js",
    "build": "tsc -p .",
    "typecheck": "tsc -p . --noEmit",
    "clean": "rm src/*.js",
    "docker": "npm install && npm run build && docker compose up -d",
    "test": "vitest run"
  }
}
```

- [ ] **Step 3: Verify Vitest runs (no tests yet)**

```bash
npm test
```

Expected output includes something like `No test files found` or exits cleanly with 0 test files. If it errors, check the `package.json` change.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install vitest"
```

---

## Task 2: Unit tests for `mapStarToRaindrop` (TDD)

**Files:**
- Create: `src/__tests__/main.unit.test.ts`
- Modify: `src/main.ts`

### Step 2a: Write the failing tests

- [ ] **Step 1: Create `src/__tests__/main.unit.test.ts` with tests for `mapStarToRaindrop`**

```typescript
import { describe, it, expect } from 'vitest'
import { mapStarToRaindrop } from '../main.js'
import type { ActualStar } from '../main.js'

const makeRepo = (overrides: Partial<{
  full_name: string
  html_url: string
  language: string | null
  topics: string[]
  description: string | null
}> = {}) => ({
  full_name: 'owner/repo',
  html_url: 'https://github.com/owner/repo',
  language: 'TypeScript',
  topics: ['tooling'],
  description: 'A great repo',
  ...overrides,
})

const makeStar = (repoOverrides: Parameters<typeof makeRepo>[0] = {}): ActualStar => ({
  starred_at: '2024-01-01T00:00:00Z',
  repo: makeRepo(repoOverrides),
})

describe('mapStarToRaindrop', () => {
  it('maps all fields correctly', () => {
    const result = mapStarToRaindrop(makeStar(), '12345')
    expect(result).toEqual({
      collectionId: '12345',
      title: 'owner/repo',
      link: 'https://github.com/owner/repo',
      tags: ['github', 'typescript', 'tooling'],
      created: '2024-01-01T00:00:00Z',
      excerpt: 'A great repo',
    })
  })

  it('excludes null language from tags', () => {
    const result = mapStarToRaindrop(makeStar({ language: null }), '12345')
    expect(result.tags).toEqual(['github', 'tooling'])
  })

  it('handles empty topics', () => {
    const result = mapStarToRaindrop(makeStar({ topics: [] }), '12345')
    expect(result.tags).toEqual(['github', 'typescript'])
  })

  it('lowercases all tags', () => {
    const result = mapStarToRaindrop(makeStar({ language: 'TypeScript', topics: ['MyTopic'] }), '12345')
    expect(result.tags).toEqual(['github', 'typescript', 'mytopic'])
  })

  it('produces only github tag when language is null and topics is empty', () => {
    const result = mapStarToRaindrop(makeStar({ language: null, topics: [] }), '12345')
    expect(result.tags).toEqual(['github'])
  })

  it('passes collectionId through', () => {
    expect(mapStarToRaindrop(makeStar(), 'my-collection').collectionId).toBe('my-collection')
    expect(mapStarToRaindrop(makeStar(), undefined).collectionId).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run the tests — expect them to fail**

```bash
npm test
```

Expected: Fails with an error like `SyntaxError: The requested module '../main.js' does not provide an export named 'mapStarToRaindrop'`.

### Step 2b: Implement to make the tests pass

- [ ] **Step 3: Add exported types and `mapStarToRaindrop` to `src/main.ts`**

Replace the entire contents of `src/main.ts` with:

```typescript
import axios from "axios";
import _ from "lodash";
import { Octokit } from "octokit";

const raindropAxios = axios.create({
  baseURL: "https://api.raindrop.io/rest/v1",
  headers: {
    Authorization: `Bearer ${process.env.RAINDROP_TOKEN}`,
    "Content-Type": "application/json",
  },
});

export type StarredRepo = {
  full_name: string;
  html_url: string;
  language: string | null;
  topics?: string[];
  description: string | null;
};

export type ActualStar = {
  starred_at: string;
  repo: StarredRepo;
};

export type RaindropItem = {
  collectionId: string | undefined;
  title: string;
  link: string;
  tags: string[];
  created: string;
  excerpt: string | null;
};

export function mapStarToRaindrop(
  star: ActualStar,
  collectionId: string | undefined
): RaindropItem {
  return {
    collectionId,
    title: star.repo.full_name,
    link: star.repo.html_url,
    tags: _([
      "github",
      star.repo.language || undefined,
      ...(star.repo.topics || []),
    ])
      .compact()
      .map((i) => i.toLowerCase())
      .value(),
    created: star.starred_at,
    excerpt: star.repo.description,
  };
}

export function filterNewRaindrops(
  chunk: RaindropItem[],
  duplicates: { link: string }[]
): RaindropItem[] {
  return chunk.filter((r) => duplicates.every((d) => d.link !== r.link));
}

export const main = async () => {
  const octokit = new Octokit({ auth: process.env.GH_TOKEN });

  console.log(new Date(), "Fetching all your starred repos...");
  const stars = await octokit.paginate(
    octokit.rest.activity.listReposStarredByAuthenticatedUser,
    {
      per_page: 100,
      headers: {
        accept: "application/vnd.github.v3.star+json",
      },
    }
  );
  console.log(new Date(), `Found ${stars.length} starred repos!`);

  const newRaindrops = (stars as unknown as ActualStar[]).map((star) =>
    mapStarToRaindrop(star, process.env.RAINDROP_COLLECTION_ID)
  );
  const chunks = _.chunk(newRaindrops, 100);

  console.log(new Date(), `Looping through chunks of 100 repos...`);
  for (const chunk of chunks) {
    const existingUrlsRes = await raindropAxios.post("/import/url/exists", {
      urls: chunk.map((s) => s.link),
    });
    const existingUrls = existingUrlsRes.data;
    const toImport = filterNewRaindrops(chunk, existingUrls.duplicates);
    if (toImport.length > 0) {
      await raindropAxios.post("/raindrops", {
        items: toImport,
      });
      console.log(new Date(), `Added ${toImport.length} stars to Raindrop`);
    } else {
      console.log(new Date(), `Skipped chunk (${chunk.length} repos)`);
    }
  }
};
```

- [ ] **Step 4: Run the tests — expect `mapStarToRaindrop` tests to pass**

```bash
npm test
```

Expected: All 6 `mapStarToRaindrop` tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/main.ts src/__tests__/main.unit.test.ts
git commit -m "feat: extract mapStarToRaindrop with unit tests"
```

---

## Task 3: Unit tests for `filterNewRaindrops` (TDD)

**Files:**
- Modify: `src/__tests__/main.unit.test.ts`

- [ ] **Step 1: Replace `src/__tests__/main.unit.test.ts` with the complete file including `filterNewRaindrops` tests**

```typescript
import { describe, it, expect } from 'vitest'
import { mapStarToRaindrop, filterNewRaindrops } from '../main.js'
import type { ActualStar, RaindropItem } from '../main.js'

const makeRepo = (overrides: Partial<{
  full_name: string
  html_url: string
  language: string | null
  topics: string[]
  description: string | null
}> = {}) => ({
  full_name: 'owner/repo',
  html_url: 'https://github.com/owner/repo',
  language: 'TypeScript',
  topics: ['tooling'],
  description: 'A great repo',
  ...overrides,
})

const makeStar = (repoOverrides: Parameters<typeof makeRepo>[0] = {}): ActualStar => ({
  starred_at: '2024-01-01T00:00:00Z',
  repo: makeRepo(repoOverrides),
})

describe('mapStarToRaindrop', () => {
  it('maps all fields correctly', () => {
    const result = mapStarToRaindrop(makeStar(), '12345')
    expect(result).toEqual({
      collectionId: '12345',
      title: 'owner/repo',
      link: 'https://github.com/owner/repo',
      tags: ['github', 'typescript', 'tooling'],
      created: '2024-01-01T00:00:00Z',
      excerpt: 'A great repo',
    })
  })

  it('excludes null language from tags', () => {
    const result = mapStarToRaindrop(makeStar({ language: null }), '12345')
    expect(result.tags).toEqual(['github', 'tooling'])
  })

  it('handles empty topics', () => {
    const result = mapStarToRaindrop(makeStar({ topics: [] }), '12345')
    expect(result.tags).toEqual(['github', 'typescript'])
  })

  it('lowercases all tags', () => {
    const result = mapStarToRaindrop(makeStar({ language: 'TypeScript', topics: ['MyTopic'] }), '12345')
    expect(result.tags).toEqual(['github', 'typescript', 'mytopic'])
  })

  it('produces only github tag when language is null and topics is empty', () => {
    const result = mapStarToRaindrop(makeStar({ language: null, topics: [] }), '12345')
    expect(result.tags).toEqual(['github'])
  })

  it('passes collectionId through', () => {
    expect(mapStarToRaindrop(makeStar(), 'my-collection').collectionId).toBe('my-collection')
    expect(mapStarToRaindrop(makeStar(), undefined).collectionId).toBeUndefined()
  })
})

describe('filterNewRaindrops', () => {
  const item = (link: string): RaindropItem => ({
    collectionId: '1',
    title: 'title',
    link,
    tags: [],
    created: '',
    excerpt: null,
  })

  it('returns all items when duplicates list is empty', () => {
    const chunk = [item('https://a.com'), item('https://b.com')]
    expect(filterNewRaindrops(chunk, [])).toEqual(chunk)
  })

  it('excludes items matching a duplicate link', () => {
    const chunk = [item('https://a.com'), item('https://b.com')]
    const result = filterNewRaindrops(chunk, [{ link: 'https://a.com' }])
    expect(result).toEqual([item('https://b.com')])
  })

  it('returns empty array when all items are duplicates', () => {
    const chunk = [item('https://a.com'), item('https://b.com')]
    const result = filterNewRaindrops(chunk, [
      { link: 'https://a.com' },
      { link: 'https://b.com' },
    ])
    expect(result).toEqual([])
  })

  it('handles partial overlap correctly', () => {
    const chunk = [item('https://a.com'), item('https://b.com'), item('https://c.com')]
    const result = filterNewRaindrops(chunk, [{ link: 'https://b.com' }])
    expect(result).toEqual([item('https://a.com'), item('https://c.com')])
  })
})
```

- [ ] **Step 2: Run the tests — expect all 10 tests to pass**

```bash
npm test
```

Expected: All 10 tests pass (6 `mapStarToRaindrop` + 4 `filterNewRaindrops`). `filterNewRaindrops` is already implemented in Task 2's `src/main.ts` changes.

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/main.unit.test.ts
git commit -m "feat: add filterNewRaindrops unit tests"
```

---

## Task 4: Integration tests for `main()`

**Files:**
- Create: `src/__tests__/main.integration.test.ts`

- [ ] **Step 1: Create `src/__tests__/main.integration.test.ts`**

```typescript
import { vi, describe, it, expect, beforeEach } from 'vitest'

const { mockPost, mockPaginate } = vi.hoisted(() => ({
  mockPost: vi.fn(),
  mockPaginate: vi.fn(),
}))

vi.mock('axios', () => ({
  default: {
    create: () => ({ post: mockPost }),
  },
}))

vi.mock('octokit', () => ({
  Octokit: vi.fn().mockImplementation(() => ({
    paginate: mockPaginate,
    rest: {
      activity: {
        listReposStarredByAuthenticatedUser: {},
      },
    },
  })),
}))

import { main } from '../main.js'

const makeStarResult = (name: string) => ({
  starred_at: '2024-01-01T00:00:00Z',
  repo: {
    full_name: name,
    html_url: `https://github.com/${name}`,
    language: 'TypeScript',
    topics: [],
    description: null,
  },
})

describe('main()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.RAINDROP_COLLECTION_ID = 'test-collection'
    process.env.GH_TOKEN = 'test-gh-token'
    process.env.RAINDROP_TOKEN = 'test-raindrop-token'
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  it('posts all repos when there are no duplicates', async () => {
    const stars = [makeStarResult('owner/repo1'), makeStarResult('owner/repo2')]
    mockPaginate.mockResolvedValue(stars)
    mockPost.mockResolvedValue({ data: { duplicates: [] } })

    await main()

    expect(mockPost).toHaveBeenCalledWith('/import/url/exists', {
      urls: ['https://github.com/owner/repo1', 'https://github.com/owner/repo2'],
    })
    expect(mockPost).toHaveBeenCalledWith('/raindrops', {
      items: expect.arrayContaining([
        expect.objectContaining({ link: 'https://github.com/owner/repo1' }),
        expect.objectContaining({ link: 'https://github.com/owner/repo2' }),
      ]),
    })
  })

  it('does not post to /raindrops when all repos are duplicates', async () => {
    const stars = [makeStarResult('owner/repo1'), makeStarResult('owner/repo2')]
    mockPaginate.mockResolvedValue(stars)
    mockPost.mockResolvedValue({
      data: {
        duplicates: [
          { link: 'https://github.com/owner/repo1' },
          { link: 'https://github.com/owner/repo2' },
        ],
      },
    })

    await main()

    const raindropsCalls = mockPost.mock.calls.filter((c) => c[0] === '/raindrops')
    expect(raindropsCalls).toHaveLength(0)
  })

  it('posts only non-duplicate repos', async () => {
    const stars = [
      makeStarResult('owner/repo1'),
      makeStarResult('owner/repo2'),
      makeStarResult('owner/repo3'),
    ]
    mockPaginate.mockResolvedValue(stars)
    mockPost.mockResolvedValue({
      data: { duplicates: [{ link: 'https://github.com/owner/repo2' }] },
    })

    await main()

    const raindropsCall = mockPost.mock.calls.find((c) => c[0] === '/raindrops')
    expect(raindropsCall![1].items).toHaveLength(2)
    const links = raindropsCall![1].items.map((i: { link: string }) => i.link)
    expect(links).not.toContain('https://github.com/owner/repo2')
  })

  it('splits 150 repos into two chunked POST /raindrops calls', async () => {
    const stars = Array.from({ length: 150 }, (_, i) => makeStarResult(`owner/repo${i}`))
    mockPaginate.mockResolvedValue(stars)
    mockPost.mockResolvedValue({ data: { duplicates: [] } })

    await main()

    const raindropsCalls = mockPost.mock.calls.filter((c) => c[0] === '/raindrops')
    expect(raindropsCalls).toHaveLength(2)
    expect(raindropsCalls[0][1].items).toHaveLength(100)
    expect(raindropsCalls[1][1].items).toHaveLength(50)
  })

  it('makes no Raindrop API calls when there are no starred repos', async () => {
    mockPaginate.mockResolvedValue([])

    await main()

    expect(mockPost).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run all tests**

```bash
npm test
```

Expected: All 15 tests pass (10 unit + 5 integration). If any integration test fails, check that the `vi.hoisted()` block and `vi.mock()` factories are at the top of the file before any imports.

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/main.integration.test.ts
git commit -m "feat: add integration tests for main() with mocked APIs"
```

---

## Task 5: Add CI workflow

**Files:**
- Create: `.github/workflows/test.yml`

- [ ] **Step 1: Create `.github/workflows/test.yml`**

```yaml
name: "Tests"
on:
  push:
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version-file: ".nvmrc"

      - run: npm ci

      - name: Run tests
        run: npm test
```

- [ ] **Step 2: Verify all tests still pass locally**

```bash
npm test
```

Expected: All 15 tests pass.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/test.yml
git commit -m "ci: add test workflow on push and pull_request"
```
