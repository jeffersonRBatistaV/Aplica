import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import QRCode from 'qrcode'
import { readJSON, writeJSON, ensureDir } from './storage'
import { SETTINGS_FILE, WHATSAPP_SESSION_DIR } from '../utils/paths'
import { getActiveProfileFiles } from './profile-data'
import { extractTextFromImage } from './ocr-service'
import {
  classifyCategory,
  detectVacancy,
  looksLikeVacancy,
  isVacancyCandidate,
  phoneFromAuthor,
  buildVacancyId,
  contentFingerprint,
  DETECTOR_VERSION,
  GENERAL_CATEGORY,
  VACANCY_CATEGORIES,
} from '../../shared/vacancy-detection'
import { isVacancyForProfile } from '../../shared/profile-match'
import { completeChatCompletion } from './llm-service'
import { getActiveProfile } from './profile-scope'
import type {
  AppSettings,
  JobApplication,
  WhatsAppConfig,
  WhatsAppGroup,
  WhatsAppScanResult,
  WhatsAppStatus,
  WhatsAppVacancy,
} from '../../shared/types'

export interface WhatsAppStatusEvent {
  status: WhatsAppStatus
  qr?: string
  message?: string
  hasSession?: boolean
}

export type WhatsAppServiceEvent =
  | { type: 'status'; payload: WhatsAppStatusEvent }
  | { type: 'vacancy'; payload: WhatsAppVacancy }
  | { type: 'phase'; payload: string }

type WhatsAppEventListener = (event: WhatsAppServiceEvent) => void
type WaClient = import('whatsapp-web.js').Client
type WaMessage = import('whatsapp-web.js').Message

let wwaModule: { Message?: unknown } | null = null

let debugLogEnabled = false

function debugLog(line: string): void {
  if (!debugLogEnabled) return
  try {
    const file = path.join(app.getPath('userData'), 'whatsapp-scan-debug.log')
    fs.appendFileSync(file, `[${new Date().toISOString()}] ${line}\n`)
  } catch {
    /* diagnostics are best-effort */
  }
}

async function getWaMessageCtor(): Promise<any | null> {
  if (!wwaModule) {
    const wwa = (await import('whatsapp-web.js')) as { default?: unknown }
    wwaModule = (wwa.default ?? wwa) as { Message?: unknown }
  }
  return wwaModule?.Message ?? null
}

interface WhatsAppStore {
  config: WhatsAppConfig
  queue: WhatsAppVacancy[]
  processedMessageIds: string[]
  /** Versión del detector con la que se marcaron los processedMessageIds. */
  detectorVersion?: number
}

const MAX_PROCESSED_IDS = 3000

const REALTIME_INTERVAL_MS = 3000
const REALTIME_BATCH = 5
/** Sondeo de grupos/canales monitoreados (los canales no emiten 'message'). */
const REALTIME_POLL_MS = 2 * 60 * 1000
const REALTIME_POLL_LIMIT = 15

const READY_TIMEOUT_MS = 60000

let client: WaClient | null = null
let status: WhatsAppStatus = 'disconnected'
let qrDataUrl: string | null = null
let statusMessage: string | null = null
let readyWatchdog: NodeJS.Timeout | null = null

function clearReadyWatchdog(): void {
  if (readyWatchdog) {
    clearTimeout(readyWatchdog)
    readyWatchdog = null
  }
}

function armReadyWatchdog(newClient: WaClient): void {
  clearReadyWatchdog()
  readyWatchdog = setTimeout(() => {
    readyWatchdog = null
    if (status === 'authenticated') {
      status = 'failed'
      statusMessage =
        'La conexión quedó autenticada pero no llegó a estar lista. Si el problema persiste, revisa que la carpeta de instalación tenga permisos de escritura.'
      emitStatus()
      if (client === newClient) client = null
    }
  }, READY_TIMEOUT_MS)
}
let realtimeHandler: ((msg: WaMessage) => void) | null = null
let realtimeOn = false
let realtimeTimer: NodeJS.Timeout | null = null
const realtimePending: WaMessage[] = []
let realtimePollTimer: NodeJS.Timeout | null = null
let pollRunning = false
let scanRunning = false
/** Nombre de cada grupo/canal (para no depender de msg.getChat(), que falla en canales). */
const groupNames = new Map<string, string>()
let ocrChain: Promise<unknown> = Promise.resolve()
const listeners = new Set<WhatsAppEventListener>()
const monitoredGroups = new Set<string>()

function withOcrLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = ocrChain.then(fn, fn)
  ocrChain = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

