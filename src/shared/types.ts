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

export interface EmailConfig {
  provider: 'gmail' | 'outlook' | 'yahoo' | 'icloud' | 'zoho' | 'custom'
  host: string
  port: number
  secure: boolean
  user: string
  pass: string
  fromName: string
  configured: boolean
}

export interface AppSettings {
  api: ApiConfig
  investigate: InvestigateConfig
  appearance: AppearanceConfig
  privacy: PrivacyConfig
  systemPrompt: string
  locale: string
  ttsVoice: string
  preferredCurrency: string
  emailConfig?: EmailConfig
  lastSeenVersion?: string
  ocr?: OcrConfig
}

export interface EmailPreset {
  host: string
  port: number
  secure: boolean
}

export interface EmailAttachment {
  filename: string
  contentBase64: string
}

export interface EmailPayload {
  to: string
  subject: string
  body: string
  attachments?: EmailAttachment[]
}

export interface EmailResult {
  ok: boolean
  error?: string
}

export interface ApiConfig {
  baseUrl: string
  apiKey: string
  model: string
  visionModel?: string
  configured?: boolean
  maxContextTokens?: number
}

export interface ProviderDiagnostic {
  provider: string
  status: 'ok' | 'failed' | 'skipped'
  results: number
  error?: string
}

/** Configuración de investigación web local (pipeline: búsqueda → extracción → síntesis LLM). */
export interface InvestigateConfig {
  /** Motor de búsqueda preferido: 'auto' usa DuckDuckGo → SearXNG → Bing → Brave → Google con fallback automático. */
  searchProvider: 'auto' | 'duckduckgo' | 'searxng' | 'bing' | 'brave' | 'google'
  /** Brave Search API key (gratis en brave.com/search/api, 2000/mes). */
  braveApiKey?: string
  /** Google Custom Search API key (gratis en console.cloud.google.com, 100/día). */
  googleApiKey?: string
  /** Google Custom Search Engine ID. */
  googleSearchEngineId?: string
  /** Máximo de resultados por búsqueda. */
  maxSearchResults: number
  /** Máximo de caracteres extraídos por página. */
  maxExtractChars: number
  /** Timeout de búsqueda en ms. */
  searchTimeout: number
  /** Timeout de extracción en ms. */
  extractTimeout: number
}

