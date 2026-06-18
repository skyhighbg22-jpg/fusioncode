// ============================================================
// FusionCode — Web Tools
// web_fetch / web_search
// ============================================================

import type { Tool } from '../types/index.js'
import { error, ok, runTool, truncate } from './util.js'

const FETCH_TIMEOUT = 15_000
const SEARCH_TIMEOUT = 10_000
const MAX_FETCH_CHARS = 8_000

interface DuckDuckGoResponse {
  Abstract: string
  RelatedTopics: Array<{ Text?: string; FirstURL?: string }>
}

export const webFetchTool: Tool = {
  name: 'web_fetch',
  description: 'Fetch a URL and return text content (HTML tags stripped).',
  parameters: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'URL to fetch' },
    },
    required: ['url'],
  },
  async execute(args) {
    return runTool(async () => {
      const url = String(args.url ?? '').trim()
      if (!url) return error('No URL provided.')

      const response = await fetch(url, {
        headers: { 'User-Agent': 'FusionCode/0.1.0' },
        signal: AbortSignal.timeout(FETCH_TIMEOUT),
      })
      if (!response.ok) {
        return error(`HTTP ${response.status} ${response.statusText} for ${url}`)
      }
      // Slice first, then strip — avoids regex-processing a multi-MB body.
      const text = (await response.text()).slice(0, MAX_FETCH_CHARS * 4)
      const stripped = text
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, MAX_FETCH_CHARS)
      return ok(stripped || '(empty response)')
    })
  },
}

export const webSearchTool: Tool = {
  name: 'web_search',
  description: 'Search the web using DuckDuckGo and return results.',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query' },
    },
    required: ['query'],
  },
  async execute(args) {
    return runTool(async () => {
      const q = encodeURIComponent(String(args.query ?? '').trim())
      if (!q) return error('No query provided.')

      const url = `https://api.duckduckgo.com/?q=${q}&format=json&no_redirect=1&no_html=1`
      const response = await fetch(url, { signal: AbortSignal.timeout(SEARCH_TIMEOUT) })
      if (!response.ok) {
        return error(`Search failed: HTTP ${response.status} ${response.statusText}`)
      }
      const data = (await response.json()) as DuckDuckGoResponse

      const results = [
        data.Abstract,
        ...(data.RelatedTopics ?? [])
          .slice(0, 5)
          .filter((t) => t.Text && t.FirstURL)
          .map((t) => `${t.Text} - ${t.FirstURL}`),
      ]
        .filter(Boolean)
        .join('\n')

      return ok(truncate(results || '(no results)'))
    })
  },
}
