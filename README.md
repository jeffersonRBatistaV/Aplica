# Aplica 🎯

> Asistente IA para crear currículums profesionales y gestionar tu búsqueda de empleo

[![Electron](https://img.shields.io/badge/Electron-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen)](CONTRIBUTING.md)

---

## ✨ Características

- 🤖 **Asistente IA** — Chat con IA local ([Ollama](https://ollama.com/)) o cualquier API compatible con OpenAI (Groq, OpenAI, etc.)
- 📝 **Generación de CV** — Crea currículums profesionales con IA en 3 estilos:
  - **ATS** — Optimizado con keywords para pasar filtros automáticos
  - **Moderno** — Formato visual tipo dashboard con badges de habilidades
  - **Tradicional** — Cronológico inverso clásico y formal
  - 🎨 **Plantillas personalizadas** — Crea y guarda tus propios estilos de CV
- 🎯 **Wizard de Perfil** — Cuestionario adaptativo para 9 áreas profesionales: Tecnología, Salud, Finanzas, Educación, Ventas, Ingeniería, Legal, Administrativo y Arte/Diseño
- 📊 **Analytics** — Estadísticas de tu perfil, distribución de postulaciones, match scores y consejos personalizados para tu carrera
- 🗂️ **Gestión de Postulaciones** — Tablero Kanban con estados: Borrador → Aplicada → Entrevista → Oferta / Rechazada
- 📄 **Reporte ATS** — Analiza tu CV contra descripciones de vacantes: keywords presentes/faltantes, fortalezas, brechas y quick fixes
- 📧 **Cartas de Presentación** — Generación automática de cold email y cover letter adaptadas a cada vacante
- 🎤 **Preparación de Entrevistas** — Preguntas personalizadas basadas en tu perfil y la vacante
- 🗺️ **Roadmap Profesional** — Plan de carrera por fases con acciones y prioridades generado por IA
- 🌗 **Modo oscuro** / claro con detección del sistema
- 🌐 **Multi-idioma** — Interfaz en español e inglés (i18next)
- 📎 **Adjuntos** — Soporte para archivos de texto, Markdown, CSV, imágenes (OCR con Tesseract.js), Excel y más
- 📤 **Exportar / Importar** — Backup completo en JSON o Excel con fusión sin duplicados
- 🔒 **Privacidad total** — Todo corre local en tu máquina; los datos nunca salen de tu equipo (excepto la llamada a la API de IA que configures)

## 🛠 Stack

| Tecnología | Uso |
|---|---|
| [Electron](https://www.electronjs.org/) | Framework de escritorio multiplataforma |
| [Vite](https://vitejs.dev/) | Bundler y dev server ultrarrápido |
| [React 19](https://react.dev/) | UI library para el renderer |
| [TypeScript](https://www.typescriptlang.org/) | Tipado estático estricto |
| [Tailwind CSS](https://tailwindcss.com/) | Utilidades de estilos |
| [Lucide React](https://lucide.dev/) | Iconografía |
| [i18next](https://www.i18next.com/) | Internacionalización (es/en) |
| [Tesseract.js](https://tesseract.projectnaptha.com/) | OCR para extracción de texto desde imágenes |
| [xlsx](https://SheetJS.com/) | Lectura/escritura de archivos Excel |
| [marked](https://marked.js.org/) + [highlight.js](https://highlightjs.org/) | Renderizado y resaltado de Markdown |

## 📦 Instalación

### Prerrequisitos

- [Node.js](https://nodejs.org/) ≥ 18
- [Ollama](https://ollama.com/) (opcional, para IA local)

### Pasos

```bash
# Clonar el repositorio
git clone https://github.com/jeffersonRBatistaV/Aplica.git
cd Aplica

# Instalar dependencias
npm install

# Desarrollo
npm run dev

# Build de producción
npm run build
```

### Empaquetar para distribución

```bash
npm run dist:linux    # AppImage (Linux)
npm run dist:win      # Portable (Windows)
npm run dist:mac      # DMG (macOS)
```

## 🚀 Uso rápido

1. **Inicia la app** con `npm run dev`
2. **Completa el wizard de perfil** — Selecciona tu área profesional y responde las preguntas
3. **Conecta una IA** — Configura Ollama local (`http://localhost:11434/v1`) o una API externa (OpenAI, Groq, etc.)
4. **Genera tu CV** — Ve a la sección de Vacantes, pega una descripción de puesto y genera tu currículum optimizado
5. **Gestiona tus postulaciones** — Usa el tablero Kanban para dar seguimiento a cada aplicación
6. **Revisa tus estadísticas** — Analiza tu progreso y recibe consejos personalizados

## 📁 Arquitectura

```
Aplica/
├── src/
│   ├── main/                    # Proceso principal de Electron (Node.js)
│   │   ├── main.ts              # Entry point, BrowserWindow, registro IPC
│   │   ├── ipc/index.ts         # Handlers IPC (chat, perfil, jobs, settings, LLM)
│   │   ├── services/            # Lógica de negocio
│   │   │   ├── storage.ts       # Lectura/escritura de JSON
│   │   │   ├── llm-service.ts   # Comunicación con APIs de IA
│   │   │   ├── job-service.ts   # Gestión de postulaciones
│   │   │   └── cv-generator.ts  # Generación de CV con IA
│   │   └── utils/paths.ts       # Rutas de archivos de persistencia
│   ├── preload/
│   │   └── preload.js           # contextBridge: expone window.api (CJS)
│   ├── renderer/                # SPA React
│   │   ├── App.tsx              # Root: carga perfil, muestra ProfileWizard
│   │   ├── main.tsx             # Entry ReactDOM
│   │   ├── contexts/            # AppContext, ChatContext, NavigationContext, etc.
│   │   ├── components/          # UI: profile/, chat/, jobhub/, layout/, settings/
│   │   ├── data/questions.ts    # Definición de preguntas del wizard (9 áreas)
│   │   └── i18n/                # Traducciones (es.json, en.json)
│   └── shared/                  # Tipos compartidos entre procesos
└── package.json
```

### Persistencia de datos

Todo se almacena en archivos JSON localmente:

| Archivo | Contenido |
|---|---|
| `profile.json` | Perfil profesional completo |
| `chats.json` | Conversaciones con la IA |
| `jobs.json` | Postulaciones y reportes ATS |
| `settings.json` | Configuración de API, apariencia y privacidad |

## 📸 Capturas

*(Agrega screenshots de la aplicación aquí)*

```
<!-- ![Chat](screenshots/chat.png) -->
<!-- ![Profile Wizard](screenshots/wizard.png) -->
<!-- ![Job Board](screenshots/kanban.png) -->
<!-- ![ATS Report](screenshots/ats-report.png) -->
<!-- ![CV Generator](screenshots/cv-generator.png) -->
```

## 🤝 Contribuir

Las contribuciones son bienvenidas. Revisa las convenciones del proyecto:

- UI en **español** (archivos i18n en `src/renderer/i18n/`)
- Icons con `lucide-react`
- Dark mode via `darkMode: 'class'` en Tailwind
- Los tipos compartidos van en `src/shared/types.ts`

```bash
# Crear una rama feature
git checkout -b feature/mi-nueva-feature

# Hacer commit
git commit -m "feat: descripción del cambio"

# Push y PR
git push origin feature/mi-nueva-feature
```

## 📄 Licencia

[MIT](LICENSE) — Usa, modifica y distribuye libremente.
