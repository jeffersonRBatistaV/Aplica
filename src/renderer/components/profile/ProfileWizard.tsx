import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { X, ChevronRight, ChevronLeft, Check, Loader2, AlertCircle, Plus } from 'lucide-react'
import { areas, questions as commonQuestions } from '../../data/questions'
import type { Profile, Project } from '../../../shared/types'

interface ProfileWizardProps {
  onClose: () => void
  onComplete: (profile: Profile) => void
}

function firstString(val: string | string[] | undefined): string {
  if (!val) return ''
  if (typeof val === 'string') return val
  return val.find(v => v !== 'Otro' && v !== 'Otra') ?? val[0] ?? ''
}

export function ProfileWizard({ onClose, onComplete }: ProfileWizardProps) {
  const [step, setStep] = useState(0)
  const [areaId, setAreaId] = useState<string | null>(null)
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({})
  const [projectList, setProjectList] = useState<Project[]>([])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const selectedArea = areas.find((a) => a.id === areaId)

  const areaQuestions = selectedArea?.questions ?? []
  const contactFields = commonQuestions

  const prevRoleRef = useRef<string>()
  const prevAreaRef = useRef<string | null>()

  useEffect(() => {
    const roleId = areaQuestions[0]?.id
    if (!roleId) return

    if (areaId !== prevAreaRef.current) {
      prevAreaRef.current = areaId
      prevRoleRef.current = undefined
      return
    }

    const roleAnswer = answers[roleId]
    const roleStr = Array.isArray(roleAnswer) ? roleAnswer[0] : roleAnswer
    if (!roleStr) return
    if (roleStr === prevRoleRef.current) return
    prevRoleRef.current = roleStr

    setAnswers(prev => {
      const next = { ...prev }
      areaQuestions.forEach(q => {
        if (q.roleFilter && q.id !== roleId && prev[q.id] !== undefined) {
          if (q.type === 'multiple') {
            const allowed = q.roleFilter[roleStr]
            if (allowed !== undefined) {
              const current = Array.isArray(prev[q.id]) ? prev[q.id] as string[] : []
              const valid = current.filter(v => allowed.includes(v) || v === 'Otro' || v === 'Otra')
              if (valid.length > 0) {
                next[q.id] = valid
              } else {
                delete next[q.id]
              }
            } else {
              delete next[q.id]
            }
          } else {
            delete next[q.id]
          }
        }
      })
      return next
    })
  }, [answers, areaQuestions, areaId])

  const certsAnswerNo = useMemo(() => {
    for (const q of areaQuestions) {
      if (q.id.endsWith('_certs') || q.id.endsWith('_bar')) {
        const val = answers[q.id]
        if (Array.isArray(val) && (val.includes('Ninguna') || val.includes('Ninguna aún'))) return true
      }
    }
    return false
  }, [areaQuestions, answers])

  const hasZeroYears = useMemo(() => {
    for (const q of areaQuestions) {
      if (q.id.endsWith('_years')) {
        const val = answers[q.id]
        if (Array.isArray(val) && (val.includes('0 años / Sin experiencia') || val.includes('0 años'))) return true
        if (typeof val === 'string' && (val === '0 años / Sin experiencia' || val === '0 años')) return true
      }
    }
    return false
  }, [areaQuestions, answers])

  const visibleQuestions = useMemo(() => {
    const roleId = areaQuestions[0]?.id
    const roleAnswer = roleId ? answers[roleId] : undefined
    const roleStr = roleAnswer ? (Array.isArray(roleAnswer) ? roleAnswer[0] : roleAnswer) : undefined

    const filtered = areaQuestions.filter((q) => {
      if (certsAnswerNo && (q.id.endsWith('_certs_detail') || q.id.endsWith('_certs_custom'))) return false
      if (hasZeroYears && q.id.endsWith('_summary')) return false
      if (q.roleFilter && roleStr) {
        const filteredOptions = q.roleFilter[roleStr]
        if (filteredOptions !== undefined && filteredOptions.length === 0) return false
      }
      return true
    }).map((q) => {
      if (q.roleFilter && roleStr && q.options) {
        const filteredOptions = q.roleFilter[roleStr]
        if (filteredOptions !== undefined && filteredOptions.length > 0) {
          return { ...q, options: filteredOptions }
        }
      }
      return q
    })
    filtered.push({
      id: '_projects',
      text: 'Agrega tus proyectos personales, académicos o profesionales:',
      type: 'text',
      field: 'projects',
    })
    return filtered
  }, [areaQuestions, certsAnswerNo, hasZeroYears, answers])

  const totalSteps = 1 + 1 + visibleQuestions.length + 1

  const stepLabel = (i: number) => {
    if (i === 0) return 'Área'
    if (i <= visibleQuestions.length) return `Pregunta ${i} de ${visibleQuestions.length}`
    return 'Resumen'
  }

  const hasOtro = useCallback((id: string) => {
    const val = answers[id]
    if (typeof val === 'string') return val === 'Otro' || val === 'Otra'
    if (Array.isArray(val)) return val.includes('Otro') || val.includes('Otra')
    return false
  }, [answers])

  const setAnswer = useCallback((id: string, value: string | string[]) => {
    setAnswers((prev) => ({ ...prev, [id]: value }))
  }, [])

  const handleAreaSelect = (id: string) => {
    setAreaId(id)
    setStep(1)
  }

  const canNext = () => {
    if (step === 0) return areaId !== null
    if (step === 1) return contactFields.every((q) => {
      if (q.id === 'github' || q.id === 'linkedin' || q.id === 'portfolio' || q.id === 'photo') return true
      const val = answers[q.id]
      return val && (typeof val === 'string' ? val.trim().length > 0 : val.length > 0)
    })
    const qIdx = step - 2
    if (qIdx < visibleQuestions.length) {
      const question = visibleQuestions[qIdx]
      if (question.id === '_projects') return true
      const val = answers[question.id]
      if (!val) return false
      if (typeof val === 'string' && !val.trim()) return false
      if (Array.isArray(val) && val.length === 0) return false
      if (Array.isArray(val) && (val.includes('Otro') || val.includes('Otra'))) {
        const custom = answers[question.id + '_custom']
        if (!custom || (typeof custom === 'string' && !custom.trim())) return false
      }
      if (typeof val === 'string' && (val === 'Otro' || val === 'Otra')) {
        const custom = answers[question.id + '_custom']
        if (!custom || (typeof custom === 'string' && !custom.trim())) return false
      }
      return true
    }
    return true
  }

  const buildProfile = (): Profile => {
    const yearMap: Record<string, number> = {
      '0 años / Sin experiencia': 0,
      '0 años': 0,
      'Menos de 1 año': 0.5,
      '1-2 años': 1.5,
      '1-3 años': 2,
      '3-5 años': 4,
      '4-7 años': 5.5,
      '6-10 años': 8,
      '8-15 años': 11,
      'Más de 10 años': 12,
      'Más de 15 años': 18,
    }

    const roleAnswer = (() => {
      for (const q of areaQuestions) {
        const val = answers[q.id]
        if (!val) continue
        const raw = Array.isArray(val) ? val : [val]
        const filtered = raw.filter(v => v !== 'Otro' && v !== 'Otra')
        if (filtered.length > 0) {
          const parts = [...filtered]
          if (raw.includes('Otro') || raw.includes('Otra')) {
            const custom = answers[q.id + '_custom']
            if (typeof custom === 'string' && custom.trim()) parts.push(custom.trim())
          }
          return parts.join(' / ')
        }
      }
      return ''
    })()

    const yearsAnswer = firstString(Object.entries(answers).find(([k]) => k.endsWith('_years'))?.[1])
    const years = yearMap[yearsAnswer] ?? 0

    const skills: string[] = []
    Object.entries(answers).forEach(([key, val]) => {
      if (key.endsWith('_langs') || key.endsWith('_frameworks') || key.endsWith('_tools') || key.endsWith('_software') || key.endsWith('_subjects')) {
        if (Array.isArray(val)) {
          skills.push(...val.filter(v => v !== 'Otro' && v !== 'Otra' && v !== 'Ninguna aún'))
          const customKey = key + '_custom'
          const custom = answers[customKey]
          if (val.includes('Otro') || val.includes('Otra')) {
            if (typeof custom === 'string' && custom.trim()) {
              skills.push(custom.trim())
            }
          }
        }
      }
    })

    const certifications: string[] = []
    Object.entries(answers).forEach(([key, val]) => {
      if ((key.endsWith('_certs') || key.endsWith('_bar')) && Array.isArray(val)) {
        certifications.push(...val.filter(v => v !== 'Ninguna' && v !== 'Ninguna aún' && v !== 'Otra'))
        if (val.includes('Otra')) {
          const custom = answers[key + '_custom']
          if (typeof custom === 'string' && custom.trim()) {
            certifications.push(custom.trim())
          }
        }
      }
    })

    const langAnswer = Object.entries(answers).find(([k]) => k.endsWith('_english'))
    const englishLevel = firstString(langAnswer?.[1])
    const languages = englishLevel ? [`Español (Nativo)`, `Inglés (${englishLevel})`] : [`Español (Nativo)`]

    const eduLevel = firstString(Object.entries(answers).find(([k]) => k.endsWith('_education'))?.[1])

    const projectsText = (answers['_projects'] as string) ?? ''

    const summary = hasZeroYears
      ? ''
      : (Object.entries(answers).find(([k]) => k.endsWith('_summary'))?.[1] as string) ?? ''

    const experienceDescription = projectsText
      ? `Proyectos: ${projectsText}`
      : hasZeroYears ? '' : summary

    const skillLevels: Record<string, string> = {}
    Object.entries(answers).forEach(([key, val]) => {
      if (key.endsWith('_levels') && typeof val === 'string') {
        try {
          const parsed = JSON.parse(val)
          if (typeof parsed === 'object' && parsed !== null) {
            Object.assign(skillLevels, parsed)
          }
        } catch { /* ignore */ }
      }
    })

    const profile: Profile = {
      name: (answers['name'] as string) ?? '',
      email: (answers['email'] as string) ?? '',
      phone: (answers['phone'] as string) ?? '',
      location: (answers['location'] as string) ?? '',
      targetMarket: firstString(answers['target_market']),
      github: (answers['github'] as string) ?? '',
      linkedin: (answers['linkedin'] as string) ?? '',
      portfolio: (answers['portfolio'] as string) ?? '',
      photo: (answers['photo'] as string) ?? '',
      title: roleAnswer,
      summary,
      skills: [...new Set(skills)],
      skillLevels,
      experience: [{
        company: '',
        position: roleAnswer,
        startDate: '',
        endDate: null,
        description: experienceDescription,
        highlights: projectsText ? projectsText.split('\n').filter(Boolean) : [],
      }],
      education: [{
        institution: (answers['education_institution'] as string) ?? '',
        degree: eduLevel,
        field: (answers['education_field'] as string) ?? '',
        startDate: (answers['education_start'] as string) ?? '',
        endDate: (answers['education_end'] as string) ?? '',
      }],
      certifications,
      languages,
      projects: projectList,
    }
    return profile
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveError(null)
    try {
      const profile = buildProfile()
      if (window.api) {
        await window.api.saveProfile(profile)
        window.dispatchEvent(new Event('profile:updated'))
      } else {
        console.warn('[ProfileWizard] window.api no disponible - el perfil solo se guardará en memoria')
      }
      onComplete(profile)
    } catch (err) {
      console.error('[ProfileWizard] Error al guardar el perfil:', err)
      const msg = err instanceof Error ? err.message : 'Error al guardar el perfil'
      setSaveError(msg)
    } finally {
      setSaving(false)
    }
  }

  const renderAreaSelection = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {areas.map((area) => (
        <button
          key={area.id}
          onClick={() => handleAreaSelect(area.id)}
          className={`p-4 rounded-xl border-2 text-left transition-all ${
            areaId === area.id
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
              : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600'
          }`}
        >
          <div className="text-2xl mb-2">{area.icon}</div>
          <div className="font-medium text-sm text-gray-900 dark:text-gray-100">{area.name}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{area.description}</div>
        </button>
      ))}
    </div>
  )

  const renderContactFields = () => (
    <div className="space-y-4">
      {/* Profile photo */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Foto de perfil (opcional)</label>
        <div className="flex items-center gap-4">
          {(answers['photo'] as string) ? (
            <div className="relative w-20 h-20 rounded-full overflow-hidden border-2 border-gray-200 dark:border-gray-700">
              <img src={answers['photo'] as string} alt="Preview" className="w-full h-full object-cover" />
              <button
                onClick={() => setAnswer('photo', '')}
                className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs"
              ><X className="w-3 h-3" /></button>
            </div>
          ) : (
            <div className="w-20 h-20 rounded-full border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center text-gray-400 bg-gray-50 dark:bg-gray-800/50 cursor-pointer hover:border-blue-400 transition-colors" onClick={() => document.getElementById('photo-input')?.click()}>
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
            </div>
          )}
          <div className="text-xs text-gray-500 dark:text-gray-400">
            <button onClick={() => document.getElementById('photo-input')?.click()} className="text-blue-500 hover:text-blue-600 font-medium">Seleccionar foto</button>
            <p className="mt-0.5">PNG, JPG o WEBP</p>
          </div>
        </div>
        <input
          id="photo-input"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (!file) return
            const reader = new FileReader()
            reader.onload = () => setAnswer('photo', reader.result as string)
            reader.readAsDataURL(file)
            e.target.value = ''
          }}
        />
      </div>

      {contactFields.map((q) => {
        if (q.id === 'target_market' && q.options) {
          const val = (answers[q.id] as string) ?? ''
          return (
            <div key={q.id}>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{q.text}</label>
              <select
                value={val}
                onChange={(e) => setAnswer(q.id, e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              >
                <option value="">Selecciona un mercado...</option>
                {q.options.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
          )
        }
        return (
          <div key={q.id}>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{q.text}</label>
            <input
              type="text"
              value={(answers[q.id] as string) ?? ''}
              onChange={(e) => setAnswer(q.id, e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              placeholder={
                q.id === 'email' ? 'ejemplo@correo.com' :
                q.id === 'phone' ? '+56 9 1234 5678' :
                q.id === 'location' ? 'Ciudad, País' :
                q.id === 'github' ? 'https://github.com/usuario' :
                q.id === 'linkedin' ? 'https://linkedin.com/in/usuario' :
                q.id === 'portfolio' ? 'https://midominio.com' : ''
              }
            />
          </div>
        )
      })}
    </div>
  )

  const renderOtroInput = (qId: string) => {
    if (!hasOtro(qId)) return null
    return (
      <input
        type="text"
        value={(answers[qId + '_custom'] as string) ?? ''}
        onChange={(e) => setAnswer(qId + '_custom', e.target.value)}
        placeholder="Especifica..."
        className="w-full mt-2 px-3 py-2 text-sm rounded-lg border bg-white dark:bg-gray-800 border-blue-400 dark:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
      />
    )
  }

  const renderQuestion = (qIdx: number) => {
    const q = visibleQuestions[qIdx]
    if (!q) return null
    const val = answers[q.id]

    if (q.id === '_projects') {
      const addProject = () => {
        setProjectList(prev => [...prev, { name: '', description: '' }])
      }
      const updateProject = (i: number, field: 'name' | 'description', value: string) => {
        setProjectList(prev => prev.map((p, j) => j === i ? { ...p, [field]: value } : p))
      }
      const removeProject = (i: number) => {
        setProjectList(prev => prev.filter((_, j) => j !== i))
      }
      return (
        <div key={q.id} className="space-y-3">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{q.text}</label>
          {projectList.map((p, i) => (
            <div key={i} className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500">Proyecto {i + 1}</span>
                <button onClick={() => removeProject(i)} className="text-red-400 hover:text-red-600">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <input
                type="text"
                value={p.name}
                onChange={(e) => updateProject(i, 'name', e.target.value)}
                placeholder="Nombre del proyecto"
                className="w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
              <textarea
                value={p.description}
                onChange={(e) => updateProject(i, 'description', e.target.value)}
                rows={2}
                placeholder="Descripción breve del proyecto"
                className="w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-y"
              />
            </div>
          ))}
          <button
            onClick={addProject}
            className="flex items-center gap-1.5 text-sm text-blue-500 hover:text-blue-600 font-medium"
          >
            <Plus className="w-4 h-4" />
            Agregar proyecto
          </button>
        </div>
      )
    }

    return (
      <div key={q.id}>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">{q.text}</label>
        {q.type === 'single' && q.options && (
          <div className="space-y-2">
            {q.options.map((opt) => {
              const selected = Array.isArray(val) && val[0] === opt
              return (
                <button
                  key={opt}
                  onClick={() => setAnswer(q.id, [opt])}
                  className={`w-full text-left px-4 py-2.5 rounded-lg border text-sm transition-all flex items-center gap-3 ${
                    selected
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    selected ? 'border-blue-500' : 'border-gray-400'
                  }`}>
                    {selected && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                  </div>
                  {opt}
                </button>
              )
            })}
            {renderOtroInput(q.id)}
          </div>
        )}
        {q.type === 'multiple' && q.options && (
          <div className="space-y-2">
            {q.options.map((opt) => {
              const selected = Array.isArray(val) && val.includes(opt)
              const isSkillQ = q.id.endsWith('_langs') || q.id.endsWith('_frameworks') || q.id.endsWith('_tools') || q.id.endsWith('_software') || q.id.endsWith('_subjects')
              const levelsRaw = answers[q.id + '_levels']
              const levels: Record<string, string> = typeof levelsRaw === 'string' ? (() => { try { return JSON.parse(levelsRaw) } catch { return {} } })() : typeof levelsRaw === 'object' && levelsRaw !== null ? levelsRaw as Record<string, string> : {}
              const currentLevel = levels[opt] || 'Intermedio'
              const setSkillLevel = (skill: string, level: string) => {
                const updated = { ...levels, [skill]: level }
                setAnswer(q.id + '_levels', JSON.stringify(updated))
              }
              const PROF_LEVELS = ['Básico', 'Intermedio', 'Avanzado'] as const
              return (
                <div key={opt}>
                  <button
                    onClick={() => {
                      const current = Array.isArray(val) ? [...val] : []
                      const next = selected ? current.filter((v) => v !== opt) : [...current, opt]
                      setAnswer(q.id, next)
                      if (!selected && isSkillQ) {
                        const updated = { ...levels, [opt]: 'Intermedio' }
                        setAnswer(q.id + '_levels', JSON.stringify(updated))
                      }
                    }}
                    className={`w-full text-left px-4 py-2.5 rounded-lg border text-sm transition-all flex items-center gap-3 ${
                      selected
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                      selected ? 'border-blue-500 bg-blue-500' : 'border-gray-400'
                    }`}>
                      {selected && <Check className="w-3 h-3 text-white" />}
                    </div>
                    {opt}
                  </button>
                  {selected && isSkillQ && (
                    <div className="flex gap-1 ml-7 mt-1 mb-1">
                      {PROF_LEVELS.map((level) => (
                        <button
                          key={level}
                          onClick={(e) => { e.stopPropagation(); setSkillLevel(opt, level) }}
                          className={`px-2 py-0.5 text-[10px] font-medium rounded-full transition-colors ${
                            currentLevel === level
                              ? level === 'Básico' ? 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                              : level === 'Intermedio' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                              : 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
                              : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                          }`}
                        >
                          {level}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
            {renderOtroInput(q.id)}
          </div>
        )}
        {q.type === 'yesno' && (
          <div className="flex gap-3">
            {['Sí', 'No'].map((opt) => (
              <button
                key={opt}
                onClick={() => setAnswer(q.id, opt)}
                className={`flex-1 text-center px-4 py-2.5 rounded-lg border text-sm transition-all ${
                  val === opt
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        )}
        {q.type === 'text' && (
          <textarea
            value={(val as string) ?? ''}
            onChange={(e) => setAnswer(q.id, e.target.value)}
            rows={3}
            className="w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-y"
          />
        )}
      </div>
    )
  }

  const renderSummary = () => {
    const profile = buildProfile()
    return (
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Tu perfil</h3>
        {selectedArea && (
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <span className="text-lg">{selectedArea.icon}</span>
            <span>{selectedArea.name}</span>
          </div>
        )}
        {profile.photo && (
          <div className="flex justify-center">
            <img src={profile.photo} alt="Foto" className="w-20 h-20 rounded-full object-cover border-2 border-gray-200 dark:border-gray-700" />
          </div>
        )}
        {profile.name && <p className="text-sm"><span className="font-medium text-gray-700 dark:text-gray-300">Nombre:</span> {profile.name}</p>}
        {profile.email && <p className="text-sm"><span className="font-medium text-gray-700 dark:text-gray-300">Email:</span> {profile.email}</p>}
        {profile.phone && <p className="text-sm"><span className="font-medium text-gray-700 dark:text-gray-300">Teléfono:</span> {profile.phone}</p>}
        {profile.location && <p className="text-sm"><span className="font-medium text-gray-700 dark:text-gray-300">Ubicación:</span> {profile.location}</p>}
        {profile.targetMarket && <p className="text-sm"><span className="font-medium text-gray-700 dark:text-gray-300">Mercado objetivo:</span> {profile.targetMarket}</p>}
        {profile.github && <p className="text-sm"><span className="font-medium text-gray-700 dark:text-gray-300">GitHub:</span> {profile.github}</p>}
        {profile.linkedin && <p className="text-sm"><span className="font-medium text-gray-700 dark:text-gray-300">LinkedIn:</span> {profile.linkedin}</p>}
        {profile.title && <p className="text-sm"><span className="font-medium text-gray-700 dark:text-gray-300">Rol:</span> {profile.title}</p>}
        {profile.skills.length > 0 && (
          <div>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Habilidades:</span>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {profile.skills.map((s) => (
                <span key={s} className="px-2 py-0.5 text-xs rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">{s}</span>
              ))}
            </div>
          </div>
        )}
        {profile.languages.length > 0 && (
          <div>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Idiomas:</span>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {profile.languages.map((l) => (
                <span key={l} className="px-2 py-0.5 text-xs rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">{l}</span>
              ))}
            </div>
          </div>
        )}
        {profile.certifications.length > 0 && (
          <div>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Certificaciones:</span>
            <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400 mt-1">
              {profile.certifications.map((c) => <li key={c}>{c}</li>)}
            </ul>
          </div>
        )}
        {profile.education.length > 0 && profile.education[0].degree && (
          <div>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Educación:</span>
            {profile.education.map((edu, i) => (
              <div key={i} className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {edu.degree}{edu.field && ` en ${edu.field}`}
                {edu.institution && <span> — {edu.institution}</span>}
                {(edu.startDate || edu.endDate) && (
                  <span className="text-xs text-gray-400 ml-1">
                    ({edu.startDate}{edu.startDate && edu.endDate && ' — '}{edu.endDate})
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  const renderStep = () => {
    if (step === 0) return renderAreaSelection()
    if (step === 1) return renderContactFields()
    const qIdx = step - 2
    if (qIdx < visibleQuestions.length) return renderQuestion(qIdx)
    return renderSummary()
  }

  const isLastStep = step >= totalSteps - 1

  return (
    <div className="fixed inset-0 bg-black/40 dark:bg-black/60 z-50 flex items-center justify-center">
      <div className="bg-white dark:bg-gray-950 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-lg font-semibold">Configurar Perfil</h2>
            <p className="text-xs text-gray-400">{stepLabel(step)}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex gap-1.5 px-6 py-3">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={`flex-1 h-1.5 rounded-full transition-colors ${
                i <= step ? 'bg-blue-500' : 'bg-gray-200 dark:bg-gray-700'
              }`}
            />
          ))}
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin px-6 py-4">
          {saveError && (
            <div className="flex items-start gap-2 p-3 mb-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{saveError}</span>
            </div>
          )}
          {renderStep()}
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t">
          <button
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 disabled:opacity-30 hover:text-gray-800 dark:hover:text-gray-200"
          >
            <ChevronLeft className="w-4 h-4" />
            Anterior
          </button>

          {isLastStep ? (
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              {saving ? 'Guardando...' : 'Guardar Perfil'}
            </button>
          ) : (
            <button
              onClick={() => setStep((s) => s + 1)}
              disabled={!canNext()}
              className="flex items-center gap-1 px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
            >
              Siguiente
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
