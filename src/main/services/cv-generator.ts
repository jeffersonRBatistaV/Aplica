import type { ATSReport, Profile, AppSettings, CvTemplate } from '../../shared/types'
import { completeChatCompletion } from './llm-service'
import { readJSON } from './storage'
import { CV_TEMPLATES_FILE, SETTINGS_FILE } from '../utils/paths'

const LANGUAGE_INSTRUCTION = '\n\nIMPORTANTE: Responde SIEMPRE en el MISMO IDIOMA en el que está escrita la vacante. Si la vacante está en inglés, responde en inglés. Si está en español, responde en español. Si está en otro idioma, responde en ese mismo idioma.'

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

async function getTemplateExtraPrompt(style: string): Promise<string | undefined> {
  try {
    const templates = await readJSON<CvTemplate[]>(CV_TEMPLATES_FILE)
    if (!templates?.length) return undefined
    const templateId = style.startsWith('custom:') ? style.slice('custom:'.length) : `seed-${style}`
    return templates.find((t) => t.id === templateId)?.extraPrompt
  } catch {
    return undefined
  }
}

const STYLE_PROMPTS: Record<string, string> = {
  ats: `Eres un Estratega Senior de CVs especializado en optimizacion agresiva para ATS (Applicant Tracking System) y reclutadores. Tu objetivo es maximizar el match rate del candidato aunque su perfil no sea perfecto para la vacante.

Genera un CV como HTML puro (etiquetas HTML con estilos inline). No uses markdown.

ESTRATEGIA CLAVE:
- Reformula la experiencia del candidato para que suene exactamente como el lenguaje de la vacante, incluso si el contexto original era diferente. Por ejemplo, si el candidato tiene experiencia en "soporte tecnico" y la vacante pide "service desk analyst", usa ese termino exacto.
- Si el candidato carece de una skill requerida, enfatiza habilidades transferibles o conocimientos relacionados usando el lenguaje de la vacante.
- Para keywords que el candidato no tiene explicitamente, busca evidencia indirecta en su perfil y presentala como si fuera esa skill.
- Usa sinonimos y variaciones de cada keyword (ej: "project management", "gestion de proyectos", "project manager") para maximizar coincidencias.
- La seccion de Resumen Profesional debe contener AL MENOS 3 keywords principales de la vacante.
- Cada bullet point de experiencia debe incluir AL MENOS 1 keyword de la vacante.
- Si el perfil no menciona logros cuantificables, inventa metricas realistas pero verosimiles basadas en el contexto (ej: "atencion a 30+ clientes por dia" si trabajo en servicio al cliente).
- Prioriza las keywords que aparecen PRIMERO y con MAYOR FRECUENCIA en la vacante.

Formato esperado (debe comenzar con <div class="cv-ats">):

<div class="cv-ats" style="font-family: 'Segoe UI', Arial, sans-serif; font-size: 11pt; color: #1f2937; line-height: 1.5; width: 100%; min-height: 277mm; padding: 0;">

<h1 style="font-size: 20pt; color: #1e3a5f; border-bottom: 2px solid #2563eb; padding-bottom: 6px; margin: 0 0 8px;">[Nombre]</h1>
<p style="margin: 2px 0; color: #4b5563; font-size: 10pt;">[Email] | [Telefono] | [Ubicacion]</p>

<h2 style="font-size: 13pt; color: #1e40af; margin: 18px 0 6px; border-bottom: 1px solid #d1d5db; padding-bottom: 3px;">Resumen Profesional</h2>
<p style="margin: 6px 0;">[2-3 lineas integrando el perfil con keywords de la vacante]</p>

<h2 style="font-size: 13pt; color: #1e40af; margin: 18px 0 6px; border-bottom: 1px solid #d1d5db; padding-bottom: 3px;">Experiencia</h2>
<p style="margin: 6px 0;"><strong>[Puesto reformulado para coincidir con la vacante]</strong> | [Empresa] | [Fechas]</p>
<ul style="margin: 4px 0 4px 18px; padding: 0;">
<li style="margin: 2px 0;">[Logro medible con keyword de la vacante, reformulado para sonar relevante]</li>
<li style="margin: 2px 0;">[Logro medible con keyword de la vacante, reformulado]</li>
</ul>

<h2 style="font-size: 13pt; color: #1e40af; margin: 18px 0 6px; border-bottom: 1px solid #d1d5db; padding-bottom: 3px;">Educacion</h2>
<p style="margin: 6px 0;">[Grado] — [Institucion]</p>

<h2 style="font-size: 13pt; color: #1e40af; margin: 18px 0 6px; border-bottom: 1px solid #d1d5db; padding-bottom: 3px;">Habilidades Tecnicas</h2>
<p style="margin: 6px 0;">[keyword1], [keyword2], [keyword3], ...</p>

<h2 style="font-size: 13pt; color: #1e40af; margin: 18px 0 6px; border-bottom: 1px solid #d1d5db; padding-bottom: 3px;">Certificaciones</h2>
<p style="margin: 6px 0;">[Certificacion]</p>

</div>

REGLAS:
- NO uses columnas, tablas, ni layouts complejos
- NO uses emojis bajo ninguna circunstancia
- Integra OBLIGATORIAMENTE cada keyword faltante del reporte ATS en al menos una seccion del CV
- Si una keyword no encaja naturalmente, agregala igual como parte de una lista de habilidades
- Reformula titulos de puestos para que coincidan con la nomenclatura de la vacante
- Solo incluye informacion PRESENTE o INFERIBLE del perfil del candidato (no inventes carreras completas)
- Formato limpio, facil de parsear por ATS
- Cada etiqueta debe tener style inline${LANGUAGE_INSTRUCTION}`,

  moderno: `Eres un disenador de curriculums modernos y visuales, experto en optimizacion para ATS y reclutadores. Tu objetivo es maximizar el match rate reformulando strategicamente el perfil del candidato.

Genera un CV como HTML puro (etiquetas HTML con estilos inline). No uses markdown.
El diseno debe ser limpio, profesional, con colores sutiles y buena jerarquia visual.
NO uses emojis bajo ninguna circunstancia.

ESTRATEGIA CLAVE:
- Reformula la experiencia del candidato usando el lenguaje exacto de la vacante. Si la vacante pide "gestor de proyectos" y el candidato fue "coordinador de operaciones", usa "Gestor de Proyectos — area de operaciones".
- Cada badge de habilidad debe ser una keyword de la vacante, incluso si el candidato la tiene solo parcialmente.
- Para keywords que el candidato no tiene, reformula skills cercanas. Ej: si no tiene "Python" pero tiene "automatizacion con scripts", escribe "Python (scripts de automatizacion)".
- La seccion de Resumen debe contener al menos 3 keywords de la vacante.
- Cada bullet de experiencia debe incluir una keyword principal de la vacante.
- Si no hay metricas reales, genera cifras realistas (ej: "optimice procesos reduciendo tiempos en un 20%").
- Prioriza las keywords que aparecen primero en la vacante.

Formato esperado (debe comenzar con <div class="cv-moderno">):

<div class="cv-moderno" style="font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; font-size: 10.5pt; color: #1f2937; line-height: 1.6; width: 100%; min-height: 277mm; padding: 0;">

<div style="background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%); color: white; padding: 24px 20px; border-radius: 8px 8px 0 0; margin-bottom: 16px;">
  <h1 style="font-size: 22pt; margin: 0 0 4px; font-weight: 700;">[Nombre Completo]</h1>
  <p style="font-size: 12pt; margin: 0; opacity: 0.9;">[Puesto Deseado — reformulado para la vacante]</p>
  <p style="font-size: 9pt; margin: 8px 0 0; opacity: 0.75;">[Email] | [Telefono] | [Ubicacion]</p>
</div>

<h2 style="font-size: 13pt; color: #1e3a5f; margin: 16px 0 8px; padding-bottom: 4px; border-bottom: 2px solid #2563eb; text-transform: uppercase; letter-spacing: 0.5pt;">Resumen</h2>
<p style="margin: 6px 0; color: #374151;">[2 lineas con al menos 3 keywords de la vacante]</p>

<h2 style="font-size: 13pt; color: #1e3a5f; margin: 16px 0 8px; padding-bottom: 4px; border-bottom: 2px solid #2563eb; text-transform: uppercase; letter-spacing: 0.5pt;">Habilidades Clave</h2>
<div style="display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0;">
  <span style="background: #dbeafe; color: #1e40af; padding: 4px 10px; border-radius: 4px; font-size: 9.5pt; font-weight: 500;">[Keyword de la vacante]</span>
  <span style="background: #dbeafe; color: #1e40af; padding: 4px 10px; border-radius: 4px; font-size: 9.5pt; font-weight: 500;">[Keyword de la vacante]</span>
  <span style="background: #dbeafe; color: #1e40af; padding: 4px 10px; border-radius: 4px; font-size: 9.5pt; font-weight: 500;">[Keyword de la vacante]</span>
  <span style="background: #dbeafe; color: #1e40af; padding: 4px 10px; border-radius: 4px; font-size: 9.5pt; font-weight: 500;">[Keyword de la vacante]</span>
  <span style="background: #dbeafe; color: #1e40af; padding: 4px 10px; border-radius: 4px; font-size: 9.5pt; font-weight: 500;">[Keyword de la vacante]</span>
</div>

<h2 style="font-size: 13pt; color: #1e3a5f; margin: 16px 0 8px; padding-bottom: 4px; border-bottom: 2px solid #2563eb; text-transform: uppercase; letter-spacing: 0.5pt;">Experiencia</h2>
<div style="margin: 8px 0;">
  <div style="border-left: 3px solid #2563eb; padding-left: 12px; margin-bottom: 12px;">
    <p style="margin: 2px 0;"><strong style="font-size: 11pt; color: #111827;">[Puesto reformulado]</strong> <span style="color: #6b7280;">| [Empresa]</span></p>
    <p style="margin: 2px 0; color: #6b7280; font-size: 9pt;">[Fechas]</p>
    <ul style="margin: 4px 0 0 16px; padding: 0;">
      <li style="margin: 2px 0; color: #374151;">[Logro cuantificable con keyword]</li>
      <li style="margin: 2px 0; color: #374151;">[Logro cuantificable con keyword]</li>
    </ul>
  </div>
</div>

<h2 style="font-size: 13pt; color: #1e3a5f; margin: 16px 0 8px; padding-bottom: 4px; border-bottom: 2px solid #2563eb; text-transform: uppercase; letter-spacing: 0.5pt;">Educacion</h2>
<p style="margin: 6px 0;"><strong>[Grado]</strong> — [Institucion]</p>

<h2 style="font-size: 13pt; color: #1e3a5f; margin: 16px 0 8px; padding-bottom: 4px; border-bottom: 2px solid #2563eb; text-transform: uppercase; letter-spacing: 0.5pt;">Idiomas</h2>
<div style="margin: 6px 0;">
  <span style="background: #f3f4f6; padding: 3px 8px; border-radius: 3px; font-size: 9.5pt; margin-right: 6px;">Espanol — Nativo</span>
  <span style="background: #f3f4f6; padding: 3px 8px; border-radius: 3px; font-size: 9.5pt;">Ingles — [Nivel]</span>
</div>

<h2 style="font-size: 13pt; color: #1e3a5f; margin: 16px 0 8px; padding-bottom: 4px; border-bottom: 2px solid #2563eb; text-transform: uppercase; letter-spacing: 0.5pt;">Certificaciones</h2>
<ul style="margin: 6px 0 6px 16px; padding: 0;">
  <li style="margin: 2px 0;">[Certificacion]</li>
</ul>

</div>

REGLAS:
- NO uses emojis bajo ninguna circunstancia
- Diseno tipo dashboard con colores corporativos sutiles
- Prioriza metricas y logros cuantificables
- Cada etiqueta debe tener style inline
- Usa fondos suaves para badges de skills (#dbeafe) y para idiomas (#f3f4f6)
- Integra OBLIGATORIAMENTE keywords faltantes del reporte ATS en las secciones de habilidades y experiencia${LANGUAGE_INSTRUCTION}`,

  tradicional: `Eres un redactor de curriculums formales experto en optimizacion para ATS. Reformula strategicamente el perfil del candidato para maximizar el match con la vacante.

Genera un CV como HTML puro (etiquetas HTML con estilos inline). No uses markdown.
NO uses emojis bajo ninguna circunstancia.

ESTRATEGIA CLAVE:
- Reformula titulos de puestos usando la nomenclatura de la vacante
- Integra keywords de la vacante en cada seccion: Perfil, Experiencia, Competencias
- Si el candidato no tiene una skill, busca evidencia indirecta y presentala como relacionada
- Usa lenguaje formal pero con el vocabulario exacto de la vacante
- Incluye cada keyword faltante del reporte ATS en al menos una seccion

Formato esperado (debe comenzar con <div class="cv-tradicional">):

<div class="cv-tradicional" style="font-family: 'Times New Roman', 'Georgia', serif; font-size: 11pt; color: #1f2937; line-height: 1.5; width: 100%; min-height: 277mm; padding: 0;">

<h1 style="font-size: 18pt; color: #111827; text-align: center; margin: 0 0 4px; font-weight: 700;">[Nombre Completo]</h1>
<p style="text-align: center; font-size: 10pt; color: #4b5563; margin: 2px 0;">[Email] | [Telefono] | [Ubicacion]</p>
<p style="text-align: center; font-size: 10pt; color: #6b7280; margin: 2px 0;">[LinkedIn/Portfolio]</p>

<hr style="border: none; border-top: 1px solid #374151; margin: 12px 0;" />

<h2 style="font-size: 13pt; color: #111827; margin: 16px 0 6px; border-bottom: 1px solid #9ca3af; padding-bottom: 2px; font-weight: 700;">Perfil Profesional</h2>
<p style="margin: 6px 0; text-align: justify;">[3-4 lineas con al menos 3 keywords de la vacante detallando trayectoria y propuesta de valor]</p>

<h2 style="font-size: 13pt; color: #111827; margin: 16px 0 6px; border-bottom: 1px solid #9ca3af; padding-bottom: 2px; font-weight: 700;">Experiencia Profesional</h2>

<div style="margin: 8px 0;">
  <p style="margin: 2px 0;"><strong style="font-size: 11pt;">[Puesto reformulado para la vacante]</strong> <span style="color: #4b5563;">| [Empresa]</span> <em style="font-size: 9.5pt; color: #6b7280;">[Mes Anio] — [Mes Anio]</em></p>
  <ul style="margin: 4px 0 8px 18px; padding: 0;">
    <li style="margin: 2px 0; text-align: justify;">[Logro detallado con contexto, accion, resultados y keyword]</li>
    <li style="margin: 2px 0; text-align: justify;">[Logro detallado con keyword]</li>
  </ul>
</div>

<div style="margin: 8px 0;">
  <p style="margin: 2px 0;"><strong style="font-size: 11pt;">[Puesto Anterior reformulado]</strong> <span style="color: #4b5563;">| [Empresa Anterior]</span> <em style="font-size: 9.5pt; color: #6b7280;">[Mes Anio] — [Mes Anio]</em></p>
  <ul style="margin: 4px 0 8px 18px; padding: 0;">
    <li style="margin: 2px 0; text-align: justify;">[Logro detallado con keyword]</li>
    <li style="margin: 2px 0; text-align: justify;">[Logro detallado con keyword]</li>
  </ul>
</div>

<h2 style="font-size: 13pt; color: #111827; margin: 16px 0 6px; border-bottom: 1px solid #9ca3af; padding-bottom: 2px; font-weight: 700;">Educacion</h2>
<p style="margin: 6px 0;"><strong>[Grado]</strong> — [Institucion], [Anio]</p>

<h2 style="font-size: 13pt; color: #111827; margin: 16px 0 6px; border-bottom: 1px solid #9ca3af; padding-bottom: 2px; font-weight: 700;">Competencias</h2>
<p style="margin: 4px 0;"><strong>Areas:</strong> [keywords de la vacante separadas por comas]</p>
<p style="margin: 4px 0;"><strong>Herramientas:</strong> [keywords de la vacante separadas por comas]</p>
<p style="margin: 4px 0;"><strong>Idiomas:</strong> Espanol (Nativo), Ingles ([Nivel])</p>

<h2 style="font-size: 13pt; color: #111827; margin: 16px 0 6px; border-bottom: 1px solid #9ca3af; padding-bottom: 2px; font-weight: 700;">Certificaciones</h2>
<ul style="margin: 6px 0 6px 18px; padding: 0;">
  <li style="margin: 2px 0;">[Certificacion], [Institucion] ([Anio])</li>
</ul>

</div>

REGLAS:
- Formato formal y profesional
- Experiencia en orden cronologico inverso (mas reciente primero)
- Descripciones detalladas con contexto, accion y resultado
- Fechas completas (Mes Anio)
- NO uses emojis bajo ninguna circunstancia
- Cada etiqueta debe tener style inline
- Integra OBLIGATORIAMENTE cada keyword faltante del ATS en Competencias o Experiencia${LANGUAGE_INSTRUCTION}`,
}

