import type { LinkedInJob, LinkedInJobDetail } from '../../shared/types'
import { searchWeb } from './search-providers'

const LINKEDIN_SEARCH_ENDPOINT = 'https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search'
const LINKEDIN_DETAIL_ENDPOINT = 'https://www.linkedin.com/jobs-guest/jobs/api/jobPosting'
const MAX_PAGES = 10

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
]

function randomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
}

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', ntilde: 'ñ',
  Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú', Ntilde: 'Ñ',
  uuml: 'ü', Uuml: 'Ü', iexcl: '¡', iquest: '¿', hellip: '…', mdash: '—', ndash: '–', middot: '·',
}

function decodeEntities(input: string): string {
  return input.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity: string) => {
    if (entity[0] === '#') {
      const code = entity[1] === 'x' || entity[1] === 'X'
        ? parseInt(entity.slice(2), 16)
        : parseInt(entity.slice(1), 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : match
    }
    return ENTITIES[entity] ?? ENTITIES[entity.toLowerCase()] ?? match
  })
}

function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim()
}

function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<\/(p|div|li|h[1-6]|tr|ul|ol)>/gi, '\n')
      .replace(/<li[^>]*>/gi, '\n• ')
      .replace(/<br\s*\/?>/gi, '\n'),
  )
    .replace(/<[^>]*>/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

async function fetchHtml(url: string, timeout = 15_000): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': randomUserAgent(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,es;q=0.8',
        'Cache-Control': 'no-cache',
      },
    })
    if (!res.ok) throw new Error(`LinkedIn respondió ${res.status}`)
    return await res.text()
  } finally {
    clearTimeout(timer)
  }
}

function cleanUrl(raw: string): string {
  try {
    const u = new URL(raw)
    return `${u.origin}${u.pathname}`
  } catch {
    return raw.split('?')[0]
  }
}

function parseJobCards(html: string): LinkedInJob[] {
  const jobs: LinkedInJob[] = []
  const blocks = html.split(/<li[\s>]/i).slice(1)
  for (const block of blocks) {
    const idMatch = block.match(/urn:li:jobPosting:(\d+)/)
    const titleMatch = block.match(/base-search-card__title[^>]*>([\s\S]*?)<\/(?:h3|h2|h1|a|div)>/i)
    const companyMatch = block.match(/base-search-card__subtitle[^>]*>([\s\S]*?)<\/(?:h4|h3|h2|a|div)>/i)
    const locationMatch = block.match(/job-search-card__location[^>]*>([\s\S]*?)<\/span>/i)
    const urlMatch = block.match(/base-card__full-link[^>]*href="([^"]+)"/i)
      || block.match(/href="(https:\/\/[a-z.]*linkedin\.com\/jobs\/view\/[^"]+)"/i)
    const timeMatch = block.match(/datetime="([^"]+)"/i)

    const title = titleMatch ? stripTags(titleMatch[1]) : ''
    const url = urlMatch ? cleanUrl(decodeEntities(urlMatch[1])) : ''
    const id = idMatch?.[1] || url.match(/(\d{6,})/)?.[1] || ''
    if (!title || (!id && !url)) continue

    jobs.push({
      id: id || url,
      title,
      company: companyMatch ? stripTags(companyMatch[1]) : '',
      location: locationMatch ? stripTags(locationMatch[1]) : '',
      url: url || (id ? `https://www.linkedin.com/jobs/view/${id}` : ''),
      postedAt: timeMatch?.[1],
      source: 'linkedin',
    })
  }
  return jobs
}

async function searchFallback(keywords: string, location: string, limit: number): Promise<LinkedInJob[]> {
  try {
    const query = `${keywords}${location ? ' ' + location : ''} site:linkedin.com/jobs`
    const results = await searchWeb(query, { maxResults: limit, language: 'es' })
    return results
      .filter((r) => /linkedin\.com\/jobs/i.test(r.url))
      .map((r, i) => {
        const viewMatch = r.url.match(/\/jobs\/view\/([^/?#]+)/)
        return {
          id: viewMatch?.[1]?.match(/(\d{6,})/)?.[1] || `web-${i}`,
          title: r.title.replace(/\s*[|\-–]\s*LinkedIn\s*$/i, '').trim() || r.title,
          company: '',
          location: '',
          url: r.url.split('?')[0],
          source: 'web' as const,
        }
      })
  } catch {
    return []
  }
}

/** Busca vacantes públicas de LinkedIn sin necesidad de iniciar sesión (endpoint guest). */
export async function searchLinkedInJobs(keywords: string, location = '', limit = 25): Promise<LinkedInJob[]> {
  const kw = keywords.trim()
  if (!kw) return []
  const maxItems = Math.min(Math.max(limit, 1), 100)
  const jobs: LinkedInJob[] = []

  try {
    for (let page = 0; page < MAX_PAGES && jobs.length < maxItems; page++) {
      const params = new URLSearchParams({ keywords: kw, start: String(page * 25) })
      if (location.trim()) params.set('location', location.trim())
      const html = await fetchHtml(`${LINKEDIN_SEARCH_ENDPOINT}?${params.toString()}`)
      const pageJobs = parseJobCards(html)
      if (pageJobs.length === 0) break
      for (const job of pageJobs) {
        if (!jobs.some((j) => j.id === job.id)) jobs.push(job)
      }
      if (pageJobs.length < 25) break
    }
  } catch {
    // Sin resultados del endpoint guest: se intenta el fallback de búsqueda web.
  }

  if (jobs.length > 0) return jobs.slice(0, maxItems)
  return searchFallback(kw, location, maxItems)
}

function extractJobId(input: string): string | null {
  const trimmed = input.trim()
  if (/^\d{6,}$/.test(trimmed)) return trimmed
  const viewMatch = trimmed.match(/\/jobs\/view\/([^/?#]+)/i)
  const fromView = viewMatch?.[1]?.match(/(\d{6,})/)?.[1]
  if (fromView) return fromView
  return trimmed.match(/(\d{6,})/)?.[1] ?? null
}

/** Obtiene la descripción completa de una vacante a partir de su id o URL. */
export async function fetchLinkedInJob(input: string): Promise<LinkedInJobDetail | null> {
  const id = extractJobId(input)
  if (!id) return null
  try {
    const html = await fetchHtml(`${LINKEDIN_DETAIL_ENDPOINT}/${id}`)
    const descMatch = html.match(/show-more-less-html__markup[^>]*>([\s\S]*?)<\/div>/i)
    const description = (descMatch ? htmlToText(descMatch[1]) : stripTags(html)).slice(0, 12_000)
    if (!description) return null
    const title = stripTags(html.match(/topcard__title[^>]*>([\s\S]*?)<\//i)?.[1] ?? '')
    const company = stripTags(html.match(/topcard__org-name-link[^>]*>([\s\S]*?)<\//i)?.[1] ?? '')
    const location = stripTags(html.match(/topcard__flavor--bullet[^>]*>([\s\S]*?)<\//i)?.[1] ?? '')
    return {
      description,
      title: title || undefined,
      company: company || undefined,
      location: location || undefined,
    }
  } catch {
    return null
  }
}
