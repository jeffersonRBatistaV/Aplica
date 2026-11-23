import { ipcMain, nativeTheme, clipboard, BrowserWindow, app } from 'electron'
import fs from 'fs/promises'
import { readJSON, writeJSON, ensureDir } from '../services/storage'
import { readProfile } from '../services/profile-reader'
import { SETTINGS_FILE, PROFILE_PATH, USER_PROFILE_PATH, PROFILES_FILE, DATA_DIR, CV_TEMPLATES_FILE } from '../utils/paths'
import { getActiveProfileFiles, ensureParentDir } from '../services/profile-data'
import { getActiveProfile } from '../services/profile-scope'
import type { Conversation, AppSettings, StreamParams, JobApplication, Profile, ATSReport, CvTemplate, InterviewQuestion, ImportResult, ImportStats, JobCategory, CvVersion, LinkedInJob, LinkedInJobDetail, FoundJob, JobFinderOptions, AutomationConfig, FollowUpDraft } from '../../shared/types'
import { streamChatCompletion, abortCurrentStream, listModels } from '../services/llm-service'
import { ThrottledStream } from '../utils/throttled-stream'
import { analyzeVacancy, generateCoverLetters, correctVacancyText, generateInterviewQuestions, generateFollowUpEmail } from '../services/job-service'
import { generateCV, regenerateCV, generateSummaryOptions, generateSampleCv } from '../services/cv-generator'
import { startUpdateDownload, quitAndInstall } from '../services/updater'
import { listCategories, saveCategory, deleteCategory, generateCategories, listFolders, saveFolder, deleteFolder } from '../services/category-service'
import { loadCareerAdvice, refreshCareerAdvice } from '../services/career-advice'
import { loadRoadmap, refreshRoadmap, loadRoadmapGoal, saveRoadmapGoal, toggleRoadmapStep } from '../services/roadmap-service'
import { listProfiles, setActiveProfile, saveProfile, migrateLegacyProfile, loadProfilesFile } from '../services/profile-service'
import { getUsage, resetUsage } from '../services/usage-service'
import { testEmailConnection, sendEmail, SMTP_PRESETS } from '../services/email-service'
import type { BrowserAgentEvent, BrowserFillEntry, EmailConfig, EmailPayload } from '../../shared/types'
import { getSeedTemplates, upgradeSeedTemplates, wrapHtml } from '../services/cv-templates-seed'
import { renderCvPdf } from '../services/cv-pdf'
import type { RenderCvOptions } from '../services/cv-pdf'
import { listCertificates, addCertificates, updateCertificate, deleteCertificate, CERTIFICATE_EXTENSIONS } from '../services/certificate-service'
import type { CertificateFile } from '../../shared/types'
import { searchLinkedInJobs, fetchLinkedInJob } from '../services/linkedin-service'
import { findJobsForProfile } from '../services/job-finder'
import { getAutomationConfig, saveAutomationConfig } from '../services/automation-service'
import { extractTextFromImage } from '../services/ocr-service'
import { getExchangeRate } from '../services/currency-service'
import {
  attachCv as attachBrowserCv,
  clickElement as clickBrowserElement,
  fillFields as fillBrowserFields,
  getBrowserState,
  inspectPage as inspectBrowserPage,
  listCvs as listBrowserCvs,
  saveBrowserState,
  undoFill as undoBrowserFill,
} from '../services/browser-service'
import { runBrowserAgent } from '../services/browser-agent'
import { investigate, investigateHealth, discoverBackend } from '../services/investigate-service'
import {
  connectWhatsApp,
  disconnectWhatsApp,
  getWhatsAppGroups,
  scanWhatsAppGroups,
  getWhatsAppQueue,
  markWhatsAppVacancyImported,
  removeWhatsAppVacancy,
  removeWhatsAppVacancies,
  getWhatsAppConfig,
  setWhatsAppConfig,
  getStatusEvent,
  onWhatsAppServiceEvent,
  sendWhatsAppMessage,
} from '../services/whatsapp-service'
import type { WhatsAppServiceEvent, WhatsAppSendPayload } from '../services/whatsapp-service'
import type { WhatsAppConfig } from '../../shared/types'

const isTrustedSender = (event: Electron.IpcMainInvokeEvent): boolean => {
  try {
    const frame = event.senderFrame
    if (!frame) return false
    // Solo confiar en el frame principal de nuestra propia ventana
    return frame.url.startsWith('file://') || frame.url.startsWith('http://localhost') || frame.url.startsWith('https://localhost')
  } catch {
    return false
  }
}

