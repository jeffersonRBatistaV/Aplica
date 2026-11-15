import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Globe,
  History,
  Loader2,
  Minus,
  Paperclip,
  Plus,
  RotateCw,
  Search,
  ShieldCheck,
  Sparkles,
  Undo2,
  UserRound,
  Wand2,
  X,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigation } from '../../contexts/AppContext'
import { useSettings } from '../../contexts/SettingsContext'
import {
  AUTOFILL_KEYS,
  AUTOFILL_KEY_LABELS,
  buildProfileValues,
  createDefaultBrowserState,
  getDomain,
  planAutofill,
} from '../../../shared/autofill'
import type {
  BrowserAgentEvent,
  BrowserAutofillKey,
  BrowserCvOption,
  BrowserFormField,
  BrowserMapping,
  BrowserPageSnapshot,
  BrowserState,
  Profile,
} from '../../../shared/types'
import { friendlyMessage } from '../../lib/friendly-error'

const HOME_URL = 'https://www.linkedin.com/jobs/'
const BROWSER_PARTITION = 'persist:aplica-browser'
const EMPTY_MAPPINGS: Record<string, BrowserMapping> = {}

interface WebviewElement extends HTMLElement {
  getWebContentsId(): number
  loadURL(url: string): Promise<void>
  reload(): void
  canGoBack(): boolean
  canGoForward(): boolean
  goBack(): void
  goForward(): void
  getURL(): string
  getTitle(): string
  setZoomFactor(factor: number): void
  stop(): void
}

interface Draft {
  value: string
  selected: boolean
  key: string
  reason?: string
}

interface AgentLogEntry {
  id: number
  kind: 'step' | 'tool' | 'done' | 'error' | 'status'
  text: string
  ok?: boolean
}

const QUICK_LINKS = [
  { label: 'LinkedIn', url: 'https://www.linkedin.com/jobs/' },
  { label: 'Indeed', url: 'https://www.indeed.com/' },
  { label: 'Glassdoor', url: 'https://www.glassdoor.com/Job/index.htm' },
  { label: 'Computrabajo', url: 'https://www.computrabajo.com/' },
  { label: 'InfoJobs', url: 'https://www.infojobs.net/' },
]

