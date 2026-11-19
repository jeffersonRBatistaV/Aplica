import type { Profile } from '../../shared/types'

/**
 * Copia del perfil apta para enviar al LLM: quita la foto (data URL base64,
 * cientos de KB = ~100k+ tokens por petición) y cualquier otro campo de imagen embebida.
 */
export function profileForPrompt(profile: Profile): Omit<Profile, 'photo'> & { tieneFoto?: boolean } {
  const { photo, ...rest } = profile
  const out: Record<string, unknown> = { ...rest }
  for (const [k, v] of Object.entries(out)) {
    if (typeof v === 'string' && v.startsWith('data:')) delete out[k]
  }
  if (typeof photo === 'string' && photo.length > 0) out.tieneFoto = true
  return out as Omit<Profile, 'photo'> & { tieneFoto?: boolean }
}
