import type { ATSReport, Profile, AppSettings, CvTemplate } from '../../shared/types'
import { completeChatCompletion } from './llm-service'
import { readJSON } from './storage'
import { CV_TEMPLATES_FILE, SETTINGS_FILE } from '../utils/paths'
import { getSeedTemplates } from './cv-templates-seed'

const LANGUAGE_INSTRUCTION = '\n\nIMPORTANTE: Responde SIEMPRE en el MISMO IDIOMA en el que está escrita la vacante. Si la vacante está en inglés, responde en inglés. Si está en español, responde en español. Si está en otro idioma, responde en ese mismo idioma.'

/**
 * La foto (data URL de cientos de KB) no se envía al modelo; en su lugar va la marca
 * `tieneFoto: true` para que la plantilla sepa que debe incluir el token {{FOTO-PERFIL}}.
 * Antes se quitaba sin avisar y el modelo creía que no había foto.
 */
function stripPhoto(profile: Profile): Profile {
  const { photo, ...rest } = profile
  const hasPhoto = typeof photo === 'string' && photo.startsWith('data:image/')
  return (hasPhoto ? { ...rest, tieneFoto: true } : rest) as Profile
}

const PHOTO_INSTRUCTION = `\n\nREGLA DE FOTO DE PERFIL:- Si el perfil del candidato tiene foto (campo "tieneFoto": true), incluye la foto como una etiqueta <img> con src EXACTAMENTE igual a este token: {{FOTO-PERFIL}}. Colócala donde indique el formato de la plantilla; si el formato no la incluye, ponla circular (border-radius: 50%), de 24mm a 30mm de diámetro, a la derecha de la cabecera usando un contenedor flex (nunca float ni position).- El token {{FOTO-PERFIL}} es OBLIGATORIO como valor de src: el sistema lo reemplazará por la foto real del candidato. NUNCA inventes otra URL, uses placeholders tipo [foto], rutas locales ni imágenes de relleno.- Si el perfil NO tiene foto, NO incluyas ninguna etiqueta <img> ni ninguna caja/placeholder de foto en el CV.- NO uses emojis ni texto alternativo inventado: si incluyes alt, usa el nombre real del candidato.`

const LAYOUT_RULES = `

REGLAS ANTI-ALUCINACION (OBLIGATORIAS, tienen PRIORIDAD ABSOLUTA):
1. CERO ALUCINACIONES: Esta estrictamente prohibido inventar, inferir, adivinar o agregar cualquier dato, tecnologia, habilidad, fecha, empresa o cargo que no este explicitamente escrito en el JSON de entrada.
2. PROHIBICION DE RELLENO: Si una tecnologia (ej. Oracle, Docker, etc.), una fecha o una descripcion esta vacia o ausente en el JSON, dejalo en blanco o ignoralo. No asumas nada ni uses "conocimiento general de la industria" para completar el perfil.
3. PROHIBICION DE ADAPTACION A LA VACANTE: La vacante puede pedir tecnologias o habilidades (ej. "experiencia en OBS Studio", "manejo de equipos audiovisuales", "conocimiento de Python") que el candidato NO tiene en su perfil. NUNCA las incluyas en el CV ni las disfraces con frases como "disponible para aprender", "habil para aprender rapidamente", "familiarizado con", "conocimientos basicos de" o similares. Si una habilidad no esta en el JSON del perfil, NO se menciona en el CV, ni siquiera como disposicion a aprenderla. El CV solo refleja lo que el candidato ya sabe y ha hecho.
4. CERO JUSTIFICACIONES: No escribas notas, parentesis, aclaraciones ni meta-comentarios en el CV (ej. "(no tengo experiencia en esto)", "aunque la vacante pida..."). Si no puedes afirmar algo con los datos del perfil, simplemente no lo escribas.

REGLAS DE TIPOGRAFIA Y EXTENSION (respeta los tamaños del formato; estos son los límites):
- Tamaños de un CV real: cuerpo 10pt (nunca menos de 9.5pt), nombre (h1) 20-24pt, titulos de seccion (h2) 10.5-11.5pt, fechas, ciudades y detalles 9-9.5pt.
- El CV ocupa EXACTAMENTE UNA hoja A4. Para que quepa, prioriza lo más relevante para la vacante: máximo 3-4 viñetas en los empleos recientes, 1-2 en los antiguos, y omite empleos muy antiguos o irrelevantes antes que reducir la letra.
- Es un documento impreso, no una página web: sin chips, píldoras, tarjetas redondeadas, sombras, degradados ni fondos de color en bloques de contenido.
- Ancho útil máximo: 190mm (márgenes de 10mm). NADA puede sobresalir horizontalmente.
- PROHIBIDO: width o min-width fijos en mm/px que excedan el ancho disponible, white-space: nowrap, position: absolute, elementos flotantes o tablas de ancho fijo.
- En CADA elemento usa box-sizing: border-box y max-width: 100%.
- En textos largos usa overflow-wrap: anywhere para que las palabras se quiebren y no desborden.
- Si usas tablas: width: 100%; table-layout: fixed.
- No uses paddings internos ni bordes que empujen el contenido fuera de la pagina.`

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

