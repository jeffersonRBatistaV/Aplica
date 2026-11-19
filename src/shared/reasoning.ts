/**
 * Esfuerzo de razonamiento ("reasoning_effort" del API OpenAI-compatible).
 * 'default' = no se envía el parámetro (el proveedor decide).
 */
export type ReasoningEffort = 'default' | 'low' | 'medium' | 'high'

export const REASONING_EFFORTS: ReasoningEffort[] = ['default', 'low', 'medium', 'high']

/**
 * Heurística: ¿el modelo admite reasoning_effort? Solo orienta la UI; si el
 * proveedor lo rechaza, el proceso principal reintenta sin el parámetro.
 */
export function modelSupportsReasoning(model: string | undefined): boolean {
  const id = (model || '').trim().toLowerCase().split('/').pop() || ''
  return /^(o\d|gpt-5|gpt-oss|deepseek|gemini-(2\.5|3)|claude|grok-(3-mini|4)|qwen3|qwq|glm-(4\.[5-9]|5)|kimi|magistral|minimax|phi-4-reasoning|.*-r1|.*thinking|.*reason)/.test(id)
}
