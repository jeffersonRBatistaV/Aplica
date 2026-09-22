import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import QRCode from 'qrcode'
import { readJSON, writeJSON, ensureDir } from './storage'
import { SETTINGS_FILE, WHATSAPP_SESSION_DIR } from '../utils/paths'
import { getActiveProfileFiles } from './profile-data'
import { extractTextFromImage } from './ocr-service'
import { detectVacancy, isVacancyInArea } from '../../shared/vacancy-detection'
import { getActiveProfile } from './profile-scope'
import type {
  AppSettings,
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
}

const MAX_PROCESSED_IDS = 3000

const REALTIME_INTERVAL_MS = 3000
const REALTIME_BATCH = 5

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
  const locks = ['SingletonLock', 'SingletonSocket', 'SingletonCookie']
  for (const name of locks) {
    try {
      const p = path.join(dir, name)
      if (fs.existsSync(p)) fs.unlinkSync(p)
    } catch {
      /* best-effort cleanup */
    }
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

async function processMessage(
  msg: WaMessage,
  groupName: string,
  groupId: string,
  logDebug?: (line: string) => void,
): Promise<WhatsAppVacancy | null> {
  if (msg.fromMe) return null
  const body = msg.body || ''
  let ocrText = ''
  if (msg.hasMedia && (msg.type === 'image' || msg.type === 'document')) {
    try {
      await withOcrLock(async () => {
        const media = await msg.downloadMedia()
        if (media?.data) {
          const dataUrl = `data:${media.mimetype};base64,${media.data}`
          const buffer = Buffer.from(media.data, 'base64')
          const settings = await readJSON<AppSettings>(SETTINGS_FILE)
          const llmCfg = getLLMConfig(settings)
          logDebug?.(`  ocr: media ${media.mimetype} ${buffer.length}B vision=${!!llmCfg}`)
          ocrText = await extractTextFromImage(buffer, dataUrl, llmCfg)
          logDebug?.(`  ocr: resultado ${ocrText.length} chars`)
        } else {
          logDebug?.('  ocr: downloadMedia sin data')
        }
      })
    } catch (err) {
      logDebug?.(`  ocr: ERROR ${err instanceof Error ? err.message : String(err)}`)
      console.error('[wa:ocr]', err)
    }
  }

  const vacant = detectVacancy(body, ocrText, msg.author || '', groupName, groupId, msg.timestamp * 1000)
  if (vacant) {
    const added = await addToQueue(vacant)
    return added ? vacant : null
  }
  return vacant
}

async function readStore(): Promise<WhatsAppStore> {
  const file = (await getActiveProfileFiles()).whatsappFile
  await ensureDir(path.dirname(file))
  const data = await readJSON<WhatsAppStore>(file)
  if (data && Array.isArray(data.queue)) return data
  return {
    config: { monitoredGroups: [], realtime: false, strictAreaFilter: true, vacancyQueue: [], processedMessageIds: [] },
    queue: [],
    processedMessageIds: [],
  }
}

async function writeStore(store: WhatsAppStore): Promise<void> {
  const file = (await getActiveProfileFiles()).whatsappFile
  await ensureDir(path.dirname(file))
  await writeJSON(file, store)
}

async function addToQueue(vacancy: WhatsAppVacancy): Promise<boolean> {
  const store = await readStore()
  const strict = store.config.strictAreaFilter ?? true
  const profile = await getActiveProfile().catch(() => null)
  if (profile && !isVacancyInArea(vacancy.category, profile.area, strict)) {
    console.log(
      `[wa:queue] descartada por área: "${vacancy.title}" (${vacancy.category}) vs área del perfil (${profile.area}) strict=${strict}`,
    )
    return false
  }
  // Dedup 1: id determinista de grupo (mismo grupo + misma clave de contacto → mismo id).
  if (store.queue.some((v) => v.id === vacancy.id)) return true
  // Dedup 2: huella global de contenido (sin groupId). La misma oferta publicada en
  // distintos grupos o mensajes (p. ej. realtime + escaneo profundo, o 2 grupos con la
  // misma vacante) produce la misma huella → no se añade dos veces a la cola.
  if (vacancy.fingerprint && store.queue.some((v) => v.fingerprint === vacancy.fingerprint)) {
    console.log(`[wa:queue] dedupe por huella: "${vacancy.title}" en ${vacancy.groupName} ya en cola`)
    return true
  }
  store.queue.unshift(vacancy)
  await writeStore(store)
  return true
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
    const serial = msg.id._serialized
    if (serial && !realtimePending.some((m) => m.id._serialized === serial)) {
      realtimePending.push(msg)
      if (realtimePending.length > 50) realtimePending.splice(0, realtimePending.length - 50)
    }
  }
  client.on('message', realtimeHandler)
  realtimeTimer = setInterval(() => void flushRealtimePending(), REALTIME_INTERVAL_MS)
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
  realtimePending.length = 0
}

