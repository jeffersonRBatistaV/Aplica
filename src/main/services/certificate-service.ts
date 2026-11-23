import fs from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'
import { PDFDocument } from 'pdf-lib'
import { Jimp } from 'jimp'
import { readJSON, writeJSON, ensureDir } from './storage'
import { getActiveProfileFiles } from './profile-data'
import type { CertificateFile } from '../../shared/types'

const MAX_BYTES = 10 * 1024 * 1024

/** Tamaño A4 en puntos PDF. */
const A4_W = 595.28
const A4_H = 841.89
const MARGIN = 28

const MIME_BY_EXT: Record<string, CertificateFile['mime']> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
}

export const CERTIFICATE_EXTENSIONS = Object.keys(MIME_BY_EXT).map((e) => e.slice(1))

async function readList(): Promise<CertificateFile[]> {
  const { certificatesFile } = await getActiveProfileFiles()
  const list = await readJSON<CertificateFile[]>(certificatesFile)
  return Array.isArray(list) ? list : []
}

async function writeList(list: CertificateFile[]): Promise<void> {
  const { certificatesFile } = await getActiveProfileFiles()
  await ensureDir(path.dirname(certificatesFile))
  await writeJSON(certificatesFile, list)
}

export async function listCertificates(): Promise<CertificateFile[]> {
  return readList()
}

/** Copia los archivos elegidos a la carpeta del perfil. Devuelve la lista actualizada y los rechazados. */
export async function addCertificates(filePaths: string[]): Promise<{ certificates: CertificateFile[]; rejected: string[] }> {
  const { certificatesDir } = await getActiveProfileFiles()
  await ensureDir(certificatesDir)
  const list = await readList()
  const rejected: string[] = []

  for (const src of filePaths) {
    const ext = path.extname(src).toLowerCase()
    const mime = MIME_BY_EXT[ext]
    const base = path.basename(src)
    if (!mime) {
      rejected.push(base)
      continue
    }
    try {
      const stat = await fs.stat(src)
      if (!stat.isFile() || stat.size > MAX_BYTES) {
        rejected.push(base)
        continue
      }
      // Validar que el archivo se pueda leer antes de guardarlo (evita certificados que luego se omitirían).
      const bytes = await fs.readFile(src)
      if (mime === 'application/pdf') {
        if ((await PDFDocument.load(bytes, { ignoreEncryption: true })).getPageCount() === 0) throw new Error('PDF vacío')
      } else {
        await Jimp.read(bytes)
      }
      const id = randomUUID()
      const filename = `${id}${ext}`
      await fs.writeFile(path.join(certificatesDir, filename), bytes)
      list.push({
        id,
        name: path.basename(src, path.extname(src)),
        mime,
        filename,
        addedAt: Date.now(),
        includeInCv: true,
      })
    } catch {
      rejected.push(base)
    }
  }

  await writeList(list)
  return { certificates: list, rejected }
}

export async function updateCertificate(
  id: string,
  patch: Partial<Pick<CertificateFile, 'name' | 'includeInCv'>>,
): Promise<CertificateFile[]> {
  const list = await readList()
  const next = list.map((c) => {
    if (c.id !== id) return c
    return {
      ...c,
      ...(typeof patch.name === 'string' && patch.name.trim() ? { name: patch.name.trim().slice(0, 200) } : {}),
      ...(typeof patch.includeInCv === 'boolean' ? { includeInCv: patch.includeInCv } : {}),
    }
  })
  await writeList(next)
  return next
}

export async function deleteCertificate(id: string): Promise<CertificateFile[]> {
  const { certificatesDir } = await getActiveProfileFiles()
  const list = await readList()
  const target = list.find((c) => c.id === id)
  if (target) {
    await fs.unlink(path.join(certificatesDir, path.basename(target.filename))).catch(() => {})
  }
  const next = list.filter((c) => c.id !== id)
  await writeList(next)
  return next
}