function normalizeTemplateId(style: string): string | undefined {
  if (style.startsWith('custom:')) return style.slice('custom:'.length)
  if (style.startsWith('seed-')) return style
  return undefined
}

async function getTemplatePrompt(style: string): Promise<string | undefined> {
  // Los estilos integrados (ats/moderno/tradicional) usan su plantilla `seed-*`, asi que
  // editar el prompt en el gestor de plantillas tambien les afecta. fallbackStylePrompt queda de respaldo.
  const templateId = normalizeTemplateId(style) ?? `seed-${style}`
  try {
    const templates = await readJSON<CvTemplate[]>(CV_TEMPLATES_FILE)
    const prompt = templates?.find((t) => t.id === templateId)?.prompt
    return prompt && prompt.trim() ? prompt : undefined
  } catch {
    return undefined
  }
}

async function getTemplateExtraPrompt(style: string): Promise<string | undefined> {
  try {
    const templates = await readJSON<CvTemplate[]>(CV_TEMPLATES_FILE)
    if (!templates?.length) return undefined
    const templateId = normalizeTemplateId(style) ?? `seed-${style}`
    return templates.find((t) => t.id === templateId)?.extraPrompt
  } catch {
    return undefined
  }
}

/**
 * Respaldo si cv-templates.json no tiene la plantilla seed: usa el mismo prompt que
 * generan las plantillas predeterminadas (cv-templates-seed.ts), para que no diverjan.
 */
function fallbackStylePrompt(style: string): string {
  const seeds = getSeedTemplates()
  const seed = seeds.find((t) => t.id === `seed-${style}`) ?? seeds.find((t) => t.id === 'seed-ats')
  return (seed?.prompt ?? '') + LANGUAGE_INSTRUCTION
}

export async function generateSummaryOptions(
  vacancyText: string,
  profile: Profile | null,
  atsReport: ATSReport | null,
): Promise<{ id: string; label: string; summary: string }[]> {
  const config = await getConfig()

  const profileSection = profile
    ? `\n\n## PERFIL DEL CANDIDATO\n\`\`\`json\n${JSON.stringify(stripPhoto(profile), null, 2)}\n\`\`\``
    : '\n\n## PERFIL DEL CANDIDATO\nNo hay perfil disponible.'

  const atsSection = atsReport
    ? `\n\n## ANALISIS ATS\nMatch Score: ${atsReport.matchScore}%\nKeywords principales: ${atsReport.keywordsMissing.slice(0, 5).join(', ')}`
    : ''

  const systemPrompt = `Eres un estratega de CVs. Tu tarea es generar 3 opciones de resumen profesional para un candidato, cada una con un enfoque distinto. Cada resumen debe ser de 2-3 lineas, sin emojis.

Genera 3 opciones con estos IDs y enfoques:
1. id="tecnicista" — Enfoque tecnico, destacando herramientas, metodologias y habilidades duras. Ideal para roles operativos o tecnicos.
2. id="ejecutivo" — Enfoque estrategico, destacando liderazgo, vision de negocio y resultados. Ideal para roles de management o direccion.
3. id="creativo" — Enfoque innovador, destacando resolucion de problemas, adaptabilidad y habilidades blandas. Ideal para roles creativos o multidisciplinarios.

Devuelve SOLO un JSON array valido con esta estructura exacta, sin markdown ni delimitadores:
[
  { "id": "tecnicista", "label": "Tecnico", "summary": "..." },
  { "id": "ejecutivo", "label": "Ejecutivo", "summary": "..." },
  { "id": "creativo", "label": "Creativo", "summary": "..." }
]${LANGUAGE_INSTRUCTION}`

  const userMessage = `## VACANTE\n\n${vacancyText}${profileSection}${atsSection}\n\nGenera las 3 opciones de resumen profesional. Devuelve SOLO el JSON array.`

  const response = await completeChatCompletion(config, [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ], undefined, 'summary_options', config.excludeFromTraining)

  try {
    const parsed = JSON.parse(response.trim())
    if (Array.isArray(parsed) && parsed.length === 3) {
      return parsed
    }
    throw new Error('Invalid response format')
  } catch {
    const fallback = [
      { id: 'tecnicista', label: 'Tecnico', summary: 'Profesional con experiencia en el area, orientado a resultados y con capacidad para trabajar en equipo.' },
      { id: 'ejecutivo', label: 'Ejecutivo', summary: 'Profesional con vision estrategica, habilidades de liderazgo y enfoque en el logro de objetivos organizacionales.' },
      { id: 'creativo', label: 'Creativo', summary: 'Profesional versatil con capacidad de adaptacion, pensamiento innovador y orientacion a la resolucion de problemas.' },
    ]
    return fallback
  }
}

