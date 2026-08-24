import type { JobCategory } from '../../shared/types'
import { completeChatCompletion } from './llm-service'
import { readJSON, writeJSON, ensureDir } from './storage'
import { CATEGORIES_FILE, DATA_DIR, SETTINGS_FILE } from '../utils/paths'

interface LLMConfig {
  baseUrl: string
  apiKey: string
  model: string
  excludeFromTraining?: boolean
}

async function getConfig(): Promise<LLMConfig> {
  const settings = await readJSON<{ api?: { baseUrl?: string; apiKey?: string; model?: string }; privacy?: { excludeFromTraining?: boolean } }>(SETTINGS_FILE)
  return {
    baseUrl: settings?.api?.baseUrl || 'http://localhost:11434/v1',
    apiKey: settings?.api?.apiKey || '',
    model: settings?.api?.model || 'llama3',
    excludeFromTraining: settings?.privacy?.excludeFromTraining,
  }
}

const AREA_NAMES: Record<string, string> = {
  tecnologia: 'Tecnología / IT',
  salud: 'Salud / Medicina',
  finanzas: 'Finanzas / Contabilidad',
  educacion: 'Educación / Docencia',
  ventas: 'Ventas / Marketing',
  ingenieria: 'Ingeniería (No IT)',
  legal: 'Legal / Jurídico',
  admin: 'Administrativo / Oficina',
  arte: 'Arte / Diseño',
}

export function areaName(areaId: string): string {
  return AREA_NAMES[areaId] || areaId
}

