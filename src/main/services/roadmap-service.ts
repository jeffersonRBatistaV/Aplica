import path from 'path'
import type { Profile, AppSettings, Roadmap, RoadmapGoal, RoadmapPhase, RoadmapAction, RoadmapGap, JobApplication } from '../../shared/types'
import { completeChatCompletion } from './llm-service'
import { readJSON, writeJSON } from './storage'
import { SETTINGS_FILE } from '../utils/paths'
import { getActiveProfileFiles, ensureParentDir } from './profile-data'

interface LLMConfig {
  baseUrl: string
  apiKey: string
  model: string
  excludeFromTraining?: boolean
}

async function getConfig(): Promise<LLMConfig> {
  const settings = await readJSON<AppSettings>(SETTINGS_FILE)
  return {
    baseUrl: settings?.api?.baseUrl || 'http://localhost:11434/v1',
    apiKey: settings?.api?.apiKey || '',
    model: settings?.api?.model || 'llama3',
    excludeFromTraining: settings?.privacy?.excludeFromTraining,
  }
}

/** El "norte" vive junto al roadmap del perfil, en un archivo propio para sobrevivir a cada regeneración. */
async function goalFile(): Promise<string> {
  const { roadmapFile } = await getActiveProfileFiles()
  return path.join(path.dirname(roadmapFile), 'roadmap-goal.json')
}

export async function loadRoadmapGoal(): Promise<RoadmapGoal | null> {
  return readJSON<RoadmapGoal>(await goalFile())
}

export async function saveRoadmapGoal(goal: Partial<RoadmapGoal>): Promise<RoadmapGoal> {
  const file = await goalFile()
  const prev = (await readJSON<RoadmapGoal>(file)) ?? null
  const merged: RoadmapGoal = {
    targetRole: '',
    horizonMonths: 6,
    why: '',
    ...(prev ?? {}),
    ...goal,
    updatedAt: Date.now(),
  }
  merged.targetRole = String(merged.targetRole || '').slice(0, 300)
  merged.why = String(merged.why || '').slice(0, 1000)
  merged.horizonMonths = Math.min(36, Math.max(1, Math.round(Number(merged.horizonMonths) || 6)))
  await ensureParentDir(file)
  await writeJSON(file, merged)
  return merged
}

export async function loadRoadmap(): Promise<Roadmap | null> {
  const { roadmapFile } = await getActiveProfileFiles()
  const roadmap = await readJSON<Roadmap>(roadmapFile)
  return roadmap ? withIds(roadmap) : null
}

/** Asegura ids estables en cada paso (roadmaps viejos no los tenían). */
function withIds(roadmap: Roadmap): Roadmap {
  return {
    ...roadmap,
    phases: (roadmap.phases ?? []).map((phase, pi) => ({
      ...phase,
      actions: (phase.actions ?? []).map((a, ai) => ({ ...a, id: a.id || `p${pi}a${ai}` })),
    })),
  }
}

/** Marca/desmarca un paso como hecho. */
export async function toggleRoadmapStep(stepId: string, done: boolean): Promise<Roadmap | null> {
  const { roadmapFile } = await getActiveProfileFiles()
  const current = await readJSON<Roadmap>(roadmapFile)
  if (!current) return null
  const roadmap = withIds(current)
  for (const phase of roadmap.phases) {
    for (const action of phase.actions) {
      if (action.id === stepId) {
        action.done = done
        action.doneAt = done ? Date.now() : undefined
      }
    }
  }
  await writeJSON(roadmapFile, roadmap)
  return roadmap
}

