# Fiscenix Web — Entrega 0 (Base) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `despachoapp-vue` with the Fiscenix renderer running entirely in the browser on a simulated `window.contapp`, so a visitor can "Entrar a la demo" with a profile, see the Fiscenix shell and an empty Inicio, and lose everything on reload. Ready to publish as a static Vercel site.

**Architecture:** `src/` and `shared/` are copied verbatim from ContaApp2 at commit `c0c00bf`. `src/main.ts` installs `window.contapp = createDemoApi(createDemoStore())` before mounting. `createDemoApi` returns a full `DesktopApi` (`shared/contracts/desktop.ts`): session, platform, preferences and branding are simulated, and every other method rejects with `DemoUnavailableError` until its delivery implements it. In delivery 0 every profile has `noWorkspaceAccess`, so Fiscenix itself hides all module sections and Inicio loads nothing.

**Tech Stack:** Vue 3.5, Vite 7, TypeScript 5.9 strict, Vitest 5, Playwright 1.63, Vercel static hosting.

**Spec:** `docs/superpowers/specs/2026-11-18-fiscenix-web-design.md`

## Global Constraints

- Source: ContaApp2 branch `legacy-migration`, commit `c0c00bf`, copied with `git archive` (never the live working tree).
- Dependency versions are the exact ones in `ContaApp2/package.json` at `c0c00bf`. Add no dependency that ContaApp2 does not already use.
- Rules from `ContaApp2/AGENTS.md` apply: English technical names, `camelCase`, no `_` in identifiers, `is/has/can/should` booleans, TypeScript `strict` and `noUncheckedIndexedAccess`, no `any`, one responsibility per file, comments explaining flows and contracts.
- Visitor data lives only in memory: no `sessionStorage`, no IndexedDB, no cookies. Only preferences go to `localStorage`, under key `fiscenixWeb.localPreferences`.
- No network requests outside the page's own origin. CSP `connect-src 'self'`.
- Demo password for every profile: `demo1234`.
- Banner copy, exact: `Demo · los datos se borran al recargar · SAT y correo simulados`.
- Repo link in the banner: `https://github.com/nullpoint-Software/despachoapp-vue`.
- Work on branch `fiscenix-web` of `despachoapp-vue`. `docs/Obsidian/` is the user's untracked folder: never stage, move or delete it.
- Node ≥ 22.12 (system Node 22.13 works; Vite 7 requires it).

## Review Focus

1. **`localStorage` throws** (private mode, blocked storage): preferences fall back to `defaultPreferences` and the app still loads. Test: Task 3, `falls back to defaults when storage throws`.
2. **Corrupt preferences in storage** (invalid JSON, an old shape): defaults are returned, and the next update overwrites the bad value. Test: Task 3, `ignores corrupt stored preferences`.
3. **Username with uppercase or surrounding spaces** (`  Admin.Demo `): signs in, like Fiscenix lowercases it. Test: Task 2, `accepts the username regardless of case and spaces`.
4. **A screen calls a method not built yet**: the promise rejects with `DemoUnavailableError` and a Spanish message; nothing throws synchronously or crashes the app. Tests: Task 3, `rejects unavailable methods with DemoUnavailableError`, and Task 4 e2e `opens Configuración without page errors`.
5. **Deep link or reload on a non-root path** (`/clientes`): the SPA still loads on the login screen. Test: Task 4 e2e `serves the app on unknown paths`.

---

### Task 1: Branch, retire the legacy and bring in the Fiscenix renderer

