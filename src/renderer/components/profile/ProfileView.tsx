import { useState } from 'react'
import { Pencil, Check, X, User, Briefcase, BookOpen, Award, Globe, Mail, Phone, MapPin, Code2, Link, Loader2, Target } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { Profile, Project } from '../../../shared/types'

interface ProfileViewProps {
  profile: Profile
  onSave: (profile: Profile) => Promise<void>
  onEdit: () => void
}

export function ProfileView({ profile, onSave, onEdit }: ProfileViewProps) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({ ...profile, projects: profile.projects ?? [], skillLevels: profile.skillLevels ?? {} })
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(draft)
      window.dispatchEvent(new Event('profile:updated'))
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setDraft({ ...profile, projects: profile.projects ?? [], skillLevels: profile.skillLevels ?? {} })
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('profile.editProfile')}</h3>
          <div className="flex gap-2">
            <button onClick={handleCancel} disabled={saving} className="px-3 py-1.5 text-sm font-medium rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50">{t('profile.cancel')}</button>
            <button onClick={handleSave} disabled={saving} className="px-4 py-1.5 text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}{t('profile.saveChanges')}</button>
          </div>
        </div>

        {/* Photo */}
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">{t('profile.photo')}</label>
          <div className="flex items-center gap-4">
            {draft.photo ? (
              <div className="relative w-20 h-20 rounded-full overflow-hidden border-2 border-gray-200 dark:border-gray-700">
                <img src={draft.photo} alt="Preview" className="w-full h-full object-cover" />
                <button onClick={() => setDraft({ ...draft, photo: '' })} className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs"><X className="w-3 h-3" /></button>
              </div>
            ) : (
              <div className="w-20 h-20 rounded-full border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center text-gray-400 bg-gray-50 dark:bg-gray-800/50 cursor-pointer hover:border-blue-400 transition-colors" onClick={() => document.getElementById('edit-photo-input')?.click()}>
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
              </div>
            )}
            <button onClick={() => document.getElementById('edit-photo-input')?.click()} className="text-xs text-blue-500 hover:text-blue-600 font-medium">{t('profile.changePhoto')}</button>
          </div>
          <input id="edit-photo-input" type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => {
            const file = e.target.files?.[0]
            if (!file) return
            const reader = new FileReader()
            reader.onload = () => setDraft({ ...draft, photo: reader.result as string })
            reader.readAsDataURL(file)
            e.target.value = ''
          }} />
        </div>

        <div className="space-y-3">
          <Field label={t('profile.name')} icon={User} value={draft.name} onChange={(v) => setDraft({ ...draft, name: v })} />
          <Field label={t('profile.email')} icon={Mail} value={draft.email} onChange={(v) => setDraft({ ...draft, email: v })} />
          <Field label={t('profile.phone')} icon={Phone} value={draft.phone} onChange={(v) => setDraft({ ...draft, phone: v })} />
          <Field label={t('profile.location')} icon={MapPin} value={draft.location} onChange={(v) => setDraft({ ...draft, location: v })} />
          <div className="flex items-center gap-2">
            <Target className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[70px]">{t('profile.targetMarket')}</label>
            <select
              value={draft.targetMarket ?? ''}
              onChange={(e) => setDraft({ ...draft, targetMarket: e.target.value })}
              className="flex-1 px-2.5 py-1.5 text-sm rounded-lg border bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            >
              <option value="">Selecciona...</option>
              {['República Dominicana', 'México', 'Colombia', 'Argentina', 'Chile', 'Perú', 'España', 'Estados Unidos', 'Europa (otro)', 'Latinoamérica (otro)', 'Remoto (internacional)', 'Otro'].map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
          <Field label={t('profile.github')} icon={Code2} value={draft.github} onChange={(v) => setDraft({ ...draft, github: v })} />
          <Field label={t('profile.linkedin')} icon={Link} value={draft.linkedin} onChange={(v) => setDraft({ ...draft, linkedin: v })} />
          <Field label={t('profile.portfolio')} icon={Link} value={draft.portfolio} onChange={(v) => setDraft({ ...draft, portfolio: v })} />
          <Field label={t('profile.role')} icon={Briefcase} value={draft.title} onChange={(v) => setDraft({ ...draft, title: v })} />
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{t('profile.summary')}</label>
            <textarea
              value={draft.summary}
              onChange={(e) => setDraft({ ...draft, summary: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-y"
            />
          </div>
          <SkillTagsField label={t('profile.skills')} icon={Award} values={draft.skills} levels={draft.skillLevels ?? {}} onChange={(v) => setDraft({ ...draft, skills: v })} onLevelChange={(skill, level) => setDraft({ ...draft, skillLevels: { ...draft.skillLevels, [skill]: level } })} />
          <TagsField label={t('profile.certifications')} icon={BookOpen} values={draft.certifications} onChange={(v) => setDraft({ ...draft, certifications: v })} />
          <TagsField label={t('profile.languages')} icon={Globe} values={draft.languages} onChange={(v) => setDraft({ ...draft, languages: v })} />

          {/* Experience */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
            <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3">{t('profile.experience')}</h4>
            <div className="space-y-3">
              {(draft.experience ?? []).map((exp, i) => (
                <div key={i} className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-500">{t('profile.experienceNumber', { number: i + 1 })}</span>
                    <button onClick={() => setDraft({ ...draft, experience: (draft.experience ?? []).filter((_, j) => j !== i) })} className="text-red-400 hover:text-red-600">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={exp.company}
                      onChange={(e) => {
                        const next = [...(draft.experience ?? [])]
                        next[i] = { ...next[i], company: e.target.value }
                        setDraft({ ...draft, experience: next })
                      }}
                      placeholder={t('profile.company')}
                      className="flex-1 px-3 py-2 text-sm rounded-lg border bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    />
                    <input
                      type="text"
                      value={exp.position}
                      onChange={(e) => {
                        const next = [...(draft.experience ?? [])]
                        next[i] = { ...next[i], position: e.target.value }
                        setDraft({ ...draft, experience: next })
                      }}
                      placeholder={t('profile.position')}
                      className="flex-1 px-3 py-2 text-sm rounded-lg border bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    />
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={exp.startDate}
                      onChange={(e) => {
                        const next = [...(draft.experience ?? [])]
                        next[i] = { ...next[i], startDate: e.target.value }
                        setDraft({ ...draft, experience: next })
                      }}
                      placeholder={t('profile.startDate')}
                      className="flex-1 px-3 py-2 text-sm rounded-lg border bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    />
                    <input
                      type="text"
                      value={exp.endDate ?? ''}
                      onChange={(e) => {
                        const next = [...(draft.experience ?? [])]
                        next[i] = { ...next[i], endDate: e.target.value || null }
                        setDraft({ ...draft, experience: next })
                      }}
                      placeholder={t('profile.endDate')}
                      className="flex-1 px-3 py-2 text-sm rounded-lg border bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    />
                  </div>
                  <textarea
                    value={exp.description}
                    onChange={(e) => {
                      const next = [...(draft.experience ?? [])]
                      next[i] = { ...next[i], description: e.target.value }
                      setDraft({ ...draft, experience: next })
                    }}
                    rows={2}
                    placeholder={t('profile.description')}
                    className="w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-y"
                  />
                </div>
              ))}
              <button
                onClick={() => setDraft({ ...draft, experience: [...(draft.experience ?? []), { company: '', position: '', startDate: '', endDate: null, description: '', highlights: [] }] })}
                className="flex items-center gap-1.5 text-sm text-blue-500 hover:text-blue-600 font-medium"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                {t('profile.addExperience')}
              </button>
            </div>
          </div>

          {/* Projects */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
            <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3">{t('profile.projects')}</h4>
            <div className="space-y-3">
              {(draft.projects ?? []).map((p, i) => (
                <div key={i} className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-500">{t('profile.projectNumber', { number: i + 1 })}</span>
                    <button onClick={() => setDraft({ ...draft, projects: (draft.projects ?? []).filter((_, j) => j !== i) })} className="text-red-400 hover:text-red-600">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={p.name}
                    onChange={(e) => {
                      const next = [...(draft.projects ?? [])]
                      next[i] = { ...next[i], name: e.target.value }
                      setDraft({ ...draft, projects: next })
                    }}
                    placeholder={t('profile.projectName')}
                    className="w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  />
                  <textarea
                    value={p.description}
                    onChange={(e) => {
                      const next = [...(draft.projects ?? [])]
                      next[i] = { ...next[i], description: e.target.value }
                      setDraft({ ...draft, projects: next })
                    }}
                    rows={2}
                    placeholder={t('profile.projectDescription')}
                    className="w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-y"
                  />
                </div>
              ))}
              <button
                onClick={() => setDraft({ ...draft, projects: [...(draft.projects ?? []), { name: '', description: '' }] })}
                className="flex items-center gap-1.5 text-sm text-blue-500 hover:text-blue-600 font-medium"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                {t('profile.addProject')}
              </button>
            </div>
          </div>

          {/* Education */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
            <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3">{t('profile.education')}</h4>
            <div className="space-y-3">
              {(() => {
                const edu = draft.education[0] ?? { institution: '', degree: '', field: '', startDate: '', endDate: '' }
                const setEdu = (update: Partial<typeof edu>) => setDraft({ ...draft, education: [{ ...edu, ...update }] })
                return <>
                  <Field label={t('profile.institution')} icon={BookOpen} value={edu.institution} onChange={(v) => setEdu({ institution: v })} />
                  <Field label={t('profile.degree')} icon={BookOpen} value={edu.degree} onChange={(v) => setEdu({ degree: v })} />
                  <Field label={t('profile.field')} icon={BookOpen} value={edu.field} onChange={(v) => setEdu({ field: v })} />
                  <div className="flex flex-wrap gap-2">
                    <div className="flex-1 min-w-[120px]">
                      <Field label={t('profile.startYear')} icon={BookOpen} value={edu.startDate} onChange={(v) => setEdu({ startDate: v })} />
                    </div>
                    <div className="flex-1 min-w-[120px]">
                      <Field label={t('profile.endYear')} icon={BookOpen} value={edu.endDate} onChange={(v) => setEdu({ endDate: v })} />
                    </div>
                  </div>
                </>
              })()}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('profile.yourProfile')}</h3>
        <div className="flex gap-2">
          <button onClick={() => setEditing(true)} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors">
            <Pencil className="w-3.5 h-3.5" />{t('profile.edit')}
          </button>
          <button onClick={onEdit} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
            {t('profile.redoWizard')}
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {profile.photo && (
          <div className="flex justify-center mb-2">
            <img src={profile.photo} alt={t('profile.photoAlt')} className="w-20 h-20 rounded-full object-cover border-2 border-gray-200 dark:border-gray-700" />
          </div>
        )}
        {profile.name && <InfoRow icon={User} label={t('profile.name')} value={profile.name} />}
        {profile.email && <InfoRow icon={Mail} label={t('profile.email')} value={profile.email} />}
        {profile.phone && <InfoRow icon={Phone} label={t('profile.phone')} value={profile.phone} />}
        {profile.location && <InfoRow icon={MapPin} label={t('profile.location')} value={profile.location} />}
        {profile.targetMarket && <InfoRow icon={Target} label={t('profile.targetMarket')} value={profile.targetMarket} />}
        {profile.github && <InfoRow icon={Code2} label={t('profile.github')} value={profile.github} />}
        {profile.linkedin && <InfoRow icon={Link} label={t('profile.linkedin')} value={profile.linkedin} />}
        {profile.portfolio && <InfoRow icon={Link} label={t('profile.portfolio')} value={profile.portfolio} />}
        {profile.title && <InfoRow icon={Briefcase} label={t('profile.role')} value={profile.title} />}
        {profile.summary && (
          <div>
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1">{t('profile.summary')}</span>
            <p className="text-sm text-gray-700 dark:text-gray-300">{profile.summary}</p>
          </div>
        )}
        {profile.skills.length > 0 && (
          <div>
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1.5">{t('profile.skills')}</span>
            <div className="flex flex-wrap gap-1.5">
              {profile.skills.map((s) => {
                const level = profile.skillLevels?.[s]
                const color = level === 'Avanzado' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                  : level === 'Básico' ? 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                  : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                return (
                  <span key={s} className={`px-2 py-0.5 text-xs rounded-full ${color}`}>
                    {s}{level ? ` · ${level}` : ''}
                  </span>
                )
              })}
            </div>
          </div>
        )}
        {profile.certifications.length > 0 && (
          <div>
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1.5">{t('profile.certifications')}</span>
            <div className="flex flex-wrap gap-1.5">
              {profile.certifications.map((c) => <Tag key={c} label={c} />)}
            </div>
          </div>
        )}
        {profile.languages.length > 0 && (
          <div>
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1.5">{t('profile.languages')}</span>
            <div className="flex flex-wrap gap-1.5">
              {profile.languages.map((l) => <Tag key={l} label={l} />)}
            </div>
          </div>
        )}
        {profile.experience.length > 0 && profile.experience[0].position && (
          <div>
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1">{t('profile.experience')}</span>
            {profile.experience.map((exp, i) => (
              <div key={i} className="text-sm text-gray-700 dark:text-gray-300">
                <span className="font-medium">{exp.position}</span>
                {exp.company && <span> {t('profile.at')} {exp.company}</span>}
                {exp.description && <p className="text-xs text-gray-500 mt-0.5">{exp.description}</p>}
              </div>
            ))}
          </div>
        )}
        {(profile.projects ?? []).length > 0 && (
          <div>
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1.5">{t('profile.projects')}</span>
            <div className="space-y-2">
              {(profile.projects ?? []).map((p, i) => (
                <div key={i} className="text-sm">
                  <span className="font-medium text-gray-700 dark:text-gray-300">{p.name}</span>
                  {p.description && <p className="text-xs text-gray-500 mt-0.5">{p.description}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
        {profile.education.length > 0 && profile.education[0].degree && (
          <div>
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1">{t('profile.education')}</span>
            {profile.education.map((edu, i) => (
              <div key={i} className="text-sm text-gray-700 dark:text-gray-300">
                <span className="font-medium">{edu.degree}</span>
                {edu.field && <span> {t('profile.in')} {edu.field}</span>}
                {edu.institution && <span className="text-gray-500"> — {edu.institution}</span>}
                {(edu.startDate || edu.endDate) && (
                  <span className="text-xs text-gray-400 block">
                    {edu.startDate}{edu.startDate && edu.endDate && ' — '}{edu.endDate}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <Icon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
      <span className="text-gray-500 dark:text-gray-400 min-w-[70px] text-xs">{label}</span>
      <span className="text-gray-800 dark:text-gray-200">{value}</span>
    </div>
  )
}

function Field({ label, icon: Icon, value, onChange }: { label: string; icon: any; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
      <label className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[70px]">{label}</label>
      <input
        type={label === 'GitHub' || label === 'LinkedIn' ? 'text' : 'text'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 px-2.5 py-1.5 text-sm rounded-lg border bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
      />
    </div>
  )
}

function TagsField({ label, icon: Icon, values, onChange }: { label: string; icon: any; values: string[]; onChange: (v: string[]) => void }) {
  const { t } = useTranslation()
  const [input, setInput] = useState('')
  const addTag = () => {
    const trimmed = input.trim()
    if (trimmed && !values.includes(trimmed)) {
      onChange([...values, trimmed])
    }
    setInput('')
  }
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
        <label className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</label>
      </div>
      <div className="flex flex-wrap gap-1.5 mb-1.5">
        {values.map((v, i) => (
          <span key={v} className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
            {v}
            <button onClick={() => onChange(values.filter((_, j) => j !== i))} className="hover:text-red-500"><X className="w-3 h-3" /></button>
          </span>
        ))}
      </div>
      <div className="flex gap-1">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
          className="flex-1 px-2.5 py-1.5 text-sm rounded-lg border bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          placeholder={t('profile.addTag', { label: label.toLowerCase() })}
        />
        <button onClick={addTag} className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg">+</button>
      </div>
    </div>
  )
}

function Tag({ label }: { label: string }) {
  return (
    <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
      {label}
    </span>
  )
}

const PROF_LEVELS = ['Básico', 'Intermedio', 'Avanzado'] as const

function SkillTagsField({ label, icon: Icon, values, levels, onChange, onLevelChange }: { label: string; icon: any; values: string[]; levels: Record<string, string>; onChange: (v: string[]) => void; onLevelChange: (skill: string, level: string) => void }) {
  const { t } = useTranslation()
  const [input, setInput] = useState('')
  const addTag = () => {
    const trimmed = input.trim()
    if (trimmed && !values.includes(trimmed)) {
      onChange([...values, trimmed])
      onLevelChange(trimmed, 'Intermedio')
    }
    setInput('')
  }
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
        <label className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</label>
      </div>
      <div className="flex flex-wrap gap-1.5 mb-1.5">
        {values.map((v, i) => {
          const level = levels[v] || 'Intermedio'
          const color = level === 'Avanzado' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
            : level === 'Básico' ? 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
            : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
          return (
            <span key={v} className="inline-flex items-center gap-1">
              <span className={`px-2 py-0.5 text-xs rounded-full ${color}`}>
                {v}
              </span>
              <span className="flex gap-0.5">
                {PROF_LEVELS.map((l) => (
                  <button
                    key={l}
                    onClick={() => onLevelChange(v, l)}
                    className={`w-1.5 h-1.5 rounded-full transition-colors ${
                      level === l
                        ? l === 'Básico' ? 'bg-gray-500' : l === 'Intermedio' ? 'bg-blue-500' : 'bg-green-500'
                        : 'bg-gray-300 dark:bg-gray-600 hover:bg-gray-400'
                    }`}
                    title={l}
                  />
                ))}
              </span>
              <button onClick={() => onChange(values.filter((_, j) => j !== i))} className="hover:text-red-500"><X className="w-3 h-3" /></button>
            </span>
          )
        })}
      </div>
      <div className="flex gap-1">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
          className="flex-1 px-2.5 py-1.5 text-sm rounded-lg border bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          placeholder={t('profile.addTag', { label: label.toLowerCase() })}
        />
        <button onClick={addTag} className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg">+</button>
      </div>
    </div>
  )
}
