/**
 * Preferencias visuales por equipo (no por perfil): tamaño de texto y opciones avanzadas.
 * Se guardan en localStorage porque son comodidades del usuario de este equipo.
 */

export type FontScale = 'sm' | 'md' | 'lg' | 'xl'

const FONT_SCALE_KEY = 'aplica:fontScale'
const ADVANCED_KEY = 'aplica:showAdvanced'

const FONT_SIZES: Record<FontScale, string> = {
  sm: '14px',
  md: '16px',
  lg: '18px',
  xl: '20px',
}

function safeGet(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return null }
}

function safeSet(key: string, value: string): void {
  try { localStorage.setItem(key, value) } catch { /* almacenamiento no disponible */ }
}

export function getFontScale(): FontScale {
  const v = safeGet(FONT_SCALE_KEY)
  return v === 'sm' || v === 'lg' || v === 'xl' ? v : 'md'
}

/** Tailwind usa rem: cambiar el font-size de <html> escala toda la interfaz. */
export function applyFontScale(scale: FontScale = getFontScale()): void {
  document.documentElement.style.fontSize = FONT_SIZES[scale]
}

export function setFontScale(scale: FontScale): void {
  safeSet(FONT_SCALE_KEY, scale)
  applyFontScale(scale)
}

export function getShowAdvanced(): boolean {
  return safeGet(ADVANCED_KEY) === '1'
}

export function setShowAdvanced(value: boolean): void {
  safeSet(ADVANCED_KEY, value ? '1' : '0')
}