**Files:**
- Delete (tracked): everything in `despachoapp-vue` except `docs/superpowers/**`, `skills-lock.json` and `.git`
- Create from ContaApp2 `c0c00bf`: `src/**`, `shared/**`, `DESIGN.md`, `eslint.config.mjs`
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`
- Create (filtered copy): `tests/unit/**`, `tests/support/**` (only what the copied unit tests import)

**Interfaces:**
- Produces: the Fiscenix renderer at `src/` (entry `src/index.html` → `src/main.ts`), the shared contracts at `shared/contracts/*`, and scripts `dev`, `build`, `preview`, `typecheck`, `lint`, `test` and `test:e2e`.

- [ ] **Step 1: Set the restyle aside and create the branch**

```bash
git stash push -m "restyle 2026-11-18 (superseded by fiscenix-web)"
git switch -c fiscenix-web
git add docs/superpowers
git commit -m "docs: fiscenix web design and delivery 0 plan"
```
Expected: `git status --short` shows only `?? docs/Obsidian/`.

- [ ] **Step 2: Remove the legacy tracked files**

`git ls-files` minus `docs/superpowers/*` and `skills-lock.json`, piped to `git rm -q`. Expected: `git ls-files` lists only the spec, the plan and `skills-lock.json`. Untracked folders (`docs/Obsidian`, `node_modules`, `dist`, `logs`, `tmp`) are left as they are.

- [ ] **Step 3: Extract the Fiscenix renderer at the frozen commit**

```bash
git -C ../ContaApp2 archive c0c00bf src shared DESIGN.md eslint.config.mjs | tar -x
```
Expected: `src/main.ts`, `src/App.vue`, `src/env.d.ts` and `shared/contracts/desktop.ts` exist.

- [ ] **Step 4: Write the toolchain files**

- `package.json`: name `fiscenix-web`, `"type": "module"`, `"private": true`, engines `node >=22.12`. Scripts: `dev: vite`, `build: vite build`, `preview: vite preview`, `typecheck: vue-tsc --noEmit -p tsconfig.json`, `lint: eslint .`, `test: vitest run`, `test:e2e: playwright test`, `check: npm run typecheck && npm run lint && npm test && npm run build`. Dependencies: exactly the ContaApp2 dependencies imported somewhere under `src/` or `shared/` (today: `@fontsource-variable/geist`, `@fontsource-variable/geist-mono`, `@lucide/vue`, every `@tiptap/*`, `gsap`, `jsqr`, `jszip`, `katex`, `luxon`, `motion-v`, `ogl`, `pdfjs-dist`, `fast-xml-parser`, `zod`, `vue`; confirm with grep and drop what isn't imported), at ContaApp2's versions. DevDependencies at ContaApp2's versions: `typescript`, `vite`, `@vitejs/plugin-vue`, `vitest`, `vue-tsc`, `@types/node`, `@playwright/test`, and the ESLint packages `eslint.config.mjs` imports.
- `vite.config.ts`: `root: 'src'`, `build.outDir: '../dist'` with `emptyOutDir: true`, `publicDir: false`. The Vue plugin goes with ContaApp2's `isCustomElement: tag => tag === 'selectedcontent'`. Also ContaApp2's dev-only `transformIndexHtml` that relaxes `style-src` to `'unsafe-inline'` and `connect-src` to `'self' ws:` during `vite dev` only.
- `tsconfig.json`: ContaApp2's compiler options unchanged; `include`: `shared/**/*.ts`, `src/**/*.ts`, `src/**/*.vue`, `tests/**/*.ts`, `*.config.ts`.
- `vitest.config.ts`: `include: ['tests/unit/**/*.test.ts']`, `testTimeout: 15000`.
- `eslint.config.mjs`: remove the `electron/**` and `server/**` globs and settings. Everything else stays as in ContaApp2.
- `.gitignore`: `node_modules`, `dist`, `test-results`, `playwright-report`, `*.log`, `.vercel`, `/docs/Obsidian/`. Don't copy the legacy one: it ignored `env.d.ts`, which Fiscenix needs.

- [ ] **Step 5: Copy the unit tests that only touch the renderer and shared code**

From ContaApp2 `tests/unit/**/*.test.ts` at `c0c00bf`, copy every file whose relative imports reach only `src/`, `shared/` or `tests/support/`, and that imports none of `electron`, `better-sqlite3`, `mysql2`, `playwright-core`, `express`, `ws`, `nodemailer` or `bonjour-service`. Copy the `tests/support/` files those tests import. Record in the commit message how many tests were copied and how many skipped.

- [ ] **Step 6: Install and verify**

```bash
npm install
npm run typecheck
npm test
npm run build
```
Expected: typecheck exits 0; every copied test passes; build writes `dist/index.html`. If the build fails because a module in the renderer graph imports `node:crypto` or another Node built-in, find who imports it from `src/` and fix it by removing that renderer path in Task 3 or 5, not by polyfilling. Opening the site still shows a blank page, because nothing installs `window.contapp` yet.

- [ ] **Step 7: Commit**

```bash
git add -A -- . ':!docs/Obsidian'
git commit -m "feat: replace legacy app with the Fiscenix renderer at c0c00bf"
```

---

### Task 2: Demo profiles, store and session

**Files:**
- Create: `src/demo/demoProfiles.ts`, `src/demo/demoSeed.ts`, `src/demo/demoStore.ts`, `src/demo/handlers/demoSessionHandler.ts`
- Test: `tests/unit/demo/demoSessionHandler.test.ts`

**Interfaces:**
- Consumes: `DesktopApi`, `SessionStatus`, `LoginRequest`, `WorkspaceAccess`, `noWorkspaceAccess` and `OfficeBranding` from `shared/contracts/*`.
- Produces:
  - `type DemoProfileId = 'administrator' | 'accountant' | 'assistant'`
  - `interface DemoProfile { profileId: DemoProfileId; username: string; displayName: string; roleName: string; access: WorkspaceAccess }`
  - `const demoProfiles: readonly DemoProfile[]` (in this order: administrator, accountant, assistant)
  - `const demoPassword = 'demo1234'`
  - `interface DemoUser { userId: string; username: string; displayName: string; profileId: DemoProfileId; password: string }`
  - `interface DemoSession { userId: string; expiresAt: Date }`
  - `interface DemoStore { users: DemoUser[]; branding: OfficeBranding; session: DemoSession | null }`
  - `createDemoSeed(): Pick<DemoStore, 'users' | 'branding'>`
  - `createDemoStore(): DemoStore` (seed plus `session: null`; a fresh object on every call)
  - `createDemoSessionHandler(store: DemoStore, now: () => Date): Pick<DesktopApi, 'authenticateUser' | 'manageSession' | 'readWorkspaceAccess' | 'changeOwnPassword'>`
  - `const demoSessionDurationMilliseconds = 8 * 60 * 60 * 1000`

Profile values:

| profileId | username | displayName | roleName | access in delivery 0 |
|---|---|---|---|---|
| administrator | `admin.demo` | Ana Torres | Administrador | `{ ...noWorkspaceAccess }` |
| accountant | `contador.demo` | Luis Méndez | Contador | `{ ...noWorkspaceAccess }` |
| assistant | `auxiliar.demo` | Carla Ruiz | Auxiliar | `{ ...noWorkspaceAccess }` |

Branding seed: `{ officeName: 'Despacho Demo', logoDataUrl: null }`. User ids are fixed UUID strings, so tests and later seeds can reference them.

- [ ] **Step 1: Write the failing tests**

```ts
describe('demoSessionHandler', () => {
  const fixedNow = new Date('2026-11-18T10:00:00Z')
  it('signs in a profile with the demo password', async () => {
    const store = createDemoStore(); const handler = createDemoSessionHandler(store, () => fixedNow)
    const status = await handler.authenticateUser({ username: 'admin.demo', password: 'demo1234' })
    expect(status).toEqual({ state: 'authenticated', user: { userId: store.users[0]!.userId, displayName: 'Ana Torres' }, expiresAt: '2026-11-18T18:00:00.000Z' })
  })
  it('accepts the username regardless of case and spaces', async () => { /* '  Admin.Demo ' → authenticated */ })
  it('rejects a wrong password or unknown user without creating a session', async () => { /* rejects; store.session stays null */ })
  it('reports status, keeps it on activity and clears it on logout and logoutAll', async () => { /* status → authenticated; 'logout' → { state: 'signedOut', user: null, expiresAt: null } */ })
  it('reports signedOut after the session expires', async () => { /* now advances 8 h + 1 ms → status signedOut */ })
  it('returns the profile access while signed in and noWorkspaceAccess otherwise', async () => {})
  it('refuses to change the demo password', async () => { /* rejects with message 'La contraseña de la demo no se puede cambiar.' */ })
  it('starts every store fresh and signed out', () => { /* createDemoStore() !== createDemoStore(); session null; mutating one leaves the other intact */ })
})
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npx vitest run tests/unit/demo/demoSessionHandler.test.ts`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement the profiles, seed, store and session handler in the listed files**

`authenticateUser` trims and lowercases the username, finds the user and compares the password. On a match it replaces `store.session` and returns the status; otherwise it rejects with `Error('Invalid credentials')`. Expiry is `now() + demoSessionDurationMilliseconds`. Every method checks expiry against `now()` and clears an expired session. The file header comment says the session is EPHEMERAL (memory only), and that the password is public on purpose so the ADR-038 reconfirmation can still be exercised.

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx vitest run tests/unit/demo/demoSessionHandler.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/demo tests/unit/demo
git commit -m "feat(demo): profiles, in-memory store and simulated session"
```

