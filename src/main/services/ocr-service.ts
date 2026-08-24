import { createWorker, PSM } from 'tesseract.js'
import { Jimp } from 'jimp'
import { readJSON } from './storage'
import { SETTINGS_FILE } from '../utils/paths'
import type { AppSettings } from '../../shared/types'

let worker: Awaited<ReturnType<typeof createWorker>> | null = null

async function getWorker() {
  if (!worker) {
    worker = await createWorker('spa+eng')
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK })
  }
  return worker
}

export async function preprocessImage(buffer: Buffer): Promise<Buffer> {
  const image = await Jimp.read(buffer)
  if (image.width < 1500) {
    image.scale(2)
  }
  image.greyscale()
  image.contrast(0.35)
  image.normalize()
  image.gaussian(1)
  return image.getBuffer('image/png')
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

export async function extractTextFromImage(
  buffer: Buffer,
  dataUrl: string,
  llmConfig: { baseUrl: string; apiKey: string; model: string } | null,
  visionModel?: string,
): Promise<string> {
  if (llmConfig) {
    const visionConfig = visionModel && visionModel !== llmConfig.model
      ? { ...llmConfig, model: visionModel }
      : null
    const primaryConfig = llmConfig

    if (visionConfig) {
      const visionText = await extractTextWithLLM(dataUrl, visionConfig)
      if (visionText) return visionText
    }

    const primaryText = await extractTextWithLLM(dataUrl, primaryConfig)
    if (primaryText) return primaryText
  }

  const w = await getWorker()
  const processed = await preprocessImage(buffer)
  const { data } = await w.recognize(processed)
  return data.text.trim()
}
