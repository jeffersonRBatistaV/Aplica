# AGENTS.md — Aplica

AI Desktop Assistant — Chat + Job Application Hub (Electron app, v1.3.1).

## Stack

- **Electron 33** (main process) + **Vite 6** + **React 19** (renderer) + **Tailwind CSS 3** (`darkMode: 'class'`)
- `vite-plugin-electron` v1.1.0: Electron entry (`src/main/main.ts`) built alongside the renderer; preload uses a plain `.js` file copied directly (not built)
- `electron-builder` 26 + `electron-updater`: distributables (NSIS / AppImage / dmg) published to GitHub (`jeffersonRBatistaV/Aplica`), output dir `release/`
- TypeScript: `strict`, `moduleResolution: "bundler"`, paths `@shared/*` → `src/shared/*`, `@renderer/*` → `src/renderer/*`
- Runtime deps of note: `i18next` + `react-i18next` (es/en), `tesseract.js` (OCR), `xlsx` (data export/import), `driver.js` (onboarding tutorial), `react-markdown` + `remark-gfm` + `highlight.js` + `marked` (markdown rendering), `jimp`, `lucide-react`

## Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start Vite dev server with Electron |
| `npm run build` | Build all targets (renderer, main, preload copy) |
| `npm run preview` | Vite preview of built renderer |
| `npm run dist:win` / `dist:linux` / `dist:mac` | `vite build` + `electron-builder` for that platform (output in `release/`) |

No tests, lint, or typecheck scripts exist.

## Architecture

### Process split

```
src/
  main/            Electron main process (Node.js)
    main.ts        App entry: BrowserWindow, IPC registration, updater init, theme sync
    ipc/index.ts   All IPC handlers (fs, chat, jobs, CV, settings, profile, LLM, data, OCR, …)
    services/
      storage.ts           readJSON<T> / writeJSON / ensureDir
      llm-service.ts       OpenAI-compatible streaming chat completions
      job-service.ts       vacancy analysis, cover letters, interview questions
      cv-generator.ts      CV generation/regeneration per style
      cv-templates-seed.ts seed templates + HTML wrapper for PDF
      profile-reader.ts    reads Profile from JSON
      career-advice.ts     AI career advice (cached)
      roadmap-service.ts   AI job-search roadmap (cached)
      category-service.ts  job categories per area (seed/ai/custom)
      ocr-service.ts       tesseract.js OCR (+ LLM cleanup fallback)
      currency-service.ts  exchange-rate fetch
      usage-service.ts     token/cost usage stats
      updater.ts           electron-updater auto-update lifecycle
    utils/
      paths.ts             file paths for JSON persistence
      throttled-stream.ts  throttles LLM tokens (30 ms) before sending to renderer
  preload/
    preload.js    contextBridge: exposes window.api to renderer (plain CJS, copied not built)
  renderer/       React SPA
    App.tsx       Root: profile gating (wizard), API setup modal, tutorial, view switching
    main.tsx      ReactDOM entry
    contexts/     AppContext (providers), ChatContext, NavigationContext, SettingsContext, ThemeContext, NotificationContext
    components/
      chat/       ChatView, MessageBubble, StreamingMessage, CodeBlock, MessageToolbar
      input/      ChatInput (markdown, attachments, voice, image OCR)
      vacantes/   Vacantes, KanbanBoard, ATSReport, CVGenerator, CategoryCV, CoverLetterGenerator, InterviewPrep, VacancyInput, TemplatesManager, DocumentLibrary
      analytics/  Analytics
      roadmap/    RoadmapView
      layout/     MainLayout, Sidebar, ApiConnectionIndicator, TutorialGuide
      settings/   SettingsPanel, ApiConfig, ApiSetupModal, PrivacySettings, SystemPrompts, DataExport
      profile/    ProfileWizard, ProfileView
      updater/    UpdateBanner
      ui/         Button, ConfirmDialog, NotificationContainer
    hooks/        useApiConnection, useFileAttachments, useSpeechRecognition, useStreaming
    i18n/         index.ts (i18next init) + es.json + en.json
    data/questions.ts  All profile wizard question definitions (9 areas)
    types/        ipc.ts (window.api typing), attachments.ts
  shared/         Types shared across processes
    index.ts      re-exports types
    types.ts      Profile, Conversation, ATSReport, JobApplication, Roadmap, AppView, …
    categories.ts category data
```

`AppView = 'chat' | 'jobs' | 'analytics' | 'roadmap'`. All views stay **mounted** (hidden via CSS, see `App.tsx`) so in-flight state (vacancy analysis, CV generation) survives tab switches — do not unmount them.

### Key flow

