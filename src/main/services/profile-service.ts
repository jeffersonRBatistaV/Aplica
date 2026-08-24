import { randomUUID } from 'crypto'
import { readJSON, writeJSON, ensureDir } from './storage'
import { readProfile } from './profile-reader'
import { PROFILES_FILE, USER_PROFILE_PATH, DATA_DIR } from '../utils/paths'
import type { Profile } from '../../shared/types'

export interface ProfilesFile {
  profiles: Profile[]
  activeId: string
}

export async function loadProfilesFile(): Promise<ProfilesFile> {
  const data = await readJSON<ProfilesFile>(PROFILES_FILE)
  if (data && Array.isArray(data.profiles)) return data
  return { profiles: [], activeId: '' }
}

export async function listProfiles(): Promise<Profile[]> {
  const file = await loadProfilesFile()
  if (file.profiles.length > 0) return file.profiles

  const current = await readProfile(USER_PROFILE_PATH)
  if (current) {
    const withId: Profile = { ...current, id: current.id || randomUUID() }
    const created: ProfilesFile = { profiles: [withId], activeId: withId.id ?? '' }
    await ensureDir(DATA_DIR)
    await writeJSON(PROFILES_FILE, created)
    await writeJSON(USER_PROFILE_PATH, withId)
    return [withId]
  }
  return []
}

export async function setActiveProfile(profileId: string): Promise<Profile> {
  const file = await loadProfilesFile()
  const profile = file.profiles.find((p: Profile) => p.id === profileId)
  if (!profile) throw new Error('Profile not found: ' + profileId)

  const updated: ProfilesFile = { ...file, activeId: profileId }
  await ensureDir(DATA_DIR)
  await writeJSON(PROFILES_FILE, updated)
  await writeJSON(USER_PROFILE_PATH, profile)
  return profile
}

export async function saveProfile(profile: Profile): Promise<Profile> {
  await ensureDir(DATA_DIR)
  const file = await loadProfilesFile()

  let id = profile.id
  const exists = id ? file.profiles.some((p: Profile) => p.id === id) : false
  if (!id || !exists) {
    if (!id && file.activeId && file.profiles.some((p: Profile) => p.id === file.activeId)) {
      id = file.activeId
    } else {
      id = profile.id || randomUUID()
    }
  }

  const toSave: Profile = { ...profile, id }

  await writeJSON(USER_PROFILE_PATH, toSave)

  const idx = file.profiles.findIndex((p: Profile) => p.id === id)
  let profiles: Profile[]
  let activeId = file.activeId
  if (idx >= 0) {
    profiles = file.profiles.map((p: Profile, i) => (i === idx ? toSave : p))
  } else {
    profiles = [...file.profiles, toSave]
    activeId = toSave.id ?? ''
  }
  await writeJSON(PROFILES_FILE, { profiles, activeId })
  return toSave
}
