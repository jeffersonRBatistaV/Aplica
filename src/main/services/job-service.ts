import type { ATSReport, Profile, AppSettings, InterviewQuestion } from '../../shared/types'
import { completeChatCompletion } from './llm-service'
import { readJSON } from './storage'
import { SETTINGS_FILE } from '../utils/paths'

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

const LANGUAGE_INSTRUCTION = `\n\nIMPORTANTE: Responde SIEMPRE en el MISMO IDIOMA en el que está escrita la vacante. Si la vacante está en inglés, responde en inglés. Si está en español, responde en español. Si está en otro idioma, responde en ese mismo idioma.`

const ATS_SYSTEM_PROMPT = `Eres un Reclutador Senior y Especialista ATS (Applicant Tracking System). Tu objetivo es identificar conexiones entre el perfil del candidato y la vacante, incluso cuando no son obvias. Busca skills transferibles, experiencia indirecta, y cualquier punto de contacto que pueda hacer que el candidato sea considerado.

Debes responder ÚNICAMENTE con un objeto JSON válido, sin texto adicional, siguiendo esta estructura exacta:
{
  "matchScore": <número del 0 al 100>,
  "keywordsPresent": ["palabras clave del CV que coinciden con la vacante"],
  "keywordsMissing": ["palabras clave de la vacante que faltan en el CV"],
  "strengths": ["fortalezas del candidato para esta vacante, destacando skills transferibles y experiencia indirecta relevante"],
  "gaps": ["brechas o áreas de mejora, con sugerencias constructivas"],
  "quickFixes": ["acciones rápidas que el candidato puede tomar para mejorar su aplicación, incluyendo formas de reformular experiencia existente"],
  "analysis": "análisis detallado en markdown del match, destacando cómo el perfil del candidato PUEDE ser relevante para la vacante incluso si no es un match perfecto. Incluye recomendaciones específicas para reformular la experiencia.",
  "company": "nombre real de la empresa que publica la vacante, o cadena vacía si no aparece",
  "position": "título real del puesto ofertado, o cadena vacía si no aparece"
}
REGLAS CRÍTICAS para company y position:
- Extrae SOLO datos reales presentes en el texto de la vacante.
- Si la empresa o el puesto no aparecen claramente, usa cadena vacía ("").
- NUNCA uses frases genéricas, placeholders ni encabezados de bolsa de empleo como "Estamos contratando", "We are hiring", "Se busca", "No especificado", "A convenir", "N/A", "Buscamos", etc.${LANGUAGE_INSTRUCTION}`

const COVER_LETTER_SYSTEM_PROMPT = `Eres un Redactor Profesional de Cartas de Presentación especializado en persuasión para reclutadores. Tu objetivo es posicionar al candidato como la mejor opcion para la vacante, incluso si su perfil no es un match perfecto.

ESTRATEGIA:
- Habla directamente al reclutador en tono seguro y profesional
- Reformula la experiencia del candidato usando el lenguaje exacto de la vacante
- Si hay gaps en el perfil, presentalos como areas de interes o aprendizaje activo
- Destaca logros con impacto cuantificable
- Usa vocabulario del anuncio para demostrar alineacion
- El tono debe ser persuasivo pero no arrogante, entusiasta pero profesional
- Cada parrafo debe conectar explicitamente una fortaleza del candidato con una necesidad de la vacante

Basado en el perfil del candidato y el reporte ATS de una vacante, debes generar dos versiones:

1. **Variación A - Cold Email**: Email ultra corto y directo (2-3 párrafos, máximo 150 palabras) para enviar al reclutador. Debe empezar con un "gancho" que capte atencion, luego conectar la experiencia del candidato con los requisitos clave, y terminar con un call-to-action claro. Sin introducciones largas ni frases de relleno.

2. **Variación B - Cover Letter**: Carta de presentación formal y convincente (4-5 párrafos) lista para adjuntar. Debe incluir: apertura con proposito y entusiasmo, 2-3 parrafos destacando logros reformulados para la vacante, cierre con llamado a la accion.

Además, extrae de la vacante el email de contacto del reclutador o empresa (si aparece), y genera un asunto sugerido para el correo.

Debes responder ÚNICAMENTE con un objeto JSON válido, sin texto adicional:
{
  "coverLetterA": "texto completo del cold email en markdown",
  "coverLetterB": "texto completo de la cover letter en markdown",
  "recruiterEmail": "email extraído de la vacante o cadena vacía si no aparece",
  "subject": "asunto sugerido para el correo basado en la vacante y el puesto"
}${LANGUAGE_INSTRUCTION}`

