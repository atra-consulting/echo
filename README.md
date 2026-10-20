<p align="center">
  <a href="https://atra.consulting/">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="src/assets/atra-logo-dark.svg">
      <img src="src/assets/atra-logo.svg" alt="atra.consulting" width="320">
    </picture>
  </a>
</p>

<h1 align="center">Zeugnisgenerator</h1>

<p align="center">
  <em>Arbeitszeugnisse (Abschluss- und Zwischenzeugnis) aus vorformulierten Textbausteinen zusammenstellen —<br>
  ein Werkzeug von <a href="https://atra.consulting/">atra.consulting</a>.</em>
</p>

<p align="center">
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-blue.svg"></a>
  <img alt="Angular 21" src="https://img.shields.io/badge/Angular-21-dd0031.svg">
  <img alt="TypeScript 5.9" src="https://img.shields.io/badge/TypeScript-5.9-3178c6.svg">
</p>

> **Keine Rechtsberatung.** Der Zeugnisgenerator setzt Arbeitszeugnisse aus vorformulierten Textbausteinen zusammen.
> Er ersetzt keine Rechtsberatung und prüft nicht, ob ein Zeugnis im Einzelfall zutreffend, vollständig und rechtlich
> zulässig ist. Die Notenstufen geben verbreitete Zeugnissprache wieder und sind nicht rechtsverbindlich. Jedes Zeugnis
> ist vor der Verwendung zu prüfen; im Zweifel empfiehlt sich eine arbeitsrechtliche Beratung. Für Richtigkeit,
> Vollständigkeit und Aktualität der Textbausteine übernimmt atra.consulting keine Gewähr.

