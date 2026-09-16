import type { ATSReport, Profile, AppSettings, InterviewQuestion } from '../../shared/types'
import { completeChatCompletion } from './llm-service'
import { readJSON } from './storage'
import { SETTINGS_FILE } from '../utils/paths'

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
  "company": "nombre real y específico de la empresa que publica la vacante, o cadena vacía si no aparece explícitamente",
  "position": "título real y específico del puesto ofertado, o cadena vacía si no aparece explícitamente"
}
REGLAS CRÍTICAS para company y position:
- Extrae SOLO datos reales y específicos presentes en el texto de la vacante.
- La empresa debe ser un nombre propio real (ej: "Google", "Mercado Libre", "Banco Santander"), NO una frase descriptiva.
- El puesto debe ser un título de cargo real (ej: "Desarrollador Frontend Senior", "Gerente de Marketing"), NO una oración completa.
- Si la empresa o el puesto no aparecen claramente como nombre propio o título de cargo, usa cadena vacía ("").
- NUNCA uses: la primera oración del texto como empresa, frases genéricas como "Estamos contratando", "Se busca profesional", "Empresa del sector tecnológico", placeholders ni encabezados de bolsa de empleo.
- NUNCA extraigas texto descriptivo o narrativo como nombre de empresa o puesto.
- Si el texto dice "Buscamos desarrollador para equipo de innovación en Google", la empresa es "Google" y el puesto es "Desarrollador". NO uses "Buscamos desarrollador para equipo de innovación" como puesto.${LANGUAGE_INSTRUCTION}`

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

REGLAS DE FORMATO (IMPORTANTE):
- El contenido de coverLetterA y coverLetterB debe ser ÚNICAMENTE el cuerpo del correo, en TEXTO PLANO sin formato de ningún tipo.
- NO incluyas líneas como "To:", "Subject:", "De:", "Asunto:", "Para:" ni el email del destinatario dentro del cuerpo — esos se muestran y se envían aparte.
- NO uses markdown: nada de **negritas**, *cursivas*, #, listas con guiones, ni caracteres especiales de formato. Solo texto simple con saltos de línea.

Debes responder ÚNICAMENTE con un objeto JSON válido, sin texto adicional:
{
  "coverLetterA": "solo el cuerpo del cold email en texto plano",
  "coverLetterB": "solo el cuerpo de la cover letter en texto plano",
  "recruiterEmail": "email extraído de la vacante o cadena vacía si no aparece",
  "subject": "asunto sugerido para el correo basado en la vacante y el puesto"
}

Recuerda además: los valores coverLetterA y coverLetterB son SOLO el cuerpo del correo en texto plano. Prohibido incluir —dentro de ellos— el objeto JSON entero, claves como "coverLetterA"/"subject", llaves de apertura/cierre, ni placeholders entre corchetes.

REGLAS ANTI-ALUCINACION (OBLIGATORIAS, PRIORIDAD ABSOLUTA):
1. CERO ALUCINACIONES: Prohibido inventar, inferir o agregar tecnologias, habilidades, logros, años de experiencia, certificaciones o datos que no esten explicitamente en el perfil JSON del candidato.
2. PROHIBICION DE ADAPTACION: Si la vacante pide una habilidad que el candidato NO tiene (ej. "experiencia en OBS Studio"), NO la afirmes ni la disfraces con "disponible para aprender", "habil para aprender rapidamente", "familiarizado con", "conocimientos basicos de" o similares. La carta solo menciona lo que el candidato ya sabe y ha hecho.
3. CERO JUSTIFICACIONES: No escribas notas, parentesis ni meta-comentarios como "(no tengo experiencia en esto)". Si no puedes afirmar algo con el perfil, no lo escribas.
4. PROHIBIDO PLACEHOLDERS: No uses corchetes de plantilla ([Nombre], [Tu nombre], [Empresa], [Puesto], [Título]) ni texto genérico. Escribe la carta completa usando los datos reales del perfil.${LANGUAGE_INSTRUCTION}`

function guessVacancyMeta(text: string): { company: string; position: string } {
  const clean = (s: string) => s.trim().replace(/\s+/g, ' ').replace(/[.,;:]+$/, '').slice(0, 60)
  const company =
    text.match(/(?:^|\n)\s*(?:empresa|compañ[íi]a|company|employer|organizaci[óo]n)\s*:\s*(.+)/i)?.[1] || ''
  const position =
    text.match(/(?:^|\n)\s*(?:puesto|vacante|posici[óo]n|cargo|position|role|t[íi]tulo(?:\s+del\s+puesto)?)\s*:\s*(.+)/i)?.[1] ||
    text.match(/(?:buscamos|se busca|se solicita|solicitamos|reclutamos|hiring|looking for)\s+(?:un[ao]?\s+)?([^.,;\n]{3,60})/i)?.[1] ||
    ''
  return { company: clean(company), position: clean(position) }
}

