import { readJSON } from './storage'
import { USER_PROFILE_PATH, PROFILE_PATH } from '../utils/paths'
import { loadProfilesFile } from './profile-service'
import type { Profile } from '../../shared/types'

/** Perfil activo: el de profile.json, con fallback al activo de profiles.json o al legacy. */
export async function getActiveProfile(): Promise<Profile | null> {
  const internal = await readJSON<Profile>(USER_PROFILE_PATH)
  if (internal?.id) return internal
  const file = await loadProfilesFile()
  const active = file.activeId
    ? file.profiles.find((p) => p.id === file.activeId)
    : file.profiles.find((p) => !!(p.name || p.email)) ?? null
  if (active) return active
  return readJSON<Profile>(PROFILE_PATH)
}

/** ID del perfil activo, o null si no hay ningún perfil todavía. */
export async function getActiveProfileId(): Promise<string | null> {
  const profile = await getActiveProfile()
  return profile?.id ?? null
}