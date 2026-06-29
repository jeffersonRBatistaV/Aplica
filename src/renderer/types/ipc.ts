import type { Conversation, AppSettings, StreamParams, Profile, JobApplication, ATSReport, CvTemplate, InterviewQuestion, UsageStats } from '../../shared/types'

export interface ModelInfo {
  id: string
  name?: string
}

export interface ElectronAPI {
  // File System
  readFile: (filePath: string) => Promise<string>
  writeFile: (filePath: string, data: string) => Promise<void>
  deleteFile: (filePath: string) => Promise<void>
  readDirectory: (dirPath: string) => Promise<string[]>
  fileExists: (filePath: string) => Promise<boolean>

  // Chat CRUD
  getConversations: () => Promise<Conversation[]>
  getConversation: (id: string) => Promise<Conversation | null>
  saveConversation: (conversation: Conversation) => Promise<void>
  deleteConversation: (id: string) => Promise<void>
  renameConversation: (id: string, title: string) => Promise<void>
  archiveConversation: (id: string) => Promise<void>
  searchConversations: (query: string) => Promise<Conversation[]>

  // Settings
  getSettings: () => Promise<AppSettings | null>
  setSettings: (settings: AppSettings) => Promise<void>

  // Profile
  getProfile: () => Promise<Profile | null>
  saveProfile: (profile: Profile) => Promise<void>

  // LLM Streaming
  sendChatMessage: (params: StreamParams) => Promise<unknown>
  abortChat: () => Promise<void>
  listModels: (params?: { baseUrl?: string; apiKey?: string }) => Promise<ModelInfo[]>
  onToken: (callback: (token: string) => void) => () => void
  onDone: (callback: () => void) => () => void
  onError: (callback: (error: string) => void) => () => void

  // Job Hub
  getJobs: () => Promise<JobApplication[]>
  getJob: (id: string) => Promise<JobApplication | null>
  saveJob: (job: JobApplication) => Promise<void>
  deleteJob: (id: string) => Promise<void>
  analyzeVacancy: (vacancyText: string) => Promise<ATSReport>
  correctVacancyText: (rawText: string) => Promise<string>
  generateCoverLetters: (vacancyText: string, atsReport: ATSReport) => Promise<{ coverLetterA: string; coverLetterB: string; recruiterEmail: string; subject: string }>
  generateCV: (vacancyText: string, atsReport: ATSReport | null, style: string) => Promise<string>
  generateInterviewQuestions: (vacancyText: string, atsReport: ATSReport | null) => Promise<InterviewQuestion[]>

  // Theme
  getSystemTheme: () => Promise<boolean>
  onSystemThemeChange: (callback: (isDark: boolean) => void) => () => void

  // OCR
  imageToText: (base64: string) => Promise<string>

  // CV
  generateSummaryOptions: (vacancyText: string, atsReport: ATSReport | null) => Promise<{ id: string; label: string; summary: string }[]>
  downloadCvPdf: (htmlContent: string, styleName: string) => Promise<string | null>
  generateCV: (vacancyText: string, atsReport: ATSReport | null, style: string, customPrompt?: string, chosenSummary?: string) => Promise<string>
  regenerateCV: (params: {
    currentCv: string
    style: string
    vacancyText: string
    atsReport: ATSReport | null
    instructions: string
    customPrompt?: string
  }) => Promise<string>

  // CV Templates
  getCvTemplates: () => Promise<CvTemplate[]>
  saveCvTemplate: (template: CvTemplate) => Promise<void>
  deleteCvTemplate: (id: string) => Promise<void>
  resetCvTemplates: () => Promise<void>
  generateSampleCv: (prompt: string) => Promise<string>

  // Usage
  getUsage: () => Promise<UsageStats>
  resetUsage: () => Promise<void>

  // Data Export / Import
  exportAll: () => Promise<unknown>
  saveExportFile: (data: unknown, format: 'json' | 'xlsx') => Promise<string | null>
  importFromFile: () => Promise<string | null>

  // Clipboard
  copyToClipboard: (text: string) => Promise<void>
  readClipboardImage: () => Promise<string | null>

  // Currency Exchange
  getExchangeRate: (from: string, to: string) => Promise<number>
}

declare global {
  interface Window {
    api: ElectronAPI
  }
}
