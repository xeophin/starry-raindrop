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
