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
