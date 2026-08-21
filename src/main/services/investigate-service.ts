/**
 * investigate-service.ts — Cliente del backend de investigación en línea.
 *
 * AUTO-REGISTRO (sin configuración manual):
 *  - La URL por defecto es nuestro servidor (aplica.sslip.io).
 *  - En el primer uso, la app se auto-registra con su device_id (persistente)
 *    + install_code (embebido, rotable) y recibe un token de dispositivo
 *    con cuota diaria. El token se guarda en settings.
 *  - El LLM del chat usa la tool "investigate_web" y decide cuándo investigar.
 */
import { randomUUID } from 'crypto'
import type { AppSettings, InvestigateConfig, InvestigateResult } from '../../shared/types'
import { readJSON, writeJSON } from './storage'
import { SETTINGS_FILE, DATA_DIR } from '../utils/paths'
import { ensureDir } from './storage'

const DEFAULT_TIMEOUT_MS = 120_000 // el backend investiga: buscar + extraer + sintetizar
const STREAM_TIMEOUT_MS = 150_000
const DEFAULT_BASE_URL = 'https://aplica.207.244.232.191.sslip.io'
const INSTALL_CODE = 'aplica-2026-install-v1' // rotable en el backend

/** device_id persistente por instalación (archivo aparte, no se borra con settings). */
async function getDeviceId(): Promise<string> {
  try {
    await ensureDir(DATA_DIR)
    const { readFileSync, writeFileSync, existsSync } = await import('fs')
    const p = `${DATA_DIR}/device-id.txt`
    if (existsSync(p)) {
      const existing = readFileSync(p, 'utf8').trim()
      if (existing) return existing
    }
    const id = randomUUID()
    writeFileSync(p, id, 'utf8')
    return id
  } catch {
    return randomUUID() // fallback: id efímero
  }
}

/**
 * Obtiene la config de investigación; si no hay token, se auto-registra.
 * Sin errores de "configura": la app siempre tiene el backend disponible.
 */
async function getInvestigateConfig(): Promise<InvestigateConfig> {
  const settings = await readJSON<AppSettings>(SETTINGS_FILE)
  const cfg = settings?.investigate
  const baseUrl = cfg?.baseUrl?.trim() || DEFAULT_BASE_URL

  if (cfg?.apiToken) {
    return { baseUrl, apiToken: cfg.apiToken, configured: true }
  }

  // Auto-registro transparente
  try {
    const deviceId = await getDeviceId()
    const res = await fetch(`${baseUrl.replace(/\/+$/, '')}/api/device/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_id: deviceId, install_code: INSTALL_CODE }),
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) {
      throw new Error(`Registro fallido: HTTP ${res.status}`)
    }
    const data = (await res.json()) as { token: string; quota_daily: number }
    const nextSettings: AppSettings = {
      api: settings?.api ?? { baseUrl: '', apiKey: '', model: '', configured: false },
      investigate: { baseUrl, apiToken: data.token, configured: true },
      appearance: settings?.appearance ?? { mode: 'system' },
      privacy: settings?.privacy ?? { storeHistory: true, excludeFromTraining: false },
      systemPrompt: settings?.systemPrompt ?? '',
      locale: settings?.locale ?? 'es',
      ttsVoice: settings?.ttsVoice ?? '',
      preferredCurrency: settings?.preferredCurrency ?? 'USD',
    }
    await writeJSON(SETTINGS_FILE, nextSettings)
    return { baseUrl, apiToken: data.token, configured: true }
  } catch (e) {
    throw new Error(
      `No se pudo conectar con el backend de investigación (${e instanceof Error ? e.message : String(e)}). ` +
        'Verifica tu conexión a internet.',
    )
  }
}

/**
 * Auto-descubrimiento: verifica que el backend por defecto responde y es el nuestro.
 * Usa solo el endpoint público /api/discovery (sin token).
 */
export async function discoverBackend(): Promise<{ baseUrl: string; found: boolean; message: string }> {
  const tryUrls = [DEFAULT_BASE_URL]
  const settings = await readJSON<AppSettings>(SETTINGS_FILE)
  const saved = settings?.investigate?.baseUrl?.trim()
  if (saved && saved !== DEFAULT_BASE_URL) tryUrls.push(saved)

  for (const url of tryUrls) {
    try {
      const res = await fetch(`${url.replace(/\/+$/, '')}/api/discovery`, {
        signal: AbortSignal.timeout(10_000),
      })
      if (!res.ok) continue
      const data = (await res.json()) as { service?: string }
      if (data.service === 'aplica-research') {
        return { baseUrl: url, found: true, message: 'Backend de Aplica encontrado' }
      }
    } catch {
      // intentar siguiente URL
    }
  }
  return { baseUrl: DEFAULT_BASE_URL, found: false, message: 'No se encontró el backend de investigación' }
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

/**
 * Versión en streaming de investigate(): consume el endpoint SSE
 * /api/investigate/stream y notifica cada fase (search/extract/synthesize)
 * en vivo vía callbacks.onPhase. Resuelve con onDone(result) o onError(msg);
 * nunca lanza excepciones hacia el llamador.
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
  const cfg = await getInvestigateConfig()
  const base = cfg.baseUrl.replace(/\/+$/, '')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), STREAM_TIMEOUT_MS)

  try {
    const res = await fetch(`${base}/api/investigate/stream`, {
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
    if (!res.body) throw new Error('Response body is not readable')

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let eventName = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue
        if (trimmed.startsWith('event:')) {
          eventName = trimmed.slice(6).trim()
          continue
        }
        if (!trimmed.startsWith('data:')) continue
        const data = trimmed.slice(5).trim()
        if (!data) continue
        try {
          const parsed = JSON.parse(data)
          if (eventName === 'phase') {
            callbacks.onPhase(String(parsed.phase || ''), String(parsed.message || ''))
          } else if (eventName === 'done') {
            callbacks.onDone(parsed)
            return
          } else if (eventName === 'error') {
            callbacks.onError(String(parsed.message || 'Error desconocido del backend'))
            return
          }
        } catch { /* skip */ }
        eventName = ''
      }
    }
    callbacks.onError('La conexión terminó antes de completar la investigación')
  } catch (e) {
    callbacks.onError(
      controller.signal.aborted
        ? `Tiempo de espera agotado (${STREAM_TIMEOUT_MS / 1000}s)`
        : e instanceof Error ? e.message : String(e),
    )
  } finally {
    clearTimeout(timer)
  }
}

/** Verifica que el backend de investigación responde (health check). */
export async function investigateHealth(): Promise<{ ok: boolean; message: string }> {
  try {
    const cfg = await getInvestigateConfig()
    const base = cfg.baseUrl.replace(/\/+$/, '')
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
