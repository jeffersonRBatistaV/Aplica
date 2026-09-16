/**
 * search-providers.ts — Búsqueda web multi-proveedor con fallback y fusión.
 *
 * En modo "auto" se recolectan resultados de TODOS los proveedores disponibles
 * y se fusionan (dedupe por URL) para maximizar candidatos. Se mantiene la
 * opción de fijar un proveedor único.
 *
 * Proveedores gratuitos (sin API key):
 *   DuckDuckGo → Bing (HTML scraping) → SearXNG (JSON API con HTML fallback)
 * Proveedores con API key:
 *   Brave Search → Google Custom Search
 *
 * Se usa un circuit breaker con reset en éxito para no repetir fallos
 * transitorios, y se registra diagnóstico por proveedor.
 */

import type { InvestigateConfig, ProviderDiagnostic } from '../../shared/types'

export interface SearchOptions {
  language?: string
  country?: string
  maxResults?: number
  timeout?: number
}

export interface SearchResult {
  url: string
  title: string
  snippet: string
  provider: string
}

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
]

function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
}

const SSRF_BLOCKED = /^\s*(localhost|127\.0\.0\.1|0\.0\.0\.0|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|192\.168\.\d+\.\d+|::1|\[::1\])/i

function isPrivateUrl(url: string): boolean {
  try {
    const u = new URL(url)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return true
    return SSRF_BLOCKED.test(u.hostname)
  } catch {
    return true
  }
}

// ── Circuit breaker con reset en éxito ──

const FAILURE_TTL_MS = 30 * 1000 // 30 segundos de enfriamiento
const failureCache = new Map<string, number>()

function isCircuitOpen(key: string): boolean {
  const at = failureCache.get(key)
  if (!at) return false
  if (Date.now() - at > FAILURE_TTL_MS) {
    failureCache.delete(key)
    return false
  }
  return true
}

function markFailure(key: string): void {
  failureCache.set(key, Date.now())
}

function markSuccess(key: string): void {
  failureCache.delete(key)
}

// ── Parsing de resultados ──

function decodeBingUrl(href: string): string | null {
  const url = href.replace(/&amp;/g, '&')
  if (!url.includes('/ck/a')) return url
  try {
    const u = new URL(url)
    const enc = (u.searchParams.get('u') || '').replace(/^a1/, '')
    if (enc) {
      const decoded = Buffer.from(enc, 'base64').toString('utf8')
      if (/^https?:\/\//i.test(decoded)) return decoded
    }
  } catch {
    // ignore
  }
  return null
}

function parseSearchResults(html: string, provider: string, maxResults: number): SearchResult[] {
  const results: SearchResult[] = []

  if (provider === 'duckduckgo') {
    const resultRegex = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi
    const snippetRegex = /<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi
    const links: string[] = []
    const titles: string[] = []
    const snippets: string[] = []

    let m: RegExpExecArray | null
    while ((m = resultRegex.exec(html)) !== null && links.length < maxResults) {
      let href = m[1]
      const title = m[2].replace(/<[^>]+>/g, '').trim()
      const u = new URL(href, 'https://duckduckgo.com')
      const uddg = u.searchParams.get('uddg')
      if (uddg) href = uddg
      if (!href.startsWith('http')) continue
      if (isPrivateUrl(href)) continue
      links.push(href)
      titles.push(title)
    }
    while ((m = snippetRegex.exec(html)) !== null && snippets.length < links.length) {
      snippets.push(m[1].replace(/<[^>]+>/g, '').trim())
    }
    for (let i = 0; i < links.length; i++) {
      results.push({
        url: links[i],
        title: titles[i] || '',
        snippet: snippets[i] || '',
        provider: 'duckduckgo',
      })
    }
  } else if (provider === 'bing') {
    const blockRegex = /<li class="b_algo"[\s\S]*?<\/li>/gi
    let m: RegExpExecArray | null
    while ((m = blockRegex.exec(html)) !== null && results.length < maxResults) {
      const block = m[0]
      const anchor = block.match(/<h2[^>]*><a[^>]*href="([^"]+)"[^>]*>[\s\S]*?<\/a>/i)?.[1]
      const title = block.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i)?.[1].replace(/<[^>]+>/g, '').trim()
      const snippet = block.match(/<p[^>]*class="[^"]*b_lineclamp[^"]*"[^>]*>([\s\S]*?)<\/p>/i)?.[1]
        .replace(/<[^>]+>/g, '')
        .trim()

      if (!anchor) continue
      const decoded = decodeBingUrl(anchor)
      if (!decoded || !decoded.startsWith('http')) continue
      if (isPrivateUrl(decoded)) continue

      results.push({
        url: decoded,
        title: title || '',
        snippet: snippet || '',
        provider: 'bing',
      })
    }
  } else if (provider === 'google') {
    const entryRegex = /<div class="[^"]*"[^>]*><a href="\/url\?q=([^&"]+)/gi
    const titleRegex = /<h3[^>]*>([\s\S]*?)<\/h3>/gi
    const snippetRegex = /<span class="[^"]*">([\s\S]*?)<\/span>/gi

    const urls: string[] = []
    let m: RegExpExecArray | null
    while ((m = entryRegex.exec(html)) !== null && urls.length < maxResults) {
      const decoded = decodeURIComponent(m[1])
      if (!decoded.startsWith('http')) continue
      if (isPrivateUrl(decoded)) continue
      urls.push(decoded)
    }
    const titles: string[] = []
    while ((m = titleRegex.exec(html)) !== null && titles.length < urls.length) {
      titles.push(m[1].replace(/<[^>]+>/g, '').trim())
    }
    for (let i = 0; i < urls.length; i++) {
      results.push({
        url: urls[i],
        title: titles[i] || '',
        snippet: '',
        provider: 'google',
      })
    }
  } else if (provider === 'searxng') {
    const entryRegex = /<article[^>]*class="result"[^>]*>[\s\S]*?<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<p[^>]*class="content"[^>]*>([\s\S]*?)<\/p>/gi
    let m: RegExpExecArray | null
    while ((m = entryRegex.exec(html)) !== null && results.length < maxResults) {
      const href = m[1]
      const title = m[2].replace(/<[^>]+>/g, '').trim()
      const snippet = m[3].replace(/<[^>]+>/g, '').trim()
      if (!href.startsWith('http') || isPrivateUrl(href)) continue
      results.push({ url: href, title, snippet, provider: 'searxng' })
    }
  }

  return results
}