const SEED_CATEGORIES: JobCategory[] = [
  {
    id: 'seed-sistemas',
    areaId: 'tecnologia',
    name: 'Sistemas / Infraestructura',
    description: 'Administración de servidores, redes y sistemas operativos, virtualización, monitoreo y continuidad operativa de la infraestructura TI.',
    keywords: ['sistemas', 'sysadmin', 'administración de servidores', 'redes', 'windows server', 'linux', 'virtualización', 'vmware', 'monitoreo', 'backup', 'active directory', 'helpdesk nivel 2', 'cableado estructurado', 'soporte técnico'],
    source: 'seed',
    createdAt: 0,
  },
  {
    id: 'seed-ciberseguridad',
    areaId: 'tecnologia',
    name: 'Ciberseguridad',
    description: 'Protección de la información y los activos tecnológicos de la organización: análisis de vulnerabilidades, seguridad de redes, respuesta a incidentes y cumplimiento.',
    keywords: ['ciberseguridad', 'seguridad informática', 'seguridad de redes', 'firewall', 'pentesting', 'análisis de vulnerabilidades', 'SIEM', 'respuesta a incidentes', 'ISO 27001', 'cifrado', 'autenticación', 'seguridad en la nube', 'antivirus / EDR'],
    source: 'seed',
    createdAt: 0,
  },
  {
    id: 'seed-datos',
    areaId: 'tecnologia',
    name: 'Datos / Analítica',
    description: 'Análisis, modelado y visualización de datos para la toma de decisiones: ETL, dashboards, estadística aplicada y modelos de machine learning.',
    keywords: ['análisis de datos', 'data analytics', 'SQL', 'ETL', 'Power BI', 'Tableau', 'python', 'pandas', 'machine learning', 'data science', 'visualización de datos', 'big data', 'modelos predictivos'],
    source: 'seed',
    createdAt: 0,
  },
  {
    id: 'seed-devops',
    areaId: 'tecnologia',
    name: 'DevOps / Cloud',
    description: 'Automatización de despliegues, gestión de infraestructura como código, contenedores y servicios cloud para entregar software de forma continua.',
    keywords: ['devops', 'cloud', 'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'terraform', 'CI/CD', 'jenkins', 'github actions', 'monitoreo', 'linux', 'infraestructura como código'],
    source: 'seed',
    createdAt: 0,
  },
  {
    id: 'seed-qa',
    areaId: 'tecnologia',
    name: 'QA / Testing',
    description: 'Aseguramiento de la calidad de software: diseño de casos de prueba, automatización de pruebas funcionales y de regresión, y gestión de defectos.',
    keywords: ['qa', 'testing', 'pruebas funcionales', 'pruebas de regresión', 'automatización de pruebas', 'selenium', 'cypress', 'postman', 'gestión de defectos', 'jira', 'pruebas manuales', 'api testing'],
    source: 'seed',
    createdAt: 0,
  },
  {
    id: 'seed-soporte',
    areaId: 'tecnologia',
    name: 'Soporte Técnico / Helpdesk',
    description: 'Atención de incidencias y requerimientos de usuarios finales, instalación y configuración de equipos, y administración de tickets.',
    keywords: ['soporte técnico', 'helpdesk', 'service desk', 'mesa de ayuda', 'atención al usuario', 'instalación de software', 'tickets', 'windows', 'office 365', 'hardware', 'gestión de incidencias', 'ITIL'],
    source: 'seed',
    createdAt: 0,
  },
]

async function readAll(): Promise<JobCategory[]> {
  return (await readJSON<JobCategory[]>(CATEGORIES_FILE)) ?? []
}

async function writeAll(categories: JobCategory[]): Promise<void> {
  await ensureDir(DATA_DIR)
  await writeJSON(CATEGORIES_FILE, categories)
}

async function seedIfEmpty(): Promise<void> {
  const existing = await readAll()
  if (existing.length === 0) {
    await writeAll(SEED_CATEGORIES)
  }
}

export async function listCategories(areaId?: string): Promise<JobCategory[]> {
  await seedIfEmpty()
  const all = await readAll()
  return areaId ? all.filter((c) => c.areaId === areaId) : all
}

export async function saveCategory(category: JobCategory): Promise<JobCategory[]> {
  await ensureDir(DATA_DIR)
  const all = await readAll()
  const idx = all.findIndex((c) => c.id === category.id)
  if (idx >= 0) all[idx] = category
  else all.push(category)
  await writeAll(all)
  return all
}

export async function deleteCategory(id: string): Promise<JobCategory[]> {
  const all = await readAll()
  const next = all.filter((c) => c.id !== id)
  await writeAll(next)
  return next
}

const GENERATE_CATEGORIES_PROMPT = `Eres un estratega de empleo experto en el mercado laboral. Tu tarea es proponer categorías de vacante (roles/puestos) que se ofrecen dentro de un área profesional concreta.

Basándote SOLO en el área objetivo indicada, genera entre 8 y 10 categorías de vacante genéricas y representativas de lo que se contrata en esa área: roles habituales, especializaciones y puestos afines.

Reglas:
- Cada categoría debe tener un nombre corto y claro (ej: "Ciberseguridad", "Sistemas / Infraestructura").
- La descripción debe explicar en 1-2 líneas qué hace el rol y en qué consiste.
- keywords: entre 8 y 12 palabras clave típicas de esa vacante (inglesas y/o españolas) que se usarían en una oferta real.
- NO uses el perfil de ningún candidato: las categorías deben valer para cualquier persona que quiera postularse en esa área.
- No repitas categorías obvias y genéricas de otras áreas; céntrate en roles propios del área indicada.

Responde ÚNICAMENTE con un JSON array válido, sin markdown ni delimitadores:
[
  { "name": "...", "description": "...", "keywords": ["...", "..."] }
]`

const FALLBACK_CATEGORIES: Record<string, JobCategory['name'][]> = {
  tecnologia: ['Desarrollo Backend', 'Desarrollo Frontend', 'DevOps / Cloud', 'Ciberseguridad', 'Sistemas / Infraestructura', 'Datos / Analítica', 'QA / Testing', 'Soporte Técnico / Helpdesk'],
  salud: ['Enfermería General', 'Atención Primaria', 'Laboratorio Clínico', 'Administración de Salud', 'Farmacia', 'Imagenología', 'Salud Ocupacional', 'Cuidados Críticos'],
  finanzas: ['Analista Financiero', 'Contabilidad General', 'Auditoría Interna', 'Tesorería', 'Cumplimiento / AML', 'Controller', 'Asesor de Inversiones', 'Banca Corporativa'],
  educacion: ['Docencia Universitaria', 'Docencia Secundaria', 'Diseño Curricular', 'Investigación', 'Administración Educativa', 'Educación Técnica', 'Tutoría / Asesoría Académica', 'E-learning'],
  ventas: ['Ejecutivo de Ventas', 'Account Manager', 'Marketing Digital', 'Ventas Técnicas', 'Business Development', 'Social Media Manager', 'E-commerce', 'SEO / SEM'],
  ingenieria: ['Ingeniería de Proyectos', 'Ingeniería de Producción', 'Control de Calidad', 'Supervisión de Obra', 'Ingeniería de Mantenimiento', 'Diseño Mecánico', 'Ingeniería Ambiental', 'Gestión de Operaciones'],
  legal: ['Derecho Corporativo', 'Derecho Laboral', 'Cumplimiento / Compliance', 'Litigio Civil', 'Derecho Tributario', 'Asesoría Legal', 'Derecho Digital / Tech', 'Notaría / Registro'],
  admin: ['Asistente Administrativo', 'Auxiliar de RRHH', 'Asistente de Gerencia', 'Coordinación Administrativa', 'Servicio al Cliente', 'Facturación / Cobranzas', 'Administración de Oficina', 'Auxiliar Contable'],
  arte: ['Diseño Gráfico', 'Diseño UX / UI', 'Ilustración', 'Motion Graphics', 'Fotografía Comercial', 'Diseño Industrial', 'Arquitectura', 'Animación Digital'],
}

function fallbackFor(areaId: string): JobCategory[] {
  const names = FALLBACK_CATEGORIES[areaId] || FALLBACK_CATEGORIES.tecnologia
  const now = Date.now()
  return names.map((name, i) => ({
    id: `fallback-${areaId}-${i}`,
    areaId,
    name,
    description: `Rol típico que se contrata dentro del área ${areaName(areaId)}.`,
    keywords: [name.toLowerCase(), ...name.toLowerCase().split(' ').slice(0, 3)],
    source: 'ai' as const,
    createdAt: now,
  }))
}

export async function generateCategories(areaId: string): Promise<JobCategory[]> {
  const config = await getConfig()
  const area = areaName(areaId)

  const userMessage = `Área objetivo: ${area}.\n\nGenera el JSON array con las categorías de vacante propuestas para esa área.`

  try {
    const response = await completeChatCompletion(config, [
      { role: 'system', content: GENERATE_CATEGORIES_PROMPT },
      { role: 'user', content: userMessage },
    ], undefined, 'categories', config.excludeFromTraining)
    const clean = response.replace(/```(?:json)?\n?/gi, '').trim()
    const jsonMatch = clean.match(/\[[\s\S]*\]/)
    if (!jsonMatch) return fallbackFor(areaId)
    const parsed = JSON.parse(jsonMatch[0]) as { name?: string; description?: string; keywords?: string[] }[]
    if (!Array.isArray(parsed) || parsed.length === 0) return fallbackFor(areaId)

    const now = Date.now()
    return parsed
      .filter((c) => typeof c?.name === 'string' && c.name.trim())
      .slice(0, 12)
      .map((c) => ({
        id: `ai-${areaId}-${now}-${Math.random().toString(36).slice(2, 7)}`,
        areaId,
        name: c.name.trim(),
        description: (c.description || c.name).trim(),
        keywords: Array.isArray(c.keywords) ? c.keywords.slice(0, 12) : [],
        source: 'ai' as const,
        createdAt: now,
      }))
  } catch {
    return fallbackFor(areaId)
  }
}
