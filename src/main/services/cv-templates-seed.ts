import type { CvTemplate } from '../../shared/types'

/**
 * Plantillas predeterminadas de CV.
 *
 * Cada plantilla se define con UNA funcion `render` que se usa dos veces:
 *  - con SAMPLE  → la vista previa (sampleHtml) que se ve en el gestor de plantillas
 *  - con SLOTS   → el esqueleto de formato que se incrusta en el prompt del LLM
 * Asi la vista previa y lo que el modelo genera no pueden divergir.
 *
 * Los tamanos respetan LAYOUT_RULES de cv-generator.ts (cuerpo 9.5pt, h1 16pt, h2 11pt).
 * Sube SEED_VERSION al cambiar cualquier diseno: las plantillas guardadas que el usuario
 * no haya editado se actualizan solas (ver upgradeSeedTemplates).
 */
export const SEED_VERSION = 3

interface SeedCv {
  /** src de la foto: avatar de muestra en la vista previa, token {{FOTO-PERFIL}} en el prompt. */
  photo: string
  name: string
  title: string
  email: string
  phone: string
  location: string
  linkedin: string
  summary: string
  skills: string[]
  skillGroups: { label: string; items: string[] }[]
  metrics: { value: string; label: string }[]
  experience: { position: string; company: string; period: string; bullets: string[] }[]
  education: { degree: string; school: string; period: string }[]
  languages: { name: string; level: string }[]
  certs: string[]
}

const SAMPLE_AVATAR = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" fill="#cbd5e1"/><circle cx="60" cy="46" r="22" fill="#f8fafc"/><path d="M18 120c4-26 22-40 42-40s38 14 42 40z" fill="#f8fafc"/></svg>',
)}`

const SAMPLE: SeedCv = {
  photo: SAMPLE_AVATAR,
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
  metrics: [
    { value: '40%', label: 'menos downtime' },
    { value: '60%', label: 'respuesta más rápida' },
    { value: '50k+', label: 'usuarios activos' },
  ],
  experience: [
    {
      position: 'Tech Lead',
      company: 'ACME Corp',
      period: 'Ene 2021 — Presente',
      bullets: [
        'Lideré un equipo de 8 ingenieros en la migración de la infraestructura legacy a microservicios en AWS, reduciendo el downtime en un 40%.',
        'Diseñé una arquitectura GraphQL que unificó 5 APIs REST y mejoró los tiempos de respuesta en un 60%.',
        'Establecí prácticas de revisión de código y mentoría que aceleraron la incorporación de nuevos ingenieros.',
      ],
    },
    {
      position: 'Senior Developer',
      company: 'ACME Corp',
      period: 'Jun 2018 — Dic 2020',
      bullets: [
        'Desarrollé una plataforma React/Node.js con más de 50.000 usuarios activos, con CI/CD y pruebas automatizadas.',
        'Optimicé consultas PostgreSQL críticas, reduciendo los tiempos de carga de 3 s a 200 ms.',
      ],
    },
    {
      position: 'Full Stack Developer',
      company: 'Globex',
      period: 'Feb 2016 — May 2018',
      bullets: [
        'Construí paneles internos y APIs REST en Node.js para los equipos de operaciones y soporte.',
        'Automaticé despliegues con Docker, reduciendo el tiempo de entrega de días a horas.',
      ],
    },
  ],
  education: [{ degree: 'B.S. Computer Science', school: 'Massachusetts Institute of Technology', period: '2012 — 2016' }],
  languages: [
    { name: 'Inglés', level: 'Nativo' },
    { name: 'Español', level: 'Avanzado (C1)' },
  ],
  certs: ['AWS Certified Solutions Architect', 'Professional Scrum Master I'],
}

const SLOTS: SeedCv = {
  photo: '{{FOTO-PERFIL}}',
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
  metrics: [
    { value: '[Cifra]', label: '[Qué mide]' },
    { value: '[Cifra]', label: '[Qué mide]' },
    { value: '[Cifra]', label: '[Qué mide]' },
  ],
  experience: [
    {
      position: '[Puesto]',
      company: '[Empresa]',
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
const bullets = (items: string[], ul = 'margin:2px 0 0 15px;padding:0;list-style:disc;', li = 'margin:0 0 1px;'): string =>
  `<ul style="${ul}">\n${list(items, (b) => `<li style="${li}">${b}</li>`)}\n</ul>`
const root = (cls: string, style: string, inner: string): string =>
  `<div class="${cls}" style="${style}font-size:9.5pt;width:100%;box-sizing:border-box;">\n${inner}\n</div>`

const SANS = `'Segoe UI','Helvetica Neue',Arial,sans-serif`
const SERIF = `Georgia,Cambria,'Times New Roman',serif`
const MONO = `Consolas,'Cascadia Mono','Courier New',monospace`

// ── 1. ATS ──
function renderAts(d: SeedCv): string {
  const h2 = 'font-size:10pt;font-weight:700;color:#0f172a;text-transform:uppercase;letter-spacing:1.2pt;margin:11px 0 5px;padding-bottom:2px;border-bottom:1px solid #94a3b8;'
  return root('cv-ats', `font-family:Calibri,${SANS};line-height:1.45;color:#1f2937;`, `<h1 style="font-size:16pt;font-weight:700;color:#0f172a;letter-spacing:0.2pt;margin:0;">${d.name}</h1>
<p style="font-size:10pt;font-weight:600;color:#1d4ed8;margin:1px 0 3px;">${d.title}</p>
<p style="font-size:8.5pt;color:#475569;margin:0;padding-bottom:7px;border-bottom:2px solid #0f172a;">${contact(d, ' &nbsp;|&nbsp; ')}</p>
<h2 style="${h2}">Resumen profesional</h2>
<p style="margin:0;">${d.summary}</p>
<h2 style="${h2}">Experiencia profesional</h2>
${list(d.experience, (e) => `<div style="margin:0 0 7px;">
<p style="margin:0;font-size:10pt;font-weight:700;color:#0f172a;">${e.position}</p>
<p style="margin:0 0 2px;font-size:8.5pt;color:#475569;"><strong style="color:#1d4ed8;font-weight:600;">${e.company}</strong> &nbsp;|&nbsp; ${e.period}</p>
${bullets(e.bullets)}
</div>`)}
<h2 style="${h2}">Habilidades</h2>
${list(d.skillGroups, (g) => `<p style="margin:0 0 2px;"><strong style="color:#0f172a;">${g.label}:</strong> ${g.items.join(', ')}</p>`)}
<h2 style="${h2}">Educación</h2>
${list(d.education, (e) => `<p style="margin:0 0 2px;"><strong style="color:#0f172a;">${e.degree}</strong> — ${e.school} &nbsp;|&nbsp; ${e.period}</p>`)}
<h2 style="${h2}">Certificaciones</h2>
${bullets(d.certs, 'margin:0 0 0 15px;padding:0;list-style:disc;')}
<h2 style="${h2}">Idiomas</h2>
<p style="margin:0;">${list(d.languages, (l) => `${l.name} (${l.level})`, ', ')}</p>`)
}

// ── 2. Moderno ──
function renderModerno(d: SeedCv): string {
  const h2 = 'font-size:10pt;font-weight:700;color:#0f172a;text-transform:uppercase;letter-spacing:1.2pt;margin:0 0 6px;'
  const bar = '<span style="display:inline-block;width:14px;height:3px;background:#2563eb;border-radius:2px;margin:0 6px 3px 0;"></span>'
  return root('cv-moderno', `font-family:${SANS};line-height:1.5;color:#334155;`, `<div style="background:#0f172a;border-radius:6px;padding:16px 20px;border-bottom:4px solid #3b82f6;">
