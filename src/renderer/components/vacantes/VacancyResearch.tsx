import { useState } from 'react'
import { Globe, Loader2, X, ExternalLink, Building2, DollarSign } from 'lucide-react'
import type { InvestigateResult } from '../../../shared/types'
import { useTranslation } from 'react-i18next'

interface VacancyResearchProps {
  company: string
  position: string
}

/**
 * Investigación en línea de la vacante: datos de la empresa y rango salarial
 * del puesto en el país del usuario (del perfil).
 */
export function VacancyResearch({ company, position }: VacancyResearchProps) {
  const { t } = useTranslation()
  const [investigating, setInvestigating] = useState(false)
  const [result, setResult] = useState<InvestigateResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleInvestigate = async () => {
    if (!window.api || investigating) return
    setInvestigating(true)
    setError(null)
    setResult(null)
    try {
      const profile = await window.api.getProfile()
      const country = profile?.country || 'DO'
      const lang = t('locale') === 'es' ? 'es' : 'en'
      const query = [
        `Empresa "${company || 'esta empresa'}" y puesto "${position || 'este puesto'}":`,
        `información de la empresa (tamaño, cultura, sede), rango salarial real del puesto en ${country}`,
        'y requisitos actuales del mercado',
      ].join(' ')
      const res = await window.api.investigate(query, country, lang)
      setResult(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setInvestigating(false)
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
          <Globe className="w-4 h-4 text-blue-500" />
          {t('vacancyResearch.title')}
        </h3>
        <button
          onClick={handleInvestigate}
          disabled={investigating}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors disabled:opacity-50"
        >
          <Globe className={`w-3.5 h-3.5 ${investigating ? 'animate-spin' : ''}`} />
          {investigating ? t('vacancyResearch.investigating') : t('vacancyResearch.investigate')}
        </button>
      </div>

      <div className="p-4 space-y-2">
        {(company || position) && (
          <div className="flex flex-wrap gap-2 text-[11px]">
            {company && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                <Building2 className="w-3 h-3" />
                {company}
              </span>
            )}
            {position && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                <DollarSign className="w-3 h-3" />
                {position}
              </span>
            )}
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs">
            {error}
          </div>
        )}

        {result && (
          <>
            <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">{result.answer}</div>
            {result.sources.length > 0 && (
              <div className="pt-2.5 border-t border-gray-200 dark:border-gray-700">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                  {t('vacancyResearch.sources')} ({result.sources.length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {result.sources.slice(0, 5).map((s, i) => (
                    <a
                      key={i}
                      href={s.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 px-2 py-1 text-[11px] text-blue-600 dark:text-blue-400 bg-blue-100/60 dark:bg-blue-900/30 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors max-w-[220px]"
                    >
                      <ExternalLink className="w-3 h-3 shrink-0" />
                      <span className="truncate">{s.title || s.url.replace('https://', '').slice(0, 30)}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
