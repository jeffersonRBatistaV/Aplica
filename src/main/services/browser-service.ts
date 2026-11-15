import { app, BrowserWindow, webContents } from 'electron'
import fs from 'fs/promises'
import path from 'path'
import type {
  BrowserAttachResult,
  BrowserButton,
  BrowserCvOption,
  BrowserFillEntry,
  BrowserFillResult,
  BrowserFormField,
  BrowserPageSnapshot,
  BrowserState,
  CvVersion,
  JobApplication,
  Profile,
} from '../../shared/types'
import { buildProfileValues, classifyField, createDefaultBrowserState, normalizeBrowserState } from '../../shared/autofill'
import { readJSON, writeJSON } from './storage'
import { getActiveProfileFiles, ensureParentDir } from './profile-data'
import { profileBrowserFile } from '../utils/paths'
import { getActiveProfile } from './profile-scope'
import { buildClickScript, buildFillScript, buildInspectScript, buildUndoScript } from './browser-injected'
import { buildProfileCvHtml, renderCvPdf } from './cv-pdf'

interface RawField {
  id: string
  frameIndex: number
  kind: BrowserFormField['kind']
  type: string
  name: string
  idAttr?: string
  label: string
  placeholder: string
  autocomplete: string
  required: boolean
  disabled: boolean
  readonly: boolean
  value: string
  checked?: boolean
  visible: boolean
  options: { value: string; label: string }[]
  accept?: string
  multiple?: boolean
  signature: string
}

interface RawInspection {
  url: string
  title: string
  text: string
  fields: RawField[]
  buttons: (Omit<BrowserButton, 'visible'> & { visible?: boolean })[]
}

const MAX_TEXT = 12000
const MAX_FIELDS = 150

function assertGuest(webContentsId: number): Electron.WebContents {
  const wc = webContents.fromId(webContentsId)
  if (!wc || wc.isDestroyed()) throw new Error('El navegador no está disponible.')
  if (wc.getType() !== 'webview') throw new Error('La vista indicada no es el navegador integrado.')
  const host = (wc as unknown as { hostWebContents?: Electron.WebContents | null }).hostWebContents
  if (!host) throw new Error('La vista del navegador no pertenece a Aplica.')
  const owned = BrowserWindow.getAllWindows().some((win) => !win.isDestroyed() && win.webContents === host)
  if (!owned) throw new Error('La vista del navegador no está autorizada.')
  return wc
}

function frameList(wc: Electron.WebContents): Electron.WebFrameMain[] {
  return wc.mainFrame.framesInSubtree
}

export async function inspectPage(webContentsId: number): Promise<BrowserPageSnapshot> {
  const wc = assertGuest(webContentsId)
  const profile = await getActiveProfile()
  const autofill = buildProfileValues(profile)
  const frames = frameList(wc)

  const inspections = await Promise.all(
    frames.map(async (frame, index) => {
      try {
        return (await frame.executeJavaScript(buildInspectScript(index), true)) as RawInspection | null
      } catch {
        return null
      }
    }),
  )

  let url = wc.getURL()
  let title = ''
  let text = ''
  const fields: BrowserFormField[] = []
  const buttons: BrowserButton[] = []

  inspections.forEach((inspection, index) => {
    if (!inspection) return
    if (index === 0) {
      url = inspection.url || url
      title = inspection.title || ''
      text = (inspection.text || '').slice(0, MAX_TEXT)
    }
    for (const raw of inspection.fields || []) {
      if (fields.length >= MAX_FIELDS) break
      const field: BrowserFormField = {
        id: raw.id,
        frameIndex: raw.frameIndex,
        kind: raw.kind,
        type: raw.type,
        name: raw.name,
        idAttr: raw.idAttr,
        label: raw.label,
        placeholder: raw.placeholder,
        autocomplete: raw.autocomplete,
        required: raw.required,
        disabled: raw.disabled,
        readonly: raw.readonly,
        value: raw.value,
        checked: raw.checked,
        visible: raw.visible,
        options: raw.options || [],
        accept: raw.accept,
        multiple: raw.multiple,
        signature: raw.signature,
        suggestedKey: null,
        suggestedValue: '',
        confidence: 0,
      }
      const suggestion = classifyField(field, autofill)
      field.suggestedKey = suggestion.key
      field.suggestedValue = suggestion.value
      field.confidence = suggestion.confidence
      fields.push(field)
    }
    for (const button of inspection.buttons || []) {
      buttons.push({
        id: button.id,
        text: button.text,
        type: button.type,
        disabled: button.disabled,
        visible: button.visible !== false,
      })
    }
  })

  return {
    url,
    title,
    text,
    fields,
    buttons,
    frames: frames.length,
    capturedAt: Date.now(),
  }
}