<h1 style="font-size:16pt;font-weight:700;color:#ffffff;letter-spacing:0.3pt;margin:0;">${d.name}</h1>
<p style="font-size:9.5pt;font-weight:600;color:#93c5fd;text-transform:uppercase;letter-spacing:1.5pt;margin:2px 0 8px;">${d.title}</p>
<p style="font-size:8.5pt;color:#cbd5e1;margin:0;">${contact(d, ' &nbsp;•&nbsp; ')}</p>
</div>
<div style="display:flex;gap:18px;margin-top:14px;">
<div style="flex:1;min-width:0;">
<div style="margin:0 0 12px;">
<h2 style="${h2}">${bar}Perfil</h2>
<p style="margin:0;">${d.summary}</p>
</div>
<h2 style="${h2}">${bar}Experiencia</h2>
${list(d.experience, (e) => `<div style="border-left:2px solid #bfdbfe;padding:0 0 9px 12px;margin-left:4px;">
<p style="margin:0;font-size:10pt;font-weight:700;color:#0f172a;"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#2563eb;margin:0 9px 1px -17px;"></span>${e.position}</p>
<p style="margin:0 0 3px;font-size:8.5pt;color:#64748b;"><strong style="color:#2563eb;">${e.company}</strong> &nbsp;·&nbsp; ${e.period}</p>
${bullets(e.bullets)}
</div>`)}
</div>
<div style="flex:0 0 33%;min-width:0;">
<div style="margin:0 0 12px;">
<h2 style="${h2}">${bar}Habilidades</h2>
<div style="display:flex;flex-wrap:wrap;gap:4px;">
${list(d.skills, (s) => `<span style="background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;border-radius:4px;padding:2px 7px;font-size:8.5pt;font-weight:600;">${s}</span>`)}
</div>
</div>
<div style="margin:0 0 12px;">
<h2 style="${h2}">${bar}Educación</h2>
${list(d.education, (e) => `<p style="margin:0;font-weight:700;color:#0f172a;">${e.degree}</p>
<p style="margin:0 0 4px;font-size:8.5pt;color:#64748b;">${e.school} · ${e.period}</p>`)}
</div>
<div style="margin:0 0 12px;">
<h2 style="${h2}">${bar}Idiomas</h2>
${list(d.languages, (l) => `<div style="display:flex;justify-content:space-between;gap:8px;border-bottom:1px solid #e2e8f0;padding:2px 0;"><span style="font-weight:600;color:#0f172a;">${l.name}</span><span style="font-size:8.5pt;color:#64748b;">${l.level}</span></div>`)}
</div>
<div style="margin:0;">
<h2 style="${h2}">${bar}Certificaciones</h2>
${list(d.certs, (c) => `<p style="margin:0 0 3px;font-size:8.5pt;padding-left:8px;border-left:2px solid #bfdbfe;">${c}</p>`)}
</div>
</div>
</div>`)
}

// ── 3. Tradicional ──
function renderTradicional(d: SeedCv): string {
  const h2 = 'text-align:center;font-size:10pt;font-weight:700;letter-spacing:2.5pt;text-transform:uppercase;color:#1c1917;margin:12px 0 6px;padding-bottom:3px;border-bottom:1px solid #a8a29e;'
  const rowHead = (left: string, right: string) =>
    `<div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px;"><p style="margin:0;font-size:10pt;min-width:0;">${left}</p><p style="margin:0;font-size:8.5pt;font-style:italic;color:#57534e;flex-shrink:0;">${right}</p></div>`
  return root('cv-tradicional', `font-family:Cambria,${SERIF};line-height:1.5;color:#1c1917;`, `<div style="text-align:center;border-bottom:3px double #1c1917;padding-bottom:8px;">
<h1 style="font-size:16pt;font-weight:700;letter-spacing:3pt;text-transform:uppercase;margin:0;">${d.name}</h1>
<p style="font-size:10pt;font-style:italic;color:#44403c;margin:2px 0 4px;">${d.title}</p>
<p style="font-size:8.5pt;color:#57534e;margin:0;">${contact(d, ' &nbsp;·&nbsp; ')}</p>
</div>
<h2 style="${h2}">Perfil profesional</h2>
<p style="margin:0;text-align:justify;">${d.summary}</p>
<h2 style="${h2}">Experiencia profesional</h2>
${list(d.experience, (e) => `<div style="margin:0 0 8px;">
${rowHead(`<strong>${e.position}</strong>, <em>${e.company}</em>`, e.period)}
${bullets(e.bullets, 'margin:2px 0 0 16px;padding:0;list-style:disc;', 'margin:0 0 1px;text-align:justify;')}
</div>`)}
<h2 style="${h2}">Formación académica</h2>
${list(d.education, (e) => rowHead(`<strong>${e.degree}</strong>, <em>${e.school}</em>`, e.period))}
<h2 style="${h2}">Competencias</h2>
${list(d.skillGroups, (g) => `<p style="margin:0 0 2px;"><strong>${g.label}:</strong> ${g.items.join(', ')}</p>`)}
<h2 style="${h2}">Certificaciones e idiomas</h2>
<p style="margin:0 0 2px;"><strong>Certificaciones:</strong> ${d.certs.join(' · ')}</p>
<p style="margin:0;"><strong>Idiomas:</strong> ${list(d.languages, (l) => `${l.name} (${l.level})`, ' · ')}</p>`)
}

// ── 4. Minimalista ──
function renderMinimalista(d: SeedCv): string {
  const row = (label: string, body: string) => `<div style="display:flex;gap:16px;border-top:1px solid #e5e5e5;margin-top:12px;padding-top:11px;">
<h2 style="flex:0 0 20%;min-width:0;font-size:7.5pt;font-weight:600;letter-spacing:2pt;text-transform:uppercase;color:#a3a3a3;margin:2px 0 0;">${label}</h2>
<div style="flex:1;min-width:0;">
${body}
</div>
</div>`
  return root('cv-minimalista', `font-family:${SANS};line-height:1.55;color:#404040;`, `<h1 style="font-size:16pt;font-weight:300;letter-spacing:4pt;text-transform:uppercase;color:#0a0a0a;margin:0;">${d.name}</h1>
<p style="font-size:8.5pt;letter-spacing:2pt;text-transform:uppercase;color:#737373;margin:3px 0 0;">${d.title}</p>
<p style="font-size:8.5pt;color:#737373;margin:8px 0 0;">${contact(d, ' &nbsp;/&nbsp; ')}</p>
${row('Perfil', `<p style="margin:0;">${d.summary}</p>`)}
${row('Experiencia', list(d.experience, (e) => `<div style="margin:0 0 9px;">
<p style="margin:0;font-weight:600;color:#0a0a0a;">${e.position} <span style="font-weight:400;color:#737373;">— ${e.company}</span></p>
<p style="margin:0 0 3px;font-size:8pt;letter-spacing:0.5pt;color:#a3a3a3;">${e.period}</p>
${bullets(e.bullets, 'margin:0 0 0 14px;padding:0;list-style:disc;color:#525252;')}
</div>`))}
${row('Habilidades', `<p style="margin:0;">${d.skills.join(' &nbsp;·&nbsp; ')}</p>`)}
${row('Educación', list(d.education, (e) => `<p style="margin:0;font-weight:600;color:#0a0a0a;">${e.degree}</p>
<p style="margin:0;font-size:8.5pt;color:#737373;">${e.school} — ${e.period}</p>`))}
${row('Idiomas', `<p style="margin:0;">${list(d.languages, (l) => `${l.name} <span style="color:#a3a3a3;">${l.level}</span>`, ' &nbsp;·&nbsp; ')}</p>`)}
${row('Certificaciones', list(d.certs, (c) => `<p style="margin:0;">${c}</p>`))}`)
}