const PAGE_HEALTH_TIMEOUT_MS = 8000
const MEDIA_DOWNLOAD_TIMEOUT_MS = 30000
const STORE_READY_TIMEOUT_MS = 30000
const RECONNECT_TIMEOUT_MS = 90000

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout | null = null
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label}: timeout (${ms}ms)`)), ms)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/**
 * Errores que indican que la página de WhatsApp Web quedó inservible
 * (frame desacoplado, target cerrado, contexto destruido por navegación…).
 * En estos casos hay que reconectar en vez de asumir "sin mensajes".
 */
const PAGE_ERROR_PATTERNS = [
  'detached frame',
  'target closed',
  'session closed',
  'execution context was destroyed',
  'cannot find context',
  'protocol error',
  'page crashed',
  'navigating frame',
  'node with given id does not belong',
]

function isPageLevelError(message: string): boolean {
  const lower = message.toLowerCase()
  return PAGE_ERROR_PATTERNS.some((pattern) => lower.includes(pattern))
}

function emit(event: WhatsAppServiceEvent): void {
  for (const listener of listeners) {
    try {
      listener(event)
    } catch {
      /* listener error is not fatal */
    }
  }
}

function emitStatus(): void {
  emit({ type: 'status', payload: getStatusEvent() })
}

function hasStoredSession(): boolean {
  try {
    const localState = path.join(WHATSAPP_SESSION_DIR, 'session-aplica', 'Default', 'Local State')
    const indexedDb = path.join(WHATSAPP_SESSION_DIR, 'session-aplica', 'Default', 'IndexedDB')
    if (fs.existsSync(indexedDb)) {
      const entries = fs.readdirSync(indexedDb)
      if (entries.some((e) => e.toLowerCase().includes('whatsapp'))) return true
    }
    if (fs.existsSync(localState)) return true
  } catch {
    /* session check errors are non-fatal */
  }
  return false
}

export function getStatusEvent(): WhatsAppStatusEvent {
  return {
    status,
    qr: qrDataUrl ?? undefined,
    message: statusMessage ?? undefined,
    hasSession: hasStoredSession(),
  }
}

export function onWhatsAppServiceEvent(listener: WhatsAppEventListener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function isWhatsAppConnected(): boolean {
  return status === 'connected' && !!client
}

function getLLMConfig(settings: AppSettings | null): { baseUrl: string; apiKey: string; model: string } | null {
  if (!settings?.api?.baseUrl) return null
  return {
    baseUrl: settings.api.baseUrl,
    apiKey: settings.api.apiKey || '',
    model: settings.api.model,
  }
}

function cleanBrowserLocks(dir: string): void {
  // `lockfile` es el mutex de Chromium en Windows: puppeteer lo detecta tras un
  // fallo de lanzamiento y lanza "The browser is already running for…"
  // aunque ya no haya proceso vivo (BrowserLauncher.js en puppeteer-core).
  const locks = ['SingletonLock', 'SingletonSocket', 'SingletonCookie', 'lockfile']
  for (const name of locks) {
    try {
      const p = path.join(dir, name)
      if (fs.existsSync(p)) fs.unlinkSync(p)
    } catch {
      /* best-effort cleanup */
    }
  }
}

const execFileAsync = promisify(execFile)

/**
 * Mata procesos de navegador (Edge/Chrome/Chromium/headless_shell) que tengan
 * el perfil de WhatsApp en su command line. Necesario en Windows porque el
 * mutex del perfil no se libera si el proceso quedó huérfano tras un crash,
 * y ningún archivo de lock se puede borrar mientras el proceso viva.
 */
async function killBrowserProcessesForProfile(profileDir: string): Promise<void> {
  const escaped = profileDir.replace(/'/g, "''")
  try {
    if (process.platform === 'win32') {
      const script =
        "Get-CimInstance Win32_Process | " +
        "Where-Object { $_.Name -match '^(msedge|chrome|chromium|headless)' -and $_.CommandLine -like '*" +
        escaped +
        "*' } | " +
        'ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }'
      await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
        windowsHide: true,
        timeout: 10000,
      })
    } else {
      await execFileAsync('pkill', ['-f', profileDir], { timeout: 10000 })
    }
  } catch {
    /* pkill/pgrep devuelven exit code si no hay coincidencias; no importa */
  }
}

function resolveBrowserExecutable(): string | undefined {
  const envPath = process.env.PUPPETEER_EXECUTABLE_PATH
  if (envPath && fs.existsSync(envPath)) return envPath
  const candidates = [
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  ]
  if (process.platform === 'darwin') {
    candidates.push(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    )
  }
  if (process.platform === 'linux') {
    candidates.push(
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/microsoft-edge',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
    )
  }
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate
  }
  return undefined
}

interface ProcessMessageResult {
  vacancy: WhatsAppVacancy | null
  /** Detectada pero descartada por no ser de tu área (filtro del perfil). */
  filteredByArea?: boolean
  /**
   * true cuando el mensaje tenía media pero ya no está disponible (expirada/evicted)
   * o el OCR falló. Se marca como procesado: reintentar no ayuda.
   */
  mediaUnavailable: boolean
  /**
   * true cuando la DESCARGA falló con error (whatsapp-web.js incompatible con WhatsApp
   * Web, red…). No se marca como procesado para reintentarlo en el siguiente escaneo:
   * antes quedaba marcado para siempre y el flyer nunca pasaba por OCR.
   */
  mediaError?: boolean
}

/**
 * ¿Se marca el mensaje como procesado? Sí cuando hay detección, cuando no hay media o
 * cuando la media ya no existe (expirada/evicted). Las imágenes descargadas y sin
 * detectar se re-OCRean luego. Si la descarga FALLÓ, solo se analizó el texto que
 * acompaña a la imagen ("info en el flyer"): aunque el filtro de área lo descarte, se
 * reintenta en el próximo escaneo con el texto de la imagen.
 */
function isMessageDone(msg: WaMessage, r: ProcessMessageResult): boolean {
  if (r.vacancy || !msg.hasMedia || r.mediaUnavailable) return true
  return !!r.filteredByArea && !r.mediaError
}

/** Tras N descargas fallidas seguidas se dejan de intentar un rato (evita escaneos eternos). */
const MAX_CONSECUTIVE_MEDIA_ERRORS = 5
const MEDIA_SUSPEND_MS = 10 * 60 * 1000
let consecutiveMediaErrors = 0
let mediaSuspendedUntil = 0

function resetMediaErrorTracking(): void {
  consecutiveMediaErrors = 0
  mediaSuspendedUntil = 0
}

function noteMediaDownload(ok: boolean, logDebug?: (line: string) => void): void {
  if (ok) {
    consecutiveMediaErrors = 0
    return
  }
  consecutiveMediaErrors++
  if (consecutiveMediaErrors === MAX_CONSECUTIVE_MEDIA_ERRORS) {
    mediaSuspendedUntil = Date.now() + MEDIA_SUSPEND_MS
    const note = 'No se pudieron descargar las imágenes de WhatsApp (varios fallos seguidos): los flyers no se están leyendo. Se reintentarán en el próximo escaneo; si sigue pasando, actualiza Aplica.'
    logDebug?.(`  ocr: ${note}`)
    console.warn('[wa:ocr]', note)
    emit({ type: 'phase', payload: note })
  }
}

async function downloadMessageMedia(
  msg: WaMessage,
  logDebug?: (line: string) => void,
): Promise<{ mimetype: string; data: string } | undefined> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const media = await withTimeout(msg.downloadMedia(), MEDIA_DOWNLOAD_TIMEOUT_MS, 'downloadMedia')
      if (media?.data) return { mimetype: media.mimetype, data: media.data }
      // downloadMedia devuelve undefined cuando el media ya no está disponible
      // (mensaje evacuado del store o media expirada): reintentar no ayuda.
      return undefined
    } catch (err) {
      if (attempt === 2) throw err
      logDebug?.(`  ocr: reintento de descarga (${err instanceof Error ? err.message : String(err)})`)
      await new Promise((resolve) => setTimeout(resolve, 600))
    }
  }
  return undefined
}

/** Presupuesto de llamadas a la IA por escaneo (evita escaneos eternos/caros). */
const AI_BUDGET_PER_SCAN = 60
let aiBudget = AI_BUDGET_PER_SCAN

interface AiVerdict {
  isVacancy: boolean
  title?: string
  company?: string
  category?: string
  email?: string
  phone?: string
  url?: string
}

function parseJsonObject(raw: string): Record<string, unknown> | null {
  const cleaned = raw.replace(/```(?:json)?/gi, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1))
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null
  } catch {
    return null
  }
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() && !/^(null|n\/a|none|desconocid[oa])$/i.test(v.trim()) ? v.trim() : undefined
}

/** Pide a la IA que confirme si el mensaje es una oferta de empleo y extraiga sus datos. */
async function classifyWithAi(text: string, logDebug?: (line: string) => void): Promise<AiVerdict | null> {
  if (aiBudget <= 0) return null
  const store = await readStore()
  if (store.config.aiAssist === false) return null
  const settings = await readJSON<AppSettings>(SETTINGS_FILE)
  const llm = getLLMConfig(settings)
  if (!llm || !settings?.api?.configured) return null
  aiBudget--
  const system = [
    'Clasificas mensajes de grupos de WhatsApp de empleo. Responde SOLO un objeto JSON, sin markdown.',
    'isVacancy=true solo si el mensaje OFRECE un puesto de trabajo, pasantía o freelance (alguien contrata).',
    'isVacancy=false para: personas buscando empleo, cursos, ventas, publicidad, cadenas, saludos, estafas evidentes ("gana dinero desde casa sin experiencia" con pagos por adelantado).',
    `category debe ser exactamente una de: ${VACANCY_CATEGORIES.join(' | ')}.`,
    'title: el puesto concreto (p. ej. "Desarrollador Backend Node.js"), nunca frases genéricas como "Estamos contratando".',
    'company: nombre de la empresa si aparece; si no, null. email/phone/url: el contacto para postular si aparece; si no, null.',
    'Formato: {"isVacancy": boolean, "title": string|null, "company": string|null, "category": string, "email": string|null, "phone": string|null, "url": string|null}',
  ].join('\n')
  try {
    const raw = await completeChatCompletion(
      llm,
      [
        { role: 'system', content: system },
        { role: 'user', content: text.slice(0, 3500) },
      ],
      undefined,
      'whatsapp_classify',
      settings?.privacy?.excludeFromTraining,
    )
    const obj = parseJsonObject(raw)
    if (!obj) {
      logDebug?.(`  ai: respuesta no JSON (${raw.slice(0, 80)})`)
      return null
    }
    const category = str(obj.category)
    return {
      isVacancy: obj.isVacancy === true || obj.isVacancy === 'true',
      title: str(obj.title),
      company: str(obj.company),
      category: category && VACANCY_CATEGORIES.includes(category) ? category : undefined,
      email: str(obj.email),
      phone: str(obj.phone),
      url: str(obj.url),
    }
  } catch (err) {
    logDebug?.(`  ai: ERROR ${err instanceof Error ? err.message : String(err)}`)
    return null
  }
}

