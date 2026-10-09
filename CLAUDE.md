# CLAUDE.md

This file provides guidance to coding agents when working with code in this repository.

## Project Overview

Zeugnisgenerator (formerly echo) is an Angular 21 web application that assembles German employment reference letters (Arbeitszeugnisse) from pre-written text modules. It supports final references (Abschlusszeugnis) and interim references (Zwischenzeugnis) with gender-specific text variants. Built by atra.consulting and published as open source.

The tool gives no legal advice. The README and the UI carry a "keine Rechtsberatung" disclaimer; never claim, in any language, that the tool or its output is legally safe, compliant or verified.

## License

- The project is licensed under MIT, with the exclusions below. `LICENSE` is the verbatim MIT text (copyright atra.consulting GmbH & Co. KG); never append anything to it, otherwise GitHub no longer detects the license.
- Excluded from the MIT License (all rights remain with atra.consulting GmbH & Co. KG): the atra.consulting name and brand files (`src/assets/atra-logo.svg`, `src/assets/atra-logo-dark.svg`, `src/favicon.ico`) and the text modules (`src/assets/data_abschlusszeugnis.json`, `src/assets/data_zwischenzeugnis.json`, `src/assets/data_female_abschlusszeugnis.json`, `src/assets/data_female_zwischenzeugnis.json`). They may be used locally to develop and test this project; whoever distributes the app or operates their own instance of it replaces them and does not appear under the atra.consulting name. The exclusion is stated in the README section "Lizenz". Do not add license or notice files under `src/assets/`; that folder is copied into the public build.
- Do not edit the logo SVGs (brand rule).

## Commands

- **Install**: `npm ci`
- **Dev server**: `ng dev` or `npm run dev` (serves at localhost:4200, auto-reloads on changes)
- **Build**: `ng build` (outputs to `dist/zeugnisgenerator/browser`). The initial bundle exceeds the 1 MB budget and triggers a warning (known and accepted); do not raise the budgets.
- **Run tests**: `ng test` (Karma + Jasmine, watch mode in Chrome); single run: `ng test --watch=false --browsers=ChromeHeadless`
- **Run single test**: `ng test --watch=false --browsers=ChromeHeadless --include='src/app/path-to-component/**/*.spec.ts'` (quote the glob, zsh aborts on an unquoted one)
- **Production serve**: `npm start` (uses `serve` on port 8080)
- **CI**: `.github/workflows/ci.yml` runs `npm ci`, the build and the tests on Node 22 (npm 10) for every pull request and push to main, also in forks.
- **Dependencies**: change them only with npm 10 (e.g. `npx -y npm@10 install <pkg>`). The Docker build uses npm 10, and `package-lock.json` (lockfileVersion 2) must stay installable with it; npm 11 drops nested entries that npm 10 needs. Otherwise install with `npm ci`; even a plain `npm install` with npm 11 rewrites the lockfile.

## Architecture

### Standalone Components (no NgModules)

All components use standalone architecture with OnPush change detection.

**Route flow**: `/certificate-chooser` → `/user-input`. The preview (ReferenceOutputComponent) is embedded in the user-input page. `app.routes.ts` also defines `/reference-output`, but the UI never navigates there.

- **CertificateChooserComponent**: Landing page, selects certificate type, shows the disclaimer footer
- **UserInputComponent**: Main form container with Material stepper, orchestrates sub-components (IntroComponent, PositionComponent, BlockSelectorComponent, BlockRatingComponent, ReferenceOutputComponent)
- **ReferenceOutputComponent**: Live preview of the generated reference letter text with edit and copy; the disclaimer hint sits outside the "paper" so it is never copied or exported. Edits in edit mode only change `DataStorageService.flowText` in memory and are overwritten by the next `updateFlowText()`.

### Services

