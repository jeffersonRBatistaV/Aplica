import { useState } from 'react'
import { Briefcase, Library, Columns, FileText, Loader2, AlertCircle } from 'lucide-react'
import { VacancyInput } from './VacancyInput'
import { ATSReportView } from './ATSReport'
import { CoverLetterGenerator } from './CoverLetterGenerator'
import { CVGenerator } from './CVGenerator'
import { DocumentLibrary } from './DocumentLibrary'
import { InterviewPrep } from './InterviewPrep'
import { KanbanBoard } from './KanbanBoard'
import { TemplatesManager } from './TemplatesManager'
import type { ATSReport, JobApplication, InterviewQuestion } from '../../../shared/types'
import { useTranslation } from 'react-i18next'

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'Tecnología / IT': ['software', 'desarrollador', 'developer', 'frontend', 'backend', 'full stack', 'devops', 'data science', 'machine learning', 'it', 'sistemas', 'infraestructura', 'cloud', 'programador', 'ingeniero de software'],
  'Salud / Medicina': ['médico', 'doctor', 'enfermero', 'enfermera', 'salud', 'clínica', 'hospital', 'medicina', 'paciente', 'farmacia', 'laboratorio', 'cirugía', 'psicólogo'],
  'Finanzas / Contabilidad': ['finanzas', 'contador', 'contabilidad', 'auditor', 'banca', 'inversiones', 'tesorería', 'controller', 'cfo', 'analista financiero'],
  'Educación / Docencia': ['profesor', 'docente', 'educación', 'enseñanza', 'maestro', 'pedagogo', 'investigador', 'académico', 'escuela', 'universidad'],
  'Ventas / Marketing': ['ventas', 'marketing', 'comercial', 'account manager', 'social media', 'seo', 'sem', 'publicidad', 'brand', 'e-commerce', 'business development', 'vendedor'],
  'Ingeniería': ['ingeniero', 'ingeniería', 'civil', 'mecánica', 'eléctrica', 'industrial', 'química', 'proyectos', 'construcción', 'manufactura'],
  'Legal / Jurídico': ['abogado', 'legal', 'jurídico', 'derecho', 'corporativo', 'litigio', 'compliance', 'notario', 'consultor legal'],
  'Administrativo / Oficina': ['asistente', 'administrativo', 'secretario', 'recepcionista', 'recursos humanos', 'rrhh', 'office', 'coordinador administrativo', 'servicio al cliente'],
  'Arte / Diseño': ['diseñador', 'diseño', 'ux', 'ui', 'ilustrador', 'animador', 'artista', 'creativo', 'gráfico', 'figma', 'photoshop', 'arquitecto'],
}

function extractCategory(text: string): string {
  const lower = text.toLowerCase()
  let bestCategory = 'General / Otra'
  let bestScore = 0

  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    let score = 0
    for (const kw of keywords) {
      if (lower.includes(kw)) score++
    }
    if (score > bestScore) {
      bestScore = score
      bestCategory = cat
    }
  }

  return bestCategory
}