/** Construye la vacante a partir del veredicto de la IA (mensaje que la heurística no confirmó). */
function vacancyFromAi(
  verdict: AiVerdict,
  combined: string,
  ocrText: string,
  author: string,
  groupName: string,
  groupId: string,
  messageTime: number,
): WhatsAppVacancy | null {
  const email = verdict.email || combined.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)?.[0]
  const sourceUrl = verdict.url || combined.match(/https?:\/\/[^\s)<>]+/i)?.[0]
  const phone = verdict.phone || (!email && !sourceUrl ? phoneFromAuthor(author) : undefined)
  if (!email && !phone && !sourceUrl) return null
  const title = verdict.title || 'Vacante detectada'
  const company = verdict.company || groupName
  const category = verdict.category || classifyCategory(combined, title)
  return {
    id: buildVacancyId(groupId, { email, phone, sourceUrl, title, company, category }),
    fingerprint: contentFingerprint({ email, phone, sourceUrl, title, company, category, groupName }),
    title,
    company,
    category,
    snippet: combined.slice(0, 200),
    vacancyText: combined,
    groupId,
    groupName,
    messageTime,
    author,
    hasImage: !!ocrText,
    ocrText: ocrText || undefined,
    email,
    phone,
    sourceUrl,
    aiVerified: true,
  }
}

