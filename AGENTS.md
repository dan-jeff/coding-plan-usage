# Agent Notes for coding-usage

This repository is an Electron + React (Vite) desktop app for tracking usage.
These notes are for coding agents operating in this repo.

## Commands (npm)

Builds

- `npm run build` -> builds renderer + electron assets + preload + types
- `npm run build:electron` -> Vite build for electron bundle
- `npm run build:preload` -> compiles `electron/preload.ts` to CJS
- `npm run dist` -> build then package with electron-builder
- `npm run dist:win` -> Windows packaging
- `npm run dist:linux` -> Linux packaging

Dev

- `npm run dev` -> Vite dev server + Electron (uses preload build)
- `npm run preview` -> Vite preview (renderer only)

Lint/format

- `npm run lint` -> ESLint for `.ts/.tsx`
- `npm run format` -> Prettier write

Versioning

- `npm run version:get` -> prints git-derived version
- `npm run version:stamp` -> updates package.json version

Tests

- No test runner or `npm run test` script is configured.
- There are no `*.test.*` or `*.spec.*` files.
- Single-test command: not available until a test runner is added.
  If you add tests, also add `npm run test` and document single-test usage here.

## Repo layout

- `src/` -> React renderer
- `electron/` -> main process, preload, polling, secure storage
- `dist/`, `dist-electron/` -> build outputs (do not edit)
- `scripts/` -> versioning and icon generation
- `vite.config.ts`, `vite.electron.config.ts` -> Vite configs

## Code style and formatting

Prettier

- Config in `.prettierrc` (2 spaces, 80 cols, single quotes, semicolons).
- Run `npm run format` after large changes.

ESLint

- Config in `.eslintrc.cjs` with React + TS rules and `eslint-config-prettier`.
- React in JSX scope rule is disabled (React 17+ JSX).

Imports

- External libraries first, then local modules.
- Type-only imports use `import type` (see `src/App.tsx`).
- Electron main uses ESM; when importing local TS modules, use `.js` extension
  (e.g. `./poller.js`) because output is ESM and Node requires extensions.

Formatting and layout

- Prefer `const` and arrow functions for handlers.
- Keep JSX readable; line-wrap at ~80 columns.
- Use object literals for inline styles; avoid magic numbers without context.

## TypeScript

- `tsconfig.json` is `strict: true` and `noEmit: true` for app code.
- Use explicit types for state and props when not obvious.
- Provider keys are a fixed union (see `src/types.ts`).
- Use narrow literal unions for settings (e.g. `'week' | 'month' | 'all'`).

## React patterns

- Components are function components; `React.FC` is used in some files.
- State lives in `src/App.tsx` with derived props passed to components.
- UI uses inline style objects from `getStyles()` and `getTheme()` in `src/theme.ts`.
- Use `useEffect` for async side effects; wrap async calls in `try/catch`.
- `useLayoutEffect` is used for sizing and window resize behavior.

UI and styling

- Prefer inline style objects over new CSS files for component styling.
- Keep glass/blur styling consistent with `getTheme()` tokens.
- Global styles live in `src/index.css`; keep them minimal.

## Electron main process

- Entry is `electron/main.ts` (ESM). Preload is `electron/preload.ts`.
- IPC channels are namespaced and typed via `window.electronAPI` in `src/types.ts`.
- Store settings via `electron/secure-store.ts` helpers.
- Keep Windows/Linux branching explicit (auto-launch, paths).
- When touching update flow, follow existing `electron-updater` patterns.

Preload and IPC

- Renderer code must use `window.electronAPI`; do not import Node APIs in React.
- Keep IPC handlers small and return safe defaults on failure.
- If you add new IPC channels, update `src/types.ts` and preload wiring.

## Error handling and logging

Renderer

- Log with `console.error` / `console.warn` for UI-side failures.
- Avoid throwing in React render paths; fail gracefully with fallback UI.

Main process

- Use `debug/info/warn/error` from `electron/logger.ts` for structured logs.
- Wrap async handlers in `try/catch`; return safe defaults on failure.

## Naming conventions

- Components: PascalCase (`UsageDetailsWindow`).
- Functions/variables: camelCase (`handleRefreshIntervalChange`).
- Constants: UPPER_SNAKE_CASE (`DEFAULT_PROVIDER_ORDER`).
- Provider keys: snake_case strings (`z_ai`, `external_models`).

## Data and domain notes

- Provider data types live in `src/types.ts` and are shared across renderer.
- `ProviderAccentColors` defines color map; defaults in `DEFAULT_PROVIDER_COLORS`.
- Usage history entries are `{ provider, timestamp, percentage }`.

## Versioning rules

- Never edit the `version` in `package.json` manually.
- Versions are derived from git tags; see `README.md` versioning section.
- Build scripts auto-run `version:stamp` when not in CI.

## Generated artifacts

- `dist/` and `dist-electron/` are build outputs; do not edit manually.
- If you need to regenerate assets, use the build scripts.

## Cursor/Copilot rules

- No Cursor rules found in `.cursor/rules/` or `.cursorrules`.
- No Copilot instructions found in `.github/copilot-instructions.md`.