export async function analyzeVacancy(
  vacancyText: string,
  profile: Profile | null,
): Promise<ATSReport> {
  const config = await getConfig()
  const profileSection = profile
    ? `\n\n## PERFIL DEL CANDIDATO\n\`\`\`json\n${JSON.stringify(profile, null, 2)}\n\`\`\``
    : '\n\n## PERFIL DEL CANDIDATO\nNo hay perfil disponible.'

  const userMessage = `## VACANTE\n\n${vacancyText}${profileSection}\n\nGenera el reporte ATS en formato JSON.`

  const response = await completeChatCompletion(config, [
    { role: 'system', content: ATS_SYSTEM_PROMPT },
    { role: 'user', content: userMessage },
  ])

  // Try to parse JSON from response
  const jsonMatch = response.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    return {
      matchScore: 0,
      keywordsPresent: [],
      keywordsMissing: [],
      strengths: [],
      gaps: [],
      quickFixes: [],
      analysis: response,
    }
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]) as ATSReport
    return {
      matchScore: parsed.matchScore ?? 0,
      keywordsPresent: parsed.keywordsPresent ?? [],
      keywordsMissing: parsed.keywordsMissing ?? [],
      strengths: parsed.strengths ?? [],
      gaps: parsed.gaps ?? [],
      quickFixes: parsed.quickFixes ?? [],
      analysis: parsed.analysis ?? response,
      company: typeof parsed.company === 'string' ? parsed.company : '',
      position: typeof parsed.position === 'string' ? parsed.position : '',
    }
  } catch {
    return {
      matchScore: 0,
      keywordsPresent: [],
      keywordsMissing: [],
      strengths: [],
      gaps: [],
      quickFixes: [],
      analysis: response,
    }
  }
}

export async function generateCoverLetters(
  vacancyText: string,
  profile: Profile | null,
  atsReport: ATSReport,
): Promise<{ coverLetterA: string; coverLetterB: string; recruiterEmail: string; subject: string }> {
  const config = await getConfig()
  const profileSection = profile
    ? `\n\n## PERFIL DEL CANDIDATO\n\`\`\`json\n${JSON.stringify(profile, null, 2)}\n\`\`\``
    : '\n\n## PERFIL DEL CANDIDATO\nNo hay perfil disponible.'

  const userMessage = `## VACANTE\n\n${vacancyText}${profileSection}\n\n## REPORTE ATS\n\nMatch Score: ${atsReport.matchScore}%\nFortalezas: ${atsReport.strengths.join(', ')}\nBrechas: ${atsReport.gaps.join(', ')}\nKeywords faltantes: ${atsReport.keywordsMissing.join(', ')}\n\nGenera las dos variaciones de carta en formato JSON.`

  const response = await completeChatCompletion(config, [
    { role: 'system', content: COVER_LETTER_SYSTEM_PROMPT },
    { role: 'user', content: userMessage },
  ])

  // Strip markdown code fences
  let clean = response.replace(/```(?:json)?\n?/gi, '').trim()

  const jsonMatch = clean.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    return { coverLetterA: clean, coverLetterB: clean, recruiterEmail: '', subject: '' }
  }

  let raw = jsonMatch[0]

  // Try direct parse
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const parsed = JSON.parse(raw)
      return {
        coverLetterA: parsed.coverLetterA ?? clean,
        coverLetterB: parsed.coverLetterB ?? clean,
        recruiterEmail: parsed.recruiterEmail ?? '',
        subject: parsed.subject ?? '',
      }
    } catch {
      // Try to fix unescaped newlines inside strings: replace literal \n with \\n
      raw = raw.replace(/:\s*"((?:[^"\\]|\\.)*)"/g, (_m, inner) => {
        const fixed = inner.replace(/\n/g, '\\n').replace(/\t/g, '\\t')
        return `: "${fixed}"`
      })
    }
  }

  // Last resort: extract fields via character-by-character parse
  const extractField = (key: string): string | null => {
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const startMatch = raw.match(new RegExp(`"${escapedKey}"\\s*:\\s*"`))
    if (!startMatch) return null

    const startIdx = startMatch.index! + startMatch[0].length
    let result = ''
    let i = startIdx

    while (i < raw.length) {
      const ch = raw[i]
      if (ch === '\\') {
        result += ch + (raw[i + 1] || '')
        i += 2
      } else if (ch === '"') {
        break
      } else {
        result += ch
        i++
      }
    }

    if (i >= raw.length) return null

    return result.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\t/g, '\t')
  }

  const letterA = extractField('coverLetterA')
  const letterB = extractField('coverLetterB')
  const email = extractField('recruiterEmail')
  const subj = extractField('subject')

  if (letterA || letterB) {
    return {
      coverLetterA: letterA || clean,
      coverLetterB: letterB || clean,
      recruiterEmail: email || '',
      subject: subj || '',
    }
  }

  return { coverLetterA: clean, coverLetterB: clean, recruiterEmail: email || '', subject: subj || '' }
}

