/**
 * job-finder.ts — Buscador de vacantes en internet según el perfil activo.
 *
 * Pipeline:
 *   1. Consultas a partir del perfil (puesto, experiencia, área, ubicación).
 *   2. Búsqueda en LinkedIn (endpoint guest) + portales de empleo vía buscador web.
 *   3. Se abre cada vacante candidata para extraer la descripción completa y
 *      el contacto del publicador (correo / teléfono).
 *   4. Afinidad 0–100 contra el perfil (puesto + habilidades + área).
 */

import type { AppSettings, FoundJob, InvestigateConfig, JobFinderOptions, JobFinderProgress, Profile } from '../../shared/types'
import { classifyCategory, extractVacancyPhone, isVacancyInArea, looksLikeVacancy } from '../../shared/vacancy-detection'
import { searchWeb, type SearchResult } from './search-providers'
import { extractContent } from './content-extractor'
import { searchLinkedInJobs, fetchLinkedInJob } from './linkedin-service'
import { getActiveProfile } from './profile-scope'
import { readJSON } from './storage'
import { SETTINGS_FILE } from '../utils/paths'

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 40
const DETAIL_CONCURRENCY = 4
const DETAIL_TIMEOUT_MS = 12_000
const MIN_SCORE = 30

/** Portales de empleo (dominio base → patrón de URL de una oferta individual). */
const JOB_BOARDS: { site: string; offer: RegExp }[] = [
  { site: 'computrabajo.com', offer: /\/(ofertas-de-trabajo|oferta-de-trabajo)/i },
  { site: 'indeed.com', offer: /(\/viewjob|\/rc\/clk|[?&]jk=|\/cmp\/[^/]+\/jobs\/)/i },
  { site: 'bumeran.com', offer: /\/empleos\/.+-\d+\.html/i },
  { site: 'zonajobs.com', offer: /\/empleos\/.+-\d+\.html/i },
  { site: 'getonbrd.com', offer: /\/jobs\/[^/]+\/[^/]+/i },
  { site: 'glassdoor.com', offer: /\/job-listing\//i },
  { site: 'elempleo.com', offer: /\/ofertas-trabajo\/.+\d/i },
  { site: 'occ.com.mx', offer: /\/empleo\/oferta\//i },
  { site: 'multitrabajos.com', offer: /\/empleos\/.+-\d+\.html/i },
  { site: 'laborum.cl', offer: /\/empleos\/.+-\d+\.html/i },
  { site: 'trabajando.com', offer: /\/trabajo\/\d+/i },
  { site: 'empleate.com', offer: /\/(oferta|empleo)/i },
  { site: 'trabajosdiarios.com', offer: /\/trabajo\/\d+\//i },
  { site: 'rumbo.do', offer: /\/vacantes\/[^/?#]+-(\d{6,}|[a-f0-9]{32})\/?$/i },
]

/**
 * Portales cuyo listado se sirve en HTML (sin JavaScript): se abre el listado y
 * se sacan los enlaces a cada oferta. `direct` arma una búsqueda propia en el portal.
 */
const LISTING_SOURCES: {
  site: string
  link: RegExp
  direct?: (cc: string, slug: string, query: string) => string | null
}[] = [
  {
    site: 'trabajosdiarios.com',
    link: /href="(\/trabajo\/\d+\/[^"#?]+)"/gi,
    direct: (cc, slug) => (cc ? `https://${cc}.trabajosdiarios.com/ofertas-trabajo/de-${slug}` : null),
  },
  {
    site: 'rumbo.do',
    link: /href="(\/vacantes\/[^"#?]+-(?:\d{6,}|[a-f0-9]{32}))"/gi,
    direct: (cc, _slug, query) => (cc === 'do' ? `https://rumbo.do/vacantes?q=${encodeURIComponent(query)}` : null),
  },
]
const MAX_PER_LISTING = 10
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

/** Páginas de listados/búsqueda (no una vacante concreta). */
const LISTING_PATH = /(\/trabajo-de-|\/trabajo-[a-z-]+(\/[^/]+)?\/?$|\/empleos?-de-|-empleos\/?$|\/empleo-[^/]+(\/[^/]+)?\/?$|\/ofertas-trabajo\/de-|\/jobs\?|\/jobs\/[a-z-]+-(empleos|jobs)\/?$|\/search|\/buscar|[?&]q=|\/empleos\/?$|\/jobs\/?$|^https?:\/\/[^/]+\/?$)/i

const JOB_WORDS = /\b(vacante|empleo|trabajo|oferta|se busca|buscamos|contratando|puesto|hiring|job|position|career|carrera)\b/i

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,}/g
const JUNK_EMAIL = /(noreply|no-reply|donotreply|example\.|sentry|wixpress|@2x|\.(png|jpe?g|gif|webp|svg)$|privacy|privacidad|data\.?protection|gdpr|dpo@|legal@|compliance|soporte|support|ayuda|help|abuse|webmaster)/i
const PLATFORM_DOMAINS = /(linkedin|indeed|computrabajo|bumeran|zonajobs|glassdoor|getonbrd|elempleo|occ\.com|multitrabajos|laborum|trabajando|google|facebook)/i

const STOPWORDS = new Set([
  'de', 'del', 'la', 'el', 'los', 'las', 'en', 'y', 'o', 'a', 'para', 'con', 'por', 'un', 'una',
  'the', 'and', 'of', 'for', 'in', 'to', 'with', 'sr', 'jr', 'senior', 'junior', 'semi',
])

type ProgressFn = (p: JobFinderProgress) => void

function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function tokens(text: string): string[] {
  return normalize(text)
    .split(/[^a-z0-9+#.]+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w))
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

function countryName(code: string | undefined, locale = 'es'): string {
  if (!code) return ''
  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(code.trim().toUpperCase()) || ''
  } catch {
    return ''
  }
}

// ── Consultas a partir del perfil ──

interface FinderPlan {
  roles: string[]
  location: string
  /** Ubicación para LinkedIn (país en inglés, que es lo que geocodifica bien). */
  linkedinLocation: string
  /** País en inglés, para ampliar la búsqueda de LinkedIn más allá de la ciudad. */
  countryEn: string
  skills: string[]
  area?: string
}

function buildPlan(profile: Profile | null, opts: JobFinderOptions): FinderPlan {
  const roles: string[] = []
  const push = (r: string | undefined) => {
    const v = (r || '').trim()
    if (v && !roles.some((x) => normalize(x) === normalize(v))) roles.push(v)
  }
  if (opts.query?.trim()) {
    push(opts.query)
  } else if (profile) {
    push(profile.title)
    // La experiencia más reciente puede ser de otro rubro: solo si no hay puesto objetivo.
    if (roles.length === 0) push(profile.experience?.[0]?.position)
    if (roles.length === 0) push(profile.area)
  }
  const custom = (opts.location ?? '').trim()
  const profileLoc = (profile?.location || '').trim()
  const countryEs = countryName(profile?.country)
  const countryEn = countryName(profile?.country, 'en')
  // "Santo Domingo, Republica Dominicana" → ciudad "Santo Domingo".
  const city = profileLoc.split(',')[0].trim()
  const location = custom || city || countryEs
  const linkedinLocation = custom
    || [city, countryEn].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(', ')
    || profileLoc
  const skills = (profile?.skills || []).map((s) => s.trim()).filter((s) => s.length >= 2)
  return { roles: roles.slice(0, 2), location, linkedinLocation, countryEn: custom ? '' : countryEn, skills, area: profile?.area }
}

// ── Afinidad con el perfil ──

function scoreJob(plan: FinderPlan, title: string, text: string): { score: number; matched: string[]; category: string } {
  const normText = normalize(`${title}\n${text}`)
  const normTitle = normalize(title)

  // Puesto: fracción de palabras del rol que aparecen en el título (o en el texto, con menos peso).
  let roleScore = 0
  for (const role of plan.roles) {
    const words = tokens(role)
    if (words.length === 0) continue
    const inTitle = words.filter((w) => normTitle.includes(w)).length / words.length
    const inText = words.filter((w) => normText.includes(w)).length / words.length
    roleScore = Math.max(roleScore, inTitle * 45, inText * 25)
  }

  const matched: string[] = []
  for (const skill of plan.skills) {
    const n = normalize(skill)
    const re = new RegExp(`(^|[^a-z0-9])${escapeRegExp(n)}($|[^a-z0-9])`)
    if (re.test(normText)) matched.push(skill)
  }
  const skillBase = Math.min(plan.skills.length, 8) || 1
  const skillScore = Math.min(matched.length / skillBase, 1) * 45

  const category = classifyCategory(text, title)
  const areaScore = plan.area && isVacancyInArea(category, plan.area, true) ? 10 : 0

  return { score: Math.round(Math.min(roleScore + skillScore + areaScore, 100)), matched, category }
}

// ── Contacto del publicador ──

function extractEmail(text: string, site: string): string | undefined {
  const found = text.match(EMAIL_RE) || []
  const candidates = found
    .map((e) => e.replace(/[.,;:]+$/, ''))
    .filter((e) => !JUNK_EMAIL.test(e))
    .filter((e) => {
      const domain = e.split('@')[1] || ''
      return !PLATFORM_DOMAINS.test(domain) && !(site && domain.endsWith(site))
    })
  if (candidates.length === 0) return undefined
  // Preferir el correo que aparece cerca de palabras de postulación.
  const lower = text.toLowerCase()
  const near = candidates.find((e) => {
    const i = lower.indexOf(e.toLowerCase())
    const ctx = lower.slice(Math.max(0, i - 160), i)
    return /(cv|curr[ií]cul|hoja de vida|env[ií]a|postula|aplica|interesad|resume|apply|contact)/.test(ctx)
  })
  return near || candidates[0]
}

// ── Búsqueda ──

interface Candidate {
  title: string
  company: string
  location: string
  url: string
  postedAt?: string
  snippet?: string
  linkedinId?: string
  site: string
  prelim: number
}

function isOfferUrl(url: string): boolean {
  const host = hostOf(url)
  if (!host) return false
  const board = JOB_BOARDS.find((b) => host.endsWith(b.site) || host.includes(b.site.split('.')[0]))
  if (board) return board.offer.test(url)
  return !LISTING_PATH.test(url)
}

function slugify(text: string): string {
  return normalize(text).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

/** "/trabajo/3102942/desarrollador-android-med-level-en-santo-domingo" → "Desarrollador android med level". */
function titleFromSlug(url: string): string {
  const last = (url.split(/[?#]/)[0].split('/').filter(Boolean).pop() || '')
    .replace(/-(\d{6,}|[a-f0-9]{32})$/i, '')
    .replace(/-en-.*$/, '')
  const words = last.split('-').filter(Boolean).join(' ')
  return words ? words[0].toUpperCase() + words.slice(1) : ''
}

async function fetchListing(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'text/html', 'Accept-Language': 'es,en;q=0.8' },
    signal: AbortSignal.timeout(DETAIL_TIMEOUT_MS),
    redirect: 'follow',
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.text()
}

/** Abre un listado de un portal soportado y devuelve las ofertas que encajan con los puestos. */
async function expandListing(url: string, plan: FinderPlan): Promise<{ url: string; title: string; site: string }[]> {
  const host = hostOf(url)
  const source = LISTING_SOURCES.find((s) => host.endsWith(s.site))
  if (!source) return []
  try {
    const html = await fetchListing(url)
    const origin = new URL(url).origin
    const roleWords = plan.roles.map((r) => tokens(r)).filter((w) => w.length > 0)
    const out: { url: string; title: string; site: string }[] = []
    const seen = new Set<string>()
    for (const m of html.matchAll(new RegExp(source.link.source, 'gi'))) {
      const href = `${origin}${m[1]}`
      if (seen.has(href)) continue
      seen.add(href)
      const slug = normalize(m[1])
      // Al menos la mitad de las palabras de algún puesto en el enlace.
      const fits = roleWords.some((words) => words.filter((w) => slug.includes(w)).length >= Math.ceil(words.length / 2))
      if (!fits) continue
      out.push({ url: href, title: titleFromSlug(href), site: host })
      if (out.length >= MAX_PER_LISTING) break
    }
    return out
  } catch {
    return []
  }
}

function splitWebTitle(raw: string): { title: string; company: string } {
  const cleaned = raw.replace(/\s*[|–-]\s*(Computrabajo|Indeed|Bumeran|Glassdoor|Get on Board|LinkedIn|elempleo|OCC)[^|–-]*$/i, '').trim()
  const parts = cleaned.split(/\s+[|–-]\s+|\s+en\s+(?=[A-ZÁÉÍÓÚ])/)
  return { title: (parts[0] || cleaned).trim(), company: (parts[1] || '').trim() }
}

async function searchCandidates(plan: FinderPlan, opts: JobFinderOptions, onProgress: ProgressFn): Promise<Candidate[]> {
  const settings = await readJSON<AppSettings>(SETTINGS_FILE).catch(() => null)
  const cfg: Partial<InvestigateConfig> = settings?.investigate || {}
  const country = (await getActiveProfile().catch(() => null))?.country
  const loc = plan.location
  const remote = opts.remote ? ' remoto' : ''

  // Consultas orientadas a publicaciones individuales con contacto (correo / WhatsApp).
  const webQueries: string[] = []
  for (const role of plan.roles) {
    webQueries.push(`${role} vacante${remote} ${loc} enviar cv correo`)
    webQueries.push(`se busca ${role}${remote} ${loc} whatsapp`)
    webQueries.push(`${role} empleo${remote} ${loc} oferta`)
  }

  onProgress({ phase: 'search', message: `Buscando "${plan.roles.join('", "')}"${loc ? ` en ${loc}` : ''}…` })

  const linkedinLocation = opts.remote && !plan.linkedinLocation ? 'Remote' : plan.linkedinLocation
  const cc = (country || '').toLowerCase()
  const directListings = plan.roles.flatMap((r) =>
    LISTING_SOURCES.map((s) => s.direct?.(cc, slugify(r), r) || null).filter((u): u is string => !!u),
  )
  const [linkedin, web] = await Promise.all([
    Promise.all(
      plan.roles.flatMap((r) => {
        const kw = `${r}${opts.remote ? ' remote' : ''}`
        const locs = [linkedinLocation, plan.countryEn].filter((v, i, a) => v && a.indexOf(v) === i)
        return (locs.length ? locs : ['']).map((l) => searchLinkedInJobs(kw, l, 25).catch(() => []))
      }),
    ),
    Promise.all(webQueries.map((q) => searchWeb(q, { maxResults: 15, language: 'es', country }, cfg).catch(() => [] as SearchResult[]))),
  ])

  const out: Candidate[] = []
  const seen = new Set<string>()
  const add = (c: Omit<Candidate, 'prelim'>) => {
    const key = c.url.split(/[?#]/)[0].toLowerCase()
    const sig = normalize(`${c.title}|${c.company}`)
    if (!c.title || seen.has(key) || (c.company && seen.has(sig))) return
    seen.add(key)
    if (c.company) seen.add(sig)
    out.push({ ...c, prelim: scoreJob(plan, c.title, c.snippet || '').score })
  }

  for (const job of linkedin.flat()) {
    add({
      title: job.title,
      company: job.company,
      location: job.location,
      url: job.url,
      postedAt: job.postedAt,
      linkedinId: job.source === 'linkedin' ? job.id : undefined,
      site: 'linkedin.com',
    })
  }

  // Listados de portales soportados (búsqueda directa + los que trajo el buscador).
  const listingUrls = new Set(directListings)
  for (const r of web.flat()) {
    const host = hostOf(r.url)
    if (LISTING_SOURCES.some((s) => host.endsWith(s.site)) && !isOfferUrl(r.url)) listingUrls.add(r.url)
  }
  const expanded = await Promise.all([...listingUrls].slice(0, 6).map((u) => expandListing(u, plan)))
  for (const o of expanded.flat()) {
    add({ title: o.title, company: '', location: '', url: o.url, site: o.site })
  }

  for (const r of web.flat()) {
    if (!r.url || !isOfferUrl(r.url)) continue
    const host = hostOf(r.url)
    if (/linkedin\.com/.test(host) && !/\/jobs\/view\//.test(r.url)) continue
    const blob = normalize(`${r.title} ${r.snippet}`)
    if (!plan.roles.some((role) => tokens(role).some((w) => blob.includes(w)))) continue
    if (!JOB_BOARDS.some((b) => host.includes(b.site.split('.')[0])) && !JOB_WORDS.test(`${r.title} ${r.snippet}`)) continue
    const { title, company } = splitWebTitle(r.title)
    const linkedinId = /linkedin\.com/.test(host) ? r.url.match(/(\d{6,})/)?.[1] : undefined
    add({ title, company, location: '', url: r.url.split('#')[0], snippet: r.snippet, linkedinId, site: host })
  }

  return out
}

async function enrich(plan: FinderPlan, c: Candidate): Promise<FoundJob | null> {
  let description = ''
  let title = c.title
  let company = c.company
  let location = c.location

  try {
    if (c.linkedinId) {
      const d = await fetchLinkedInJob(c.linkedinId)
      if (d) {
        description = d.description
        title = d.title || title
        company = d.company || company
        location = d.location || location
      }
    } else {
      const page = await extractContent(c.url, { maxChars: 12_000, timeout: DETAIL_TIMEOUT_MS })
      description = page.content
      if (page.title && (!title || !c.snippet)) title = splitWebTitle(page.title).title || title
    }
  } catch {
    // Sin detalle: se conserva lo del resultado de búsqueda.
  }

  // Sin detalle no se puede valorar ni sacar contacto: se descarta.
  if (!c.linkedinId && !description) return null

  // Páginas genéricas que no son una oferta (blogs, listados…).
  if (!c.linkedinId && !JOB_BOARDS.some((b) => c.site.includes(b.site.split('.')[0]))) {
    if (description && !looksLikeVacancy(description) && !JOB_WORDS.test(title)) return null
  }

  const text = [description, c.snippet].filter(Boolean).join('\n')
  const { score, matched, category } = scoreJob(plan, title, text)

  return {
    id: c.linkedinId || c.url,
    title,
    company,
    location,
    url: c.url,
    postedAt: c.postedAt,
    source: c.site === 'linkedin.com' && c.linkedinId ? 'linkedin' : 'web',
    site: c.site,
    snippet: c.snippet,
    description: description || undefined,
    email: extractEmail(text, c.site),
    phone: extractVacancyPhone(description) || undefined,
    score,
    matchedSkills: matched,
    category,
  }
}

/** Busca en internet vacantes afines al perfil activo y extrae su información y contacto. */
export async function findJobsForProfile(opts: JobFinderOptions = {}, onProgress: ProgressFn = () => {}): Promise<FoundJob[]> {
  const profile = await getActiveProfile().catch(() => null)
  const plan = buildPlan(profile, opts)
  if (plan.roles.length === 0) {
    throw new Error('Tu perfil no tiene un puesto objetivo. Escribe qué puesto buscas o complétalo en tu perfil.')
  }

  const limit = Math.min(Math.max(opts.limit || DEFAULT_LIMIT, 1), MAX_LIMIT)
  const candidates = (await searchCandidates(plan, opts, onProgress))
    .sort((a, b) => b.prelim - a.prelim)
    // Margen extra: algunas páginas se descartan al abrirlas.
    .slice(0, Math.ceil(limit * 1.5))

  const results: FoundJob[] = []
  let done = 0
  const total = candidates.length
  onProgress({ phase: 'details', message: `Revisando ${total} vacantes…`, done, total })

  let cursor = 0
  const worker = async () => {
    while (cursor < candidates.length) {
      const c = candidates[cursor++]
      const job = await enrich(plan, c).catch(() => null)
      if (job) results.push(job)
      done++
      onProgress({ phase: 'details', message: `Revisando vacantes (${done}/${total})…`, done, total })
    }
  }
  await Promise.all(Array.from({ length: Math.min(DETAIL_CONCURRENCY, candidates.length) }, worker))

  const ranked = results.sort((a, b) => b.score - a.score || Number(!!b.email || !!b.phone) - Number(!!a.email || !!a.phone))
  // Descarta lo que no tiene que ver con el perfil, salvo que quede casi nada.
  const relevant = ranked.filter((j) => j.score >= MIN_SCORE)
  const sorted = (relevant.length >= 5 ? relevant : ranked.slice(0, Math.max(relevant.length, 5))).slice(0, limit)
  onProgress({ phase: 'done', message: `${sorted.length} vacantes encontradas`, done: total, total })
  return sorted
}