function normalizeAddress(input: string): string {
  const value = input.trim()
  if (!value) return HOME_URL
  if (/^https?:\/\//i.test(value)) return value
  if (!/\s/.test(value) && /^[\w-]+(\.[\w-]+)+(\/.*)?$/.test(value)) return `https://${value}`
  return `https://duckduckgo.com/?q=${encodeURIComponent(value)}`
}

const iconButton =
  'p-1.5 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 disabled:hover:bg-transparent transition-colors'

const primaryButton =
  'inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors'

const secondaryButton =
  'inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors'

export function BrowserView() {
  const { t, i18n } = useTranslation()
  const { currentView } = useNavigation()
  const { activeProfileId } = useSettings()
  const webviewRef = useRef<WebviewElement | null>(null)
  const webContentsId = useRef<number | null>(null)
  const historyRef = useRef<HTMLDivElement | null>(null)
  const logRef = useRef<HTMLDivElement | null>(null)
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingUrl = useRef<string | null>(null)
  const hydratedRef = useRef(false)
  const stateProfileRef = useRef<string | null>(null)
  const activeProfileRef = useRef<string | null>(null)
  activeProfileRef.current = activeProfileId ?? null
  const initialUrl = useRef(HOME_URL)
  const loadSeq = useRef(0)
  const profileIdRef = useRef<string | null | undefined>(undefined)

  const [state, setState] = useState<BrowserState | null>(null)
  const [hasOpened, setHasOpened] = useState(false)
  const [address, setAddress] = useState(HOME_URL)
  const [loading, setLoading] = useState(false)
  const [canGoBack, setCanGoBack] = useState(false)
  const [canGoForward, setCanGoForward] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [panel, setPanel] = useState<'profile' | 'agent' | null>(null)
  const [snapshot, setSnapshot] = useState<BrowserPageSnapshot | null>(null)
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [profileData, setProfileData] = useState<ReturnType<typeof buildProfileValues> | null>(null)
  const [cvs, setCvs] = useState<BrowserCvOption[]>([])
  const [inspecting, setInspecting] = useState(false)
  const [filling, setFilling] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [agentRunning, setAgentRunning] = useState(false)
  const [agentLog, setAgentLog] = useState<AgentLogEntry[]>([])
  const logId = useRef(0)

  const lang = i18n.language === 'en' ? 'en' : 'es'
  const domain = useMemo(() => (snapshot ? getDomain(snapshot.url) : ''), [snapshot])
  const overrides = useMemo(
    () => (state && domain ? state.fieldOverrides[domain] || EMPTY_MAPPINGS : EMPTY_MAPPINGS),
    [state, domain],
  )

  const showNotice = useCallback((message: string) => {
    setNotice(message)
    if (noticeTimer.current) clearTimeout(noticeTimer.current)
    noticeTimer.current = setTimeout(() => setNotice(null), 4500)
  }, [])

  useEffect(() => {
    return () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current)
    }
  }, [])

  useEffect(() => {
    if (currentView === 'browser') setHasOpened(true)
  }, [currentView])

  useEffect(() => {
    if (!window.api) return
    let cancelled = false
    const seq = ++loadSeq.current
    Promise.all([
      window.api.getBrowserState().catch(() => createDefaultBrowserState()),
      window.api.getProfile().catch(() => null),
      window.api.listBrowserCvs().catch(() => [] as BrowserCvOption[]),
    ]).then(([browserState, profile, options]) => {
      if (cancelled || seq !== loadSeq.current) return
      hydratedRef.current = true
      stateProfileRef.current = activeProfileRef.current
      initialUrl.current = browserState.lastUrl || HOME_URL
      setState(browserState)
      setAddress(browserState.lastUrl || HOME_URL)
      setProfileData(buildProfileValues(profile as Profile | null))
      setCvs(options)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!state || !hydratedRef.current) return
    if (stateProfileRef.current !== (activeProfileId ?? null)) return
    const timer = setTimeout(() => {
      void window.api.saveBrowserState(state, activeProfileId ?? null).catch(() => undefined)
    }, 500)
    return () => clearTimeout(timer)
  }, [state, activeProfileId])

  useEffect(() => {
    if (!window.api) return
    if (profileIdRef.current === undefined) {
      profileIdRef.current = activeProfileId
      return
    }
    if (profileIdRef.current === activeProfileId) return
    profileIdRef.current = activeProfileId
    let cancelled = false
    const seq = ++loadSeq.current
    void (async () => {
      void window.api.abortBrowserAgent().catch(() => undefined)
      webContentsId.current = null
      setSnapshot(null)
      setDrafts({})
      setAgentLog([])
      setAgentRunning(false)
      const [browserState, profile, options] = await Promise.all([
        window.api.getBrowserState().catch(() => createDefaultBrowserState()),
        window.api.getProfile().catch(() => null),
        window.api.listBrowserCvs().catch(() => [] as BrowserCvOption[]),
      ])
      if (cancelled || seq !== loadSeq.current) return
      hydratedRef.current = true
      stateProfileRef.current = activeProfileId ?? null
      initialUrl.current = browserState.lastUrl || HOME_URL
      setState(browserState)
      setAddress(browserState.lastUrl || HOME_URL)
      setProfileData(buildProfileValues(profile as Profile | null))
      setCvs(options)
    })()
    return () => {
      cancelled = true
    }
  }, [activeProfileId])

  useEffect(() => {
    if (panel === 'profile' && window.api) {
      void window.api.listBrowserCvs().then(setCvs).catch(() => undefined)
    }
  }, [panel])

  useEffect(() => {
    if (!state || !hydratedRef.current || cvs.length === 0) return
    const current = state.selectedCvId
    if (current && cvs.some((cv) => cv.id === current)) return
    const fallback = cvs[0].id
    if (fallback !== current) setState({ ...state, selectedCvId: fallback })
  }, [cvs, state])

  useEffect(() => {
    if (!historyOpen) return
    const handler = (event: MouseEvent) => {
      if (historyRef.current && !historyRef.current.contains(event.target as Node)) setHistoryOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [historyOpen])

  const refreshPage = useCallback(async () => {
    const id = webContentsId.current
    if (!id || !window.api) return null
    setInspecting(true)
    try {
      const next = await window.api.inspectBrowserPage(id)
      setSnapshot(next)
      return next
    } finally {
      setInspecting(false)
    }
  }, [])

  const recordVisit = useCallback((url: string, title: string) => {
    if (!url || url === 'about:blank') return
    setState((prev) => {
      if (!prev) return prev
      const history = [
        { url, title: title || url, visitedAt: Date.now() },
        ...prev.history.filter((entry) => entry.url !== url),
      ].slice(0, 100)
      return { ...prev, lastUrl: url, history }
    })
  }, [])

  useEffect(() => {
    if (!hasOpened) return
    const wv = webviewRef.current
    if (!wv) return

    const sync = () => {
      try {
        const url = wv.getURL()
        if (url) setAddress(url)
        setCanGoBack(wv.canGoBack())
        setCanGoForward(wv.canGoForward())
      } catch {
        // la vista aun no esta lista
      }
    }

    const onDomReady = () => {
      try {
        webContentsId.current = wv.getWebContentsId()
        wv.setZoomFactor(state?.zoom ?? 1)
      } catch {
        // ignore
      }
      if (pendingUrl.current) {
        const url = pendingUrl.current
        pendingUrl.current = null
        void wv.loadURL(url).catch(() => showNotice(t('browser.loadError')))
      }
      sync()
    }
    const onNavigate = (event: Event) => {
      const url = (event as Event & { url?: string }).url || wv.getURL()
      sync()
      if (url) {
        recordVisit(url, wv.getTitle())
        setAddress(url)
      }
    }
    const onTitle = () => {
      const url = wv.getURL()
      const title = wv.getTitle()
      setState((prev) =>
        prev
          ? { ...prev, history: prev.history.map((entry) => (entry.url === url ? { ...entry, title: title || entry.title } : entry)) }
          : prev,
      )
    }
    const onStart = () => setLoading(true)
    const onStop = () => {
      setLoading(false)
      sync()
    }
    const onFail = (event: Event) => {
      const detail = event as Event & { isMainFrame?: boolean; errorDescription?: string }
      if (detail.isMainFrame === false) return
      setLoading(false)
      if (detail.errorDescription && !/ERR_ABORTED/i.test(detail.errorDescription)) {
        showNotice(detail.errorDescription)
      }
    }

    wv.addEventListener('dom-ready', onDomReady)
    wv.addEventListener('did-navigate', onNavigate)
    wv.addEventListener('did-navigate-in-page', onNavigate)
    wv.addEventListener('page-title-updated', onTitle)
    wv.addEventListener('did-start-loading', onStart)
    wv.addEventListener('did-stop-loading', onStop)
    wv.addEventListener('did-fail-load', onFail)

    return () => {
      wv.removeEventListener('dom-ready', onDomReady)
      wv.removeEventListener('did-navigate', onNavigate)
      wv.removeEventListener('did-navigate-in-page', onNavigate)
      wv.removeEventListener('page-title-updated', onTitle)
      wv.removeEventListener('did-start-loading', onStart)
      wv.removeEventListener('did-stop-loading', onStop)
      wv.removeEventListener('did-fail-load', onFail)
    }
  }, [hasOpened, recordVisit, showNotice, t, state?.zoom])

  useEffect(() => {
    if (!snapshot || !profileData) return
    const plan = planAutofill(snapshot.fields, profileData, overrides, { overwriteExisting: true })
    const next: Record<string, Draft> = {}
    for (const item of plan.items) {
      const field = item.field
      const mapping = overrides[field.signature]
      const key =
        mapping?.key === 'skip' ? 'skip' : mapping?.key === 'custom' ? '__custom' : mapping?.key || ''
      next[field.id] = {
        value: item.value,
        selected: item.source !== 'skip' && item.value !== '' && field.type !== 'file',
        key,
        reason: item.reason,
      }
    }
    setDrafts(next)
  }, [snapshot, profileData, overrides])

  useEffect(() => {
    if (!window.api) return
    const unsubscribe = window.api.onBrowserAgentEvent((event: BrowserAgentEvent) => {
      const entry: AgentLogEntry = { id: ++logId.current, kind: 'step', text: '' }
      if (event.type === 'step') {
        entry.text = event.message
      } else if (event.type === 'tool') {
        entry.kind = 'tool'
        entry.ok = event.ok
        entry.text = `${event.name}: ${event.result || (event.ok ? 'ok' : 'error')}`
      } else if (event.type === 'done') {
        entry.kind = 'done'
        entry.text = event.pending.length
          ? `${event.summary}\n${t('browser.pending')}: ${event.pending.join(' · ')}`
          : event.summary
        setAgentRunning(false)
        void refreshPage()
      } else if (event.type === 'error') {
        entry.kind = 'error'
        entry.text = event.message
        setAgentRunning(false)
      } else {
        entry.kind = 'status'
        entry.text = event.message || event.status
        if (event.status !== 'running') setAgentRunning(false)
      }
      setAgentLog((prev) => [...prev, entry].slice(-80))
    })
    return unsubscribe
  }, [t, refreshPage])

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [agentLog])

  const navigateTo = (input: string) => {
    const url = normalizeAddress(input)
    setAddress(url)
    const wv = webviewRef.current
    if (!wv) {
      pendingUrl.current = url
      setHasOpened(true)
      return
    }
    void wv.loadURL(url).catch(() => showNotice(t('browser.loadError')))
  }

  const applyZoom = (zoom: number) => {
    const clamped = Math.min(2, Math.max(0.5, Math.round(zoom * 4) / 4))
    webviewRef.current?.setZoomFactor(clamped)
    setState((prev) => (prev ? { ...prev, zoom: clamped } : prev))
  }

  const openExternal = () => {
    void window.api.openExternal(address).catch(() => undefined)
  }

  const handleMappingChange = (field: BrowserFormField, value: string) => {
    if (!state || !profileData) return
    const current = state.fieldOverrides[domain] || {}
    const mappings: Record<string, BrowserMapping> = { ...current }
    if (value === '') {
      delete mappings[field.signature]
    } else if (value === 'skip') {
      mappings[field.signature] = { key: 'skip' }
    } else {
      mappings[field.signature] = { key: value as BrowserAutofillKey }
    }
    setState({ ...state, fieldOverrides: { ...state.fieldOverrides, [domain]: mappings } })

    const plan = planAutofill([field], profileData, mappings[field.signature] ? { [field.signature]: mappings[field.signature] } : {}, {
      overwriteExisting: true,
    })
    const item = plan.items[0]
    const computed = item?.value || ''
    setDrafts((prev) => ({
      ...prev,
      [field.id]: {
        value: computed,
        selected: value !== 'skip' && computed !== '' && field.type !== 'file',
        key: value,
        reason: item?.reason,
      },
    }))
  }

  const fillSelected = async () => {
    const id = webContentsId.current
    if (!id || !window.api) return
    const entries = Object.entries(drafts)
      .filter(([, draft]) => draft.selected && draft.value.trim())
      .map(([fieldId, draft]) => ({ id: fieldId, value: draft.value }))
    if (entries.length === 0) {
      showNotice(t('browser.nothingSelected'))
      return
    }
    setFilling(true)
    try {
      const result = await window.api.fillBrowserFields(id, entries)
      showNotice(t('browser.filledCount', { count: result.filled }))
      setTimeout(() => void refreshPage(), 350)
    } catch (error) {
      showNotice(error instanceof Error ? friendlyMessage(error) : String(error))
    } finally {
      setFilling(false)
    }
  }

  const fillEverything = async () => {
    const id = webContentsId.current
    if (!id || !window.api || !snapshot || !profileData) return
    const fresh = await refreshPage().catch(() => null)
    if (!fresh) return
    const plan = planAutofill(fresh.fields, profileData, overrides, {
      overwriteExisting: state?.overwriteExisting === true,
    })
    if (plan.entries.length === 0) {
      showNotice(t('browser.noMatches'))
      return
    }
    setFilling(true)
    try {
      const result = await window.api.fillBrowserFields(id, plan.entries)
      showNotice(t('browser.filledCount', { count: result.filled }))
      setTimeout(() => void refreshPage(), 350)
    } catch (error) {
      showNotice(error instanceof Error ? friendlyMessage(error) : String(error))
    } finally {
      setFilling(false)
    }
  }

  const undoFill = async () => {
    const id = webContentsId.current
    if (!id || !window.api) return
    const restored = await window.api.undoBrowserFill(id).catch(() => 0)
    showNotice(t('browser.undoneCount', { count: restored }))
    setTimeout(() => void refreshPage(), 250)
  }

  const attachCv = async (field: BrowserFormField) => {
    const id = webContentsId.current
    if (!id || !window.api) return
    const cvId = state?.selectedCvId || cvs[0]?.id || null
    try {
      const result = await window.api.attachBrowserCv(id, field.id, cvId)
      showNotice(result.ok ? t('browser.cvAttached', { label: result.label }) : result.message || t('browser.cvAttachFailed'))
      setTimeout(() => void refreshPage(), 250)
    } catch (error) {
      showNotice(error instanceof Error ? friendlyMessage(error) : String(error))
    }
  }

  const attachToFirstFile = async () => {
    const field = snapshot?.fields.find((item) => item.type === 'file')
    if (!field) {
      showNotice(t('browser.noFileField'))
      return
    }
    await attachCv(field)
  }

  const runAgent = async () => {
    if (!window.api) return
    const id = webContentsId.current
    if (!id) {
      showNotice(t('browser.agentHint'))
      return
    }
    const prompt = (state?.agentPrompt || '').trim() || t('browser.defaultPrompt')
    setAgentLog([])
    setAgentRunning(true)
    try {
      await window.api.runBrowserAgent(id, prompt)
    } catch (error) {
      setAgentRunning(false)
      showNotice(error instanceof Error ? friendlyMessage(error) : String(error))
    }
  }

  const stopAgent = () => {
    void window.api.abortBrowserAgent().catch(() => undefined)
    setAgentRunning(false)
  }

  const selectedCv = cvs.find((cv) => cv.id === state?.selectedCvId) || cvs[0]
  const fields = snapshot?.fields.filter((field) => field.visible || field.type === 'file').slice(0, 80) || []
  const history = state?.history || []

  return (
    <div className="flex h-full min-h-0 flex-col bg-white dark:bg-gray-950">
      <div className="flex items-center gap-1 border-b border-gray-200 px-2 py-1.5 dark:border-gray-800">
        <button
          className={iconButton}
          onClick={() => webviewRef.current?.goBack()}
          disabled={!canGoBack}
          title={t('browser.back')}
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <button
          className={iconButton}
          onClick={() => webviewRef.current?.goForward()}
          disabled={!canGoForward}
          title={t('browser.forward')}
        >
          <ArrowRight className="h-4 w-4" />
        </button>
        <button
          className={iconButton}
          onClick={() => (loading ? webviewRef.current?.stop() : webviewRef.current?.reload())}
          title={loading ? t('browser.stop') : t('browser.reload')}
        >
          {loading ? <X className="h-4 w-4" /> : <RotateCw className="h-4 w-4" />}
        </button>
        <button className={iconButton} onClick={() => navigateTo(HOME_URL)} title={t('browser.home')}>
          <Globe className="h-4 w-4" />
        </button>

        <form
          className="mx-1 flex min-w-0 flex-1 items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 focus-within:border-blue-400 focus-within:bg-white dark:border-gray-700 dark:bg-gray-900 dark:focus-within:bg-gray-900"
          onSubmit={(event) => {
            event.preventDefault()
            navigateTo(address)
          }}
        >
          <Search className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
          <input
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            onFocus={(event) => event.target.select()}
            placeholder={t('browser.addressPlaceholder')}
            className="min-w-0 flex-1 bg-transparent text-xs text-gray-800 outline-none placeholder:text-gray-400 dark:text-gray-100"
            spellCheck={false}
          />
        </form>

        <div className="relative" ref={historyRef}>
          <button
            className={iconButton}
            onClick={() => setHistoryOpen((open) => !open)}
            title={t('browser.history')}
          >
            <History className="h-4 w-4" />
          </button>
          {historyOpen && (
            <div className="absolute right-0 top-full z-50 mt-1 w-80 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900">
              <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2 dark:border-gray-800">
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">{t('browser.history')}</span>
                <button
                  className="text-[11px] text-gray-500 hover:text-red-600 dark:text-gray-400"
                  onClick={() => setState((prev) => (prev ? { ...prev, history: [] } : prev))}
                >
                  {t('browser.clearHistory')}
                </button>
              </div>
              <div className="max-h-72 overflow-y-auto p-1">
                {history.length === 0 && (
                  <p className="px-2 py-3 text-xs text-gray-500 dark:text-gray-400">{t('browser.noHistory')}</p>
                )}
                {history.map((entry) => (
                  <button
                    key={`${entry.url}-${entry.visitedAt}`}
                    className="flex w-full flex-col items-start gap-0.5 rounded-lg px-2 py-1.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800"
                    onClick={() => {
                      setHistoryOpen(false)
                      navigateTo(entry.url)
                    }}
                  >
                    <span className="w-full truncate text-xs font-medium text-gray-800 dark:text-gray-100">
                      {entry.title || entry.url}
                    </span>
                    <span className="w-full truncate text-[10px] text-gray-400">{entry.url}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <button className={iconButton} onClick={openExternal} title={t('browser.openExternal')}>
          <ArrowUpRight className="h-4 w-4" />
        </button>

        <div className="ml-1 flex items-center rounded-md border border-gray-200 dark:border-gray-700">
          <button className={iconButton} onClick={() => applyZoom((state?.zoom || 1) - 0.25)} title={t('browser.zoomOut')}>
            <Minus className="h-3.5 w-3.5" />
          </button>
          <span className="w-9 text-center text-[10px] text-gray-500 dark:text-gray-400">
            {Math.round((state?.zoom || 1) * 100)}%
          </span>
          <button className={iconButton} onClick={() => applyZoom((state?.zoom || 1) + 0.25)} title={t('browser.zoomIn')}>
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        <button
          className={`ml-1 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
            panel === 'profile'
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
              : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
          }`}
          onClick={() => setPanel(panel === 'profile' ? null : 'profile')}
        >
          <UserRound className="h-3.5 w-3.5" />
          {t('browser.profilePanel')}
        </button>
        <button
          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
            panel === 'agent'
              ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300'
              : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
          }`}
          onClick={() => setPanel(panel === 'agent' ? null : 'agent')}
        >
          <Sparkles className="h-3.5 w-3.5" />
          {t('browser.agentPanel')}
        </button>
      </div>

      <div className="flex items-center gap-1.5 border-b border-gray-100 px-3 py-1.5 dark:border-gray-800/70">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{t('browser.quickLinks')}</span>
        {QUICK_LINKS.map((link) => (
          <button
            key={link.url}
            className="rounded-full border border-gray-200 px-2 py-0.5 text-[11px] text-gray-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-blue-900/30"
            onClick={() => navigateTo(link.url)}
          >
            {link.label}
          </button>
        ))}
        {notice && (
          <span className="ml-auto truncate rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] text-gray-700 dark:bg-gray-800 dark:text-gray-200">
            {notice}
          </span>
        )}
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="relative min-w-0 flex-1 bg-white dark:bg-gray-950">
          {!hasOpened && (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-gray-400">
              <Globe className="h-8 w-8" />
              <p className="text-sm">{t('browser.openHint')}</p>
            </div>
          )}
          {hasOpened && state && (
            <webview
              key={activeProfileId || 'default'}
              ref={webviewRef}
              src={initialUrl.current}
              partition={BROWSER_PARTITION}
              className="h-full w-full"
              style={{ width: '100%', height: '100%' }}
            />
          )}
          {loading && (
            <div className="absolute left-0 top-0 h-0.5 w-full overflow-hidden bg-blue-100 dark:bg-blue-950">
              <div className="h-full w-1/3 animate-pulse bg-blue-600" />
            </div>
          )}
        </div>

        {panel === 'profile' && (
          <aside className="flex w-[360px] flex-shrink-0 flex-col border-l border-gray-200 dark:border-gray-800">
            <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2 dark:border-gray-800">
              <div className="flex items-center gap-1.5">
                <UserRound className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-semibold">{t('browser.profilePanel')}</span>
              </div>
              <button className={iconButton} onClick={() => setPanel(null)}>
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              <div className="mb-3 flex gap-2">
                <button className={`${primaryButton} flex-1`} onClick={() => void refreshPage()} disabled={inspecting}>
                  {inspecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                  {t('browser.analyze')}
                </button>
                <button className={secondaryButton} onClick={() => void undoFill()} title={t('browser.undo')}>
                  <Undo2 className="h-3.5 w-3.5" />
                  {t('browser.undo')}
                </button>
              </div>

              <div className="mb-3 rounded-xl border border-gray-200 p-2.5 dark:border-gray-700">
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  {t('browser.cvForApplications')}
                </label>
                <select
                  value={state?.selectedCvId || cvs[0]?.id || ''}
                  onChange={(event) => setState((prev) => (prev ? { ...prev, selectedCvId: event.target.value || null } : prev))}
                  className="mb-2 w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs dark:border-gray-700 dark:bg-gray-900"
                >
                  {cvs.length === 0 && <option value="">{t('browser.noCvs')}</option>}
                  {cvs.map((cv) => (
                    <option key={cv.id} value={cv.id}>
                      {cv.label}
                    </option>
                  ))}
                </select>
                <button className={`${secondaryButton} w-full`} onClick={() => void attachToFirstFile()} disabled={!selectedCv}>
                  <Paperclip className="h-3.5 w-3.5" />
                  {t('browser.attachCv')}
                </button>
              </div>

              <div className="mb-3 grid grid-cols-2 gap-2">
                <button className={primaryButton} onClick={() => void fillSelected()} disabled={filling}>
                  {filling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                  {t('browser.fillSelected')}
                </button>
                <button className={secondaryButton} onClick={() => void fillEverything()} disabled={filling || !snapshot}>
                  <Sparkles className="h-3.5 w-3.5" />
                  {t('browser.fillAll')}
                </button>
              </div>

              <div className="mb-3 space-y-2 rounded-xl bg-gray-50 p-2.5 dark:bg-gray-900">
                <label className="flex items-start gap-2 text-[11px] text-gray-600 dark:text-gray-300">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={state?.confirmBeforeSubmit !== false}
                    onChange={(event) => setState((prev) => (prev ? { ...prev, confirmBeforeSubmit: event.target.checked } : prev))}
                  />
                  <span className="flex-1">{t('browser.confirmBeforeSubmit')}</span>
                </label>
                <label className="flex items-start gap-2 text-[11px] text-gray-600 dark:text-gray-300">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={state?.overwriteExisting === true}
                    onChange={(event) => setState((prev) => (prev ? { ...prev, overwriteExisting: event.target.checked } : prev))}
                  />
                  <span className="flex-1">{t('browser.overwriteExisting')}</span>
                </label>
              </div>

              {!snapshot && (
                <p className="rounded-xl border border-dashed border-gray-200 px-3 py-6 text-center text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
                  {t('browser.analyzeHint')}
                </p>
              )}

              {snapshot && fields.length === 0 && (
                <p className="rounded-xl border border-dashed border-gray-200 px-3 py-6 text-center text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
                  {t('browser.noFields')}
                </p>
              )}

              <div className="space-y-2">
                {fields.map((field) => {
                  const draft = drafts[field.id] || { value: '', selected: false, key: '' }
                  const label = field.label || field.placeholder || field.name || field.id
                  return (
                    <div key={field.id} className="rounded-lg border border-gray-200 p-2 dark:border-gray-700">
                      <div className="mb-1 flex items-start justify-between gap-2">
                        <span className="line-clamp-2 text-[11px] font-medium text-gray-700 dark:text-gray-200" title={label}>
                          {label}
                          {field.required && <span className="ml-0.5 text-red-500">*</span>}
                        </span>
                        {field.type === 'file' ? (
                          <button className={iconButton} onClick={() => void attachCv(field)} title={t('browser.attachCv')}>
                            <Paperclip className="h-3.5 w-3.5" />
                          </button>
                        ) : (
                          <input
                            type="checkbox"
                            checked={draft.selected}
                            onChange={(event) =>
                              setDrafts((prev) => ({
                                ...prev,
                                [field.id]: { ...draft, selected: event.target.checked },
                              }))
                            }
                            title={t('browser.includeField')}
                          />
                        )}
                      </div>

                      {field.type === 'file' ? (
                        <p className="truncate text-[10px] text-gray-400">
                          {field.accept ? `${t('browser.fileField')} · ${field.accept}` : t('browser.fileField')}
                        </p>
                      ) : (
                        <>
                          <select
                            value={draft.key}
                            onChange={(event) => handleMappingChange(field, event.target.value)}
                            className="mb-1 w-full rounded-md border border-gray-200 bg-white px-1.5 py-1 text-[10px] dark:border-gray-700 dark:bg-gray-900"
                          >
                            <option value="">{t('browser.mappingAuto')}{field.suggestedKey ? ` (${AUTOFILL_KEY_LABELS[field.suggestedKey][lang]})` : ''}</option>
                            {AUTOFILL_KEYS.map((key) => (
                              <option key={key} value={key}>
                                {AUTOFILL_KEY_LABELS[key][lang]}
                              </option>
                            ))}
                            <option value="skip">{t('browser.mappingSkip')}</option>
                          </select>
                          <input
                            value={draft.value}
                            onChange={(event) =>
                              setDrafts((prev) => ({
                                ...prev,
                                [field.id]: { ...draft, value: event.target.value, selected: true },
                              }))
                            }
                            placeholder={t('browser.fieldValuePlaceholder')}
                            className="w-full rounded-md border border-gray-200 bg-white px-2 py-1 text-[11px] dark:border-gray-700 dark:bg-gray-900"
                            disabled={draft.key === 'skip'}
                          />
                          {draft.reason && (
                            <p className="mt-0.5 truncate text-[9px] text-gray-400">{draft.reason}</p>
                          )}
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="border-t border-gray-200 p-2.5 dark:border-gray-800">
              <p className="flex items-start gap-1.5 text-[10px] leading-relaxed text-gray-500 dark:text-gray-400">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-emerald-600" />
                {t('browser.securityNote')}
              </p>
            </div>
          </aside>
        )}

        {panel === 'agent' && (
          <aside className="flex w-[360px] flex-shrink-0 flex-col border-l border-gray-200 dark:border-gray-800">
            <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2 dark:border-gray-800">
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-violet-600" />
                <span className="text-sm font-semibold">{t('browser.agentPanel')}</span>
              </div>
              <button className={iconButton} onClick={() => setPanel(null)}>
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="border-b border-gray-200 p-3 dark:border-gray-800">
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-[11px] font-semibold text-gray-600 dark:text-gray-300">{t('browser.agentPromptLabel')}</label>
                {!!state?.agentPrompt && (
                  <button
                    className="text-[10px] text-violet-600 hover:underline dark:text-violet-400"
                    onClick={() => setState((prev) => (prev ? { ...prev, agentPrompt: '' } : prev))}
                  >
                    {t('browser.agentPromptReset')}
                  </button>
                )}
              </div>
              <textarea
                value={state?.agentPrompt || t('browser.defaultPrompt')}
                onChange={(event) => {
                  const value = event.target.value
                  // Guardar el texto por defecto tal cual equivale a "sin personalizar".
                  setState((prev) => (prev ? { ...prev, agentPrompt: value === t('browser.defaultPrompt') ? '' : value } : prev))
                }}
                placeholder={t('browser.agentPlaceholder')}
                disabled={!state}
                rows={6}
                className="w-full resize-none rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-xs leading-relaxed outline-none focus:border-violet-400 dark:border-gray-700 dark:bg-gray-900"
              />
              <div className="mt-2 flex gap-2">
                <button className={`${primaryButton} flex-1`} onClick={() => void runAgent()} disabled={agentRunning || !hasOpened}>
                  {agentRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  {agentRunning ? t('browser.agentRunning') : t('browser.agentRun')}
                </button>
                <button className={secondaryButton} onClick={stopAgent} disabled={!agentRunning}>
                  {t('browser.agentStop')}
                </button>
              </div>
              <p className="mt-2 text-[10px] text-gray-400">
                {state?.agentPrompt ? t('browser.agentPromptSaved') : t('browser.agentPromptDefault')} · {t('browser.agentHint')}
              </p>
            </div>

            <div ref={logRef} className="flex-1 space-y-1.5 overflow-y-auto p-3">
              {agentLog.length === 0 && (
                <p className="text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">{t('browser.agentIdle')}</p>
              )}
              {agentLog.map((entry) => (
                <div
                  key={entry.id}
                  className={`rounded-lg px-2 py-1.5 text-[11px] leading-relaxed ${
                    entry.kind === 'error'
                      ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                      : entry.kind === 'done'
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                        : entry.kind === 'tool'
                          ? entry.ok
                            ? 'bg-gray-50 text-gray-700 dark:bg-gray-900 dark:text-gray-200'
                            : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                          : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {entry.kind === 'tool' && <span className="mr-1 font-bold">{entry.ok ? '✓' : '!'}</span>}
                  {entry.text}
                </div>
              ))}
            </div>

            <div className="border-t border-gray-200 p-2.5 dark:border-gray-800">
              <p className="flex items-start gap-1.5 text-[10px] leading-relaxed text-gray-500 dark:text-gray-400">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-emerald-600" />
                {t('browser.agentSecurityNote')}
              </p>
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}