export async function generateCV(
  vacancyText: string,
  profile: Profile | null,
  atsReport: ATSReport | null,
  style: string,
  customPrompt?: string,
  chosenSummary?: string,
): Promise<string> {
  const config = await getConfig()
  const templatePrompt = await getTemplatePrompt(style)
  const basePrompt = customPrompt || templatePrompt || fallbackStylePrompt(style)
  const extraPrompt = await getTemplateExtraPrompt(style)
  const prompt = extraPrompt ? `${basePrompt}\n\n## INSTRUCCIONES ADICIONALES DEL USUARIO (OBLIGATORIO aplicarlas SIEMPRE en cada generacion)\n${extraPrompt}` : basePrompt
  const fullPrompt = prompt + LAYOUT_RULES + PHOTO_INSTRUCTION

  const profileSection = profile
    ? `\n\n## PERFIL DEL CANDIDATO\n\`\`\`json\n${JSON.stringify(stripPhoto(profile), null, 2)}\n\`\`\``
    : '\n\n## PERFIL DEL CANDIDATO\nNo hay perfil disponible.'

  const atsSection = atsReport
    ? `\n\n## ANALISIS ATS\nMatch Score: ${atsReport.matchScore}%\nKeywords de la vacante: ${atsReport.keywordsMissing.join(', ')}${atsReport.keywordsPresent.length > 0 ? '\nKeywords que coinciden: ' + atsReport.keywordsPresent.join(', ') : ''}\nAnalisis: ${atsReport.analysis.slice(0, 1500)}`
    : ''

  const summarySection = chosenSummary
    ? `\n\n## RESUMEN PROFESIONAL ELEGIDO POR EL CANDIDATO\n\n${chosenSummary}\n\nEste es el resumen que el candidato quiere usar. Incorporalo como la seccion de resumen/perfil profesional del CV.`
    : ''

  const userMessage = `## VACANTE\n\n${vacancyText}${profileSection}${atsSection}${summarySection}\n\nGenera el CV en HTML siguiendo el formato indicado en las instrucciones. Devuelve SOLO el HTML, sin bloques de codigo ni delimitadores.`

  const response = await completeChatCompletion(config, [
    { role: 'system', content: fullPrompt },
    { role: 'user', content: userMessage },
  ], undefined, 'cv_generate', config.excludeFromTraining)

  return response.trim()
}

