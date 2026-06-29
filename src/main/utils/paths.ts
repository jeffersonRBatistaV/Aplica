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
export const CV_TEMPLATES_FILE = path.join(DATA_DIR, 'cv-templates.json')
