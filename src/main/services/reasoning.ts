import { readJSON } from './storage'
import { SETTINGS_FILE } from '../utils/paths'
import type { AppSettings } from '../../shared/types'

/** Modelos que ya rechazaron reasoning_effort en esta sesión (no se reintenta con él). */
const rejected = new Set<string>()

async function getEffort(model: string): Promise<string | undefined> {
  if (rejected.has(model)) return undefined
  const settings = await readJSON<AppSettings>(SETTINGS_FILE).catch(() => null)
  const effort = settings?.api?.reasoningEffort
  return effort && effort !== 'default' ? effort : undefined
}

/**
 * POST a /chat/completions añadiendo `reasoning_effort` si el usuario lo configuró.
 * Si el proveedor responde 400/422 quejándose del parámetro, repite la petición
 * sin él y recuerda el modelo para no volver a enviarlo.
 */
export async function postCompletion(
  url: string,
  headers: Record<string, string>,
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<Response> {
  const model = String(body.model ?? '')
  const effort = await getEffort(model)
  const send = (b: Record<string, unknown>) =>
    fetch(url, { method: 'POST', headers, body: JSON.stringify(b), signal })

  if (!effort) return send(body)

  const response = await send({ ...body, reasoning_effort: effort })
  if (response.ok || (response.status !== 400 && response.status !== 422)) return response

  const text = await response.clone().text().catch(() => '')
  if (!/reasoning|unrecognized|unknown (field|param)|extra (inputs|fields)/i.test(text)) return response

  rejected.add(model)
  return send(body)
}
