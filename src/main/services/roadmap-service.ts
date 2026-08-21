import type { Profile, AppSettings, Roadmap } from '../../shared/types'
import { completeChatCompletion } from './llm-service'
import { readJSON, writeJSON, ensureDir } from './storage'
import { SETTINGS_FILE, ROADMAP_FILE, DATA_DIR } from '../utils/paths'

interface LLMConfig {
  baseUrl: string
  apiKey: string
  model: string
}

async function getConfig(): Promise<LLMConfig> {
  const settings = await readJSON<AppSettings>(SETTINGS_FILE)
  return {
    baseUrl: settings?.api?.baseUrl || 'http://localhost:11434/v1',
    apiKey: settings?.api?.apiKey || '',
    model: settings?.api?.model || 'llama3',
  }
}

export async function loadRoadmap(): Promise<Roadmap | null> {
  return readJSON<Roadmap>(ROADMAP_FILE)
}

export async function refreshRoadmap(
  profile: Profile | null,
  onPhase: (message: string) => void = () => {},
): Promise<Roadmap | null> {
  if (!profile) return null

  const config = await getConfig()
  if (!config.baseUrl) return null

  const market = profile.targetMarket || profile.location || 'tu país'
  const skillLevelsText = Object.entries(profile.skillLevels || {})
    .map(([skill, level]) => `- ${skill}: ${level}`)
    .join('\n') || 'No especificado'

  let researchedContext = ''
  try {
    const { investigateStream } = await import('./investigate-service')
    const query =
      `tendencias y demanda del mercado laboral para ${profile.title || 'desarrolladores'} en ${market} 2026, ` +
      'certificaciones vigentes y salarios'
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

  const systemPrompt = `Eres un asesor de carrera experto en el mercado laboral de ${market}.
Tu tarea es generar un roadmap profesional adaptativo para ayudar al usuario a colocarse laboralmente en ${market}.

El roadmap debe tener 3 fases:
1. Corto plazo (0-3 meses): Acciones inmediatas para mejorar el perfil y empezar a postularse.
2. Mediano plazo (3-6 meses): Desarrollo de habilidades y estrategia de búsqueda activa.
3. Largo plazo (6-12 meses): Crecimiento profesional y consolidación en el mercado.

Para cada fase, genera entre 3 y 5 acciones concretas y accionables.
Cada acción debe tener un título claro, una descripción específica, y una prioridad (alta, media, baja).

IMPORTANTE: Usa la información de nivel de habilidades del usuario para personalizar las recomendaciones:
- Skills con nivel "Básico": recomienda cursos, certificaciones o práctica para mejorar.
- Skills con nivel "Intermedio": recomienda projectos prácticos o certificaciones para avanzar.
- Skills con nivel "Avanzado": recomienda destacar en el CV, usar como diferenciador, o mentorar.

Devuelve SOLO un JSON válido con esta estructura exacta, sin markdown ni delimitadores:
{
  "phases": [
    {
      "name": "Corto plazo",
      "timeframe": "0-3 meses",
      "actions": [
        {
          "title": "Título de la acción",
          "description": "Descripción concreta y accionable",
          "priority": "alta"
        }
      ]
    },
    {
      "name": "Mediano plazo",
      "timeframe": "3-6 meses",
      "actions": [...]
    },
    {
      "name": "Largo plazo",
      "timeframe": "6-12 meses",
      "actions": [...]
    }
  ]
}`

  const profileSummary = `
## PERFIL DEL USUARIO
- Nombre: ${profile.name}
- Rol/Título: ${profile.title}
- Mercado objetivo: ${market}
- Ubicación actual: ${profile.location}
- Resumen: ${profile.summary || 'No especificado'}
- Nivel de inglés: ${profile.languages?.find(l => l.startsWith('Inglés')) || 'No especificado'}
- Educación: ${profile.education?.map(e => `${e.degree} en ${e.field}`).join(', ') || 'No especificado'}
- Certificaciones: ${profile.certifications?.join(', ') || 'Ninguna'}
- Años de experiencia: ${profile.experience?.[0]?.startDate ? 'Ver perfil' : 'No especificado'}

## HABILIDADES Y NIVELES
${skillLevelsText}

## PROYECTOS
${profile.projects?.map(p => `- ${p.name}: ${p.description}`).join('\n') || 'Ninguno especificado'}
`

  const userMessage = `${profileSummary}${researchedContext}\n\nGenera el roadmap profesional para insertarte en el mercado de ${market} en formato JSON. Usa el CONTEXTO INVESTIGADO (si está disponible) como fuente de datos actualizados sobre demanda, certificaciones y salarios.`

  try {
    const response = await completeChatCompletion(config, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ], undefined, 'roadmap')
    const parsed = JSON.parse(response.trim())
    if (!parsed.phases || !Array.isArray(parsed.phases) || parsed.phases.length === 0) {
      throw new Error('Invalid roadmap structure')
    }
    const roadmap: Roadmap = {
      phases: parsed.phases,
      generatedAt: Date.now(),
      targetMarket: market,
    }
    await ensureDir(DATA_DIR)
    await writeJSON(ROADMAP_FILE, roadmap)
    return roadmap
  } catch {
    return null
  }
}
