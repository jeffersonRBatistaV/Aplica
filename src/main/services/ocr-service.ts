import { createWorker, PSM } from 'tesseract.js'
import { Jimp } from 'jimp'
import { readJSON } from './storage'
import { SETTINGS_FILE } from '../utils/paths'
import type { AppSettings, OcrMethod } from '../../shared/types'

let worker: Awaited<ReturnType<typeof createWorker>> | null = null

const visionFailedCache = new Set<string>()

const VISION_PROVIDER_HINTS = [
  'openai', 'anthropic', 'googleapis', 'generativelanguage', 'groq',
  'mistral', 'x.ai', 'together', 'fireworks', 'openrouter', 'deepinfra',
  'novita', 'cerebras', 'vsegpt',
]

function isVisionCapableEndpoint(baseUrl: string): boolean {
  const host = baseUrl.toLowerCase()
  if (host.includes('localhost') || host.includes('127.0.0.1')) return true
  return VISION_PROVIDER_HINTS.some((h) => host.includes(h))
}

async function getWorker() {
  if (!worker) {
    worker = await createWorker('spa+eng')
    await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO })
  }
  return worker
}

const MIN_USEFUL_TEXT = 20

export async function preprocessImage(buffer: Buffer): Promise<Buffer> {
  const image = await Jimp.read(buffer)
  const MIN = 800
  const MAX = 2000
  const largest = Math.max(image.width, image.height)
  if (largest < MIN) {
    image.scale(MIN / largest)
  } else if (largest > MAX) {
    image.scale(MAX / largest)
  }
  image.greyscale()
  image.contrast(0.35)
  image.normalize()
  return image.getBuffer('image/png')
}

async function recognizeWithModes(buffer: Buffer, processed: Buffer): Promise<string> {
  const w = await getWorker()
  const attempts: Array<() => Promise<string>> = [
    async () => (await w.recognize(buffer)).data.text.trim(),
    async () => (await w.recognize(processed)).data.text.trim(),
    async () => {
      await w.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_COLUMN })
      const { data } = await w.recognize(buffer)
      return data.text.trim()
    },
  ]
  let best = ''
  for (const attempt of attempts) {
    try {
      const text = await attempt()
      if (text.length > best.length) best = text
      if (best.length >= MIN_USEFUL_TEXT) break
    } catch {
      /* continuar con el siguiente modo */
    }
  }
  await w.setParameters({ tessedit_pageseg_mode: PSM.AUTO })
  return best
}

async function extractTextWithLLM(
  dataUrl: string,
  config: { baseUrl: string; apiKey: string; model: string },
): Promise<string | null> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (config.apiKey) headers['Authorization'] = `Bearer ${config.apiKey}`

    const settings = await readJSON<AppSettings>(SETTINGS_FILE)
    if (settings?.privacy?.excludeFromTraining) {
      headers['X-Exclude-From-Training'] = 'true'
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 20000)

    try {
      const response = await fetch(`${config.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: config.model,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Extrae TODO el texto de esta imagen de forma literal y completa. Devuelve solo el texto, sin comentarios ni formato markdown.',
                },
                { type: 'image_url', image_url: { url: dataUrl } },
              ],
            },
          ],
          stream: false,
          max_tokens: 4000,
        }),
        signal: controller.signal,
      })
      if (!response.ok) return null
      const data = await response.json()
      const content = data?.choices?.[0]?.message?.content
      if (!content || !content.trim()) return null
      return content
    } finally {
      clearTimeout(timeout)
    }
  } catch {
    return null
  }
}

async function tryVision(
  dataUrl: string,
  config: { baseUrl: string; apiKey: string; model: string },
): Promise<string | null> {
  const key = `${config.baseUrl}|${config.model}`
  if (visionFailedCache.has(key)) return null
  const text = await extractTextWithLLM(dataUrl, config)
  if (!text) visionFailedCache.add(key)
  return text
}

export async function extractTextFromImage(
  buffer: Buffer,
  dataUrl: string,
  llmConfig: { baseUrl: string; apiKey: string; model: string } | null,
  visionModel?: string,
  method?: OcrMethod,
): Promise<string> {
  const settings = await readJSON<AppSettings>(SETTINGS_FILE)
  const preferred: OcrMethod = method ?? settings?.ocr?.method ?? 'auto'
  const canUseVision = !!llmConfig

  if (canUseVision && preferred === 'vision') {
    const visionConfig = visionModel && visionModel !== llmConfig!.model
      ? { ...llmConfig, model: visionModel }
      : llmConfig
    const visionText = await tryVision(dataUrl, visionConfig as { baseUrl: string; apiKey: string; model: string })
    if (visionText) return visionText
  }

  if (canUseVision && preferred === 'auto') {
    const visionConfig = visionModel && visionModel !== llmConfig!.model
      ? { ...llmConfig, model: visionModel }
      : null

    if (visionConfig) {
      const visionText = await tryVision(dataUrl, visionConfig as { baseUrl: string; apiKey: string; model: string })
      if (visionText) return visionText
    }

    if (isVisionCapableEndpoint(llmConfig!.baseUrl)) {
      const primaryText = await tryVision(dataUrl, llmConfig as { baseUrl: string; apiKey: string; model: string })
      if (primaryText) return primaryText
    }
  }

  const processed = await preprocessImage(buffer).catch(() => buffer)
  return recognizeWithModes(buffer, processed)
}
