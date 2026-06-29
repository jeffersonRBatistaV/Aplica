import type { CvTemplate } from '../../shared/types'

const SEED_TEMPLATES: Omit<CvTemplate, 'sampleHtml'> & { sampleHtml: string }[] = [
  {
    id: 'seed-ats',
    name: 'ATS-Friendly',
    prompt: `Eres un Estratega Senior de CVs especializado en optimizacion agresiva para ATS. Genera un CV como HTML puro con estilos inline.

ESTRATEGIA:
- Reformula la experiencia usando el lenguaje exacto de la vacante
- Cada bullet de experiencia debe incluir AL MENOS 1 keyword de la vacante
- La seccion de Resumen debe contener AL MENOS 3 keywords principales
- Integra OBLIGATORIAMENTE cada keyword faltante del reporte ATS

Formato: <div class="cv-ats" style="font-family:'Segoe UI',Arial,sans-serif;font-size:11pt;color:#1f2937;max-width:190mm;margin:0 auto;">
<h1 style="font-size:20pt;color:#1e3a5f;border-bottom:2px solid #2563eb;padding-bottom:6px;">[Nombre]</h1>
<p style="color:#4b5563;font-size:10pt;">[Email] | [Telefono] | [Ubicacion]</p>
<h2 style="font-size:13pt;color:#1e40af;margin:18px 0 6px;border-bottom:1px solid #d1d5db;">Resumen Profesional</h2>
<p>[2-3 lineas con keywords]</p>
<h2 style="font-size:13pt;color:#1e40af;margin:18px 0 6px;border-bottom:1px solid #d1d5db;">Experiencia</h2>
<p><strong>[Puesto]</strong> | [Empresa] | [Fechas]</p>
<ul><li>[Logro con keyword]</li><li>[Logro con keyword]</li></ul>
<h2 style="font-size:13pt;color:#1e40af;margin:18px 0 6px;border-bottom:1px solid #d1d5db;">Habilidades Tecnicas</h2>
<p>[keyword1], [keyword2], ...</p>
</div>

REGLAS: NO uses emojis. NO uses columnas. NO uses tablas. Cada etiqueta debe tener style inline.`,
    sampleHtml: `<div class="cv-ats" style="font-family:'Segoe UI',Arial,sans-serif;font-size:11pt;color:#1f2937;line-height:1.5;max-width:190mm;margin:0 auto;padding:0;">
<h1 style="font-size:20pt;color:#1e3a5f;border-bottom:2px solid #2563eb;padding-bottom:6px;margin:0 0 8px;">John Doe</h1>
<p style="margin:2px 0;color:#4b5563;font-size:10pt;">john.doe@email.com | +1 (555) 123-4567 | linkedin.com/in/johndoe</p>
<h2 style="font-size:13pt;color:#1e40af;margin:18px 0 6px;border-bottom:1px solid #d1d5db;padding-bottom:3px;">Resumen Profesional</h2>
<p style="margin:6px 0;">Senior Software Engineer con 6+ anos de experiencia en desarrollo full-stack, arquitectura cloud y liderazgo de equipos. Especializado en React, Node.js y AWS con enfoque en sistemas escalables y mentoría tecnica.</p>
<h2 style="font-size:13pt;color:#1e40af;margin:18px 0 6px;border-bottom:1px solid #d1d5db;padding-bottom:3px;">Experiencia</h2>
<p style="margin:6px 0;"><strong>TechLead — Arquitectura Cloud</strong> | ACME Corp | Ene 2021 — Presente</p>
<ul style="margin:4px 0 4px 18px;padding:0;">
<li style="margin:2px 0;">Lidere equipo de 8 ingenieros migrando infraestructura legacy a microservicios en AWS, reduciendo downtime en 40%</li>
<li style="margin:2px 0;">Disene e implemente arquitectura GraphQL unificando 5 APIs REST, mejorando tiempo de respuesta en 60%</li>
</ul>
<p style="margin:6px 0;"><strong>Senior Developer — Full Stack</strong> | ACME Corp | Jun 2018 — Dic 2020</p>
<ul style="margin:4px 0 4px 18px;padding:0;">
<li style="margin:2px 0;">Desarrolle plataforma React/Node.js con 50k+ usuarios activos, integrando CI/CD y tests automatizados</li>
<li style="margin:2px 0;">Optimice queries PostgreSQL reduciendo tiempos de carga de 3s a 200ms</li>
</ul>
<h2 style="font-size:13pt;color:#1e40af;margin:18px 0 6px;border-bottom:1px solid #d1d5db;padding-bottom:3px;">Educacion</h2>
<p style="margin:6px 0;">B.S. Computer Science — MIT (2014 — 2018) | GPA: 3.8/4.0</p>
<h2 style="font-size:13pt;color:#1e40af;margin:18px 0 6px;border-bottom:1px solid #d1d5db;padding-bottom:3px;">Habilidades Tecnicas</h2>
<p style="margin:6px 0;">JavaScript, TypeScript, React, Node.js, Python, AWS, Docker, GraphQL, PostgreSQL</p>
<h2 style="font-size:13pt;color:#1e40af;margin:18px 0 6px;border-bottom:1px solid #d1d5db;padding-bottom:3px;">Idiomas</h2>
<p style="margin:6px 0;">English (Nativo), Espanol (Avanzado)</p>
</div>`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'seed-moderno',
    name: 'Moderno',
    prompt: `Eres un disenador de curriculums modernos y visuales. Genera un CV como HTML puro con estilos inline.

ESTRATEGIA: Reformula experiencia con lenguaje de la vacante. Cada badge de skill debe ser keyword de la vacante.

Formato: <div class="cv-moderno" style="font-family:'Segoe UI','Helvetica Neue',Arial,sans-serif;font-size:10.5pt;color:#1f2937;max-width:190mm;margin:0 auto;">
<div style="background:linear-gradient(135deg,#1e3a5f,#2563eb);color:white;padding:24px 20px;border-radius:8px 8px 0 0;">
<h1 style="font-size:22pt;margin:0;">[Nombre]</h1>
<p style="font-size:12pt;margin:4px 0 0;opacity:0.9;">[Puesto]</p></div>
<h2 style="font-size:13pt;color:#1e3a5f;border-bottom:2px solid #2563eb;">Resumen</h2>
<h2 style="font-size:13pt;color:#1e3a5f;border-bottom:2px solid #2563eb;">Habilidades Clave</h2>
<div style="display:flex;flex-wrap:wrap;gap:6px;"><span style="background:#dbeafe;color:#1e40af;padding:4px 10px;border-radius:4px;">[Skill]</span></div>
<h2 style="font-size:13pt;color:#1e3a5f;border-bottom:2px solid #2563eb;">Experiencia</h2>
<div style="border-left:3px solid #2563eb;padding-left:12px;">
<p><strong>[Puesto]</strong> | [Empresa]</p></div>
</div>

REGLAS: NO uses emojis. Diseno tipo dashboard con colores corporativos. Cada etiqueta con style inline.`,
    sampleHtml: `<div class="cv-moderno" style="font-family:'Segoe UI','Helvetica Neue',Arial,sans-serif;font-size:10.5pt;color:#1f2937;line-height:1.6;max-width:190mm;margin:0 auto;padding:0;">
<div style="background:linear-gradient(135deg,#1e3a5f 0%,#2563eb 100%);color:white;padding:24px 20px;border-radius:8px 8px 0 0;margin-bottom:16px;">
<h1 style="font-size:22pt;margin:0 0 4px;font-weight:700;">John Doe</h1>
<p style="font-size:12pt;margin:0;opacity:0.9;">Senior Software Engineer</p>
<p style="font-size:9pt;margin:8px 0 0;opacity:0.75;">john.doe@email.com | +1 (555) 123-4567 | linkedin.com/in/johndoe</p>
</div>
<h2 style="font-size:13pt;color:#1e3a5f;margin:16px 0 8px;padding-bottom:4px;border-bottom:2px solid #2563eb;text-transform:uppercase;letter-spacing:0.5pt;">Resumen</h2>
<p style="margin:6px 0;color:#374151;">Senior Software Engineer con 6+ anos de experiencia liderando equipos de ingenieria, disenando arquitecturas cloud escalables y desarrollando aplicaciones full-stack con React y Node.js.</p>
<h2 style="font-size:13pt;color:#1e3a5f;margin:16px 0 8px;padding-bottom:4px;border-bottom:2px solid #2563eb;text-transform:uppercase;letter-spacing:0.5pt;">Habilidades Clave</h2>
<div style="display:flex;flex-wrap:wrap;gap:6px;margin:8px 0;">
<span style="background:#dbeafe;color:#1e40af;padding:4px 10px;border-radius:4px;font-size:9.5pt;font-weight:500;">JavaScript</span>
<span style="background:#dbeafe;color:#1e40af;padding:4px 10px;border-radius:4px;font-size:9.5pt;font-weight:500;">TypeScript</span>
<span style="background:#dbeafe;color:#1e40af;padding:4px 10px;border-radius:4px;font-size:9.5pt;font-weight:500;">React</span>
<span style="background:#dbeafe;color:#1e40af;padding:4px 10px;border-radius:4px;font-size:9.5pt;font-weight:500;">Node.js</span>
<span style="background:#dbeafe;color:#1e40af;padding:4px 10px;border-radius:4px;font-size:9.5pt;font-weight:500;">AWS</span>
<span style="background:#dbeafe;color:#1e40af;padding:4px 10px;border-radius:4px;font-size:9.5pt;font-weight:500;">GraphQL</span>
</div>
<h2 style="font-size:13pt;color:#1e3a5f;margin:16px 0 8px;padding-bottom:4px;border-bottom:2px solid #2563eb;text-transform:uppercase;letter-spacing:0.5pt;">Experiencia</h2>
<div style="margin:8px 0;">
<div style="border-left:3px solid #2563eb;padding-left:12px;margin-bottom:12px;">
<p style="margin:2px 0;"><strong style="font-size:11pt;color:#111827;">TechLead</strong> <span style="color:#6b7280;">| ACME Corp</span></p>
<p style="margin:2px 0;color:#6b7280;font-size:9pt;">Ene 2021 — Presente</p>
<ul style="margin:4px 0 0 16px;padding:0;">
<li style="margin:2px 0;color:#374151;">Migracion de infraestructura legacy a microservicios AWS, reduciendo downtime en 40%</li>
<li style="margin:2px 0;color:#374151;">Implementacion de arquitectura GraphQL unificando 5 APIs REST, mejora de respuesta en 60%</li>
</ul>
</div>
<div style="border-left:3px solid #2563eb;padding-left:12px;">
<p style="margin:2px 0;"><strong style="font-size:11pt;color:#111827;">Senior Developer</strong> <span style="color:#6b7280;">| ACME Corp</span></p>
<p style="margin:2px 0;color:#6b7280;font-size:9pt;">Jun 2018 — Dic 2020</p>
<ul style="margin:4px 0 0 16px;padding:0;">
<li style="margin:2px 0;color:#374151;">Desarrollo de plataforma React/Node.js con 50k+ usuarios activos</li>
<li style="margin:2px 0;color:#374151;">Optimizacion de queries PostgreSQL reduciendo tiempos de 3s a 200ms</li>
</ul>
</div>
</div>
<h2 style="font-size:13pt;color:#1e3a5f;margin:16px 0 8px;padding-bottom:4px;border-bottom:2px solid #2563eb;text-transform:uppercase;letter-spacing:0.5pt;">Educacion</h2>
<p style="margin:6px 0;"><strong>B.S. Computer Science</strong> — MIT (2014 — 2018)</p>
</div>`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'seed-tradicional',
    name: 'Tradicional',
    prompt: `Eres un redactor de curriculums formales. Genera un CV como HTML puro con estilos inline.
NO uses emojis. Formato cronologico inverso.

Formato: <div class="cv-tradicional" style="font-family:'Times New Roman','Georgia',serif;font-size:11pt;color:#1f2937;max-width:190mm;margin:0 auto;">
<h1 style="font-size:18pt;text-align:center;">[Nombre]</h1>
<p style="text-align:center;">[Email] | [Telefono]</p>
<hr style="border-top:1px solid #374151;" />
<h2 style="font-size:13pt;border-bottom:1px solid #9ca3af;">Perfil Profesional</h2>
<h2 style="font-size:13pt;border-bottom:1px solid #9ca3af;">Experiencia Profesional</h2>
<p><strong>[Puesto]</strong> | [Empresa] <em>[Fechas]</em></p>
<ul><li>[Logro detallado]</li></ul>
</div>`,
    sampleHtml: `<div class="cv-tradicional" style="font-family:'Times New Roman','Georgia',serif;font-size:11pt;color:#1f2937;line-height:1.5;max-width:190mm;margin:0 auto;padding:0;">
<h1 style="font-size:18pt;color:#111827;text-align:center;margin:0 0 4px;font-weight:700;">John Doe</h1>
<p style="text-align:center;font-size:10pt;color:#4b5563;margin:2px 0;">john.doe@email.com | +1 (555) 123-4567 | linkedin.com/in/johndoe</p>
<p style="text-align:center;font-size:10pt;color:#6b7280;margin:2px 0;">San Francisco, CA</p>
<hr style="border:none;border-top:1px solid #374151;margin:12px 0;" />
<h2 style="font-size:13pt;color:#111827;margin:16px 0 6px;border-bottom:1px solid #9ca3af;padding-bottom:2px;font-weight:700;">Perfil Profesional</h2>
<p style="margin:6px 0;text-align:justify;">Senior Software Engineer con mas de 6 anos de trayectoria en desarrollo de software, arquitectura cloud y liderazgo tecnico. Especializado en la creacion de sistemas escalables, migracion a microservicios y mentoría de equipos de ingenieria. Enfoque en resultados y mejora continua.</p>
<h2 style="font-size:13pt;color:#111827;margin:16px 0 6px;border-bottom:1px solid #9ca3af;padding-bottom:2px;font-weight:700;">Experiencia Profesional</h2>
<div style="margin:8px 0;">
<p style="margin:2px 0;"><strong style="font-size:11pt;">TechLead</strong> <span style="color:#4b5563;">| ACME Corp</span> <em style="font-size:9.5pt;color:#6b7280;">Ene 2021 — Presente</em></p>
<ul style="margin:4px 0 8px 18px;padding:0;">
<li style="margin:2px 0;text-align:justify;">Liderazgo de equipo de 8 ingenieros para la migracion de infraestructura legacy a microservicios en AWS, logrando una reduccion del 40% en el tiempo de inactividad del sistema.</li>
<li style="margin:2px 0;text-align:justify;">Diseno e implementacion de una arquitectura GraphQL que unifico 5 APIs REST, mejorando los tiempos de respuesta en un 60% y simplificando el mantenimiento.</li>
</ul>
</div>
<div style="margin:8px 0;">
<p style="margin:2px 0;"><strong style="font-size:11pt;">Senior Developer</strong> <span style="color:#4b5563;">| ACME Corp</span> <em style="font-size:9.5pt;color:#6b7280;">Jun 2018 — Dic 2020</em></p>
<ul style="margin:4px 0 8px 18px;padding:0;">
<li style="margin:2px 0;text-align:justify;">Desarrollo de plataforma web con React y Node.js alcanzando mas de 50,000 usuarios activos, con integracion de pipelines CI/CD y pruebas automatizadas.</li>
<li style="margin:2px 0;text-align:justify;">Optimizacion de consultas a base de datos PostgreSQL, reduciendo los tiempos de carga de 3 segundos a 200 milisegundos.</li>
</ul>
</div>
<h2 style="font-size:13pt;color:#111827;margin:16px 0 6px;border-bottom:1px solid #9ca3af;padding-bottom:2px;font-weight:700;">Educacion</h2>
<p style="margin:6px 0;"><strong>B.S. Computer Science</strong> — Massachusetts Institute of Technology (MIT), 2018</p>
<p style="margin:4px 0;color:#4b5563;">GPA: 3.8/4.0</p>
<h2 style="font-size:13pt;color:#111827;margin:16px 0 6px;border-bottom:1px solid #9ca3af;padding-bottom:2px;font-weight:700;">Competencias</h2>
<p style="margin:4px 0;"><strong>Tecnicas:</strong> JavaScript, TypeScript, React, Node.js, Python, AWS, Docker, GraphQL, PostgreSQL</p>
<p style="margin:4px 0;"><strong>Idiomas:</strong> English (Nativo), Espanol (Avanzado)</p>
</div>`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'seed-minimalista',
    name: 'Minimalista',
    prompt: `Eres un disenador minimalista de CVs. Usa colores gris oscuro (#374151) y blanco, tipografia sans-serif (Inter, Segoe UI), maximo espacio en blanco, sin fondos de color ni badges. Layout una columna con delgados separadores entre secciones.

ESTRATEGIA: Integra keywords de la vacante naturalmente en el texto escrito. Sin elementos decorativos.

Formato: <div class="cv-minimalista" style="font-family:'Inter','Segoe UI',sans-serif;font-size:10pt;color:#374151;max-width:190mm;margin:0 auto;">
<h1 style="font-size:24pt;font-weight:300;color:#111827;letter-spacing:-0.5pt;">[Nombre]</h1>
<p style="font-size:9pt;color:#9ca3af;">[Email] · [Telefono] · [Ubicacion]</p>
<div style="border-bottom:1px solid #e5e7eb;margin:16px 0;"></div>
<h2 style="font-size:9pt;text-transform:uppercase;letter-spacing:2px;color:#9ca3af;">Resumen</h2>
<p style="font-size:10pt;color:#4b5563;">[Texto]</p>
</div>

REGLAS: NO uses emojis. NO uses colores de fondo. Solo texto y lineas finas.`,
    sampleHtml: `<div class="cv-minimalista" style="font-family:'Inter','Segoe UI',sans-serif;font-size:10pt;color:#374151;line-height:1.7;max-width:190mm;margin:0 auto;padding:0;">
<h1 style="font-size:24pt;font-weight:300;color:#111827;letter-spacing:-0.5pt;margin:0 0 4px;">John Doe</h1>
<p style="font-size:9pt;color:#9ca3af;margin:0;">john.doe@email.com · +1 (555) 123-4567 · San Francisco, CA</p>
<div style="border-bottom:1px solid #e5e7eb;margin:20px 0 16px;"></div>
<h2 style="font-size:9pt;text-transform:uppercase;letter-spacing:2px;color:#9ca3af;margin:0 0 12px;font-weight:600;">Resumen</h2>
<p style="font-size:10pt;color:#4b5563;margin:0 0 20px;">Senior Software Engineer con 6+ anos de experiencia en desarrollo full-stack, arquitectura cloud y liderazgo de equipos. Apasionado por construir sistemas escalables y mentorear equipos de ingenieria.</p>
<h2 style="font-size:9pt;text-transform:uppercase;letter-spacing:2px;color:#9ca3af;margin:0 0 12px;font-weight:600;">Experiencia</h2>
<div style="margin-bottom:16px;">
<p style="margin:0 0 2px;"><strong style="color:#111827;font-weight:600;">TechLead</strong> <span style="color:#9ca3af;">— ACME Corp</span></p>
<p style="font-size:8pt;color:#d1d5db;margin:0 0 8px;">Ene 2021 — Presente</p>
<p style="font-size:9.5pt;color:#4b5563;margin:0 0 4px;">Liderazgo de equipo de 8 ingenieros para migracion a microservicios AWS. Diseno de arquitectura GraphQL unificando 5 APIs REST.</p>
</div>
<div style="margin-bottom:16px;">
<p style="margin:0 0 2px;"><strong style="color:#111827;font-weight:600;">Senior Developer</strong> <span style="color:#9ca3af;">— ACME Corp</span></p>
<p style="font-size:8pt;color:#d1d5db;margin:0 0 8px;">Jun 2018 — Dic 2020</p>
<p style="font-size:9.5pt;color:#4b5563;margin:0 0 4px;">Desarrollo de plataforma React/Node.js con 50k+ usuarios. Optimizacion de queries PostgreSQL.</p>
</div>
<h2 style="font-size:9pt;text-transform:uppercase;letter-spacing:2px;color:#9ca3af;margin:24px 0 12px;font-weight:600;">Habilidades</h2>
<p style="font-size:9.5pt;color:#4b5563;margin:0;">JavaScript · TypeScript · React · Node.js · Python · AWS · Docker · GraphQL · PostgreSQL</p>
<h2 style="font-size:9pt;text-transform:uppercase;letter-spacing:2px;color:#9ca3af;margin:24px 0 12px;font-weight:600;">Educacion</h2>
<p style="font-size:9.5pt;color:#4b5563;margin:0 0 4px;"><strong style="color:#111827;">B.S. Computer Science</strong> — MIT (2014 — 2018)</p>
<p style="font-size:9pt;color:#9ca3af;margin:0;">GPA: 3.8/4.0</p>
</div>`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'seed-ejecutivo',
    name: 'Ejecutivo',
    prompt: `Eres un disenador de CVs ejecutivos. Usa colores azul marino oscuro (#0f1a2e) y dorado (#c5953c), tipografia serif (Georgia, Palatino). Tonos formales de alta dirección. Layout elegante con barras doradas.

ESTRATEGIA: Enfasis en liderazgo, vision estrategica, resultados de negocio y direccion de equipos.

Formato: <div class="cv-ejecutivo" style="font-family:'Georgia','Palatino',serif;font-size:10.5pt;color:#1f2937;max-width:190mm;margin:0 auto;">
<div style="background:#0f1a2e;color:white;padding:28px 24px;">
<h1 style="font-size:22pt;margin:0;color:#fff;">[Nombre]</h1>
<p style="color:#c5953c;font-size:11pt;">[Puesto]</p></div>
<h2 style="color:#0f1a2e;border-bottom:2px solid #c5953c;">[Seccion]</h2>
</div>

REGLAS: NO uses emojis. Lenguaje formal y ejecutivo.`,
    sampleHtml: `<div class="cv-ejecutivo" style="font-family:'Georgia','Palatino',serif;font-size:10.5pt;color:#1f2937;line-height:1.6;max-width:190mm;margin:0 auto;padding:0;">
<div style="background:#0f1a2e;color:white;padding:28px 24px;margin-bottom:20px;">
<h1 style="font-size:22pt;margin:0 0 4px;font-weight:700;color:#ffffff;">John Doe</h1>
<p style="color:#c5953c;font-size:11pt;margin:0 0 8px;font-weight:600;">Senior Software Engineer</p>
<p style="font-size:9pt;margin:0;opacity:0.7;">john.doe@email.com | +1 (555) 123-4567 | linkedin.com/in/johndoe</p>
</div>
<h2 style="font-size:12pt;color:#0f1a2e;margin:20px 0 12px;padding-bottom:6px;border-bottom:2px solid #c5953c;font-weight:700;text-transform:uppercase;letter-spacing:1pt;">Perfil Ejecutivo</h2>
<p style="margin:6px 0;color:#374151;">Senior Software Engineer con trayectoria comprobada en liderazgo tecnologico, transformacion digital y direccion de equipos de alto rendimiento. Capacidad demostrada para disenar estrategias de arquitectura cloud, optimizar procesos y generar impacto en el negocio mediante innovacion tecnologica.</p>
<h2 style="font-size:12pt;color:#0f1a2e;margin:20px 0 12px;padding-bottom:6px;border-bottom:2px solid #c5953c;font-weight:700;text-transform:uppercase;letter-spacing:1pt;">Trayectoria</h2>
<div style="margin:12px 0;">
<p style="margin:0 0 2px;"><strong style="font-size:11pt;color:#0f1a2e;">TechLead</strong></p>
<p style="margin:0 0 2px;color:#c5953c;font-weight:600;">ACME Corp | Ene 2021 — Presente</p>
<ul style="margin:6px 0 16px 18px;padding:0;">
<li style="margin:3px 0;color:#374151;">Direccion de equipo de 8 ingenieros en migracion estrategica a microservicios AWS, logrando 40% de reduccion en downtime y mejora en disponibilidad del servicio.</li>
<li style="margin:3px 0;color:#374151;">Liderazgo de iniciativa de modernizacion de APIs, implementando arquitectura GraphQL que unifico 5 sistemas legacy y mejoro tiempos de respuesta en 60%.</li>
</ul>
</div>
<div style="margin:12px 0;">
<p style="margin:0 0 2px;"><strong style="font-size:11pt;color:#0f1a2e;">Senior Developer</strong></p>
<p style="margin:0 0 2px;color:#c5953c;font-weight:600;">ACME Corp | Jun 2018 — Dic 2020</p>
<ul style="margin:6px 0 16px 18px;padding:0;">
<li style="margin:3px 0;color:#374151;">Desarrollo y lanzamiento de plataforma digital con 50k+ usuarios activos, superando objetivos de adopcion en un 25%.</li>
</ul>
</div>
<h2 style="font-size:12pt;color:#0f1a2e;margin:20px 0 12px;padding-bottom:6px;border-bottom:2px solid #c5953c;font-weight:700;text-transform:uppercase;letter-spacing:1pt;">Formacion</h2>
<p style="margin:6px 0;"><strong style="color:#0f1a2e;">B.S. Computer Science</strong> — MIT (2014 — 2018)</p>
<h2 style="font-size:12pt;color:#0f1a2e;margin:20px 0 12px;padding-bottom:6px;border-bottom:2px solid #c5953c;font-weight:700;text-transform:uppercase;letter-spacing:1pt;">Competencias Clave</h2>
<p style="margin:6px 0;color:#374151;">JavaScript, TypeScript, React, Node.js, Python, AWS, Docker, GraphQL, PostgreSQL</p>
</div>`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'seed-creativo',
    name: 'Creativo',
    prompt: `Eres un disenador creativo de CVs. Usa colores coral (#e11d48), violeta (#7c3aed) y grises. Bordes redondeados, secciones en tarjetas con fondo suave. Tipografia sans-serif moderna (Inter). Layout innovador con iconos.

ESTRATEGIA: Enfasis en innovacion, resolucion de problemas, adaptabilidad y pensamiento de diseno.

Formato: <div class="cv-creativo" style="font-family:'Inter','Segoe UI',sans-serif;font-size:10pt;max-width:190mm;margin:0 auto;">
<div style="border-radius:16px;background:linear-gradient(135deg,#e11d48,#7c3aed);color:white;padding:20px;">[Header]</div>
<div style="border-radius:12px;background:#fdf2f8;padding:16px;margin:12px 0;">[Skills como badges]</div>
<div style="border-radius:12px;border:1px solid #e5e7eb;padding:16px;margin:12px 0;">[Experiencia]</div>
</div>

REGLAS: NO uses emojis. Layout creativo pero legible.`,
    sampleHtml: `<div class="cv-creativo" style="font-family:'Inter','Segoe UI',sans-serif;font-size:10pt;color:#1f2937;line-height:1.6;max-width:190mm;margin:0 auto;padding:0;">
<div style="border-radius:16px;background:linear-gradient(135deg,#e11d48 0%,#7c3aed 100%);color:white;padding:24px 20px;margin-bottom:16px;">
<h1 style="font-size:20pt;margin:0 0 4px;font-weight:700;">John Doe</h1>
<p style="font-size:11pt;margin:0;opacity:0.9;">Senior Software Engineer</p>
<p style="font-size:9pt;margin:8px 0 0;opacity:0.7;">john.doe@email.com · +1 (555) 123-4567 · linkedin.com/in/johndoe</p>
</div>
<div style="border-radius:12px;background:#fdf2f8;padding:16px;margin-bottom:16px;">
<h2 style="font-size:11pt;color:#e11d48;margin:0 0 8px;font-weight:600;">Habilidades</h2>
<div style="display:flex;flex-wrap:wrap;gap:4px;">
<span style="background:white;color:#e11d48;padding:4px 10px;border-radius:20px;font-size:9pt;border:1px solid #f9a8d4;">JavaScript</span>
<span style="background:white;color:#7c3aed;padding:4px 10px;border-radius:20px;font-size:9pt;border:1px solid #c4b5fd;">TypeScript</span>
<span style="background:white;color:#e11d48;padding:4px 10px;border-radius:20px;font-size:9pt;border:1px solid #f9a8d4;">React</span>
<span style="background:white;color:#7c3aed;padding:4px 10px;border-radius:20px;font-size:9pt;border:1px solid #c4b5fd;">Node.js</span>
<span style="background:white;color:#e11d48;padding:4px 10px;border-radius:20px;font-size:9pt;border:1px solid #f9a8d4;">AWS</span>
<span style="background:white;color:#7c3aed;padding:4px 10px;border-radius:20px;font-size:9pt;border:1px solid #c4b5fd;">GraphQL</span>
<span style="background:white;color:#e11d48;padding:4px 10px;border-radius:20px;font-size:9pt;border:1px solid #f9a8d4;">Python</span>
<span style="background:white;color:#7c3aed;padding:4px 10px;border-radius:20px;font-size:9pt;border:1px solid #c4b5fd;">Docker</span>
</div>
</div>
<div style="border-radius:12px;border:1px solid #e5e7eb;padding:16px;margin-bottom:12px;">
<p style="margin:0 0 2px;"><strong style="font-size:11pt;color:#111827;">TechLead</strong> <span style="color:#6b7280;">· ACME Corp</span></p>
<p style="font-size:8pt;color:#9ca3af;margin:0 0 8px;">Ene 2021 — Presente</p>
<p style="margin:0;color:#4b5563;">Lidere equipo de 8 ingenieros migrando infraestructura legacy a microservicios AWS, reduciendo downtime en 40%. Disene e implemente arquitectura GraphQL unificando 5 APIs REST.</p>
</div>
<div style="border-radius:12px;border:1px solid #e5e7eb;padding:16px;margin-bottom:12px;">
<p style="margin:0 0 2px;"><strong style="font-size:11pt;color:#111827;">Senior Developer</strong> <span style="color:#6b7280;">· ACME Corp</span></p>
<p style="font-size:8pt;color:#9ca3af;margin:0 0 8px;">Jun 2018 — Dic 2020</p>
<p style="margin:0;color:#4b5563;">Desarrolle plataforma React/Node.js con 50k+ usuarios activos. Optimice queries PostgreSQL reduciendo tiempos de 3s a 200ms.</p>
</div>
<div style="border-radius:12px;background:#f5f3ff;padding:16px;">
<h2 style="font-size:11pt;color:#7c3aed;margin:0 0 8px;font-weight:600;">Formacion</h2>
<p style="margin:0;color:#4b5563;"><strong>B.S. Computer Science</strong> — MIT (2014 — 2018) · GPA: 3.8/4.0</p>
</div>
</div>`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'seed-tecnico',
    name: 'Tecnico',
    prompt: `Eres un disenador de CVs tecnicos. Skills primero en grid compacto, fuente mono ('Cascadia Code','Fira Code',monospace) para terminos tecnicos. Layout ultra-compacto, maximo informacion en minimo espacio. Colores azul acero (#475569) y slate.

ESTRATEGIA: Enfasis en herramientas, metodologias, stack tecnologico. Ideal para roles tecnicos/operativos.

Formato: <div class="cv-tecnico" style="font-family:'Inter','Segoe UI',sans-serif;font-size:9.5pt;max-width:190mm;margin:0 auto;">
<h1 style="font-size:16pt;font-weight:700;">[Nombre]</h1>
<p style="font-size:8pt;"><code>[Email]</code> | <code>[Telefono]</code></p>
<div style="background:#f1f5f9;border-radius:6px;padding:10px;font-family:'Cascadia Code','Fira Code',monospace;font-size:8.5pt;">
<span style="background:#e2e8f0;padding:2px 6px;border-radius:3px;">Skill</span>
</div>
<h2 style="font-size:10pt;font-weight:600;">EXPERIENCIA</h2>
<p><strong>[Puesto]</strong> @ [Empresa] <span style="color:#64748b;">[Fechas]</span></p>
</div>

REGLAS: NO uses emojis. Compacto. Skills primero.`,
    sampleHtml: `<div class="cv-tecnico" style="font-family:'Inter','Segoe UI',sans-serif;font-size:9.5pt;color:#1e293b;line-height:1.5;max-width:190mm;margin:0 auto;padding:0;">
<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px;">
<h1 style="font-size:16pt;font-weight:700;margin:0;color:#0f172a;">John Doe</h1>
<span style="font-size:8pt;color:#64748b;">Senior Software Engineer</span>
</div>
<p style="font-size:8pt;color:#64748b;margin:0 0 12px;font-family:'Cascadia Code','Fira Code',monospace;">john.doe@email.com | +1 (555) 123-4567 | linkedin.com/in/johndoe</p>
<div style="background:#f1f5f9;border-radius:6px;padding:10px;margin-bottom:12px;">
<div style="display:flex;flex-wrap:wrap;gap:4px;font-family:'Cascadia Code','Fira Code',monospace;font-size:8pt;">
<span style="background:#e2e8f0;color:#334155;padding:2px 8px;border-radius:3px;font-weight:600;">JavaScript</span>
<span style="background:#e2e8f0;color:#334155;padding:2px 8px;border-radius:3px;font-weight:600;">TypeScript</span>
<span style="background:#e2e8f0;color:#334155;padding:2px 8px;border-radius:3px;font-weight:600;">React</span>
<span style="background:#e2e8f0;color:#334155;padding:2px 8px;border-radius:3px;font-weight:600;">Node.js</span>
<span style="background:#e2e8f0;color:#334155;padding:2px 8px;border-radius:3px;font-weight:600;">AWS</span>
<span style="background:#e2e8f0;color:#334155;padding:2px 8px;border-radius:3px;font-weight:600;">Python</span>
<span style="background:#e2e8f0;color:#334155;padding:2px 8px;border-radius:3px;font-weight:600;">Docker</span>
<span style="background:#e2e8f0;color:#334155;padding:2px 8px;border-radius:3px;font-weight:600;">GraphQL</span>
<span style="background:#e2e8f0;color:#334155;padding:2px 8px;border-radius:3px;font-weight:600;">PostgreSQL</span>
</div>
</div>
<h2 style="font-size:10pt;font-weight:600;color:#0f172a;margin:16px 0 8px;padding-bottom:3px;border-bottom:1px solid #e2e8f0;letter-spacing:0.5px;">EXPERIENCIA</h2>
<div style="margin-bottom:10px;">
<p style="margin:0 0 2px;"><strong style="font-size:10pt;">TechLead</strong> <span style="color:#64748b;">@ ACME Corp</span> <span style="color:#94a3b8;font-size:8pt;">Ene 2021 — Presente</span></p>
<ul style="margin:2px 0 0 14px;padding:0;font-size:9pt;color:#334155;">
<li style="margin:1px 0;">Migracion legacy → microservicios AWS · -40% downtime</li>
<li style="margin:1px 0;">Arquitectura GraphQL · 5 APIs unificadas · +60% rendimiento</li>
</ul>
</div>
<div style="margin-bottom:10px;">
<p style="margin:0 0 2px;"><strong style="font-size:10pt;">Senior Developer</strong> <span style="color:#64748b;">@ ACME Corp</span> <span style="color:#94a3b8;font-size:8pt;">Jun 2018 — Dic 2020</span></p>
<ul style="margin:2px 0 0 14px;padding:0;font-size:9pt;color:#334155;">
<li style="margin:1px 0;">Plataforma React/Node.js · 50k+ usuarios</li>
<li style="margin:1px 0;">Optimizacion PostgreSQL · 3s → 200ms</li>
</ul>
</div>
<h2 style="font-size:10pt;font-weight:600;color:#0f172a;margin:16px 0 8px;padding-bottom:3px;border-bottom:1px solid #e2e8f0;letter-spacing:0.5px;">EDUCACION</h2>
<p style="margin:0;font-size:9pt;"><strong>B.S. Computer Science</strong> — MIT (2014 — 2018) · GPA: 3.8/4.0</p>
</div>`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'seed-academico',
    name: 'Academico',
    prompt: `Eres un redactor de CVs academicos. Formal, con secciones de publicaciones, investigacion, docencia. Colores slate (#475569) y gris. Tipografia serif para cuerpo, sans-serif para headers. Enfasis en logros academicos y de investigacion.

ESTRATEGIA: Keywords academicas: investigacion, publicacion, docencia, metodos, analisis, curriculo, programa.

Formato: <div class="cv-academico" style="font-family:'Georgia',serif;font-size:10.5pt;max-width:190mm;margin:0 auto;">
<h1 style="font-size:18pt;color:#1e293b;font-weight:700;">[Nombre]</h1>
<p style="color:#64748b;">[Email] | [Telefono]</p>
<h2 style="font-size:11pt;color:#475569;border-bottom:1px solid #cbd5e1;">EDUCACION</h2>
<h2 style="font-size:11pt;color:#475569;border-bottom:1px solid #cbd5e1;">PUBLICACIONES</h2>
<h2 style="font-size:11pt;color:#475569;border-bottom:1px solid #cbd5e1;">EXPERIENCIA</h2>
</div>

REGLAS: NO uses emojis. Formato academico formal.`,
    sampleHtml: `<div class="cv-academico" style="font-family:'Georgia',serif;font-size:10.5pt;color:#1e293b;line-height:1.6;max-width:190mm;margin:0 auto;padding:0;">
<h1 style="font-size:18pt;color:#1e293b;font-weight:700;margin:0 0 4px;">John Doe, M.Sc.</h1>
<p style="color:#64748b;font-size:10pt;margin:0 0 16px;">john.doe@email.com | +1 (555) 123-4567 | linkedin.com/in/johndoe</p>
<h2 style="font-size:11pt;color:#475569;margin:20px 0 8px;padding-bottom:4px;border-bottom:1px solid #cbd5e1;font-weight:700;letter-spacing:0.5pt;">EDUCACION</h2>
<p style="margin:4px 0;"><strong style="color:#1e293b;">B.S. Computer Science</strong> — Massachusetts Institute of Technology</p>
<p style="color:#64748b;font-size:9.5pt;margin:0 0 8px;">2014 — 2018 | GPA: 3.8/4.0</p>
<h2 style="font-size:11pt;color:#475569;margin:20px 0 8px;padding-bottom:4px;border-bottom:1px solid #cbd5e1;font-weight:700;letter-spacing:0.5pt;">PUBLICACIONES</h2>
<p style="margin:6px 0 4px;">Doe, J., Smith, A. (2023). <em>Arquitecturas de Microservicios en la Nube: Un Analisis Comparativo de Estrategias de Migracion.</em> Journal of Cloud Computing, 12(3), 45-62.</p>
<p style="margin:6px 0 4px;">Doe, J., Johnson, K. (2022). <em>Optimizacion de Consultas en Bases de Datos Relacionales: Tecnicas y Resultados.</em> IEEE Transactions on Software Engineering, 48(6), 112-128.</p>
<h2 style="font-size:11pt;color:#475569;margin:20px 0 8px;padding-bottom:4px;border-bottom:1px solid #cbd5e1;font-weight:700;letter-spacing:0.5pt;">EXPERIENCIA PROFESIONAL</h2>
<div style="margin:8px 0;">
<p style="margin:0 0 2px;"><strong>TechLead / Investigador Asociado</strong> — ACME Corp Labs</p>
<p style="color:#64748b;font-size:9pt;margin:0 0 6px;">Ene 2021 — Presente</p>
<p style="margin:0;color:#334155;">Investigacion y desarrollo de arquitecturas cloud escalables. Liderazgo de equipo de investigacion aplicada en microservicios y GraphQL. Supervisión de tesis de pregrado.</p>
</div>
<div style="margin:8px 0;">
<p style="margin:0 0 2px;"><strong>Senior Developer / Investigador</strong> — ACME Corp Labs</p>
<p style="color:#64748b;font-size:9pt;margin:0 0 6px;">Jun 2018 — Dic 2020</p>
<p style="margin:0;color:#334155;">Desarrollo de plataforma de investigacion web. Diseno de experimentos de optimizacion de bases de datos. Colaboracion en 2 publicaciones indexadas.</p>
</div>
<h2 style="font-size:11pt;color:#475569;margin:20px 0 8px;padding-bottom:4px;border-bottom:1px solid #cbd5e1;font-weight:700;letter-spacing:0.5pt;">IDIOMAS</h2>
<p style="margin:4px 0;color:#334155;">Ingles (Nativo) | Espanol (Avanzado) | Aleman (Basico)</p>
</div>`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'seed-startup',
    name: 'Startup',
    prompt: `Eres un disenador de CVs para startups. Moderno, casual, metricas grandes de impacto. Colores verde/teal (#0d9488) y azul (#2563eb). Una pagina. Enfasis en impacto, velocidad, resultados. Tipografia sans-serif moderna.

ESTRATEGIA: Destaca metricas, logros cuantificables, agilidad, polivalencia. Lenguaje directo y dinamico.

Formato: <div class="cv-startup" style="font-family:'Inter','Segoe UI',sans-serif;font-size:10pt;max-width:190mm;margin:0 auto;">
<div style="display:flex;align-items:center;gap:16px;background:#0d9488;color:white;padding:20px;border-radius:0 0 24px 24px;">
<div><h1 style="font-size:20pt;">[Nombre]</h1><p>[Puesto]</p></div>
</div>
<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">
<div style="background:#f0fdfa;padding:12px;border-radius:8px;text-align:center;">
<p style="font-size:18pt;font-weight:700;color:#0d9488;">40%</p>
<p style="font-size:8pt;">Reduccion</p></div>
</div>
</div>

REGLAS: NO uses emojis. Moderno, metricas visibles, una pagina.`,
    sampleHtml: `<div class="cv-startup" style="font-family:'Inter','Segoe UI',sans-serif;font-size:10pt;color:#1f2937;line-height:1.5;max-width:190mm;margin:0 auto;padding:0;">
<div style="background:linear-gradient(135deg,#0d9488 0%,#2563eb 100%);color:white;padding:24px 20px;border-radius:0 0 24px 24px;margin-bottom:16px;">
<h1 style="font-size:22pt;margin:0 0 4px;font-weight:800;">John Doe</h1>
<p style="font-size:12pt;margin:0 0 8px;opacity:0.9;">Senior Software Engineer</p>
<p style="font-size:9pt;margin:0;opacity:0.7;">john.doe@email.com | +1 (555) 123-4567 | linkedin.com/in/johndoe</p>
</div>
<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px;">
<div style="background:#f0fdfa;padding:12px;border-radius:8px;text-align:center;border:1px solid #ccfbf1;">
<p style="font-size:18pt;font-weight:700;color:#0d9488;margin:0;">40%</p>
<p style="font-size:8pt;color:#64748b;margin:4px 0 0;">Reduccion Downtime</p>
</div>
<div style="background:#f0fdfa;padding:12px;border-radius:8px;text-align:center;border:1px solid #ccfbf1;">
<p style="font-size:18pt;font-weight:700;color:#0d9488;margin:0;">60%</p>
<p style="font-size:8pt;color:#64748b;margin:4px 0 0;">Mejora Respuesta</p>
</div>
<div style="background:#eff6ff;padding:12px;border-radius:8px;text-align:center;border:1px solid #bfdbfe;">
<p style="font-size:18pt;font-weight:700;color:#2563eb;margin:0;">50k+</p>
<p style="font-size:8pt;color:#64748b;margin:4px 0 0;">Usuarios Activos</p>
</div>
</div>
<h2 style="font-size:10pt;font-weight:700;color:#0d9488;margin:16px 0 8px;text-transform:uppercase;letter-spacing:1pt;">Impacto</h2>
<div style="margin-bottom:12px;">
<p style="margin:0 0 2px;"><strong>TechLead</strong> <span style="color:#0d9488;">@</span> ACME Corp <span style="color:#94a3b8;font-size:8pt;">2021 — Presente</span></p>
<p style="margin:2px 0;color:#475569;">Lidere la migracion a microservicios AWS con 8 ingenieros. Disene e implemente arquitectura GraphQL que transformo la plataforma.</p>
</div>
<div style="margin-bottom:12px;">
<p style="margin:0 0 2px;"><strong>Senior Developer</strong> <span style="color:#0d9488;">@</span> ACME Corp <span style="color:#94a3b8;font-size:8pt;">2018 — 2020</span></p>
<p style="margin:2px 0;color:#475569;">Construi plataforma React/Node.js desde cero hasta 50k usuarios. Optimice base de datos para rendimiento extremo.</p>
</div>
<h2 style="font-size:10pt;font-weight:700;color:#0d9488;margin:16px 0 8px;text-transform:uppercase;letter-spacing:1pt;">Stack</h2>
<div style="display:flex;flex-wrap:wrap;gap:4px;">
<span style="background:#f0fdfa;color:#0d9488;padding:3px 10px;border-radius:20px;font-size:8.5pt;border:1px solid #99f6e4;font-weight:600;">React</span>
<span style="background:#f0fdfa;color:#0d9488;padding:3px 10px;border-radius:20px;font-size:8.5pt;border:1px solid #99f6e4;font-weight:600;">Node.js</span>
<span style="background:#f0fdfa;color:#0d9488;padding:3px 10px;border-radius:20px;font-size:8.5pt;border:1px solid #99f6e4;font-weight:600;">TypeScript</span>
<span style="background:#eff6ff;color:#2563eb;padding:3px 10px;border-radius:20px;font-size:8.5pt;border:1px solid #bfdbfe;font-weight:600;">AWS</span>
<span style="background:#eff6ff;color:#2563eb;padding:3px 10px;border-radius:20px;font-size:8.5pt;border:1px solid #bfdbfe;font-weight:600;">GraphQL</span>
<span style="background:#f0fdfa;color:#0d9488;padding:3px 10px;border-radius:20px;font-size:8.5pt;border:1px solid #99f6e4;font-weight:600;">PostgreSQL</span>
</div>
<p style="margin:12px 0 0;font-size:8pt;color:#94a3b8;">B.S. Computer Science — MIT (2014 — 2018)</p>
</div>`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'seed-lateral',
    name: 'Lateral',
    prompt: `Eres un disenador de CVs con layout de dos columnas. Sidebar izquierdo (30% ancho) con datos personales, skills compactos, idiomas. Columna principal (70%) con experiencia. Sidebar fondo gris oscuro (#1e293b) con texto blanco. Columna principal blanco.

ESTRATEGIA: Sidebar para datos de contacto y skills compactas. Columna principal para experiencia detallada.

Formato: <div class="cv-lateral" style="font-family:'Inter','Segoe UI',sans-serif;font-size:10pt;max-width:190mm;margin:0 auto;display:flex;">
<div style="width:30%;background:#1e293b;color:white;padding:20px;">
<h2 style="font-size:10pt;">Contacto</h2>
<h2 style="font-size:10pt;">Skills</h2>
<h2 style="font-size:10pt;">Idiomas</h2>
</div>
<div style="width:70%;background:white;padding:20px;">
<h1>[Nombre]</h1>
<h2>Experiencia</h2>
</div>
</div>

REGLAS: NO uses emojis. Dos columnas estrictas.`,
    sampleHtml: `<div class="cv-lateral" style="font-family:'Inter','Segoe UI',sans-serif;font-size:10pt;color:#1f2937;line-height:1.5;max-width:190mm;margin:0 auto;display:flex;min-height:600px;">
<div style="width:30%;background:#1e293b;color:white;padding:24px 16px;flex-shrink:0;">
<h2 style="font-size:9pt;text-transform:uppercase;letter-spacing:1.5px;color:#94a3b8;margin:0 0 12px;font-weight:600;">Contacto</h2>
<p style="font-size:8.5pt;margin:0 0 4px;color:#e2e8f0;">john.doe@email.com</p>
<p style="font-size:8.5pt;margin:0 0 4px;color:#e2e8f0;">+1 (555) 123-4567</p>
<p style="font-size:8.5pt;margin:0 0 4px;color:#e2e8f0;">San Francisco, CA</p>
<p style="font-size:8.5pt;margin:0 0 20px;color:#e2e8f0;">linkedin.com/in/johndoe</p>
<h2 style="font-size:9pt;text-transform:uppercase;letter-spacing:1.5px;color:#94a3b8;margin:0 0 12px;font-weight:600;">Skills</h2>
<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:20px;">
<span style="background:#334155;color:#e2e8f0;padding:3px 8px;border-radius:3px;font-size:8pt;">JavaScript</span>
<span style="background:#334155;color:#e2e8f0;padding:3px 8px;border-radius:3px;font-size:8pt;">TypeScript</span>
<span style="background:#334155;color:#e2e8f0;padding:3px 8px;border-radius:3px;font-size:8pt;">React</span>
<span style="background:#334155;color:#e2e8f0;padding:3px 8px;border-radius:3px;font-size:8pt;">Node.js</span>
<span style="background:#334155;color:#e2e8f0;padding:3px 8px;border-radius:3px;font-size:8pt;">AWS</span>
<span style="background:#334155;color:#e2e8f0;padding:3px 8px;border-radius:3px;font-size:8pt;">Python</span>
<span style="background:#334155;color:#e2e8f0;padding:3px 8px;border-radius:3px;font-size:8pt;">Docker</span>
<span style="background:#334155;color:#e2e8f0;padding:3px 8px;border-radius:3px;font-size:8pt;">GraphQL</span>
<span style="background:#334155;color:#e2e8f0;padding:3px 8px;border-radius:3px;font-size:8pt;">PostgreSQL</span>
</div>
<h2 style="font-size:9pt;text-transform:uppercase;letter-spacing:1.5px;color:#94a3b8;margin:0 0 12px;font-weight:600;">Idiomas</h2>
<p style="font-size:8.5pt;margin:0 0 4px;color:#e2e8f0;">English — Nativo</p>
<p style="font-size:8.5pt;margin:0 0 20px;color:#e2e8f0;">Espanol — Avanzado</p>
<h2 style="font-size:9pt;text-transform:uppercase;letter-spacing:1.5px;color:#94a3b8;margin:0 0 12px;font-weight:600;">Educacion</h2>
<p style="font-size:8.5pt;margin:0;color:#e2e8f0;">B.S. Computer Science</p>
<p style="font-size:8pt;margin:0 0 4px;color:#94a3b8;">MIT (2014 — 2018)</p>
</div>
<div style="width:70%;background:white;padding:24px 20px;">
<h1 style="font-size:20pt;color:#0f172a;margin:0 0 4px;font-weight:700;">John Doe</h1>
<p style="font-size:11pt;color:#64748b;margin:0 0 20px;">Senior Software Engineer</p>
<h2 style="font-size:10pt;color:#1e293b;margin:0 0 12px;padding-bottom:4px;border-bottom:2px solid #1e293b;font-weight:700;">Experiencia</h2>
<div style="margin-bottom:16px;">
<p style="margin:0 0 2px;"><strong style="color:#0f172a;">TechLead</strong></p>
<p style="margin:0 0 4px;color:#64748b;font-size:9pt;">ACME Corp | Ene 2021 — Presente</p>
<p style="margin:0;color:#475569;">Lidere equipo de 8 ingenieros migrando a microservicios AWS (40% menos downtime). Implemente arquitectura GraphQL unificando 5 APIs REST (60% mas rapido).</p>
</div>
<div style="margin-bottom:16px;">
<p style="margin:0 0 2px;"><strong style="color:#0f172a;">Senior Developer</strong></p>
<p style="margin:0 0 4px;color:#64748b;font-size:9pt;">ACME Corp | Jun 2018 — Dic 2020</p>
<p style="margin:0;color:#475569;">Desarrolle plataforma React/Node.js con 50k+ usuarios. Optimice queries PostgreSQL de 3s a 200ms.</p>
</div>
<h2 style="font-size:10pt;color:#1e293b;margin:24px 0 12px;padding-bottom:4px;border-bottom:2px solid #1e293b;font-weight:700;">Resumen</h2>
<p style="margin:0;color:#475569;">Senior Software Engineer con 6+ anos de experiencia liderando equipos, disenando arquitecturas cloud y desarrollando aplicaciones full-stack. Apasionado por la innovacion tecnologica y la mentoría.</p>
</div>
</div>`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'seed-europeo',
    name: 'Europass',
    prompt: `Eres un disenador de CVs estilo Europass. Estructura seccionada estandar europea. Foto placeholder circular. Colores azul union europea (#003399) y blanco. Banderas como indicadores de idioma. Formato oficial.

ESTRATEGIA: Keywords europeas: formacion, competencias, experiencia laboral, idiomas, movilidad.

Formato: <div class="cv-europeo" style="font-family:'Calibri','Segoe UI',sans-serif;font-size:10pt;max-width:210mm;margin:0 auto;">
<div style="background:#003399;color:white;padding:16px 20px;display:flex;align-items:center;gap:16px;">
<div style="width:60px;height:60px;border-radius:50%;background:#ccc;"></div>
<div><h1>[Nombre]</h1><p>[Puesto]</p></div>
</div>
<h2>EXPERIENCIA LABORAL</h2>
<h2>EDUCACION Y FORMACION</h2>
<h2>COMPETENCIAS</h2>
</div>

REGLAS: NO uses emojis. Formato Europass oficial.`,
    sampleHtml: `<div class="cv-europeo" style="font-family:'Calibri','Segoe UI',sans-serif;font-size:10pt;color:#1f2937;line-height:1.5;max-width:210mm;margin:0 auto;padding:0;">
<div style="background:#003399;color:white;padding:16px 20px;display:flex;align-items:center;gap:16px;margin-bottom:16px;">
<div style="width:60px;height:60px;border-radius:50%;background:#b0c4de;display:flex;align-items:center;justify-content:center;font-size:20pt;color:#003399;font-weight:700;">JD</div>
<div>
<h1 style="font-size:18pt;margin:0;font-weight:700;">John Doe</h1>
<p style="font-size:11pt;margin:4px 0 0;opacity:0.9;">Senior Software Engineer</p>
<p style="font-size:8pt;margin:4px 0 0;opacity:0.7;">john.doe@email.com | +1 (555) 123-4567 | linkedin.com/in/johndoe</p>
</div>
</div>
<div style="padding:0 20px;">
<h2 style="font-size:11pt;color:#003399;margin:16px 0 8px;padding-bottom:4px;border-bottom:2px solid #003399;font-weight:700;">EXPERIENCIA LABORAL</h2>
<div style="margin:8px 0;">
<table style="width:100%;border-collapse:collapse;font-size:9.5pt;">
<tr><td style="width:120px;vertical-align:top;color:#64748b;font-size:8.5pt;">Ene 2021 — Presente</td>
<td><strong>TechLead</strong><br><span style="color:#64748b;">ACME Corp</span><br><span style="color:#475569;">Liderazgo de equipo de 8 ingenieros. Migracion a microservicios AWS. Arquitectura GraphQL.</span></td></tr>
<tr><td style="width:120px;vertical-align:top;color:#64748b;font-size:8.5pt;padding-top:10px;">Jun 2018 — Dic 2020</td>
<td style="padding-top:10px;"><strong>Senior Developer</strong><br><span style="color:#64748b;">ACME Corp</span><br><span style="color:#475569;">Desarrollo plataforma React/Node.js. Optimizacion de bases de datos PostgreSQL.</span></td></tr>
</table>
</div>
<h2 style="font-size:11pt;color:#003399;margin:16px 0 8px;padding-bottom:4px;border-bottom:2px solid #003399;font-weight:700;">EDUCACION Y FORMACION</h2>
<p style="margin:6px 0;font-size:9.5pt;"><strong>B.S. Computer Science</strong> — MIT (2014 — 2018)</p>
<h2 style="font-size:11pt;color:#003399;margin:16px 0 8px;padding-bottom:4px;border-bottom:2px solid #003399;font-weight:700;">COMPETENCIAS TECNICAS</h2>
<div style="display:flex;flex-wrap:wrap;gap:4px;margin:6px 0;">
<span style="background:#e0e7ff;color:#003399;padding:3px 10px;border-radius:12px;font-size:8.5pt;">JavaScript</span>
<span style="background:#e0e7ff;color:#003399;padding:3px 10px;border-radius:12px;font-size:8.5pt;">TypeScript</span>
<span style="background:#e0e7ff;color:#003399;padding:3px 10px;border-radius:12px;font-size:8.5pt;">React</span>
<span style="background:#e0e7ff;color:#003399;padding:3px 10px;border-radius:12px;font-size:8.5pt;">Node.js</span>
<span style="background:#e0e7ff;color:#003399;padding:3px 10px;border-radius:12px;font-size:8.5pt;">AWS</span>
<span style="background:#e0e7ff;color:#003399;padding:3px 10px;border-radius:12px;font-size:8.5pt;">Python</span>
<span style="background:#e0e7ff;color:#003399;padding:3px 10px;border-radius:12px;font-size:8.5pt;">Docker</span>
<span style="background:#e0e7ff;color:#003399;padding:3px 10px;border-radius:12px;font-size:8.5pt;">GraphQL</span>
</div>
<h2 style="font-size:11pt;color:#003399;margin:16px 0 8px;padding-bottom:4px;border-bottom:2px solid #003399;font-weight:700;">COMPETENCIAS IDIOMATICAS</h2>
<table style="width:100%;font-size:9pt;border-collapse:collapse;">
<tr><td style="padding:2px 0;">English</td><td style="padding:2px 0;">Nativo</td><td style="padding:2px 0;">C2</td></tr>
<tr><td style="padding:2px 0;">Espanol</td><td style="padding:2px 0;">Avanzado</td><td style="padding:2px 0;">C1</td></tr>
</table>
</div>
</div>`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'seed-dark',
    name: 'Dark Mode',
    prompt: `Eres un disenador de CVs en modo oscuro. Fondo #0f0f1a, texto claro #e2e8f0, acentos violeta (#8b5cf6) y neon (#06b6d4). Tipografia sans-serif moderna (Inter). Border glow sutiles. Layout moderno con tarjetas.

ESTRATEGIA: Estilo tech/developer. Enfasis en innovacion y tecnologia de punta.

Formato: <div class="cv-dark" style="font-family:'Inter','Segoe UI',sans-serif;font-size:10pt;max-width:190mm;margin:0 auto;">
<div style="background:linear-gradient(135deg,#0f0f1a,#1a1a2e);color:#e2e8f0;padding:24px;">
<h1 style="color:white;">[Nombre]</h1>
<p style="color:#8b5cf6;">[Puesto]</p>
</div>
<div style="background:#1a1a2e;border:1px solid #2d2d4a;border-radius:8px;padding:16px;">
<h2 style="color:#8b5cf6;">Skills</h2>
<span style="border:1px solid #8b5cf6;color:#c4b5fd;">[Skill]</span>
</div>
</div>

REGLAS: NO uses emojis. Modo oscuro completo. Acentos neón/violeta.`,
    sampleHtml: `<div class="cv-dark" style="font-family:'Inter','Segoe UI',sans-serif;font-size:10pt;color:#e2e8f0;line-height:1.6;max-width:190mm;margin:0 auto;padding:0;">
<div style="background:linear-gradient(135deg,#0f0f1a 0%,#1a1a2e 50%,#16213e 100%);padding:24px 20px;margin-bottom:16px;border-bottom:1px solid #2d2d4a;">
<h1 style="font-size:22pt;margin:0 0 4px;font-weight:700;color:#ffffff;">John Doe</h1>
<p style="font-size:11pt;margin:0 0 8px;color:#8b5cf6;font-weight:600;">Senior Software Engineer</p>
<p style="font-size:8.5pt;margin:0;color:#94a3b8;">john.doe@email.com | +1 (555) 123-4567 | linkedin.com/in/johndoe</p>
</div>
<div style="padding:0 20px;">
<div style="background:#1a1a2e;border:1px solid #2d2d4a;border-radius:8px;padding:16px;margin-bottom:16px;">
<h2 style="font-size:10pt;color:#8b5cf6;margin:0 0 10px;font-weight:700;text-transform:uppercase;letter-spacing:1pt;">Skills</h2>
<div style="display:flex;flex-wrap:wrap;gap:6px;">
<span style="border:1px solid #8b5cf6;color:#c4b5fd;padding:4px 10px;border-radius:4px;font-size:8.5pt;">JavaScript</span>
<span style="border:1px solid #06b6d4;color:#67e8f9;padding:4px 10px;border-radius:4px;font-size:8.5pt;">TypeScript</span>
<span style="border:1px solid #8b5cf6;color:#c4b5fd;padding:4px 10px;border-radius:4px;font-size:8.5pt;">React</span>
<span style="border:1px solid #06b6d4;color:#67e8f9;padding:4px 10px;border-radius:4px;font-size:8.5pt;">Node.js</span>
<span style="border:1px solid #8b5cf6;color:#c4b5fd;padding:4px 10px;border-radius:4px;font-size:8.5pt;">AWS</span>
<span style="border:1px solid #06b6d4;color:#67e8f9;padding:4px 10px;border-radius:4px;font-size:8.5pt;">GraphQL</span>
<span style="border:1px solid #8b5cf6;color:#c4b5fd;padding:4px 10px;border-radius:4px;font-size:8.5pt;">Python</span>
</div>
</div>
<div style="background:#1a1a2e;border:1px solid #2d2d4a;border-radius:8px;padding:16px;margin-bottom:16px;">
<h2 style="font-size:10pt;color:#06b6d4;margin:0 0 10px;font-weight:700;text-transform:uppercase;letter-spacing:1pt;">Experiencia</h2>
<div style="margin-bottom:12px;padding-left:12px;border-left:2px solid #8b5cf6;">
<p style="margin:0 0 2px;"><strong style="color:#ffffff;">TechLead</strong> <span style="color:#64748b;">— ACME Corp</span></p>
<p style="font-size:8pt;color:#64748b;margin:0 0 6px;">Ene 2021 — Presente</p>
<p style="margin:0;color:#cbd5e1;font-size:9pt;">Liderazgo de equipo de 8 ingenieros. Migracion a microservicios AWS con 40% menos downtime. Arquitectura GraphQL con 60% mas rendimiento.</p>
</div>
<div style="padding-left:12px;border-left:2px solid #06b6d4;">
<p style="margin:0 0 2px;"><strong style="color:#ffffff;">Senior Developer</strong> <span style="color:#64748b;">— ACME Corp</span></p>
<p style="font-size:8pt;color:#64748b;margin:0 0 6px;">Jun 2018 — Dic 2020</p>
<p style="margin:0;color:#cbd5e1;font-size:9pt;">Plataforma React/Node.js con 50k+ usuarios. Optimizacion PostgreSQL de 3s a 200ms.</p>
</div>
</div>
<div style="background:#1a1a2e;border:1px solid #2d2d4a;border-radius:8px;padding:16px;">
<h2 style="font-size:10pt;color:#8b5cf6;margin:0 0 10px;font-weight:700;text-transform:uppercase;letter-spacing:1pt;">Educacion</h2>
<p style="margin:0;color:#cbd5e1;"><strong style="color:#ffffff;">B.S. Computer Science</strong> — MIT (2014 — 2018) · GPA: 3.8/4.0</p>
</div>
</div>
</div>`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
]

export function wrapHtml(content: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:white;padding:24px;display:flex;justify-content:center;font-size:10pt;line-height:1.5}
</style>
</head>
<body>
${content}
</body>
</html>`
}

export function getSeedTemplates(): CvTemplate[] {
  return SEED_TEMPLATES.map((t) => ({
    ...t,
    sampleHtml: wrapHtml(t.sampleHtml),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }))
}