// ── 5. Ejecutivo ──
function renderEjecutivo(d: SeedCv): string {
  const h2 = (t: string) =>
    `<h2 style="display:flex;align-items:center;gap:10px;font-size:10.5pt;font-weight:700;color:#0f1e3d;letter-spacing:1.5pt;text-transform:uppercase;margin:13px 0 7px;">${t}<span style="flex:1;height:1px;background:#d6c9a8;"></span></h2>`
  const sq = '<span style="display:inline-block;width:5px;height:5px;background:#b8923a;margin:0 7px 1.5px 0;"></span>'
  return root('cv-ejecutivo', `font-family:${SERIF};line-height:1.5;color:#1f2937;`, `<div style="border-top:5px solid #0f1e3d;border-bottom:1px solid #b8923a;padding:12px 0 10px;display:flex;justify-content:space-between;align-items:flex-end;gap:16px;">
<div style="min-width:0;">
<h1 style="font-size:16pt;font-weight:700;color:#0f1e3d;letter-spacing:0.5pt;margin:0;">${d.name}</h1>
<p style="font-family:${SANS};font-size:8.5pt;font-weight:600;letter-spacing:2.5pt;text-transform:uppercase;color:#b8923a;margin:3px 0 0;">${d.title}</p>
</div>
<div style="text-align:right;font-family:${SANS};font-size:8.5pt;color:#475569;line-height:1.45;flex-shrink:0;max-width:45%;">
<p style="margin:0;">${d.email}</p>
<p style="margin:0;">${d.phone}</p>
<p style="margin:0;">${d.location} · ${d.linkedin}</p>
</div>
</div>
<div style="background:#f8f5ee;border-left:3px solid #b8923a;padding:9px 13px;margin:12px 0 0;">
<p style="margin:0;font-style:italic;color:#334155;">${d.summary}</p>
</div>
${h2('Competencias clave')}
<div style="display:flex;flex-wrap:wrap;">
${list(d.skills, (s) => `<p style="flex:0 0 33.33%;min-width:0;margin:0 0 3px;padding-right:8px;font-family:${SANS};font-size:9pt;color:#0f1e3d;">${sq}${s}</p>`)}
</div>
${h2('Trayectoria profesional')}
${list(d.experience, (e) => `<div style="margin:0 0 9px;">
<div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px;"><p style="margin:0;font-size:10pt;font-weight:700;color:#0f1e3d;min-width:0;">${e.position}</p><p style="margin:0;font-family:${SANS};font-size:8.5pt;color:#64748b;flex-shrink:0;">${e.period}</p></div>
<p style="margin:0 0 2px;font-family:${SANS};font-size:8pt;font-weight:700;letter-spacing:1.5pt;text-transform:uppercase;color:#b8923a;">${e.company}</p>
${bullets(e.bullets, 'margin:2px 0 0 15px;padding:0;list-style:square;')}
</div>`)}
<div style="display:flex;gap:20px;">
<div style="flex:1;min-width:0;">
${h2('Formación')}
${list(d.education, (e) => `<p style="margin:0;font-weight:700;color:#0f1e3d;">${e.degree}</p>
<p style="margin:0 0 3px;font-family:${SANS};font-size:8.5pt;color:#64748b;">${e.school} · ${e.period}</p>`)}
${list(d.certs, (c) => `<p style="margin:0 0 1px;font-family:${SANS};font-size:8.5pt;color:#334155;">${sq}${c}</p>`)}
</div>
<div style="flex:0 0 34%;min-width:0;">
${h2('Idiomas')}
${list(d.languages, (l) => `<p style="margin:0 0 2px;"><strong style="color:#0f1e3d;">${l.name}</strong> <span style="font-family:${SANS};font-size:8.5pt;color:#64748b;">— ${l.level}</span></p>`)}
</div>
</div>`)
}

// ── 6. Creativo ──
function renderCreativo(d: SeedCv): string {
  const h2 = 'font-size:8.5pt;font-weight:800;letter-spacing:1.8pt;text-transform:uppercase;color:#7c3aed;margin:0 0 5px;'
  const pill = (s: string, i: number) =>
    i % 2 === 0
      ? `<span style="background:#ffffff;color:#be123c;border:1px solid #fda4af;border-radius:20px;padding:1px 9px;font-size:8.5pt;font-weight:600;">${s}</span>`
      : `<span style="background:#ffffff;color:#6d28d9;border:1px solid #c4b5fd;border-radius:20px;padding:1px 9px;font-size:8.5pt;font-weight:600;">${s}</span>`
  return root('cv-creativo', `font-family:'Trebuchet MS',${SANS};line-height:1.5;color:#3f3f46;`, `<div style="height:6px;border-radius:3px;background:linear-gradient(90deg,#f43f5e,#a855f7,#6366f1);margin:0 0 12px;"></div>
<h1 style="font-size:16pt;font-weight:800;color:#18181b;margin:0;">${d.name}</h1>
<p style="font-size:10pt;font-weight:700;color:#e11d48;margin:1px 0 12px;">${d.title}</p>
<div style="display:flex;gap:16px;">
<div style="flex:0 0 34%;min-width:0;background:#faf5ff;border-radius:12px;padding:13px;">
<div style="margin:0 0 12px;">
<h2 style="${h2}">Contacto</h2>
${list([d.email, d.phone, d.location, d.linkedin], (c) => `<p style="margin:0 0 1px;font-size:8.5pt;">${c}</p>`)}
</div>
<div style="margin:0 0 12px;">
<h2 style="${h2}">Habilidades</h2>
<div style="display:flex;flex-wrap:wrap;gap:4px;">
${list(d.skills, pill)}
</div>
</div>
<div style="margin:0 0 12px;">
<h2 style="${h2}">Educación</h2>
${list(d.education, (e) => `<p style="margin:0;font-weight:700;color:#18181b;">${e.degree}</p>
<p style="margin:0 0 3px;font-size:8.5pt;color:#71717a;">${e.school}<br>${e.period}</p>`)}
</div>
<div style="margin:0 0 12px;">
<h2 style="${h2}">Idiomas</h2>
${list(d.languages, (l) => `<p style="margin:0 0 1px;"><strong style="color:#18181b;">${l.name}</strong> <span style="font-size:8.5pt;color:#71717a;">· ${l.level}</span></p>`)}
</div>
<div style="margin:0;">
<h2 style="${h2}">Certificaciones</h2>
${list(d.certs, (c) => `<p style="margin:0 0 2px;font-size:8.5pt;">${c}</p>`)}
</div>
</div>
<div style="flex:1;min-width:0;">
<p style="margin:0 0 12px;color:#27272a;border-left:3px solid #f43f5e;padding-left:10px;">${d.summary}</p>
<h2 style="${h2}">Experiencia</h2>
${list(d.experience, (e, i) => `<div style="border:1px solid #e4e4e7;border-left:4px solid ${i % 2 === 0 ? '#f43f5e' : '#a855f7'};border-radius:8px;padding:8px 12px;margin:0 0 8px;">
<p style="margin:0;font-size:10pt;font-weight:800;color:#18181b;">${e.position}</p>
<p style="margin:0 0 3px;font-size:8.5pt;color:#71717a;"><strong style="color:${i % 2 === 0 ? '#e11d48' : '#7c3aed'};">${e.company}</strong> · ${e.period}</p>
${bullets(e.bullets)}
</div>`)}
</div>
</div>`)
}