---

### Task 3: Platform, preferences, branding and the assembled `createDemoApi`

**Files:**
- Create: `src/demo/demoUnavailable.ts`, `src/demo/handlers/demoPlatformHandler.ts`, `src/demo/handlers/demoPreferencesHandler.ts`, `src/demo/handlers/demoBrandingHandler.ts`, `src/demo/createDemoApi.ts`
- Modify: `src/main.ts` (install the API before `createApp`)
- Test: `tests/unit/demo/demoPreferencesHandler.test.ts`, `tests/unit/demo/createDemoApi.test.ts`

**Interfaces:**
- Consumes: Task 2's `DemoStore`, `createDemoStore` and `createDemoSessionHandler`; `defaultPreferences`, `parseLocalPreferences` and `parsePreferencesPatch` from `shared/contracts/localPreferences.ts`; `InstallationInformation`, `PairingStatus`, `HostStatus`, `HostEventsStatus` and `ApplicationInformation` from `shared/contracts/*`.
- Produces:
  - `class DemoUnavailableError extends Error` (with `name = 'DemoUnavailableError'`)
  - `rejectInDemo(methodName: keyof DesktopApi): () => Promise<never>`, message `` `${methodName} no está disponible en la demo web.` ``
  - `const demoPreferencesStorageKey = 'fiscenixWeb.localPreferences'`
  - `createDemoPreferencesHandler(storage: Pick<Storage, 'getItem' | 'setItem'> | null): Pick<DesktopApi, 'readLocalPreferences' | 'updateLocalPreferences' | 'listLocalPrinters'>`
  - `createDemoPlatformHandler(reloadPage: () => void): Pick<DesktopApi, 'getInstallationInformation' | 'managePairing' | 'getHostStatus' | 'getManagedDatabaseStatus' | 'getApplicationInformation' | 'manageHostEvents' | 'quitApplication' | 'restartApplication'>`
  - `createDemoBrandingHandler(store: DemoStore): Pick<DesktopApi, 'getOfficeBranding'>`
  - `createDemoApi(store: DemoStore, options?: { now?: () => Date; storage?: Pick<Storage, 'getItem' | 'setItem'> | null; reloadPage?: () => void }): DesktopApi`