async function processMessage(
  msg: WaMessage,
  groupName: string,
  groupId: string,
  logDebug?: (line: string) => void,
): Promise<ProcessMessageResult> {
  if (msg.fromMe) return { vacancy: null, mediaUnavailable: false }
  const body = msg.body || ''
  let ocrText = ''
  let mediaUnavailable = false
  let mediaError = false
  const mime = String((msg as { _data?: { mimetype?: string } })._data?.mimetype || '')
  // Los documentos solo se pasan por OCR si son imágenes; un PDF o DOCX no es OCR-able
  // y antes rompía el OCR (el texto del pie del documento sí se analiza).
  const ocrable = msg.type === 'image' || (msg.type === 'document' && /^image\//i.test(mime))
  if (msg.hasMedia && ocrable && Date.now() < mediaSuspendedUntil) {
    mediaError = true
    logDebug?.('  ocr: descargas en pausa por fallos seguidos (se reintenta en el próximo escaneo)')
  } else if (msg.hasMedia && ocrable) {
    let downloadFailed = false
    try {
      const downloaded = await withOcrLock(async () => {
        let media: { mimetype: string; data: string } | undefined
        try {
          media = await downloadMessageMedia(msg, logDebug)
        } catch (err) {
          downloadFailed = true
          throw err
        }
        noteMediaDownload(true)
        if (!media) {
          logDebug?.('  ocr: downloadMedia sin data (media no disponible)')
          return false
        }
        const dataUrl = `data:${media.mimetype};base64,${media.data}`
        const buffer = Buffer.from(media.data, 'base64')
        const settings = await readJSON<AppSettings>(SETTINGS_FILE)
        const llmCfg = getLLMConfig(settings)
        logDebug?.(`  ocr: media ${media.mimetype} ${buffer.length}B vision=${!!llmCfg}`)
        ocrText = await extractTextFromImage(buffer, dataUrl, llmCfg)
        logDebug?.(`  ocr: resultado ${ocrText.length} chars`)
        return true
      })
      mediaUnavailable = !downloaded
    } catch (err) {
      if (downloadFailed) {
        mediaError = true
        noteMediaDownload(false, logDebug)
      } else {
        mediaUnavailable = true
      }
      const detail = err instanceof Error ? `${err.message} | ${err.stack ?? ''}` : String(err)
      logDebug?.(`  ocr: ERROR ${downloadFailed ? 'descarga' : 'ocr'}: ${detail}`)
      console.error('[wa:ocr]', err)
    }
  }

  const author = msg.author || ''
  const messageTime = msg.timestamp * 1000
  const combined = [body, ocrText].filter(Boolean).join('\n')
  let vacant = detectVacancy(body, ocrText, author, groupName, groupId, messageTime)

  if (vacant) {
    // Detectada por heurística: si el puesto o el área quedaron genéricos, la IA los afina.
    if (vacant.title === 'Vacante detectada' || vacant.category === GENERAL_CATEGORY) {
      const verdict = await classifyWithAi(combined, logDebug)
      if (verdict && !verdict.isVacancy) {
        logDebug?.('  ai: descartada (no es oferta)')
        vacant = null
      } else if (verdict) {
        vacant = {
          ...vacant,
          title: verdict.title || vacant.title,
          company: verdict.company || vacant.company,
          category: verdict.category || vacant.category,
          aiVerified: true,
        }
      }
    }
  } else if (isVacancyCandidate(combined)) {
    // Dudoso: la heurística no lo confirma pero tiene pinta de oferta → que decida la IA.
    const verdict = await classifyWithAi(combined, logDebug)
    if (verdict?.isVacancy) {
      vacant = vacancyFromAi(verdict, combined, ocrText, author, groupName, groupId, messageTime)
      logDebug?.(`  ai: ${vacant ? 'vacante confirmada' : 'vacante sin contacto'}`)
    }
  }

  if (vacant) {
    const outcome = await addToQueue(vacant)
    return { vacancy: outcome === 'filtered' ? null : vacant, mediaUnavailable, mediaError, filteredByArea: outcome === 'filtered' }
  }
  return { vacancy: null, mediaUnavailable, mediaError }
}

async function readStore(): Promise<WhatsAppStore> {
  const file = (await getActiveProfileFiles()).whatsappFile
  await ensureDir(path.dirname(file))
  const data = await readJSON<WhatsAppStore>(file)
  if (data && Array.isArray(data.queue)) {
    // Detector nuevo → los mensajes descartados con el detector viejo se re-evalúan una vez.
    if (data.detectorVersion !== DETECTOR_VERSION) {
      data.processedMessageIds = []
      data.detectorVersion = DETECTOR_VERSION
      await writeJSON(file, data)
    }
    if (!Array.isArray(data.processedMessageIds)) data.processedMessageIds = []
    return data
  }
  return {
    config: { monitoredGroups: [], realtime: false, strictAreaFilter: false, aiAssist: true, vacancyQueue: [], processedMessageIds: [] },
    queue: [],
    processedMessageIds: [],
    detectorVersion: DETECTOR_VERSION,
  }
}

async function writeStore(store: WhatsAppStore): Promise<void> {
  const file = (await getActiveProfileFiles()).whatsappFile
  await ensureDir(path.dirname(file))
  await writeJSON(file, store)
}

/** Últimos 8 dígitos: "+1 (809) 555-1234" y "8095551234" son el mismo teléfono. */
function phoneKey(value: string | undefined): string {
  const digits = (value || '').replace(/\D/g, '')
  return digits.length >= 8 ? digits.slice(-8) : ''
}

function wordSet(text: string): Set<string> {
  const words = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .match(/[a-z]{4,}/g)
  return new Set(words || [])
}

/** Jaccard de palabras: la misma oferta corregida por la IA sigue siendo muy parecida. */
function textSimilarity(a: string, b: string): number {
  const A = wordSet(a.slice(0, 1500))
  const B = wordSet(b.slice(0, 1500))
  if (A.size === 0 || B.size === 0) return 0
  let common = 0
  for (const w of A) if (B.has(w)) common++
  return common / (A.size + B.size - common)
}

/**
 * La vacante ya está en tus postulaciones (mismo contacto y texto parecido). Así un
 * re-escaneo, o la misma oferta reenviada a otro grupo, no vuelve a la cola de revisión.
 */
async function isAlreadySavedAsJob(vacancy: WhatsAppVacancy): Promise<boolean> {
  const email = vacancy.email?.trim().toLowerCase()
  const phone = phoneKey(vacancy.phone)
  const url = vacancy.sourceUrl?.trim().toLowerCase()
  if (!email && !phone && !url) return false
  const jobs = (await readJSON<JobApplication[]>((await getActiveProfileFiles()).jobsFile)) ?? []
  const text = vacancy.vacancyText || vacancy.snippet || ''
  return jobs.some((job) => {
    const jobText = (job.vacancyText || '').toLowerCase()
    const sameContact =
      (!!email && ((job.recipientEmail || '').toLowerCase() === email || jobText.includes(email))) ||
      (!!phone && (phoneKey(job.recipientPhone) === phone || (jobText.match(/\+?\d[\d\s\-().]{6,}\d/g) || []).some((p) => phoneKey(p) === phone))) ||
      (!!url && jobText.includes(url))
    return sameContact && textSimilarity(text, job.vacancyText || '') >= 0.4
  })
}

async function addToQueue(vacancy: WhatsAppVacancy): Promise<'added' | 'duplicate' | 'filtered'> {
  const store = await readStore()
  const strict = store.config.strictAreaFilter ?? false
  const profile = await getActiveProfile().catch(() => null)
  if (profile && !isVacancyForProfile(vacancy, profile, strict)) {
    console.log(
      `[wa:queue] descartada por área: "${vacancy.title}" (${vacancy.category}) vs perfil (${profile.area} · ${profile.title}) strict=${strict}`,
    )
    return 'filtered'
  }
  // Dedup 1: id determinista de grupo (mismo grupo + misma clave de contacto → mismo id).
  if (store.queue.some((v) => v.id === vacancy.id)) return 'duplicate'
  // Dedup 2: huella global de contenido (sin groupId). La misma oferta publicada en
  // distintos grupos o mensajes (p. ej. realtime + escaneo profundo, o 2 grupos con la
  // misma vacante) produce la misma huella → no se añade dos veces a la cola.
  if (vacancy.fingerprint && store.queue.some((v) => v.fingerprint === vacancy.fingerprint)) {
    console.log(`[wa:queue] dedupe por huella: "${vacancy.title}" en ${vacancy.groupName} ya en cola`)
    return 'duplicate'
  }
  if (await isAlreadySavedAsJob(vacancy).catch(() => false)) {
    console.log(`[wa:queue] ya está en tus postulaciones: "${vacancy.title}" (${vacancy.groupName})`)
    return 'duplicate'
  }
  store.queue.unshift(vacancy)
  await writeStore(store)
  return 'added'
}

async function persistProcessed(serial: string): Promise<void> {
  const store = await readStore()
  if (store.processedMessageIds.includes(serial)) return
  store.processedMessageIds.unshift(serial)
  if (store.processedMessageIds.length > MAX_PROCESSED_IDS) {
    store.processedMessageIds.splice(MAX_PROCESSED_IDS)
  }
  await writeStore(store)
}

async function isProcessed(serial: string): Promise<boolean> {
  const store = await readStore()
  return store.processedMessageIds.includes(serial)
}

async function applyConfig(): Promise<void> {
  const store = await readStore()
  monitoredGroups.clear()
  for (const gid of store.config.monitoredGroups) monitoredGroups.add(gid)
  realtimeOn = store.config.realtime && monitoredGroups.size > 0
  if (realtimeOn && client) {
    if (!realtimeHandler) attachRealtimeHandler()
  } else {
    detachRealtimeHandler()
  }
}

function attachRealtimeHandler(): void {
  if (!client) return
  realtimeHandler = (msg: WaMessage) => {
    if (!realtimeOn) return
    const gid = msg.from
    if (!monitoredGroups.has(gid)) return
    const serial = messageSerial(msg)
    if (serial && !realtimePending.some((m) => messageSerial(m) === serial)) {
      realtimePending.push(msg)
      if (realtimePending.length > 50) realtimePending.splice(0, realtimePending.length - 50)
    }
  }
  client.on('message', realtimeHandler)
  realtimeTimer = setInterval(() => void flushRealtimePending(), REALTIME_INTERVAL_MS)
  // El evento 'message' de whatsapp-web.js no se emite para canales (@newsletter):
  // se sondean los últimos mensajes de cada grupo/canal monitoreado periódicamente.
  realtimePollTimer = setInterval(() => void pollMonitoredGroups(), REALTIME_POLL_MS)
  setTimeout(() => void pollMonitoredGroups(), 10_000)
}

/** Sondeo del monitoreo en tiempo real: lee los mensajes recientes y procesa los nuevos. */
async function pollMonitoredGroups(): Promise<void> {
  if (!realtimeOn || pollRunning || scanRunning || !client || status !== 'connected') return
  pollRunning = true
  try {
    if (!(await isPageHealthy())) return
    aiBudget = Math.max(aiBudget, REALTIME_BATCH * 2)
    for (const gid of [...monitoredGroups]) {
      if (!realtimeOn || scanRunning) break
      const raw = await fetchRawMessages(gid, REALTIME_POLL_LIMIT).catch(() => null)
      if (!raw || raw.diag.startsWith('evaluate err')) continue
      if (raw.name) groupNames.set(gid, raw.name)
      for (const msg of raw.messages) {
        const serial = messageSerial(msg)
        if (!serial || msg.fromMe || (await isProcessed(serial))) continue
        try {
          const result = await processMessage(msg, raw.name || gid, gid)
          if (result.vacancy) emit({ type: 'vacancy', payload: result.vacancy })
          if (isMessageDone(msg, result)) await persistProcessed(serial)
        } catch (err) {
          console.error('[wa:realtime] poll', gid, err instanceof Error ? err.message : err)
        }
      }
    }
  } finally {
    pollRunning = false
  }
}

/** id del mensaje: WhatsApp Web renombró `_serialized` → `$1` (ver AGENTS.md). */
function messageSerial(msg: WaMessage): string | undefined {
  const id = msg.id as unknown as { _serialized?: string; $1?: string } | undefined
  return id?._serialized || id?.$1 || undefined
}

function detachRealtimeHandler(): void {
  if (client && realtimeHandler) {
    client.off('message', realtimeHandler)
  }
  realtimeHandler = null
  if (realtimeTimer) {
    clearInterval(realtimeTimer)
    realtimeTimer = null
  }
  if (realtimePollTimer) {
    clearInterval(realtimePollTimer)
    realtimePollTimer = null
  }
  realtimePending.length = 0
}

async function flushRealtimePending(): Promise<void> {
  if (!realtimeOn || realtimePending.length === 0) return
  if (!(await isPageHealthy())) {
    await recoverClient('monitoreo en tiempo real: página no saludable')
    return
  }
  const batch = realtimePending.splice(0, REALTIME_BATCH)
  aiBudget = Math.max(aiBudget, REALTIME_BATCH)
  for (const msg of batch) {
    try {
      const serial = messageSerial(msg)
      if (!serial || msg.fromMe || (await isProcessed(serial))) continue
      // getChat() falla en canales: el nombre sale de la caché del sondeo o del id.
      let name = groupNames.get(msg.from)
      if (!name) {
        name = (await msg.getChat().catch(() => null))?.name || msg.from
        groupNames.set(msg.from, name)
      }
      const result = await processMessage(msg, name, msg.from)
      if (result.vacancy) emit({ type: 'vacancy', payload: result.vacancy })
      if (isMessageDone(msg, result)) await persistProcessed(serial)
    } catch (err) {
      console.error('[wa:realtime]', err instanceof Error ? err.message : err)
    }
  }
}

async function isPageHealthy(): Promise<boolean> {
  const page = client?.pupPage
  if (!page) return false
  try {
    if (page.isClosed()) return false
    await withTimeout(page.evaluate(() => true), PAGE_HEALTH_TIMEOUT_MS, 'page health')
    return true
  } catch {
    return false
  }
}

async function waitForStoreReady(timeoutMs = STORE_READY_TIMEOUT_MS): Promise<boolean> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (status !== 'connected') return false
    const page = client?.pupPage
    if (!page || page.isClosed()) return false
    try {
      const ready = await page.evaluate(() => {
        const w = window as unknown as {
          Store?: { Chat?: unknown }
          require?: (mod: string) => any
        }
        if (!w.require) return false
        try {
          const collections = w.require('WAWebCollections')
          return Boolean(collections?.Chat && w.Store?.Chat)
        } catch {
          return false
        }
      })
      if (ready) return true
    } catch {
      /* la página puede estar navegando; seguir sondeando */
    }
    await new Promise((resolve) => setTimeout(resolve, 750))
  }
  return false
}

