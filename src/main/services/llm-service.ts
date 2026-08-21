import type { Message, Profile, InvestigateResult } from '../../shared/types'

const MAX_INPUT_TOKENS = 900000
const ESTIMATE_FACTOR = 4

function estimateTokens(text: string): number {
  return Math.ceil(text.length / ESTIMATE_FACTOR)
}

function truncateMessages(
  systemContent: string,
  messages: { role: string; content: string }[],
  maxTokens: number,
): { role: string; content: string }[] {
  let total = estimateTokens(systemContent)
  for (const m of messages) total += estimateTokens(m.content)
  if (total <= maxTokens) return messages

  const result = [...messages]
  while (result.length > 1) {
    const removed = result.shift()!
    total -= estimateTokens(removed.content)
    if (total <= maxTokens) break
  }
  return result
}

interface LLMConfig {
  baseUrl: string
  apiKey: string
  model: string
}

interface StreamCallbacks {
  onToken: (token: string) => void
  onDone: () => void
  onError: (error: string) => void
}

let currentAbort: AbortController | null = null

/**
 * Definición de la tool de investigación web (OpenAI function-calling).
 * Se envía SIEMPRE en el chat: el modelo decide cuándo usarla (preguntas
 * sobre datos actuales, salarios, noticias, empresas, tendencias...).
 */
const INVESTIGATE_TOOL = {
  type: 'function',
  function: {
    name: 'investigate_web',
    description:
      'Busca información actualizada en internet y la resume con fuentes. Úsala SOLO cuando la respuesta necesite datos que tu conocimiento no cubre o puede estar desactualizado: salarios de mercado, noticias recientes, información de empresas, certificaciones vigentes, tendencias del mercado laboral en un país, normativas. NO la uses para responder sobre el perfil del usuario o conversación general.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Consulta a investigar en internet (en el idioma del usuario, incluye el país si aplica).',
        },
      },
      required: ['query'],
    },
  },
}

/** Ejecuta la tool investigate_web contra el backend (con auto-registro), emitiendo las fases en vivo. */
async function runInvestigateTool(query: string, onToken: (token: string) => void): Promise<string> {
  try {
    const { investigateStream } = await import('./investigate-service')
    const { readJSON } = await import('./storage')
    const { PROFILE_PATH } = await import('../utils/paths')
    const profile = await readJSON<Profile>(PROFILE_PATH)
    const country = profile?.country || 'DO'
    const lang = /[^\x00-\x7F]/.test(query) ? 'es' : 'en'
    const result = await new Promise<InvestigateResult>((resolve, reject) => {
      void investigateStream(query, country, lang, {
        onPhase: (phase, message) => {
          if (phase === 'search') onToken(`\n\n🔍 ${message}\n`)
          else if (phase === 'extract') onToken(`📄 ${message}\n`)
          else if (phase === 'synthesize') onToken(`✨ ${message}\n`)
        },
        onDone: resolve,
        onError: reject,
      })
    })
    const sources = result.sources
      .slice(0, 5)
      .map((s, i) => `[${i + 1}] ${s.title || s.url} — ${s.url}`)
      .join('\n')
    return `## RESULTADO DE INVESTIGACIÓN EN LÍNEA\n\n${result.answer}\n\n### Fuentes\n${sources}`
  } catch (e) {
    return `## ERROR DE INVESTIGACIÓN\n\nNo se pudo investigar en línea: ${e instanceof Error ? e.message : String(e)}`
  }
}

function buildSystemPrompt(userPrompt?: string, profile?: Profile | null): string {
  const parts: string[] = []
  if (userPrompt) parts.push(userPrompt)
  if (profile) {
    parts.push(`\
## PERFIL PROFESIONAL

\`\`\`json
${JSON.stringify(profile, null, 2)}
\`\`\`

Cuando te pregunten sobre tu experiencia, proyectos, educación o habilidades, responde SIEMPRE en PRIMERA PERSONA (Yo / Mi / Me) usando la información de este perfil. No inventes datos que no estén aquí.`)
  }
  return parts.join('\n\n')
}