export async function analyzeVacancy(
  vacancyText: string,
  profile: Profile | null,
  onPhase: (message: string) => void = () => {},
): Promise<ATSReport> {
  const config = await getConfig()

  let researchSection = ''
  const meta = guessVacancyMeta(vacancyText)
  if (meta.company || meta.position) {
    try {
      const { investigateStream } = await import('./investigate-service')
      const country = profile?.country || 'DO'
      const query =
        meta.company && meta.position
          ? `empresa ${meta.company} en ${country}: tamaño, cultura, reputación como empleador, rango salarial para el puesto ${meta.position}`
          : meta.company
            ? `empresa ${meta.company} en ${country}: tamaño, cultura, reputación como empleador y rango salarial`
            : `puesto ${meta.position} en ${country}: demanda, rango salarial y requisitos habituales`
      const result = await new Promise<any | null>((resolve) => {
        investigateStream(query, country, 'es', {
          onPhase: (_phase, message) => onPhase(`[investigación] ${message}`),
          onDone: (r) => resolve(r),
          onError: () => resolve(null),
        })
      })
      if (result?.answer) {
        researchSection = `\n\n## INVESTIGACIÓN DE EMPRESA (fuentes en línea)\n${result.answer}`
      }
    } catch {
      onPhase('[investigación] No se pudo investigar la empresa; continuando sin contexto web.')
    }
  }

  const profileSection = profile
    ? `\n\n## PERFIL DEL CANDIDATO\n\`\`\`json\n${JSON.stringify(profile, null, 2)}\n\`\`\``
    : '\n\n## PERFIL DEL CANDIDATO\nNo hay perfil disponible.'

  const userMessage = `## VACANTE\n\n${vacancyText}${researchSection}${profileSection}\n\nGenera el reporte ATS en formato JSON.${researchSection ? ' Usa la INVESTIGACIÓN DE EMPRESA (si está disponible) como fuente de datos actualizados sobre la empresa y el rango salarial del puesto.' : ''}`

  const response = await completeChatCompletion(config, [
    { role: 'system', content: ATS_SYSTEM_PROMPT },
    { role: 'user', content: userMessage },
  ], undefined, 'ats_analysis', config.excludeFromTraining)

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

/** Deja el cuerpo de una carta en texto plano: sin wrapper JSON, headers repetidos ni markdown. */
function cleanLetterBody(raw: string): string {
  if (!raw) return ''
  let text = raw.replace(/\r\n/g, '\n').trim()

  // Quitar residuos del wrapper JSON que a veces quedan dentro del body
  text = text
    .replace(/^\s*\{\s*$/gm, '')                     // "{"
    .replace(/^\s*"\w+"\s*:\s*/gm, '')               // "coverLetterA":
    .replace(/^\s*,\s*$/gm, '')                      // ","
    .replace(/^\s*\}\s*$/gm, '')                     // "}"
    .replace(/^[\s\S]*?"coverLetter[AB]"\s*:\s*/i, '') // body que arrastra el inicio del JSON
    .trim()

  // Quitar líneas de header repetidas (To:/Subject:/De:/Asunto:/…)
  const lines = text.split('\n')
  while (lines.length > 0) {
    const line = lines[0].trim()
    if (!line) {
      lines.shift()
      continue
    }
    if (/^(to|from|subject|de|para|asunto|destinatario|titulo|título|email|re:)\s*[:：]/i.test(line)) {
      lines.shift()
      continue
    }
    break
  }
  text = lines.join('\n').trim()

  // Markdown → texto plano
  text = text
    .replace(/\*\*([^*]+)\*\*/g, '$1')              // **negrita**
    .replace(/\*([^*]+)\*/g, '$1')                  // *cursiva*
    .replace(/__([^_]+)__/g, '$1')                  // __negrita__
    .replace(/#{1,6}\s*/g, '')                      // encabezados
    .replace(/^>+\s?/gm, '')                        // citas
    .replace(/^[-*+]\s+/gm, '')                     // listas - * +
    .replace(/^\d+\.\s+/gm, '')                     // listas numeradas
    .replace(/`([^`]+)`/g, '$1')                    // código inline
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')           // imágenes
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')        // links [texto](url)
    .replace(/[_*]([^*_]+)[_*]/g, '$1')             // restos de _ * alrededor de palabras

  // Máximo una línea en blanco consecutiva
  text = text.split('\n').reduce((acc: string[], l) => {
    if (!l.trim() && acc.length && !acc[acc.length - 1].trim()) return acc
    acc.push(l)
    return acc
  }, []).join('\n').trim()

  return text
}

/** Detección de contenido roto: JSON, claves de modelo o placeholders de plantilla. */
function letterLooksBroken(body: string): boolean {
  if (!body.trim()) return true
  if (/^\s*\{\s*"\w+"/.test(body)) return true       // empieza como objeto JSON
  if (/"coverLetter[AB]"\s*:/.test(body)) return true // cita su propia clave
  if (/"subject"\s*:/.test(body)) return true
  if (/\[[^\]]*(?:nombre|empresa|puesto|título|titulo|fecha|cargo|compa\w+|candidat\w*|position|company)\b[^\]]*\]/i.test(body)) return true // placeholders
  return false
}

interface CoverLettersResult {
  coverLetterA: string
  coverLetterB: string
  recruiterEmail: string
  subject: string
}

/** Parsea la respuesta del modelo a un objeto de cartas seguro (o null si es irreparable). */
function parseLettersResponse(response: string): CoverLettersResult | null {
  const clean = response.replace(/```(?:json)?\n?/gi, '').trim()
  const jsonMatch = clean.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return null

  let raw = jsonMatch[0]

  // Intento 1: parse directo. Intentos 2-3: reparar saltos de línea sin escapar
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>
      return {
        coverLetterA: typeof parsed.coverLetterA === 'string' ? parsed.coverLetterA : '',
        coverLetterB: typeof parsed.coverLetterB === 'string' ? parsed.coverLetterB : '',
        recruiterEmail: typeof parsed.recruiterEmail === 'string' ? parsed.recruiterEmail : '',
        subject: typeof parsed.subject === 'string' ? parsed.subject : '',
      }
    } catch {
      // Replace literal newlines inside strings with escaped \\n
      raw = raw.replace(/:\s*"((?:[^"\\]|\\.)*)"/g, (_m, inner: string) => {
        const fixed = inner.replace(/\n/g, '\\n').replace(/\t/g, '\\t')
        return `: "${fixed}"`
      })
    }
  }

  // Último recurso: extracción campo por campo (carácter a carácter)
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
  if (letterA === null && letterB === null) return null

  return {
    coverLetterA: letterA ?? '',
    coverLetterB: letterB ?? '',
    recruiterEmail: extractField('recruiterEmail') ?? '',
    subject: extractField('subject') ?? '',
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

  const baseUserMessage = `## VACANTE\n\n${vacancyText}${profileSection}\n\n## REPORTE ATS\n\nMatch Score: ${atsReport.matchScore}%\nFortalezas: ${atsReport.strengths.join(', ')}\nBrechas: ${atsReport.gaps.join(', ')}\nKeywords faltantes: ${atsReport.keywordsMissing.join(', ')}\n\nGenera las dos variaciones de carta en formato JSON.`

  const STRICT_SUFFIX = `\n\nIMPORTANTE (reintento): El valor de coverLetterA y coverLetterB debe ser EXCLUSIVAMENTE el cuerpo de la carta en texto plano: sin llaves, sin claves JSON, sin "subject", sin metadatos y sin placeholders entre corchetes. Refleja solo los datos reales del perfil del candidato.`

  for (let attempt = 0; attempt < 2; attempt++) {
    const userMessage =
      attempt === 0
        ? baseUserMessage
        : baseUserMessage + '\n\nLa generación anterior fue inválida. Vuelve a intentarlo con el cuerpo SOLO en texto plano.'
    const systemPrompt = attempt === 0 ? COVER_LETTER_SYSTEM_PROMPT : COVER_LETTER_SYSTEM_PROMPT + STRICT_SUFFIX

    const response = await completeChatCompletion(
      config,
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      undefined,
      'cover_letters',
      config.excludeFromTraining,
    )

    const parsed = parseLettersResponse(response)
    if (!parsed) continue

    const letterA = cleanLetterBody(parsed.coverLetterA)
    const letterB = cleanLetterBody(parsed.coverLetterB)
    if (letterLooksBroken(letterA) || letterLooksBroken(letterB)) continue

    return {
      coverLetterA: letterA,
      coverLetterB: letterB,
      recruiterEmail: parsed.recruiterEmail.trim(),
      subject: parsed.subject.replace(/[\r\n]+/g, ' ').replace(/[#*_`]/g, '').trim(),
    }
  }

  throw new Error('No se pudo generar la carta de presentación. Revisa que la vacante tenga texto legible y vuelve a intentarlo.')
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
  ], undefined, 'correct_text', config.excludeFromTraining)

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
  ], undefined, 'interview_questions', config.excludeFromTraining)

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
