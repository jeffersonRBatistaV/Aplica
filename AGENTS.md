# AGENTS.md — Aplica

AI Desktop Assistant — Chat + Job Application Hub (Electron app).

## Stack

- **Electron 43** (main process) + **Vite 6** + **React 19** (renderer) + **Tailwind CSS 3** (`darkMode: 'class'`)
- `vite-plugin-electron` v1.1.0: Electron entry (`src/main/main.ts`) built alongside the renderer; main-process deps stay external via the `notBundle()` plugin. Preload is a plain `.js` file copied directly (not built).
- `electron-builder` 26 + `electron-updater`: distributables (NSIS / AppImage / dmg) published to GitHub (`jeffersonRBatistaV/Aplica`), output dir `release/`
- TypeScript: `strict`, `moduleResolution: "bundler"`, paths `@shared/*` → `src/shared/*`, `@renderer/*` → `src/renderer/*`
- Runtime deps of note: `i18next` + `react-i18next` + `i18next-browser-languagedetector` (es/en), `tesseract.js` (OCR), `xlsx` (data export/import), `driver.js` (onboarding tutorial), `react-markdown` + `remark-gfm` + `highlight.js` + `marked` (markdown rendering), `jimp`, `lucide-react`, `nodemailer` (SMTP email), `@mozilla/readability` + `turndown` (+ `turndown-plugin-gfm`) + `jsdom` (web content extraction)

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
    main.ts        App entry: BrowserWindow, IPC registration, updater init, theme sync, interview notifications
    ipc/index.ts   All IPC handlers (fs, chat, jobs, CV, settings, profile, LLM, data, email, OCR, …)
    services/
      storage.ts           readJSON<T> / writeJSON / ensureDir
      llm-service.ts       OpenAI-compatible streaming chat completions + function-calling tools
      job-service.ts       vacancy analysis, cover letters, interview questions
      cv-generator.ts      CV generation/regeneration per style
      cv-templates-seed.ts seed templates + HTML wrapper for PDF
      profile-reader.ts    reads Profile from JSON
      profile-service.ts   multi-profile: listProfiles / saveProfile / setActiveProfile / legacy migration
      profile-data.ts      per-profile file paths (getActiveProfileFiles), scoped-data migration
      profile-scope.ts     getActiveProfile / getActiveProfileId with legacy fallbacks
      career-advice.ts     AI career advice (cached)
      roadmap-service.ts   AI job-search roadmap (cached)
      category-service.ts  job categories per area (seed/ai/custom) + folders
      investigate-service.ts  local web-research pipeline (search → extract → LLM synthesis)
      search-providers.ts  multi-provider web search (DuckDuckGo → SearXNG → Bing → Brave → Google, fallback + circuit breaker)
      content-extractor.ts web page → Markdown (Readability + Turndown, SSRF filter)
      whatsapp-service.ts  WhatsApp QR login + group scan/real-time detection of vacancies (whatsapp-web.js, OCR images)
      email-service.ts    SMTP sending via nodemailer (presets, test connection, PDF attachments)
      ocr-service.ts       tesseract.js OCR (+ LLM cleanup fallback)
      currency-service.ts  exchange-rate fetch
      usage-service.ts     token/cost usage stats
      updater.ts           electron-updater auto-update lifecycle
    utils/
      paths.ts             file paths for JSON persistence (global + per-profile)
      throttled-stream.ts  throttles LLM tokens (30 ms) before sending to renderer
  preload/
    preload.js    contextBridge: exposes window.api to renderer (plain CJS, copied not built)
  renderer/       React SPA
    App.tsx       Root: profile gating (wizard), API setup modal, tutorial, WhatsNew, view switching
    main.tsx      ReactDOM entry
    contexts/     AppContext (providers), ChatContext, NavigationContext, SettingsContext, ThemeContext, NotificationContext
    components/
      chat/       ChatView, MessageBubble, StreamingMessage, CodeBlock, MessageToolbar
      input/      ChatInput (markdown, attachments, voice, image OCR)
      vacantes/   Vacantes, KanbanBoard, ATSReport, CVGenerator, CategoryCV, CoverLetterGenerator, InterviewPrep, VacancyInput, TemplatesManager, DocumentLibrary
      whatsapp/   WhatsAppView, WhatsAppLogin (QR), WhatsAppQueue (review queue → import to CV flow)
      analytics/  Analytics
      roadmap/    RoadmapView
      layout/     MainLayout, Sidebar, ApiConnectionIndicator, TutorialGuide
      settings/   SettingsPanel, ApiConfig, ApiSetupModal, PrivacySettings, SystemPrompts, DataExport, EmailConfig, ResearchConfig, OcrSettings
      profile/    ProfileWizard, ProfileView
      updater/    UpdateBanner
      ui/         Button, ConfirmDialog, NotificationContainer, WhatsNewModal
    hooks/        useApiConnection, useFileAttachments, useSpeechRecognition, useStreaming
    i18n/         index.ts (i18next init) + es.json + en.json
    data/questions.ts  All profile wizard question definitions (9 areas)
    types/        ipc.ts (window.api typing), attachments.ts
  shared/         Types shared across processes
    index.ts      re-exports types
    types.ts      Profile, Conversation, ATSReport, JobApplication, Roadmap, AppView, WhatsAppVacancy, …
    categories.ts category data
    vacancy-detection.ts  heuristic vacancy detector (keywords, company/position extraction, category scoring)
