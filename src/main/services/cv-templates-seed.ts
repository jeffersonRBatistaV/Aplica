import type { CvTemplate } from '../../shared/types'

/**
 * Plantillas predeterminadas de CV.
 *
 * Cada plantilla se define con UNA funcion `render` que se usa dos veces:
 *  - con SAMPLE  → la vista previa (sampleHtml) que se ve en el gestor de plantillas
 *  - con SLOTS   → el esqueleto de formato que se incrusta en el prompt del LLM
 * Asi la vista previa y lo que el modelo genera no pueden divergir.
 *
 * Diseno: documentos impresos, no interfaces web. Nada de chips, pildoras, tarjetas
 * redondeadas, degradados ni fondos oscuros de pagina completa; el color va en acentos
 * (nombre, filetes, titulos de seccion, barra lateral solida). Tamanos segun LAYOUT_RULES
 * de cv-generator.ts (cuerpo 10pt, nombre 20-22pt, titulos de seccion 10.5-11pt) y todo
 * cabe en una hoja A4 (cv-pdf.ts reduce el zoom si hiciera falta).
 *
 * Sube SEED_VERSION al cambiar cualquier diseno: las plantillas guardadas que el usuario
 * no haya editado se actualizan solas (ver upgradeSeedTemplates).
 */
export const SEED_VERSION = 4

interface SeedCv {
  /** src de la foto: avatar de muestra en la vista previa, token {{FOTO-PERFIL}} en el prompt. */
  photo: string
  initials: string
  name: string
  title: string
  email: string
  phone: string
  location: string
  linkedin: string
  summary: string
  skills: string[]
  skillGroups: { label: string; items: string[] }[]
  experience: { position: string; company: string; location: string; period: string; bullets: string[] }[]
  education: { degree: string; school: string; period: string }[]
  languages: { name: string; level: string }[]
  certs: string[]
}

const SAMPLE_AVATAR = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" fill="#cbd5e1"/><circle cx="60" cy="46" r="22" fill="#f8fafc"/><path d="M18 120c4-26 22-40 42-40s38 14 42 40z" fill="#f8fafc"/></svg>',
)}`

const SAMPLE: SeedCv = {
  photo: SAMPLE_AVATAR,
  initials: 'JD',
  name: 'John Doe',
  title: 'Senior Software Engineer',
  email: 'john.doe@email.com',
  phone: '+1 (555) 123-4567',
  location: 'San Francisco, CA',
  linkedin: 'linkedin.com/in/johndoe',
  summary:
    'Ingeniero de software con más de 8 años de experiencia en desarrollo full-stack, arquitectura cloud y liderazgo técnico. Especializado en React, Node.js y AWS, con foco en sistemas escalables, calidad de código y mentoría de equipos.',
  skills: ['TypeScript', 'React', 'Node.js', 'Python', 'AWS', 'Docker', 'GraphQL', 'PostgreSQL', 'CI/CD'],
  skillGroups: [
    { label: 'Lenguajes', items: ['TypeScript', 'JavaScript', 'Python', 'SQL'] },
    { label: 'Frameworks', items: ['React', 'Node.js', 'GraphQL'] },
    { label: 'Cloud y DevOps', items: ['AWS', 'Docker', 'CI/CD', 'PostgreSQL'] },
  ],
  experience: [
    {
      position: 'Tech Lead',
      company: 'ACME Corp',
      location: 'San Francisco, CA',
      period: 'Ene 2021 – Presente',
      bullets: [
        'Lideré un equipo de 8 ingenieros en la migración de la infraestructura legacy a microservicios en AWS, reduciendo el downtime en un 40%.',
        'Diseñé una arquitectura GraphQL que unificó 5 APIs REST y mejoró los tiempos de respuesta en un 60%.',
        'Establecí prácticas de revisión de código y mentoría que aceleraron la incorporación de nuevos ingenieros.',
      ],
    },
    {
      position: 'Senior Developer',
      company: 'ACME Corp',
      location: 'San Francisco, CA',
      period: 'Jun 2018 – Dic 2020',
      bullets: [
        'Desarrollé una plataforma React/Node.js con más de 50.000 usuarios activos, con CI/CD y pruebas automatizadas.',
        'Optimicé consultas PostgreSQL críticas, reduciendo los tiempos de carga de 3 s a 200 ms.',
      ],
    },
    {
      position: 'Full Stack Developer',
      company: 'Globex',
      location: 'Boston, MA',
      period: 'Feb 2016 – May 2018',
      bullets: [
        'Construí paneles internos y APIs REST en Node.js para los equipos de operaciones y soporte.',
        'Automaticé despliegues con Docker, reduciendo el tiempo de entrega de días a horas.',
      ],
    },
  ],
  education: [{ degree: 'B.S. Computer Science', school: 'Massachusetts Institute of Technology', period: '2012 – 2016' }],
  languages: [
    { name: 'Inglés', level: 'Nativo' },
    { name: 'Español', level: 'Avanzado (C1)' },
  ],
  certs: ['AWS Certified Solutions Architect – Associate (2022)', 'Professional Scrum Master I (2020)'],
}

const SLOTS: SeedCv = {
  photo: '{{FOTO-PERFIL}}',
  initials: '[Iniciales]',
  name: '[Nombre completo]',
  title: '[Título profesional]',
  email: '[Email]',
  phone: '[Teléfono]',
  location: '[Ubicación]',
  linkedin: '[LinkedIn]',
  summary: '[Resumen profesional de 2-3 líneas basado en el perfil]',
  skills: ['[Habilidad]', '[Habilidad]', '[Habilidad]'],
  skillGroups: [
    { label: '[Categoría]', items: ['[Habilidad]', '[Habilidad]'] },
    { label: '[Categoría]', items: ['[Habilidad]', '[Habilidad]'] },
  ],
  experience: [
    {
      position: '[Puesto]',
      company: '[Empresa]',
      location: '[Ciudad]',
      period: '[Fechas]',
      bullets: ['[Logro o responsabilidad]', '[Logro o responsabilidad]'],
    },
  ],
  education: [{ degree: '[Título]', school: '[Institución]', period: '[Fechas]' }],
  languages: [{ name: '[Idioma]', level: '[Nivel]' }],
  certs: ['[Certificación]'],
}

// ── helpers ──
const list = <T>(xs: T[], f: (x: T, i: number) => string, sep = '\n'): string => xs.map(f).join(sep)
const contact = (d: SeedCv, sep: string): string => [d.email, d.phone, d.location, d.linkedin].join(sep)
const bullets = (items: string[], ul = 'margin:2px 0 0 16px;padding:0;list-style:disc;', li = 'margin:0 0 1px;'): string =>
  `<ul style="${ul}">\n${list(items, (b) => `<li style="${li}">${b}</li>`)}\n</ul>`
const root = (cls: string, style: string, inner: string): string =>
  `<div class="${cls}" style="${style}font-size:10pt;width:100%;box-sizing:border-box;">\n${inner}\n</div>`
/** Fila con texto a la izquierda y dato (fecha/lugar) alineado a la derecha. */
const split = (left: string, right: string, rightStyle = 'font-size:9pt;color:#4b5563;'): string =>
  `<div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px;"><p style="margin:0;min-width:0;">${left}</p><p style="margin:0;flex-shrink:0;text-align:right;${rightStyle}">${right}</p></div>`
const skillLines = (d: SeedCv, label = 'font-weight:700;'): string =>
  list(d.skillGroups, (g) => `<p style="margin:0 0 2px;"><span style="${label}">${g.label}:</span> ${g.items.join(', ')}</p>`)
const langsInline = (d: SeedCv, sep = ' · '): string => list(d.languages, (l) => `${l.name} (${l.level})`, sep)