function parseJson(raw: string): any {
  const cleaned = raw.replace(/```(?:json)?/gi, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('Respuesta sin JSON')
  return JSON.parse(cleaned.slice(start, end + 1))
}

const PRIORITIES = new Set(['alta', 'media', 'baja'])

function sanitizePhases(raw: unknown): RoadmapPhase[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((p) => p && typeof p === 'object')
    .map((p: any, pi): RoadmapPhase => ({
      name: String(p.name || `Hito ${pi + 1}`),
      timeframe: String(p.timeframe || ''),
      objective: p.objective ? String(p.objective) : undefined,
      successCriteria: p.successCriteria ? String(p.successCriteria) : undefined,
      actions: (Array.isArray(p.actions) ? p.actions : [])
        .filter((a: any) => a && (a.title || a.description))
        .map((a: any, ai: number): RoadmapAction => ({
          id: `p${pi}a${ai}`,
          title: String(a.title || ''),
          description: String(a.description || ''),
          priority: PRIORITIES.has(a.priority) ? a.priority : 'media',
          deliverable: a.deliverable ? String(a.deliverable) : undefined,
        })),
    }))
    .filter((p) => p.actions.length > 0)
}

function sanitizeGaps(raw: unknown): RoadmapGap[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((g: any) => g && g.skill)
    .slice(0, 8)
    .map((g: any) => ({ skill: String(g.skill), current: String(g.current || ''), needed: String(g.needed || '') }))
}

function milestoneCount(months: number): number {
  if (months <= 3) return 3
  if (months <= 9) return 4
  return 5
}

export async function refreshRoadmap(
  profile: Profile | null,
  onPhase: (message: string) => void = () => {},
): Promise<Roadmap | null> {
  if (!profile) return null

  const config = await getConfig()
  if (!config.baseUrl) return null

  const goal = await loadRoadmapGoal()
  const market = goal?.targetMarket || profile.targetMarket || profile.location || 'tu país'
  const target = goal?.targetRole?.trim() || profile.title || 'un mejor empleo en mi área'
  const months = goal?.horizonMonths || 6
  const steps = milestoneCount(months)

  const skillLevelsText = Object.entries(profile.skillLevels || {})
    .map(([skill, level]) => `- ${skill}: ${level}`)
    .join('\n') || 'No especificado'

  // Pasos ya completados en el roadmap anterior: no se repiten, se construye encima.
  const previous = await loadRoadmap().catch(() => null)
  const completed = (previous?.phases ?? [])
    .flatMap((p) => p.actions)
    .filter((a) => a.done)
    .map((a) => `- ${a.title}`)

  // Señales reales de la búsqueda (postulaciones, entrevistas, rechazos).
  let pipelineText = ''
  try {
    const { jobsFile } = await getActiveProfileFiles()
    const jobs = (await readJSON<JobApplication[]>(jobsFile)) ?? []
    const count = (st: string) => jobs.filter((j) => j.status === st).length
    if (jobs.length) {
      const missing = jobs
        .flatMap((j) => j.atsReport?.keywordsMissing ?? [])
        .reduce<Record<string, number>>((acc, k) => ({ ...acc, [k]: (acc[k] ?? 0) + 1 }), {})
      const topMissing = Object.entries(missing).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k]) => k)
      pipelineText = `\n\n## BÚSQUEDA ACTUAL (datos reales de la app)\n- Postulaciones: ${jobs.length - count('draft')} (borradores: ${count('draft')})\n- Entrevistas: ${count('interview')} · Ofertas: ${count('offer')} · Rechazos: ${count('rejected')}\n- Keywords que más le faltan según los análisis ATS: ${topMissing.join(', ') || 'sin datos'}`
    }
  } catch { /* opcional */ }

  let researchedContext = ''
  try {
    onPhase('Investigando qué pide el mercado para tu objetivo…')
    const { investigateStream } = await import('./investigate-service')
    const query = `requisitos, habilidades y certificaciones más pedidos para ${target} en ${market} 2026, y cómo llegar a ese puesto`
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

  const systemPrompt = `Eres un mentor de carrera. Diseñas una RUTA (no una lista de tareas sueltas) que lleva a una persona desde donde está HOY hasta su NORTE: "${target}" en ${market}, en unos ${months} meses.

Cómo pensar la ruta:
1. Compara el perfil actual con lo que exige el norte y detecta las brechas reales (habilidades, experiencia demostrable, idioma, certificaciones, red de contactos, marca personal).
2. Ordena la ruta en ${steps} HITOS secuenciales: cada uno se apoya en el anterior y acerca de forma visible al norte. El último hito termina con la persona postulando/consiguiendo el rol objetivo.
3. Cada hito tiene: un nombre corto y motivador, un plazo (p. ej. "Semanas 1-4", "Mes 2-3") que sume ~${months} meses en total, un "objective" (qué podrá hacer/demostrar al terminarlo) y un "successCriteria" medible ("Sabrás que lo lograste cuando…").
4. Cada hito tiene 3-5 pasos concretos, específicos para ESTA persona (nada genérico como "mejora tu CV"): título, descripción accionable, prioridad (alta/media/baja) y "deliverable" (la evidencia: un repositorio, un certificado, 10 postulaciones enviadas, un post publicado…).
5. Respeta su disponibilidad y restricciones. Usa los niveles de habilidad: Básico → aprender/practicar; Intermedio → proyecto real o certificación; Avanzado → destacarlo y usarlo como diferenciador.
6. No repitas pasos que ya completó; construye encima de ellos.

Devuelve SOLO JSON válido, sin markdown:
{
  "startingPoint": "1-2 frases: dónde está hoy respecto al norte",
  "northStar": "1 frase inspiradora y concreta del destino",
  "gaps": [{ "skill": "…", "current": "nivel/estado actual", "needed": "lo que exige el norte" }],
  "phases": [
    {
      "name": "…",
      "timeframe": "…",
      "objective": "…",
      "successCriteria": "…",
      "actions": [{ "title": "…", "description": "…", "priority": "alta", "deliverable": "…" }]
    }
  ]
}`

  const profileSummary = `
## NORTE (definido por el usuario)
- Rol objetivo: ${target}
- Plazo: ${months} meses
- Mercado: ${market}
- Por qué lo quiere: ${goal?.why || 'No lo indicó'}
- Modalidad deseada: ${goal?.workMode || 'No indicada'}
- Salario objetivo: ${goal?.targetSalary || 'No indicado'}
- Horas por semana disponibles: ${goal?.hoursPerWeek ?? 'No indicado'}
- Restricciones/contexto: ${goal?.constraints || 'Ninguna indicada'}

## PERFIL ACTUAL
- Rol/Título actual: ${profile.title}
- Área: ${profile.area || 'No especificada'}
- Ubicación: ${profile.location}
- Resumen: ${profile.summary || 'No especificado'}
- Idiomas: ${profile.languages?.join(', ') || 'No especificado'}
- Educación: ${profile.education?.map(e => `${e.degree} en ${e.field}`).join(', ') || 'No especificado'}
- Certificaciones: ${profile.certifications?.join(', ') || 'Ninguna'}
- Experiencia: ${profile.experience?.map(e => `${e.position} en ${e.company} (${e.startDate}–${e.endDate || 'actual'})`).join('; ') || 'No especificada'}

## HABILIDADES Y NIVELES
${skillLevelsText}

## PROYECTOS
${profile.projects?.map(p => `- ${p.name}: ${p.description}`).join('\n') || 'Ninguno especificado'}
${completed.length ? `\n## PASOS YA COMPLETADOS\n${completed.join('\n')}` : ''}`

  const userMessage = `${profileSummary}${pipelineText}${researchedContext}\n\nDiseña la ruta hacia el norte en formato JSON.`

  onPhase('Trazando tu ruta…')
  const response = await completeChatCompletion(config, [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ], undefined, 'roadmap', config.excludeFromTraining)

  const parsed = parseJson(response)
  const phases = sanitizePhases(parsed.phases)
  if (phases.length === 0) throw new Error('La IA no devolvió una ruta válida. Intenta regenerar.')

  const roadmap: Roadmap = {
    phases,
    generatedAt: Date.now(),
    targetMarket: market,
    goal: goal ?? undefined,
    startingPoint: parsed.startingPoint ? String(parsed.startingPoint) : undefined,
    northStar: parsed.northStar ? String(parsed.northStar) : target,
    gaps: sanitizeGaps(parsed.gaps),
  }
  const { roadmapFile } = await getActiveProfileFiles()
  await ensureParentDir(roadmapFile)
  await writeJSON(roadmapFile, roadmap)
  return roadmap
}
