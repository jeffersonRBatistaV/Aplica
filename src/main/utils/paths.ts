import { app } from 'electron'
import path from 'path'

export const DATA_DIR = path.join(app.getPath('userData'), 'data')
export const CHATS_FILE = path.join(DATA_DIR, 'chats.json')
export const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json')
export const JOBS_FILE = path.join(DATA_DIR, 'jobs.json')
export const PROFILE_PATH = path.join(
  app.getPath('home'),
  '.config/opencode/skills/cover-letter-creator/perfil.json',
)
export const USER_PROFILE_PATH = path.join(DATA_DIR, 'profile.json')
export const PROFILES_FILE = path.join(DATA_DIR, 'profiles.json')
export const CV_TEMPLATES_FILE = path.join(DATA_DIR, 'cv-templates.json')
export const CATEGORIES_FILE = path.join(DATA_DIR, 'categories.json')
export const FOLDERS_FILE = path.join(DATA_DIR, 'folders.json')
export const USAGE_FILE = path.join(DATA_DIR, 'usage.json')
export const CAREER_ADVICE_FILE = path.join(DATA_DIR, 'career-advice.json')
export const ROADMAP_FILE = path.join(DATA_DIR, 'roadmap.json')
export const CV_VERSIONS_FILE = path.join(DATA_DIR, 'cv-versions.json')

/**
 * Datos aislados por perfil. Cada perfil tiene su propia carpeta
 * `{DATA_DIR}/profiles-data/{profileId}/` con sus chats, vacantes,
 * estadísticas de uso, roadmap, consejos de carrera, categorías y carpetas.
 */
export const PROFILE_DATA_DIR = path.join(DATA_DIR, 'profiles-data')

export function profileScopeDir(profileId: string): string {
  return path.join(PROFILE_DATA_DIR, profileId)
}

export function profileChatsFile(profileId: string): string {
  return path.join(profileScopeDir(profileId), 'chats.json')
}

export function profileJobsFile(profileId: string): string {
  return path.join(profileScopeDir(profileId), 'jobs.json')
}

export function profileUsageFile(profileId: string): string {
  return path.join(profileScopeDir(profileId), 'usage.json')
}

export function profileRoadmapFile(profileId: string): string {
  return path.join(profileScopeDir(profileId), 'roadmap.json')
}

export function profileCareerAdviceFile(profileId: string): string {
  return path.join(profileScopeDir(profileId), 'career-advice.json')
}

export function profileCategoriesFile(profileId: string): string {
  return path.join(profileScopeDir(profileId), 'categories.json')
}

export function profileFoldersFile(profileId: string): string {
  return path.join(profileScopeDir(profileId), 'folders.json')
}

export function profileCvVersionsFile(profileId: string): string {
  return path.join(profileScopeDir(profileId), 'cv-versions.json')
}

export function profileEmailConfigFile(profileId: string): string {
  return path.join(profileScopeDir(profileId), 'email-config.json')
}

export const WHATSAPP_SESSION_DIR = path.join(DATA_DIR, 'whatsapp-session')

export function profileWhatsAppFile(profileId: string): string {
  return path.join(profileScopeDir(profileId), 'whatsapp.json')
}