/** Escala (w,h) para que quepa en (maxW,maxH) sin agrandar más allá de lo necesario. */
function fit(w: number, h: number, maxW: number, maxH: number): { w: number; h: number } {
  const s = Math.min(maxW / w, maxH / h)
  return { w: w * s, h: h * s }
}

/** Página A4 (vertical u horizontal según el contenido) con el contenido escalado y centrado. */
function a4PageFor(w: number, h: number): [number, number] {
  return w > h ? [A4_H, A4_W] : [A4_W, A4_H]
}

/** PDF temporal de una sola página con la imagen escalada y centrada en A4. */
async function imagePagePdf(bytes: Buffer, mime: CertificateFile['mime']): Promise<PDFDocument> {
  let data = bytes
  let kind: 'png' | 'jpg' = mime === 'image/jpeg' ? 'jpg' : 'png'
  if (mime === 'image/webp') {
    const img = await Jimp.read(bytes)
    data = await img.getBuffer('image/png')
    kind = 'png'
  }
  const doc = await PDFDocument.create()
  const image = kind === 'jpg' ? await doc.embedJpg(data) : await doc.embedPng(data)
  const [pageW, pageH] = a4PageFor(image.width, image.height)
  const page = doc.addPage([pageW, pageH])
  const { w, h } = fit(image.width, image.height, pageW - MARGIN * 2, pageH - MARGIN * 2)
  page.drawImage(image, { x: (pageW - w) / 2, y: (pageH - h) / 2, width: w, height: h })
  return doc
}

/** PDF temporal con la primera página del certificado, escalada a A4 (o copiada tal cual si no se puede embeber). */
async function pdfFirstPagePdf(bytes: Buffer): Promise<PDFDocument> {
  const src = await PDFDocument.load(bytes, { ignoreEncryption: true })
  if (src.getPageCount() === 0) throw new Error('PDF sin páginas')
  try {
    const doc = await PDFDocument.create()
    const [embedded] = await doc.embedPdf(src, [0])
    const [pageW, pageH] = a4PageFor(embedded.width, embedded.height)
    const page = doc.addPage([pageW, pageH])
    const { w, h } = fit(embedded.width, embedded.height, pageW, pageH)
    page.drawPage(embedded, { x: (pageW - w) / 2, y: (pageH - h) / 2, width: w, height: h })
    await doc.save() // embedPdf es perezoso: validar aquí que la página se puede embeber.
    return doc
  } catch {
    // Página que no se puede embeber (p. ej. sin /Contents): se copia tal cual, sin escalar.
    const doc = await PDFDocument.create()
    const [copied] = await doc.copyPages(src, [0])
    doc.addPage(copied)
    return doc
  }
}

/**
 * Anexa al PDF del CV una página por cada certificado marcado con `includeInCv`
 * (de un PDF solo se usa la primera página). Cada certificado se arma en un PDF
 * temporal y se valida antes de copiarlo, así uno dañado se omite sin afectar al resto.
 */
export async function appendCertificatesToPdf(cvPdf: Buffer): Promise<Buffer> {
  const certs = (await readList()).filter((c) => c.includeInCv)
  if (certs.length === 0) return cvPdf
  const { certificatesDir } = await getActiveProfileFiles()
  const doc = await PDFDocument.load(cvPdf)
  let added = 0
  for (const cert of certs) {
    try {
      const bytes = await fs.readFile(path.join(certificatesDir, path.basename(cert.filename)))
      const single = cert.mime === 'application/pdf' ? await pdfFirstPagePdf(bytes) : await imagePagePdf(bytes, cert.mime)
      const validated = await PDFDocument.load(await single.save())
      const [page] = await doc.copyPages(validated, [0])
      doc.addPage(page)
      added++
    } catch {
      // Archivo dañado o ausente: se omite sin bloquear el CV.
    }
  }
  if (added === 0) return cvPdf
  return Buffer.from(await doc.save())
}