```

`AppView = 'chat' | 'jobs' | 'analytics' | 'roadmap' | 'whatsapp'`. All views stay **mounted** (hidden via CSS, see `App.tsx`) so in-flight state (vacancy analysis, CV generation, WhatsApp scan) survives tab switches — do not unmount them.

### Key flow

1. **`App.tsx`** mounts → calls `window.api.getProfile()` → wizard opens only if **no profile with data** exists (`listProfiles()` checks `name`/`email`); empty profiles go to the sidebar selector instead
2. Wizard answers stored in `answers: Record<string, string | string[]>` state; `buildProfile()` assembles a `Profile`; `handleSave()` writes via `profile:save`
3. After first profile creation: if `settings.api.configured` is false → `<ApiSetupModal>`; then the driver.js tutorial runs once (flag `aplica:tutorialSeen` in localStorage)
4. On launch with a new app version, `<WhatsNewModal>` opens comparing `app:getVersion()` against `settings.lastSeenVersion`
5. LLM chat: renderer calls `llm:chat`; main streams tokens through `ThrottledStream` and forwards them as `llm:token` / `llm:done` / `llm:error` events

### Web research & email (recent features)

- **Local investigate pipeline** (`investigate-service.ts`) replaced the old remote VPS backend: search (`search-providers.ts`) → extract pages to Markdown (`content-extractor.ts`, Readability + Turndown, SSRF-blocked) → LLM synthesis with sources. Progress status streams via `investigate:phase`. Used by career-advice, roadmap, salary comparison, and the chat tool `investigate_web`.
- **Chat uses OpenAI function-calling tools** in `llm-service.ts`: `investigate_web` (live web search) and `get_app_data` (reads the user's real jobs/roadmap/usage/CV-template files and returns summaries). Tool schemas follow the OpenAI `tools: [{ type: 'function', … }]` contract.
- **SMTP email** (`email-service.ts`, nodemailer): presets for gmail/outlook/yahoo/icloud/zoho, `email:test`, `email:send` with attachments (CVs rendered in memory via `cv:renderPdfBase64`).
- **WhatsApp vacancy detection** (`whatsapp-service.ts`, whatsapp-web.js + LocalAuth, session in `{userData}/whatsapp-session`): QR login → user selects groups → manual scan (`whatsapp:scan`) and/or real-time monitoring (`whatsapp:setConfig`, message events auto-trigger OCR on images). Detected vacancies flow to `vacancy-detection.ts` (heuristics) → review queue in `whatsapp.json` → import dispatches `aplica:vacancyImport`. Browser = puppeteer bundled Chrome, or fallback to system Chrome/Edge via `resolveBrowserExecutable()`. OCR method honors `settings.ocr.method` (`auto`/`tesseract`/`vision`).

### Data persistence

All storage is file-based JSON (no database), in `{userData}/data/`:

**Global (shared across profiles):**
- `profile.json` (active profile mirror, written by `profile:save` / `profile:setActive`)
- `profiles.json` (all profiles + `activeId`), `settings.json`, `cv-templates.json`, `device-id.txt`

**Per-profile** in `{userData}/data/profiles-data/{profileId}/`:
- `chats.json`, `jobs.json`, `usage.json`, `career-advice.json`, `roadmap.json`, `categories.json`, `folders.json`, `cv-versions.json`, `email-config.json`, `whatsapp.json`

WhatsApp session (`{userData}/whatsapp-session`, LocalAuth) is **global** (one phone = one device), not per-profile.

Each profile gets its own folder; switching or creating one isolates chats, vacancies, stats, roadmap, advice, categories, folders, CV history, and email creds. On startup `migrateProfileScopedData()` and `migrateLegacyEmailConfig()` (in `src/main/services/profile-data.ts`) move legacy `{userData}/data/` files (and `settings.json`'s old `emailConfig`) into the active profile's folder once. Resolvers: `profile-scope.ts` (`getActiveProfile`) and `profile-data.ts` (`getActiveProfileFiles`), falling back to legacy `DATA_DIR` files when no profile exists.

`profile:get` reads `profile.json` first, then the active entry of `profiles.json`, then legacy `~/.config/opencode/skills/cover-letter-creator/perfil.json` (`PROFILE_PATH`). Helpers: `src/main/services/storage.ts` (`readJSON<T>`, `writeJSON`, `ensureDir`).

### IPC surface

Channels grouped in `src/main/ipc/index.ts`, exposed in `src/preload/preload.js`, typed in `src/renderer/types/ipc.ts`:

- **fs**: readFile/writeFile/deleteFile/readDirectory/fileExists
- **chat**: getAll/get/save/delete/rename/archive/search
- **jobs**: getAll/get/save/delete + analyzeVacancy (`job:analyze`), correctVacancy (`job:correctVacancy`), generateCoverLetters, generateInterviewQuestions, generateCV, regenerateCV, getUpcomingInterviews, getCvVersions (history, max 10/job)
- **cv**: getTemplates/saveTemplate/deleteTemplate/resetTemplates/generateSample, generateSummaryOptions, downloadPdf + renderPdfBase64 (hidden BrowserWindow + `printToPDF`)
- **categories**: list/save/delete/generate (+ folder list/save/delete)
- **profile**: get/save/list/setActive/migrate
- **settings**: get/set — **except email config**, which is per-profile via `emailConfig:get/set`
- **llm**: chat, abort, listModels
- **investigate**: query, health, discover
- **whatsapp**: status/connect/disconnect/getGroups/scan/getQueue/markImported/getConfig/setConfig — events `whatsapp:event` (`status` | `vacancy` | `phase`)
- **email**: presets, test, send — via `email:presets`/`email:test`/`email:send`
- **data**: exportAll, saveExportFile (JSON | XLSX), importFromFile, processImportData
- **other**: usage, currency, clipboard (incl. image), OCR (`ocr:imageToText`), update download/install, `system:getTheme` + change events, `app:getVersion`

### LLM

OpenAI-compatible chat completions API, default endpoint `http://localhost:11434/v1` (Ollama). Configurable via settings (`baseUrl`/`apiKey`/`model`/`visionModel`). Streams SSE tokens to renderer (throttled at 30 ms); supports abort and model listing. Chat always sends the `investigate_web` and `get_app_data` tools (see above).