function extractJobInfo(text: string): { company: string; position: string } {
  let company = ''
  let position = ''

  const lines = text.split('\n')

  for (const line of lines) {
    const t = line.trim()
    if (!t) continue

    const c = t.match(/^(?:Company|Empresa|Compañía|Compania|Organization|Organización|About)\s*[:]\s*(.+)/i)
    if (c) { company = c[1].trim(); continue }

    const p = t.match(/^(?:Position|Puesto|Role|Rol|Title|Título|Cargo)\s*[:]\s*(.+)/i)
    if (p) { position = p[1].trim(); continue }

    const h = t.match(/^#+\s+(.+?)\s*[-–—]\s*(.+)/)
    if (h && !company && !position) {
      company = h[1].trim()
      position = h[2].trim()
    }
  }

  if (!company) {
    for (const line of lines) {
      const t = line.trim()
      if (t && !t.startsWith('http') && t.split(/\s+/).length <= 5) {
        company = t
        break
      }
    }
  }

  return { company, position }
}

type Tab = 'new' | 'library' | 'board' | 'templates'

export function Vacantes() {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<Tab>('new')
  const [vacancyText, setVacancyText] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [atsReport, setAtsReport] = useState<ATSReport | null>(null)
  const [generatingLetters, setGeneratingLetters] = useState(false)
  const [coverLetterA, setCoverLetterA] = useState('')
  const [coverLetterB, setCoverLetterB] = useState('')
  const [currentApp, setCurrentApp] = useState<JobApplication | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cvStyle, setCvStyle] = useState<string | null>(null)
  const [cvContent, setCvContent] = useState('')
  const [recruiterEmail, setRecruiterEmail] = useState('')
  const [emailSubject, setEmailSubject] = useState('')
  const [interviewQuestions, setInterviewQuestions] = useState<InterviewQuestion[]>([])
  const [generatingQuestions, setGeneratingQuestions] = useState(false)

  const handleSelectTemplate = (templateId: string) => {
    setCvStyle(templateId)
    setCvContent('')
    if (currentApp && currentApp.cvStyle !== templateId) {
      const updated = { ...currentApp, cvStyle: templateId, cvContent: '', updatedAt: Date.now() }
      window.api?.saveJob(updated)
      setCurrentApp(updated)
    }
    setActiveTab('new')
  }

  const handleNewApp = () => {
    setVacancyText('')
    setAtsReport(null)
    setCoverLetterA('')
    setCoverLetterB('')
    setCvContent('')
    setCvStyle(null)
    setCurrentApp(null)
    setRecruiterEmail('')
    setEmailSubject('')
    setInterviewQuestions([])
    setError(null)
    setActiveTab('new')
  }

  const handleAnalyze = async (text: string) => {
    if (!window.api) return
    setAnalyzing(true)
    setAtsReport(null)
    setCoverLetterA('')
    setCoverLetterB('')
    setCvContent('')
    setCvStyle(null)
    setError(null)

    let cleanText = text
    try {
      const corrected = await window.api.correctVacancyText(text)
      cleanText = corrected
      setVacancyText(corrected)
    } catch {
      // Correction failed, fall back to original text
      setVacancyText(text)
    }

    try {
      const report = await window.api.analyzeVacancy(cleanText)
      setAtsReport(report)

      const { company, position: extractedPosition } = extractJobInfo(cleanText)
      const position = extractedPosition || cleanText.split('\n').find(l => l.trim().length > 10)?.trim().substring(0, 60) || t('vacantes.title')
      const category = extractCategory(cleanText)

      const app: JobApplication = {
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        company,
        position,
        category,
        status: 'draft',
        vacancyText: cleanText,
        atsReport: report,
        coverLetterA: '',
        coverLetterB: '',
        cvStyle: null,
        cvContent: '',
        recipientEmail: '',
        emailSubject: '',
        interviewQuestions: [],
      }
      await window.api.saveJob(app)
      setCurrentApp(app)

      setGeneratingLetters(true)
      const letters = await window.api.generateCoverLetters(cleanText, report)
      setCoverLetterA(letters.coverLetterA)
      setCoverLetterB(letters.coverLetterB)
      setRecruiterEmail(letters.recruiterEmail || '')
      setEmailSubject(letters.subject || '')

      app.coverLetterA = letters.coverLetterA
      app.coverLetterB = letters.coverLetterB
      app.recipientEmail = letters.recruiterEmail || ''
      app.emailSubject = letters.subject || ''
      app.updatedAt = Date.now()
      await window.api.saveJob(app)
      setCurrentApp({ ...app })
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('vacantes.errorUnknown')
      setError(msg)
    } finally {
      setAnalyzing(false)
      setGeneratingLetters(false)
    }
  }

  const handleSelectApp = (app: JobApplication) => {
    setCurrentApp(app)
    setVacancyText(app.vacancyText)
    setAtsReport(app.atsReport)
    setCoverLetterA(app.coverLetterA)
    setCoverLetterB(app.coverLetterB)
    setCvStyle(app.cvStyle)
    setCvContent(app.cvContent)
    setRecruiterEmail(app.recipientEmail || '')
    setEmailSubject(app.emailSubject || '')
    setInterviewQuestions(app.interviewQuestions || [])
    setActiveTab('new')
  }

  const handleSaveLetter = async (type: 'A' | 'B', content: string) => {
    if (!currentApp || !window.api) return
    const updated = {
      ...currentApp,
      ...(type === 'A' ? { coverLetterA: content } : { coverLetterB: content }),
      updatedAt: Date.now(),
    }
    await window.api.saveJob(updated)
    setCurrentApp(updated)
    if (type === 'A') setCoverLetterA(content)
    else setCoverLetterB(content)
  }

  const handleSaveCV = async (style: string, content: string) => {
    if (!currentApp || !window.api) return
    const updated = {
      ...currentApp,
      cvStyle: style,
      cvContent: content,
      updatedAt: Date.now(),
    }
    await window.api.saveJob(updated)
    setCurrentApp(updated)
    setCvStyle(style)
    setCvContent(content)
  }

  const handleGenerateQuestions = async () => {
    if (!window.api || !vacancyText) return
    setGeneratingQuestions(true)
    try {
      const questions = await window.api.generateInterviewQuestions(vacancyText, atsReport)
      setInterviewQuestions(questions)
      if (currentApp) {
        const updated = { ...currentApp, interviewQuestions: questions, updatedAt: Date.now() }
        await window.api.saveJob(updated)
        setCurrentApp(updated)
      }
    } catch {
      // Silently fail
    } finally {
      setGeneratingQuestions(false)
    }
  }

  const handleUpdateReport = async () => {
    if (vacancyText) {
      await handleAnalyze(vacancyText)
    }
  }

  const handleAddKeywords = async (keywords: { keyword: string; level: string }[]) => {
    if (!window.api || keywords.length === 0) return
    const profile = await window.api.getProfile()
    if (!profile) return
    profile.skills = [...new Set([...profile.skills, ...keywords.map(k => k.keyword)])]
    if (!profile.skillLevels) profile.skillLevels = {}
    keywords.forEach(({ keyword, level }) => { profile.skillLevels[keyword] = level })
    await window.api.saveProfile(profile)
    window.dispatchEvent(new Event('profile:updated'))
    const report = await window.api.analyzeVacancy(vacancyText)
    setAtsReport(report)
    if (currentApp) {
      const updated = { ...currentApp, atsReport: report, updatedAt: Date.now() }
      await window.api.saveJob(updated)
      setCurrentApp(updated)
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="border-b px-6 py-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-blue-500" />
            <h2 className="text-lg font-semibold">{t('vacantes.title')}</h2>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-4">
          <button
            onClick={handleNewApp}
            className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              activeTab === 'new'
                ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <Briefcase className="w-4 h-4" />
            {t('vacantes.newVacancy')}
          </button>
          <button
            onClick={() => setActiveTab('board')}
            className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              activeTab === 'board'
                ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <Columns className="w-4 h-4" />
            {t('vacantes.board')}
          </button>
          <button
            onClick={() => setActiveTab('library')}
            className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              activeTab === 'library'
                ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <Library className="w-4 h-4" />
            {t('vacantes.library')}
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              activeTab === 'templates'
                ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <FileText className="w-4 h-4" />
            {t('vacantes.templates')}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {activeTab === 'new' ? (
          <div className="max-w-4xl mx-auto p-6 space-y-6">
            <VacancyInput
              onAnalyze={handleAnalyze}
              analyzing={analyzing}
              initialText={vacancyText}
            />

            {error && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {analyzing && (
              <div className="flex items-center justify-center py-8 text-gray-400">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                <span className="text-sm">{t('vacantes.analyzing')}</span>
              </div>
            )}

            {atsReport && !analyzing && (
              <>
                {/* Company / Position read-only info */}
                <div className="flex gap-4 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{t('vacantes.company')}</label>
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{currentApp?.company || '—'}</p>
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{t('vacantes.position')}</label>
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{currentApp?.position || '—'}</p>
                  </div>
                </div>

                <ATSReportView
                  report={atsReport}
                  onRefresh={handleUpdateReport}
                  onAddKeywords={handleAddKeywords}
                />

                <CoverLetterGenerator
                  coverLetterA={coverLetterA}
                  coverLetterB={coverLetterB}
                  generating={generatingLetters}
                  onSave={handleSaveLetter}
                  recruiterEmail={recruiterEmail}
                  subject={emailSubject}
                />

                <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                  <CVGenerator
                    vacancyText={vacancyText}
                    atsReport={atsReport}
                    currentStyle={cvStyle}
                    currentContent={cvContent}
                    onSave={handleSaveCV}
                  />
                </div>

                <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                  <InterviewPrep
                    questions={interviewQuestions}
                    generating={generatingQuestions}
                    onGenerate={handleGenerateQuestions}
                  />
                </div>
              </>
            )}
          </div>
        ) : activeTab === 'board' ? (
          <div className="p-6">
            <KanbanBoard onSelect={handleSelectApp} />
          </div>
        ) : activeTab === 'templates' ? (
          <TemplatesManager onSelect={handleSelectTemplate} />
        ) : (
          <DocumentLibrary onSelect={handleSelectApp} />
        )}
      </div>
    </div>
  )
}
