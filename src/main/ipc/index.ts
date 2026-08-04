import { ipcMain, nativeTheme, clipboard, BrowserWindow } from 'electron'
import { readJSON, writeJSON, ensureDir } from '../services/storage'
import { readProfile } from '../services/profile-reader'
import { CHATS_FILE, SETTINGS_FILE, JOBS_FILE, PROFILE_PATH, USER_PROFILE_PATH, DATA_DIR, CV_TEMPLATES_FILE, CAREER_ADVICE_FILE, ROADMAP_FILE } from '../utils/paths'
import type { Conversation, AppSettings, StreamParams, JobApplication, Profile, ATSReport, CvTemplate, InterviewQuestion, ImportResult } from '../../shared/types'
import { streamChatCompletion, abortCurrentStream, listModels } from '../services/llm-service'
import { ThrottledStream } from '../utils/throttled-stream'
import { analyzeVacancy, generateCoverLetters, correctVacancyText, generateInterviewQuestions } from '../services/job-service'
import { generateCV, regenerateCV, generateSummaryOptions, generateSampleCv } from '../services/cv-generator'
import { startUpdateDownload, quitAndInstall } from '../services/updater'
import { loadCareerAdvice, refreshCareerAdvice } from '../services/career-advice'
import { loadRoadmap, refreshRoadmap } from '../services/roadmap-service'
import { getUsage, resetUsage } from '../services/usage-service'
import { getSeedTemplates, wrapHtml } from '../services/cv-templates-seed'
import { extractTextFromImage } from '../services/ocr-service'
import { getExchangeRate } from '../services/currency-service'