const SANS = `Calibri,'Segoe UI','Helvetica Neue',Arial,sans-serif`
const SERIF = `Cambria,Georgia,'Times New Roman',serif`
/** Alto del contenedor de las plantillas con barra lateral (A4 menos los márgenes del PDF). */
const FULL_HEIGHT = 'min-height:276mm;'

// ── 1. ATS ──
function renderAts(d: SeedCv): string {
  const h2 = 'font-size:10.5pt;font-weight:700;color:#111827;text-transform:uppercase;letter-spacing:0.8pt;margin:10px 0 5px;padding-bottom:2px;border-bottom:1px solid #111827;'
  return root('cv-ats', `font-family:${SANS};line-height:1.35;color:#111827;`, `<div style="text-align:center;">
<h1 style="font-size:20pt;font-weight:700;color:#1e3a8a;margin:0;">${d.name}</h1>
<p style="font-size:11pt;margin:1px 0 3px;">${d.title}</p>
<p style="font-size:9pt;color:#374151;margin:0;">${contact(d, ' | ')}</p>
</div>
<h2 style="${h2}">Resumen profesional</h2>
<p style="margin:0;">${d.summary}</p>
<h2 style="${h2}">Experiencia profesional</h2>
${list(d.experience, (e) => `<div style="margin:0 0 7px;">
${split(`<strong>${e.position}</strong>`, e.period, 'font-size:9.5pt;')}
${split(`<em>${e.company}</em>`, `<em>${e.location}</em>`, 'font-size:9.5pt;')}
${bullets(e.bullets)}
</div>`)}
<h2 style="${h2}">Educación</h2>
${list(d.education, (e) => `<div style="margin:0 0 3px;">
${split(`<strong>${e.degree}</strong>`, e.period, 'font-size:9.5pt;')}
<p style="margin:0;"><em>${e.school}</em></p>
</div>`)}
<h2 style="${h2}">Habilidades</h2>
${skillLines(d)}
<h2 style="${h2}">Certificaciones</h2>
${bullets(d.certs, 'margin:0 0 0 16px;padding:0;list-style:disc;')}
<h2 style="${h2}">Idiomas</h2>
<p style="margin:0;">${langsInline(d, ', ')}</p>`)
}

// ── 2. Moderno ──
function renderModerno(d: SeedCv): string {
  const accent = '#2563eb'
  const h2 = `font-size:10.5pt;font-weight:700;color:${accent};text-transform:uppercase;letter-spacing:1.2pt;margin:12px 0 6px;`
  const entry = (left: string, body: string) => `<div style="display:flex;gap:14px;margin:0 0 7px;">
<p style="flex:0 0 21%;min-width:0;margin:0;padding-top:1px;font-size:9pt;color:#6b7280;">${left}</p>
<div style="flex:1;min-width:0;">
${body}
</div>
</div>`
  return root('cv-moderno', `font-family:'Segoe UI',${SANS};line-height:1.4;color:#1f2937;`, `<h1 style="font-size:22pt;font-weight:700;color:#0f172a;letter-spacing:-0.2pt;margin:0;">${d.name}</h1>
<p style="font-size:11pt;font-weight:600;color:${accent};margin:1px 0 4px;">${d.title}</p>
<p style="font-size:9pt;color:#4b5563;margin:0;padding-bottom:9px;border-bottom:2px solid ${accent};">${contact(d, ' &nbsp;·&nbsp; ')}</p>
<h2 style="${h2}">Perfil</h2>
<p style="margin:0;">${d.summary}</p>
<h2 style="${h2}">Experiencia</h2>
${list(d.experience, (e) => entry(e.period, `<p style="margin:0;font-weight:700;color:#0f172a;">${e.position}</p>
<p style="margin:0 0 1px;font-size:9.5pt;color:#4b5563;">${e.company} · ${e.location}</p>
${bullets(e.bullets)}`))}
<h2 style="${h2}">Educación</h2>
${list(d.education, (e) => entry(e.period, `<p style="margin:0;font-weight:700;color:#0f172a;">${e.degree}</p>
<p style="margin:0;font-size:9.5pt;color:#4b5563;">${e.school}</p>`))}
<h2 style="${h2}">Habilidades</h2>
${list(d.skillGroups, (g) => entry(g.label, `<p style="margin:0;">${g.items.join(', ')}</p>`))}
<h2 style="${h2}">Certificaciones e idiomas</h2>
${entry('Certificaciones', list(d.certs, (c) => `<p style="margin:0;">${c}</p>`))}
${entry('Idiomas', `<p style="margin:0;">${langsInline(d)}</p>`)}`)
}

// ── 3. Tradicional ──
function renderTradicional(d: SeedCv): string {
  const h2 = 'text-align:center;font-size:10.5pt;font-weight:700;letter-spacing:2pt;text-transform:uppercase;color:#1c1917;margin:12px 0 6px;padding-bottom:3px;border-bottom:1px solid #78716c;'
  const meta = 'font-size:9.5pt;font-style:italic;color:#44403c;'
  return root('cv-tradicional', `font-family:${SERIF};line-height:1.4;color:#1c1917;`, `<div style="text-align:center;border-bottom:3px double #1c1917;padding-bottom:8px;">
<h1 style="font-size:20pt;font-weight:700;letter-spacing:2.5pt;text-transform:uppercase;margin:0;">${d.name}</h1>
<p style="font-size:11pt;font-style:italic;color:#44403c;margin:2px 0 4px;">${d.title}</p>
<p style="font-size:9pt;color:#44403c;margin:0;">${contact(d, ' &nbsp;·&nbsp; ')}</p>
</div>
<h2 style="${h2}">Perfil profesional</h2>
<p style="margin:0;text-align:justify;">${d.summary}</p>
<h2 style="${h2}">Experiencia profesional</h2>
${list(d.experience, (e) => `<div style="margin:0 0 8px;">
${split(`<strong>${e.position}</strong>`, e.period, meta)}
${split(e.company, e.location, meta)}
${bullets(e.bullets, 'margin:2px 0 0 18px;padding:0;list-style:disc;', 'margin:0 0 1px;text-align:justify;')}
</div>`)}
<h2 style="${h2}">Formación académica</h2>
${list(d.education, (e) => `<div style="margin:0 0 3px;">
${split(`<strong>${e.degree}</strong>`, e.period, meta)}
<p style="margin:0;font-style:italic;">${e.school}</p>
</div>`)}
<h2 style="${h2}">Competencias</h2>
${skillLines(d)}
<h2 style="${h2}">Certificaciones e idiomas</h2>
<p style="margin:0 0 2px;"><strong>Certificaciones:</strong> ${d.certs.join('; ')}</p>
<p style="margin:0;"><strong>Idiomas:</strong> ${langsInline(d, '; ')}</p>`)
}

// ── 4. Minimalista ──
function renderMinimalista(d: SeedCv): string {
  const row = (label: string, body: string) => `<div style="display:flex;gap:16px;border-top:1px solid #d4d4d4;margin-top:11px;padding-top:9px;">
<h2 style="flex:0 0 19%;min-width:0;font-size:8.5pt;font-weight:600;letter-spacing:1.8pt;text-transform:uppercase;color:#737373;margin:2px 0 0;">${label}</h2>
<div style="flex:1;min-width:0;">
${body}
</div>
</div>`
  return root('cv-minimalista', `font-family:'Helvetica Neue',${SANS};line-height:1.45;color:#262626;`, `<h1 style="font-size:22pt;font-weight:300;letter-spacing:3pt;text-transform:uppercase;color:#0a0a0a;margin:0;">${d.name}</h1>
<p style="font-size:9.5pt;letter-spacing:1.8pt;text-transform:uppercase;color:#525252;margin:3px 0 0;">${d.title}</p>
<p style="font-size:9pt;color:#525252;margin:7px 0 0;">${contact(d, ' &nbsp;/&nbsp; ')}</p>
${row('Perfil', `<p style="margin:0;">${d.summary}</p>`)}
${row('Experiencia', list(d.experience, (e) => `<div style="margin:0 0 8px;">
${split(`<strong style="color:#0a0a0a;">${e.position}</strong>, ${e.company}`, e.period, 'font-size:9pt;color:#737373;')}
<p style="margin:0 0 1px;font-size:9pt;color:#737373;">${e.location}</p>
${bullets(e.bullets, 'margin:0 0 0 15px;padding:0;list-style:disc;')}
</div>`))}
${row('Educación', list(d.education, (e) => split(`<strong style="color:#0a0a0a;">${e.degree}</strong>, ${e.school}`, e.period, 'font-size:9pt;color:#737373;')))}
${row('Habilidades', skillLines(d, 'font-weight:600;color:#0a0a0a;'))}
${row('Certificaciones', list(d.certs, (c) => `<p style="margin:0;">${c}</p>`))}
${row('Idiomas', `<p style="margin:0;">${langsInline(d)}</p>`)}`)
}