const CORRECT_VACANCY_PROMPT = `Eres un corrector de textos experto en limpiar errores de OCR (reconocimiento óptico de caracteres) y erratas en ofertas de empleo.

Corrige el siguiente texto de una oferta de trabajo. Debes:
- Corregir errores de OCR: caracteres malinterpretados (como '0' por 'O', 'l' por '1'), palabras pegadas, saltos de línea incorrectos
- Corregir ortografía, gramática y puntuación
- Mantener exactamente el significado, estructura y formato original
- NO agregues, resumas ni modifiques información
- NO agregues comentarios, prefijos ni sufijos
- Devuelve ÚNICAMENTE el texto corregido, sin delimitadores ni bloques de código${LANGUAGE_INSTRUCTION}`

export async function correctVacancyText(raw: string): Promise<string> {
  const config = await getConfig()

  const response = await completeChatCompletion(config, [
    { role: 'system', content: CORRECT_VACANCY_PROMPT },
    { role: 'user', content: raw },
  ])

  return response.trim()
}

const INTERVIEW_QUESTIONS_PROMPT = `Eres un preparador de entrevistas de trabajo experto. Tu objetivo es ayudar al candidato a prepararse para su entrevista generando preguntas realistas y respuestas personalizadas.

Basado en la vacante, el perfil del candidato y el reporte ATS, genera 15 preguntas de entrevista con sus respuestas adaptadas específicamente al candidato.

Categorías recomendadas (distribuye las preguntas entre ellas):
- Experiencia: preguntas sobre su trayectoria laboral y proyectos
- Técnica: preguntas sobre habilidades técnicas y conocimientos específicos
- Comportamental: preguntas situacionales (método STAR)
- Empresa/Industria: preguntas sobre la empresa y el sector
- Motivación: preguntas sobre expectativas e intereses

Debes responder ÚNICAMENTE con un objeto JSON válido, sin texto adicional, siguiendo esta estructura:
{
  "questions": [
    {
      "question": "texto de la pregunta",
      "answer": "respuesta recomendada adaptada al perfil del candidato",
      "category": "Experiencia | Técnica | Comportamental | Empresa/Industria | Motivación"
    }
  ]
}${LANGUAGE_INSTRUCTION}`

export async function generateInterviewQuestions(
  vacancyText: string,
  profile: Profile | null,
  atsReport: ATSReport | null,
): Promise<InterviewQuestion[]> {
  const config = await getConfig()

  const profileSection = profile
    ? `\n\n## PERFIL DEL CANDIDATO\n\`\`\`json\n${JSON.stringify(profile, null, 2)}\n\`\`\``
    : '\n\n## PERFIL DEL CANDIDATO\nNo hay perfil disponible.'

  const atsSection = atsReport
    ? `\n\n## REPORTE ATS\nMatch Score: ${atsReport.matchScore}%\nFortalezas: ${atsReport.strengths.join(', ')}\nBrechas: ${atsReport.gaps.join(', ')}\nKeywords faltantes: ${atsReport.keywordsMissing.join(', ')}`
    : ''

  const userMessage = `## VACANTE\n\n${vacancyText}${profileSection}${atsSection}\n\nGenera 15 preguntas de entrevista con respuestas personalizadas en formato JSON.`

  const response = await completeChatCompletion(config, [
    { role: 'system', content: INTERVIEW_QUESTIONS_PROMPT },
    { role: 'user', content: userMessage },
  ])

  let clean = response.replace(/```(?:json)?\n?/gi, '').trim()

  const jsonMatch = clean.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return []

  try {
    const parsed = JSON.parse(jsonMatch[0])
    return parsed.questions ?? []
  } catch {
    return []
  }
}
