/**
 * investigate-service.ts — Pipeline de investigación web local.
 *
 * Reemplaza el backend VPS con un pipeline de 3 fases que corre
 * en el proceso principal de Electron (Node.js, sin CORS):
 *
 *   Fase 1: searchWeb() → URLs candidatas (DuckDuckGo → Brave → Google)
 *   Fase 2: extractMultiple() → Markdown limpio (Readability + Turndown)
 *   Fase 3: completeChatCompletion() → Síntesis con LLM y fuentes
 *
 * Interfaz pública compatible: investigateLocal() y investigateLocalSync()
 * mantienen la misma firma que las funciones anteriores para que
 * career-advice, roadmap, job-service y llm-service no necesiten cambios.
 */

import type { AppSettings, InvestigateConfig, InvestigateResult } from '../../shared/types'
import { readJSON } from './storage'
import { SETTINGS_FILE } from '../utils/paths'
import { searchWeb, type SearchResult } from './search-providers'
import { extractMultiple, type ExtractedContent } from './content-extractor'

function getConfig(): Partial<InvestigateConfig> {
  return {} // se leerá de settings dentro de las funciones
}

function buildSynthesisPrompt(query: string, country: string, language: string, context: string): string {
  const langName = language === 'es' ? 'español' : language === 'pt' ? 'portugués' : 'inglés'
  return `Eres un asistente de investigación experto. Sintetiza una respuesta clara y precisa basándote EXCLUSIVAMENTE en las fuentes proporcionadas.

REGLAS ESTRICTAS:
1. Responde en ${langName}.
2. Localiza la información al país ${country} cuando sea relevante.
3. Cita las fuentes usando [1], [2], etc. al lado de cada dato.
4. Si las fuentes no cubren algún aspecto de la consulta, dí explícitamente "No se encontró información específica sobre esto en las fuentes consultadas".
5. NUNCA inventes datos, estadísticas o nombres de empresas.
6. Sé conciso pero completo.

CONSULTA DEL USUARIO: ${query}

FUENTES EXTRAÍDAS:
${context}`
}

/**
 * Pipeline local de investigación con callbacks de fase.
 * Nunca lanza excepciones — notifica errores vía callbacks.onError.
 */
export async function investigateLocal(
  userQuery: string,
  country: string,
  language: string,
  callbacks: {
    onPhase: (phase: string, message: string) => void
    onDone: (result: InvestigateResult) => void
    onError: (message: string) => void
  },
  config?: Partial<InvestigateConfig>,
): Promise<void> {
  try {
    const settings = await readJSON<AppSettings>(SETTINGS_FILE)
    const cfg: Partial<InvestigateConfig> = { ...config, ...settings?.investigate }

    // Fase 1: Búsqueda
    callbacks.onPhase('search', `Buscando "${userQuery}"...`)
    const searchResults = await searchWeb(
      userQuery,
      { language, country, maxResults: cfg.maxSearchResults || 8, timeout: cfg.searchTimeout || 15_000 },
      cfg,
    )

    if (searchResults.length === 0) {
      callbacks.onError('No se encontraron resultados de búsqueda. Verifica tu conexión a internet.')
      return
    }

    // Fase 2: Extracción de las 3 URLs más relevantes
    callbacks.onPhase('extract', `Extrayendo contenido de ${Math.min(3, searchResults.length)} fuentes...`)
    const topUrls = searchResults.slice(0, 3).map((r) => ({ url: r.url, title: r.title }))
    const extracted = await extractMultiple(topUrls, {
      maxChars: cfg.maxExtractChars || 15_000,
      timeout: cfg.extractTimeout || 15_000,
    })

    // Fase 3: Síntesis con LLM
    callbacks.onPhase('synthesize', 'Generando respuesta con IA...')
    const context = extracted
      .filter((e) => e.content && !e.content.startsWith('[Error'))
      .map((e, i) => `## Fuente [${i + 1}]: ${e.title || e.url}\nURL: ${e.url}\n\n${e.content}`)
      .join('\n\n---\n\n')

    if (!context) {
      callbacks.onError('No se pudo extraer contenido útil de las páginas encontradas.')
      return
    }

    // Importar dinámicamente para evitar dependencias circulares
    const { completeChatCompletion } = await import('./llm-service')
    const llmSettings = await readJSON<AppSettings>(SETTINGS_FILE)
    const llmConfig = {
      baseUrl: llmSettings?.api?.baseUrl || 'http://localhost:11434/v1',
      apiKey: llmSettings?.api?.apiKey || '',
      model: llmSettings?.api?.model || 'llama3',
    }

    const prompt = buildSynthesisPrompt(userQuery, country, language, context)
    const response = await completeChatCompletion(
      llmConfig,
      [
        { role: 'system', content: prompt },
        { role: 'user', content: userQuery },
      ],
      undefined,
      'investigate',
      llmSettings?.privacy?.excludeFromTraining || false,
    )

    const result: InvestigateResult = {
      answer: response,
      sources: extracted
        .filter((e) => e.content && !e.content.startsWith('[Error'))
        .map((e) => ({ url: e.url, title: e.title, content: e.content.slice(0, 2000) })),
      used_extracted: extracted.map((e) => ({ url: e.url, provider: e.provider })),
      query: userQuery,
      country,
      language,
    }

    callbacks.onDone(result)
  } catch (e) {
    callbacks.onError(e instanceof Error ? e.message : String(e))
  }
}

/**
 * Versión síncrona (sin streaming de fases) para IPC directo.
 * Retorna el InvestigateResult o null en caso de error.
 */
export async function investigateLocalSync(
  userQuery: string,
  country: string,
  language: string,
  config?: Partial<InvestigateConfig>,
): Promise<InvestigateResult> {
  return new Promise((resolve) => {
    investigateLocal(userQuery, country, language, {
      onPhase: () => {},
      onDone: (result) => resolve(result),
      onError: (msg) => {
        console.error('[investigate] error:', msg)
        resolve({
          answer: `Error en la investigación: ${msg}`,
          sources: [],
          used_extracted: [],
          query: userQuery,
          country,
          language,
        })
      },
    }, config)
  })
}

/**
 * Wrapper compatible con el nombre anterior para callers existentes.
 * Mantiene la interfaz de investigateStream() para career-advice,
 * roadmap, job-service y llm-service.
 */
export async function investigateStream(
  userQuery: string,
  country: string,
  language: string,
  callbacks: {
    onPhase: (phase: string, message: string) => void
    onDone: (result: any) => void
    onError: (message: string) => void
  },
): Promise<void> {
  return investigateLocal(userQuery, country, language, callbacks)
}

/**
 * Wrapper compatible con el nombre anterior (no streaming).
 */
export async function investigate(
  userQuery: string,
  country: string,
  language: string,
): Promise<InvestigateResult> {
  return investigateLocalSync(userQuery, country, language)
}

// Funciones legacy eliminadas — ya no se necesitan:
// discoverBackend(), investigateHealth(), getInvestigateConfig(), getDeviceId()
// Se mantienen como stubs para evitar errores de import en archivos que aún las referencien.

export async function discoverBackend(): Promise<{ baseUrl: string; found: boolean; message: string }> {
  return { baseUrl: 'local', found: true, message: 'Investigación local configurada (sin backend externo)' }
}

export async function investigateHealth(): Promise<{ ok: boolean; message: string }> {
  return { ok: true, message: 'ok (local pipeline)' }
}