function safeHandle(channel: string, handler: (event: Electron.IpcMainInvokeEvent, ...args: any[]) => Promise<any> | any) {
  ipcMain.handle(channel, async (event, ...args) => {
    if (!isTrustedSender(event)) throw new Error('Untrusted sender')
    return handler(event, ...args)
  })
}

let browserAgentAbort: AbortController | null = null

export function registerAllHandlers(mainWindow: BrowserWindow): void {
  async function fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }

  // ── File System ──
  safeHandle('fs:readFile', async (_event, filePath: string) => {
    const fs = await import('fs/promises')
    return await fs.readFile(filePath, 'utf-8')
  })
  safeHandle('fs:writeFile', async (_event, filePath: string, data: string) => {
    const fs = await import('fs/promises')
    await fs.writeFile(filePath, data, 'utf-8')
  })
  safeHandle('fs:deleteFile', async (_event, filePath: string) => {
    const fs = await import('fs/promises')
    await fs.unlink(filePath)
  })
  safeHandle('fs:readDirectory', async (_event, dirPath: string) => {
    const fs = await import('fs/promises')
    return await fs.readdir(dirPath)
  })
  safeHandle('fs:fileExists', async (_event, filePath: string) => {
    const fs = await import('fs/promises')
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  })

  // ── Chat CRUD ──
  safeHandle('chat:getAll', async (): Promise<Conversation[]> => {
    const { chatsFile } = await getActiveProfileFiles()
    return (await readJSON<Conversation[]>(chatsFile)) ?? []
  })
  safeHandle('chat:get', async (_event, id: string): Promise<Conversation | null> => {
    const { chatsFile } = await getActiveProfileFiles()
    const chats = await readJSON<Conversation[]>(chatsFile)
    return chats?.find((c) => c.id === id) ?? null
  })
  safeHandle('chat:save', async (_event, conversation: Conversation): Promise<void> => {
    const { chatsFile } = await getActiveProfileFiles()
    await ensureParentDir(chatsFile)
    const chats = (await readJSON<Conversation[]>(chatsFile)) ?? []
    const idx = chats.findIndex((c) => c.id === conversation.id)
    if (idx >= 0) chats[idx] = conversation
    else chats.push(conversation)
    await writeJSON(chatsFile, chats)
  })
  safeHandle('chat:delete', async (_event, id: string): Promise<void> => {
    const { chatsFile } = await getActiveProfileFiles()
    const chats = (await readJSON<Conversation[]>(chatsFile)) ?? []
    await writeJSON(chatsFile, chats.filter((c) => c.id !== id))
  })
  safeHandle('chat:rename', async (_event, id: string, title: string): Promise<void> => {
    const { chatsFile } = await getActiveProfileFiles()
    const chats = (await readJSON<Conversation[]>(chatsFile)) ?? []
    const chat = chats.find((c) => c.id === id)
    if (chat) chat.title = title
    await writeJSON(chatsFile, chats)
  })
  safeHandle('chat:archive', async (_event, id: string): Promise<void> => {
    const { chatsFile } = await getActiveProfileFiles()
    const chats = (await readJSON<Conversation[]>(chatsFile)) ?? []
    const chat = chats.find((c) => c.id === id)
    if (chat) chat.archived = true
    await writeJSON(chatsFile, chats)
  })
  safeHandle('chat:search', async (_event, query: string): Promise<Conversation[]> => {
    const { chatsFile } = await getActiveProfileFiles()
    const chats = (await readJSON<Conversation[]>(chatsFile)) ?? []
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

  safeHandle('job:getAll', async (): Promise<JobApplication[]> => {
    const { jobsFile } = await getActiveProfileFiles()
    const jobs = (await readJSON<JobApplication[]>(jobsFile)) ?? []
    return jobs.map(normalizeJob)
  })
  safeHandle('job:get', async (_event, id: string): Promise<JobApplication | null> => {
    const { jobsFile } = await getActiveProfileFiles()
    const jobs = await readJSON<JobApplication[]>(jobsFile)
    const job = jobs?.find((j) => j.id === id) ?? null
    return job ? normalizeJob(job) : null
  })
  safeHandle('job:save', async (_event, job: JobApplication): Promise<void> => {
    const { jobsFile, cvVersionsFile } = await getActiveProfileFiles()
    await ensureParentDir(jobsFile)
    const raw = (await readJSON<JobApplication[]>(jobsFile).catch(() => null)) as JobApplication[] | null
    if (raw === null && await fileExists(jobsFile)) {
      // El archivo existe pero no se pudo parsear: no sobrescribir vacantes válidas.
      throw new Error('[job:save] jobs.json corrupto, guardado abortado para evitar pérdida de datos')
    }
    const jobs = raw ?? []
    const idx = jobs.findIndex((j) => j.id === job.id)
    // Snapshot the previous CV content before overwriting it
    try {
      const prev = idx >= 0 ? jobs[idx] : null
      if (prev && prev.cvContent && job.cvContent && prev.cvContent !== job.cvContent) {
        const versions = (await readJSON<Record<string, CvVersion[]>>(cvVersionsFile)) ?? {}
        versions[job.id] = [
          { style: prev.cvStyle ?? null, content: prev.cvContent, createdAt: Date.now() },
          ...(versions[job.id] || []),
        ].slice(0, 10)
        await ensureParentDir(cvVersionsFile)
        await writeJSON(cvVersionsFile, versions)
      }
    } catch (e) {
      console.error('[job:save] failed to snapshot cv version', e)
    }
    // Historial de estados + fecha de postulación: se calcula aquí para cubrir
    // todos los caminos de guardado (kanban, automatización, vista de vacante…).
    const prevJob = idx >= 0 ? jobs[idx] : null
    const now = Date.now()
    // El proceso principal es la fuente de verdad: el renderer puede traer copias viejas.
    const history = prevJob?.statusHistory ?? job.statusHistory ?? []
    if (!prevJob || prevJob.status !== job.status) {
      job.statusHistory = [...history, { status: job.status, at: now }].slice(-50)
    } else {
      job.statusHistory = history
    }
    if (!job.appliedAt) job.appliedAt = prevJob?.appliedAt
    if (job.lastFollowUpAt === undefined) job.lastFollowUpAt = prevJob?.lastFollowUpAt
    if (job.notes === undefined) job.notes = prevJob?.notes
    if (!job.appliedAt && job.status !== 'draft') {
      // Vacantes antiguas ya postuladas sin fecha: aproximar con su última edición
      // en vez de "ahora", para no reiniciar el contador de seguimiento.
      job.appliedAt = prevJob && prevJob.status !== 'draft' ? (prevJob.updatedAt || now) : now
    }
    if (idx >= 0) jobs[idx] = job
    else jobs.push(job)
    await writeJSON(jobsFile, jobs)
  })
  safeHandle('job:delete', async (_event, id: string): Promise<void> => {
    const { jobsFile } = await getActiveProfileFiles()
    const jobs = (await readJSON<JobApplication[]>(jobsFile)) ?? []
    await writeJSON(jobsFile, jobs.filter((j) => j.id !== id))
  })
  safeHandle('jobs:getUpcomingInterviews', async (): Promise<{ company: string; position: string; interviewDate: number }[]> => {
    const { jobsFile } = await getActiveProfileFiles()
    const jobs = (await readJSON<JobApplication[]>(jobsFile)) ?? []
    const now = Date.now()
    const window = 24 * 3600 * 1000
    return jobs
      .filter((j) => j.status === 'interview' && j.interviewDate && j.interviewDate > now && j.interviewDate - now < window)
      .map((j) => ({ company: j.company, position: j.position, interviewDate: j.interviewDate as number }))
  })
  safeHandle('jobs:getCvVersions', async (_event, jobId: string): Promise<CvVersion[]> => {
    const { cvVersionsFile } = await getActiveProfileFiles()
    const versions = (await readJSON<Record<string, CvVersion[]>>(cvVersionsFile)) ?? {}
    return versions[jobId] || []
  })

  // ── CV Templates ──
  safeHandle('cv:getTemplates', async (): Promise<CvTemplate[]> => {
    await ensureDir(DATA_DIR)
    const templates = await readJSON<CvTemplate[]>(CV_TEMPLATES_FILE)
    if (!templates || templates.length === 0) {
      const seeds = getSeedTemplates()
      await writeJSON(CV_TEMPLATES_FILE, seeds)
      return seeds
    }
    const upgraded = upgradeSeedTemplates(templates)
    if (upgraded.changed) await writeJSON(CV_TEMPLATES_FILE, upgraded.templates)
    return upgraded.templates
  })
  safeHandle('cv:saveTemplate', async (_event, template: CvTemplate): Promise<void> => {
    await ensureDir(DATA_DIR)
    const templates = (await readJSON<CvTemplate[]>(CV_TEMPLATES_FILE)) ?? []
    const idx = templates.findIndex((t) => t.id === template.id)
    if (idx >= 0) templates[idx] = template
    else templates.push(template)
    await writeJSON(CV_TEMPLATES_FILE, templates)
  })
  safeHandle('cv:deleteTemplate', async (_event, id: string): Promise<void> => {
    const templates = (await readJSON<CvTemplate[]>(CV_TEMPLATES_FILE)) ?? []
    await writeJSON(CV_TEMPLATES_FILE, templates.filter((t) => t.id !== id))
  })
  safeHandle('cv:resetTemplates', async (): Promise<void> => {
    // Restaura solo las predeterminadas; las plantillas propias del usuario se conservan.
    const stored = (await readJSON<CvTemplate[]>(CV_TEMPLATES_FILE)) ?? []
    const own = stored.filter((t) => !t.id.startsWith('seed-'))
    await writeJSON(CV_TEMPLATES_FILE, [...getSeedTemplates(), ...own])
  })
  safeHandle('cv:generateSample', async (_event, prompt: string): Promise<string> => {
    const html = await generateSampleCv(prompt)
    return wrapHtml(html)
  })

  // ── LinkedIn Job Search (endpoint guest, sin login) ──
  safeHandle('linkedin:search', async (_event, keywords: string, location?: string, limit?: number): Promise<LinkedInJob[]> => {
    return searchLinkedInJobs(keywords, location, limit)
  })
  safeHandle('linkedin:job', async (_event, input: string): Promise<LinkedInJobDetail | null> => {
    return fetchLinkedInJob(input)
  })
  // ── Buscador de vacantes en internet según el perfil ──
  safeHandle('jobFinder:find', async (event, options?: JobFinderOptions): Promise<FoundJob[]> => {
    return findJobsForProfile(options || {}, (p) => {
      if (!event.sender.isDestroyed()) event.sender.send('jobFinder:progress', p)
    })
  })
  safeHandle('shell:openExternal', async (_event, url: string): Promise<void> => {
    if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) return
    const { shell } = await import('electron')
    await shell.openExternal(url)
  })

  // ── Automation (perfil) ──
  safeHandle('automation:get', async (): Promise<AutomationConfig> => {
    return getAutomationConfig()
  })
  safeHandle('automation:set', async (_event, config: Partial<AutomationConfig>): Promise<AutomationConfig> => {
    return saveAutomationConfig(config)
  })

  // ── Job Categories (CV por categoría) ──
  safeHandle('category:list', async (_event, areaId?: string): Promise<JobCategory[]> => {
    return listCategories(areaId)
  })
  safeHandle('category:save', async (_event, category: JobCategory): Promise<JobCategory[]> => {
    return saveCategory(category)
  })
  safeHandle('category:delete', async (_event, id: string): Promise<JobCategory[]> => {
    return deleteCategory(id)
  })
  safeHandle('category:generate', async (_event, areaId?: string): Promise<JobCategory[]> => {
    return generateCategories(areaId || 'tecnologia')
  })
  safeHandle('categories:listFolders', async (): Promise<string[]> => {
    return listFolders()
  })
  safeHandle('categories:saveFolder', async (_event, name: string): Promise<string[]> => {
    return saveFolder(name)
  })
  safeHandle('categories:deleteFolder', async (_event, name: string): Promise<string[]> => {
    return deleteFolder(name)
  })

  // ── Job Analysis (LLM) ──
  async function loadProfile(): Promise<Profile | null> {
    const internal = await readProfile(USER_PROFILE_PATH)
    if (internal) return internal
    return readProfile(PROFILE_PATH)
  }
  safeHandle('job:correctVacancy', async (_event, rawText: string): Promise<string> => {
    return correctVacancyText(rawText)
  })
  safeHandle('job:analyze', async (event, vacancyText: string): Promise<unknown> => {
    const profile = await loadProfile()
    return analyzeVacancy(vacancyText, profile, (msg) => {
      event.sender.send('investigate:phase', { message: msg })
    })
  })
  safeHandle('job:generateLetters', async (_event, vacancyText: string, atsReport: unknown): Promise<unknown> => {
    const profile = await loadProfile()
    return generateCoverLetters(vacancyText, profile, atsReport as any)
  })
  safeHandle('job:generateFollowUp', async (_event, jobId: string): Promise<FollowUpDraft> => {
    const { jobsFile } = await getActiveProfileFiles()
    const jobs = (await readJSON<JobApplication[]>(jobsFile)) ?? []
    const job = jobs.find((j) => j.id === jobId)
    if (!job) throw new Error('Vacante no encontrada')
    const profile = await loadProfile()
    return generateFollowUpEmail(job, profile)
  })
  safeHandle('job:generateQuestions', async (_event, vacancyText: string, atsReport: unknown): Promise<unknown> => {
    const profile = await loadProfile()
    return generateInterviewQuestions(vacancyText, profile, atsReport as ATSReport | null)
  })
  safeHandle('job:generateCV', async (_event, vacancyText: string, atsReport: unknown, style: string, customPrompt?: string, chosenSummary?: string): Promise<string> => {
    const profile = await loadProfile()
    return generateCV(vacancyText, profile, atsReport as ATSReport | null, style, customPrompt, chosenSummary)
  })
  safeHandle('job:regenerateCV', async (_event, params: {
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
  safeHandle('settings:get', async (): Promise<AppSettings | null> => {
    return readJSON<AppSettings>(SETTINGS_FILE)
  })
  safeHandle('settings:set', async (_event, settings: AppSettings): Promise<void> => {
    await ensureDir(DATA_DIR)
    await writeJSON(SETTINGS_FILE, settings)
  })

  // Email config aislado por perfil
  safeHandle('emailConfig:get', async (): Promise<EmailConfig | null> => {
    const cfg = await readJSON<EmailConfig>((await getActiveProfileFiles()).emailConfigFile)
    if (!cfg) return null
    const profile = await getActiveProfile()
    return { ...cfg, fromName: profile?.name || '' }
  })
  safeHandle('emailConfig:set', async (_event, config: EmailConfig): Promise<void> => {
    const emailFile = (await getActiveProfileFiles()).emailConfigFile
    await ensureParentDir(emailFile)
    const profile = await getActiveProfile()
    await writeJSON(emailFile, { ...config, fromName: profile?.name || config.fromName || '' })
  })

  // ── Investigación en línea (backend remoto) ──
  safeHandle('investigate:query', async (event, userQuery: string, country: string, language: string) => {
    event.sender.send('investigate:phase', { message: 'Investigando...' })
    return investigate(userQuery, country, language)
  })
  safeHandle('investigate:health', async () => {
    return investigateHealth()
  })
  safeHandle('investigate:discover', async () => {
    return discoverBackend()
  })

  // ── WhatsApp (detección de vacantes) ──
  onWhatsAppServiceEvent((serviceEvent: WhatsAppServiceEvent) => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('whatsapp:event', serviceEvent)
    }
  })

  safeHandle('whatsapp:status', async () => getStatusEvent())
  safeHandle('whatsapp:connect', async () => connectWhatsApp())
  safeHandle('whatsapp:disconnect', async () => disconnectWhatsApp())
  safeHandle('whatsapp:getGroups', async () => getWhatsAppGroups())
  safeHandle('whatsapp:scan', async (_event, groupIds: string[], limit?: number) => scanWhatsAppGroups(groupIds, limit))
  safeHandle('whatsapp:getQueue', async () => getWhatsAppQueue())
  safeHandle('whatsapp:markImported', async (_event, vacancyId: string) => markWhatsAppVacancyImported(vacancyId))
  safeHandle('whatsapp:removeFromQueue', async (_event, vacancyId: string) => removeWhatsAppVacancy(vacancyId))
  safeHandle('whatsapp:removeFromQueueMany', async (_event, vacancyIds: string[]) => removeWhatsAppVacancies(vacancyIds))
  safeHandle('whatsapp:getConfig', async () => getWhatsAppConfig())
  safeHandle('whatsapp:setConfig', async (_event, config: WhatsAppConfig) => setWhatsAppConfig(config))
  safeHandle('whatsapp:send', async (_event, payload: WhatsAppSendPayload) => sendWhatsAppMessage(payload))

  // ── Profile (Digital Twin) ──
  safeHandle('profile:get', async (): Promise<Profile | null> => {
    const internal = await readProfile(USER_PROFILE_PATH)
    if (internal) return internal
    // Tras actualizar: si no hay perfil en USER_PROFILE_PATH pero sí un activo con datos en profiles.json, usarlo.
    const file = await loadProfilesFile()
    const active = file.activeId
      ? file.profiles.find((p) => p.id === file.activeId)
      : file.profiles.find((p) => !!p.name || !!p.email)
    if (active) {
      await writeJSON(USER_PROFILE_PATH, active)
      return active
    }
    return readProfile(PROFILE_PATH)
  })
  safeHandle('profile:save', async (_event, profile: Profile): Promise<void> => {
    await saveProfile(profile)
  })
  safeHandle('profile:list', async (): Promise<Profile[]> => {
    return listProfiles()
  })
  safeHandle('profile:setActive', async (_event, profileId: string): Promise<Profile> => {
    return setActiveProfile(profileId)
  })
  safeHandle('profile:migrate', async (): Promise<Profile | null> => {
    const file = await migrateLegacyProfile()
    const active = file.profiles.find((p) => p.id === file.activeId) ?? file.profiles[0] ?? null
    if (active) await writeJSON(USER_PROFILE_PATH, active)
    return active
  })

  // ── LLM Chat (real streaming) ──
  safeHandle('llm:chat', async (_event, params: StreamParams): Promise<void> => {
    const settings = await readJSON<AppSettings>(SETTINGS_FILE)
    const config = {
      baseUrl: settings?.api?.baseUrl || 'http://localhost:11434/v1',
      apiKey: settings?.api?.apiKey || '',
      model: settings?.api?.model || 'llama3',
      maxContextTokens: settings?.api?.maxContextTokens,
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
        action: 'chat',
      },
    )
  })

  safeHandle('llm:abort', async () => {
    abortCurrentStream()
  })

  // ── List Models ──
  safeHandle('llm:listModels', async (_event, params?: { baseUrl?: string; apiKey?: string }): Promise<{ id: string; name?: string }[]> => {
    const settings = await readJSON<AppSettings>(SETTINGS_FILE)
    const config = {
      baseUrl: params?.baseUrl || settings?.api?.baseUrl || 'http://localhost:11434/v1',
      apiKey: params?.apiKey || settings?.api?.apiKey || '',
    }
    return listModels(config)
  })

  // ── Data Export ──
  safeHandle('data:exportAll', async (): Promise<unknown> => {
    const activeFiles = await getActiveProfileFiles()
    const [conversations, jobs, profile, settings, cvTemplates] = await Promise.all([
      readJSON<Conversation[]>(activeFiles.chatsFile),
      readJSON<JobApplication[]>(activeFiles.jobsFile),
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
      chatsFile: activeFiles.chatsFile,
      jobsFile: activeFiles.jobsFile,
    })
    return result
  })

  safeHandle('data:saveExportFile', async (_event, data: unknown, format: 'json' | 'xlsx'): Promise<string | null> => {
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
    const activeFiles = await getActiveProfileFiles()
    const stats = { conversations: 0, jobs: 0, profile: false, settings: false, cvTemplates: 0 }
    const errors: string[] = []

    if (data.conversations) {
      try {
        const existing = (await readJSON<unknown[]>(activeFiles.chatsFile)) ?? []
        const incoming = data.conversations as unknown[]
        const merged = [...incoming, ...existing]
        const seen = new Set<string>()
        const deduped = merged.filter((item: any) => {
          if (!item.id) return true
          if (seen.has(item.id)) return false
          seen.add(item.id)
          return true
        })
        await writeJSON(activeFiles.chatsFile, deduped)
        stats.conversations = incoming.length
      } catch (e) {
        errors.push(`conversations: ${e instanceof Error ? e.message : String(e)}`)
      }
    }

    if (data.jobs) {
      try {
        const existing = (await readJSON<unknown[]>(activeFiles.jobsFile)) ?? []
        const incoming = data.jobs as unknown[]
        const merged = [...incoming, ...existing]
        const seen = new Set<string>()
        const deduped = merged.filter((item: any) => {
          if (!item.id) return true
          if (seen.has(item.id)) return false
          seen.add(item.id)
          return true
        })
        await writeJSON(activeFiles.jobsFile, deduped)
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

  safeHandle('data:importFromFile', async (): Promise<ImportResult> => {
    const { dialog } = await import('electron')
    const fs = await import('fs/promises')
    const pathModule = await import('path')

    const { filePaths, canceled } = await dialog.showOpenDialog(mainWindow, {
      title: 'Importar datos',
      filters: [
        { name: 'JSON o Excel', extensions: ['json', 'xlsx'] },
        { name: 'Todos los archivos', extensions: ['*'] },
      ],
      properties: ['openFile'],
    })
    if (canceled || !filePaths || !filePaths[0]) return null

    const ext = pathModule.extname(filePaths[0]).toLowerCase()
    let data: Record<string, unknown>

    if (ext === '.json') {
      const content = await fs.readFile(filePaths[0], 'utf-8')
      try {
        data = JSON.parse(content)
      } catch {
        return { ok: false, error: 'El archivo no contiene JSON válido' }
      }
      if (!data.exportedAt) return { ok: false, error: 'El archivo no es una exportación válida de Aplica (falta exportedAt)' }
    } else if (ext === '.xlsx') {
      const buf = await fs.readFile(filePaths[0])
      const result = await parseImportXLSX(buf)
      if (result && typeof result === 'object' && 'ok' in result && result.ok === false) return result as ImportResult
      data = result as Record<string, unknown>
    } else {
      return { ok: false, error: 'Formato de archivo no soportado. Usa .json o .xlsx' }
    }

    try {
      const stats = await writeImportData(data)
      return { ok: true, filePath: filePaths[0], stats }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  })

  safeHandle('data:processImportData', async (_event, fileName: string, content: string): Promise<ImportResult> => {
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
      if (result && typeof result === 'object' && 'ok' in result && result.ok === false) return result as ImportResult
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
  safeHandle('clipboard:copy', async (_event, text: string) => {
    clipboard.writeText(text)
  })
  safeHandle('clipboard:readImage', async (): Promise<string | null> => {
    const image = clipboard.readImage()
    if (image.isEmpty()) return null
    return image.toDataURL()
  })

  // ── OCR ──
  safeHandle('ocr:imageToText', async (_event, base64: string): Promise<string> => {
    const settings = await readJSON<AppSettings>(SETTINGS_FILE)
    let llmConfig: { baseUrl: string; apiKey: string; model: string } | null = null
    if (settings?.api?.baseUrl) {
      llmConfig = { baseUrl: settings.api.baseUrl, apiKey: settings.api.apiKey, model: settings.api.model }
    }
    const raw = base64.replace(/^data:image\/\w+;base64,/, '')
    const buffer = Buffer.from(raw, 'base64')
    return extractTextFromImage(buffer, base64, llmConfig, settings?.api?.visionModel)
  })

  // ── Usage ──
  safeHandle('usage:get', async () => getUsage())
  safeHandle('usage:reset', async () => resetUsage())

  // ── Currency Exchange ──
  safeHandle('currency:getRate', async (_event, from: string, to: string): Promise<number> => {
    return getExchangeRate(from, to)
  })

  // ── Update ──
  safeHandle('update:start-download', async () => {
    await startUpdateDownload()
  })
  safeHandle('update:quit-and-install', () => {
    quitAndInstall()
  })

  // ── System Theme ──
  safeHandle('system:getTheme', () => nativeTheme.shouldUseDarkColors)

  // ── App Version ──
  safeHandle('app:getVersion', () => app.getVersion())

  // ── Email (SMTP) ──
  safeHandle('email:presets', async () => SMTP_PRESETS)
  safeHandle('email:test', async (_event, config: EmailConfig): Promise<{ ok: boolean; error?: string }> => {
    return testEmailConnection(config)
  })
  safeHandle('email:send', async (_event, config: EmailConfig, payload: EmailPayload): Promise<{ ok: boolean; error?: string }> => {
    return sendEmail(config, payload)
  })

  // ── CV Summary Options ──
  safeHandle('cv:generateSummaryOptions', async (_event, vacancyText: string, atsReport: unknown): Promise<unknown> => {
    const profile = await loadProfile()
    return generateSummaryOptions(vacancyText, profile, atsReport as ATSReport | null)
  })

  // ── Career Advice ──
  safeHandle('getCareerAdvice', async (): Promise<unknown> => {
    return loadCareerAdvice()
  })

  safeHandle('refreshCareerAdvice', async (event): Promise<unknown> => {
    const profile = await loadProfile()
    return refreshCareerAdvice(profile, (msg) => {
      event.sender.send('investigate:phase', { message: msg })
    })
  })

  // ── Roadmap ──
  safeHandle('getRoadmap', async (): Promise<unknown> => {
    return loadRoadmap()
  })

  safeHandle('roadmap:getGoal', async (): Promise<unknown> => {
    return loadRoadmapGoal()
  })

  safeHandle('roadmap:setGoal', async (_event, goal: unknown): Promise<unknown> => {
    if (!goal || typeof goal !== 'object') throw new Error('Meta inválida')
    return saveRoadmapGoal(goal as Parameters<typeof saveRoadmapGoal>[0])
  })

  safeHandle('roadmap:toggleStep', async (_event, stepId: string, done: boolean): Promise<unknown> => {
    return toggleRoadmapStep(String(stepId), !!done)
  })

  safeHandle('refreshRoadmap', async (event): Promise<unknown> => {
    const profile = await loadProfile()
    return refreshRoadmap(profile, (msg) => {
      event.sender.send('investigate:phase', { message: msg })
    })
  })

  // ── CV Download as PDF ──
  safeHandle('cv:downloadPdf', async (_event, htmlContent: string, styleName: string, opts?: RenderCvOptions): Promise<string | null> => {
    const { dialog, shell } = await import('electron')
    const fs = await import('fs/promises')

    try {
      const pdfBuffer = await renderCvPdf(htmlContent, styleName, { includeCertificates: !!opts?.includeCertificates })
      const isInterview = styleName === 'entrevista'
      const { filePath, canceled } = await dialog.showSaveDialog({
        title: isInterview ? 'Guardar PDF' : 'Guardar CV',
        defaultPath: isInterview ? 'Preguntas-Entrevista.pdf' : `CV-${styleName}.pdf`,
        filters: [{ name: 'PDF', extensions: ['pdf'] }],
      })
      if (canceled || !filePath) return null
      await fs.writeFile(filePath, pdfBuffer)
      shell.openPath(filePath)
      return filePath
    } catch {
      return null
    }
  })

  // ── CV Render PDF in memory (base64) for email attachments ──
  safeHandle('cv:renderPdfBase64', async (_event, htmlContent: string, styleName: string, opts?: RenderCvOptions): Promise<string | null> => {
    try {
      const pdfBuffer = await renderCvPdf(htmlContent, styleName, { includeCertificates: !!opts?.includeCertificates })
      return pdfBuffer.toString('base64')
    } catch {
      return null
    }
  })

  // ── Certificados (PDF/imagen) anexos al CV, por perfil ──
  safeHandle('certificates:list', async (): Promise<CertificateFile[]> => listCertificates())
  safeHandle('certificates:add', async (): Promise<{ certificates: CertificateFile[]; rejected: string[] } | null> => {
    const { dialog } = await import('electron')
    const { filePaths, canceled } = await dialog.showOpenDialog(mainWindow, {
      title: 'Agregar certificados',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'PDF o imagen', extensions: CERTIFICATE_EXTENSIONS }],
    })
    if (canceled || filePaths.length === 0) return null
    return addCertificates(filePaths)
  })
  safeHandle('certificates:update', async (_event, id: string, patch: { name?: string; includeInCv?: boolean }): Promise<CertificateFile[]> =>
    updateCertificate(String(id), patch ?? {}),
  )
  safeHandle('certificates:delete', async (_event, id: string): Promise<CertificateFile[]> => deleteCertificate(String(id)))

  // ── Navegador integrado ──
  safeHandle('browser:getState', async () => getBrowserState())
  safeHandle('browser:saveState', async (_event, state: unknown, profileId?: string | null) =>
    saveBrowserState(state, profileId),
  )
  safeHandle('browser:inspect', async (_event, webContentsId: number) => inspectBrowserPage(webContentsId))
  safeHandle('browser:fill', async (_event, webContentsId: number, entries: BrowserFillEntry[], options?: { highlight?: boolean }) =>
    fillBrowserFields(webContentsId, entries, options),
  )
  safeHandle('browser:undo', async (_event, webContentsId: number) => undoBrowserFill(webContentsId))
  safeHandle('browser:click', async (_event, webContentsId: number, target: { id?: string; text?: string }) =>
    clickBrowserElement(webContentsId, target),
  )
  safeHandle('browser:attachCv', async (_event, webContentsId: number, fieldId: string, cvId?: string | null) =>
    attachBrowserCv(webContentsId, fieldId, cvId),
  )
  safeHandle('browser:listCvs', async () => listBrowserCvs())
  safeHandle('browser:agentRun', async (_event, params: { webContentsId: number; prompt: string }) => {
    if (!params || typeof params.webContentsId !== 'number') throw new Error('Petición no válida.')
    browserAgentAbort?.abort()
    const controller = new AbortController()
    browserAgentAbort = controller
    const emit = (event: BrowserAgentEvent) => {
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('browser:agentEvent', event)
    }
    void runBrowserAgent(params, emit, controller.signal)
      .catch((error) => {
        if (controller.signal.aborted) return
        emit({ type: 'error', message: error instanceof Error ? error.message : String(error) })
      })
      .finally(() => {
        if (browserAgentAbort === controller) browserAgentAbort = null
      })
    return { started: true }
  })
  safeHandle('browser:agentAbort', async () => {
    browserAgentAbort?.abort()
    browserAgentAbort = null
    return { stopped: true }
  })
}