export function registerAllHandlers(mainWindow: BrowserWindow): void {
  // ── File System ──
  ipcMain.handle('fs:readFile', async (_event, filePath: string) => {
    const fs = await import('fs/promises')
    return await fs.readFile(filePath, 'utf-8')
  })
  ipcMain.handle('fs:writeFile', async (_event, filePath: string, data: string) => {
    const fs = await import('fs/promises')
    await fs.writeFile(filePath, data, 'utf-8')
  })
  ipcMain.handle('fs:deleteFile', async (_event, filePath: string) => {
    const fs = await import('fs/promises')
    await fs.unlink(filePath)
  })
  ipcMain.handle('fs:readDirectory', async (_event, dirPath: string) => {
    const fs = await import('fs/promises')
    return await fs.readdir(dirPath)
  })
  ipcMain.handle('fs:fileExists', async (_event, filePath: string) => {
    const fs = await import('fs/promises')
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  })

  // ── Chat CRUD ──
  ipcMain.handle('chat:getAll', async (): Promise<Conversation[]> => {
    return (await readJSON<Conversation[]>(CHATS_FILE)) ?? []
  })
  ipcMain.handle('chat:get', async (_event, id: string): Promise<Conversation | null> => {
    const chats = await readJSON<Conversation[]>(CHATS_FILE)
    return chats?.find((c) => c.id === id) ?? null
  })
  ipcMain.handle('chat:save', async (_event, conversation: Conversation): Promise<void> => {
    await ensureDir(DATA_DIR)
    const chats = (await readJSON<Conversation[]>(CHATS_FILE)) ?? []
    const idx = chats.findIndex((c) => c.id === conversation.id)
    if (idx >= 0) chats[idx] = conversation
    else chats.push(conversation)
    await writeJSON(CHATS_FILE, chats)
  })
  ipcMain.handle('chat:delete', async (_event, id: string): Promise<void> => {
    const chats = (await readJSON<Conversation[]>(CHATS_FILE)) ?? []
    await writeJSON(CHATS_FILE, chats.filter((c) => c.id !== id))
  })
  ipcMain.handle('chat:rename', async (_event, id: string, title: string): Promise<void> => {
    const chats = (await readJSON<Conversation[]>(CHATS_FILE)) ?? []
    const chat = chats.find((c) => c.id === id)
    if (chat) chat.title = title
    await writeJSON(CHATS_FILE, chats)
  })
  ipcMain.handle('chat:archive', async (_event, id: string): Promise<void> => {
    const chats = (await readJSON<Conversation[]>(CHATS_FILE)) ?? []
    const chat = chats.find((c) => c.id === id)
    if (chat) chat.archived = true
    await writeJSON(CHATS_FILE, chats)
  })
  ipcMain.handle('chat:search', async (_event, query: string): Promise<Conversation[]> => {
    const chats = (await readJSON<Conversation[]>(CHATS_FILE)) ?? []
    const q = query.toLowerCase()
    return chats.filter(
      (c) =>
        c.title?.toLowerCase().includes(q) ||
        c.messages?.some((m) => m.content?.toLowerCase().includes(q)),
    )
  })

  // ── Job CRUD ──
  function normalizeJob(job: JobApplication): JobApplication {
    return { ...job, status: job.status || 'draft' }
  }

  ipcMain.handle('job:getAll', async (): Promise<JobApplication[]> => {
    const jobs = (await readJSON<JobApplication[]>(JOBS_FILE)) ?? []
    return jobs.map(normalizeJob)
  })
  ipcMain.handle('job:get', async (_event, id: string): Promise<JobApplication | null> => {
    const jobs = await readJSON<JobApplication[]>(JOBS_FILE)
    const job = jobs?.find((j) => j.id === id) ?? null
    return job ? normalizeJob(job) : null
  })
  ipcMain.handle('job:save', async (_event, job: JobApplication): Promise<void> => {
    await ensureDir(DATA_DIR)
    const jobs = (await readJSON<JobApplication[]>(JOBS_FILE)) ?? []
    const idx = jobs.findIndex((j) => j.id === job.id)
    if (idx >= 0) jobs[idx] = job
    else jobs.push(job)
    await writeJSON(JOBS_FILE, jobs)
  })
  ipcMain.handle('job:delete', async (_event, id: string): Promise<void> => {
    const jobs = (await readJSON<JobApplication[]>(JOBS_FILE)) ?? []
    await writeJSON(JOBS_FILE, jobs.filter((j) => j.id !== id))
  })

  // ── CV Templates ──
  ipcMain.handle('cv:getTemplates', async (): Promise<CvTemplate[]> => {
    await ensureDir(DATA_DIR)
    const templates = await readJSON<CvTemplate[]>(CV_TEMPLATES_FILE)
    if (!templates || templates.length === 0) {
      const seeds = getSeedTemplates()
      await writeJSON(CV_TEMPLATES_FILE, seeds)
      return seeds
    }
    return templates
  })
  ipcMain.handle('cv:saveTemplate', async (_event, template: CvTemplate): Promise<void> => {
    await ensureDir(DATA_DIR)
    const templates = (await readJSON<CvTemplate[]>(CV_TEMPLATES_FILE)) ?? []
    const idx = templates.findIndex((t) => t.id === template.id)
    if (idx >= 0) templates[idx] = template
    else templates.push(template)
    await writeJSON(CV_TEMPLATES_FILE, templates)
  })
  ipcMain.handle('cv:deleteTemplate', async (_event, id: string): Promise<void> => {
    const templates = (await readJSON<CvTemplate[]>(CV_TEMPLATES_FILE)) ?? []
    await writeJSON(CV_TEMPLATES_FILE, templates.filter((t) => t.id !== id))
  })
  ipcMain.handle('cv:resetTemplates', async (): Promise<void> => {
    const seeds = getSeedTemplates()
    await writeJSON(CV_TEMPLATES_FILE, seeds)
  })
  ipcMain.handle('cv:generateSample', async (_event, prompt: string): Promise<string> => {
    const html = await generateSampleCv(prompt)
    return wrapHtml(html)
  })

  // ── Job Analysis (LLM) ──
  async function loadProfile(): Promise<Profile | null> {
    const internal = await readProfile(USER_PROFILE_PATH)
    if (internal) return internal
    return readProfile(PROFILE_PATH)
  }
  ipcMain.handle('job:correctVacancy', async (_event, rawText: string): Promise<string> => {
    return correctVacancyText(rawText)
  })
  ipcMain.handle('job:analyze', async (_event, vacancyText: string): Promise<unknown> => {
    const profile = await loadProfile()
    return analyzeVacancy(vacancyText, profile)
  })
  ipcMain.handle('job:generateLetters', async (_event, vacancyText: string, atsReport: unknown): Promise<unknown> => {
    const profile = await loadProfile()
    return generateCoverLetters(vacancyText, profile, atsReport as any)
  })
  ipcMain.handle('job:generateQuestions', async (_event, vacancyText: string, atsReport: unknown): Promise<unknown> => {
    const profile = await loadProfile()
    return generateInterviewQuestions(vacancyText, profile, atsReport as ATSReport | null)
  })
  ipcMain.handle('job:generateCV', async (_event, vacancyText: string, atsReport: unknown, style: string, customPrompt?: string, chosenSummary?: string): Promise<string> => {
    const profile = await loadProfile()
    return generateCV(vacancyText, profile, atsReport as ATSReport | null, style, customPrompt, chosenSummary)
  })
  ipcMain.handle('job:regenerateCV', async (_event, params: {
    currentCv: string
    style: string
    vacancyText: string
    atsReport: ATSReport | null
    instructions: string
    customPrompt?: string
  }): Promise<string> => {
    const profile = await loadProfile()
    return regenerateCV(
      params.currentCv,
      params.style,
      params.vacancyText,
      profile,
      params.atsReport,
      params.instructions,
      params.customPrompt,
    )
  })

  // ── Settings ──
  ipcMain.handle('settings:get', async (): Promise<AppSettings | null> => {
    return readJSON<AppSettings>(SETTINGS_FILE)
  })
  ipcMain.handle('settings:set', async (_event, settings: AppSettings): Promise<void> => {
    await ensureDir(DATA_DIR)
    await writeJSON(SETTINGS_FILE, settings)
  })

  // ── Profile (Digital Twin) ──
  ipcMain.handle('profile:get', async (): Promise<Profile | null> => {
    const internal = await readProfile(USER_PROFILE_PATH)
    if (internal) return internal
    return readProfile(PROFILE_PATH)
  })
  ipcMain.handle('profile:save', async (_event, profile: Profile): Promise<void> => {
    await ensureDir(DATA_DIR)
    await writeJSON(USER_PROFILE_PATH, profile)
  })

  // ── LLM Chat (real streaming) ──
  ipcMain.handle('llm:chat', async (_event, params: StreamParams): Promise<void> => {
    const settings = await readJSON<AppSettings>(SETTINGS_FILE)
    const config = {
      baseUrl: settings?.api?.baseUrl || 'http://localhost:11434/v1',
      apiKey: settings?.api?.apiKey || '',
      model: settings?.api?.model || 'llama3',
    }

    const throttled = new ThrottledStream(mainWindow, 30)

    await streamChatCompletion(
      config,
      params.messages,
      {
        onToken: (token) => throttled.push(token),
        onDone: () => throttled.done(),
        onError: (err) => throttled.error(err),
      },
      {
        systemPrompt: params.systemPrompt || settings?.systemPrompt,
        profile: params.profile,
        excludeFromTraining: settings?.privacy?.excludeFromTraining || false,
      },
    )
  })

  ipcMain.handle('llm:abort', async () => {
    abortCurrentStream()
  })

  // ── List Models ──
  ipcMain.handle('llm:listModels', async (_event, params?: { baseUrl?: string; apiKey?: string }): Promise<{ id: string; name?: string }[]> => {
    const settings = await readJSON<AppSettings>(SETTINGS_FILE)
    const config = {
      baseUrl: params?.baseUrl || settings?.api?.baseUrl || 'http://localhost:11434/v1',
      apiKey: params?.apiKey || settings?.api?.apiKey || '',
    }
    return listModels(config)
  })

  // ── Data Export ──
  ipcMain.handle('data:exportAll', async (): Promise<unknown> => {
    const [conversations, jobs, profile, settings, cvTemplates] = await Promise.all([
      readJSON<Conversation[]>(CHATS_FILE),
      readJSON<JobApplication[]>(JOBS_FILE),
      readProfile(USER_PROFILE_PATH).then((p) => p ?? readProfile(PROFILE_PATH)),
      readJSON<AppSettings>(SETTINGS_FILE),
      readJSON<CvTemplate[]>(CV_TEMPLATES_FILE),
    ])
    const result = {
      exportedAt: new Date().toISOString(),
      appVersion: '1.0.0',
      conversations: conversations ?? [],
      jobs: jobs ?? [],
      profile: profile ?? null,
      settings: settings ?? null,
      cvTemplates: cvTemplates ?? [],
    }
    console.log('[data:exportAll]', {
      chatsCount: result.conversations.length,
      jobsCount: result.jobs.length,
      profile: !!result.profile,
      settings: !!result.settings,
      cvTemplatesCount: result.cvTemplates.length,
      chatsFile: CHATS_FILE,
      jobsFile: JOBS_FILE,
    })
    return result
  })

  ipcMain.handle('data:saveExportFile', async (_event, data: unknown, format: 'json' | 'xlsx'): Promise<string | null> => {
    const { dialog, shell } = await import('electron')
    const fs = await import('fs/promises')
    const bundle = data as Record<string, unknown>
    console.log('[data:saveExportFile]', { format, jobsCount: (bundle.jobs as unknown[])?.length, chatsCount: (bundle.conversations as unknown[])?.length })

    if (format === 'json') {
      const { filePath, canceled } = await dialog.showSaveDialog({
        title: 'Exportar datos',
        defaultPath: 'aplica-export.json',
        filters: [{ name: 'JSON', extensions: ['json'] }],
      })
      if (canceled || !filePath) return null
      await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
      shell.openPath(filePath)
      return filePath
    }

    if (format === 'xlsx') {
      const XLSX = await import('xlsx')

      const wb = XLSX.utils.book_new()

      if (bundle.profile && typeof bundle.profile === 'object') {
        const profile = bundle.profile as Record<string, unknown>
        const profileRows = Object.entries(profile).map(([key, value]) => ({
          Campo: key,
          Valor: Array.isArray(value) ? JSON.stringify(value) : String(value ?? ''),
        }))
        const ws = XLSX.utils.json_to_sheet(profileRows)
        XLSX.utils.book_append_sheet(wb, ws, 'Perfil')
      }

      if (Array.isArray(bundle.jobs)) {
        const jobs = bundle.jobs as Record<string, unknown>[]
        const rows = jobs.map((j) => ({
          Empresa: j.company ?? '',
          Puesto: j.position ?? '',
          Estado: j.status ?? '',
          Categoría: j.category ?? '',
          'Email reclutador': j.recipientEmail ?? '',
          'Match %': (j.atsReport as Record<string, unknown>)?.matchScore ?? '',
          Creado: j.createdAt ? new Date(j.createdAt as number).toISOString() : '',
          Actualizado: j.updatedAt ? new Date(j.updatedAt as number).toISOString() : '',
        }))
        const ws = XLSX.utils.json_to_sheet(rows)
        XLSX.utils.book_append_sheet(wb, ws, 'Postulaciones')
      }

      if (Array.isArray(bundle.conversations)) {
        const conversations = bundle.conversations as Record<string, unknown>[]
        const rows = conversations.map((c) => ({
          Título: c.title ?? '',
          Mensajes: (c.messages as unknown[])?.length ?? 0,
          Archivada: c.archived ? 'Sí' : 'No',
          Creado: c.createdAt ? new Date(c.createdAt as number).toISOString() : '',
          Actualizado: c.updatedAt ? new Date(c.updatedAt as number).toISOString() : '',
        }))
        const ws = XLSX.utils.json_to_sheet(rows)
        XLSX.utils.book_append_sheet(wb, ws, 'Conversaciones')
      }

      if (Array.isArray(bundle.cvTemplates)) {
        const templates = bundle.cvTemplates as Record<string, unknown>[]
        const rows = templates.map((t) => ({
          Nombre: t.name ?? '',
          Creado: t.createdAt ? new Date(t.createdAt as number).toISOString() : '',
          Actualizado: t.updatedAt ? new Date(t.updatedAt as number).toISOString() : '',
        }))
        const ws = XLSX.utils.json_to_sheet(rows)
        XLSX.utils.book_append_sheet(wb, ws, 'Plantillas CV')
      }

      const { filePath, canceled } = await dialog.showSaveDialog({
        title: 'Exportar datos',
        defaultPath: 'aplica-export.xlsx',
        filters: [{ name: 'Excel', extensions: ['xlsx'] }],
      })
      if (canceled || !filePath) return null
      const wbBuf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
      await fs.writeFile(filePath, wbBuf)
      shell.openPath(filePath)
      return filePath
    }

    return null
  })

  // ── Data Import ──

  async function writeImportData(data: Record<string, unknown>): Promise<ImportStats> {
    await ensureDir(DATA_DIR)
    const stats = { conversations: 0, jobs: 0, profile: false, settings: false, cvTemplates: 0 }
    const errors: string[] = []

    if (data.conversations) {
      try {
        const existing = (await readJSON<unknown[]>(CHATS_FILE)) ?? []
        const incoming = data.conversations as unknown[]
        const merged = [...incoming, ...existing]
        const seen = new Set<string>()
        const deduped = merged.filter((item: any) => {
          if (!item.id) return true
          if (seen.has(item.id)) return false
          seen.add(item.id)
          return true
        })
        await writeJSON(CHATS_FILE, deduped)
        stats.conversations = incoming.length
      } catch (e) {
        errors.push(`conversations: ${e instanceof Error ? e.message : String(e)}`)
      }
    }

    if (data.jobs) {
      try {
        const existing = (await readJSON<unknown[]>(JOBS_FILE)) ?? []
        const incoming = data.jobs as unknown[]
        const merged = [...incoming, ...existing]
        const seen = new Set<string>()
        const deduped = merged.filter((item: any) => {
          if (!item.id) return true
          if (seen.has(item.id)) return false
          seen.add(item.id)
          return true
        })
        await writeJSON(JOBS_FILE, deduped)
        stats.jobs = incoming.length
      } catch (e) {
        errors.push(`jobs: ${e instanceof Error ? e.message : String(e)}`)
      }
    }

    if (data.profile && typeof data.profile === 'object') {
      try {
        await writeJSON(USER_PROFILE_PATH, data.profile)
        stats.profile = true
      } catch (e) {
        errors.push(`profile: ${e instanceof Error ? e.message : String(e)}`)
      }
    }

    if (data.settings && typeof data.settings === 'object') {
      try {
        const current = await readJSON<Record<string, unknown>>(SETTINGS_FILE)
        await writeJSON(SETTINGS_FILE, { ...current, ...data.settings })
        stats.settings = true
      } catch (e) {
        errors.push(`settings: ${e instanceof Error ? e.message : String(e)}`)
      }
    }

    if (data.cvTemplates) {
      try {
        const existing = (await readJSON<unknown[]>(CV_TEMPLATES_FILE)) ?? []
        const incoming = (data.cvTemplates as unknown[]).filter(
          (t: any) => typeof t.id !== 'string' || !t.id.startsWith('seed-'),
        )
        const merged = [...incoming, ...existing]
        const seen = new Set<string>()
        const deduped = merged.filter((item: any) => {
          if (!item.id) return true
          if (seen.has(item.id)) return false
          seen.add(item.id)
          return true
        })
        await writeJSON(CV_TEMPLATES_FILE, deduped)
        stats.cvTemplates = incoming.length
      } catch (e) {
        errors.push(`cvTemplates: ${e instanceof Error ? e.message : String(e)}`)
      }
    }

    if (errors.length > 0) {
      console.warn('[writeImportData] partial errors:', errors)
    }

    return stats
  }

  async function parseImportXLSX(buf: Buffer): Promise<Record<string, unknown> | ImportResult> {
    const XLSX = await import('xlsx')
    const wb = XLSX.read(buf, { type: 'buffer' })

    const data: Record<string, unknown> = {}

    if (wb.SheetNames.includes('Perfil')) {
      const rows = XLSX.utils.sheet_to_json<{ Campo: string; Valor: string }>(wb.Sheets['Perfil'])
      const profile: Record<string, unknown> = {}
      for (const row of rows) {
        const val = row.Valor ?? ''
        if (val.startsWith('[') || val.startsWith('{')) {
          try { profile[row.Campo] = JSON.parse(val) } catch { profile[row.Campo] = val }
        } else {
          profile[row.Campo] = val
        }
      }
      if (Object.keys(profile).length > 0) data.profile = profile
    }

    if (wb.SheetNames.includes('Postulaciones')) {
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets['Postulaciones'])
      const jobs = rows.map((r) => ({
        id: r.id || crypto.randomUUID(),
        company: r.Empresa ?? '',
        position: r.Puesto ?? '',
        status: r.Estado ?? 'draft',
        category: r.Categoría ?? '',
        recipientEmail: r['Email reclutador'] ?? '',
        atsReport: r['Match %'] ? { matchScore: r['Match %'] } : null,
        createdAt: r.Creado ? new Date(r.Creado as string).getTime() : Date.now(),
        updatedAt: r.Actualizado ? new Date(r.Actualizado as string).getTime() : Date.now(),
        coverLetterA: '',
        coverLetterB: '',
        cvContent: '',
        cvStyle: null,
        emailSubject: '',
        vacancyText: '',
        interviewQuestions: [],
      }))
      if (jobs.length > 0) data.jobs = jobs
    }

    if (wb.SheetNames.includes('Conversaciones')) {
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets['Conversaciones'])
      const conversations = rows.map((r) => ({
        id: r.id || crypto.randomUUID(),
        title: r.Título ?? 'Sin título',
        messages: [],
        archived: r.Archivada === 'Sí',
        createdAt: r.Creado ? new Date(r.Creado as string).getTime() : Date.now(),
        updatedAt: r.Actualizado ? new Date(r.Actualizado as string).getTime() : Date.now(),
      }))
      if (conversations.length > 0) data.conversations = conversations
    }

    if (wb.SheetNames.includes('Plantillas CV')) {
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets['Plantillas CV'])
      const templates = rows.map((r) => ({
        id: r.id || crypto.randomUUID(),
        name: r.Nombre ?? '',
        prompt: r.Prompt ?? '',
        sampleHtml: '',
        createdAt: r.Creado ? new Date(r.Creado as string).getTime() : Date.now(),
        updatedAt: r.Actualizado ? new Date(r.Actualizado as string).getTime() : Date.now(),
      }))
      if (templates.length > 0) data.cvTemplates = templates
    }

    if (Object.keys(data).length === 0) return { ok: false, error: 'El archivo Excel no contiene datos reconocibles de Aplica' }
    return data
  }

  ipcMain.handle('data:importFromFile', async (): Promise<ImportResult> => {
    const { dialog } = await import('electron')
    const fs = await import('fs/promises')
    const pathModule = await import('path')

    const { filePath, canceled } = await dialog.showOpenDialog(mainWindow, {
      title: 'Importar datos',
      filters: [
        { name: 'JSON o Excel', extensions: ['json', 'xlsx'] },
        { name: 'Todos los archivos', extensions: ['*'] },
      ],
      properties: ['openFile'],
    })
    if (canceled || !filePath || !filePath[0]) return null

    const ext = pathModule.extname(filePath[0]).toLowerCase()
    let data: Record<string, unknown>

    if (ext === '.json') {
      const content = await fs.readFile(filePath[0], 'utf-8')
      try {
        data = JSON.parse(content)
      } catch {
        return { ok: false, error: 'El archivo no contiene JSON válido' }
      }
      if (!data.exportedAt) return { ok: false, error: 'El archivo no es una exportación válida de Aplica (falta exportedAt)' }
    } else if (ext === '.xlsx') {
      const buf = await fs.readFile(filePath[0])
      const result = await parseImportXLSX(buf)
      if (result && typeof result === 'object' && 'ok' in result && result.ok === false) return result
      data = result as Record<string, unknown>
    } else {
      return { ok: false, error: 'Formato de archivo no soportado. Usa .json o .xlsx' }
    }

    try {
      const stats = await writeImportData(data)
      return { ok: true, filePath: filePath[0], stats }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  })

  ipcMain.handle('data:processImportData', async (_event, fileName: string, content: string): Promise<ImportResult> => {
    const pathModule = await import('path')
    const ext = pathModule.extname(fileName).toLowerCase()
    let data: Record<string, unknown>

    if (ext === '.json') {
      try {
        data = JSON.parse(content)
      } catch {
        return { ok: false, error: 'El archivo no contiene JSON válido' }
      }
      if (!data.exportedAt) return { ok: false, error: 'El archivo no es una exportación válida de Aplica (falta exportedAt)' }
    } else if (ext === '.xlsx') {
      const buf = Buffer.from(content, 'base64')
      const result = await parseImportXLSX(buf)
      if (result && typeof result === 'object' && 'ok' in result && result.ok === false) return result
      data = result as Record<string, unknown>
    } else {
      return { ok: false, error: 'Formato de archivo no soportado. Usa .json o .xlsx' }
    }

    try {
      const stats = await writeImportData(data)
      return { ok: true, filePath: fileName, stats }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  })

  // ── Clipboard ──
  ipcMain.handle('clipboard:copy', async (_event, text: string) => {
    clipboard.writeText(text)
  })
  ipcMain.handle('clipboard:readImage', async (): Promise<string | null> => {
    const image = clipboard.readImage()
    if (image.isEmpty()) return null
    return image.toDataURL()
  })

  // ── OCR ──
  ipcMain.handle('ocr:imageToText', async (_event, base64: string): Promise<string> => {
    const raw = base64.replace(/^data:image\/\w+;base64,/, '')
    const buffer = Buffer.from(raw, 'base64')
    return extractTextFromImage(buffer)
  })

  // ── Usage ──
  ipcMain.handle('usage:get', async () => getUsage())
  ipcMain.handle('usage:reset', async () => resetUsage())

  // ── Currency Exchange ──
  ipcMain.handle('currency:getRate', async (_event, from: string, to: string): Promise<number> => {
    return getExchangeRate(from, to)
  })

  // ── Update ──
  ipcMain.handle('update:start-download', async () => {
    await startUpdateDownload()
  })
  ipcMain.handle('update:quit-and-install', () => {
    quitAndInstall()
  })

  // ── System Theme ──
  ipcMain.handle('system:getTheme', () => nativeTheme.shouldUseDarkColors)

  // ── CV Summary Options ──
  ipcMain.handle('cv:generateSummaryOptions', async (_event, vacancyText: string, atsReport: unknown): Promise<unknown> => {
    const profile = await loadProfile()
    return generateSummaryOptions(vacancyText, profile, atsReport as ATSReport | null)
  })

  // ── Career Advice ──
  ipcMain.handle('getCareerAdvice', async (): Promise<unknown> => {
    return loadCareerAdvice()
  })

  ipcMain.handle('refreshCareerAdvice', async (): Promise<unknown> => {
    const profile = await loadProfile()
    return refreshCareerAdvice(profile)
  })

  // ── Roadmap ──
  ipcMain.handle('getRoadmap', async (): Promise<unknown> => {
    return loadRoadmap()
  })

  ipcMain.handle('refreshRoadmap', async (): Promise<unknown> => {
    const profile = await loadProfile()
    return refreshRoadmap(profile)
  })

  // ── CV Download as PDF ──
  ipcMain.handle('cv:downloadPdf', async (_event, htmlContent: string, styleName: string): Promise<string | null> => {
    const { dialog, shell } = await import('electron')
    const fs = await import('fs/promises')

    const html = buildCvHtml(htmlContent, styleName)

    const pdfWindow = new BrowserWindow({ show: false, width: 800, height: 1056, webPreferences: { sandbox: false } })
    try {
      await pdfWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
      const pdfBuffer = await pdfWindow.webContents.printToPDF({
        printBackground: true,
        margins: { marginType: 'custom', top: 0, bottom: 0, left: 0, right: 0 },
        pageSize: 'A4',
      })
      const { filePath, canceled } = await dialog.showSaveDialog(pdfWindow, {
        title: 'Guardar CV',
        defaultPath: `CV-${styleName}.pdf`,
        filters: [{ name: 'PDF', extensions: ['pdf'] }],
      })
      if (canceled || !filePath) return null
      await fs.writeFile(filePath, pdfBuffer)
      shell.openPath(filePath)
      return filePath
    } finally {
      pdfWindow.close()
    }
  })
}

function buildCvHtml(bodyHtml: string, styleName: string): string {
  const labels: Record<string, string> = { ats: 'ATS-Friendly', moderno: 'Moderno', tradicional: 'Tradicional' }
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>CV - ${labels[styleName] || styleName}</title>
<style>
  @page { margin: 0; size: A4; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    width: 210mm;
    min-height: 297mm;
    font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
    font-size: 11pt;
    line-height: 1.5;
    color: #1a1a1a;
    background: #fff;
  }
  @media print {
    html, body { background: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    p, h1, h2, h3, h4, h5, h6 { orphans: 3; widows: 3; }
    h1, h2, h3, h4 { page-break-after: avoid; }
    table { page-break-inside: avoid; }
  }
  img { max-width: 100%; height: auto; }
  a { color: inherit; text-decoration: none; }
  ul, ol { padding-left: 1.5em; }
  .cv-content { padding: 9.5mm 10mm; }
  p, li { orphans: 3; widows: 3; overflow-wrap: break-word; word-wrap: break-word; }
</style>
</head>
<body><div class="cv-content" style="padding: 9.5mm 10mm;">${bodyHtml}</div></body>
</html>`
}
