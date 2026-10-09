import type { AutomationConfig } from '../../shared/types'
import { readJSON, writeJSON } from './storage'
import { getActiveProfileFiles, ensureParentDir } from './profile-data'

export const DEFAULT_AUTOMATION_CONFIG: AutomationConfig = {
  enabled: false,
  autoCv: true,
  autoQuestions: true,
  cvStyle: 'ats',
  cvSummaryId: null,
  askBeforeApply: true,
  dontOfferAgain: false,
}

export async function getAutomationConfig(): Promise<AutomationConfig> {
  const { automationFile } = await getActiveProfileFiles()
  const stored = await readJSON<Partial<AutomationConfig>>(automationFile)
  return { ...DEFAULT_AUTOMATION_CONFIG, ...(stored ?? {}) }
}

export async function saveAutomationConfig(config: Partial<AutomationConfig>): Promise<AutomationConfig> {
  const { automationFile } = await getActiveProfileFiles()
  const merged = { ...(await getAutomationConfig()), ...config }
  await ensureParentDir(automationFile)
  await writeJSON(automationFile, merged)
  return merged
}