// ── 5. Ejecutivo ──
function renderEjecutivo(d: SeedCv): string {
  const navy = '#0f1e3d'
  const gold = '#a1782f'
  const h2 = `font-size:10.5pt;font-weight:700;color:${navy};letter-spacing:1.5pt;text-transform:uppercase;margin:12px 0 6px;padding-bottom:3px;border-bottom:1px solid ${gold};`
  return root('cv-ejecutivo', `font-family:${SERIF};line-height:1.4;color:#1f2937;`, `<div style="border-top:5px solid ${navy};padding:10px 0 9px;border-bottom:1px solid ${gold};display:flex;justify-content:space-between;align-items:flex-end;gap:16px;">
<div style="min-width:0;">
<h1 style="font-size:22pt;font-weight:700;color:${navy};margin:0;">${d.name}</h1>
<p style="font-family:${SANS};font-size:9.5pt;font-weight:700;letter-spacing:2pt;text-transform:uppercase;color:${gold};margin:2px 0 0;">${d.title}</p>
</div>
<div style="text-align:right;font-family:${SANS};font-size:9pt;color:#374151;line-height:1.45;flex-shrink:0;max-width:45%;">
<p style="margin:0;">${d.email} · ${d.phone}</p>
<p style="margin:0;">${d.location}</p>
<p style="margin:0;">${d.linkedin}</p>
</div>
</div>
<p style="margin:11px 0 0;padding-left:11px;border-left:3px solid ${gold};font-style:italic;color:#1f2937;">${d.summary}</p>
<h2 style="${h2}">Competencias clave</h2>
<div style="display:flex;flex-wrap:wrap;font-family:${SANS};">
${list(d.skills, (s) => `<p style="flex:0 0 33.33%;min-width:0;margin:0 0 2px;padding-right:8px;">• ${s}</p>`)}
</div>
<h2 style="${h2}">Trayectoria profesional</h2>
${list(d.experience, (e) => `<div style="margin:0 0 8px;">
${split(`<strong style="font-size:10.5pt;color:${navy};">${e.position}</strong>`, e.period, `font-family:${SANS};font-size:9pt;color:#4b5563;`)}
<p style="margin:0 0 1px;font-family:${SANS};font-size:9pt;font-weight:700;letter-spacing:1pt;text-transform:uppercase;color:${gold};">${e.company} <span style="font-weight:400;letter-spacing:0;text-transform:none;color:#4b5563;">· ${e.location}</span></p>
${bullets(e.bullets)}
</div>`)}
<div style="display:flex;gap:22px;">
<div style="flex:1;min-width:0;">
<h2 style="${h2}">Formación y certificaciones</h2>
${list(d.education, (e) => `<p style="margin:0;font-weight:700;color:${navy};">${e.degree}</p>
<p style="margin:0 0 4px;font-family:${SANS};font-size:9pt;color:#4b5563;">${e.school} · ${e.period}</p>`)}
${list(d.certs, (c) => `<p style="margin:0 0 1px;font-family:${SANS};font-size:9.5pt;">${c}</p>`)}
</div>
<div style="flex:0 0 34%;min-width:0;">
<h2 style="${h2}">Idiomas</h2>
${list(d.languages, (l) => `<p style="margin:0 0 2px;"><strong style="color:${navy};">${l.name}</strong> <span style="font-family:${SANS};font-size:9pt;color:#4b5563;">– ${l.level}</span></p>`)}
</div>
</div>`)
}

// ── 6. Creativo ──
function renderCreativo(d: SeedCv): string {
  const coral = '#c2410c'
  const side = 'font-size:9pt;font-weight:700;letter-spacing:1.5pt;text-transform:uppercase;color:#ffffff;margin:0 0 5px;padding-bottom:3px;border-bottom:1px solid rgba(255,255,255,0.45);'
  const main = `font-size:10.5pt;font-weight:700;letter-spacing:1.2pt;text-transform:uppercase;color:${coral};margin:12px 0 6px;`
  return root('cv-creativo', `font-family:'Trebuchet MS',${SANS};line-height:1.4;color:#292524;`, `<div style="display:flex;${FULL_HEIGHT}">
<div style="flex:0 0 31%;min-width:0;background:${coral};color:#fff7ed;padding:18px 14px;">
<div style="text-align:center;margin:0 0 16px;">
<div style="display:inline-block;width:24mm;height:24mm;border-radius:50%;border:2px solid #ffffff;line-height:22mm;font-size:20pt;font-weight:700;color:#ffffff;text-align:center;">${d.initials}</div>
</div>
<div style="margin:0 0 13px;">
<h2 style="${side}">Contacto</h2>
${list([d.email, d.phone, d.location, d.linkedin], (c) => `<p style="margin:0 0 2px;font-size:9pt;">${c}</p>`)}
</div>
<div style="margin:0 0 13px;">
<h2 style="${side}">Habilidades</h2>
${list(d.skills, (s) => `<p style="margin:0 0 1px;font-size:9.5pt;">${s}</p>`)}
</div>
<div style="margin:0 0 13px;">
<h2 style="${side}">Idiomas</h2>
${list(d.languages, (l) => `<p style="margin:0 0 1px;font-size:9.5pt;">${l.name} – ${l.level}</p>`)}
</div>
<div style="margin:0;">
<h2 style="${side}">Certificaciones</h2>
${list(d.certs, (c) => `<p style="margin:0 0 3px;font-size:9pt;">${c}</p>`)}
</div>
</div>
<div style="flex:1;min-width:0;padding:16px 0 12px 18px;">
<h1 style="font-size:24pt;font-weight:700;color:#1c1917;line-height:1.1;margin:0;">${d.name}</h1>
<p style="font-size:11.5pt;font-weight:700;color:${coral};margin:3px 0 0;">${d.title}</p>
<h2 style="${main}">Sobre mí</h2>
<p style="margin:0;">${d.summary}</p>
<h2 style="${main}">Experiencia</h2>
${list(d.experience, (e) => `<div style="margin:0 0 8px;">
${split(`<strong>${e.position}</strong>`, e.period, 'font-size:9pt;color:#57534e;')}
<p style="margin:0 0 1px;font-size:9.5pt;color:#57534e;">${e.company} · ${e.location}</p>
${bullets(e.bullets)}
</div>`)}
<h2 style="${main}">Educación</h2>
${list(d.education, (e) => `${split(`<strong>${e.degree}</strong>`, e.period, 'font-size:9pt;color:#57534e;')}
<p style="margin:0 0 3px;font-size:9.5pt;color:#57534e;">${e.school}</p>`)}
</div>
</div>`)
}