async function fetchCompletion(
  config: LLMConfig,
  messages: { role: string; content: string }[],
  signal?: AbortSignal,
  temperature?: number,
  excludeFromTraining?: boolean,
  tools?: unknown[],
): Promise<Response> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (config.apiKey) headers['Authorization'] = `Bearer ${config.apiKey}`
  if (excludeFromTraining) headers['X-Exclude-From-Training'] = 'true'

  const body: Record<string, unknown> = { model: config.model, messages, stream: true }
  if (temperature !== undefined) body.temperature = temperature
  if (tools && tools.length > 0) body.tools = tools

  return fetch(`${config.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal,
  })
}

export async function streamChatCompletion(
  config: LLMConfig,
  messages: Message[],
  callbacks: StreamCallbacks,
  options?: { systemPrompt?: string; profile?: Profile | null; excludeFromTraining?: boolean; action?: string },
): Promise<void> {
  currentAbort?.abort()
  currentAbort = new AbortController()
  const { signal } = currentAbort

  try {
    const systemMessage = {
      role: 'system',
      content: buildSystemPrompt(options?.systemPrompt, options?.profile),
    }
    let apiMessages = [
      systemMessage,
      ...messages.map(({ role, content }) => ({ role, content })),
    ]

    const truncated = truncateMessages(systemMessage.content, apiMessages.slice(1), MAX_INPUT_TOKENS)
    apiMessages = [systemMessage, ...truncated]

    // ── Pasada 1: con tools (el modelo decide si investigar) ──
    const response = await fetchCompletion(config, apiMessages, signal, undefined, options?.excludeFromTraining, [INVESTIGATE_TOOL])
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      throw new Error(`API ${response.status}: ${errorText}`)
    }

    const reader = response.body?.getReader()
    if (!reader) throw new Error('Response body is not readable')

    const decoder = new TextDecoder()
    let buffer = ''
    let usageData: { prompt_tokens?: number; completion_tokens?: number } | null = null
    let fullOutput = ''
    let toolCalls: { name?: string; args?: string }[] = []

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data: ')) continue
        const data = trimmed.slice(6)
        if (data === '[DONE]') break
        try {
          const parsed = JSON.parse(data)
          if (parsed.usage) usageData = parsed.usage
          const delta = parsed.choices?.[0]?.delta
          const token = delta?.content || ''
          if (token) {
            fullOutput += token
            callbacks.onToken(token)
          }
          // Acumular tool calls del stream
          const deltaTools = delta?.tool_calls
          if (Array.isArray(deltaTools)) {
            for (const tc of deltaTools) {
              const idx = tc.index ?? 0
              toolCalls[idx] ??= { name: '', args: '' }
              if (tc.function?.name) toolCalls[idx].name = tc.function.name
              if (tc.function?.arguments) toolCalls[idx].args = (toolCalls[idx].args || '') + tc.function.arguments
            }
          }
        } catch { /* skip */ }
      }
    }

    // ── Si el modelo pidió investigar: ejecutar tool y continuar ──
    const wanted = toolCalls.find(tc => tc.name === 'investigate_web' && tc.args)
    if (wanted && !signal.aborted) {
      let query = 'Consulta del usuario'
      try {
        const parsed = JSON.parse(wanted.args || '{}')
        if (parsed.query) query = parsed.query
      } catch { /* args malformados */ }

      const toolResult = await runInvestigateTool(query, (t) => callbacks.onToken(t))
      callbacks.onToken(`_Resultado obtenido de ${toolResult.match(/\[1\]/i) ? 'múltiples fuentes' : 'fuentes en línea'}._\n\n`)

      // Pasada 2: sin tools, con el resultado como mensaje de sistema
      apiMessages = [
        ...apiMessages,
        { role: 'assistant', content: fullOutput || '' },
        {
          role: 'system',
          content:
            'A continuación tienes el resultado de una investigación en línea. Usa ESTA información (y solo esta) para responder al usuario de forma completa, citando las fuentes entre corchetes [1], [2]... No inventes datos que no estén en el resultado.',
        },
        { role: 'user', content: toolResult },
      ]
      // Re-truncar si hace falta
      const truncated2 = truncateMessages(systemMessage.content, apiMessages.slice(1), MAX_INPUT_TOKENS)
      apiMessages = [systemMessage, ...truncated2]

      const response2 = await fetchCompletion(config, apiMessages, signal, undefined, options?.excludeFromTraining)
      if (!response2.ok) {
        const errorText = await response2.text().catch(() => 'Unknown error')
        throw new Error(`API ${response2.status}: ${errorText}`)
      }
      const reader2 = response2.body?.getReader()
      if (!reader2) throw new Error('Response body is not readable')

      let buffer2 = ''
      let fullOutput2 = ''
      while (true) {
        const { done, value } = await reader2.read()
        if (done) break
        buffer2 += decoder.decode(value, { stream: true })
        const lines2 = buffer2.split('\n')
        buffer2 = lines2.pop() || ''
        for (const line of lines2) {
          const trimmed = line.trim()
          if (!trimmed || !trimmed.startsWith('data: ')) continue
          const data = trimmed.slice(6)
          if (data === '[DONE]') break
          try {
            const parsed = JSON.parse(data)
            if (parsed.usage) usageData = parsed.usage
            const token = parsed.choices?.[0]?.delta?.content || ''
            if (token) {
              fullOutput2 += token
              callbacks.onToken(token)
            }
          } catch { /* skip */ }
        }
      }
      fullOutput = fullOutput2
    }

    try {
      const { addUsage, calculateCost } = await import('./usage-service')
      const promptTokens = usageData?.prompt_tokens ?? estimateTokens(systemMessage.content + messages.map(m => m.content).join(' '))
      const completionTokens = usageData?.completion_tokens ?? estimateTokens(fullOutput)
      await addUsage({
        action: options?.action || 'chat',
        promptTokens,
        completionTokens,
        model: config.model,
        estimatedCost: calculateCost(config.model, promptTokens, completionTokens),
        timestamp: Date.now(),
      })
    } catch { /* usage tracking failure is non-critical */ }

    callbacks.onDone()
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') { callbacks.onDone(); return }
    callbacks.onError(err instanceof Error ? err.message : 'Unknown error')
  } finally {
    if (currentAbort && !currentAbort.signal.aborted) currentAbort = null
  }
}

export async function completeChatCompletion(
  config: LLMConfig,
  messages: { role: string; content: string }[],
  signal?: AbortSignal,
  action?: string,
): Promise<string> {
  const systemMsg = messages.find(m => m.role === 'system')
  const otherMessages = messages.filter(m => m.role !== 'system')
  const systemContent = systemMsg?.content ?? ''
  const truncated = truncateMessages(systemContent, otherMessages, MAX_INPUT_TOKENS)
  const finalMessages = systemMsg ? [systemMsg, ...truncated] : truncated
  const response = await fetchCompletion(config, finalMessages, signal)
  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error')
    throw new Error(`API ${response.status}: ${errorText}`)
  }

  const reader = response.body?.getReader()
  if (!reader) throw new Error('Response body is not readable')

  const decoder = new TextDecoder()
  let buffer = ''
  let result = ''
  let usageData: { prompt_tokens?: number; completion_tokens?: number } | null = null

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || !trimmed.startsWith('data: ')) continue
      const data = trimmed.slice(6)
      if (data === '[DONE]') break
      try {
        const parsed = JSON.parse(data)
        if (parsed.usage) usageData = parsed.usage
        const token = parsed.choices?.[0]?.delta?.content || ''
        result += token
      } catch { /* skip */ }
    }
  }

  try {
    const { addUsage, calculateCost } = await import('./usage-service')
    const promptTokens = usageData?.prompt_tokens ?? estimateTokens(messages.map(m => m.content).join(' '))
    const completionTokens = usageData?.completion_tokens ?? estimateTokens(result)
    await addUsage({
      action: action || 'unknown',
      promptTokens,
      completionTokens,
      model: config.model,
      estimatedCost: calculateCost(config.model, promptTokens, completionTokens),
      timestamp: Date.now(),
    })
  } catch { /* usage tracking failure is non-critical */ }

  return result
}

export function abortCurrentStream(): void {
  currentAbort?.abort()
  currentAbort = null
}

export async function listModels(
  config: LLMConfig | { baseUrl: string; apiKey: string },
): Promise<{ id: string; name?: string }[]> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (config.apiKey) headers['Authorization'] = `Bearer ${config.apiKey}`
    const response = await fetch(`${config.baseUrl.replace(/\/+$/, '')}/models`, { headers })
    if (!response.ok) return []
    const data = await response.json()
    return (data.data || []).map((m: { id: string }) => ({ id: m.id, name: m.id }))
  } catch { return [] }
}
