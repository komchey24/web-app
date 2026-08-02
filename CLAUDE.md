# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Mifos® X Web App — the Angular 20 frontend for the Apache Fineract® financial-inclusion platform. All data comes from Fineract via REST; payload shapes are dictated by the Fineract API spec. Domain vocabulary: "Clients" hold "Savings" and "Loans" accounts, "Offices" are branches, "Centers"/"Groups" support group-lending methodologies.

Also read `AGENTS.md` and `skills/SKILL.md` — they contain must-follow contribution and UI-generation rules for AI agents. Coding style guides live in `docs/coding-guides/` (angular, typescript, html, sass, unit-tests).

## Commands

```bash
npm start                # dev server, proxies API to https://demo.mifos.community (proxy.conf.js)
npm run start:local      # dev server proxying to a local Fineract at localhost:8443 (proxy.localhost.conf.js)
npm run build            # production build

npm run lint             # eslint + stylelint + prettier --check + htmlhint (CI blocks on this)
npx prettier --write .   # fix formatting

npm test                 # Jest unit tests (jest.config.ts)
npx jest src/app/path/to/file.spec.ts        # run a single spec file
npx jest -t "test name"                      # run tests matching a name

npm run playwright       # Playwright e2e (also :ui, :headed, :debug variants)
npm run e2e:docker       # full-stack e2e via docker-compose.e2e.yml

npm run headers:check    # verify MPL-2.0 license headers (required on every new file)
npm run headers:add      # prepend headers to new files
npm run translations:extract  # regenerate src/translations/template.json after adding i18n strings
```

Node >= 20.19 required. Husky + lint-staged run header checks, eslint, stylelint, and prettier on commit.

## Architecture

- **Lazy-loaded feature modules per domain.** `src/app/app-routing.module.ts` registers each domain folder (`clients/`, `loans/`, `savings/`, `accounting/`, `organization/`, `products/`, `system/`, …) via `loadChildren`. Most are classic NgModules (`*.module.ts` + `*-routing.module.ts`); newer code uses standalone route files (e.g. `loans/loans-list.routes.ts`). Match whichever pattern the module you're touching already uses.
- **`src/app/core/`** — singletons wired once in `core.module.ts`: authentication (service, guard, interceptor, OAuth2/OIDC config), the HTTP interceptor chain (`ApiPrefixInterceptor` prefixes the Fineract base URL, plus caching, error-handling, progress-bar, auth interceptors), a custom `HttpService` supporting `HTTP_DYNAMIC_INTERCEPTORS`, `RouteReusableStrategy`, and the app shell (sidenav/toolbar/breadcrumb/content).
- **`src/app/shared/`** — reusable UI components, dialogs, validators, pipes, and the Angular Material import modules (`material.module.ts`, `icons.module.ts`).
- **Data flow:** route resolvers (each domain has a `common-resolvers/` or `resolvers` folder) fetch data before activation; components read it from `route.data`. Services expose Fineract endpoints as RxJS Observables. There is no NgRx or other state container — don't introduce one.
- **Path aliases:** `app/*` → `src/app/*`, `@pipes/*` → `src/app/pipes/*` (tsconfig.json; Jest additionally maps `@/*` → `src/*` and `environments/*`).
- **Theming/config:** global SCSS in `src/main.scss` and `src/theme/`; build-time flags in `src/environments/`; runtime/Docker env vars documented in `README.md` and `env.sample`.

## Non-negotiable conventions

- **Angular Material everywhere** — `<mat-card>`, `<mat-table>`, `<mat-select>`, `matInput`/`mat-button` directives on natives. No raw HTML controls.
- **Reactive Forms only** (`FormBuilder`/`FormGroup`) — never `[(ngModel)]`.
- **No hardcoded user-facing English** in templates — use `{{ 'Some.Key' | translate }}` (@ngx-translate), then run `npm run translations:extract`.
- **8px grid** for spacing — utility classes like `m-b-16` or multiples of 8; values like `10px`/`15px` are prohibited. Reuse SCSS variables from `src/main.scss` / `src/theme/` instead of new custom classes.
- **MPL-2.0 file headers** on every new `.ts`/`.html`/`.scss` file (`npm run headers:add`).
- **No new npm dependencies** for things `lodash` or `moment` already do.

## Git workflow

- Branch from `dev` (never `master`/`main`); PRs target `dev`.
- Branch name: `WEB-<JiraID>-<short-description>`; commit/PR title: `WEB-<JiraID>: <Description>`.
- One feature = one PR; squash if a PR exceeds 2 commits.
- UI PRs require before/after screenshots — remind the user to capture them.