export async function fillFields(
  webContentsId: number,
  entries: BrowserFillEntry[],
  options: { highlight?: boolean } = {},
): Promise<BrowserFillResult> {
  const wc = assertGuest(webContentsId)
  if (!Array.isArray(entries) || entries.length === 0) {
    return { filled: 0, skipped: 0, details: [] }
  }
  const frames = frameList(wc)
  const highlight = options.highlight !== false
  const safeEntries = entries
    .filter((entry) => entry && typeof entry.id === 'string' && typeof entry.value === 'string')
    .slice(0, 200)
  if (safeEntries.length === 0) return { filled: 0, skipped: 0, details: [] }
  const results = await Promise.all(
    frames.map(async (frame, index) => {
      try {
        const result = await frame.executeJavaScript(buildFillScript(index, safeEntries, highlight), true)
        return Array.isArray(result) ? result : []
      } catch {
        return []
      }
    }),
  )

  const details = results.flat() as BrowserFillResult['details']
  return {
    filled: details.filter((d) => d.status === 'filled').length,
    skipped: details.filter((d) => d.status !== 'filled').length,
    details,
  }
}

export async function undoFill(webContentsId: number): Promise<number> {
  const wc = assertGuest(webContentsId)
  const frames = frameList(wc)
  const counts = await Promise.all(
    frames.map(async (frame) => {
      try {
        const count = await frame.executeJavaScript(buildUndoScript(), true)
        return typeof count === 'number' ? count : 0
      } catch {
        return 0
      }
    }),
  )
  return counts.reduce((sum, value) => sum + value, 0)
}

export async function clickElement(
  webContentsId: number,
  target: { id?: string; text?: string },
): Promise<{ ok: boolean; message?: string }> {
  const wc = assertGuest(webContentsId)
  const frames = frameList(wc)
  if (!target || (typeof target.id !== 'string' && typeof target.text !== 'string')) {
    throw new Error('Indica el botón que quieres pulsar.')
  }
  for (let index = 0; index < frames.length; index++) {
    try {
      const result = await frames[index].executeJavaScript(buildClickScript(index, target), true) as
        | { ok?: boolean; message?: string }
        | null
      if (result?.ok) return { ok: true }
      if (target.id && result?.message === 'not-found') continue
    } catch {
      // se intenta en el siguiente frame
    }
  }
  return { ok: false, message: 'No se encontró el botón o enlace.' }
}

export async function navigate(webContentsId: number, url: string): Promise<void> {
  const wc = assertGuest(webContentsId)
  if (typeof url !== 'string' || url.length > 4096) throw new Error('Dirección no válida.')
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error('Dirección no válida.')
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Solo se permiten direcciones http/https.')
  }
  await withTimeout(wc.loadURL(parsed.toString()), 25000, 'La página tardó demasiado en cargar.')
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

export async function getBrowserState(): Promise<BrowserState> {
  try {
    const { browserFile } = await getActiveProfileFiles()
    const raw = await readJSON<unknown>(browserFile)
    return normalizeBrowserState(raw ?? createDefaultBrowserState())
  } catch {
    return createDefaultBrowserState()
  }
}

