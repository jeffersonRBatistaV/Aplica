import fs from 'fs/promises'
import path from 'path'
import { readJSON, writeJSON, ensureDir } from './storage'
import {
  DATA_DIR,
  PROFILE_DATA_DIR,
  CHATS_FILE,
  JOBS_FILE,
  USAGE_FILE,
  ROADMAP_FILE,
  CAREER_ADVICE_FILE,
  CATEGORIES_FILE,
  FOLDERS_FILE,
  CV_VERSIONS_FILE,
  SETTINGS_FILE,
  profileChatsFile,
  profileJobsFile,
  profileUsageFile,
  profileRoadmapFile,
  profileCareerAdviceFile,
  profileCategoriesFile,
  profileFoldersFile,
  profileCvVersionsFile,
  profileEmailConfigFile,
  profileWhatsAppFile,
} from '../utils/paths'
import { getActiveProfileId } from './profile-scope'
import type { AppSettings, EmailConfig } from '../../shared/types'

export interface ActiveProfileFiles {
  chatsFile: string
  jobsFile: string
  usageFile: string
  roadmapFile: string
  careerAdviceFile: string
  categoriesFile: string
  foldersFile: string
  cvVersionsFile: string
  emailConfigFile: string
  whatsappFile: string
}

const SCOPED_FILE_NAMES = [
  'chats.json',
  'jobs.json',
  'usage.json',
  'roadmap.json',
  'career-advice.json',
  'categories.json',
  'folders.json',
  'cv-versions.json',
  'whatsapp.json',
] as const

/** Rutas de los datos del perfil activo. Sin perfil activo, cae a las rutas legacy. */
export async function getActiveProfileFiles(): Promise<ActiveProfileFiles> {
  const pid = await getActiveProfileId()
  if (pid) {
    return {
      chatsFile: profileChatsFile(pid),
      jobsFile: profileJobsFile(pid),
      usageFile: profileUsageFile(pid),
      roadmapFile: profileRoadmapFile(pid),
      careerAdviceFile: profileCareerAdviceFile(pid),
      categoriesFile: profileCategoriesFile(pid),
      foldersFile: profileFoldersFile(pid),
      cvVersionsFile: profileCvVersionsFile(pid),
      emailConfigFile: profileEmailConfigFile(pid),
      whatsappFile: profileWhatsAppFile(pid),
    }
  }
  return {
    chatsFile: CHATS_FILE,
    jobsFile: JOBS_FILE,
    usageFile: USAGE_FILE,
    roadmapFile: ROADMAP_FILE,
    careerAdviceFile: CAREER_ADVICE_FILE,
    categoriesFile: CATEGORIES_FILE,
    foldersFile: FOLDERS_FILE,
    cvVersionsFile: CV_VERSIONS_FILE,
    emailConfigFile: path.join(DATA_DIR, 'email-config.json'),
    whatsappFile: path.join(DATA_DIR, 'whatsapp.json'),
  }
}

export async function ensureParentDir(filePath: string): Promise<void> {
  await ensureDir(path.dirname(filePath))
}

async function isEmptyScopedData(data: unknown): Promise<boolean> {
  if (Array.isArray(data)) return data.length === 0
  if (data && typeof data === 'object') return Object.keys(data as Record<string, unknown>).length === 0
  return false
}

/**
 * Migra los datos legacy (guardados en DATA_DIR, compartidos) a la carpeta del
 * perfil activo. Solo se ejecuta la primera vez: la fuente se elimina tras copiarla.
 */
export async function migrateProfileScopedData(): Promise<void> {
  const pid = await getActiveProfileId()
  if (!pid) return
  const destDir = path.join(PROFILE_DATA_DIR, pid)
  await ensureDir(destDir)
  for (const name of SCOPED_FILE_NAMES) {
    const src = path.join(DATA_DIR, name)
    const dest = path.join(destDir, name)
    const data = await readJSON(src)
    if (data === null) continue
    try {
      if (await isEmptyScopedData(data)) {
        await fs.unlink(src).catch(() => {})
        continue
      }
      await writeJSON(dest, data)
      await fs.unlink(src).catch(() => {})
    } catch {
      // Si algo falla para un archivo, continuar con el resto.
    }
  }
}

/**
 * Migra el emailConfig del perfil activo desde settings.json (global) hacia el
 * archivo aislado del perfil. Una vez migrado se quita de settings.json.
 */
export async function migrateLegacyEmailConfig(): Promise<void> {
  const pid = await getActiveProfileId()
  if (!pid) return
  const emailFile = profileEmailConfigFile(pid)
  if ((await readJSON<EmailConfig>(emailFile)) !== null) return
  const settings = await readJSON<AppSettings>(SETTINGS_FILE)
  const emailConfig = settings?.emailConfig
  if (!emailConfig || !emailConfig.user) return
  await ensureParentDir(emailFile)
  await writeJSON(emailFile, emailConfig)
  const next = { ...settings } as Partial<AppSettings>
  delete next.emailConfig
  await writeJSON(SETTINGS_FILE, next)
}