import type { Profile, AppSettings } from '../../shared/types'
import { completeChatCompletion } from './llm-service'
import { readJSON, writeJSON, ensureDir } from './storage'
import { SETTINGS_FILE, CAREER_ADVICE_FILE, DATA_DIR } from '../utils/paths'

interface LLMConfig {
  baseUrl: string
  apiKey: string
  model: string
}

export interface CareerAdvice {
  diagnostico: string
  areaMejora: string
  planAccion: string
}

async function getConfig(): Promise<LLMConfig> {
  const settings = await readJSON<AppSettings>(SETTINGS_FILE)
  return {
    baseUrl: settings?.api?.baseUrl || 'http://localhost:11434/v1',
    apiKey: settings?.api?.apiKey || '',
    model: settings?.api?.model || 'llama3',
  }
}

function extractCountry(location: string): string {
  if (!location) return 'tu país'
  const lower = location.trim()
  const countryKeywords: Record<string, string[]> = {
    'República Dominicana': ['republica dominicana', 'rd', 'dominican republic', 'santo domingo', 'santiago'],
    'México': ['mexico', 'méxico', 'cdmx', 'ciudad de mexico'],
    'Argentina': ['argentina', 'buenos aires'],
    'Colombia': ['colombia', 'bogota', 'medellin'],
    'Chile': ['chile', 'santiago de chile'],
    'Perú': ['peru', 'perú', 'lima'],
    'España': ['espana', 'españa', 'madrid', 'barcelona'],
    'Estados Unidos': ['united states', 'usa', 'eeuu', 'new york', 'miami', 'california'],
  }
  for (const [country, keywords] of Object.entries(countryKeywords)) {
    for (const kw of keywords) {
      if (lower.includes(kw)) return country
    }
  }
  const parts = lower.split(',').map(p => p.trim())
  return parts[parts.length - 1] || 'tu país'
}

export async function loadCareerAdvice(): Promise<CareerAdvice | null> {
  return readJSON<CareerAdvice>(CAREER_ADVICE_FILE)
}

export async function refreshCareerAdvice(
  profile: Profile | null,
  onPhase: (message: string) => void = () => {},
): Promise<CareerAdvice | null> {
  if (!profile) return null

  const config = await getConfig()
  if (!config.baseUrl) return null

  const country = profile.country || extractCountry(profile.location)
  const area = profile.area || profile.title || 'profesionales'

  let researchedContext = ''
  try {
    const { investigateStream } = await import('./investigate-service')
    const query =
      `salarios promedio, demanda y tendencias del mercado laboral para ${area} en ${country} 2026`
    const result = await new Promise<any | null>((resolve) => {
      investigateStream(query, profile.country || 'DO', 'es', {
        onPhase: (_phase, message) => onPhase(`[investigación] ${message}`),
        onDone: (r) => resolve(r),
        onError: () => resolve(null),
      })
    })
    if (result?.answer) {
      researchedContext = `\n\n## CONTEXTO INVESTIGADO (fuentes en línea)\n${result.answer}`
    }
  } catch {
    onPhase('[investigación] No se pudo investigar en línea; continuando sin contexto web.')
  }

  const systemPrompt = `Eres un asesor de carrera experto en el mercado laboral de ${country}.
Tu tarea es analizar el perfil del usuario y darle consejos accionables y especificos para mejorar su empleabilidad en ${country}.

Devuelve SOLO un JSON valido con esta estructura exacta, sin markdown ni delimitadores:
{
  "diagnostico": "Analisis de las fortalezas del perfil basado en sus habilidades, experiencia y formacion.",
  "areaMejora": "Que skills/certificaciones le faltan, que aspectos del perfil son debiles para el mercado de ${country}.",
  "planAccion": "Pasos concretos y recomendaciones para mejorar su perfil y aumentar sus oportunidades laborales en ${country}."
}`

  const userMessage = `## PERFIL DEL USUARIO\n\`\`\`json\n${JSON.stringify(profile, null, 2)}\n\`\`\`${researchedContext}\n\nGenera los consejos de carrera para ${country} en formato JSON. Usa el CONTEXTO INVESTIGADO (si está disponible) como fuente de datos actualizados sobre salarios, demanda y tendencias.`

  try {
    const response = await completeChatCompletion(config, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ], undefined, 'career_advice')
    const parsed: CareerAdvice = JSON.parse(response.trim())
    if (!parsed.diagnostico || !parsed.areaMejora || !parsed.planAccion) {
      throw new Error('Missing fields')
    }
    await ensureDir(DATA_DIR)
    await writeJSON(CAREER_ADVICE_FILE, parsed)
    return parsed
  } catch {
    return null
  }
}
