import { createWorker } from 'tesseract.js'

let worker: Awaited<ReturnType<typeof createWorker>> | null = null

async function getWorker() {
  if (!worker) {
    worker = await createWorker('spa+eng')
  }
  return worker
}

export async function extractTextFromImage(buffer: Buffer): Promise<string> {
  const w = await getWorker()
  const { data } = await w.recognize(buffer)
  return data.text
}
