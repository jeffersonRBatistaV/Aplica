export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
}

export interface Conversation {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  archived: boolean
  messages: Message[]
}

export interface AppSettings {
  api: ApiConfig
  appearance: AppearanceConfig
  privacy: PrivacyConfig
  systemPrompt: string
  locale: string
  ttsVoice: string
  preferredCurrency: string
}

export interface ApiConfig {
  baseUrl: string
  apiKey: string
  model: string
  configured?: boolean
}

export interface AppearanceConfig {
  mode: 'light' | 'dark' | 'system'
}

export interface PrivacyConfig {
  storeHistory: boolean
  excludeFromTraining: boolean
}

export interface Project {
  name: string
  description: string
}

export interface UsageRecord {
  promptTokens: number
  completionTokens: number
  model: string
  estimatedCost: number
  timestamp: number
}

export interface UsageStats {
  totalPromptTokens: number
  totalCompletionTokens: number
  totalCost: number
  records: UsageRecord[]
}

export interface Profile {
  name: string
  email: string
  phone: string
  location: string
  targetMarket: string
  github: string
  linkedin: string
  portfolio: string
  photo: string
  title: string
  summary: string
  skills: string[]
  skillLevels: Record<string, string>
  experience: Experience[]
  education: Education[]
  certifications: string[]
  languages: string[]
  projects: Project[]
}

export interface Experience {
  company: string
  position: string
  startDate: string
  endDate: string | null
  description: string
  highlights: string[]
}

export interface Education {
  institution: string
  degree: string
  field: string
  startDate: string
  endDate: string
}

export interface StreamParams {
  conversationId: string
  messages: Message[]
  systemPrompt?: string
  profile?: Profile | null
}

export type ThemeMode = 'light' | 'dark' | 'system'

export interface ATSReport {
  matchScore: number
  keywordsPresent: string[]
  keywordsMissing: string[]
  strengths: string[]
  gaps: string[]
  quickFixes: string[]
  analysis: string
}

export interface CvTemplate {
  id: string
  name: string
  prompt: string
  sampleHtml: string
  createdAt: number
  updatedAt: number
}

export type JobStatus = 'draft' | 'applied' | 'interview' | 'offer' | 'rejected'

export interface JobApplication {
  id: string
  createdAt: number
  updatedAt: number
  company: string
  position: string
  category: string
  status: JobStatus
  vacancyText: string
  atsReport: ATSReport | null
  coverLetterA: string
  coverLetterB: string
  cvStyle: string | null
  cvContent: string
  recipientEmail: string
  emailSubject: string
  interviewQuestions: InterviewQuestion[]
}

export interface InterviewQuestion {
  question: string
  answer: string
  category: string
}

export type AppView = 'chat' | 'jobs' | 'analytics' | 'roadmap'

export interface RoadmapAction {
  title: string
  description: string
  priority: 'alta' | 'media' | 'baja'
}

export interface RoadmapPhase {
  name: string
  timeframe: string
  actions: RoadmapAction[]
}

export interface Roadmap {
  phases: RoadmapPhase[]
  generatedAt: number
  targetMarket: string
}

export interface ImportStats {
  conversations: number
  jobs: number
  profile: boolean
  settings: boolean
  cvTemplates: number
}

export type ImportResult =
  | { ok: true; filePath: string; stats: ImportStats }
  | { ok: false; error: string }
  | null