// ── DuckDuckGo (gratis, sin API key) ──

async function searchDuckDuckGo(query: string, opts: SearchOptions): Promise<SearchResult[]> {
  const max = opts.maxResults || 8
  // No enviamos kl (región) para evitar las páginas de "anomaly" que DDG
  // devuelve con códigos de región específicos como "es-do".
  const params = new URLSearchParams({ q: query })
  const res = await fetch(`https://html.duckduckgo.com/html/?${params}`, {
    headers: { 'User-Agent': getRandomUserAgent(), Accept: 'text/html', 'Accept-Language': `${opts.language || 'es'},en;q=0.9` },
    signal: AbortSignal.timeout(opts.timeout || 15_000),
  })
  if (!res.ok) throw new Error(`DuckDuckGo HTTP ${res.status}`)
  const html = await res.text()
  return parseSearchResults(html, 'duckduckgo', max)
}

// ── Bing (gratis, sin API key, scraping) ──

async function searchBing(query: string, opts: SearchOptions): Promise<SearchResult[]> {
  const max = opts.maxResults || 8
  const lang = opts.language || 'es'
  const country = (opts.country && opts.country.toUpperCase()) || 'US'
  const params = new URLSearchParams({ q: query, setlang: lang, mkt: `${lang}-${country}`, count: String(max) })
  const res = await fetch(`https://www.bing.com/search?${params}`, {
    headers: {
      'User-Agent': getRandomUserAgent(),
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': `${lang},en;q=0.9`,
    },
    signal: AbortSignal.timeout(opts.timeout || 15_000),
    redirect: 'follow',
  })
  if (!res.ok) throw new Error(`Bing HTTP ${res.status}`)
  const html = await res.text()
  return parseSearchResults(html, 'bing', max)
}

// ── Brave Search API (gratis 2000/mes) ──

