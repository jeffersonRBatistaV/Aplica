/**
 * content-extractor.ts — Extracción de contenido web y conversión a Markdown.
 *
 * Fase 2 del pipeline de investigación local:
 *   fetch(url) → Readability (contenido principal) → Turndown (HTML → Markdown)
 *
 * Cascada: Readability → extracción raw con Turndown.
 * SSRF filter incluido.
 */

import { Readability } from '@mozilla/readability'
import TurndownService from 'turndown'
import { gfm } from 'turndown-plugin-gfm'
import { JSDOM } from 'jsdom'

export interface ExtractedContent {
  url: string
  title: string
  content: string
  provider: 'readability' | 'raw'
  charCount: number
}

export interface ExtractOptions {
  maxChars?: number
  timeout?: number
}

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

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

function createTurndown(): TurndownService {
  const td = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
    emDelimiter: '*',
  })
  td.use(gfm)
  // Eliminar scripts, estilos, nav, footer, header
  td.remove(['script', 'style', 'noscript', 'iframe', 'svg', 'nav', 'footer', 'header'])
  return td
}

function extractWithReadability(html: string, url: string): { title: string; content: string } | null {
  try {
    const dom = new JSDOM(html, { url })
    const reader = new Readability(dom.window.document as unknown as Document, {
      charThreshold: 100,
      keepClasses: false,
    })
    const article = reader.parse()
    if (!article || !article.content || article.content.length < 100) return null
    return { title: article.title || '', content: article.content }
  } catch {
    return null
  }
}

function extractRaw(html: string): { title: string; content: string } {
  const dom = new JSDOM(html)
  const title = dom.window.document.querySelector('title')?.textContent?.trim() || ''
  const td = createTurndown()
  const content = td.turndown(html)
  return { title, content }
}

/**
 * Extrae contenido legible de una URL.
 * Cascada: Readability → raw Turndown.
 */
export async function extractContent(url: string, opts?: ExtractOptions): Promise<ExtractedContent> {
  const maxChars = opts?.maxChars || 15_000
  const timeout = opts?.timeout || 15_000

  if (isPrivateUrl(url)) {
    throw new Error(`URL bloqueada (dirección privada): ${url}`)
  }

  const res = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'es,en;q=0.9',
    },
    signal: AbortSignal.timeout(timeout),
    redirect: 'follow',
  })

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} al extraer ${url}`)
  }

  const contentType = res.headers.get('content-type') || ''
  if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
    throw new Error(`Contenido no HTML (${contentType}) para ${url}`)
  }

  const html = await res.text()

  // Intentar Readability primero
  const readability = extractWithReadability(html, url)
  if (readability && readability.content.length > 200) {
    const td = createTurndown()
    const markdown = td.turndown(readability.content).slice(0, maxChars)
    return {
      url,
      title: readability.title,
      content: markdown,
      provider: 'readability',
      charCount: markdown.length,
    }
  }

  // Fallback: extracción raw
  const raw = extractRaw(html)
  const td = createTurndown()
  const markdown = (raw.content || '').slice(0, maxChars)
  return {
    url,
    title: raw.title,
    content: markdown,
    provider: 'raw',
    charCount: markdown.length,
  }
}

/**
 * Extrae contenido de múltiples URLs en paralelo.
 */
export async function extractMultiple(
  urls: { url: string; title?: string }[],
  opts?: ExtractOptions,
): Promise<ExtractedContent[]> {
  return Promise.all(
    urls.map(async (item) => {
      try {
        return await extractContent(item.url, opts)
      } catch (e) {
        return {
          url: item.url,
          title: item.title || '',
          content: `[Error al extraer: ${e instanceof Error ? e.message : String(e)}]`,
          provider: 'raw' as const,
          charCount: 0,
        }
      }
    }),
  )
}