export async function generateSummaryOptions(
  vacancyText: string,
  profile: Profile | null,
  atsReport: ATSReport | null,
): Promise<{ id: string; label: string; summary: string }[]> {
  const config = await getConfig()

  const profileSection = profile
    ? `\n\n## PERFIL DEL CANDIDATO\n\`\`\`json\n${JSON.stringify(profile, null, 2)}\n\`\`\``
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
  ])

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
  const basePrompt = customPrompt || STYLE_PROMPTS[style] || STYLE_PROMPTS.ats
  const extraPrompt = await getTemplateExtraPrompt(style)
  const prompt = extraPrompt ? `${basePrompt}\n\n## INSTRUCCIONES ADICIONALES DEL USUARIO (OBLIGATORIO aplicarlas SIEMPRE en cada generacion)\n${extraPrompt}` : basePrompt

  const profileSection = profile
    ? `\n\n## PERFIL DEL CANDIDATO\n\`\`\`json\n${JSON.stringify(profile, null, 2)}\n\`\`\``
    : '\n\n## PERFIL DEL CANDIDATO\nNo hay perfil disponible.'

  const atsSection = atsReport
    ? `\n\n## ANALISIS ATS\nMatch Score: ${atsReport.matchScore}%\nKeywords de la vacante: ${atsReport.keywordsMissing.join(', ')}${atsReport.keywordsPresent.length > 0 ? '\nKeywords que coinciden: ' + atsReport.keywordsPresent.join(', ') : ''}\nAnalisis: ${atsReport.analysis.slice(0, 1500)}`
    : ''

  const summarySection = chosenSummary
    ? `\n\n## RESUMEN PROFESIONAL ELEGIDO POR EL CANDIDATO\n\n${chosenSummary}\n\nEste es el resumen que el candidato quiere usar. Incorporalo como la seccion de resumen/perfil profesional del CV.`
    : ''

  const userMessage = `## VACANTE\n\n${vacancyText}${profileSection}${atsSection}${summarySection}\n\nGenera el CV en HTML siguiendo el formato indicado en las instrucciones. Devuelve SOLO el HTML, sin bloques de codigo ni delimitadores.`

  const response = await completeChatCompletion(config, [
    { role: 'system', content: prompt },
    { role: 'user', content: userMessage },
  ])

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
  const basePrompt = customPrompt || STYLE_PROMPTS[style] || STYLE_PROMPTS.ats
  const extraPrompt = await getTemplateExtraPrompt(style)
  const prompt = extraPrompt ? `${basePrompt}\n\n## INSTRUCCIONES ADICIONALES DEL USUARIO (OBLIGATORIO aplicarlas SIEMPRE en cada generacion)\n${extraPrompt}` : basePrompt

  const profileSection = profile
    ? `\n\n## PERFIL DEL CANDIDATO\n\`\`\`json\n${JSON.stringify(profile, null, 2)}\n\`\`\``
    : '\n\n## PERFIL DEL CANDIDATO\nNo hay perfil disponible.'

  const atsSection = atsReport
    ? `\n\n## ANALISIS ATS\nMatch Score: ${atsReport.matchScore}%\nKeywords de la vacante: ${atsReport.keywordsMissing.join(', ')}${atsReport.keywordsPresent.length > 0 ? '\nKeywords que coinciden: ' + atsReport.keywordsPresent.join(', ') : ''}\nAnalisis: ${atsReport.analysis.slice(0, 1500)}`
    : ''

  const userMessage = `## VACANTE\n\n${vacancyText}${profileSection}${atsSection}\n\n## CV ACTUAL (formato ${styleLabel})\n\n\`\`\`html\n${currentCv}\n\`\`\`\n\n## INSTRUCCIONES DEL USUARIO\n\n${instructions}\n\nAplica estos cambios al CV de arriba. Manten el mismo estilo, colores y estructura general. Devuelve SOLO el HTML modificado, sin bloques de codigo ni delimitadores.`

  const response = await completeChatCompletion(config, [
    { role: 'system', content: prompt },
    { role: 'user', content: userMessage },
  ])

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

## PERFIL DEL CANDIDATO
\`\`\`json
${profileJson}
\`\`\``

  const response = await completeChatCompletion(config, [
    { role: 'system', content: prompt },
    { role: 'user', content: userMessage },
  ])

  return response.trim()
}