// ── 7. Tecnico ──
function renderTecnico(d: SeedCv): string {
  const h2 = 'font-size:10.5pt;font-weight:700;color:#0f172a;text-transform:uppercase;letter-spacing:0.8pt;margin:10px 0 5px;padding-bottom:2px;border-bottom:1.5px solid #0f172a;'
  return root('cv-tecnico', `font-family:'Segoe UI',${SANS};line-height:1.35;color:#1e293b;`, `<div style="display:flex;justify-content:space-between;align-items:flex-end;gap:12px;">
<div style="min-width:0;">
<h1 style="font-size:20pt;font-weight:700;color:#0f172a;margin:0;">${d.name}</h1>
<p style="font-size:11pt;font-weight:600;color:#0369a1;margin:1px 0 0;">${d.title}</p>
</div>
<p style="font-size:9pt;color:#334155;text-align:right;line-height:1.45;margin:0;flex-shrink:0;max-width:52%;">${d.email} · ${d.phone}<br>${d.location} · ${d.linkedin}</p>
</div>
<h2 style="${h2}">Resumen</h2>
<p style="margin:0;">${d.summary}</p>
<h2 style="${h2}">Habilidades técnicas</h2>
<table style="width:100%;table-layout:fixed;border-collapse:collapse;">
${list(d.skillGroups, (g) => `<tr><td style="width:24%;padding:1px 8px 1px 0;vertical-align:top;font-weight:700;">${g.label}</td><td style="padding:1px 0;vertical-align:top;">${g.items.join(', ')}</td></tr>`)}
</table>
<h2 style="${h2}">Experiencia</h2>
${list(d.experience, (e) => `<div style="margin:0 0 7px;">
${split(`<strong>${e.position}</strong> — ${e.company}`, e.period, 'font-size:9pt;color:#475569;')}
<p style="margin:0;font-size:9pt;color:#475569;">${e.location}</p>
${bullets(e.bullets)}
</div>`)}
<h2 style="${h2}">Educación</h2>
${list(d.education, (e) => split(`<strong>${e.degree}</strong> — ${e.school}`, e.period, 'font-size:9pt;color:#475569;'))}
<h2 style="${h2}">Certificaciones</h2>
${list(d.certs, (c) => `<p style="margin:0 0 1px;">${c}</p>`)}
<h2 style="${h2}">Idiomas</h2>
<p style="margin:0;">${langsInline(d, ', ')}</p>`)
}

// ── 8. Academico ──
function renderAcademico(d: SeedCv): string {
  const h2 = 'font-size:11pt;font-weight:700;font-variant:small-caps;letter-spacing:1.2pt;color:#7f1d1d;margin:12px 0 6px;padding-bottom:2px;border-bottom:1px solid #9ca3af;'
  const entry = (period: string, body: string) => `<div style="display:flex;gap:12px;margin:0 0 6px;">
<p style="flex:0 0 18%;min-width:0;margin:0;padding-top:1px;font-size:9pt;font-style:italic;color:#4b5563;">${period}</p>
<div style="flex:1;min-width:0;">
${body}
</div>
</div>`
  return root('cv-academico', `font-family:${SERIF};line-height:1.4;color:#1e293b;`, `<div style="text-align:center;border-bottom:3px double #334155;padding-bottom:8px;">
<h1 style="font-size:20pt;font-weight:700;color:#0f172a;margin:0;">${d.name}</h1>
<p style="font-size:11pt;font-style:italic;color:#7f1d1d;margin:1px 0 3px;">${d.title}</p>
<p style="font-size:9pt;color:#374151;margin:0;">${contact(d, ' &nbsp;·&nbsp; ')}</p>
</div>
<h2 style="${h2}">Perfil</h2>
<p style="margin:0;text-align:justify;">${d.summary}</p>
<h2 style="${h2}">Formación académica</h2>
${list(d.education, (e) => entry(e.period, `<p style="margin:0;font-weight:700;color:#0f172a;">${e.degree}</p>
<p style="margin:0;font-style:italic;color:#374151;">${e.school}</p>`))}
<h2 style="${h2}">Experiencia</h2>
${list(d.experience, (e) => entry(e.period, `<p style="margin:0;"><strong style="color:#0f172a;">${e.position}</strong>, <em>${e.company}</em>, ${e.location}</p>
${bullets(e.bullets)}`))}
<h2 style="${h2}">Áreas de competencia</h2>
${list(d.skillGroups, (g) => entry(g.label, `<p style="margin:0;">${g.items.join(', ')}</p>`))}
<h2 style="${h2}">Certificaciones</h2>
${bullets(d.certs, 'margin:0 0 0 16px;padding:0;list-style:disc;')}
<h2 style="${h2}">Idiomas</h2>
<p style="margin:0;">${langsInline(d, '; ')}</p>`)
}