## Critical gotchas

- **All IPC handlers must stay behind `safeHandle()`**: `src/main/ipc/index.ts` wraps every channel with sender validation (`event.senderFrame.url` must be `file://` or localhost). Bypassing it is an anti-RCE regression — never register a bare `ipcMain.handle`.
- **Main-process deps are externalized, not bundled**: `vite.config.ts` applies `notBundle()` to the main entry so Node/CJS deps (jsdom, turndown, readability, tesseract, nodemailer, xlsx, …) load from `node_modules` via `require`, never bundled as ESM. Adding a new main dependency: prefer CJS-compatible packages and keep them external.
- **Preload must be CJS**: `package.json` has `"type": "module"`, but Electron loads preload with `require()`. `main.ts` must point to `preload.cjs`. Without this, `window.api` is undefined and nothing persists.
- **Preload is plain JS**: `src/preload/preload.js` is plain CJS (no TypeScript), copied to `dist-electron/preload.cjs` by the custom `copy-preload` Vite plugin (watched in dev). Building it through `vite-plugin-electron`'s `entry` fails (esbuild wraps CJS in ESM `__commonJS` + `export default` → `SyntaxError: Cannot use import statement outside a module` in a `.cjs` file).
- **Email config lives per-profile, not in settings**: stored in `profiles-data/{id}/email-config.json`. `AppSettings.emailConfig` is a legacy field that `migrateLegacyEmailConfig()` removes on startup — don't reintroduce it.
- **`type: 'single'` questions store arrays**: despite being single-select, wizard answers are `string[]` (e.g., `['Frontend']`). `buildProfile` handles both via `firstString()`/`Array.isArray()`. Apply `setAnswer(q.id, [opt])`, not a raw string.
- **No lint/typecheck in CI**: the only verification is `npm run build`. Type errors aren't caught unless asked for (`npx tsc --noEmit`).
- **Question data is purely in `src/renderer/data/questions.ts`**: adding an area/option requires editing that file and the `buildProfile` logic in `ProfileWizard.tsx`.
- **i18n**: fallback language is `en`, detected from localStorage key `i18nextLng`. New UI strings must be added to both `src/renderer/i18n/es.json` and `en.json`.
- **IPC typing**: change an IPC channel → update `preload.js`, `ipc/index.ts`, and `types/ipc.ts` together.

## Conventions

- UI strings are **bilingual (es/en)** via i18next; some main-process strings (export/import dialogs, PDF wrapper, SMTP errors) are hardcoded in Spanish
- `lucide-react` for icons, `@tailwindcss/typography` for prose
- Dark mode via `darkMode: 'class'` on `<html>`; system theme forwarded from `nativeTheme` (`system:themeChanged`)
- Job statuses: `draft` → `applied` → `interview` → `offer` → `rejected`
- CV styles: `ats` | `moderno` | `tradicional`
- Profile wizard questions use suffixes: `_years`, `_summary`, `_role`, `_langs`, `_frameworks`, `_tools`, `_software`, `_subjects`, `_education`, `_english`, `_certs`, `_bar`
- Phase/progress callbacks are sent over events (`investigate:phase`, `whatsapp:event`) from the main process while long jobs run; register listeners in preload + types