async function flushRealtimePending(): Promise<void> {
  if (!realtimeOn || realtimePending.length === 0) return
  const batch = realtimePending.splice(0, REALTIME_BATCH)
  for (const msg of batch) {
    try {
      const chat = await msg.getChat()
      const serial = msg.id._serialized
      if (!serial || (await isProcessed(serial))) continue
      const vacant = await processMessage(msg, chat.name || msg.from, msg.from)
      if (vacant) emit({ type: 'vacancy', payload: vacant })
      if (vacant || !msg.hasMedia) await persistProcessed(serial)
    } catch {
      /* realtime message errors are non-fatal */
    }
  }
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
  cleanBrowserLocks(sessionDir)

  try {
    await newClient.initialize()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('already running') || msg.includes('userDataDir')) {
      console.log('[wa] browser lock detected, cleaning and retrying…')
      cleanBrowserLocks(sessionDir)
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

export async function disconnectWhatsApp(): Promise<void> {
  realtimeOn = false
  if (client) {
    try {
      await client.destroy()
    } catch {
      /* already closed */
    }
  }
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
        out.messages = msgs.map((m: any) => {
          const model = (window as any).WWebJS.getMessageModel(m)
          if (model?.id && !model.id._serialized) {
            const fromMe = model.id.fromMe
            const remoteRaw = model.id.remote
            const remote =
              typeof remoteRaw === 'object' && remoteRaw
                ? remoteRaw._serialized ?? remoteRaw
                : remoteRaw
            if (remote && model.id.id != null) {
              model.id._serialized = `${fromMe ? 'true' : 'false'}_${remote}_${model.id.id}`
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
  if (!client || status !== 'connected') {
    return { vacancies: [], scanned: 0, phases: [] }
  }
  debugLogEnabled = true
  debugLog(`===== scan start: ${groupIds.join(', ')} limit=${limit}`)
  const result: WhatsAppVacancy[] = []
  const phases: string[] = []
  let scanned = 0
  for (const gid of groupIds) {
    try {
      const { name, messages, diag } = await fetchRawMessages(gid, limit)
      debugLog(`[scan] ${gid} "${name}" -> ${messages.length} msgs | ${diag}`)
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
        const vacant = await processMessage(msg, name || gid, gid, debugLog)
        debugLog(`[scan]   ${serial} -> ${vacant ? 'VACANTE OK' : 'no detectada'}`)
        if (vacant) result.push(vacant)
        // Solo marcar como procesado cuando hay detección o cuando no hay media:
        // mensajes con imagen sin detectar se re-OCRean en el siguiente escaneo.
        if (vacant || !msg.hasMedia) await persistProcessed(serial)
      }
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err)
      console.error('[wa:scan] fallo en', gid, detail)
      debugLog(`[scan] ${gid} EXCEPTION: ${detail}`)
      phases.push(`No se pudo leer ${gid}: ${detail}`)
      emit({ type: 'phase', payload: `No se pudo leer ${gid}: ${detail}` })
    }
  }
  debugLog(`[scan] fin: ${scanned} revisados, ${result.length} vacantes`)
  debugLogEnabled = false
  emit({ type: 'phase', payload: `Escaneo completo: ${scanned} mensajes revisados, ${result.length} vacantes detectadas` })
  phases.push(`Escaneo completo: ${scanned} mensajes revisados, ${result.length} vacantes detectadas`)
  return { vacancies: result, scanned, phases }
}

export async function getWhatsAppQueue(): Promise<WhatsAppVacancy[]> {
  const store = await readStore()
  const profile = await getActiveProfile().catch(() => null)
  const strict = store.config.strictAreaFilter ?? true
  let queue = store.queue
  if (profile) {
    const kept = queue.filter((v) => isVacancyInArea(v.category, profile.area, strict))
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
  store.config = config
  await writeStore(store)
  await applyConfig()
}

export async function shutdownWhatsApp(): Promise<void> {
  realtimeOn = false
  if (client) {
    try {
      await client.destroy()
    } catch {
      /* already closed */
    }
  }
  detachRealtimeHandler()
  clearReadyWatchdog()
  client = null
}

app.on('before-quit', () => {
  void shutdownWhatsApp()
})