async function searchBrave(query: string, opts: SearchOptions, apiKey: string): Promise<SearchResult[]> {
  const max = opts.maxResults || 8
  const params = new URLSearchParams({ q: query, count: String(max), search_lang: opts.language || 'es', country: opts.country || 'ALL' })
  const res = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
    headers: { Accept: 'application/json', 'Accept-Encoding': 'gzip', 'X-Subscription-Token': apiKey },
    signal: AbortSignal.timeout(opts.timeout || 15_000),
  })
  if (!res.ok) throw new Error(`Brave Search HTTP ${res.status}`)
  const data = (await res.json()) as { web?: { results?: Array<{ url: string; title: string; description: string }> } }
  return (data.web?.results || []).map((r) => ({
    url: r.url,
    title: r.title,
    snippet: r.description,
    provider: 'brave',
  }))
}

// ── Google Custom Search API (gratis 100/día) ──

async function searchGoogle(query: string, opts: SearchOptions, apiKey: string, engineId: string): Promise<SearchResult[]> {
  const max = opts.maxResults || 8
  const params = new URLSearchParams({ key: apiKey, cx: engineId, q: query, lr: `lang_${opts.language || 'es'}`, num: String(max) })
  const res = await fetch(`https://www.googleapis.com/customsearch/v1?${params}`, {
    signal: AbortSignal.timeout(opts.timeout || 15_000),
  })
  if (!res.ok) throw new Error(`Google CSE HTTP ${res.status}`)
  const data = (await res.json()) as { items?: Array<{ link: string; title: string; snippet: string }> }
  return (data.items || []).map((r) => ({
    url: r.link,
    title: r.title,
    snippet: r.snippet,
    provider: 'google',
  }))
}

// ── SearXNG (gratis, instancias públicas con fallback HTML) ──

// Instancias fallback estáticas cuando no se puede cargar la lista dinámica
const SEARXNG_FALLBACK_INSTANCES = [
  'https://searx.tiekoetter.com',
  'https://searx.ninja',
  'https://search.ononoki.org',
  'https://searx.work',
  'https://search.sapti.me',
]

// Cache de instancias dinámicas (se actualiza cada 24h)
let dynamicSearxngInstances: string[] = []
let searxngCacheTimestamp = 0
const SEARXNG_CACHE_TTL_MS = 24 * 60 * 60 * 1000

async function loadDynamicSearxngInstances(): Promise<string[]> {
  const now = Date.now()
  if (dynamicSearxngInstances.length > 0 && now - searxngCacheTimestamp < SEARXNG_CACHE_TTL_MS) {
    return dynamicSearxngInstances
  }
  try {
    const res = await fetch('https://searx.space/data/instances.json', {
      signal: AbortSignal.timeout(8_000),
    })
    if (!res.ok) throw new Error(`searx.space HTTP ${res.status}`)
    const data = (await res.json()) as {
      instances?: Record<string, Record<string, unknown>>
    }
    const instances: string[] = []
    if (data.instances) {
      for (const [url, info] of Object.entries(data.instances)) {
        // Solo instancias HTTPS con HTTP grade A o A+
        const httpGrade = (info as Record<string, unknown>)?.http as Record<string, unknown> | undefined
        const tls = (info as Record<string, unknown>)?.tls as Record<string, unknown> | undefined
        const grade = httpGrade?.grade as string | undefined
        const tlsGrade = tls?.grade as string | undefined
        if (url.startsWith('https://') && (grade === 'A' || grade === 'A+' || tlsGrade === 'A' || tlsGrade === 'A+')) {
          instances.push(url.replace(/\/$/, ''))
        }
      }
    }
    if (instances.length > 0) {
      dynamicSearxngInstances = instances.slice(0, 15)
      searxngCacheTimestamp = now
    }
    return dynamicSearxngInstances
  } catch {
    return dynamicSearxngInstances.length > 0 ? dynamicSearxngInstances : []
  }
}