// ── 7. Tecnico ──
function renderTecnico(d: SeedCv): string {
  const h2 = (t: string) =>
    `<h2 style="font-family:${MONO};font-size:9pt;font-weight:700;color:#0f172a;letter-spacing:1pt;text-transform:uppercase;margin:12px 0 6px;"><span style="color:#0284c7;">//</span> ${t}</h2>`
  return root('cv-tecnico', `font-family:${SANS};line-height:1.45;color:#1e293b;`, `<div style="display:flex;justify-content:space-between;align-items:flex-end;gap:12px;border-bottom:2px solid #0f172a;padding-bottom:7px;">
<div style="min-width:0;">
<h1 style="font-size:16pt;font-weight:700;color:#0f172a;margin:0;">${d.name}</h1>
<p style="font-family:${MONO};font-size:9pt;color:#0369a1;margin:1px 0 0;">&gt; ${d.title}</p>
</div>
<p style="font-family:${MONO};font-size:8pt;color:#475569;text-align:right;line-height:1.5;margin:0;flex-shrink:0;max-width:55%;">${d.email}<br>${d.phone} · ${d.location}<br>${d.linkedin}</p>
</div>
<p style="margin:9px 0 0;">${d.summary}</p>
${h2('Stack técnico')}
<div style="border:1px solid #cbd5e1;border-radius:5px;background:#f8fafc;padding:2px 10px;">
${list(d.skillGroups, (g, i) => `<div style="display:flex;gap:10px;padding:4px 0;${i > 0 ? 'border-top:1px dashed #cbd5e1;' : ''}">
<p style="flex:0 0 22%;min-width:0;font-family:${MONO};font-size:8pt;font-weight:700;color:#0369a1;text-transform:uppercase;margin:2px 0 0;">${g.label}</p>
<div style="flex:1;min-width:0;display:flex;flex-wrap:wrap;gap:3px;">
${list(g.items, (s) => `<span style="font-family:${MONO};font-size:8pt;background:#e2e8f0;color:#0f172a;border-radius:3px;padding:1px 6px;">${s}</span>`)}
</div>
</div>`)}
</div>
${h2('Experiencia')}
${list(d.experience, (e) => `<div style="margin:0 0 7px;">
<div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px;"><p style="margin:0;font-size:10pt;font-weight:700;color:#0f172a;min-width:0;">${e.position} <span style="font-weight:400;color:#475569;">@ ${e.company}</span></p><p style="margin:0;font-family:${MONO};font-size:8pt;color:#64748b;flex-shrink:0;">${e.period}</p></div>
${bullets(e.bullets, 'margin:2px 0 0 15px;padding:0;list-style:square;')}
</div>`)}
<div style="display:flex;gap:18px;">
<div style="flex:1;min-width:0;">
${h2('Educación')}
${list(d.education, (e) => `<p style="margin:0;font-weight:700;color:#0f172a;">${e.degree}</p>
<p style="margin:0 0 3px;font-size:8.5pt;color:#64748b;">${e.school} · ${e.period}</p>`)}
</div>
<div style="flex:1;min-width:0;">
${h2('Certificaciones')}
${list(d.certs, (c) => `<p style="margin:0 0 1px;font-size:8.5pt;">${c}</p>`)}
</div>
<div style="flex:0 0 24%;min-width:0;">
${h2('Idiomas')}
${list(d.languages, (l) => `<p style="margin:0 0 1px;font-size:8.5pt;"><strong>${l.name}</strong> — ${l.level}</p>`)}
</div>
</div>`)
}

// ── 8. Academico ──
function renderAcademico(d: SeedCv): string {
  const h2 = 'font-size:10.5pt;font-weight:700;font-variant:small-caps;letter-spacing:1.5pt;color:#7f1d1d;margin:12px 0 6px;padding-bottom:2px;border-bottom:1px solid #cbd5e1;'
  const entry = (period: string, body: string) => `<div style="display:flex;gap:12px;margin:0 0 7px;">
<p style="flex:0 0 17%;min-width:0;margin:0;padding-top:1px;font-size:8.5pt;font-style:italic;color:#64748b;">${period}</p>
<div style="flex:1;min-width:0;">
${body}
</div>
</div>`
  return root('cv-academico', `font-family:${SERIF};line-height:1.5;color:#1e293b;`, `<div style="display:flex;justify-content:space-between;align-items:flex-end;gap:16px;border-bottom:3px double #334155;padding-bottom:8px;">
<div style="min-width:0;">
<h1 style="font-size:16pt;font-weight:700;color:#0f172a;margin:0;">${d.name}</h1>
<p style="font-size:10pt;font-style:italic;color:#7f1d1d;margin:1px 0 0;">${d.title}</p>
</div>
<div style="text-align:right;font-family:${SANS};font-size:8.5pt;color:#475569;line-height:1.45;flex-shrink:0;max-width:45%;">
<p style="margin:0;">${d.email} · ${d.phone}</p>
<p style="margin:0;">${d.location}</p>
<p style="margin:0;">${d.linkedin}</p>
</div>
</div>
<h2 style="${h2}">Perfil</h2>
<p style="margin:0;text-align:justify;">${d.summary}</p>
<h2 style="${h2}">Formación académica</h2>
${list(d.education, (e) => entry(e.period, `<p style="margin:0;font-weight:700;color:#0f172a;">${e.degree}</p>
<p style="margin:0;color:#475569;">${e.school}</p>`))}
<h2 style="${h2}">Experiencia</h2>
${list(d.experience, (e) => entry(e.period, `<p style="margin:0;"><strong style="color:#0f172a;">${e.position}</strong>, <em>${e.company}</em></p>
${bullets(e.bullets)}`))}
<h2 style="${h2}">Áreas de competencia</h2>
${list(d.skillGroups, (g) => entry(g.label, `<p style="margin:0;">${g.items.join(', ')}</p>`))}
<h2 style="${h2}">Certificaciones</h2>
${bullets(d.certs, 'margin:0 0 0 15px;padding:0;list-style:disc;')}
<h2 style="${h2}">Idiomas</h2>
<p style="margin:0;">${list(d.languages, (l) => `<strong>${l.name}</strong> (${l.level})`, ' &nbsp;·&nbsp; ')}</p>`)
}