Platform constants: the values of each contract type that make `prepareDeviceAtStartup` (`src/modules/workspace/sessionState.ts`) take the **client** path straight to `evaluatePhase`. That means installation `mode` and `activeMode` are `'client'`, `requiresRestart` is `false`, pairing `state` is `'paired'`, host status `state` is `'pairingRequired'`, the managed database is not managed, and host events report connected. Fill in the remaining fields of each contract with neutral values. `getApplicationInformation` returns `{ version: '0.1.0', platform: 'web' }`. `quitApplication` and `restartApplication` call `reloadPage`; reloading also wipes the visitor's data, which is the intended demo behavior. `listLocalPrinters` returns `[]`.

`createDemoApi` builds an object literal typed `DesktopApi`: the four handlers spread, plus every remaining key as `rejectInDemo('<key>')`, listed explicitly. The type checker must fail if a key is missing.

- [ ] **Step 1: Write the failing tests**

```ts
describe('demoPreferencesHandler', () => {
  it('reads defaults when nothing is stored', async () => {})
  it('persists an update and reads it back with a new handler', async () => { /* theme: 'dark' survives a new handler on the same storage */ })
  it('falls back to defaults when storage throws', async () => { /* getItem/setItem throw → read returns defaultPreferences; update resolves with the merged value */ })
  it('falls back to defaults when storage is null', async () => {})
  it('ignores corrupt stored preferences', async () => { /* '{not json' and '{"theme":"neon"}' → defaults; a later update overwrites the key */ })
})
describe('createDemoApi', () => {
  it('rejects unavailable methods with DemoUnavailableError', async () => {
    const api = createDemoApi(createDemoStore(), { storage: null })
    await expect(api.manageLinkFile('export')).rejects.toBeInstanceOf(DemoUnavailableError)
    await expect(api.manageClients({ action: 'list', afterClientId: null })).rejects.toThrow('manageClients no está disponible en la demo web.')
  })
  it('takes the client startup path', async () => { /* getInstallationInformation().activeMode === 'client'; managePairing('status').state === 'paired' */ })
  it('serves the seeded branding', async () => { /* officeName 'Despacho Demo' */ })
  it('signs in through the assembled api', async () => {})
  it('calls reloadPage on quit and restart', async () => {})
})
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npx vitest run tests/unit/demo`
Expected: the Task 3 files fail (modules not found); Task 2 still passes.

