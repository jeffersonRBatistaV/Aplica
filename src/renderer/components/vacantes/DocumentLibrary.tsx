import { useState, useEffect } from 'react'
import {
  Library,
  Search,
  Briefcase,
  TrendingUp,
  Trash2,
  FileText,
  Mail,
  ChevronRight,
  ChevronDown,
  Building2,
  FolderOpen,
  Pencil,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Button } from '../ui/Button'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { formatTime } from '../../lib/time'
import { useNotification } from '../../contexts/NotificationContext'
import type { JobApplication } from '../../../shared/types'

interface DocumentLibraryProps {
  onSelect: (app: JobApplication) => void
}

function extractLetterContent(raw: string, key: string): string {
  const trimmed = raw.trim()
  if (!trimmed.startsWith('{') && !trimmed.startsWith('"')) return raw
  try {
    const parsed = JSON.parse(trimmed)
    if (typeof parsed === 'object' && parsed[key]) return parsed[key]
  } catch {
    const match = trimmed.match(new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`))
    if (match) return match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"')
  }
  return raw
}

export function DocumentLibrary({ onSelect }: DocumentLibraryProps) {
  const { notify } = useNotification()
  const [applications, setApplications] = useState<JobApplication[]>([])
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [expandedCompanies, setExpandedCompanies] = useState<Set<string>>(new Set())
  const [editingCompany, setEditingCompany] = useState<string | null>(null)
  const [editingCompanyValue, setEditingCompanyValue] = useState('')
  const [editingPosition, setEditingPosition] = useState<string | null>(null)
  const [editingPositionValue, setEditingPositionValue] = useState('')
  const [confirmDeleteJob, setConfirmDeleteJob] = useState<string | null>(null)

  const load = async () => {
    if (!window.api) return
    setLoading(true)
    const jobs = await window.api.getJobs()
    setApplications(jobs.reverse())
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    const handler = () => load()
    window.addEventListener('data:imported', handler)
    return () => window.removeEventListener('data:imported', handler)
  }, [])

  const handleSaveCompany = async (oldKey: string, newName: string) => {
    if (!window.api || !newName.trim()) return
    const keyParts = oldKey.split('||')
    const oldCompany = keyParts[0]
    const category = keyParts[1]
    await Promise.all(
      applications
        .filter(app => (app.company || 'Sin empresa') === oldCompany && app.category === category)
        .map(app => window.api.saveJob({ ...app, company: newName.trim(), updatedAt: Date.now() }))
    )
    setEditingCompany(null)
    await load()
  }

  const handleSavePosition = async (id: string, newPosition: string) => {
    if (!window.api || !newPosition.trim()) return
    const app = applications.find(a => a.id === id)
    if (!app) return
    await window.api.saveJob({ ...app, position: newPosition.trim(), updatedAt: Date.now() })
    setEditingPosition(null)
    await load()
  }

  // Group by category → company
  const grouped = applications.reduce((cats, app) => {
    const cat = app.category || 'General / Otra'
    if (!cats.has(cat)) cats.set(cat, new Map())
    const companies = cats.get(cat)!
    const key = `${app.company || 'Sin empresa'}||${cat}`
    if (!companies.has(key)) companies.set(key, [])
    companies.get(key)!.push(app)
    return cats
  }, new Map<string, Map<string, JobApplication[]>>())

  const filtered = search
    ? applications.filter(
        (a) =>
          a.company.toLowerCase().includes(search.toLowerCase()) ||
          a.position.toLowerCase().includes(search.toLowerCase()) ||
          a.vacancyText.toLowerCase().includes(search.toLowerCase()) ||
          a.category.toLowerCase().includes(search.toLowerCase()),
      )
    : null

  const toggleCategory = (cat: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  const toggleCompany = (key: string) => {
    setExpandedCompanies((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const selected = selectedId
    ? applications.find((a) => a.id === selectedId)
    : null

  const handleDelete = async (id: string) => {
    if (!window.api) return
    await window.api.deleteJob(id)
    if (selectedId === id) setSelectedId(null)
    await load()
    notify('Postulación eliminada', 'info')
  }

  const handleConfirmDelete = (id: string) => {
    setConfirmDeleteJob(id)
  }

  const categoryBadge = (cat: string) => {
    const colors: Record<string, string> = {
      'Tecnología / IT': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
      'Salud / Medicina': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
      'Finanzas / Contabilidad': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
      'Educación / Docencia': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
      'Ventas / Marketing': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
      'Ingeniería': 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
      'Legal / Jurídico': 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
      'Administrativo / Oficina': 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
      'Arte / Diseño': 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
    }
    return colors[cat] || 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        <p className="text-sm">Cargando biblioteca...</p>
      </div>
    )
  }

  const renderTree = () => {
    const data = filtered || applications

    if (filtered) {
      return filtered.map((app) => (
        <button
          key={app.id}
          onClick={() => setSelectedId(app.id === selectedId ? null : app.id)}
          className={`w-full text-left px-4 py-3 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${
            selectedId === app.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              {editingPosition === app.id ? (
                <input
                  type="text"
                  value={editingPositionValue}
                  onChange={(e) => setEditingPositionValue(e.target.value)}
                  onBlur={() => handleSavePosition(app.id, editingPositionValue)}
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter') await handleSavePosition(app.id, editingPositionValue)
                    if (e.key === 'Escape') setEditingPosition(null)
                  }}
                  autoFocus
                  className="text-sm font-medium px-1 py-0.5 rounded border border-blue-500 bg-white dark:bg-gray-800 outline-none w-full"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <div className="flex items-center gap-1 group">
                  <p className="text-sm font-medium truncate">{app.position || 'Sin título'}</p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setEditingPosition(app.id)
                      setEditingPositionValue(app.position || '')
                      setEditingCompany(null)
                    }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded shrink-0 text-gray-400 hover:text-blue-500 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                </div>
              )}
              <p className="text-xs text-gray-500 truncate">{app.company}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500">{app.category || 'General'}</span>
                <span className="text-[10px] text-gray-400">{formatTime(app.createdAt)}</span>
              </div>
            </div>
          </div>
        </button>
      ))
    }

    if (data.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-gray-400 px-4">
          <Library className="w-8 h-8 mb-2" />
          <p className="text-xs text-center">No hay vacantes guardadas</p>
        </div>
      )
    }

    const result: JSX.Element[] = []
    for (const [cat, companies] of grouped) {
      const isCatOpen = expandedCategories.has(cat)
      result.push(
        <div key={cat}>
          <button
            onClick={() => toggleCategory(cat)}
            className="w-full flex items-center gap-2 px-4 py-2.5 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            {isCatOpen ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
            <FolderOpen className="w-3.5 h-3.5 text-gray-500" />
            <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${categoryBadge(cat)}`}>{cat}</span>
            <span className="text-xs text-gray-400 ml-auto">{Array.from(companies.values()).reduce((s, apps) => s + apps.length, 0)}</span>
          </button>
          {isCatOpen && (
            <div>
              {Array.from(companies.entries()).map(([key, apps]) => {
                const companyName = key.split('||')[0]
                const isCompOpen = expandedCompanies.has(key)
                return (
                  <div key={key}>
                    <button
                      onClick={() => toggleCompany(key)}
                      className="w-full flex items-center gap-2 pl-8 pr-4 py-2 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                    >
                      {isCompOpen ? <ChevronDown className="w-3 h-3 text-gray-400" /> : <ChevronRight className="w-3 h-3 text-gray-400" />}
                      <Building2 className="w-3 h-3 text-gray-400" />
                      {editingCompany === key ? (
                        <input
                          type="text"
                          value={editingCompanyValue}
                          onChange={(e) => setEditingCompanyValue(e.target.value)}
                          onBlur={() => handleSaveCompany(key, editingCompanyValue)}
                          onKeyDown={async (e) => {
                            if (e.key === 'Enter') await handleSaveCompany(key, editingCompanyValue)
                            if (e.key === 'Escape') setEditingCompany(null)
                          }}
                          autoFocus
                          className="text-xs font-medium px-1 py-0.5 rounded border border-blue-500 bg-white dark:bg-gray-800 outline-none w-40"
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <div className="flex items-center gap-1 group">
                          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{companyName}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setEditingCompany(key)
                              setEditingCompanyValue(companyName)
                              setEditingPosition(null)
                            }}
                            className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-gray-400 hover:text-blue-500 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                      <span className="text-xs text-gray-400 ml-auto">{apps.length}</span>
                    </button>
                    {isCompOpen && apps.map((app) => (
                      <button
                        key={app.id}
                        onClick={() => setSelectedId(app.id === selectedId ? null : app.id)}
                        className={`w-full text-left pl-12 pr-4 py-2 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${
                          selectedId === app.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          {editingPosition === app.id ? (
                            <input
                              type="text"
                              value={editingPositionValue}
                              onChange={(e) => setEditingPositionValue(e.target.value)}
                              onBlur={() => handleSavePosition(app.id, editingPositionValue)}
                              onKeyDown={async (e) => {
                                if (e.key === 'Enter') await handleSavePosition(app.id, editingPositionValue)
                                if (e.key === 'Escape') setEditingPosition(null)
                              }}
                              autoFocus
                              className="text-sm px-1 py-0.5 rounded border border-blue-500 bg-white dark:bg-gray-800 outline-none w-full min-w-0"
                              onClick={(e) => e.stopPropagation()}
                            />
                          ) : (
                            <div className="flex items-center gap-1 group min-w-0">
                              <p className="text-sm truncate">{app.position || 'Sin título'}</p>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setEditingPosition(app.id)
                                  setEditingPositionValue(app.position || '')
                                  setEditingCompany(null)
                                }}
                                className="opacity-0 group-hover:opacity-100 p-0.5 rounded shrink-0 text-gray-400 hover:text-blue-500 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                          <div className="flex items-center gap-1.5 shrink-0 ml-2">
                            {app.atsReport && (
                              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                                app.atsReport.matchScore >= 70 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                                app.atsReport.matchScore >= 40 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' :
                                'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                              }`}>{app.atsReport.matchScore}%</span>
                            )}
                            {app.cvContent && <FileText className="w-3 h-3 text-blue-400" />}
                            {(app.coverLetterA || app.coverLetterB) && <Mail className="w-3 h-3 text-green-400" />}
                          </div>
                        </div>
                        <span className="text-[10px] text-gray-400">{formatTime(app.createdAt)}</span>
                      </button>
                    ))}
                  </div>
                )
              })}
            </div>
          )}
        </div>,
      )
    }
    return result
  }

  return (
    <>
    <div className="h-full flex">
      {/* Tree */}
      <div className={`flex flex-col ${selected ? 'w-2/5' : 'w-full'} border-r min-h-0`}>
        <div className="p-4 border-b">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por empresa, puesto o categoría..."
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {renderTree()}
        </div>
      </div>

      {/* Detail */}
      {selected && (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {editingPosition === selected.id ? (
                  <input
                    type="text"
                    value={editingPositionValue}
                    onChange={(e) => setEditingPositionValue(e.target.value)}
                    onBlur={() => handleSavePosition(selected.id, editingPositionValue)}
                    onKeyDown={async (e) => {
                      if (e.key === 'Enter') await handleSavePosition(selected.id, editingPositionValue)
                      if (e.key === 'Escape') setEditingPosition(null)
                    }}
                    autoFocus
                    className="text-sm font-medium px-1 py-0.5 rounded border border-blue-500 bg-white dark:bg-gray-800 outline-none w-48"
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <div className="flex items-center gap-1 group">
                    <p className="text-sm font-medium truncate">{selected.position || 'Vacante'}</p>
                    <button
                      onClick={() => {
                        setEditingPosition(selected.id)
                        setEditingPositionValue(selected.position || '')
                        setEditingCompany(null)
                      }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded shrink-0 text-gray-400 hover:text-blue-500 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                  </div>
                )}
                {selected.category && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${categoryBadge(selected.category)}`}>{selected.category}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {selected.company ? (
                  <input
                    type="text"
                    defaultValue={selected.company}
                    onBlur={async (e) => {
                      const newName = e.target.value.trim()
                      if (!newName || newName === selected.company) return
                      if (!window.api) return
                      await window.api.saveJob({ ...selected, company: newName, updatedAt: Date.now() })
                      await load()
                    }}
                    className="text-xs text-gray-500 bg-transparent border-b border-dashed border-gray-300 dark:border-gray-600 hover:border-blue-500 focus:border-blue-500 focus:outline-none px-1"
                  />
                ) : null}
                <span className="text-[10px] text-gray-400">{formatTime(selected.createdAt)}</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={() => onSelect(selected)} title="Reabrir en editor">
                <Briefcase className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => handleConfirmDelete(selected.id)} title="Eliminar">
                <Trash2 className="w-4 h-4 text-red-500" />
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-6">
            {/* CV */}
            {selected.cvContent && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4 text-blue-500" />
                  <h4 className="text-sm font-semibold">
                    CV — {selected.cvStyle === 'ats' ? 'ATS-Friendly' : selected.cvStyle === 'moderno' ? 'Moderno' : selected.cvStyle === 'tradicional' ? 'Tradicional' : selected.cvStyle?.startsWith('custom:') ? 'Personalizado' : selected.cvStyle || ''}
                  </h4>
                </div>
                <div
                  className="bg-white rounded-lg border border-gray-200 dark:border-gray-700 p-4 overflow-x-auto"
                  style={{ fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif" }}
                >
                  <div dangerouslySetInnerHTML={{ __html: selected.cvContent }} />
                </div>
              </div>
            )}

            {/* ATS Report */}
            {selected.atsReport && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="w-4 h-4 text-blue-500" />
                  <h4 className="text-sm font-semibold">Reporte ATS</h4>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                    selected.atsReport.matchScore >= 70 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                    selected.atsReport.matchScore >= 40 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' :
                    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                  }`}>{selected.atsReport.matchScore}% Match</span>
                </div>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{selected.atsReport.analysis}</ReactMarkdown>
                </div>
              </div>
            )}

            {/* Letters */}
            {selected.coverLetterA && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Mail className="w-4 h-4 text-gray-400" />
                  <h4 className="text-sm font-semibold">Cold Email</h4>
                </div>
                <div className="prose prose-sm dark:prose-invert max-w-none p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{extractLetterContent(selected.coverLetterA, 'coverLetterA')}</ReactMarkdown>
                </div>
              </div>
            )}

            {selected.coverLetterB && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Mail className="w-4 h-4 text-gray-400" />
                  <h4 className="text-sm font-semibold">Cover Letter</h4>
                </div>
                <div className="prose prose-sm dark:prose-invert max-w-none p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{extractLetterContent(selected.coverLetterB, 'coverLetterB')}</ReactMarkdown>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>

      <ConfirmDialog
        open={confirmDeleteJob !== null}
        title="Eliminar postulación"
        message="Esta acción no se puede deshacer. La postulación y todos sus documentos asociados se eliminarán permanentemente."
        confirmLabel="Eliminar"
        onConfirm={async () => {
          if (confirmDeleteJob) {
            await handleDelete(confirmDeleteJob)
            setConfirmDeleteJob(null)
          }
        }}
        onCancel={() => setConfirmDeleteJob(null)}
      />
    </>
  )
}