export async function saveBrowserState(state: unknown, profileId?: string | null): Promise<BrowserState> {
  const normalized = normalizeBrowserState(state)
  const safeId = typeof profileId === 'string' && /^[A-Za-z0-9_-]+$/.test(profileId) ? profileId : null
  const browserFile = safeId ? profileBrowserFile(safeId) : (await getActiveProfileFiles()).browserFile
  await ensureParentDir(browserFile)
  await writeJSON(browserFile, normalized)
  return normalized
}

export async function listCvs(): Promise<BrowserCvOption[]> {
  const profile = await getActiveProfile()
  const options: BrowserCvOption[] = []

  if (profile) {
    options.push({
      id: 'profile',
      label: 'CV desde mi perfil',
      style: 'ats',
      createdAt: 0,
    })
  }

  const { jobsFile, cvVersionsFile } = await getActiveProfileFiles()
  const jobs = (await readJSON<JobApplication[]>(jobsFile)) ?? []
  const versions = (await readJSON<Record<string, CvVersion[]>>(cvVersionsFile)) ?? {}

  for (const job of jobs) {
    const jobLabel = [job.position, job.company].filter(Boolean).join(' — ') || 'CV'
    if (job.cvContent && job.cvContent.trim()) {
      options.push({
        id: `job:${job.id}`,
        jobId: job.id,
        label: jobLabel,
        style: job.cvStyle,
        createdAt: job.updatedAt || job.createdAt || 0,
      })
    }
    const jobVersions = versions[job.id] || []
    jobVersions.forEach((version, index) => {
      if (!version.content || !version.content.trim()) return
      options.push({
        id: `version:${job.id}:${index}`,
        jobId: job.id,
        label: `${jobLabel} (v${jobVersions.length - index})`,
        style: version.style,
        createdAt: version.createdAt || 0,
      })
    })
  }

  return options.sort((a, b) => b.createdAt - a.createdAt).slice(0, 60)
}

interface ResolvedCv {
  html: string
  style: string | null
  label: string
}

async function resolveCv(cvId?: string | null): Promise<ResolvedCv | null> {
  const { jobsFile, cvVersionsFile } = await getActiveProfileFiles()
  const jobs = (await readJSON<JobApplication[]>(jobsFile)) ?? []
  const versions = (await readJSON<Record<string, CvVersion[]>>(cvVersionsFile)) ?? {}

  const fromJob = (job: JobApplication): ResolvedCv | null => {
    if (!job.cvContent || !job.cvContent.trim()) return null
    return {
      html: job.cvContent,
      style: job.cvStyle,
      label: [job.position, job.company].filter(Boolean).join(' — ') || 'CV',
    }
  }

  if (cvId === 'profile') {
    const profile = await getActiveProfile()
    if (!profile) return null
    return { html: buildProfileCvHtml(profile), style: 'ats', label: 'CV desde mi perfil' }
  }

  if (cvId?.startsWith('job:')) {
    const job = jobs.find((item) => item.id === cvId.slice('job:'.length))
    return job ? fromJob(job) : null
  }

  if (cvId?.startsWith('version:')) {
    const rest = cvId.slice('version:'.length)
    const separator = rest.lastIndexOf(':')
    const jobId = separator >= 0 ? rest.slice(0, separator) : ''
    const index = separator >= 0 ? Number(rest.slice(separator + 1)) : NaN
    const job = jobs.find((item) => item.id === jobId)
    const version = job ? (versions[job.id] || [])[index] : undefined
    if (job && version?.content) {
      return {
        html: version.content,
        style: version.style,
        label: [job.position, job.company].filter(Boolean).join(' — ') || 'CV',
      }
    }
    return null
  }

  const latestJob = [...jobs]
    .filter((job) => job.cvContent && job.cvContent.trim())
    .sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0))[0]
  if (latestJob) return fromJob(latestJob)

  for (const job of jobs) {
    const version = (versions[job.id] || []).find((item) => item.content && item.content.trim())
    if (version) {
      return {
        html: version.content,
        style: version.style,
        label: [job.position, job.company].filter(Boolean).join(' — ') || 'CV',
      }
    }
  }

  const profile = await getActiveProfile()
  if (!profile) return null
  return { html: buildProfileCvHtml(profile), style: 'ats', label: 'CV desde mi perfil' }
}

