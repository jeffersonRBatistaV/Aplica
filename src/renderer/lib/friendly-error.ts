import i18n from '../i18n'

/** Sección de Ajustes donde el usuario puede arreglar el problema. */
export type FixTarget = 'api' | 'email' | 'whatsapp'

export interface FriendlyError {
  message: string
  /** Detalle técnico original (para "ver detalles"). */
  technical?: string
  fix?: FixTarget
}

interface Rule {
  test: RegExp
  key: string
  fix?: FixTarget
}

// El orden importa: las reglas más específicas primero.
const RULES: Rule[] = [
  // Correo (SMTP / nodemailer)
  { test: /EAUTH|Invalid login|535[- ]|Username and Password not accepted|BadCredentials|application-specific password/i, key: 'emailAuth', fix: 'email' },
  { test: /ESOCKET|ECONNECTION|smtp/i, key: 'emailConnection', fix: 'email' },
  { test: /No recipients defined|EENVELOPE|invalid.*(recipient|address)/i, key: 'emailRecipient' },
  // WhatsApp
  { test: /WhatsApp no está conectado|not connected.*whatsapp/i, key: 'whatsappDisconnected', fix: 'whatsapp' },
  { test: /no tiene WhatsApp|getNumberId/i, key: 'whatsappNumber' },
  // IA / proveedor
  { test: /\b401\b|unauthorized|invalid[_ ]api[_ ]key|incorrect api key|authentication/i, key: 'apiKey', fix: 'api' },
  { test: /\b402\b|insufficient[_ ]quota|billing|credit|payment required/i, key: 'apiQuota', fix: 'api' },
  { test: /\b429\b|rate[_ ]?limit|too many requests/i, key: 'rateLimit' },
  { test: /model.*(not found|does not exist|not exist)|no such model|\b404\b.*model|model_not_found/i, key: 'model', fix: 'api' },
  { test: /context[_ ]length|maximum context|too many tokens|token limit|prompt is too long/i, key: 'tooLong' },
  { test: /ECONNREFUSED|11434|connect ECONN|socket hang up/i, key: 'aiOffline', fix: 'api' },
  // Red genérica
  { test: /ENOTFOUND|getaddrinfo|EAI_AGAIN|network|Failed to fetch|fetch failed|ERR_INTERNET/i, key: 'network' },
  { test: /timeout|timed out|ETIMEDOUT|tardó demasiado/i, key: 'timeout' },
  { test: /\b5\d\d\b|internal server error|bad gateway|service unavailable/i, key: 'server' },
  // Respuestas inválidas del modelo
  { test: /Unexpected token|JSON|parse/i, key: 'badResponse' },
]

function rawMessage(err: unknown): string {
  if (!err) return ''
  if (typeof err === 'string') return err
  if (err instanceof Error) return err.message
  try { return JSON.stringify(err) } catch { return String(err) }
}

/** Quita el prefijo que Electron añade a los errores de IPC. */
function stripIpcPrefix(msg: string): string {
  return msg.replace(/^Error invoking remote method '[^']+':\s*/i, '').replace(/^Error:\s*/i, '').trim()
}

/**
 * Convierte un error técnico en un mensaje comprensible (es/en) y, si aplica,
 * indica en qué sección de Ajustes se arregla. Si no reconoce el error, lo devuelve limpio.
 */
export function toFriendlyError(err: unknown): FriendlyError {
  const technical = stripIpcPrefix(rawMessage(err))
  if (!technical) return { message: i18n.t('friendlyError.unknown') }
  for (const rule of RULES) {
    if (rule.test.test(technical)) {
      return { message: i18n.t(`friendlyError.${rule.key}`), technical, fix: rule.fix }
    }
  }
  return { message: technical }
}

export function friendlyMessage(err: unknown): string {
  return toFriendlyError(err).message
}

export const OPEN_SETTINGS_EVENT = 'aplica:openSettings'

/** Abre el panel de Ajustes en una pestaña concreta (lo escucha MainLayout). */
export function openSettings(tab: string): void {
  window.dispatchEvent(new CustomEvent(OPEN_SETTINGS_EVENT, { detail: tab }))
}