// ── 9. Startup ──
function renderStartup(d: SeedCv): string {
  const teal = '#0f766e'
  const h2 = `font-size:10.5pt;font-weight:800;letter-spacing:1.2pt;text-transform:uppercase;color:${teal};margin:12px 0 6px;padding-bottom:2px;border-bottom:1px solid #99f6e4;`
  return root('cv-startup', `font-family:'Segoe UI',${SANS};line-height:1.4;color:#1f2937;`, `<h1 style="font-size:22pt;font-weight:800;color:#0f172a;margin:0;">${d.name}</h1>
<p style="font-size:11pt;font-weight:600;color:${teal};margin:1px 0 4px;">${d.title}</p>
<p style="font-size:9pt;color:#4b5563;margin:0;">${contact(d, ' &nbsp;·&nbsp; ')}</p>
<p style="margin:10px 0 0;padding:7px 0;border-top:3px solid ${teal};border-bottom:1px solid #99f6e4;font-weight:600;color:#0f172a;">${d.summary}</p>
<h2 style="${h2}">Experiencia</h2>
${list(d.experience, (e) => `<div style="margin:0 0 8px;">
${split(`<strong style="color:#0f172a;">${e.position}</strong> · <span style="font-weight:600;color:${teal};">${e.company}</span>`, e.period, 'font-size:9pt;color:#4b5563;')}
<p style="margin:0;font-size:9pt;color:#4b5563;">${e.location}</p>
${bullets(e.bullets)}
</div>`)}
<h2 style="${h2}">Stack y habilidades</h2>
${skillLines(d, `font-weight:700;color:#0f172a;`)}
<div style="display:flex;gap:22px;">
<div style="flex:1;min-width:0;">
<h2 style="${h2}">Educación</h2>
${list(d.education, (e) => `<p style="margin:0;font-weight:700;color:#0f172a;">${e.degree}</p>
<p style="margin:0 0 4px;font-size:9pt;color:#4b5563;">${e.school} · ${e.period}</p>`)}
<h2 style="${h2}">Certificaciones</h2>
${list(d.certs, (c) => `<p style="margin:0 0 1px;">${c}</p>`)}
</div>
<div style="flex:0 0 32%;min-width:0;">
<h2 style="${h2}">Idiomas</h2>
${list(d.languages, (l) => `<p style="margin:0 0 1px;"><strong style="color:#0f172a;">${l.name}</strong> <span style="font-size:9pt;color:#4b5563;">· ${l.level}</span></p>`)}
</div>
</div>`)
}

// ── 10. Lateral ──
function renderLateral(d: SeedCv): string {
  const side = 'font-size:9pt;font-weight:700;letter-spacing:1.5pt;text-transform:uppercase;color:#bae6fd;margin:0 0 5px;padding-bottom:3px;border-bottom:1px solid #475569;'
  const main = 'font-size:10.5pt;font-weight:700;letter-spacing:1.2pt;text-transform:uppercase;color:#0f172a;margin:12px 0 6px;padding-bottom:2px;border-bottom:1.5px solid #0f172a;'
  return root('cv-lateral', `font-family:'Segoe UI',${SANS};line-height:1.4;color:#1f2937;`, `<div style="display:flex;${FULL_HEIGHT}">
<div style="flex:0 0 31%;min-width:0;background:#1e293b;color:#e2e8f0;padding:18px 14px;">
<div style="margin:0 0 13px;">
<h2 style="${side}">Contacto</h2>
${list([d.email, d.phone, d.location, d.linkedin], (c) => `<p style="margin:0 0 2px;font-size:9pt;">${c}</p>`)}
</div>
<div style="margin:0 0 13px;">
<h2 style="${side}">Habilidades</h2>
${list(d.skillGroups, (g) => `<p style="margin:0;font-size:9pt;font-weight:700;color:#ffffff;">${g.label}</p>
<p style="margin:0 0 4px;font-size:9pt;">${g.items.join(', ')}</p>`)}
</div>
<div style="margin:0 0 13px;">
<h2 style="${side}">Educación</h2>
${list(d.education, (e) => `<p style="margin:0;font-size:9.5pt;font-weight:700;color:#ffffff;">${e.degree}</p>
<p style="margin:0 0 3px;font-size:9pt;color:#cbd5e1;">${e.school}<br>${e.period}</p>`)}
</div>
<div style="margin:0 0 13px;">
<h2 style="${side}">Idiomas</h2>
${list(d.languages, (l) => `<p style="margin:0 0 1px;font-size:9pt;">${l.name} – ${l.level}</p>`)}
</div>
<div style="margin:0;">
<h2 style="${side}">Certificaciones</h2>
${list(d.certs, (c) => `<p style="margin:0 0 3px;font-size:9pt;">${c}</p>`)}
</div>
</div>
<div style="flex:1;min-width:0;padding:16px 0 12px 18px;">
<h1 style="font-size:22pt;font-weight:700;color:#0f172a;margin:0;">${d.name}</h1>
<p style="font-size:11pt;font-weight:600;letter-spacing:1pt;text-transform:uppercase;color:#0369a1;margin:2px 0 0;">${d.title}</p>
<h2 style="${main}">Perfil</h2>
<p style="margin:0;">${d.summary}</p>
<h2 style="${main}">Experiencia</h2>
${list(d.experience, (e) => `<div style="margin:0 0 8px;">
${split(`<strong>${e.position}</strong>`, e.period, 'font-size:9pt;color:#4b5563;')}
<p style="margin:0 0 1px;font-size:9.5pt;color:#0369a1;">${e.company} <span style="color:#4b5563;">· ${e.location}</span></p>
${bullets(e.bullets)}
</div>`)}
</div>
</div>`)
}

// ── 11. Europass ──
function renderEuropeo(d: SeedCv): string {
  const blue = '#003399'
  const row = (left: string, right: string, gap = 6) => `<div style="display:flex;gap:14px;margin:0 0 ${gap}px;">
<div style="flex:0 0 24%;min-width:0;text-align:right;">${left}</div>
<div style="flex:1;min-width:0;">
${right}
</div>
</div>`
  const section = (t: string) =>
    row('', `<h2 style="font-size:10.5pt;font-weight:700;text-transform:uppercase;letter-spacing:0.6pt;color:${blue};margin:10px 0 0;padding-bottom:2px;border-bottom:1px solid ${blue};">${t}</h2>`, 5)
  const label = (t: string) => `<p style="margin:0;padding-top:1px;font-size:9pt;color:${blue};">${t}</p>`
  return root('cv-europeo', `font-family:Arial,${SANS};line-height:1.4;color:#1f2937;`, `${row(`<p style="margin:0;font-size:9pt;font-weight:700;letter-spacing:1.5pt;text-transform:uppercase;color:${blue};">Curriculum Vitae</p>`, `<h1 style="font-size:20pt;font-weight:700;color:#111827;margin:0;">${d.name}</h1>
<p style="margin:0;font-size:11pt;color:#374151;">${d.title}</p>`, 4)}
${section('Información personal')}
${row(label('Correo / teléfono'), `<p style="margin:0;">${d.email} &nbsp;|&nbsp; ${d.phone}</p>`, 2)}
${row(label('Dirección'), `<p style="margin:0;">${d.location}</p>`, 2)}
${row(label('LinkedIn'), `<p style="margin:0;">${d.linkedin}</p>`, 2)}
${section('Perfil profesional')}
${row('', `<p style="margin:0;">${d.summary}</p>`)}
${section('Experiencia laboral')}
${list(d.experience, (e) => row(label(e.period), `<p style="margin:0;font-weight:700;color:#111827;">${e.position}</p>
<p style="margin:0 0 1px;font-size:9.5pt;color:${blue};">${e.company} – ${e.location}</p>
${bullets(e.bullets)}`, 7))}
${section('Educación y formación')}
${list(d.education, (e) => row(label(e.period), `<p style="margin:0;font-weight:700;color:#111827;">${e.degree}</p>
<p style="margin:0;font-size:9.5pt;color:${blue};">${e.school}</p>`))}
${list(d.certs, (c) => row(label('Certificación'), `<p style="margin:0;">${c}</p>`, 2))}
${section('Competencias lingüísticas')}
${list(d.languages, (l) => row(label(l.name), `<p style="margin:0;">${l.level}</p>`, 2))}
${section('Competencias digitales y profesionales')}
${list(d.skillGroups, (g) => row(label(g.label), `<p style="margin:0;">${g.items.join(', ')}</p>`, 2))}`)
}

// ── 12. Dark Mode (cabecera oscura sólida, cuerpo blanco imprimible) ──
function renderDark(d: SeedCv): string {
  const violet = '#6d28d9'
  const h2 = `font-size:10.5pt;font-weight:700;letter-spacing:1.4pt;text-transform:uppercase;color:${violet};margin:12px 0 6px;padding-bottom:2px;border-bottom:1px solid #ddd6fe;`
  return root('cv-dark', `font-family:'Segoe UI',${SANS};line-height:1.4;color:#1f2937;`, `<div style="background:#0b1020;color:#e2e8f0;padding:16px 18px;border-bottom:3px solid #8b5cf6;">
<h1 style="font-size:22pt;font-weight:700;color:#ffffff;margin:0;">${d.name}</h1>
<p style="font-size:11pt;font-weight:600;color:#c4b5fd;margin:1px 0 5px;">${d.title}</p>
<p style="font-size:9pt;color:#cbd5e1;margin:0;">${contact(d, ' &nbsp;|&nbsp; ')}</p>
</div>
<p style="margin:11px 0 0;">${d.summary}</p>
<div style="display:flex;gap:20px;">
<div style="flex:1;min-width:0;">
<h2 style="${h2}">Experiencia</h2>
${list(d.experience, (e) => `<div style="margin:0 0 8px;">
${split(`<strong style="color:#0f172a;">${e.position}</strong>`, e.period, 'font-size:9pt;color:#4b5563;')}
<p style="margin:0 0 1px;font-size:9.5pt;color:#0e7490;">${e.company} <span style="color:#4b5563;">· ${e.location}</span></p>
${bullets(e.bullets)}
</div>`)}
</div>
<div style="flex:0 0 32%;min-width:0;">
<h2 style="${h2}">Habilidades</h2>
${list(d.skillGroups, (g) => `<p style="margin:0;font-weight:700;color:#0f172a;">${g.label}</p>
<p style="margin:0 0 4px;">${g.items.join(', ')}</p>`)}
<h2 style="${h2}">Educación</h2>
${list(d.education, (e) => `<p style="margin:0;font-weight:700;color:#0f172a;">${e.degree}</p>
<p style="margin:0 0 3px;font-size:9pt;color:#4b5563;">${e.school}<br>${e.period}</p>`)}
<h2 style="${h2}">Idiomas</h2>
${list(d.languages, (l) => `<p style="margin:0 0 1px;">${l.name} <span style="font-size:9pt;color:#4b5563;">– ${l.level}</span></p>`)}
<h2 style="${h2}">Certificaciones</h2>
${list(d.certs, (c) => `<p style="margin:0 0 3px;font-size:9.5pt;">${c}</p>`)}
</div>
</div>`)
}