async function cleanupOldUploads(dir: string): Promise<void> {
  try {
    const names = await fs.readdir(dir)
    await Promise.all(
      names.map(async (name) => {
        const file = path.join(dir, name)
        const stat = await fs.stat(file).catch(() => null)
        if (stat && Date.now() - stat.mtimeMs > 24 * 60 * 60 * 1000) {
          await fs.unlink(file).catch(() => undefined)
        }
      }),
    )
  } catch {
    // limpieza best-effort
  }
}

function slug(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'CV'
}

export async function attachCv(
  webContentsId: number,
  fieldId: string,
  cvId?: string | null,
): Promise<BrowserAttachResult> {
  const wc = assertGuest(webContentsId)
  const cv = await resolveCv(cvId)
  if (!cv) throw new Error('No hay ningún CV disponible para adjuntar.')

  const dir = path.join(app.getPath('userData'), 'temp', 'aplica-uploads')
  await fs.mkdir(dir, { recursive: true })
  void cleanupOldUploads(dir)
  const filePath = path.join(dir, `CV-${slug(cv.label)}-${Date.now()}.pdf`)
  await fs.writeFile(filePath, await renderCvPdf(cv.html, cv.style || 'ats'))

  const safeFieldId = String(fieldId || '').replace(/[^a-zA-Z0-9_-]/g, '')
  if (!safeFieldId) throw new Error('Campo de archivo no válido.')
  const selector = `input[type="file"][data-aplica-field="${safeFieldId}"]`
  const wasAttached = wc.debugger.isAttached()
  try {
    if (!wasAttached) wc.debugger.attach('1.3')
    try {
      await wc.debugger.sendCommand('DOM.enable')
    } catch {
      // DOM.enable no siempre es necesario
    }
    const flattened = (await wc.debugger.sendCommand('DOM.getFlattenedDocument', {
      depth: -1,
      pierce: true,
    })) as {
      nodes?: { nodeName?: string; backendNodeId?: number; attributes?: string[] }[]
    }
    const match = (flattened?.nodes || []).find((node) => {
      if (node.nodeName !== 'INPUT' || !Array.isArray(node.attributes)) return false
      for (let index = 0; index < node.attributes.length; index += 2) {
        if (node.attributes[index] === 'data-aplica-field' && node.attributes[index + 1] === safeFieldId) {
          return true
        }
      }
      return false
    })
    if (match?.backendNodeId) {
      await wc.debugger.sendCommand('DOM.setFileInputFiles', {
        files: [filePath],
        backendNodeId: match.backendNodeId,
      })
      return { ok: true, filePath, label: cv.label }
    }

    const document = (await wc.debugger.sendCommand('DOM.getDocument', { depth: -1, pierce: true })) as {
      root?: { nodeId?: number }
    }
    const rootNodeId = document?.root?.nodeId
    if (!rootNodeId) throw new Error('No se pudo inspeccionar la página.')
    const query = (await wc.debugger.sendCommand('DOM.querySelectorAll', { nodeId: rootNodeId, selector })) as {
      nodeIds?: number[]
    }
    const nodeId = query?.nodeIds?.[0]
    if (!nodeId) {
      return {
        ok: false,
        filePath,
        label: cv.label,
        message: 'No se encontró el campo de archivo. Arrastra el PDF manualmente.',
      }
    }
    await wc.debugger.sendCommand('DOM.setFileInputFiles', { files: [filePath], nodeId })
    return { ok: true, filePath, label: cv.label }
  } catch (error) {
    return {
      ok: false,
      filePath,
      label: cv.label,
      message: `No se pudo adjuntar automáticamente (${error instanceof Error ? error.message : String(error)}). Arrastra el PDF manualmente.`,
    }
  } finally {
    if (!wasAttached && wc.debugger.isAttached()) {
      try {
        wc.debugger.detach()
      } catch {
        // ignore
      }
    }
  }
}

export async function getProfileForAgent(): Promise<Profile | null> {
  return getActiveProfile()
}