async function searchSearXNG(query: string, opts: SearchOptions): Promise<SearchResult[]> {
  const max = opts.maxResults || 8
  const lang = opts.language || 'es'
  const instanceTimeout = Math.min(opts.timeout || 15_000, 10_000)

  // Cargar instancias: primero dinámicas, fallback estáticas
  let instances = await loadDynamicSearxngInstances()
  if (instances.length === 0) instances = SEARXNG_FALLBACK_INSTANCES

  for (const instance of instances) {
    try {
      const params = new URLSearchParams({
        q: query,
        format: 'json',
        language: lang,
        pageno: '1',
      })
      const res = await fetch(`${instance}/search?${params}`, {
        headers: {
          'User-Agent': getRandomUserAgent(),
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(instanceTimeout),
      })
      if (!res.ok) continue

      // Verificar que el contenido sea JSON antes de parsear
      const ct = res.headers.get('content-type') || ''
      const bodyText = await res.text()
      const isJsonContent = ct.includes('json') || ct.includes('text/plain')
      if (!isJsonContent && bodyText.trimStart().startsWith('<')) {
        // Es HTML (403 anti-bot o JSON deshabilitado). Intentar parseo HTML como fallback
        const htmlResults = parseSearchResults(bodyText, 'searxng', max)
        if (htmlResults.length > 0) return htmlResults
        continue
      }

      const data = JSON.parse(bodyText) as { results?: Array<{ url: string; title: string; content: string }> }
      if (data.results && data.results.length > 0) {
        return data.results.slice(0, max).map((r) => ({
          url: r.url,
          title: r.title,
          snippet: r.content || '',
          provider: 'searxng',
        }))
      }
    } catch {
      continue
    }
  }
  return []
}

// ── Función principal ──

/**
 * searchWeb ejecuta una búsqueda web.
 *
 * En modo "auto": recolecta de TODOS los proveedores gratuitos en paralelo
 * y fusiona los resultados (dedupe por URL) para maximizar candidatos.
 * En modo proveedor fijo: usa solo ese proveedor.
 */
export async function searchWeb(
  query: string,
  opts: SearchOptions,
  config?: Partial<InvestigateConfig>,
): Promise<SearchResult[]> {
  const provider = config?.searchProvider || 'auto'
  const timeout = opts.timeout || config?.searchTimeout || 15_000
  const maxResults = opts.maxResults || config?.maxSearchResults || 8

  const attempt = async (
    key: string,
    fn: () => Promise<SearchResult[]>,
  ): Promise<{ results: SearchResult[]; diagnostic: ProviderDiagnostic }> => {
    if (isCircuitOpen(key)) {
      return { results: [], diagnostic: { provider: key, status: 'skipped', results: 0, error: 'circuit breaker abierto' } }
    }
    try {
      const results = await fn()
      const valid = results.filter((r) => r.url && !isPrivateUrl(r.url))
      markSuccess(key)
      return { results: valid, diagnostic: { provider: key, status: 'ok', results: valid.length } }
    } catch (e) {
      markFailure(key)
      const msg = e instanceof Error ? e.message : String(e)
      console.warn(`[search-providers] ${key} failed:`, msg)
      return { results: [], diagnostic: { provider: key, status: 'failed', results: 0, error: msg } }
    }
  }

  // ── Modo proveedor fijo ──
  if (provider === 'bing') {
    const r = await attempt('bing', () => searchBing(query, { ...opts, maxResults, timeout }))
    return r.results
  }
  if (provider === 'duckduckgo') {
    const r = await attempt('duckduckgo', () => searchDuckDuckGo(query, { ...opts, maxResults, timeout }))
    return r.results
  }
  if (provider === 'searxng') {
    const r = await attempt('searxng', () => searchSearXNG(query, { ...opts, maxResults, timeout }))
    return r.results
  }
  if (provider === 'brave' && config?.braveApiKey) {
    const r = await attempt('brave', () => searchBrave(query, { ...opts, maxResults, timeout }, config.braveApiKey!))
    return r.results
  }
  if (provider === 'google' && config?.googleApiKey && config?.googleSearchEngineId) {
    const r = await attempt('google', () => searchGoogle(query, { ...opts, maxResults, timeout }, config.googleApiKey!, config.googleSearchEngineId!))
    return r.results
  }

  // ── Modo auto: recolectar de todos los proveedores y fusionar ──
  const providers: Array<() => Promise<{ results: SearchResult[]; diagnostic: ProviderDiagnostic }>> = []

  // Proveedores gratuitos (siempre disponibles)
  providers.push(() => attempt('duckduckgo', () => searchDuckDuckGo(query, { ...opts, maxResults, timeout })))
  providers.push(() => attempt('bing', () => searchBing(query, { ...opts, maxResults, timeout })))
  providers.push(() => attempt('searxng', () => searchSearXNG(query, { ...opts, maxResults, timeout })))

  // Proveedores con API key (solo si están configurados)
  if (config?.braveApiKey) {
    providers.push(() => attempt('brave', () => searchBrave(query, { ...opts, maxResults, timeout }, config.braveApiKey!)))
  }
  if (config?.googleApiKey && config?.googleSearchEngineId) {
    providers.push(() => attempt('google', () => searchGoogle(query, { ...opts, maxResults, timeout }, config.googleApiKey!, config.googleSearchEngineId!)))
  }

  // Ejecutar en paralelo para máxima velocidad
  const allResults = await Promise.all(providers.map((fn) => fn()))

  // Fusionar y deduplicar por URL
  const seen = new Set<string>()
  const merged: SearchResult[] = []
  for (const { results } of allResults) {
    for (const r of results) {
      const key = r.url.toLowerCase().replace(/\/+$/, '')
      if (seen.has(key)) continue
      seen.add(key)
      merged.push(r)
    }
  }

  return merged
}

/**
 * Ejecuta búsqueda y devuelve resultados + diagnóstico por proveedor.
 * Usado por el frontend para mostrar el estado de cada proveedor.
 */
export async function searchWebWithDiagnostics(
  query: string,
  opts: SearchOptions,
  config?: Partial<InvestigateConfig>,
): Promise<{ results: SearchResult[]; diagnostics: ProviderDiagnostic[] }> {
  const provider = config?.searchProvider || 'auto'
  const timeout = opts.timeout || config?.searchTimeout || 15_000
  const maxResults = opts.maxResults || config?.maxSearchResults || 8

  const attempt = async (
    key: string,
    fn: () => Promise<SearchResult[]>,
  ): Promise<{ results: SearchResult[]; diagnostic: ProviderDiagnostic }> => {
    if (isCircuitOpen(key)) {
      return { results: [], diagnostic: { provider: key, status: 'skipped', results: 0, error: 'circuit breaker abierto' } }
    }
    try {
      const results = await fn()
      const valid = results.filter((r) => r.url && !isPrivateUrl(r.url))
      markSuccess(key)
      return { results: valid, diagnostic: { provider: key, status: 'ok', results: valid.length } }
    } catch (e) {
      markFailure(key)
      const msg = e instanceof Error ? e.message : String(e)
      return { results: [], diagnostic: { provider: key, status: 'failed', results: 0, error: msg } }
    }
  }

  const diagnostics: ProviderDiagnostic[] = []

  if (provider !== 'auto') {
    const key = provider
    let fn: (() => Promise<SearchResult[]>) | null = null
    if (key === 'bing') fn = () => searchBing(query, { ...opts, maxResults, timeout })
    else if (key === 'duckduckgo') fn = () => searchDuckDuckGo(query, { ...opts, maxResults, timeout })
    else if (key === 'searxng') fn = () => searchSearXNG(query, { ...opts, maxResults, timeout })
    else if (key === 'brave' && config?.braveApiKey) fn = () => searchBrave(query, { ...opts, maxResults, timeout }, config.braveApiKey!)
    else if (key === 'google' && config?.googleApiKey && config?.googleSearchEngineId) fn = () => searchGoogle(query, { ...opts, maxResults, timeout }, config.googleApiKey!, config.googleSearchEngineId!)
    if (fn) {
      const r = await attempt(key, fn)
      diagnostics.push(r.diagnostic)
      return { results: r.results, diagnostics }
    }
    return { results: [], diagnostics: [{ provider: key, status: 'skipped', results: 0, error: 'proveedor no disponible' }] }
  }

  // Auto: todos los proveedores en paralelo
  const allCalls = await Promise.all([
    attempt('duckduckgo', () => searchDuckDuckGo(query, { ...opts, maxResults, timeout })),
    attempt('bing', () => searchBing(query, { ...opts, maxResults, timeout })),
    attempt('searxng', () => searchSearXNG(query, { ...opts, maxResults, timeout })),
    ...(config?.braveApiKey
      ? [attempt('brave', () => searchBrave(query, { ...opts, maxResults, timeout }, config.braveApiKey!))]
      : []),
    ...(config?.googleApiKey && config?.googleSearchEngineId
      ? [attempt('google', () => searchGoogle(query, { ...opts, maxResults, timeout }, config.googleApiKey!, config.googleSearchEngineId!))]
      : []),
  ])

  const seen = new Set<string>()
  const merged: SearchResult[] = []
  for (const { results, diagnostic } of allCalls) {
    diagnostics.push(diagnostic)
    for (const r of results) {
      const key = r.url.toLowerCase().replace(/\/+$/, '')
      if (seen.has(key)) continue
      seen.add(key)
      merged.push(r)
    }
  }

  return { results: merged, diagnostics }
}