// ── 13. Foto Profesional ──
function renderFotoProfesional(d: SeedCv): string {
  const blue = '#1d4ed8'
  const h2 = `font-size:10.5pt;font-weight:700;letter-spacing:1pt;text-transform:uppercase;color:${blue};margin:12px 0 6px;padding-bottom:2px;border-bottom:1.5px solid #bfdbfe;`
  return root('cv-foto-profesional', `font-family:'Segoe UI',${SANS};line-height:1.4;color:#1f2937;`, `<div style="display:flex;align-items:center;gap:16px;padding:0 0 11px;border-bottom:3px solid ${blue};">
<img src="${d.photo}" alt="${d.name}" style="width:30mm;height:30mm;border-radius:50%;object-fit:cover;border:2px solid #dbeafe;flex:0 0 auto;">
<div style="flex:1;min-width:0;">
<h1 style="font-size:22pt;font-weight:700;color:#111827;margin:0;">${d.name}</h1>
<p style="font-size:11pt;font-weight:600;color:${blue};margin:1px 0 5px;">${d.title}</p>
<p style="font-size:9pt;color:#4b5563;margin:0;">${contact(d, ' &nbsp;·&nbsp; ')}</p>
</div>
</div>
<h2 style="${h2}">Perfil profesional</h2>
<p style="margin:0;">${d.summary}</p>
<div style="display:flex;gap:20px;">
<div style="flex:1;min-width:0;">
<h2 style="${h2}">Experiencia</h2>
${list(d.experience, (e) => `<div style="margin:0 0 8px;">
${split(`<strong style="color:#111827;">${e.position}</strong>`, e.period, 'font-size:9pt;color:#4b5563;')}
<p style="margin:0 0 1px;font-size:9.5pt;color:#4b5563;">${e.company} · ${e.location}</p>
${bullets(e.bullets)}
</div>`)}
</div>
<div style="flex:0 0 32%;min-width:0;">
<h2 style="${h2}">Habilidades</h2>
${list(d.skillGroups, (g) => `<p style="margin:0;font-weight:700;color:#111827;">${g.label}</p>
<p style="margin:0 0 4px;">${g.items.join(', ')}</p>`)}
<h2 style="${h2}">Educación</h2>
${list(d.education, (e) => `<p style="margin:0;font-weight:700;">${e.degree}</p>
<p style="margin:0 0 4px;font-size:9pt;color:#4b5563;">${e.school} · ${e.period}</p>`)}
<h2 style="${h2}">Idiomas</h2>
${list(d.languages, (l) => `<p style="margin:0 0 1px;">${l.name} <span style="font-size:9pt;color:#4b5563;">– ${l.level}</span></p>`)}
<h2 style="${h2}">Certificaciones</h2>
${list(d.certs, (c) => `<p style="margin:0 0 3px;font-size:9.5pt;">${c}</p>`)}
</div>
</div>`)
}

// ── 14. Foto Lateral ──
function renderFotoLateral(d: SeedCv): string {
  const side = 'font-size:9pt;font-weight:700;letter-spacing:1.5pt;text-transform:uppercase;color:#ffffff;margin:0 0 5px;padding-bottom:3px;border-bottom:1px solid rgba(255,255,255,0.4);'
  const main = 'font-size:10.5pt;font-weight:700;letter-spacing:1pt;text-transform:uppercase;color:#0f766e;margin:12px 0 6px;padding-bottom:2px;border-bottom:1.5px solid #99f6e4;'
  return root('cv-foto-lateral', `font-family:'Segoe UI',${SANS};line-height:1.4;color:#1f2937;`, `<div style="display:flex;${FULL_HEIGHT}">
<div style="flex:0 0 31%;min-width:0;background:#0f766e;color:#ecfeff;padding:18px 14px;">
<div style="text-align:center;margin:0 0 15px;">
<img src="${d.photo}" alt="${d.name}" style="width:32mm;height:32mm;border-radius:50%;object-fit:cover;border:3px solid #ffffff;display:inline-block;">
</div>
<div style="margin:0 0 13px;">
<h2 style="${side}">Contacto</h2>
${list([d.email, d.phone, d.location, d.linkedin], (c) => `<p style="margin:0 0 2px;font-size:9pt;">${c}</p>`)}
</div>
<div style="margin:0 0 13px;">
<h2 style="${side}">Habilidades</h2>
${list(d.skills, (s) => `<p style="margin:0 0 1px;font-size:9.5pt;">${s}</p>`)}
</div>
<div style="margin:0 0 13px;">
<h2 style="${side}">Idiomas</h2>
${list(d.languages, (l) => `<p style="margin:0 0 1px;font-size:9.5pt;">${l.name} – ${l.level}</p>`)}
</div>
<div style="margin:0;">
<h2 style="${side}">Certificaciones</h2>
${list(d.certs, (c) => `<p style="margin:0 0 3px;font-size:9pt;">${c}</p>`)}
</div>
</div>
<div style="flex:1;min-width:0;padding:16px 0 12px 18px;">
<h1 style="font-size:22pt;font-weight:700;color:#134e4a;margin:0;">${d.name}</h1>
<p style="font-size:11pt;font-weight:600;color:#0d9488;margin:2px 0 0;">${d.title}</p>
<h2 style="${main}">Sobre mí</h2>
<p style="margin:0;">${d.summary}</p>
<h2 style="${main}">Experiencia</h2>
${list(d.experience, (e) => `<div style="margin:0 0 8px;">
${split(`<strong style="color:#134e4a;">${e.position}</strong>`, e.period, 'font-size:9pt;color:#4b5563;')}
<p style="margin:0 0 1px;font-size:9.5pt;color:#0d9488;">${e.company} <span style="color:#4b5563;">· ${e.location}</span></p>
${bullets(e.bullets)}
</div>`)}
<h2 style="${main}">Educación</h2>
${list(d.education, (e) => `${split(`<strong style="color:#134e4a;">${e.degree}</strong>`, e.period, 'font-size:9pt;color:#4b5563;')}
<p style="margin:0 0 3px;font-size:9.5pt;color:#4b5563;">${e.school}</p>`)}
</div>
</div>`)
}

// ── 15. Foto Elegante ──
function renderFotoElegante(d: SeedCv): string {
  const h2 = `font-family:${SERIF};font-size:11pt;font-weight:400;letter-spacing:2pt;text-transform:uppercase;color:#7c2d12;text-align:center;margin:12px 0 6px;padding-bottom:3px;border-bottom:1px solid #e7e5e4;`
  return root('cv-foto-elegante', `font-family:${SERIF};line-height:1.45;color:#292524;`, `<div style="text-align:center;padding:0 0 10px;border-bottom:1px solid #d6d3d1;">
<img src="${d.photo}" alt="${d.name}" style="width:28mm;height:28mm;border-radius:50%;object-fit:cover;border:2px solid #d6a77a;padding:2px;display:inline-block;">
<h1 style="font-size:22pt;font-weight:400;letter-spacing:1pt;color:#1c1917;margin:6px 0 0;">${d.name}</h1>
<p style="font-family:${SANS};font-size:9.5pt;letter-spacing:2.2pt;text-transform:uppercase;color:#a16207;margin:2px 0 5px;">${d.title}</p>
<p style="font-family:${SANS};font-size:9pt;color:#57534e;margin:0;">${contact(d, ' &nbsp;|&nbsp; ')}</p>
</div>
<h2 style="${h2}">Perfil</h2>
<p style="margin:0;text-align:center;font-style:italic;color:#44403c;">${d.summary}</p>
<h2 style="${h2}">Experiencia</h2>
${list(d.experience, (e) => `<div style="margin:0 0 8px;">
${split(`<strong style="color:#1c1917;">${e.position}</strong> <span style="color:#a16207;">· ${e.company}</span>`, e.period, 'font-size:9pt;font-style:italic;color:#78716c;')}
<p style="margin:0 0 1px;font-size:9pt;font-style:italic;color:#78716c;">${e.location}</p>
${bullets(e.bullets)}
</div>`)}
<div style="display:flex;gap:22px;">
<div style="flex:1;min-width:0;">
<h2 style="${h2}">Educación</h2>
${list(d.education, (e) => `<p style="margin:0;font-weight:700;text-align:center;">${e.degree}</p>
<p style="margin:0 0 4px;font-size:9pt;color:#78716c;text-align:center;">${e.school} · ${e.period}</p>`)}
<h2 style="${h2}">Idiomas</h2>
<p style="margin:0;text-align:center;">${langsInline(d)}</p>
</div>
<div style="flex:1;min-width:0;">
<h2 style="${h2}">Habilidades</h2>
<p style="margin:0;text-align:center;">${d.skills.join(' · ')}</p>
<h2 style="${h2}">Certificaciones</h2>
${list(d.certs, (c) => `<p style="margin:0 0 2px;font-size:9.5pt;text-align:center;">${c}</p>`)}
</div>
</div>`)
}