- [ ] **Step 3: Implement the files above**

Preferences: read with `JSON.parse` plus `parseLocalPreferences` inside `try`, falling back to `defaultPreferences`. Update with `parsePreferencesPatch`, merge, then write in a `try` that ignores storage failures. The comment states this is LOCAL device data and the only thing that survives a reload.

- [ ] **Step 4: Install the API in `src/main.ts`**

Before `createApp(App)`, add `window.contapp = createDemoApi(createDemoStore(), { storage: readBrowserStorage(), reloadPage: () => window.location.reload() })`. `readBrowserStorage` returns `window.localStorage`, or `null` when accessing it throws. Add a one-line comment that a fresh store on every page load is what makes data disappear on reload.

- [ ] **Step 5: Run the tests, typecheck and build**

```bash
npx vitest run tests/unit/demo
npm run typecheck
npm run build
```
Expected: all demo tests pass (13), typecheck exits 0, the build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/demo src/main.ts tests/unit/demo
git commit -m "feat(demo): platform, preferences and branding; install createDemoApi"
```

---

### Task 4: Demo access, banner, desktop-only UI removed, and the e2e smoke test

**Files:**
- Create: `src/demo/components/DemoAccessPanel.vue`, `src/demo/components/DemoBanner.vue`, `playwright.config.ts`, `tests/e2e/demoBase.spec.ts`
- Modify: `src/modules/workspace/LoginPage.vue`, `src/App.vue`, `src/modules/settings/ConfigurationPage.vue` (and the settings components it renders, only to remove desktop-only parts)

**Interfaces:**
- Consumes: `demoProfiles` and `demoPassword` (Task 2); `signIn(username, password)` from `src/modules/workspace/sessionState.ts`; `ActionButton` and `InlineNotice` from `src/shared/components/`.
- Produces: `DemoAccessPanel` (no props; `data-testid="demo-access"`, with one button per profile, `data-testid="demo-profile-<profileId>"`, labelled with `roleName` and `displayName`) and `DemoBanner` (no props; `data-testid="demo-banner"`).

- [ ] **Step 1: Write the failing e2e tests**

`playwright.config.ts`: `webServer: { command: 'npm run build && npm run preview -- --port 4173 --strictPort', url: 'http://localhost:4173', reuseExistingServer: true }`, `use.baseURL` the same URL, and the Chromium project only.

```ts
test('shows the banner and the demo access on load', async ({ page }) => { /* demo-banner contains 'Demo · los datos se borran al recargar · SAT y correo simulados'; demo-access visible with 3 profiles */ })
test('enters as Administrador and lands on Inicio', async ({ page }) => { /* click demo-profile-administrator → session-user shows 'Ana Torres' */ })
test('forgets the session on reload', async ({ page }) => { /* enter, reload → login-page visible */ })
test('typed login accepts the demo password and rejects a wrong one', async ({ page }) => { /* 'contador.demo'/'demo1234' → Luis Méndez; 'x' → error text starting 'No se pudo iniciar sesión' */ })
test('opens Configuración without page errors', async ({ page }) => { /* collect pageerror; enter; open Configuración; expect no pageerror */ })
test('serves the app on unknown paths', async ({ page }) => { /* goto('/clientes') → login-page visible */ })
test('never requests another origin', async ({ page }) => { /* page.on('request'): every URL starts with baseURL or is data:/blob: during the flows above */ })
```

- [ ] **Step 2: Run them and confirm they fail**

```bash
npx playwright install chromium
npm run test:e2e
```
Expected: FAIL (`demo-banner` and `demo-access` not found).

- [ ] **Step 3: Build the two components and wire them in**

- `DemoAccessPanel`: a "Entrar a la demo" heading, the three profile buttons (each calls `signIn(profile.username, demoPassword)` and shows Fiscenix's error notice on failure), and a line with the exact text `Contraseña de la demo: demo1234 (se pide para confirmar acciones sensibles).`. It uses Fiscenix's components and tokens, with no new styles beyond layout.
- `LoginPage.vue`: render `DemoAccessPanel` above the existing username/password form, which stays. Remove the "review connection" control and the `reviewConnection` emit with its `Settings2` import, because device connection is desktop-only.
- `DemoBanner`: a slim fixed strip with the exact banner copy and a "Código" link to `https://github.com/nullpoint-Software/despachoapp-vue` (`rel="noopener"`). It must not cover the Fiscenix top bar: it reserves its height in the layout. Mount it once in `App.vue` so it shows in every phase.
- `App.vue`: remove the quit control (`Power` icon / `quitApplication`), since a web page has no "quit".
- `ConfigurationPage.vue` and its children: remove the parts that only make sense on desktop, which means everything that calls `listLocalPrinters`, `prepareTestTicket`, device, host, Docker, diagnostics, backup or legacy-migration methods. Keep appearance (theme, accent color, background) and anything gated by a workspace capability, since those stay hidden while access is `noWorkspaceAccess`.

