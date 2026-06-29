import { readJSON } from './storage'
import type { Profile } from '../../shared/types'

export async function readProfile(profilePath: string): Promise<Profile | null> {
  return readJSON<Profile>(profilePath)
}