// ── 9. Startup ──
function renderStartup(d: SeedCv): string {
  const h2 = (t: string) =>
    `<h2 style="margin:12px 0 7px;font-size:8.5pt;font-weight:700;line-height:1.3;"><span style="display:inline-block;background:#0d9488;color:#ffffff;border-radius:20px;padding:2px 11px;letter-spacing:1.2pt;text-transform:uppercase;">${t}</span></h2>`
  return root('cv-startup', `font-family:${SANS};line-height:1.5;color:#334155;`, `<div style="background:#042f2e;border-radius:10px;padding:15px 18px;display:flex;justify-content:space-between;align-items:center;gap:14px;">
<div style="min-width:0;">
<h1 style="font-size:16pt;font-weight:800;color:#ffffff;margin:0;">${d.name}</h1>
<p style="font-size:10pt;font-weight:600;color:#5eead4;margin:1px 0 0;">${d.title}</p>
</div>
<div style="text-align:right;font-size:8.5pt;color:#ccfbf1;line-height:1.5;flex-shrink:0;max-width:50%;">
<p style="margin:0;">${d.email}</p>
<p style="margin:0;">${d.phone} · ${d.location}</p>
<p style="margin:0;">${d.linkedin}</p>
</div>
</div>
<p style="margin:11px 0;font-weight:600;color:#0f172a;">${d.summary}</p>
<div style="display:flex;gap:8px;">
${list(d.metrics, (m) => `<div style="flex:1;min-width:0;background:#f0fdfa;border:1px solid #99f6e4;border-radius:8px;padding:7px 10px;text-align:center;">
<p style="margin:0;font-size:14pt;font-weight:800;line-height:1.15;color:#0d9488;">${m.value}</p>
<p style="margin:1px 0 0;font-size:8pt;color:#475569;">${m.label}</p>
</div>`)}
</div>
${h2('Impacto')}
${list(d.experience, (e) => `<div style="margin:0 0 8px;">
<div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px;"><p style="margin:0;font-size:10pt;font-weight:800;color:#0f172a;min-width:0;">${e.position} <span style="font-weight:600;color:#0d9488;">@ ${e.company}</span></p><p style="margin:0;font-size:8pt;color:#64748b;background:#f1f5f9;border-radius:20px;padding:0 8px;flex-shrink:0;">${e.period}</p></div>
${bullets(e.bullets)}
</div>`)}
${h2('Stack')}
<div style="display:flex;flex-wrap:wrap;gap:4px;">
${list(d.skills, (s) => `<span style="background:#f0fdfa;color:#0f766e;border:1px solid #99f6e4;border-radius:20px;padding:1px 10px;font-size:8.5pt;font-weight:600;">${s}</span>`)}
</div>
<div style="display:flex;gap:18px;">
<div style="flex:1;min-width:0;">
${h2('Educación')}
${list(d.education, (e) => `<p style="margin:0;font-weight:700;color:#0f172a;">${e.degree}</p>
<p style="margin:0 0 3px;font-size:8.5pt;color:#64748b;">${e.school} · ${e.period}</p>`)}
${list(d.certs, (c) => `<p style="margin:0 0 1px;font-size:8.5pt;">${c}</p>`)}
</div>
<div style="flex:0 0 34%;min-width:0;">
${h2('Idiomas')}
${list(d.languages, (l) => `<p style="margin:0 0 1px;"><strong style="color:#0f172a;">${l.name}</strong> <span style="font-size:8.5pt;color:#64748b;">· ${l.level}</span></p>`)}
</div>
</div>`)
}

// ── 10. Lateral ──
function renderLateral(d: SeedCv): string {
  const side = 'font-size:8.5pt;font-weight:700;letter-spacing:2pt;text-transform:uppercase;color:#7dd3fc;margin:0 0 6px;padding-bottom:3px;border-bottom:1px solid #334155;'
  const main = 'font-size:10pt;font-weight:700;letter-spacing:1.5pt;text-transform:uppercase;color:#0f172a;margin:0 0 6px;padding-bottom:3px;border-bottom:2px solid #0f172a;'
  return root('cv-lateral', `font-family:${SANS};line-height:1.5;color:#334155;`, `<div style="display:flex;min-height:262mm;">
<div style="flex:0 0 32%;min-width:0;background:#1e293b;color:#e2e8f0;padding:18px 14px;border-radius:6px 0 0 6px;">
<div style="margin:0 0 14px;">
<h2 style="${side}">Contacto</h2>
${list([d.email, d.phone, d.location, d.linkedin], (c) => `<p style="margin:0 0 2px;font-size:8.5pt;color:#e2e8f0;">${c}</p>`)}
</div>
<div style="margin:0 0 14px;">
<h2 style="${side}">Habilidades</h2>
<div style="display:flex;flex-wrap:wrap;gap:4px;">
${list(d.skills, (s) => `<span style="background:#334155;color:#f1f5f9;border-radius:3px;padding:1px 7px;font-size:8.5pt;">${s}</span>`)}
</div>
</div>
<div style="margin:0 0 14px;">
<h2 style="${side}">Educación</h2>
${list(d.education, (e) => `<p style="margin:0;font-weight:700;color:#ffffff;">${e.degree}</p>
<p style="margin:0 0 3px;font-size:8.5pt;color:#94a3b8;">${e.school}<br>${e.period}</p>`)}
</div>
<div style="margin:0 0 14px;">
<h2 style="${side}">Idiomas</h2>
${list(d.languages, (l) => `<p style="margin:0 0 2px;color:#ffffff;">${l.name} <span style="font-size:8.5pt;color:#94a3b8;">— ${l.level}</span></p>`)}
</div>
<div style="margin:0;">
<h2 style="${side}">Certificaciones</h2>
${list(d.certs, (c) => `<p style="margin:0 0 3px;font-size:8.5pt;color:#e2e8f0;">${c}</p>`)}
</div>
</div>
<div style="flex:1;min-width:0;padding:18px 0 18px 18px;">
<h1 style="font-size:16pt;font-weight:700;color:#0f172a;margin:0;">${d.name}</h1>
<p style="font-size:9.5pt;font-weight:600;letter-spacing:1.5pt;text-transform:uppercase;color:#0369a1;margin:2px 0 0;">${d.title}</p>
<div style="width:36px;height:3px;background:#0ea5e9;margin:9px 0 12px;"></div>
<div style="margin:0 0 14px;">
<h2 style="${main}">Perfil</h2>
<p style="margin:0;">${d.summary}</p>
</div>
<h2 style="${main}">Experiencia</h2>
${list(d.experience, (e) => `<div style="margin:0 0 9px;">
<p style="margin:0;font-size:10pt;font-weight:700;color:#0f172a;">${e.position}</p>
<p style="margin:0 0 2px;font-size:8.5pt;color:#64748b;"><strong style="color:#0369a1;">${e.company}</strong> &nbsp;|&nbsp; ${e.period}</p>
${bullets(e.bullets)}
</div>`)}
</div>
</div>`)
}

// ── 11. Europass ──
function renderEuropeo(d: SeedCv): string {
  const row = (left: string, right: string, gap = 6) => `<div style="display:flex;gap:14px;margin:0 0 ${gap}px;">
<div style="flex:0 0 25%;min-width:0;text-align:right;">${left}</div>
<div style="flex:1;min-width:0;border-left:1px solid #b6c6e6;padding-left:14px;">
${right}
</div>
</div>`
  const section = (t: string) =>
    `<h2 style="font-size:9pt;font-weight:700;letter-spacing:0.8pt;text-transform:uppercase;color:#003399;margin:11px 0 6px;padding:3px 8px;background:#eef2fb;border-left:3px solid #ffcc00;">${t}</h2>`
  const label = (t: string) => `<p style="margin:0;padding-top:1px;font-size:8.5pt;color:#003399;">${t}</p>`
  return root('cv-europeo', `font-family:Arial,${SANS};line-height:1.45;color:#1f2937;`, `<div style="border-bottom:3px solid #003399;padding-bottom:8px;">
<p style="margin:0;font-size:8pt;font-weight:700;letter-spacing:2.5pt;text-transform:uppercase;color:#003399;">Curriculum Vitae</p>
<h1 style="font-size:16pt;font-weight:700;color:#003399;margin:1px 0 0;">${d.name}</h1>
<p style="margin:0;font-size:10pt;color:#475569;">${d.title}</p>
</div>
${section('Información personal')}
${row(label('Contacto'), `<p style="margin:0;">${d.email} &nbsp;|&nbsp; ${d.phone}</p>
<p style="margin:0;">${d.location} &nbsp;|&nbsp; ${d.linkedin}</p>`)}
${row(label('Perfil'), `<p style="margin:0;">${d.summary}</p>`)}
${section('Experiencia laboral')}
${list(d.experience, (e) => row(label(e.period), `<p style="margin:0;font-weight:700;color:#0f172a;">${e.position}</p>
<p style="margin:0 0 2px;font-size:8.5pt;color:#003399;">${e.company}</p>
${bullets(e.bullets)}`, 8))}
${section('Educación y formación')}
${list(d.education, (e) => row(label(e.period), `<p style="margin:0;font-weight:700;color:#0f172a;">${e.degree}</p>
<p style="margin:0;font-size:8.5pt;color:#003399;">${e.school}</p>`))}
${list(d.certs, (c) => row(label('Certificación'), `<p style="margin:0;">${c}</p>`, 3))}
${section('Competencias')}
${list(d.skillGroups, (g) => row(label(g.label), `<p style="margin:0;">${g.items.join(', ')}</p>`, 4))}
${section('Competencias lingüísticas')}
${list(d.languages, (l) => row(label(l.name), `<p style="margin:0;font-weight:700;color:#0f172a;">${l.level}</p>`, 3))}`)
}

