import { readJSON, writeJSON, ensureDir } from './storage'
import { USAGE_FILE, DATA_DIR } from '../utils/paths'
import type { UsageRecord, UsageStats } from '../../shared/types'

interface PricingEntry {
  prefix: string
  input: number
  output: number
}

const pricing: PricingEntry[] = [
  { prefix: 'gpt-5.5-pro', input: 30, output: 180 },
  { prefix: 'gpt-5.5', input: 5, output: 30 },
  { prefix: 'gpt-5.4-codex', input: 1.75, output: 14 },
  { prefix: 'gpt-5.4-mini', input: 0.75, output: 4.5 },
  { prefix: 'gpt-5.4-nano', input: 0.2, output: 1.25 },
  { prefix: 'gpt-5.4', input: 2.5, output: 15 },
  { prefix: 'gpt-5-mini', input: 0.125, output: 1 },
  { prefix: 'gpt-5-nano', input: 0.049, output: 0.388 },
  { prefix: 'gpt-5', input: 1.25, output: 10 },
  { prefix: 'gpt-4.1-mini', input: 0.4, output: 1.6 },
  { prefix: 'gpt-4.1-nano', input: 0.1, output: 0.4 },
  { prefix: 'gpt-4.1', input: 2, output: 8 },
  { prefix: 'gpt-4o-mini', input: 0.15, output: 0.6 },
  { prefix: 'gpt-4o', input: 2.5, output: 10 },
  { prefix: 'gpt-4-turbo', input: 10, output: 30 },
  { prefix: 'gpt-4', input: 30, output: 60 },
  { prefix: 'o4-mini', input: 1.1, output: 4.4 },
  { prefix: 'o3', input: 10, output: 40 },
  { prefix: 'o1-mini', input: 3, output: 12 },
  { prefix: 'o1', input: 15, output: 60 },
  { prefix: 'gpt-3.5-turbo', input: 1.5, output: 2 },
  { prefix: 'gpt-oss-120b', input: 0.03, output: 0.15 },
  { prefix: 'gpt-oss-20b', input: 0.029, output: 0.14 },
  { prefix: 'claude-fable-5', input: 10, output: 50 },
  { prefix: 'claude-opus-4.8', input: 5, output: 25 },
  { prefix: 'claude-opus-4.7', input: 5, output: 25 },
  { prefix: 'claude-opus-3', input: 15, output: 75 },
  { prefix: 'claude-sonnet-4.6', input: 3, output: 15 },
  { prefix: 'claude-sonnet-3.5', input: 3, output: 15 },
  { prefix: 'claude-sonnet-3', input: 3, output: 15 },
  { prefix: 'claude-haiku-4.5', input: 1, output: 5 },
  { prefix: 'claude-haiku-3.5', input: 0.8, output: 4 },
  { prefix: 'claude-haiku-3', input: 0.25, output: 1.25 },
  { prefix: 'claude-instant', input: 0.8, output: 2.4 },
  { prefix: 'gemini-3.1-pro', input: 2, output: 12 },
  { prefix: 'gemini-3.1-flash-lite', input: 0.25, output: 1.5 },
  { prefix: 'gemini-3.1-flash', input: 0.5, output: 3 },
  { prefix: 'gemini-3.5-flash', input: 1.5, output: 9 },
  { prefix: 'gemini-3-pro', input: 3.5, output: 10.5 },
  { prefix: 'gemini-3-flash', input: 0.5, output: 3 },
  { prefix: 'gemini-2.5-pro', input: 1.25, output: 10 },
  { prefix: 'gemini-2.5-flash-lite', input: 0.1, output: 0.4 },
  { prefix: 'gemini-2.5-flash', input: 0.1, output: 0.4 },
  { prefix: 'gemini-2.0-flash', input: 0.1, output: 0.4 },
  { prefix: 'gemini-1.5-pro', input: 1.25, output: 5 },
  { prefix: 'gemini-1.5-flash', input: 0.075, output: 0.3 },
  { prefix: 'deepseek-v4-pro', input: 0.435, output: 0.87 },
  { prefix: 'deepseek-v4-flash', input: 0.14, output: 0.28 },
  { prefix: 'deepseek-v3.2', input: 0.2288, output: 0.3432 },
  { prefix: 'deepseek-v3.1', input: 0.21, output: 0.79 },
  { prefix: 'deepseek-v3', input: 0.27, output: 1.1 },
  { prefix: 'deepseek-r1-0528', input: 0.5, output: 2.15 },
  { prefix: 'deepseek-r1', input: 0.7, output: 2.5 },
  { prefix: 'llama-4-maverick', input: 0.22, output: 0.88 },
  { prefix: 'llama-4-scout', input: 0.18, output: 0.59 },
  { prefix: 'llama-4.1-scout', input: 0.09, output: 0.4 },
  { prefix: 'llama-3.3', input: 0.59, output: 0.79 },
  { prefix: 'llama-3.2', input: 0.2, output: 0.2 },
  { prefix: 'llama-3.1', input: 0.59, output: 0.79 },
  { prefix: 'llama-3', input: 0.5, output: 0.75 },
  { prefix: 'mistral-large', input: 2, output: 6 },
  { prefix: 'mistral-small', input: 0.1, output: 0.3 },
  { prefix: 'mistral-nemo', input: 0.15, output: 0.15 },
  { prefix: 'mixtral-8x22b', input: 1.2, output: 1.2 },
  { prefix: 'mixtral-8x7b', input: 0.5, output: 0.5 },
  { prefix: 'codestral', input: 0.279, output: 0.837 },
  { prefix: 'qwen3.5-397b', input: 0.6, output: 3.6 },
  { prefix: 'qwen3.5-plus', input: 0.4, output: 2.4 },
  { prefix: 'qwen3-vl', input: 0.02, output: 0.204 },
  { prefix: 'qwen3', input: 0.3, output: 1.5 },
  { prefix: 'qwen-turbo', input: 0.04, output: 0.079 },
  { prefix: 'qwen-plus', input: 0.4, output: 2.4 },
  { prefix: 'qwen2.5-72b', input: 1.2, output: 1.2 },
  { prefix: 'qwen-vl-plus', input: 0.106, output: 0.265 },
  { prefix: 'grok-4.3', input: 2, output: 10 },
  { prefix: 'grok-4.2', input: 2, output: 10 },
  { prefix: 'grok-4.1-fast', input: 0.19, output: 0.475 },
  { prefix: 'grok-4.1', input: 3, output: 15 },
  { prefix: 'grok-4', input: 5, output: 15 },
  { prefix: 'grok-3', input: 3, output: 10 },
  { prefix: 'grok-2', input: 2, output: 10 },
  { prefix: 'grok-beta', input: 5, output: 15 },
  { prefix: 'command-a', input: 2.35, output: 9.4 },
  { prefix: 'command-r-plus', input: 2.5, output: 10 },
  { prefix: 'command-r', input: 0.15, output: 0.6 },
  { prefix: 'phi-4', input: 0.1, output: 0.4 },
  { prefix: 'phi-3', input: 0.1, output: 0.4 },
  { prefix: 'glm-5.2', input: 1.4, output: 4.4 },
  { prefix: 'glm-5.1', input: 1.4, output: 4.4 },
  { prefix: 'glm-5', input: 1, output: 3.2 },
  { prefix: 'glm-4.7', input: 0.558, output: 2.046 },
  { prefix: 'glm-4.7-flash', input: 0, output: 0 },
  { prefix: 'kimi-k2.6', input: 0.95, output: 4 },
  { prefix: 'kimi-k2.5', input: 0.6, output: 3 },
  { prefix: 'minimax-m3', input: 0.3, output: 1.2 },
  { prefix: 'minimax-m2.5', input: 0.324, output: 1.297 },
  { prefix: 'doubao-seed-2.0-mini', input: 0.029, output: 0.294 },
  { prefix: 'doubao-seed-1.8', input: 0.118, output: 0.294 },
  { prefix: 'doubao-seed-1.6', input: 0.118, output: 0.294 },
  { prefix: 'doubao-1.5-lite', input: 0.044, output: 0.088 },
  { prefix: 'gemma-3', input: 0.05, output: 0.15 },
  { prefix: 'gemma-2', input: 0.05, output: 0.15 },
]

export function calculateCost(model: string, promptTokens: number, completionTokens: number): number {
  const entry = pricing.find(p => model.startsWith(p.prefix))
  if (!entry) return 0
  return (promptTokens / 1_000_000) * entry.input + (completionTokens / 1_000_000) * entry.output
}

export async function getUsage(): Promise<UsageStats> {
  const records = await readJSON<UsageRecord[]>(USAGE_FILE)
  const list = records ?? []
  const totalPromptTokens = list.reduce((s, r) => s + r.promptTokens, 0)
  const totalCompletionTokens = list.reduce((s, r) => s + r.completionTokens, 0)
  const totalCost = list.reduce((s, r) => s + r.estimatedCost, 0)
  return { totalPromptTokens, totalCompletionTokens, totalCost, records: list }
}

export async function addUsage(record: UsageRecord): Promise<void> {
  await ensureDir(DATA_DIR)
  const records = (await readJSON<UsageRecord[]>(USAGE_FILE)) ?? []
  records.push(record)
  await writeJSON(USAGE_FILE, records)
}

export async function resetUsage(): Promise<void> {
  await ensureDir(DATA_DIR)
  await writeJSON(USAGE_FILE, [])
}