export async function regenerateCV(
  currentCv: string,
  style: string,
  vacancyText: string,
  profile: Profile | null,
  atsReport: ATSReport | null,
  instructions: string,
  customPrompt?: string,
): Promise<string> {
  const config = await getConfig()
  const styleLabel = style === 'ats' ? 'ATS-Friendly' : style === 'moderno' ? 'Moderno' : style === 'tradicional' ? 'Tradicional' : 'Personalizado'
  const templatePrompt = await getTemplatePrompt(style)
  const basePrompt = customPrompt || templatePrompt || fallbackStylePrompt(style)
  const extraPrompt = await getTemplateExtraPrompt(style)
  const prompt = extraPrompt ? `${basePrompt}\n\n## INSTRUCCIONES ADICIONALES DEL USUARIO (OBLIGATORIO aplicarlas SIEMPRE en cada generacion)\n${extraPrompt}` : basePrompt
  const fullPrompt = prompt + LAYOUT_RULES + PHOTO_INSTRUCTION

  const profileSection = profile
    ? `\n\n## PERFIL DEL CANDIDATO\n\`\`\`json\n${JSON.stringify(stripPhoto(profile), null, 2)}\n\`\`\``
    : '\n\n## PERFIL DEL CANDIDATO\nNo hay perfil disponible.'

  const atsSection = atsReport
    ? `\n\n## ANALISIS ATS\nMatch Score: ${atsReport.matchScore}%\nKeywords de la vacante: ${atsReport.keywordsMissing.join(', ')}${atsReport.keywordsPresent.length > 0 ? '\nKeywords que coinciden: ' + atsReport.keywordsPresent.join(', ') : ''}\nAnalisis: ${atsReport.analysis.slice(0, 1500)}`
    : ''

  const userMessage = `## VACANTE\n\n${vacancyText}${profileSection}${atsSection}\n\n## CV ACTUAL (formato ${styleLabel})\n\n\`\`\`html\n${currentCv}\n\`\`\`\n\n## INSTRUCCIONES DEL USUARIO\n\n${instructions}\n\nAplica estos cambios al CV de arriba. Manten el mismo estilo, colores y estructura general. Devuelve SOLO el HTML modificado, sin bloques de codigo ni delimitadores.`

  const response = await completeChatCompletion(config, [
    { role: 'system', content: fullPrompt },
    { role: 'user', content: userMessage },
  ], undefined, 'cv_regenerate', config.excludeFromTraining)

  return response.trim()
}

const MOCK_PROFILE = {
  name: 'John Doe',
  title: 'Senior Software Engineer',
  email: 'john.doe@email.com',
  phone: '+1 (555) 123-4567',
  location: 'San Francisco, CA',
  linkedin: 'linkedin.com/in/johndoe',
  summary: 'Senior Software Engineer con 6+ anos de experiencia en desarrollo full-stack, arquitectura cloud y liderazgo de equipos.',
  skills: ['JavaScript', 'TypeScript', 'React', 'Node.js', 'Python', 'AWS', 'Docker', 'GraphQL', 'PostgreSQL'],
  experience: [
    { position: 'TechLead', company: 'ACME Corp', period: 'Ene 2021 — Presente', highlights: ['Migracion de infraestructura legacy a microservicios AWS reduciendo downtime en 40%', 'Diseno e implementacion de arquitectura GraphQL unificando 5 APIs REST, mejora de respuesta en 60%'] },
    { position: 'Senior Developer', company: 'ACME Corp', period: 'Jun 2018 — Dic 2020', highlights: ['Desarrollo de plataforma React/Node.js con 50k+ usuarios activos', 'Optimizacion de queries PostgreSQL reduciendo tiempos de 3s a 200ms'] },
  ],
  education: 'B.S. Computer Science — MIT (2014 — 2018)',
  languages: ['English (Nativo)', 'Espanol (Avanzado)'],
}

export async function generateSampleCv(prompt: string): Promise<string> {
  const config = await getConfig()
  const profileJson = JSON.stringify(MOCK_PROFILE, null, 2)
  const userMessage = `Genera un CV de ejemplo en HTML puro (con estilos inline) usando EXACTAMENTE estos datos del candidato. NO inventes informacion adicional. Devuelve SOLO el HTML, sin bloques de codigo ni delimitadores.

REGLAS ANTI-ALUCINACION (OBLIGATORIAS):
1. CERO ALUCINACIONES: Esta estrictamente prohibido inventar, inferir, adivinar o agregar cualquier dato, tecnologia, habilidad, fecha, empresa o cargo que no este explicitamente escrito en el JSON de entrada.
2. PROHIBICION DE RELLENO: Si una tecnologia, una fecha o una descripcion esta vacia o ausente en el JSON, dejalo en blanco o ignoralo. No asumas nada ni uses "conocimiento general de la industria" para completar el perfil.

## PERFIL DEL CANDIDATO
\`\`\`json
${profileJson}
\`\`\``

  const response = await completeChatCompletion(config, [
    { role: 'system', content: prompt },
    { role: 'user', content: userMessage },
  ], undefined, 'cv_sample', config.excludeFromTraining)

  return response.trim()
}