// ── 12. Dark Mode ──
function renderDark(d: SeedCv): string {
  const h2 = (t: string, color: string) =>
    `<h2 style="font-size:8.5pt;font-weight:700;letter-spacing:2pt;text-transform:uppercase;color:${color};margin:0 0 7px;">${t}</h2>`
  const card = 'background:#131a2e;border:1px solid #232c48;border-radius:8px;padding:11px 13px;margin:0 0 9px;'
  const chip = (s: string, i: number) =>
    `<span style="border:1px solid ${i % 2 === 0 ? '#8b5cf6' : '#22d3ee'};color:${i % 2 === 0 ? '#c4b5fd' : '#a5f3fc'};border-radius:4px;padding:1px 7px;font-size:8.5pt;">${s}</span>`
  return root('cv-dark', `font-family:${SANS};line-height:1.5;color:#cbd5e1;`, `<div style="background:#0b1020;border-radius:10px;padding:20px;min-height:262mm;">
<h1 style="font-size:16pt;font-weight:700;color:#ffffff;margin:0;">${d.name}</h1>
<p style="font-size:10pt;font-weight:600;color:#a78bfa;margin:1px 0 5px;">${d.title}</p>
<p style="font-family:${MONO};font-size:8pt;color:#94a3b8;margin:0;">${contact(d, ' &nbsp;|&nbsp; ')}</p>
<div style="height:2px;background:linear-gradient(90deg,#8b5cf6,#22d3ee,#0b1020);margin:11px 0 12px;"></div>
<p style="margin:0 0 13px;color:#e2e8f0;">${d.summary}</p>
<div style="display:flex;gap:12px;">
<div style="flex:1;min-width:0;">
${h2('Experiencia', '#22d3ee')}
${list(d.experience, (e, i) => `<div style="${card}border-left:3px solid ${i % 2 === 0 ? '#8b5cf6' : '#22d3ee'};">
<p style="margin:0;font-size:10pt;font-weight:700;color:#ffffff;">${e.position}</p>
<p style="margin:0 0 3px;font-size:8.5pt;color:#94a3b8;"><strong style="color:#67e8f9;">${e.company}</strong> · ${e.period}</p>
${bullets(e.bullets, 'margin:2px 0 0 15px;padding:0;list-style:disc;color:#cbd5e1;')}
</div>`)}
</div>
<div style="flex:0 0 33%;min-width:0;">
<div style="${card}">
${h2('Skills', '#a78bfa')}
<div style="display:flex;flex-wrap:wrap;gap:4px;">
${list(d.skills, chip)}
</div>
</div>
<div style="${card}">
${h2('Educación', '#a78bfa')}
${list(d.education, (e) => `<p style="margin:0;font-weight:700;color:#ffffff;">${e.degree}</p>
<p style="margin:0 0 3px;font-size:8.5pt;color:#94a3b8;">${e.school}<br>${e.period}</p>`)}
</div>
<div style="${card}">
${h2('Idiomas', '#a78bfa')}
${list(d.languages, (l) => `<p style="margin:0 0 1px;color:#ffffff;">${l.name} <span style="font-size:8.5pt;color:#94a3b8;">— ${l.level}</span></p>`)}
</div>
<div style="${card}">
${h2('Certificaciones', '#a78bfa')}
${list(d.certs, (c) => `<p style="margin:0 0 3px;font-size:8.5pt;color:#cbd5e1;">${c}</p>`)}
</div>
</div>
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
- Replica fielmente la estructura, colores, tipografías y espaciados del formato. Repite cada bloque (experiencias, habilidades, educación, idiomas, certificaciones) tantas veces como datos tenga el perfil.
- Los textos entre corchetes son marcadores: sustitúyelos por datos reales del perfil. Si el perfil no tiene datos para una sección o bloque, elimínalo completo, incluido su título; nunca dejes corchetes en el resultado.
- Si el perfil incluye otras secciones (proyectos, publicaciones, voluntariado), añádelas con el mismo estilo de sección de esta plantilla.
- Usa el vocabulario de la vacante solo donde el perfil lo respalde y coloca primero lo más relevante para la vacante.
- Escribe todo el CV, incluidos los títulos de sección, en el mismo idioma de la vacante.`

const PHOTO_NOTE =
  'La foto es parte central del diseño: usa EXACTAMENTE <img src="{{FOTO-PERFIL}}"> donde indica el formato. Si el perfil NO tiene foto ("tieneFoto" ausente), sustituye el <img> por un círculo del mismo tamaño y color de acento con las iniciales del nombre centradas.'

const GROUPS_NOTE = 'Agrupa las habilidades en 2-4 categorías con nombre propio (por ejemplo lenguajes, herramientas, metodologías) usando solo habilidades presentes en el perfil.'

const SEED_DEFS: SeedDef[] = [
  {
    id: 'seed-ats',
    name: 'ATS-Friendly',
    cls: 'cv-ats',
    brief: 'Eres un estratega senior de CVs especializado en sistemas ATS. Genera un CV de una sola columna, 100% texto real y lineal, que un ATS pueda leer sin errores y que aun así se vea cuidado: nombre fuerte, título en azul, títulos de sección en mayúsculas espaciadas con filete.',
    notes: [
      'Una sola columna: no uses tablas, columnas, flex ni imágenes decorativas.',
      'Cada viñeta de experiencia empieza con un verbo de acción e incluye el resultado cuando el perfil lo aporte.',
      GROUPS_NOTE,
    ],
    render: renderAts,
  },
  {
    id: 'seed-moderno',
    name: 'Moderno',
    cls: 'cv-moderno',
    brief: 'Eres un diseñador de CVs modernos. Genera un CV con cabecera azul marino, cuerpo a dos columnas (experiencia con línea de tiempo a la izquierda; habilidades, educación, idiomas y certificaciones a la derecha) y acentos azules.',
    notes: [
      'La columna principal lleva perfil y experiencia; la columna derecha (33%) lleva los datos cortos.',
      'Cada experiencia mantiene el punto azul y la línea vertical de la línea de tiempo.',
    ],
    render: renderModerno,
  },
  {
    id: 'seed-tradicional',
    name: 'Tradicional',
    cls: 'cv-tradicional',
    brief: 'Eres un redactor de CVs formales. Genera un CV clásico en tipografía serif: nombre centrado en mayúsculas espaciadas, doble filete bajo la cabecera, títulos de sección centrados y fechas alineadas a la derecha en cursiva.',
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
    brief: 'Eres un diseñador editorial minimalista. Genera un CV de retícula suiza: nombre ligero en mayúsculas muy espaciadas, y cada sección como una fila con la etiqueta gris pequeña a la izquierda (20%) y el contenido a la derecha, separadas por líneas finas.',
    notes: ['Solo negro, grises y blanco. Sin fondos de color, sin badges, sin iconos.', 'Mucho aire: no comprimas los márgenes entre filas.'],
    render: renderMinimalista,
  },
  {
    id: 'seed-ejecutivo',
    name: 'Ejecutivo',
    cls: 'cv-ejecutivo',
    brief: 'Eres un diseñador de CVs de alta dirección. Genera un CV sobrio en azul marino y dorado: tipografía serif, cabecera con barra superior marino y filete dorado, perfil ejecutivo destacado en un recuadro crema, competencias clave en tres columnas y empresas en dorado.',
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
    brief: 'Eres un diseñador de CVs creativos. Genera un CV con una franja superior en degradado rosa-violeta, panel lateral lila redondeado con contacto, habilidades en píldoras y datos cortos, y experiencias en tarjetas redondeadas con borde izquierdo que alterna rosa y violeta.',
    notes: [
      'Alterna los colores rosa (#f43f5e / #e11d48) y violeta (#a855f7 / #7c3aed) entre tarjetas y píldoras consecutivas, como en el formato.',
      'Creativo pero legible: no añadas iconos ni imágenes decorativas.',
    ],
    render: renderCreativo,
  },
  {
    id: 'seed-tecnico',
    name: 'Tecnico',
    cls: 'cv-tecnico',
    brief: 'Eres un diseñador de CVs técnicos. Genera un CV compacto y denso para perfiles de ingeniería: tipografía monoespaciada en etiquetas, fechas y títulos de sección con prefijo "//", y el stack técnico arriba en una tabla de categorías con chips.',
    notes: [
      GROUPS_NOTE,
      'Separa las filas del stack con border-top discontinuo a partir de la segunda, como en el formato.',
      'Viñetas breves y concretas: tecnología usada, qué se hizo y resultado.',
    ],
    render: renderTecnico,
  },
  {
    id: 'seed-academico',
    name: 'Academico',
    cls: 'cv-academico',
    brief: 'Eres un redactor de CVs académicos. Genera un CV formal en serif con títulos de sección en versalitas color burdeos y entradas a dos columnas: fechas en cursiva a la izquierda (17%) y contenido a la derecha. La formación va antes que la experiencia.',
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
    brief: 'Eres un diseñador de CVs para startups. Genera un CV directo y enérgico en verde teal: cabecera oscura redondeada, resumen en negrita, banda de métricas de impacto, títulos de sección en píldoras y stack en chips.',
    notes: [
      'La banda de métricas usa SOLO cifras que aparezcan literalmente en el perfil (máximo 3). Si el perfil no contiene cifras, elimina la banda completa: nunca inventes números.',
      'Lenguaje directo y orientado a resultados; frases cortas.',
    ],
    render: renderStartup,
  },
  {
    id: 'seed-lateral',
    name: 'Lateral',
    cls: 'cv-lateral',
    brief: 'Eres un diseñador de CVs a dos columnas. Genera un CV con barra lateral izquierda oscura (32%) a toda la altura con contacto, habilidades, educación, idiomas y certificaciones, y columna principal blanca con nombre, perfil y experiencia.',
    notes: [
      'Conserva el contenedor flex con min-height para que la barra lateral ocupe toda la página.',
      'Si el perfil tiene foto, colócala centrada al inicio de la barra lateral en lugar de en la cabecera.',
    ],
    render: renderLateral,
  },
  {
    id: 'seed-europeo',
    name: 'Europass',
    cls: 'cv-europeo',
    brief: 'Eres un redactor de CVs en formato Europass. Genera un CV con la estructura europea estándar: azul institucional (#003399) con acento amarillo, bandas de sección, y filas a dos columnas con la etiqueta o las fechas alineadas a la derecha (25%) y el contenido tras una línea vertical.',
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
    brief: 'Eres un diseñador de CVs en modo oscuro para perfiles tech. Genera un CV sobre fondo azul noche (#0b1020) con tarjetas ligeramente más claras, acentos violeta y cian que se alternan, línea en degradado bajo la cabecera y chips de habilidades con borde.',
    notes: [
      'Todo el contenido va dentro del contenedor oscuro redondeado; conserva su min-height.',
      'Alterna violeta (#8b5cf6) y cian (#22d3ee) entre tarjetas y chips consecutivos, como en el formato.',
      'Mantén el contraste: texto principal claro, nunca gris oscuro sobre el fondo.',
    ],
    render: renderDark,
  },
  {
    since: 3,
    id: 'seed-foto-profesional',
    name: 'Foto Profesional',
    cls: 'cv-foto-profesional',
    brief: 'Eres un diseñador de CVs profesionales con fotografía. Genera un CV con cabecera que muestra la foto circular a la izquierda junto al nombre, título en azul y contacto, separada por una barra azul; debajo el perfil y un cuerpo a dos columnas (experiencia a la izquierda; habilidades en píldoras, educación, idiomas y certificaciones a la derecha).',
    notes: [PHOTO_NOTE, 'Conserva el tamaño de la foto (30mm) y su borde azul claro.'],
    render: renderFotoProfesional,
  },
  {
    since: 3,
    id: 'seed-foto-lateral',
    name: 'Foto Lateral',
    cls: 'cv-foto-lateral',
    brief: 'Eres un diseñador de CVs a dos columnas con fotografía. Genera un CV con barra lateral verde azulado a toda la altura que empieza con la foto circular centrada con borde blanco, seguida de contacto, habilidades, idiomas y certificaciones; la columna principal lleva nombre, título, sobre mí, experiencia con filete lateral y educación.',
    notes: [PHOTO_NOTE, 'Conserva el contenedor flex con min-height para que la barra lateral ocupe toda la página.'],
    render: renderFotoLateral,
  },
  {
    since: 3,
    id: 'seed-foto-elegante',
    name: 'Foto Elegante',
    cls: 'cv-foto-elegante',
    brief: 'Eres un diseñador de CVs elegantes con fotografía. Genera un CV centrado y cálido: foto circular centrada con aro dorado, nombre grande en serif, título en mayúsculas espaciadas color ocre, títulos de sección centrados en serif burdeos y perfil en cursiva.',
    notes: [PHOTO_NOTE, 'Paleta cálida: negro piedra, ocre (#a16207), burdeos (#7c2d12). Sin fondos de color.'],
    render: renderFotoElegante,
  },
]

// ── 13. Foto Profesional ──
function renderFotoProfesional(d: SeedCv): string {
  const h2 = 'font-size:10.5pt;font-weight:700;color:#1d4ed8;margin:0 0 6px;padding-bottom:3px;border-bottom:1.5px solid #bfdbfe;'
  return root('cv-foto-profesional', `font-family:${SANS};line-height:1.5;color:#1f2937;`, `<div style="display:flex;align-items:center;gap:16px;padding:0 0 12px;border-bottom:3px solid #1d4ed8;margin:0 0 12px;">
<img src="${d.photo}" alt="${d.name}" style="width:30mm;height:30mm;border-radius:50%;object-fit:cover;border:3px solid #dbeafe;flex:0 0 auto;">
<div style="flex:1;min-width:0;">
<h1 style="font-size:18pt;font-weight:700;color:#111827;margin:0;">${d.name}</h1>
<p style="font-size:10.5pt;font-weight:600;color:#1d4ed8;margin:2px 0 6px;">${d.title}</p>
<p style="font-size:8.5pt;color:#4b5563;margin:0;">${contact(d, ' &nbsp;•&nbsp; ')}</p>
</div>
</div>
<div style="margin:0 0 12px;">
<h2 style="${h2}">Perfil profesional</h2>
<p style="margin:0;">${d.summary}</p>
</div>
<div style="display:flex;gap:18px;">
<div style="flex:1 1 64%;min-width:0;">
<h2 style="${h2}">Experiencia</h2>
${list(d.experience, (e) => `<div style="margin:0 0 9px;">
<p style="margin:0;font-weight:700;color:#111827;">${e.position} <span style="font-weight:400;color:#6b7280;">— ${e.company}</span></p>
<p style="margin:0 0 2px;font-size:8.5pt;color:#1d4ed8;">${e.period}</p>
${bullets(e.bullets)}
</div>`)}
</div>
<div style="flex:0 0 33%;min-width:0;">
<h2 style="${h2}">Habilidades</h2>
<div style="display:flex;flex-wrap:wrap;gap:4px;margin:0 0 12px;">
${list(d.skills, (s) => `<span style="background:#eff6ff;color:#1e40af;border-radius:10px;padding:1px 8px;font-size:8.5pt;">${s}</span>`)}
</div>
<h2 style="${h2}">Educación</h2>
${list(d.education, (e) => `<p style="margin:0;font-weight:700;">${e.degree}</p>
<p style="margin:0 0 6px;font-size:8.5pt;color:#6b7280;">${e.school} · ${e.period}</p>`)}
<h2 style="${h2}">Idiomas</h2>
${list(d.languages, (l) => `<p style="margin:0 0 2px;">${l.name} <span style="font-size:8.5pt;color:#6b7280;">— ${l.level}</span></p>`)}
<h2 style="${h2}margin-top:10px;">Certificaciones</h2>
${list(d.certs, (c) => `<p style="margin:0 0 3px;font-size:8.5pt;">${c}</p>`)}
</div>
</div>`)
}

// ── 14. Foto Lateral ──
function renderFotoLateral(d: SeedCv): string {
  const side = 'font-size:8.5pt;font-weight:700;letter-spacing:1.5pt;text-transform:uppercase;color:#ffffff;margin:0 0 6px;padding-bottom:3px;border-bottom:1px solid rgba(255,255,255,0.35);'
  const main = 'font-size:10.5pt;font-weight:700;letter-spacing:1pt;text-transform:uppercase;color:#0f766e;margin:0 0 6px;padding-bottom:3px;border-bottom:2px solid #99f6e4;'
  return root('cv-foto-lateral', `font-family:${SANS};line-height:1.5;color:#334155;`, `<div style="display:flex;min-height:262mm;">
<div style="flex:0 0 31%;min-width:0;background:#0f766e;color:#ecfeff;padding:20px 14px;border-radius:6px 0 0 6px;">
<div style="text-align:center;margin:0 0 16px;">
<img src="${d.photo}" alt="${d.name}" style="width:34mm;height:34mm;border-radius:50%;object-fit:cover;border:4px solid #ffffff;display:inline-block;">
</div>
<div style="margin:0 0 14px;">
<h2 style="${side}">Contacto</h2>
${list([d.email, d.phone, d.location, d.linkedin], (c) => `<p style="margin:0 0 2px;font-size:8.5pt;">${c}</p>`)}
</div>
<div style="margin:0 0 14px;">
<h2 style="${side}">Habilidades</h2>
${list(d.skills, (s) => `<p style="margin:0 0 2px;font-size:8.5pt;">▪ ${s}</p>`)}
</div>
<div style="margin:0 0 14px;">
<h2 style="${side}">Idiomas</h2>
${list(d.languages, (l) => `<p style="margin:0 0 2px;font-size:8.5pt;">${l.name} — ${l.level}</p>`)}
</div>
<div style="margin:0;">
<h2 style="${side}">Certificaciones</h2>
${list(d.certs, (c) => `<p style="margin:0 0 3px;font-size:8.5pt;">${c}</p>`)}
</div>
</div>
<div style="flex:1;min-width:0;padding:20px 0 18px 18px;">
<h1 style="font-size:18pt;font-weight:700;color:#134e4a;margin:0;">${d.name}</h1>
<p style="font-size:10pt;font-weight:600;color:#0d9488;margin:2px 0 12px;">${d.title}</p>
<div style="margin:0 0 14px;">
<h2 style="${main}">Sobre mí</h2>
<p style="margin:0;">${d.summary}</p>
</div>
<div style="margin:0 0 14px;">
<h2 style="${main}">Experiencia</h2>
${list(d.experience, (e) => `<div style="margin:0 0 9px;padding-left:10px;border-left:2px solid #99f6e4;">
<p style="margin:0;font-weight:700;color:#134e4a;">${e.position}</p>
<p style="margin:0 0 2px;font-size:8.5pt;color:#64748b;"><strong style="color:#0d9488;">${e.company}</strong> · ${e.period}</p>
${bullets(e.bullets)}
</div>`)}
</div>
<h2 style="${main}">Educación</h2>
${list(d.education, (e) => `<p style="margin:0;font-weight:700;color:#134e4a;">${e.degree}</p>
<p style="margin:0 0 4px;font-size:8.5pt;color:#64748b;">${e.school} · ${e.period}</p>`)}
</div>
</div>`)
}

// ── 15. Foto Elegante ──
function renderFotoElegante(d: SeedCv): string {
  const h2 = `font-family:${SERIF};font-size:11pt;font-weight:400;letter-spacing:2pt;text-transform:uppercase;color:#7c2d12;text-align:center;margin:0 0 8px;`
  return root('cv-foto-elegante', `font-family:${SANS};line-height:1.55;color:#292524;`, `<div style="text-align:center;padding:4px 0 12px;margin:0 0 12px;border-bottom:1px solid #e7e5e4;">
<img src="${d.photo}" alt="${d.name}" style="width:28mm;height:28mm;border-radius:50%;object-fit:cover;border:2px solid #d6a77a;padding:2px;display:inline-block;">
<h1 style="font-family:${SERIF};font-size:20pt;font-weight:400;letter-spacing:1pt;color:#1c1917;margin:8px 0 0;">${d.name}</h1>
<p style="font-size:9pt;letter-spacing:2.5pt;text-transform:uppercase;color:#a16207;margin:3px 0 6px;">${d.title}</p>
<p style="font-size:8.5pt;color:#57534e;margin:0;">${contact(d, ' &nbsp;|&nbsp; ')}</p>
</div>
<div style="margin:0 0 14px;">
<h2 style="${h2}">Perfil</h2>
<p style="margin:0;text-align:center;font-style:italic;color:#44403c;">${d.summary}</p>
</div>
<div style="margin:0 0 14px;">
<h2 style="${h2}">Experiencia</h2>
${list(d.experience, (e) => `<div style="margin:0 0 10px;">
<div style="display:flex;justify-content:space-between;gap:8px;">
<p style="margin:0;font-weight:700;color:#1c1917;">${e.position} <span style="font-weight:400;color:#a16207;">· ${e.company}</span></p>
<p style="margin:0;font-size:8.5pt;font-style:italic;color:#78716c;white-space:nowrap;">${e.period}</p>
</div>
${bullets(e.bullets)}
</div>`)}
</div>
<div style="display:flex;gap:18px;">
<div style="flex:1;min-width:0;">
<h2 style="${h2}">Educación</h2>
${list(d.education, (e) => `<p style="margin:0;font-weight:700;text-align:center;">${e.degree}</p>
<p style="margin:0 0 4px;font-size:8.5pt;color:#78716c;text-align:center;">${e.school} · ${e.period}</p>`)}
<h2 style="${h2}margin-top:10px;">Idiomas</h2>
${list(d.languages, (l) => `<p style="margin:0 0 2px;text-align:center;">${l.name} — <span style="color:#78716c;">${l.level}</span></p>`)}
</div>
<div style="flex:1;min-width:0;">
<h2 style="${h2}">Habilidades</h2>
<p style="margin:0 0 8px;text-align:center;">${d.skills.join(' · ')}</p>
<h2 style="${h2}margin-top:10px;">Certificaciones</h2>
${list(d.certs, (c) => `<p style="margin:0 0 3px;font-size:8.5pt;text-align:center;">${c}</p>`)}
</div>
</div>`)
}

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
body{padding:9.5mm 10mm;font-family:'Segoe UI','Helvetica Neue',Arial,sans-serif;font-size:9.5pt;line-height:1.5;color:#1a1a1a}
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