- **DataStorageService** (`data-storage.service.ts`): Central state management. Loads JSON templates from `src/assets/`, manages form data and selected text blocks, persists to localStorage, handles placeholder replacement (`{firstname}`, `{lastname}`, etc.) and final text assembly.
- **GoogleAuthService** (`google-auth.service.ts`): Google OAuth2 sign-in/sign-out via Google Identity Services (GIS) token client. Loads the GIS script on demand, exposes `getAccessToken()` for API calls.
- **GoogleDocService** (`google-doc.service.ts`): Exports to Google Docs (copies the template via Drive API, inserts text into the copy) and Google Sheets (creates spreadsheet, appends form data + selections). Plain fetch against the Google REST APIs, no client library.

### Configuration

- `src/app/google.config.ts`: OAuth client id (public by design; the consent screen only admits atra.consulting accounts) and the id of atra.consulting's Google Docs template. Forks set their own values.

### Data Templates

Four JSON files in `src/assets/` (`data_abschlusszeugnis.json`, `data_zwischenzeugnis.json` and their `data_female_*` variants, which `IntroComponent` requests when the salutation "Frau" is selected; sentences picked before keep their wording) define structured text blocks organized by topic (intro, position, performance, behavior_evaluation, conclusion, farewell, future_wishes). Only the intro and position topics list sentences directly; every other topic must contain subtopics (`user-input.component.html` renders nothing else), some with rating levels (sehr gut, noch gut, etc.). Placeholder tokens are replaced with form values at runtime; only names matching `{\w+}` are placeholders, so `{department/company_part}` in the shipped modules stays in the text verbatim. The text modules are not MIT-licensed; do not change their content as part of code changes.

## Conventions

- **Component selector prefix**: `app-`
- **Language**: UI texts in German with formal "Sie"; README, CONTRIBUTING and SECURITY in German with instructions in informal "du"; legal notes in the README (disclaimer, Lizenz) impersonal; keep the du-form contributor clauses in the Lizenz section of CONTRIBUTING.md as worded; code and comments in `src/` in English.
- **Brand spelling**: `atra.consulting` (lowercase); the legal name `atra.consulting GmbH & Co. KG` only in legal contexts.
- **Versioning**: [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Releases and `CHANGELOG.md` are generated by semantic-release from commit messages. The version in `package.json` is managed by semantic-release (starts as `0.0.0-development`); never bump it by hand.
- **Commit style**: [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0) (enforced by commitlint). Commit types like `feat:`, `fix:`, `chore:`, etc. determine the version bump automatically.
- **Style guide**: [Angular coding style guide](https://angular.dev/style-guide)
- **Indentation**: 4 spaces, LF line endings, 120 char max line width
- **TypeScript**: Strict mode enabled
- **Styling**: SCSS with Angular Material (M3 custom theme). Corporate font: Helvetica Neue/Helvetica/Arial. Corporate colors: #264892 (primary), #a7c6eb (secondary), #dc421e / #f98752 (accents). Component styles must stay below the 4 kB `anyComponentStyle` budget.
- **.gitignore** is a whitelist: every new root file needs its own `!/<file>` entry.

## Deployment

- **Docker**: Multi-stage build (Node 22-alpine, npm 10), final image contains only the built app (plus `3rdpartylicenses.txt`) served by `serve` on `$PORT` (default 8080)
- **atra.consulting's instance**: `.github/workflows/deploy.yml` deploys on push to main (keyless auth via Workload Identity Federation, Docker build, push to Artifact Registry, deploy to Cloud Run). The infrastructure is managed outside this repository by atra.consulting's internal GCP platform, which also maintains the required repository secrets.
- **Name**: The infrastructure and the Cloud Run service keep the old name `echo` (`SERVICE_NAME: echo` in `deploy.yml`), independent of the repository and app name. Never rename the repository without the matching change on the GCP side.
- **Forks**: `deploy.yml` and `build-and-release.yml` (semantic-release) only run in the `atra-consulting` organization (`github.repository_owner` guard).