- [ ] **Step 4: Run the e2e and unit suites**

```bash
npm run test:e2e
npm test
```
Expected: 7 e2e passed; all unit tests pass.

- [ ] **Step 5: Commit**

```bash
git add src tests/e2e playwright.config.ts
git commit -m "feat(demo): demo access, banner and removal of desktop-only controls"
```

---

### Task 5: Vercel configuration, security headers and documentation

**Files:**
- Create: `vercel.json`, `README.md`, `AGENTS.md`, `docs/modules/DEMO-API.md`
- Modify: `src/index.html` (CSP meta)
- Test: `tests/unit/demo/deploymentPolicy.test.ts`

**Interfaces:**
- Consumes: the build output in `dist/` (Task 1).
- Produces: a static deployment with SPA fallback and security headers.

- [ ] **Step 1: Write the failing test**

```ts
describe('deployment policy', () => {
  it('rewrites every path to index.html', () => { /* vercel.json rewrites contains { source: '/(.*)', destination: '/index.html' } */ })
  it('sends the security headers', () => { /* headers for '/(.*)' include X-Content-Type-Options nosniff, Referrer-Policy strict-origin-when-cross-origin, Content-Security-Policy "frame-ancestors 'none'", Permissions-Policy 'camera=(self)' */ })
  it('limits connections to the same origin in index.html', () => { /* src/index.html CSP contains "connect-src 'self'" and "img-src 'self' data: blob:" and "worker-src 'self' blob:" */ })
})
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run tests/unit/demo/deploymentPolicy.test.ts`
Expected: FAIL.

- [ ] **Step 3: Write `vercel.json` and update the CSP meta in `src/index.html`**

`vercel.json`: `buildCommand: npm run build`, `outputDirectory: dist`, the rewrite, and the headers asserted above. CSP meta: keep ContaApp2's policy but change `connect-src 'none'` to `'self'`, `img-src` to `'self' data: blob:` and `worker-src` to `'self' blob:`, and `form-action` stays `'none'`.

- [ ] **Step 4: Write the documentation**

- `README.md` (Spanish): what Fiscenix Web is (a demo of Fiscenix for the portfolio; all in the browser; data erased on reload; SAT and email simulated), the demo profiles and password, how to run it (`npm install`, `npm run dev`, `npm run check`, `npm run test:e2e`), how to deploy (import the repo in Vercel; `vercel.json` already configures it), and the frozen source commit. Link to the spec.
- `AGENTS.md`: the rules this repo follows (copied from the ContaApp2 rules section that applies: naming, strict typing, comments, documentation), the "memory only, no external requests" rule, and pointers to `DESIGN.md`, the spec and `docs/modules/DEMO-API.md`.
- `docs/modules/DEMO-API.md`: what `src/demo` is, why it exists, how a call flows (Mermaid: UI → `window.contapp` → handler → `DemoStore`), what each handler covers in delivery 0, which data is EPHEMERAL (store) and which is LOCAL (preferences), the `DemoUnavailableError` contract, and how a later delivery adds a module (write its handler, remove its keys from the reject list, enable its `WorkspaceAccess` flags per profile, extend the seed).

- [ ] **Step 5: Run the full check and the e2e suite**

```bash
npm run check
npm run test:e2e
```
Expected: typecheck, lint, unit tests and build pass; 7 e2e passed.

- [ ] **Step 6: Commit**

```bash
git add vercel.json src/index.html README.md AGENTS.md docs/modules tests/unit/demo
git commit -m "chore: vercel deployment, security headers and demo documentation"
```

Publishing on Vercel (linking the GitHub repo to a Vercel project) is done by the user from their account. The plan only leaves the repo ready.
