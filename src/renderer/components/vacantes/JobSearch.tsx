import { useState } from 'react'
import { Search, MapPin, Building2, ExternalLink, Loader2, AlertCircle, ArrowRight, Globe } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '../ui/Button'
import type { LinkedInJob } from '../../../shared/types'

interface JobSearchProps {
  onUseVacancy: (text: string, job: LinkedInJob) => void
}

export function JobSearch({ onUseVacancy }: JobSearchProps) {
  const { t } = useTranslation()
  const [keywords, setKeywords] = useState('')
  const [location, setLocation] = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<LinkedInJob[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const handleSearch = async () => {
    if (!window.api || !keywords.trim() || searching) return
    setSearching(true)
    setError(null)
    setResults([])
    try {
      const jobs = await window.api.searchLinkedInJobs(keywords.trim(), location.trim(), 30)
      setResults(jobs)
      if (jobs.length === 0) setError(t('jobSearch.noResults'))
    } catch {
      setError(t('jobSearch.error'))
    } finally {
      setSearching(false)
    }
  }

  const handleUse = async (job: LinkedInJob) => {
    if (!window.api || loadingId) return
    setLoadingId(job.id)
    try {
      const detail = await window.api.getLinkedInJob(job.id || job.url)
      const header = [detail?.title || job.title, detail?.company || job.company, detail?.location || job.location]
        .filter(Boolean)
        .join(' — ')
      const body = detail?.description?.trim()
      const text = body ? `${header}\n\n${body}` : header
      onUseVacancy(text, job)
    } catch {
      onUseVacancy([job.title, job.company, job.location].filter(Boolean).join(' — '), job)
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40 p-4 space-y-3">
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void handleSearch() }}
              placeholder={t('jobSearch.keywordsPlaceholder')}
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
          </div>
          <div className="relative">
            <MapPin className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void handleSearch() }}
              placeholder={t('jobSearch.locationPlaceholder')}
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
          </div>
        </div>
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('jobSearch.loginHint')}</p>
          <Button variant="primary" size="sm" onClick={() => void handleSearch()} disabled={searching || !keywords.trim()}>
            {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {t('jobSearch.search')}
          </Button>
        </div>
      </div>

      {searching && (
        <div className="flex items-center justify-center py-8 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          <span className="text-sm">{t('jobSearch.searching')}</span>
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
          </p>
          {results.map((job) => (
            <div
              key={job.id}
              className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:border-blue-300 dark:hover:border-blue-600 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{job.title}</h3>
                    {job.source === 'web' && (
                      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                        <Globe className="w-3 h-3" /> web
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
          ))}
        </div>
      )}
    </div>
  )
}
