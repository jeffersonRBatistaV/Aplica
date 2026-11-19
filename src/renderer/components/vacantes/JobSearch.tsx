import { useEffect, useState } from 'react'
import {
  Search, MapPin, Building2, ExternalLink, Loader2, AlertCircle, ArrowRight, Globe, Sparkles,
  Mail, Phone, Copy, Check, ChevronDown, ChevronUp, Wifi,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '../ui/Button'
import { friendlyMessage } from '../../lib/friendly-error'
import type { FoundJob, JobFinderProgress, LinkedInJob } from '../../../shared/types'

export interface VacancyContact {
  email?: string
  phone?: string
}

interface JobSearchProps {
  onUseVacancy: (text: string, job: LinkedInJob, contact?: VacancyContact) => void
}

type Mode = 'profile' | 'manual'

const inputClass =
  'w-full pl-9 pr-3 py-2 text-sm rounded-lg border bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40'

function scoreClass(score: number): string {
  if (score >= 65) return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
  if (score >= 40) return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
  return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
}

function isFound(job: LinkedInJob | FoundJob): job is FoundJob {
  return 'score' in job
}

export function JobSearch({ onUseVacancy }: JobSearchProps) {
  const { t } = useTranslation()
  const [mode, setMode] = useState<Mode>('profile')
  const [keywords, setKeywords] = useState('')
  const [location, setLocation] = useState('')
  const [remote, setRemote] = useState(false)
  const [searching, setSearching] = useState(false)
  const [progress, setProgress] = useState<JobFinderProgress | null>(null)
  const [results, setResults] = useState<(LinkedInJob | FoundJob)[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    if (!window.api?.onJobFinderProgress) return
    return window.api.onJobFinderProgress(setProgress)
  }, [])

  const handleSearch = async () => {
    if (!window.api || searching) return
    if (mode === 'manual' && !keywords.trim()) return
    setSearching(true)
    setError(null)
    setResults([])
    setProgress(null)
    setExpanded(null)
    try {
      const jobs = mode === 'profile'
        ? await window.api.findJobsForProfile({
          query: keywords.trim() || undefined,
          location: location.trim() || undefined,
          remote,
          limit: 25,
        })
        : await window.api.searchLinkedInJobs(keywords.trim(), location.trim(), 30)
      setResults(jobs)
      if (jobs.length === 0) setError(t('jobSearch.noResults'))
    } catch (err) {
      setError(err instanceof Error ? friendlyMessage(err) : t('jobSearch.error'))
    } finally {
      setSearching(false)
      setProgress(null)
    }
  }

  const buildText = (title: string, company: string, loc: string, body: string, contact: VacancyContact, url: string) => {
    const header = [title, company, loc].filter(Boolean).join(' — ')
    const contactLines = [
      contact.email ? `Correo de contacto: ${contact.email}` : '',
      contact.phone ? `Teléfono de contacto: ${contact.phone}` : '',
      url ? `Fuente: ${url}` : '',
    ].filter(Boolean).join('\n')
    return [header, body.trim(), contactLines].filter(Boolean).join('\n\n')
  }

  const handleUse = async (job: LinkedInJob | FoundJob) => {
    if (!window.api || loadingId) return
    // Las vacantes del buscador por perfil ya traen el detalle.
    if (isFound(job) && job.description) {
      const contact = { email: job.email, phone: job.phone }
      onUseVacancy(buildText(job.title, job.company, job.location, job.description, contact, job.url), job, contact)
      return
    }
    setLoadingId(job.id)
    const contact: VacancyContact = isFound(job) ? { email: job.email, phone: job.phone } : {}
    try {
      const detail = job.source === 'linkedin' ? await window.api.getLinkedInJob(job.id || job.url) : null
      const body = detail?.description || (isFound(job) ? job.snippet || '' : '')
      onUseVacancy(
        buildText(detail?.title || job.title, detail?.company || job.company, detail?.location || job.location, body, contact, job.url),
        job,
        contact,
      )
    } catch {
      onUseVacancy(buildText(job.title, job.company, job.location, '', contact, job.url), job, contact)
    } finally {
      setLoadingId(null)
    }
  }

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      await window.api?.copyToClipboard(value)
    }
    setCopied(value)
    window.setTimeout(() => setCopied((c) => (c === value ? null : c)), 1500)
  }

  const progressPct = progress?.total ? Math.round(((progress.done || 0) / progress.total) * 100) : null
  const withContact = results.filter((j) => isFound(j) && (j.email || j.phone)).length

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 p-0.5 bg-gray-50 dark:bg-gray-800/40">
        {(['profile', 'manual'] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => { if (!searching) { setMode(m); setResults([]); setError(null) } }}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              mode === m
                ? 'bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            {m === 'profile' ? <Sparkles className="w-3.5 h-3.5" /> : <Search className="w-3.5 h-3.5" />}
            {m === 'profile' ? t('jobSearch.modeProfile') : t('jobSearch.modeManual')}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40 p-4 space-y-3">
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void handleSearch() }}
              placeholder={mode === 'profile' ? t('jobSearch.profileKeywordsPlaceholder') : t('jobSearch.keywordsPlaceholder')}
              className={inputClass}
            />
          </div>
          <div className="relative">
            <MapPin className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void handleSearch() }}
              placeholder={mode === 'profile' ? t('jobSearch.profileLocationPlaceholder') : t('jobSearch.locationPlaceholder')}
              className={inputClass}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            {mode === 'profile' && (
              <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300 cursor-pointer select-none">
                <input type="checkbox" checked={remote} onChange={(e) => setRemote(e.target.checked)} className="rounded" />
                <Wifi className="w-3.5 h-3.5" /> {t('jobSearch.remoteOnly')}
              </label>
            )}
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {mode === 'profile' ? t('jobSearch.profileHint') : t('jobSearch.loginHint')}
            </p>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => void handleSearch()}
            disabled={searching || (mode === 'manual' && !keywords.trim())}
          >
            {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : mode === 'profile' ? <Sparkles className="w-4 h-4" /> : <Search className="w-4 h-4" />}
            {mode === 'profile' ? t('jobSearch.findForMe') : t('jobSearch.search')}
          </Button>
        </div>
      </div>

      {searching && (
        <div className="py-6 space-y-2">
          <div className="flex items-center justify-center text-gray-500 dark:text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            <span className="text-sm">{progress?.message || t('jobSearch.searching')}</span>
          </div>
          {progressPct !== null && (
            <div className="max-w-sm mx-auto h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
              <div className="h-full bg-blue-500 transition-all" style={{ width: `${progressPct}%` }} />
            </div>
          )}
        </div>
      )}

      {error && !searching && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-sm text-amber-700 dark:text-amber-300">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {results.length > 0 && !searching && (
        <div className="space-y-3">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            {t('jobSearch.results', { count: results.length })}
            {mode === 'profile' && withContact > 0 && ` · ${t('jobSearch.withContact', { count: withContact })}`}
          </p>
          {results.map((job) => {
            const found = isFound(job) ? job : null
            const isOpen = expanded === job.id
            return (
              <div
                key={job.id}
                className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:border-blue-300 dark:hover:border-blue-600 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {found && (
                        <span
                          className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-md ${scoreClass(found.score)}`}
                          title={t('jobSearch.scoreHint')}
                        >
                          {found.score}%
                        </span>
                      )}
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{job.title}</h3>
                      {(found?.site || job.source === 'web') && (
                        <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                          <Globe className="w-3 h-3" /> {found?.site || 'web'}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {job.company && (
                        <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{job.company}</span>
                      )}
                      {job.location && (
                        <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{job.location}</span>
                      )}
                      {job.postedAt && <span>{job.postedAt}</span>}
                    </div>

                    {found && (found.email || found.phone) && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {found.email && (
                          <button
                            type="button"
                            onClick={() => void copy(found.email!)}
                            className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40"
                            title={t('jobSearch.copy')}
                          >
                            <Mail className="w-3 h-3" /> {found.email}
                            {copied === found.email ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3 opacity-60" />}
                          </button>
                        )}
                        {found.phone && (
                          <button
                            type="button"
                            onClick={() => void copy(found.phone!)}
                            className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/40"
                            title={t('jobSearch.copy')}
                          >
                            <Phone className="w-3 h-3" /> {found.phone}
                            {copied === found.phone ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3 opacity-60" />}
                          </button>
                        )}
                      </div>
                    )}

                    {found && found.matchedSkills.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {found.matchedSkills.slice(0, 8).map((s) => (
                          <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                            {s}
                          </span>
                        ))}
                      </div>
                    )}

                    {found && (found.description || found.snippet) && (
                      <div className="mt-2">
                        <p className={`text-xs text-gray-600 dark:text-gray-300 whitespace-pre-line ${isOpen ? 'max-h-80 overflow-y-auto' : 'line-clamp-2'}`}>
                          {isOpen ? found.description || found.snippet : (found.snippet || found.description || '').slice(0, 300)}
                        </p>
                        {found.description && (
                          <button
                            type="button"
                            onClick={() => setExpanded(isOpen ? null : job.id)}
                            className="mt-1 inline-flex items-center gap-0.5 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            {isOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            {isOpen ? t('jobSearch.showLess') : t('jobSearch.showMore')}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {job.url && (
                      <Button variant="ghost" size="sm" onClick={() => void window.api?.openExternal(job.url)}>
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    )}
                    <Button variant="primary" size="sm" onClick={() => void handleUse(job)} disabled={!!loadingId}>
                      {loadingId === job.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                      {t('jobSearch.useVacancy')}
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