export interface InvestigateResult {
  answer: string
  sources: { url: string; title: string; content?: string }[]
  used_extracted: { url: string; provider?: string }[]
  query: string
  country: string
  language: string
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

export interface Reference {
  type: 'personal' | 'professional'
  name: string
  relationship: string
  contact: string
}

export interface UsageRecord {
  action: string
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
  id?: string
  name: string
  email: string
  phone: string
  location: string
  /** País ISO 3166-1 alpha-2 (DO, US, MX...) — usado para localizar investigaciones en línea. */
  country: string
  targetMarket: string
  github: string
  linkedin: string
  portfolio: string
  photo: string
  area?: string
  title: string
  summary: string
  skills: string[]
  skillLevels: Record<string, string>
  experience: Experience[]
  education: Education[]
  certifications: string[]
  languages: string[]
  projects: Project[]
  references: Reference[]
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

/** Rango salarial de referencia estimado a partir de la investigación web. */
export interface SalaryRange {
  min?: number | null
  max?: number | null
  currency?: string
  period?: string
  note?: string
}

export interface ATSReport {
  matchScore: number
  keywordsPresent: string[]
  keywordsMissing: string[]
  strengths: string[]
  gaps: string[]
  quickFixes: string[]
  analysis: string
  company?: string
  position?: string
  salaryRange?: SalaryRange | null
}

export interface CvTemplate {
  id: string
  name: string
  prompt: string
  sampleHtml: string
  createdAt: number
  updatedAt: number
  extraPrompt?: string
  /** Version del diseno predeterminado (solo plantillas `seed-*`). */
  seedVersion?: number
  /** El usuario edito el prompt/nombre de una predeterminada: no se sobrescribe al actualizar disenos. */
  customized?: boolean
}

export type JobStatus = 'draft' | 'applied' | 'interview' | 'offer' | 'rejected'

export interface CvVersion {
  style: string | null
  content: string
  createdAt: number
}

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
  /** Teléfono de contacto de la vacante (para enviar el CV por WhatsApp). */
  recipientPhone?: string
  emailSubject: string
  interviewQuestions: InterviewQuestion[]
  interviewDate?: number
  /** URL de origen si la vacante fue importada desde el buscador web. */
  sourceUrl?: string
  /** Momento en que la vacante pasó a 'applied' por primera vez (lo fija job:save). */
  appliedAt?: number
  /** Historial de cambios de estado (lo mantiene job:save en el proceso principal). */
  statusHistory?: JobStatusChange[]
  /** Último seguimiento (follow-up) enviado/realizado al reclutador. */
  lastFollowUpAt?: number
  /** Notas libres del usuario sobre la postulación. */
  notes?: string
}

export interface JobStatusChange {
  status: JobStatus
  at: number
}

export interface FollowUpDraft {
  subject: string
  body: string
}

export interface InterviewQuestion {
  question: string
  answer: string
  category: string
}

export interface LinkedInJob {
  id: string
  title: string
  company: string
  location: string
  url: string
  postedAt?: string
  source: 'linkedin' | 'web'
}

export interface LinkedInJobDetail {
  description: string
  title?: string
  company?: string
  location?: string
}

export interface AutomationConfig {
  enabled: boolean
  autoCv: boolean
  autoQuestions: boolean
  cvStyle: string | null
  cvSummaryId: string | null
  askBeforeApply: boolean
  dontOfferAgain: boolean
}

export interface JobCategory {
  id: string
  areaId: string
  name: string
  description: string
  keywords: string[]
  source: 'seed' | 'ai' | 'custom'
  createdAt: number
  folder?: string
}

export type AppView = 'home' | 'chat' | 'jobs' | 'analytics' | 'roadmap' | 'whatsapp' | 'browser'

export interface RoadmapAction {
  id?: string
  title: string
  description: string
  priority: 'alta' | 'media' | 'baja'
  /** Entregable/evidencia concreta que demuestra que el paso está hecho. */
  deliverable?: string
  done?: boolean
  doneAt?: number
}

/** El "norte" del usuario: a dónde quiere llegar. Guía todo el roadmap. */
export interface RoadmapGoal {
  /** Puesto/rol objetivo (p. ej. "Desarrollador Backend Senior en remoto para EE. UU."). */
  targetRole: string
  /** Plazo deseado en meses. */
  horizonMonths: number
  /** Por qué: motivación o lo que significa lograrlo. */
  why: string
  targetMarket?: string
  workMode?: 'remoto' | 'hibrido' | 'presencial' | 'cualquiera'
  targetSalary?: string
  hoursPerWeek?: number
  /** Restricciones o contexto (estudia, trabaja, cuidados, presupuesto…). */
  constraints?: string
  updatedAt: number
}

export interface RoadmapGap {
  skill: string
  current: string
  needed: string
}

export type OcrMethod = 'auto' | 'tesseract' | 'vision'

export interface OcrConfig {
  method: OcrMethod
}

export type WhatsAppStatus = 'disconnected' | 'connecting' | 'qr' | 'authenticated' | 'connected' | 'failed'

export type WhatsAppTargetType = 'group' | 'channel'

export interface WhatsAppGroup {
  id: string
  name: string
  type: WhatsAppTargetType
  participants?: number
}

export interface WhatsAppVacancy {
  id: string
  /**
   * Huella de contenido GLOBAL (sin groupId). Diferentes grupos/mensajes que publican
   * la misma oferta (mismo título/empresa/correo/teléfono/enlace) generan la MISMA huella.
   * addToQueue la usa para no repetir vacantes que ya están en la cola.
   */
  fingerprint?: string
  title: string
  company?: string
  category?: string
  snippet: string
  vacancyText: string
  groupId: string
  groupName: string
  messageTime: number
  author?: string
  hasImage: boolean
  ocrText?: string
  email?: string
  phone?: string
  sourceUrl?: string
  /** true si la IA confirmó/clasificó la vacante (su categoría no se re-clasifica con heurística). */
  aiVerified?: boolean
}

export interface WhatsAppScanResult {
  vacancies: WhatsAppVacancy[]
  scanned: number
  phases: string[]
  /** true si WhatsApp Web se desincronizó (frame desacoplado) durante el escaneo. */
  pageError?: boolean
  /** true si se reconectó la sesión con éxito y el escaneo pudo continuar. */
  recovered?: boolean
}

export interface WhatsAppConfig {
  monitoredGroups: string[]
  realtime: boolean
  /** Si está activo, las vacantes clasificadas como 'General / Otra' también se descartan de la cola. */
  strictAreaFilter?: boolean
  /** Usa la IA para confirmar mensajes dudosos y extraer puesto/empresa/categoría (por defecto activo). */
  aiAssist?: boolean
  vacancyQueue: WhatsAppVacancy[]
  processedMessageIds: string[]
}

/** Un hito del camino (antes "fase"). */
export interface RoadmapPhase {
  name: string
  timeframe: string
  /** Qué podrás hacer/demostrar al completar este hito. */
  objective?: string
  /** "Sabrás que llegaste cuando…" */
  successCriteria?: string
  actions: RoadmapAction[]
}

export interface Roadmap {
  phases: RoadmapPhase[]
  generatedAt: number
  targetMarket: string
  /** Meta con la que se generó. */
  goal?: RoadmapGoal
  /** Punto de partida (resumen de dónde está hoy el usuario). */
  startingPoint?: string
  /** Frase del destino final. */
  northStar?: string
  /** Brechas entre el perfil actual y el rol objetivo. */
  gaps?: RoadmapGap[]
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

// ── Navegador integrado + autofill ──

export type BrowserAutofillKey =
  | 'fullName'
  | 'firstName'
  | 'lastName'
  | 'email'
  | 'phone'
  | 'location'
  | 'city'
  | 'country'
  | 'linkedin'
  | 'github'
  | 'portfolio'
  | 'title'
  | 'company'
  | 'yearsExperience'
  | 'summary'
  | 'skills'
  | 'languages'
  | 'educationInstitution'
  | 'educationDegree'
  | 'educationField'

export interface BrowserFieldOption {
  value: string
  label: string
}

/** Campo de formulario detectado dentro de la pagina web. */
export interface BrowserFormField {
  id: string
  frameIndex: number
  kind: 'input' | 'textarea' | 'select' | 'contenteditable' | 'other'
  type: string
  name: string
  idAttr?: string
  label: string
  placeholder: string
  autocomplete: string
  required: boolean
  disabled: boolean
  readonly: boolean
  value: string
  checked?: boolean
  visible: boolean
  options: BrowserFieldOption[]
  accept?: string
  multiple?: boolean
  signature: string
  suggestedKey: BrowserAutofillKey | null
  suggestedValue: string
  confidence: number
}

export interface BrowserButton {
  id: string
  text: string
  type: string
  disabled: boolean
  visible: boolean
}

export interface BrowserPageSnapshot {
  url: string
  title: string
  text: string
  fields: BrowserFormField[]
  buttons: BrowserButton[]
  frames: number
  capturedAt: number
}

export interface BrowserFillEntry {
  id: string
  value: string
}

export interface BrowserFillDetail {
  id: string
  status: 'filled' | 'skipped' | 'error'
  message?: string
}

export interface BrowserFillResult {
  filled: number
  skipped: number
  details: BrowserFillDetail[]
}

export type BrowserMapping =
  | { key: BrowserAutofillKey }
  | { key: 'skip' }
  | { key: 'custom'; custom: string }

export interface BrowserHistoryEntry {
  url: string
  title: string
  visitedAt: number
}

export interface BrowserState {
  lastUrl: string
  history: BrowserHistoryEntry[]
  /** Mapeos manuales por dominio y firma de campo. */
  fieldOverrides: Record<string, Record<string, BrowserMapping>>
  zoom: number
  selectedCvId: string | null
  confirmBeforeSubmit: boolean
  overwriteExisting: boolean
  /** Prompt que sigue el agente del navegador. Vacío = prompt predeterminado. Persiste entre sesiones. */
  agentPrompt: string
}

export interface BrowserCvOption {
  id: string
  label: string
  style: string | null
  createdAt: number
  jobId?: string
}

export interface BrowserAttachResult {
  ok: boolean
  filePath: string
  label: string
  message?: string
}

export type BrowserAgentEvent =
  | { type: 'status'; status: 'running' | 'idle' | 'error'; message?: string }
  | { type: 'step'; step: number; message: string }
  | { type: 'tool'; step: number; name: string; result?: string; ok?: boolean }
  | { type: 'done'; summary: string; pending: string[] }
  | { type: 'error'; message: string }
