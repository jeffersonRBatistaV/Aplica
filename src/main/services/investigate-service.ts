/**
 * investigate-service.ts — Cliente del backend de investigación en línea.
 *
 * Llama a la API remota (FastAPI en el VPS: SearXNG + Jina/trafilatura + LLM)
 * para obtener respuestas investigadas y localizadas por país.
 *
 * La configuración (URL + token) vive en AppSettings.investigate.
 */
import type { AppSettings, InvestigateConfig, InvestigateResult } from '../../shared/types'
import { readJSON } from './storage'
import { SETTINGS_FILE } from '../utils/paths'

const DEFAULT_TIMEOUT_MS = 120_000 // el backend investiga: buscar + extraer + sintetizar

/** Lee la config de investigación guardada en settings. */
async function getInvestigateConfig(): Promise<InvestigateConfig> {
  const settings = await readJSON<AppSettings>(SETTINGS_FILE)
  const cfg = settings?.investigate
  if (!cfg?.baseUrl || !cfg?.apiToken) {
    throw new Error('Investigación en línea no configurada. Ve a Ajustes → API.')
  }
  return cfg
}

/**
 * Investiga una consulta en línea, localizada al país del usuario.
 * @param userQuery  consulta libre (ej. "salario promedio de desarrollador react")
 * @param country    código ISO del país (ej. "DO") — se deriva del perfil
 * @param language   código de idioma (ej. "es")
 */
export async function investigate(
  userQuery: string,
  country: string,
  language: string,
): Promise<InvestigateResult> {
  const cfg = await getInvestigateConfig()
  const base = cfg.baseUrl.replace(/\/+$/, '')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)

  try {
    const res = await fetch(`${base}/api/investigate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': cfg.apiToken,
      },
      body: JSON.stringify({ user_query: userQuery, country, language }),
      signal: controller.signal,
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`Backend de investigación respondió ${res.status}: ${body.slice(0, 200)}`)
    }
    return (await res.json()) as InvestigateResult
  } finally {
    clearTimeout(timer)
  }
}

/** Verifica que el backend de investigación responde (health check). */
export async function investigateHealth(): Promise<{ ok: boolean; message: string }> {
  const cfg = await getInvestigateConfig()
  const base = cfg.baseUrl.replace(/\/+$/, '')
  try {
    const res = await fetch(`${base}/api/health`, {
      headers: { 'X-API-Key': cfg.apiToken },
      signal: AbortSignal.timeout(10_000),
    })
    if (res.ok) return { ok: true, message: 'ok' }
    return { ok: false, message: `HTTP ${res.status}` }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) }
  }
}