// ── definiciones ──
interface SeedDef {
  /** SEED_VERSION en que se añadió: se instala a quien ya tenía plantillas de una versión anterior. */
  since?: number
  id: string
  name: string
  cls: string
  brief: string
  notes: string[]
  render: (d: SeedCv) => string
}

const COMMON_RULES = `REGLAS DE LA PLANTILLA:
- Devuelve SOLO HTML con estilos inline en cada etiqueta. No uses <style>, markdown ni emojis.
- Es un documento impreso, no una página web: no añadas chips, píldoras, tarjetas con bordes redondeados, sombras, degradados ni iconos.
- Replica fielmente la estructura, colores, tipografías y espaciados del formato. Repite cada bloque (experiencias, educación, habilidades, idiomas, certificaciones) tantas veces como datos tenga el perfil.
- Los textos entre corchetes son marcadores: sustitúyelos por datos reales del perfil. Si el perfil no tiene datos para una sección, bloque o campo (por ejemplo la ciudad de un empleo), elimínalo completo, incluido su título o separador; nunca dejes corchetes en el resultado.
- Si el perfil incluye otras secciones (proyectos, publicaciones, voluntariado), añádelas con el mismo estilo de sección de esta plantilla solo si caben en la página.
- Usa el vocabulario de la vacante solo donde el perfil lo respalde y coloca primero lo más relevante para la vacante.
- Escribe todo el CV, incluidos los títulos de sección, en el mismo idioma de la vacante.`

const PHOTO_NOTE =
  'La foto es parte central del diseño: usa EXACTAMENTE <img src="{{FOTO-PERFIL}}"> donde indica el formato. Si el perfil NO tiene foto ("tieneFoto" ausente), sustituye el <img> por un círculo del mismo tamaño con borde del color de acento y las iniciales del nombre centradas.'

const GROUPS_NOTE = 'Agrupa las habilidades en 2-4 categorías con nombre propio (por ejemplo lenguajes, herramientas, metodologías) usando solo habilidades presentes en el perfil.'

