import type { Message, Profile } from '../../shared/types'

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
): Promise<Response> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (config.apiKey) headers['Authorization'] = `Bearer ${config.apiKey}`
  if (excludeFromTraining) headers['X-Exclude-From-Training'] = 'true'

  const body: Record<string, unknown> = { model: config.model, messages, stream: true }
  if (temperature !== undefined) body.temperature = temperature

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

    const response = await fetchCompletion(config, apiMessages, signal, undefined, options?.excludeFromTraining)
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
          if (token) {
            fullOutput += token
            callbacks.onToken(token)
          }
        } catch { /* skip */ }
      }
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
