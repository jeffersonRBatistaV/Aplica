# AGENTS.md — Aplica

## Stack

- **Electron** (main process) + **Vite** + **React 19** (renderer) + **Tailwind CSS**
- `vite-plugin-electron` v1.1.0: Electron entry (`src/main/main.ts`) built alongside the renderer; preload uses a plain `.js` file copied directly (not built)
- TypeScript: `strict`, `moduleResolution: "bundler"`, paths `@shared/*` → `src/shared/*`, `@renderer/*` → `src/renderer/*`

## Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start Vite dev server with Electron |
| `npm run build` | Build all three targets (renderer, main, preload) |
| `npm run preview` | Vite preview of built renderer |

No tests, lint, or typecheck scripts exist.

## Architecture

### Process split

```
src/
  main/           Electron main process (Node.js)
    main.ts       App entry, BrowserWindow + IPC registration
    ipc/index.ts  All IPC handlers (chat, profile, jobs, settings, LLM)
    services/     storage.ts (JSON read/write), llm-service.ts, job-service.ts, cv-generator.ts
    utils/paths.ts  File paths for JSON persistence
  preload/
    preload.js    contextBridge: exposes window.api to renderer (plain CJS, copied not built)
  renderer/       React SPA
    App.tsx       Root: loads profile, conditionally shows ProfileWizard
    main.tsx      ReactDOM entry
    contexts/     AppContext (providers), ChatContext, NavigationContext, SettingsContext, ThemeContext
    components/   profile/, chat/, jobhub/, layout/, settings/, ui/
    data/questions.ts  All profile wizard question definitions (9 areas)
  shared/         Types shared across processes (Profile, Conversation, ATSReport, etc.)
```

### Key flow

1. **`App.tsx`** mounts → calls `window.api.getProfile()` → if null, shows `<ProfileWizard>` modal
2. Wizard answers stored in `answers: Record<string, string | string[]>` state
3. `buildProfile()` assembles a `Profile` object; `handleSave()` writes via IPC `profile:save`
4. IPC writes JSON to `{userData}/data/profile.json` (path in `paths.ts`)

### Data persistence

All storage is file-based JSON (no database):
- `{userData}/data/profile.json`
- `{userData}/data/chats.json`
- `{userData}/data/settings.json`
- `{userData}/data/jobs.json`

Helpers in `src/main/services/storage.ts`: `readJSON<T>`, `writeJSON`, `ensureDir`.

### LLM

OpenAI-compatible chat completions API, default endpoint `http://localhost:11434/v1` (Ollama). Configurable via settings UI. Streams SSE tokens to renderer.

## Critical gotchas

- **Preload must be CJS**: `package.json` has `"type": "module"`, but Electron loads preload with `require()`. The vite config for the preload entry **must** have `build.lib.formats: ['cjs']` and `fileName: () => '[name].cjs'`. The path in `main.ts` must point to `preload.cjs`. Without this, `window.api` is undefined and nothing persists.
- **Preload is plain JS**: `src/preload/preload.js` is a plain CJS file (no TypeScript). It's copied to `dist-electron/preload.cjs` by a custom Vite plugin (`copy-preload`). Attempts to build the preload through `vite-plugin-electron`'s `entry` option fail because esbuild (used for dev builds) wraps CJS output in a `__commonJS` + `export default require_preload()` pattern — this is ESM syntax in a `.cjs` file, causing Electron to throw `SyntaxError: Cannot use import statement outside a module`. The plain `.js` file avoids this entirely.
- **`type: 'single'` questions store arrays**: Despite being single-select, the wizard stores answers as `string[]` (e.g., `['Frontend']`). `buildProfile` uses `firstString()` and `Array.isArray()` checks to handle both formats. Apply `setAnswer(q.id, [opt])` (not a raw string).
- **No lint/typecheck in CI**: The only verification is `npm run build`. Type errors won't be caught by CI unless explicitly run.
- **Question data is purely in `src/renderer/data/questions.ts`**: Adding a new area or changing options requires editing this file and the `buildProfile` logic in `ProfileWizard.tsx`.

## Conventions

- UI text is in **Spanish** (es)
- `lucide-react` for icons, `@tailwindcss/typography` for prose
- Dark mode via `darkMode: 'class'` on `<html>`
- Profile wizard questions use suffixes: `_years`, `_summary`, `_role`, `_langs`, `_frameworks`, `_tools`, `_software`, `_subjects`, `_education`, `_english`, `_certs`, `_bar`