1. **`App.tsx`** mounts → calls `window.api.getProfile()` → if null, shows `<ProfileWizard>` modal
2. Wizard answers stored in `answers: Record<string, string | string[]>` state
3. `buildProfile()` assembles a `Profile` object; `handleSave()` writes via IPC `profile:save`
4. After first profile creation: if `settings.api.configured` is false → `<ApiSetupModal>`; then the driver.js tutorial runs once (flag `aplica:tutorialSeen` in localStorage)
5. LLM chat: renderer calls `llm:chat`, main streams tokens from the API through `ThrottledStream` and forwards them as `llm:token` / `llm:done` / `llm:error` events

### Data persistence

All storage is file-based JSON (no database), in `{userData}/data/`:
- `profile.json` (written by `profile:save`)
- `chats.json`, `settings.json`, `jobs.json`
- `cv-templates.json`, `categories.json`, `usage.json`, `career-advice.json`, `roadmap.json`

`profile:get` reads `profile.json` first, falling back to a legacy path `~/.config/opencode/skills/cover-letter-creator/perfil.json` (`PROFILE_PATH`). Helpers in `src/main/services/storage.ts`: `readJSON<T>`, `writeJSON`, `ensureDir`.

### IPC surface

Channels grouped in `src/main/ipc/index.ts` and exposed in `src/preload/preload.js`:

- **fs**: read/write/delete/readDirectory/fileExists
- **chat**: getAll/get/save/delete/rename/archive/search
- **jobs**: getAll/get/save/delete + analyzeVacancy, correctVacancyText, generateCoverLetters, generateInterviewQuestions, generateCV, regenerateCV
- **cv**: generateSummaryOptions, downloadPdf (hidden BrowserWindow + `printToPDF`), templates CRUD + reset + generateSample
- **categories**: list/save/delete/generate (per area)
- **profile / settings / llm** (chat, abort, listModels)
- **data**: exportAll, saveExportFile (JSON | XLSX), importFromFile, processImportData
- **other**: usage, currency, clipboard (incl. image), OCR, update download/install, system theme get + change events

### LLM

OpenAI-compatible chat completions API, default endpoint `http://localhost:11434/v1` (Ollama). Configurable via settings UI (`baseUrl`/`apiKey`/`model`). Streams SSE tokens to renderer (throttled at 30 ms); supports abort and model listing.

## Critical gotchas

- **Preload must be CJS**: `package.json` has `"type": "module"`, but Electron loads preload with `require()`. The path in `main.ts` must point to `preload.cjs`. Without this, `window.api` is undefined and nothing persists.
- **Preload is plain JS**: `src/preload/preload.js` is a plain CJS file (no TypeScript). It's copied to `dist-electron/preload.cjs` by a custom Vite plugin (`copy-preload`), which also watches the source file for changes in dev. Attempts to build the preload through `vite-plugin-electron`'s `entry` option fail because esbuild (used for dev builds) wraps CJS output in a `__commonJS` + `export default require_preload()` pattern — this is ESM syntax in a `.cjs` file, causing Electron to throw `SyntaxError: Cannot use import statement outside a module`. The plain `.js` file avoids this entirely.
- **Main build externalizes `tesseract.js`**: `vite.config.ts` sets `rollupOptions.external: ['tesseract.js']` for the main entry so the OCR engine isn't bundled; keep it external.
- **`type: 'single'` questions store arrays**: Despite being single-select, the wizard stores answers as `string[]` (e.g., `['Frontend']`). `buildProfile` uses `firstString()` and `Array.isArray()` checks to handle both formats. Apply `setAnswer(q.id, [opt])` (not a raw string).
- **No lint/typecheck in CI**: The only verification is `npm run build`. Type errors won't be caught by CI unless explicitly run.
- **Question data is purely in `src/renderer/data/questions.ts`**: Adding a new area or changing options requires editing this file and the `buildProfile` logic in `ProfileWizard.tsx`.
- **i18n**: fallback language is `en`, detected from localStorage key `i18nextLng`. New UI strings must be added to both `src/renderer/i18n/es.json` and `en.json`.
- **IPC typing**: renderer relies on `window.api` types declared in `src/renderer/types/ipc.ts`. Changing an IPC channel means updating `preload.js`, `ipc/index.ts`, and `types/ipc.ts` together.

## Conventions

- UI strings are **bilingual (es/en)** via i18next; some main-process strings (export/import dialogs, PDF wrapper) are hardcoded in Spanish
- `lucide-react` for icons, `@tailwindcss/typography` for prose
- Dark mode via `darkMode: 'class'` on `<html>`; system theme forwarded from `nativeTheme` (`system:themeChanged`)
- Job statuses: `draft` → `applied` → `interview` → `offer` → `rejected`
- CV styles: `ats` | `moderno` | `tradicional`
- Profile wizard questions use suffixes: `_years`, `_summary`, `_role`, `_langs`, `_frameworks`, `_tools`, `_software`, `_subjects`, `_education`, `_english`, `_certs`, `_bar`