Der Zeugnisgenerator steht unter der MIT-Lizenz; ausgenommen sind der Name atra.consulting, das Logo, das Favicon und
die Textbausteine (siehe [Lizenz](#lizenz)).

---

## Inhalt

- [Funktionen](#funktionen)
- [Voraussetzungen](#voraussetzungen)
- [Schnellstart](#schnellstart)
- [Entwicklung](#entwicklung)
- [Betrieb mit Docker](#betrieb-mit-docker)
  - [Eigene Instanz](#eigene-instanz)
- [Google-Export](#google-export)
- [MCP-Server](#mcp-server)
- [Textbausteine](#textbausteine)
- [Datenschutz](#datenschutz)
- [Tech-Stack](#tech-stack)
- [Projektstruktur](#projektstruktur)
- [Versionierung](#versionierung)
- [Mitwirken](#mitwirken)
- [Lizenz](#lizenz)

---

## Funktionen

- **Zwei Zeugnisarten** — Abschlusszeugnis und Zwischenzeugnis, jeweils mit eigenen Textbausteinen.
- **Textvarianten nach Anrede** — wählst du die Anrede „Frau“, lädt die App die weibliche Variante der Textbausteine.
  Wähle die Anrede deshalb zuerst: Bereits gewählte Sätze passt die App nicht an.
- **Geführte Eingabe** — ein Stepper führt Schritt für Schritt durch Einleitung, Position und Aufgaben, Leistungs- und
  Verhaltensbeurteilung, Beendigungsgrund (beim Zwischenzeugnis: Anlass), Dankesformel und Zukunftswünsche.
- **Notenstufen** — für jede Beurteilung wählst du zuerst eine Stufe von „sehr gut“ bis „mangelhaft“ und dann einen
  passenden Satz.
- **Live-Vorschau** — der Zeugnistext entsteht beim Ausfüllen. Offene Platzhalter sind markiert und führen per Klick
  zum passenden Feld. Mit den Symbolen **Bearbeiten** und **In die Zwischenablage kopieren** über der Vorschau änderst
  du den Text von Hand und kopierst ihn.
- **Speicherung im Browser** — Eingaben bleiben erhalten, bis du sie zurücksetzt.
- **Google-Export (optional)** — das Zeugnis als Google-Dokument, die Eingaben als Google-Tabelle. Mit der
  mitgelieferten Konfiguration nur für Konten von atra.consulting (siehe [Google-Export](#google-export)).
- **Helles und dunkles Design** — nach Systemeinstellung oder fest gewählt.
- **MCP-Server (optional)** — KI-Agenten wie Claude setzen Zeugnisse aus denselben Textbausteinen zusammen (siehe
  [MCP-Server](#mcp-server)).

Änderungen im Bearbeitungsmodus speichert die App nicht. Verlässt du den Bearbeitungsmodus, zeigt die Vorschau wieder
den erzeugten Text; Kopieren und der Export nach Google Docs übernehmen aber deine Änderungen. Sobald du eine Eingabe
oder Auswahl änderst, erzeugt die App den Text neu, und deine Änderungen gehen verloren. Bearbeite den Text deshalb erst
zum Schluss und kopiere oder exportiere ihn direkt danach.

---

## Voraussetzungen

| Tool              | Version          | Zweck                                         |
|-------------------|------------------|-----------------------------------------------|
| **Node.js**       | 22.12+ oder 24+  | Abhängigkeiten installieren, bauen, starten   |
| **npm**           | 10+              | wird mit Node.js installiert                  |
| **Google Chrome** | aktuell          | Unit-Tests mit Karma                          |
| **Docker**        | optional         | Container-Image bauen und starten             |

---

## Schnellstart

Im geklonten Repository:

```bash
npm ci
npm run dev
```

Öffne dann http://localhost:4200/.

---

## Entwicklung

| Befehl                                                | Zweck                                                  |
|-------------------------------------------------------|--------------------------------------------------------|
| `npm run dev`                                         | Dev-Server auf http://localhost:4200/ mit Live-Reload  |
| `npm test`                                            | Unit-Tests im Watch-Modus, öffnet Chrome               |
| `npx ng test --watch=false --browsers=ChromeHeadless` | Unit-Tests einmal ohne Browserfenster                  |
| `npm run build`                                       | Produktions-Build nach `dist/zeugnisgenerator/browser` |
| `npm start`                                           | liefert den Build auf http://localhost:8080/ aus       |
| `npm run build:mcp`                                   | MCP-Server prüfen und nach `dist/mcp` bündeln          |
| `npm run test:mcp`                                    | Tests des MCP-Servers mit dem Test-Runner von Node.js  |
| `npm run start:mcp`                                   | gebündelten MCP-Server starten                         |

Einzelne Tests startest du mit `--include`, zum Beispiel
`npx ng test --watch=false --browsers=ChromeHeadless --include='src/app/user-input/**/*.spec.ts'`.

Der Produktions-Build warnt, dass das Initial-Bundle das Budget von 1 MB knapp überschreitet; das ist bekannt.
Bei jedem Pull Request und jedem Push auf `main` führt der Workflow `.github/workflows/ci.yml` Build und Unit-Tests
von App und MCP-Server aus, mit Node.js 22 und damit npm 10 wie im Docker-Image.

---

## Betrieb mit Docker

```bash
docker build -t zeugnisgenerator .
docker run --rm -p 8080:8080 zeugnisgenerator
```

Die App läuft dann unter http://localhost:8080/. Den Port im Container legt die Variable `PORT` fest
(Standard: 8080):

```bash
docker run --rm -e PORT=3000 -p 3000:3000 zeugnisgenerator
```

Das Dockerfile baut das Image in zwei Stufen auf Basis von `node:22-alpine`: Die erste installiert die Abhängigkeiten
und baut die App, die zweite enthält nur den Build und den statischen Webserver `serve`. Die Lizenzhinweise der
eingebundenen Abhängigkeiten liefert der Container unter `/3rdpartylicenses.txt` aus.

Der Workflow `.github/workflows/deploy.yml` stellt die Instanz von atra.consulting bei jedem Push auf `main` auf
Google Cloud Run bereit. In Forks läuft er nicht.

### Eigene Instanz

Wenn du den Zeugnisgenerator selbst betreibst oder weitergibst:

- Ersetze Logo und Favicon (`src/assets/atra-logo.svg`, `src/assets/atra-logo-dark.svg`, `src/favicon.ico`) samt den
  Alternativtexten „atra.consulting“ der Logos in `src/app/certificate-chooser/certificate-chooser.component.html` und
  `src/app/user-input/user-input.component.html`.
- Entferne den Hinweis „Ein Werkzeug von atra.consulting“ auf der Startseite
  (`src/app/certificate-chooser/certificate-chooser.component.html`) oder ersetze ihn durch einen eigenen.
- Ändere das Präfix `atra_` der exportierten Dateinamen in `src/app/user-input/user-input.component.ts`.
- Passe die Auswahllisten für Geschäfts- und Kompetenzbereich an
  (`src/app/user-input/position/position.component.html`); sie enthalten die Bereiche von atra.consulting.
- Bring eigene Textbausteine mit (siehe [Textbausteine](#textbausteine)).
- Konfiguriere den Google-Export (siehe [Google-Export](#google-export)) oder entferne ihn: Die Schaltfläche
  **Anmelden** und das Menü (⋮) mit den Exporten stehen in `src/app/user-input/user-input.component.html`.
- Stelle eigene Datenschutzhinweise bereit (siehe [Datenschutz](#datenschutz)).
- Betreibst du den MCP-Server, braucht er einen eigenen OAuth-Client und eine eigene Domain für die Anmeldung (siehe
  [MCP-Server](#mcp-server)). Er enthält die Textbausteine aus `src/assets/`; mit eigenen Textbausteinen baust du ihn
  neu.

---

## Google-Export

Der Export nach Google Docs und Google Sheets ist optional. Ohne Google-Anmeldung funktioniert der Rest der App
vollständig.

Über **Anmelden** in der Kopfleiste meldest du dich mit deinem Google-Konto an
([Google Identity Services](https://developers.google.com/identity/oauth2/web/guides/use-token-model)). Danach bietet
das Menü (⋮):

- **Google-Dokument erstellen** — kopiert die Docs-Vorlage und fügt den Zeugnistext in die Kopie ein.
- **Google-Tabelle erstellen** — legt in deinem Google Drive eine Tabelle mit deinen Eingaben und den gewählten
  Textbausteinen an.

Die Konfiguration steht in `src/app/google.config.ts`:

| Konstante                 | Bedeutung                                                              |
|---------------------------|------------------------------------------------------------------------|
| `GOOGLE_CLIENT_ID`        | OAuth-Client-ID des Google-Cloud-Projekts (öffentlich, kein Geheimnis) |
| `GOOGLE_DOCS_TEMPLATE_ID` | ID des Google-Dokuments, das der Export als Vorlage kopiert            |

Die mitgelieferten Werte gehören zur Instanz von atra.consulting: Der Zustimmungsbildschirm des Google-Cloud-Projekts
lässt nur Konten von atra.consulting zu, und die Vorlage gehört ebenfalls atra.consulting. In einem Fork funktioniert
der Export erst mit eigener Konfiguration:

1. Lege ein Google-Cloud-Projekt an und aktiviere die Google Docs API, die Google Sheets API und die Google Drive API.
2. Richte den OAuth-Zustimmungsbildschirm ein. Die App fordert die Bereiche
   `https://www.googleapis.com/auth/documents`, `https://www.googleapis.com/auth/spreadsheets` und
   `https://www.googleapis.com/auth/drive` an. `drive` zählt bei Google zu den eingeschränkten Bereichen: Für Konten
   außerhalb deiner Organisation verlangt Google eine Überprüfung der App. Bis dahin ist der Export nur begrenzt
   nutzbar, etwa nur für eingetragene Testnutzer.
3. Erstelle unter [APIs & Dienste → Anmeldedaten](https://console.cloud.google.com/apis/credentials) eine
   OAuth-Client-ID vom Typ „Webanwendung“. Trage als autorisierte JavaScript-Quellen die Adressen deiner Instanz ein,
   für die Entwicklung `http://localhost:4200`.
4. Lege eine Google-Docs-Vorlage an, zum Beispiel mit deinem Briefkopf in der Kopfzeile. Der Export fügt den
   Zeugnistext am Anfang des Dokuments ein. Alle, die exportieren, brauchen mindestens Lesezugriff auf die Vorlage.
   Die App gibt beim Kopieren keinen Zielordner an; laut Drive-Dokumentation landet die Kopie dann im Ordner der
   Vorlage, sofern das Konto diesen Ordner sieht. Lege die Vorlage deshalb nicht in einen gemeinsamen Ordner.
5. Trage Client-ID und Vorlagen-ID in `src/app/google.config.ts` ein. Die Vorlagen-ID steht in der Adresse des
   Dokuments zwischen `/d/` und `/edit`.

Die Namen der exportierten Dateien beginnen mit `atra_`. Das Präfix steht in
`src/app/user-input/user-input.component.ts` (siehe [Eigene Instanz](#eigene-instanz)).

---

## MCP-Server

Der MCP-Server macht den Zeugnisgenerator für KI-Agenten nutzbar, etwa als Connector in claude.ai oder in Claude Code.
Er spricht das [Model Context Protocol](https://modelcontextprotocol.io/) über Streamable HTTP und bietet zwei Tools:

| Tool                | Zweck                                                                                         |
|---------------------|-----------------------------------------------------------------------------------------------|
| `list_text_modules` | Textbausteine einer Zeugnisart mit nummerierten Sätzen, nach Thema, Unterthema und Notenstufe |
| `compose_reference` | setzt aus den gewählten Sätzen und den Angaben zur Person den Zeugnistext zusammen            |

Der Agent wählt pro Thema bzw. Unterthema einen Satz, bei Beurteilungen zuerst die Notenstufe. Den Text setzt der
Server genau wie die App zusammen (`src/app/reference-text.ts`); fehlende Angaben meldet er zusätzlich.
Tool-Beschreibungen und Ergebnisse tragen den Hinweis „keine Rechtsberatung“. Der Server ist zustandslos: Er speichert
weder Eingaben noch Zeugnisse. Den Export nach Google Docs übernimmt bei Bedarf der Agent selbst, etwa mit einem
Google-Drive-Connector.

### Lokal starten

Ohne Anmeldung, nur auf `127.0.0.1` erreichbar:

```bash
npm run build:mcp
MCP_AUTH=none npm run start:mcp
```

In Claude Code bindest du ihn so ein:

```bash
claude mcp add --transport http zeugnisgenerator http://localhost:8080/mcp
```

### Konfiguration

| Variable                | Bedeutung                                                                                |
|-------------------------|------------------------------------------------------------------------------------------|
| `PORT`                  | Port (Standard: 8080)                                                                    |
| `MCP_AUTH`              | `google` (Standard) oder `none`; ohne Anmeldung lauscht der Server nur auf `127.0.0.1`   |
| `PUBLIC_URL`            | öffentliche Adresse ohne Pfad, z. B. `https://zeugnisgenerator-mcp.example.com`          |
| `GOOGLE_CLIENT_ID`      | Client-ID des OAuth-Clients für die Anmeldung                                            |
| `GOOGLE_CLIENT_SECRET`  | Clientschlüssel dieses OAuth-Clients (geheim)                                            |
| `GOOGLE_ALLOWED_DOMAIN` | Google-Workspace-Domain, deren Konten sich anmelden dürfen, z. B. `atra.consulting`      |
| `TOKEN_SECRET`          | 32 Byte in Base64 zum Verschlüsseln der Tokens (geheim), z. B. `openssl rand -base64 32` |

Mit `MCP_AUTH=google` sind alle Variablen außer `PORT` Pflicht. Der Server beantwortet nur Anfragen an den Host aus
`PUBLIC_URL`.

### Anmeldung mit Google

MCP-Clients wie claude.ai erwarten einen OAuth-Server mit dynamischer Client-Registrierung, die Google nicht anbietet.
Der MCP-Server ist deshalb selbst der OAuth-Server und überlässt nur die Anmeldung Google:

1. Der Client registriert sich beim Server. Erlaubt sind nur die Rückleitungsadressen von claude.ai
   (`https://claude.ai/api/mcp/auth_callback`, `https://claude.com/api/mcp/auth_callback`) und Adressen auf
   `localhost` für lokale Clients wie Claude Code. Die Liste steht in `mcp/auth.ts`.
2. Für die Anmeldung leitet der Server zu Google weiter. Er akzeptiert nur bestätigte Konten der Domain aus
   `GOOGLE_ALLOWED_DOMAIN` und fordert nur die Bereiche `openid` und `email` an, keinen Zugriff auf Drive.
3. Danach stellt der Server eigene Tokens aus: ein Zugriffstoken für eine Stunde und ein Aktualisierungstoken für
   30 Tage. Bei jeder Aktualisierung fragt er bei Google nach, ob das Konto noch zugelassen ist. Ein gesperrtes Konto
   verliert den Zugang damit spätestens nach einer Stunde.

Alle Zustände (Clients, Codes, Tokens) stecken verschlüsselt in den Tokens selbst, der Server braucht keine Datenbank.
Ein neues `TOKEN_SECRET` macht alle Registrierungen und Tokens ungültig; die Nutzer verbinden den Connector dann neu.
Dass ein Autorisierungscode nur einmal einlösbar ist, prüft jede Server-Instanz für sich; dazu gelten Codes nur zwei
Minuten und sind per PKCE an den Client gebunden.

Den OAuth-Client legst du im Google-Cloud-Projekt unter
[APIs & Dienste → Anmeldedaten](https://console.cloud.google.com/apis/credentials) an: Typ „Webanwendung“,
autorisierte Weiterleitungs-URI `<PUBLIC_URL>/oauth/google/callback`. Steht der Zustimmungsbildschirm auf „Intern“,
lässt Google ohnehin nur Konten der eigenen Organisation zu.

In claude.ai fügst du den Server als benutzerdefinierten Connector mit der Adresse `<PUBLIC_URL>/mcp` hinzu; Client-ID
und Clientschlüssel bleiben dort leer.

### Betrieb mit Docker

```bash
docker build -f mcp/Dockerfile -t zeugnisgenerator-mcp .
docker run --rm -p 8080:8080 \
  -e PUBLIC_URL=https://zeugnisgenerator-mcp.example.com \
  -e GOOGLE_CLIENT_ID=… -e GOOGLE_CLIENT_SECRET=… \
  -e GOOGLE_ALLOWED_DOMAIN=example.com -e TOKEN_SECRET=… \
  zeugnisgenerator-mcp
```

Das Image enthält nur den gebündelten Server samt Abhängigkeiten und Textbausteinen.

---

## Textbausteine

Die Textbausteine liegen als JSON-Dateien in `src/assets/`:

| Datei                               | Inhalt                                            |
|-------------------------------------|---------------------------------------------------|
| `data_abschlusszeugnis.json`        | Abschlusszeugnis für die Anrede „Herr“ (Standard) |
| `data_female_abschlusszeugnis.json` | Abschlusszeugnis für die Anrede „Frau“            |
| `data_zwischenzeugnis.json`         | Zwischenzeugnis für die Anrede „Herr“ (Standard)  |
| `data_female_zwischenzeugnis.json`  | Zwischenzeugnis für die Anrede „Frau“             |

Aufbau (gekürzt):

```json
{
  "textblocks": [
    {
      "name": "intro",
      "type": "topic",
      "title": "1. Einleitung",
      "options": ["Satz mit {firstname} {lastname} …", "…"]
    },
    {
      "name": "performance",
      "type": "topic",
      "title": "3. Leistungsbeurteilung",
      "options": [
        {
          "name": "work_attitude",
          "type": "subtopic",
          "title": "3.1. Arbeitsbereitschaft",
          "options": [
            { "title": "sehr gut", "options": ["Satz …", "…"] },
            { "title": "noch gut", "options": ["Satz …", "…"] }
          ]
        }
      ]
    }
  ]
}
```

- Jeder Eintrag in `textblocks` ist ein Schritt im Stepper. `title` ist die Beschriftung, `name` der interne Schlüssel.
  Die Schritte `intro` und `position` zeigen zusätzlich die Formularfelder für persönliche Daten und Position.
- `options` enthält bei `intro` und `position` direkt wählbare Sätze, bei allen anderen Schritten Unterthemen
  (`"type": "subtopic"`). Direkte Sätze in anderen Schritten zeigt die App nicht an. Ein Unterthema gruppiert seine
  Sätze nach Notenstufe (`title` wie „sehr gut“) oder enthält direkt Sätze.
- Die Reihenfolge in der Datei bestimmt die Reihenfolge im Zeugnis.

Platzhalter in geschweiften Klammern ersetzt die App durch die Eingaben:

| Platzhalter                              | Feld                                          |
|------------------------------------------|-----------------------------------------------|
| `{salutation}`                           | Anrede                                        |
| `{firstname}`, `{lastname}`              | Vor- und Nachname                             |
| `{birthdate}`, `{birthplace}`            | Geburtsdatum und Geburtsort                   |
| `{hiredate}`, `{enddate}`                | Startdatum, Austritts- bzw. Ausstellungsdatum |
| `{job_title}`                            | Jobtitel                                      |
| `{business_area}`, `{area_of_expertise}` | Geschäftsbereich, Kompetenzbereich            |
| `{projects}`, `{task_list}`              | Projekte, Aufgabenbeschreibung                |

Nicht ausgefüllte Platzhalter erscheinen in der Vorschau als markierte Lücke, zum Beispiel `[Vorname]`.
`{sales_region}` und `{promotion_date}` haben kein Formularfeld und bleiben als Lücke stehen.

Ein Platzhaltername besteht nur aus den Zeichen `A–Z`, `a–z`, `0–9` und `_`. `{department/company_part}` in den
mitgelieferten Textbausteinen ist deshalb kein Platzhalter und bleibt unverändert im Text stehen. Manche Sätze enthalten
außerdem Lücken („…“), Alternativen mit Schrägstrich („vorbildlich/einwandfrei“) oder erläuternde Hinweise in Klammern.
Diese Stellen bearbeitest du im fertigen Text von Hand.

Die Textbausteine stehen **nicht** unter der MIT-Lizenz (siehe [Lizenz](#lizenz)). Für einen Fork, den du weitergibst
oder selbst betreibst, bringst du eigene Textbausteine im selben Format mit.

---

## Datenschutz

- Die App hat kein Backend. Sie läuft vollständig im Browser, der Server liefert nur statische Dateien aus.
- Der optionale MCP-Server verarbeitet die Angaben zur Person, die ein KI-Agent ihm übergibt, nur für die Dauer einer
  Anfrage. Er speichert und protokolliert sie nicht. Die Angaben liegen aber auch beim Anbieter des Agenten. In seinen
  Tokens steckt verschlüsselt die E-Mail-Adresse des angemeldeten Kontos.
- Eingaben (auch Namen und Geburtsdaten), die gewählten Textbausteine und den erzeugten Text speichert die App im
  `localStorage` des Browsers. Sie bleiben dort, bis du in der Kopfleiste der Eingabeseite auf das Symbol
  **Zurücksetzen** (↻) klickst. Auch die Wahl des Designs liegt im `localStorage`.
- Der Google-Export läuft erst nach der Anmeldung bei Google und schreibt nur mit den Rechten des angemeldeten Kontos
  in Google Drive (wo die Dokumentkopie landet, steht unter [Google-Export](#google-export)). Die Anmeldung erlaubt der
  App den Zugriff auf Google Docs, Google Sheets und das gesamte Google Drive (Bereich `drive`); die App nutzt ihn nur,
  um die Vorlage zu kopieren und die Exportdateien anzulegen und zu befüllen.
  Das Zugriffstoken hält die App nur im Arbeitsspeicher.
- Die Icon-Schrift Material Symbols lädt die App von Google Fonts (`fonts.googleapis.com`, `fonts.gstatic.com`). Dabei
  erhält Google die IP-Adresse der Nutzerinnen und Nutzer. Das Skript für die Google-Anmeldung (`accounts.google.com`)
  lädt die App erst beim Klick auf **Anmelden**.
- Wer eine eigene Instanz betreibt, ist für deren Datenschutzhinweise selbst verantwortlich.

---

## Tech-Stack

| Schicht              | Technologie                                                                  |
|----------------------|------------------------------------------------------------------------------|
| **Frontend**         | Angular 21 (Standalone Components, OnPush) · Angular Material 21 (M3) · SCSS |
| **Sprache**          | TypeScript 5.9 im Strict Mode                                                |
| **Tests**            | Karma · Jasmine                                                              |
| **Build**            | Angular CLI mit `@angular/build`                                             |
| **Auslieferung**     | `serve` im Docker-Image `node:22-alpine`                                     |
| **Google-Anbindung** | Google Identity Services · REST-APIs von Docs, Sheets und Drive              |
| **MCP-Server**       | MCP TypeScript SDK · Express · jose · esbuild · Test-Runner von Node.js      |
| **CI/CD**            | GitHub Actions · semantic-release · commitlint                               |

---

## Projektstruktur

Die wichtigsten Ordner und Dateien:

```
├── .github/workflows/               Build und Tests, Commit-Prüfung, Release, Deployment
├── docs/
│   ├── adrs/                        Architekturentscheidungen
│   └── corporate-design.md          Schrift und Farben von atra.consulting
├── mcp/                             MCP-Server für KI-Agenten
│   ├── app.ts                       HTTP-Endpunkte und OAuth-Routen
│   ├── auth.ts                      OAuth mit Anmeldung über Google
│   ├── server.ts                    Tools und Hinweise für Agenten
│   ├── text-modules.ts              Katalog der Textbausteine, Auswahl prüfen
│   └── Dockerfile
├── src/
│   ├── app/
│   │   ├── certificate-chooser/     Startseite: Wahl der Zeugnisart
│   │   ├── user-input/              Stepper mit den Eingabeschritten
│   │   │   ├── block-rating/        Notenstufe und Satzauswahl
│   │   │   ├── block-selector/      Satzauswahl
│   │   │   ├── intro/               persönliche Daten
│   │   │   └── position/            Position und Aufgaben
│   │   ├── reference-output/        Vorschau des Zeugnistexts
│   │   ├── data-storage.service.ts  Zustand und localStorage
│   │   ├── google-auth.service.ts   Google-Anmeldung
│   │   ├── google-doc.service.ts    Export nach Google Docs und Sheets
│   │   ├── google.config.ts         Client-ID und Vorlage für den Google-Export
│   │   ├── reference-text.ts        Platzhalter und Textaufbau, auch für den MCP-Server
│   │   └── theme.service.ts         helles und dunkles Design
│   ├── assets/                      Textbausteine (data_*.json) und Logos
│   ├── favicon.ico
│   ├── index.html
│   └── styles.scss                  globales Theme (Angular Material M3)
├── CLAUDE.md                        Hinweise für Coding-Agenten
├── CONTRIBUTING.md                  Mitwirken
├── Dockerfile
├── LICENSE
├── SECURITY.md                      Sicherheitslücken melden
├── angular.json
└── package.json
```

---

## Versionierung

Versionen folgen [Semantic Versioning](https://semver.org/lang/de/). Commit-Nachrichten folgen
[Conventional Commits](https://www.conventionalcommits.org/de/v1.0.0/); [commitlint](https://commitlint.js.org/)
prüft sie in jedem Pull Request. Bei jedem Push auf `main` ermittelt
[semantic-release](https://github.com/semantic-release/semantic-release) daraus die nächste Version, schreibt
`CHANGELOG.md` und legt ein GitHub-Release an. Release und Deployment laufen nur im Repository von atra.consulting. Die
Version in `package.json` setzt semantic-release beim Release (Startwert `0.0.0-development`); ändere sie nicht von
Hand.

---

## Mitwirken

Beiträge sind willkommen. Wie du Änderungen vorschlägst, steht in [CONTRIBUTING.md](CONTRIBUTING.md).
Sicherheitslücken meldest du bitte nicht als öffentliches Issue, sondern wie in [SECURITY.md](SECURITY.md) beschrieben.

---

## Lizenz

Veröffentlicht unter der **[MIT-Lizenz](LICENSE)** © 2026 [atra.consulting](https://atra.consulting/).

**Ausgenommen von der MIT-Lizenz** sind:

- der Name atra.consulting, das atra-Logo und das Favicon (`src/assets/atra-logo.svg`, `src/assets/atra-logo-dark.svg`,
  `src/favicon.ico`),
- die Textbausteine (`src/assets/data_abschlusszeugnis.json`, `src/assets/data_zwischenzeugnis.json`,
  `src/assets/data_female_abschlusszeugnis.json`, `src/assets/data_female_zwischenzeugnis.json`).

Alle Rechte daran liegen bei der atra.consulting GmbH & Co. KG. Zum Entwickeln und Testen dieses Projekts dürfen Name,
Logo, Favicon und Textbausteine lokal verwendet werden. Wer den Zeugnisgenerator weitergibt oder selbst betreibt,
ersetzt Logo, Favicon und Textbausteine durch eigene und tritt nicht unter dem Namen atra.consulting auf (siehe
[Eigene Instanz](#eigene-instanz)).
