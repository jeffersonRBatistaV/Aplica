import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * Diseñador de plantillas sin "prompts": el usuario elige opciones visuales y
 * se construye la descripción para la IA. Quien quiera, puede escribirla a mano.
 */

type Layout = 'single' | 'twoColumn' | 'sidebar'
type Tone = 'minimal' | 'modern' | 'classic' | 'creative'
type Length = 'onePage' | 'twoPages'
type Color = 'blue' | 'gray' | 'green' | 'purple' | 'red' | 'black'

interface DesignChoices {
  layout: Layout
  tone: Tone
  length: Length
  color: Color
  photo: boolean
  icons: boolean
}

const DEFAULTS: DesignChoices = { layout: 'single', tone: 'modern', length: 'onePage', color: 'blue', photo: false, icons: false }

const COLOR_SWATCH: Record<Color, string> = {
  blue: '#1e40af', gray: '#4b5563', green: '#047857', purple: '#6d28d9', red: '#b91c1c', black: '#111827',
}

// La descripción para la IA se escribe siempre en español (el generador ya maneja el idioma del CV).
const LAYOUT_TEXT: Record<Layout, string> = {
  single: 'Diseño de una sola columna, ordenado de arriba hacia abajo.',
  twoColumn: 'Diseño a dos columnas: experiencia a la izquierda y datos, habilidades e idiomas a la derecha.',
  sidebar: 'Barra lateral de color con contacto, habilidades e idiomas; contenido principal a la derecha.',
}
const TONE_TEXT: Record<Tone, string> = {
  minimal: 'Estilo minimalista, mucho espacio en blanco, tipografía sans-serif limpia, sin adornos.',
  modern: 'Estilo moderno y profesional, títulos de sección destacados, tipografía sans-serif.',
  classic: 'Estilo clásico y tradicional, tipografía serif, formato sobrio apto para sectores conservadores.',
  creative: 'Estilo creativo con personalidad, uso más libre del color y jerarquía visual marcada.',
}
const LENGTH_TEXT: Record<Length, string> = {
  onePage: 'Debe caber en una sola página: conciso, viñetas cortas.',
  twoPages: 'Puede ocupar hasta dos páginas si la experiencia lo justifica.',
}
const COLOR_TEXT: Record<Color, string> = {
  blue: 'Color principal azul oscuro (#1e40af).',
  gray: 'Paleta en grises (#4b5563), muy sobria.',
  green: 'Color principal verde (#047857).',
  purple: 'Color principal morado (#6d28d9).',
  red: 'Color principal rojo oscuro (#b91c1c).',
  black: 'Blanco y negro, sin color de acento.',
}

export function buildTemplatePrompt(c: DesignChoices): string {
  return [
    LAYOUT_TEXT[c.layout],
    TONE_TEXT[c.tone],
    LENGTH_TEXT[c.length],
    COLOR_TEXT[c.color],
    c.photo ? 'Incluye la foto de perfil circular en el encabezado usando el marcador {{FOTO-PERFIL}} como src de la imagen.' : 'Sin foto.',
    c.icons ? 'Usa pequeños íconos (emoji o SVG en línea) junto a los datos de contacto y títulos de sección.' : 'Sin íconos.',
    'Compatible con sistemas de selección (ATS): texto real, sin tablas complejas ni texto dentro de imágenes.',
  ].join(' ')
}

interface TemplateDesignerProps {
  value: string
  onChange: (prompt: string) => void
}

export function TemplateDesigner({ value, onChange }: TemplateDesignerProps) {
  const { t } = useTranslation()
  const [choices, setChoices] = useState<DesignChoices>(DEFAULTS)
  const [manual, setManual] = useState(false)

  // Mientras no se escriba a mano, la descripción sigue a las opciones elegidas.
  useEffect(() => {
    if (!manual) onChange(buildTemplatePrompt(choices))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [choices, manual])

  const set = <K extends keyof DesignChoices>(key: K, v: DesignChoices[K]) => setChoices((prev) => ({ ...prev, [key]: v }))

  const chip = (active: boolean, label: string, onClick: () => void, key: string) => (
    <button
      key={key}
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`px-3 py-1.5 text-xs rounded-lg border-2 transition-all ${
        active ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-gray-300'
      }`}
    >
      {label}
    </button>
  )

  const row = (label: string, children: React.ReactNode) => (
    <div>
      <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">{label}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  )

  if (manual) {
    return (
      <div className="space-y-2">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={5}
          placeholder={t('templateDesigner.manualPlaceholder')}
          className="w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-y"
        />
        <button type="button" onClick={() => setManual(false)} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
          {t('templateDesigner.backToOptions')}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {row(t('templateDesigner.layout'), (['single', 'twoColumn', 'sidebar'] as Layout[]).map((v) => chip(choices.layout === v, t(`templateDesigner.layouts.${v}`), () => set('layout', v), v)))}
      {row(t('templateDesigner.tone'), (['minimal', 'modern', 'classic', 'creative'] as Tone[]).map((v) => chip(choices.tone === v, t(`templateDesigner.tones.${v}`), () => set('tone', v), v)))}
      {row(t('templateDesigner.color'), (Object.keys(COLOR_SWATCH) as Color[]).map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => set('color', v)}
          aria-pressed={choices.color === v}
          title={t(`templateDesigner.colors.${v}`)}
          className={`w-7 h-7 rounded-full border-2 transition-all ${choices.color === v ? 'border-blue-500 ring-2 ring-blue-500/30' : 'border-white dark:border-gray-800'}`}
          style={{ backgroundColor: COLOR_SWATCH[v] }}
        />
      )))}
      {row(t('templateDesigner.length'), (['onePage', 'twoPages'] as Length[]).map((v) => chip(choices.length === v, t(`templateDesigner.lengths.${v}`), () => set('length', v), v)))}
      {row(t('templateDesigner.extras'), [
        chip(choices.photo, t('templateDesigner.photo'), () => set('photo', !choices.photo), 'photo'),
        chip(choices.icons, t('templateDesigner.icons'), () => set('icons', !choices.icons), 'icons'),
      ])}
      <button type="button" onClick={() => setManual(true)} className="text-xs text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:underline">
        {t('templateDesigner.writeManually')}
      </button>
    </div>
  )
}