async function waitForReadyStatus(timeoutMs: number): Promise<boolean> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (status === 'connected') return true
    if (status === 'failed') return false
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  return status === 'connected'
}

function resetClientSilently(): void {
  detachRealtimeHandler()
  clearReadyWatchdog()
  if (client) {
    try {
      void client.destroy().catch(() => undefined)
    } catch {
      /* ya cerrado */
    }
  }
  client = null
  status = 'disconnected'
  statusMessage = null
}

let recoveryInFlight: Promise<boolean> | null = null

/**
 * Recupera la conexión cuando la página de WhatsApp Web queda inservible
 * (frame desacoplado). Primero intenta recargar la página; si falla,
 * reconecta el cliente reutilizando la sesión guardada (sin QR).
 * Singleton: las reconexiones concurrentes comparten la misma promesa.
 */
async function recoverClient(reason: string): Promise<boolean> {
  if (recoveryInFlight) return recoveryInFlight
  recoveryInFlight = (async (): Promise<boolean> => {
    console.warn(`[wa:recover] ${reason}`)
    debugLog(`[recover] motivo: ${reason}`)
    emit({ type: 'phase', payload: 'Reconectando WhatsApp Web…' })

    const page = client?.pupPage
    if (page && !page.isClosed()) {
      try {
        await withTimeout(
          page.reload({ waitUntil: 'domcontentloaded' }),
          PAGE_HEALTH_TIMEOUT_MS,
          'page reload',
        )
        if (await waitForStoreReady()) {
          debugLog('[recover] recarga de página OK')
          return true
        }
        debugLog('[recover] la recarga no dejó el store listo; reconexión completa')
      } catch (err) {
        debugLog(`[recover] recarga falló: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    debugLog('[recover] reconexión completa del cliente (reusa sesión)')
    resetClientSilently()
    try {
      await connectWhatsApp()
      const ok = await waitForReadyStatus(RECONNECT_TIMEOUT_MS)
      debugLog(`[recover] reconexión ${ok ? 'OK' : 'falló'}`)
      return ok
    } catch (err) {
      debugLog(`[recover] reconexión ERROR: ${err instanceof Error ? err.message : String(err)}`)
      return false
    }
  })().finally(() => {
    recoveryInFlight = null
  })
  return recoveryInFlight
}

export async function connectWhatsApp(): Promise<WhatsAppStatusEvent> {
  if (client || status === 'connecting') return getStatusEvent()
  await ensureDir(WHATSAPP_SESSION_DIR)

  const wwa = await import('whatsapp-web.js')
  const mod = wwa.default ?? wwa
  const { Client, LocalAuth } = mod

  status = 'connecting'
  qrDataUrl = null
  statusMessage = null
  emitStatus()

  const puppeteerOptions: Record<string, unknown> = { headless: true }
  const executablePath = resolveBrowserExecutable()
  if (executablePath) puppeteerOptions.executablePath = executablePath

  const newClient = new Client({
    authStrategy: new LocalAuth({ dataPath: WHATSAPP_SESSION_DIR, clientId: 'aplica' }),
    puppeteer: puppeteerOptions,
    // Evita que whatsapp-web.js escriba el caché web en `./.wwebjs_cache/` relativo
    // al cwd (falla con EPERM en apps empaquetadas instaladas en directorios
    // protegidos, dejando la conexión atascada en 'authenticated').
    webVersionCache: {
      type: 'local',
      path: path.join(WHATSAPP_SESSION_DIR, 'web-cache'),
    },
  })

  client = newClient

  newClient.on('qr', async (qr: string) => {
    try {
      qrDataUrl = await QRCode.toDataURL(qr)
    } catch {
      qrDataUrl = null
    }
    status = 'qr'
    statusMessage = null
    clearReadyWatchdog()
    emitStatus()
  })

  newClient.on('authenticated', () => {
    status = 'authenticated'
    statusMessage = null
    armReadyWatchdog(newClient)
    emitStatus()
  })

  newClient.on('ready', async () => {
    status = 'connected'
    qrDataUrl = null
    statusMessage = null
    clearReadyWatchdog()
    emitStatus()
    await applyConfig()
  })

  newClient.on('auth_failure', (reason: string) => {
    status = 'failed'
    statusMessage = String(reason || 'auth_failure')
    clearReadyWatchdog()
    emitStatus()
    client = null
  })

  newClient.on('disconnected', (reason: string) => {
    status = 'disconnected'
    statusMessage = String(reason || 'disconnected')
    clearReadyWatchdog()
    detachRealtimeHandler()
    emitStatus()
    if (client === newClient) client = null
  })

  const sessionDir = path.join(WHATSAPP_SESSION_DIR, 'session-aplica')
  await killBrowserProcessesForProfile(sessionDir)
  cleanBrowserLocks(sessionDir)

  try {
    await newClient.initialize()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('already running') || msg.includes('userDataDir')) {
      console.log('[wa] browser lock detected, killing leftover process and retrying…')
      await killBrowserProcessesForProfile(sessionDir)
      cleanBrowserLocks(sessionDir)
      // Windows libera el mutex del perfil de forma asíncrona tras el kill
      await new Promise((resolve) => setTimeout(resolve, 1500))
      try {
        await newClient.initialize()
      } catch (retryErr) {
        status = 'failed'
        statusMessage = retryErr instanceof Error ? retryErr.message : String(retryErr)
        clearReadyWatchdog()
        emitStatus()
        client = null
        return getStatusEvent()
      }
    } else {
      status = 'failed'
      statusMessage = msg
      clearReadyWatchdog()
      emitStatus()
      client = null
      return getStatusEvent()
    }
  }

  return getStatusEvent()
}

const DESTROY_TIMEOUT_MS = 8000

/**
 * Destruye el cliente con timeout (browser.close() puede colgarse si el
 * proceso quedó insensible) y después barre procesos huérfanos + lockfiles
 * para que el próximo `initialize()` no choque con "browser is already running".
 */
async function destroyClientSafely(toDestroy: WaClient | null): Promise<void> {
  if (toDestroy) {
    try {
      await withTimeout(toDestroy.destroy(), DESTROY_TIMEOUT_MS, 'client.destroy')
    } catch {
      /* already closed, hung, or missing */
    }
  }
  const sessionDir = path.join(WHATSAPP_SESSION_DIR, 'session-aplica')
  await killBrowserProcessesForProfile(sessionDir)
  cleanBrowserLocks(sessionDir)
}

export async function disconnectWhatsApp(): Promise<void> {
  realtimeOn = false
  await destroyClientSafely(client)
  detachRealtimeHandler()
  clearReadyWatchdog()
  client = null
  status = 'disconnected'
  statusMessage = null
  emitStatus()
}

function classifyChat(id: string): 'channel' | 'group' | 'private' {
  if (id.endsWith('@newsletter')) return 'channel'
  if (id.endsWith('@g.us')) return 'group'
  return 'private'
}

export async function getWhatsAppGroups(): Promise<WhatsAppGroup[]> {
  if (!client || status !== 'connected') return []
  if (!(await isPageHealthy())) {
    console.warn('[wa:groups] página no saludable → recuperando')
    await recoverClient('getWhatsAppGroups: página no saludable')
    return []
  }
  const byId = new Map<string, WhatsAppGroup>()
  let fromApi = 0
  let fromRaw = 0

  const addTarget = (id: string, name: string): void => {
    const kind = classifyChat(id)
    if (kind === 'private') return
    byId.set(id, {
      id,
      name: name?.trim() ? name : id.split('@')[0] || 'Sin nombre',
      type: kind === 'channel' ? 'channel' : 'group',
    })
  }

  try {
    const chats = await client.getChats()
    for (const c of chats) {
      if (!c?.id?._serialized) continue
      addTarget(c.id._serialized, (c as { name?: string }).name || c.id.user || '')
      fromApi++
    }
  } catch {
    /* standard chat list unavailable; fallback below */
  }

  try {
    const channels = await client.getChannels()
    for (const ch of channels) {
      if (!ch?.id?._serialized) continue
      const c = ch as { name?: string; channelMetadata?: { name?: string } }
      addTarget(ch.id._serialized, c.name || c.channelMetadata?.name || ch.id.user || '')
      fromApi++
    }
  } catch {
    /* standard channel list unavailable; fallback below */
  }

  if (byId.size === 0 && client.pupPage) {
    try {
      const raw = await client.pupPage.evaluate(async () => {
        const collections = (window as unknown as { require?: (mod: string) => any }).require?.('WAWebCollections')
        const out: Array<{ id: string; name: string }> = []
        const pushModel = (m: unknown): void => {
          try {
            const anyM = m as { id?: { _serialized?: string }; name?: string; formattedTitle?: string; serialize?: () => any }
            const s = anyM.serialize?.() ?? {}
            const rawId = anyM.id?._serialized ?? s.id?._serialized
            if (!rawId) return
            out.push({
              id: rawId,
              name: anyM.name ?? s.name ?? anyM.formattedTitle ?? s.formattedTitle ?? '',
            })
          } catch {
            /* skip unreadable model */
          }
        }
        try {
          for (const m of collections?.Chat?.getModelsArray?.() ?? []) pushModel(m)
        } catch {
          /* chat collection unavailable */
        }
        try {
          for (const m of collections?.WAWebNewsletterCollection?.getModelsArray?.() ?? []) pushModel(m)
        } catch {
          /* newsletter collection unavailable */
        }
        return out
      })
      for (const r of raw) {
        addTarget(r.id, r.name)
        fromRaw++
      }
    } catch {
      /* raw store fallback unavailable */
    }
  }

  const result = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name))
  console.log('[wa:getWhatsAppGroups]', JSON.stringify({ fromApi, fromRaw, total: result.length }))
  return result
}

async function fetchRawMessages(
  gid: string,
  limit: number,
): Promise<{ name: string; messages: WaMessage[]; diag: string }> {
  if (!client?.pupPage) return { name: gid, messages: [], diag: 'no pupPage' }

  let raw: { name: string; messages: any[]; diag: string }
  try {
    raw = await client.pupPage.evaluate(
      async (chatId: string, limit: number) => {
        const out: { name: string; messages: any[]; diag: string } = { name: '', messages: [], diag: '' }
        const req = (window as unknown as { require?: (mod: string) => any }).require
        if (!req) {
          out.diag = 'no window.require'
          return out
        }
        const isChannel = /@\w*newsletter\b/.test(chatId)
        let wid: any
        try {
          wid = req('WAWebWidFactory').createWid(chatId)
        } catch (e: any) {
          out.diag = `createWid: ${e?.message ?? e}`
          return out
        }
        let chat: any = null
        if (isChannel) {
          try {
            const coll = req('WAWebCollections').WAWebNewsletterCollection
            chat = coll.get(chatId)
            if (!chat) {
              await req('WAWebLoadNewsletterPreviewChatAction').loadNewsletterPreviewChat(chatId)
              chat = coll.find(wid) || coll.get(chatId)
            }
            out.diag = chat ? 'channel found' : 'channel NOT found'
          } catch (e: any) {
            out.diag = `channel err: ${e?.message ?? e}`
            return out
          }
        } else {
          try {
            chat = req('WAWebCollections').Chat.get(wid)
            if (!chat) {
              chat = (await req('WAWebFindChatAction').findOrCreateLatestChat(wid))?.chat
            }
            out.diag = chat ? 'chat found' : 'chat NOT found'
          } catch (e: any) {
            out.diag = `chat err: ${e?.message ?? e}`
            return out
          }
        }
        if (!chat) return out
        const msgFilter = (m: any) =>
          !m.isNotification && m.type !== 'newsletter_notification'
        let msgs: any[] = []
        let initial = 0
        try {
          initial = chat.msgs?.getModelsArray?.().length ?? -1
          msgs = (chat.msgs?.getModelsArray?.() ?? []).filter(msgFilter)
        } catch (e: any) {
          out.diag += ` | msgs err: ${e?.message ?? e}`
        }
        let loaded = 0
        if (limit > 0) {
          while (msgs.length < limit) {
            let batch: any[] = []
            try {
              batch = await req('WAWebChatLoadMessages').loadEarlierMsgs({ chat })
            } catch (e: any) {
              out.diag += ` | load err: ${e?.message ?? e}`
              break
            }
            if (!batch || !batch.length) break
            batch = batch.filter(msgFilter)
            loaded += batch.length
            msgs = [...batch, ...msgs]
          }
          if (msgs.length > limit) {
            msgs.sort((a: any, b: any) => a.t - b.t)
            msgs = msgs.slice(msgs.length - limit)
          }
        }
        out.name = chat.formattedTitle || chat.name || chatId
        out.diag += ` | inMem=${initial} usable=${msgs.length - loaded} loaded=${loaded}`
        if (msgs.length) {
          try {
            const id0 = msgs[0]?.id
            const idStr =
              typeof id0 === 'string'
                ? id0
                : id0?._serialized ??
                  (id0
                    ? `${id0.fromMe}_${typeof id0.remote === 'object' && id0.remote ? id0.remote._serialized ?? id0.remote : id0.remote}_${id0.id}`
                    : 'no-id')
            out.diag += ` | idSample=${String(idStr).slice(0, 90)}`
          } catch {
            /* ignore */
          }
        }
        // WhatsApp Web renombró id._serialized → id.$1 (whatsapp-web.js ≥ 1.34.8 ya lo
        // normaliza). Reconstruir el id a mano sin el participante rompía la descarga de
        // imágenes en grupos: WhatsApp no encontraba el mensaje ("t: t").
        const serializeWid = (w: any) =>
          typeof w === 'object' && w ? w._serialized ?? w.$1 ?? null : w ?? null
        out.messages = msgs.map((m: any) => {
          const model = (window as any).WWebJS.getMessageModel(m)
          if (model?.id && !model.id._serialized) {
            if (model.id.$1) {
              model.id._serialized = model.id.$1
            } else {
              const remote = serializeWid(model.id.remote)
              const participant = serializeWid(model.id.participant)
              if (remote && model.id.id != null) {
                model.id._serialized =
                  `${model.id.fromMe ? 'true' : 'false'}_${remote}_${model.id.id}${participant ? `_${participant}` : ''}`
              }
            }
          }
          return model
        })
        return out
      },
      gid,
      limit,
    )
  } catch (err) {
    return {
      name: gid,
      messages: [],
      diag: `evaluate err: ${err instanceof Error ? err.message : String(err)}`,
    }
  }

  const MessageCtor = await getWaMessageCtor()
  if (!MessageCtor) return { name: raw.name || gid, messages: [], diag: `${raw.diag} | no Message ctor` }
  if (!Array.isArray(raw.messages)) return { name: raw.name || gid, messages: [], diag: `${raw.diag} | messages no array` }
  return {
    name: raw.name || gid,
    diag: raw.diag,
    messages: raw.messages.map((m) => new MessageCtor(client!, m)),
  }
}

export async function scanWhatsAppGroups(groupIds: string[], limit = 100): Promise<WhatsAppScanResult> {
  scanRunning = true
  try {
    // Si el sondeo en tiempo real está a medias, se espera a que suelte la página.
    for (let i = 0; pollRunning && i < 120; i++) await new Promise((r) => setTimeout(r, 500))
    return await runScan(groupIds, limit)
  } finally {
    scanRunning = false
  }
}

async function runScan(groupIds: string[], limit: number): Promise<WhatsAppScanResult> {
  if (!client || status !== 'connected') {
    return { vacancies: [], scanned: 0, phases: [] }
  }
  debugLogEnabled = true
  debugLog(`===== scan start: ${groupIds.join(', ')} limit=${limit}`)
  const result: WhatsAppVacancy[] = []
  const phases: string[] = []
  let scanned = 0
  let filteredCount = 0
  let mediaErrors = 0
  const strictAreaFilter = (await readStore()).config.strictAreaFilter ?? false
  aiBudget = AI_BUDGET_PER_SCAN
  // Escaneo pedido por el usuario: volver a intentar descargas aunque antes fallaran.
  resetMediaErrorTracking()
  let pageError = false
  let recovered = false
  let recoveryDisabled = false

  // Comprobación previa: si la página quedó desacoplada, recuperar antes de empezar
  // para no reportar "0 vacantes" cuando en realidad WhatsApp Web no responde.
  if (!(await isPageHealthy())) {
    debugLog('[scan] página no saludable antes de escanear → recuperando')
    pageError = true
    if (await recoverClient('comprobación previa al escaneo')) recovered = true
    else recoveryDisabled = true
  }

  for (const gid of groupIds) {
    let fetched = false
    let name = gid
    let messages: WaMessage[] = []
    for (let attempt = 0; attempt < 2 && !fetched; attempt++) {
      try {
        const raw = await fetchRawMessages(gid, limit)
        const isPageFailure = raw.diag.startsWith('evaluate err') && isPageLevelError(raw.diag)
        if (isPageFailure) {
          pageError = true
          debugLog(`[scan] ${gid} fallo de página: ${raw.diag}`)
          if (attempt === 0 && !recoveryDisabled) {
            if (await recoverClient(`${gid}: ${raw.diag}`)) {
              recovered = true
              continue
            }
            recoveryDisabled = true
          }
          phases.push(`No se pudo leer ${gid}: WhatsApp Web no responde`)
          break
        }
        name = raw.name
        messages = raw.messages
        fetched = true
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err)
        console.error('[wa:scan] fallo en', gid, detail)
        debugLog(`[scan] ${gid} EXCEPTION: ${detail}`)
        phases.push(`No se pudo leer ${gid}: ${detail}`)
        emit({ type: 'phase', payload: `No se pudo leer ${gid}: ${detail}` })
        break
      }
    }
    if (!fetched) continue

    debugLog(`[scan] ${gid} "${name}" -> ${messages.length} msgs`)
    phases.push(`Revisando ${name} (${messages.length} mensajes)`)
    emit({ type: 'phase', payload: `Revisando ${name} (${messages.length} mensajes)` })
    for (const msg of messages) {
      const serial = msg.id?._serialized
      if (!serial) {
        debugLog(`[scan]   skip: sin serial`)
        continue
      }
      if (msg.fromMe) {
        debugLog(`[scan]   ${serial} skip: fromMe`)
        continue
      }
      if (await isProcessed(serial)) {
        debugLog(`[scan]   ${serial} skip: ya procesado`)
        continue
      }
      debugLog(`[scan]   ${serial} type=${msg.type} media=${!!msg.hasMedia} bodyLen=${(msg.body || '').length}`)
      scanned++
      if (msg.hasMedia && (msg.type === 'image' || msg.type === 'document')) {
        emit({ type: 'phase', payload: `OCR ${scanned}/${messages.length} en ${name}` })
      }
      const processed = await processMessage(msg, name || gid, gid, debugLog)
      const { vacancy, filteredByArea, mediaError } = processed
      debugLog(`[scan]   ${serial} -> ${vacancy ? 'VACANTE OK' : filteredByArea ? 'filtrada por área' : 'no detectada'}`)
      if (vacancy) result.push(vacancy)
      if (filteredByArea) filteredCount++
      if (mediaError) mediaErrors++
      if (isMessageDone(msg, processed)) await persistProcessed(serial)
    }
  }
  if (filteredCount > 0) {
    const hint = strictAreaFilter
      ? ' (puedes desactivar el filtro estricto en Ajustes → WhatsApp)'
      : ' (de otra área, o de área desconocida sin relación con tu puesto ni tus habilidades)'
    const note = `${filteredCount} vacantes detectadas se descartaron por no ser de tu área${hint}`
    phases.push(note)
    emit({ type: 'phase', payload: note })
  }
  if (mediaErrors > 0) {
    const note = `${mediaErrors} imágenes no se pudieron descargar de WhatsApp; se reintentarán en el próximo escaneo`
    phases.push(note)
    emit({ type: 'phase', payload: note })
  }
  debugLog(`[scan] fin: ${scanned} revisados, ${result.length} vacantes${pageError ? ` (pageError${recovered ? ', recuperado' : ''})` : ''}`)
  debugLogEnabled = false
  if (recovered) {
    emit({ type: 'phase', payload: 'WhatsApp Web reconectado, escaneo completado' })
    phases.push('WhatsApp Web reconectado, escaneo completado')
  }
  emit({ type: 'phase', payload: `Escaneo completo: ${scanned} mensajes revisados, ${result.length} vacantes detectadas` })
  phases.push(`Escaneo completo: ${scanned} mensajes revisados, ${result.length} vacantes detectadas`)
  return { vacancies: result, scanned, phases, pageError, recovered }
}

export async function getWhatsAppQueue(): Promise<WhatsAppVacancy[]> {
  const store = await readStore()
  const profile = await getActiveProfile().catch(() => null)
  const strict = store.config.strictAreaFilter ?? false
  // Re-clasifica con el detector actual: vacantes guardadas con el clasificador antiguo
  // (p. ej. "Técnico en Refrigeración" como IT) se corrigen o se descartan.
  store.queue = store.queue
    .filter((v) => v.aiVerified || !v.vacancyText || looksLikeVacancy(v.vacancyText))
    .map((v) => (v.vacancyText && !v.aiVerified ? { ...v, category: classifyCategory(v.vacancyText, v.title) } : v))
  let queue = store.queue
  if (profile) {
    const kept = queue.filter((v) => isVacancyForProfile(v, profile, strict))
    if (kept.length !== store.queue.length) queue = kept
  }
  // WhatsApp: se conservan las vacantes que aporten algún medio de contacto
  // (correo, teléfono o enlace). Solo se descartan las que no traen ninguno.
  const withContact = queue.filter((v) => v.email || v.phone || v.sourceUrl)
  if (withContact.length !== store.queue.length) {
    const removed = store.queue.length - withContact.length
    store.queue = withContact
    await writeStore(store)
    console.log(`[wa:queue] barrido: ${removed} vacantes sin contacto descartadas`)
  }
  return withContact
}

export async function markWhatsAppVacancyImported(vacancyId: string): Promise<void> {
  const store = await readStore()
  store.queue = store.queue.filter((v) => v.id !== vacancyId)
  await writeStore(store)
}

export async function removeWhatsAppVacancy(vacancyId: string): Promise<void> {
  const store = await readStore()
  store.queue = store.queue.filter((v) => v.id !== vacancyId)
  await writeStore(store)
}

export async function removeWhatsAppVacancies(vacancyIds: string[]): Promise<void> {
  if (!Array.isArray(vacancyIds) || vacancyIds.length === 0) return
  const store = await readStore()
  const ids = new Set(vacancyIds)
  store.queue = store.queue.filter((v) => !ids.has(v.id))
  await writeStore(store)
}

export async function getWhatsAppConfig(): Promise<WhatsAppConfig> {
  const store = await readStore()
  return store.config
}

export async function setWhatsAppConfig(config: WhatsAppConfig): Promise<void> {
  const store = await readStore()
  // Merge: evita que una copia vieja de la config (p. ej. desde otra vista) borre campos.
  store.config = { ...store.config, ...config }
  await writeStore(store)
  await applyConfig()
}

export interface WhatsAppSendPayload {
  phone: string
  message?: string
  attachment?: { filename: string; contentBase64: string; mimetype?: string }
}

/**
 * Resuelve un teléfono escrito a mano ("+505 8888-7777", "8888 7777") a un id de chat de WhatsApp.
 * Si el número no trae código de país, se toma el del propio número vinculado.
 */
async function resolveChatId(c: WaClient, rawPhone: string): Promise<string | null> {
  let digits = (rawPhone || '').replace(/\D/g, '')
  if (digits.startsWith('00')) digits = digits.slice(2)
  if (digits.length < 7 || digits.length > 15) return null
  const candidates = [digits]
  const own = (c as unknown as { info?: { wid?: { user?: string } } }).info?.wid?.user
  if (own && /^\d+$/.test(own) && own.length > digits.length) {
    const cc = own.slice(0, own.length - digits.length)
    if (cc.length >= 1 && cc.length <= 3) candidates.push(cc + digits)
  }
  for (const candidate of candidates) {
    try {
      const id = await withTimeout(c.getNumberId(candidate), PAGE_HEALTH_TIMEOUT_MS, 'getNumberId')
      if (id?._serialized) return id._serialized
    } catch {
      /* se prueba el siguiente candidato */
    }
  }
  return null
}

/** Envía un mensaje (y opcionalmente un documento, p. ej. el CV en PDF) a un número de WhatsApp. */
export async function sendWhatsAppMessage(payload: WhatsAppSendPayload): Promise<{ ok: boolean; error?: string }> {
  if (!client || status !== 'connected') {
    return { ok: false, error: 'WhatsApp no está conectado. Vincúlalo desde la sección WhatsApp.' }
  }
  const c = client
  const chatId = await resolveChatId(c, payload.phone)
  if (!chatId) {
    return { ok: false, error: 'El número no tiene WhatsApp o no es válido. Incluye el código de país (p. ej. +505…).' }
  }
  try {
    const message = payload.message?.trim()
    // sendSeen: false — el `sendSeen` interno de whatsapp-web.js rompe con las
    // versiones recientes de WhatsApp Web ("Data passed to getter must include
    // an id property"). No necesitamos marcar el chat como leído.
    if (message) await withTimeout(c.sendMessage(chatId, message, { sendSeen: false }), MEDIA_DOWNLOAD_TIMEOUT_MS, 'sendMessage')
    if (payload.attachment?.contentBase64) {
      const wwa = (await import('whatsapp-web.js')) as { default?: unknown; MessageMedia?: unknown }
      const mod = (wwa.default ?? wwa) as { MessageMedia: new (mimetype: string, data: string, filename?: string) => unknown }
      const media = new mod.MessageMedia(
        payload.attachment.mimetype || 'application/pdf',
        payload.attachment.contentBase64,
        payload.attachment.filename || 'CV.pdf',
      )
      await withTimeout(
        c.sendMessage(chatId, media as import('whatsapp-web.js').MessageMedia, { sendMediaAsDocument: true, sendSeen: false }),
        MEDIA_DOWNLOAD_TIMEOUT_MS * 2,
        'sendMessage(media)',
      )
    }
    return { ok: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, error: `No se pudo enviar por WhatsApp: ${msg}` }
  }
}

export async function shutdownWhatsApp(): Promise<void> {
  realtimeOn = false
  await destroyClientSafely(client)
  detachRealtimeHandler()
  clearReadyWatchdog()
  client = null
}

let shutdownStarted = false

app.on('before-quit', (event) => {
  if (shutdownStarted) return
  shutdownStarted = true
  // Da tiempo a cerrar el navegador de WhatsApp antes de que Electron salga;
  // sin esto el proceso Edge puede quedar huérfano y bloquear la sesión.
  event.preventDefault()
  const forceExit = setTimeout(() => app.exit(1), DESTROY_TIMEOUT_MS + 5000)
  void shutdownWhatsApp().finally(() => {
    clearTimeout(forceExit)
    app.exit(0)
  })
})