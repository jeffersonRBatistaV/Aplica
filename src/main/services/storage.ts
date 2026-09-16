import fs from 'fs/promises'
import path from 'path'

export async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true })
}

export async function readJSON<T = unknown>(filePath: string): Promise<T | null> {
  try {
    const data = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(data) as T
  } catch {
    return null
  }
}

// Escritura atómica: se escribe a un temporal y se renombra, evitando que un
// fallo a mitad de escritura deje el archivo truncado/corrupto.
export async function writeJSON(filePath: string, data: unknown): Promise<void> {
  await ensureDir(path.dirname(filePath))
  const tmpPath = `${filePath}.tmp-${Date.now()}`
  await fs.writeFile(tmpPath, JSON.stringify(data, null, 2), 'utf-8')
  await fs.rename(tmpPath, filePath)
}