const SEED_DEFS: SeedDef[] = [
  {
    id: 'seed-ats',
    name: 'ATS-Friendly',
    cls: 'cv-ats',
    brief: 'Eres un estratega senior de CVs especializado en sistemas ATS. Genera un CV de una sola columna al estilo Harvard: nombre centrado, contacto en una línea, títulos de sección en mayúsculas con filete negro, y cada empleo con puesto y fechas en una línea y empresa y ciudad en cursiva en la siguiente.',
    notes: [
      'Una sola columna y texto lineal: no uses tablas, columnas ni imágenes.',
      'Cada viñeta de experiencia empieza con un verbo de acción e incluye el resultado cuando el perfil lo aporte.',
      GROUPS_NOTE,
    ],
    render: renderAts,
  },
  {
    id: 'seed-moderno',
    name: 'Moderno',
    cls: 'cv-moderno',
    brief: 'Eres un diseñador de CVs modernos. Genera un CV limpio con el nombre grande, el título en azul y un filete azul bajo el contacto; cada sección lleva una columna estrecha a la izquierda (21%) con fechas o etiquetas en gris y el contenido a la derecha.',
    notes: [
      'Títulos de sección en azul y mayúsculas espaciadas, sin fondos ni bordes adicionales.',
      GROUPS_NOTE,
    ],
    render: renderModerno,
  },
  {
    id: 'seed-tradicional',
    name: 'Tradicional',
    cls: 'cv-tradicional',
    brief: 'Eres un redactor de CVs formales. Genera un CV clásico en tipografía serif: nombre centrado en mayúsculas espaciadas, doble filete bajo la cabecera, títulos de sección centrados, y fechas y ciudades alineadas a la derecha en cursiva.',
    notes: [
      'Tono formal y sobrio, sin colores: solo negro y grises cálidos.',
      'Experiencia en orden cronológico inverso, con texto justificado.',
      GROUPS_NOTE,
    ],
    render: renderTradicional,
  },
  {
    id: 'seed-minimalista',
    name: 'Minimalista',
    cls: 'cv-minimalista',
    brief: 'Eres un diseñador editorial minimalista. Genera un CV de retícula suiza: nombre ligero en mayúsculas espaciadas, y cada sección como una fila con la etiqueta gris pequeña a la izquierda (19%) y el contenido a la derecha, separadas por líneas finas.',
    notes: ['Solo negro, grises y blanco. Sin fondos de color ni iconos.', 'Mucho aire entre filas, sin comprimir los márgenes.', GROUPS_NOTE],
    render: renderMinimalista,
  },
  {
    id: 'seed-ejecutivo',
    name: 'Ejecutivo',
    cls: 'cv-ejecutivo',
    brief: 'Eres un diseñador de CVs de alta dirección. Genera un CV sobrio en azul marino y dorado: tipografía serif, cabecera con barra superior marino y filete dorado, perfil ejecutivo en cursiva con filete dorado a la izquierda, competencias clave en tres columnas de texto y empresas en mayúsculas doradas.',
    notes: [
      'Enfatiza liderazgo, alcance (equipos, presupuestos, mercados) y resultados de negocio que consten en el perfil.',
      'Lenguaje formal y directo, en primera persona implícita.',
    ],
    render: renderEjecutivo,
  },
  {
    id: 'seed-creativo',
    name: 'Creativo',
    cls: 'cv-creativo',
    brief: 'Eres un diseñador de CVs creativos. Genera un CV con barra lateral izquierda de color terracota sólido a toda la altura, con un monograma circular de las iniciales, contacto, habilidades, idiomas y certificaciones; la columna principal lleva el nombre grande, el título en terracota, sobre mí, experiencia y educación.',
    notes: [
      'Conserva el contenedor flex con min-height para que la barra lateral ocupe toda la página.',
      'Si el perfil tiene foto, sustituye el monograma por <img src="{{FOTO-PERFIL}}"> circular del mismo tamaño.',
      'Creativo pero legible: sin tarjetas, píldoras ni iconos.',
    ],
    render: renderCreativo,
  },
  {
    id: 'seed-tecnico',
    name: 'Tecnico',
    cls: 'cv-tecnico',
    brief: 'Eres un diseñador de CVs técnicos. Genera un CV compacto de una columna para perfiles de ingeniería: nombre y título a la izquierda, contacto a la derecha, y una tabla de texto de habilidades técnicas por categoría antes de la experiencia.',
    notes: [
      GROUPS_NOTE,
      'Viñetas breves y concretas: tecnología usada, qué se hizo y resultado.',
    ],
    render: renderTecnico,
  },
  {
    id: 'seed-academico',
    name: 'Academico',
    cls: 'cv-academico',
    brief: 'Eres un redactor de CVs académicos. Genera un CV formal en serif con cabecera centrada, títulos de sección en versalitas color burdeos y entradas a dos columnas: fechas en cursiva a la izquierda (18%) y contenido a la derecha. La formación va antes que la experiencia.',
    notes: [
      'Si el perfil incluye publicaciones, investigación, docencia, becas o ponencias, añade una sección para cada una con la misma estructura de entrada (año a la izquierda).',
      GROUPS_NOTE,
    ],
    render: renderAcademico,
  },
  {
    id: 'seed-startup',
    name: 'Startup',
    cls: 'cv-startup',
    brief: 'Eres un diseñador de CVs para startups. Genera un CV directo de una columna en verde teal: nombre grande, resumen en negrita entre un filete teal grueso y uno fino, títulos de sección teal en mayúsculas y empresas destacadas en teal.',
    notes: [
      'Los logros con cifras van dentro de las viñetas, usando SOLO cifras que aparezcan en el perfil: nunca inventes números.',
      'Lenguaje directo y orientado a resultados; frases cortas.',
      GROUPS_NOTE,
    ],
    render: renderStartup,
  },
  {
    id: 'seed-lateral',
    name: 'Lateral',
    cls: 'cv-lateral',
    brief: 'Eres un diseñador de CVs a dos columnas. Genera un CV con barra lateral izquierda gris pizarra sólida (31%) a toda la altura con contacto, habilidades por categoría, educación, idiomas y certificaciones, y columna principal blanca con nombre, perfil y experiencia.',
    notes: [
      'Conserva el contenedor flex con min-height para que la barra lateral ocupe toda la página.',
      'Si el perfil tiene foto, colócala circular y centrada al inicio de la barra lateral.',
      GROUPS_NOTE,
    ],
    render: renderLateral,
  },
  {
    id: 'seed-europeo',
    name: 'Europass',
    cls: 'cv-europeo',
    brief: 'Eres un redactor de CVs en formato Europass. Genera un CV con la estructura europea estándar: azul institucional (#003399), títulos de sección con filete azul y filas a dos columnas con la etiqueta o las fechas alineadas a la derecha (24%) y el contenido a la derecha.',
    notes: [
      'Usa la nomenclatura Europass en los títulos de sección.',
      'En competencias lingüísticas indica el nivel MCER (A1-C2) solo si el perfil lo aporta.',
      GROUPS_NOTE,
    ],
    render: renderEuropeo,
  },
  {
    id: 'seed-dark',
    name: 'Dark Mode',
    cls: 'cv-dark',
    brief: 'Eres un diseñador de CVs para perfiles tech. Genera un CV con una cabecera azul noche sólida (#0b1020) con filete violeta, y el cuerpo sobre blanco a dos columnas: experiencia a la izquierda; habilidades, educación, idiomas y certificaciones a la derecha (32%), con títulos en violeta y empresas en cian oscuro.',
    notes: [
      'Solo la cabecera es oscura; el resto va sobre fondo blanco para que se pueda imprimir.',
      GROUPS_NOTE,
    ],
    render: renderDark,
  },
  {
    since: 3,
    id: 'seed-foto-profesional',
    name: 'Foto Profesional',
    cls: 'cv-foto-profesional',
    brief: 'Eres un diseñador de CVs profesionales con fotografía. Genera un CV con cabecera que muestra la foto circular a la izquierda junto al nombre, el título en azul y el contacto, separada por una barra azul; debajo el perfil y un cuerpo a dos columnas (experiencia a la izquierda; habilidades por categoría, educación, idiomas y certificaciones a la derecha).',
    notes: [PHOTO_NOTE, 'Conserva el tamaño de la foto (30mm).', GROUPS_NOTE],
    render: renderFotoProfesional,
  },
  {
    since: 3,
    id: 'seed-foto-lateral',
    name: 'Foto Lateral',
    cls: 'cv-foto-lateral',
    brief: 'Eres un diseñador de CVs a dos columnas con fotografía. Genera un CV con barra lateral verde azulado sólida a toda la altura que empieza con la foto circular centrada con borde blanco, seguida de contacto, habilidades, idiomas y certificaciones; la columna principal lleva nombre, título, sobre mí, experiencia y educación.',
    notes: [PHOTO_NOTE, 'Conserva el contenedor flex con min-height para que la barra lateral ocupe toda la página.'],
    render: renderFotoLateral,
  },
  {
    since: 3,
    id: 'seed-foto-elegante',
    name: 'Foto Elegante',
    cls: 'cv-foto-elegante',
    brief: 'Eres un diseñador de CVs elegantes con fotografía. Genera un CV centrado y cálido en serif: foto circular centrada con aro dorado, nombre grande, título en mayúsculas espaciadas color ocre, títulos de sección centrados color burdeos y perfil en cursiva.',
    notes: [PHOTO_NOTE, 'Paleta cálida: negro piedra, ocre (#a16207), burdeos (#7c2d12). Sin fondos de color.'],
    render: renderFotoElegante,
  },
]

function buildPrompt(def: SeedDef): string {
  return `${def.brief}

${def.notes.map((n) => `- ${n}`).join('\n')}

FORMATO (debe comenzar con <div class="${def.cls}">; replica esta estructura):

${def.render(SLOTS)}

${COMMON_RULES}`
}

/** Envuelve un CV en una pagina A4 con los mismos margenes que el PDF final. */
export function wrapHtml(content: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<style>
*{margin:0;padding:0;box-sizing:border-box;max-width:100%}
html,body{background:#fff}
body{padding:9.5mm 10mm;font-family:Calibri,'Segoe UI','Helvetica Neue',Arial,sans-serif;font-size:10pt;line-height:1.4;color:#1a1a1a}
p,li,div,span,h1,h2,h3,td,th{overflow-wrap:anywhere}
</style>
</head>
<body>
${content}
</body>
</html>`
}

export function getSeedTemplates(): CvTemplate[] {
  const now = Date.now()
  return SEED_DEFS.map((def) => ({
    id: def.id,
    name: def.name,
    prompt: buildPrompt(def),
    sampleHtml: wrapHtml(def.render(SAMPLE)),
    createdAt: now,
    updatedAt: now,
    seedVersion: SEED_VERSION,
  }))
}

/**
 * Actualiza las plantillas predeterminadas guardadas a la version actual del diseno.
 * No toca las que el usuario edito (customized), ni sus instrucciones (extraPrompt),
 * ni vuelve a crear las que haya borrado.
 */
export function upgradeSeedTemplates(stored: CvTemplate[]): { templates: CvTemplate[]; changed: boolean } {
  const seeds = new Map(getSeedTemplates().map((s) => [s.id, s]))
  // Versión de diseño más alta instalada: las plantillas nuevas (since > esa versión) se
  // añaden una vez; las que el usuario borró después de instalarlas no se recrean.
  const installedVersion = stored.reduce((max, t) => (t.id.startsWith('seed-') ? Math.max(max, t.seedVersion ?? 1) : max), 0)
  let changed = false
  const templates = stored.map((t) => {
    const seed = seeds.get(t.id)
    if (!seed || t.customized || (t.seedVersion ?? 1) >= SEED_VERSION) return t
    changed = true
    return { ...seed, createdAt: t.createdAt ?? seed.createdAt, extraPrompt: t.extraPrompt }
  })
  const present = new Set(stored.map((t) => t.id))
  for (const def of SEED_DEFS) {
    if (def.since && def.since > installedVersion && !present.has(def.id)) {
      const seed = seeds.get(def.id)
      if (seed) {
        templates.push(seed)
        changed = true
      }
    }
  }
  return { templates, changed }
}
