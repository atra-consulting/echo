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
- [Backend: REST-API und MCP-Server](#backend-rest-api-und-mcp-server)
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
  Bereits gewählte Sätze übernimmt sie in der passenden Variante.
- **Geführte Eingabe** — ein Stepper führt Schritt für Schritt durch Einleitung, Position und Aufgaben, Leistungs- und
  Verhaltensbeurteilung, Beendigungsgrund (beim Zwischenzeugnis: Anlass), Dankesformel und Zukunftswünsche.
- **Notenstufen** — für jede Beurteilung wählst du zuerst eine Stufe von „sehr gut“ bis „mangelhaft“ und dann einen
  passenden Satz.
- **Live-Vorschau** — der Zeugnistext entsteht beim Ausfüllen. Offene Platzhalter sind markiert und führen per Klick
  zum passenden Feld. Mit den Symbolen **Bearbeiten** und **In die Zwischenablage kopieren** über der Vorschau änderst
  du den Text von Hand und kopierst ihn.
- **Entwürfe** — mit **Speichern** legst du einen Entwurf an, den nur du siehst; die Startseite listet deine
  Entwürfe mit Status und letzter Änderung. Eine Fassung lässt sich als **final** markieren (danach schreibgeschützt),
  als JSON exportieren und wieder importieren. Entwürfe und finale Fassungen sind 90 Tage nach der letzten Änderung
  nicht mehr abrufbar und werden danach gelöscht. Ohne Entwurfsablage (etwa in einem Fork ohne Firestore) fehlen diese
  Funktionen.
- **Zwischenspeicher im Browser** — ungespeicherte Eingaben bleiben im Browser erhalten, bis du sie zurücksetzt.
- **Google-Export (optional)** — das Zeugnis als Google-Dokument, die Eingaben als Google-Tabelle. Mit der
  mitgelieferten Konfiguration nur für Konten von atra.consulting (siehe [Google-Export](#google-export)).
- **Helles und dunkles Design** — nach Systemeinstellung oder fest gewählt.
- **API first** — Web-App und KI-Agenten nutzen dasselbe Backend: eine REST-API mit OpenAPI-Beschreibung und einen
  MCP-Server, der Agenten Schritt für Schritt durch dieselben Boxen führt wie der Stepper, auf denselben Entwürfen
  (siehe [Backend](#backend-rest-api-und-mcp-server)).

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
| **Docker**        | optional         | Container bauen und mit Compose starten       |

---

## Schnellstart

Im geklonten Repository:

```bash
npm ci
npm run build:server && npm run start:server
```

Das startet das Backend auf `127.0.0.1:8081`. In einem zweiten Terminal:

```bash
npm run dev
```

Öffne dann http://localhost:4200/. Der Dev-Server leitet `/api` und `/mcp` an das Backend weiter
(`proxy.conf.json`). Läuft das Backend nicht, zeigt die Eingabeseite einen Hinweis statt der Textbausteine.

---

## Entwicklung

| Befehl                                                | Zweck                                                  |
|-------------------------------------------------------|--------------------------------------------------------|
| `npm run dev`                                         | Dev-Server auf http://localhost:4200/ mit Live-Reload  |
| `npm test`                                            | Unit-Tests im Watch-Modus, öffnet Chrome               |
| `npx ng test --watch=false --browsers=ChromeHeadless` | Unit-Tests einmal ohne Browserfenster                  |
| `npm run build`                                       | Produktions-Build nach `dist/zeugnisgenerator/browser` |
| `npm start`                                           | liefert nur den Build auf http://localhost:8080/ aus   |
| `npm run build:server`                                | Backend prüfen und nach `dist/server` bündeln          |
| `npm run test:server`                                 | Tests des Backends mit dem Test-Runner von Node.js     |
| `npm run start:server`                                | gebündeltes Backend starten (`127.0.0.1:8081`)         |
| `docker compose up --build`                           | Web-App und Backend wie in Produktion, Port 8080       |

Einzelne Tests startest du mit `--include`, zum Beispiel
`npx ng test --watch=false --browsers=ChromeHeadless --include='src/app/user-input/**/*.spec.ts'`.

Nach Änderungen am Backend baust du es mit `npm run build:server` neu und startest es neu; einen Watch-Modus hat es
nicht. `npm start` liefert nur die statischen Dateien aus, ohne Backend lädt die App keine Textbausteine.

Der Produktions-Build warnt, dass das Initial-Bundle das Budget von 1 MB knapp überschreitet; das ist bekannt.
Bei jedem Pull Request und jedem Push auf `main` führt der Workflow `.github/workflows/ci.yml` Build und Tests von App
und Backend aus, mit Node.js 22 und damit npm 10 wie in den Docker-Images. Außerdem baut er beide Images, startet sie
mit `compose.yaml` und prüft Web-App und API mit `curl`.

---

## Betrieb mit Docker

Der Zeugnisgenerator besteht aus zwei Containern:

| Image                                  | Inhalt                                                                         |
|----------------------------------------|--------------------------------------------------------------------------------|
| `Dockerfile` (Web und Ingress)         | nginx (unprivilegiert) mit dem Build der App; leitet `/api` und `/mcp` weiter  |
| `server/Dockerfile` (Backend)          | gebündeltes Backend mit REST-API, MCP-Server und Textbausteinen               |

Nur der Web-Container nimmt Anfragen von außen an, auf dem Port aus `PORT` (Standard: 8080). Das Backend lauscht auf
`127.0.0.1:8081` und ist nur über nginx erreichbar. Dafür teilen sich beide Container einen Netzwerk-Namensraum:
lokal per `network_mode` in `compose.yaml`, auf Cloud Run als Container derselben Instanz.

```bash
docker compose up --build
```

Die App läuft dann unter http://localhost:8080/, nur auf deinem Rechner erreichbar. Entwürfe landen im
Firestore-Emulator und gehören dem Entwicklungsnutzer aus `compose.yaml`; mit dem Emulator verschwinden sie. Beide
Images bauen in zwei Stufen auf `node:22-alpine` und enthalten nur das Nötige. Die Lizenzhinweise der in die App
eingebundenen Abhängigkeiten liefert der Web-Container unter `/3rdpartylicenses.txt` aus.

Der Workflow `.github/workflows/deploy.yml` stellt die Instanz von atra.consulting bei jedem Push auf `main` auf
Google Cloud Run bereit: Er führt zuerst die Tests aus `ci.yml` aus, baut beide Images (`echo` und `echo-api`), legt
den Firestore-Index für die Liste der Entwürfe an und ersetzt den Dienst mit `gcloud run services replace` durch das
Manifest `deploy/cloud-run/service.yaml`. Das Manifest übernimmt die Einstellungen der GCP-Plattform (IAP direkt am
Dienst, Ingress) und deren Runtime-Dienstkonto und bindet das Secret `draft-encryption-key` ein. In Forks läuft der
Workflow nicht.

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
- Schütze die Instanz vor fremdem Zugriff, etwa mit IAP (siehe [Zugriffsschutz](#zugriffsschutz)). Die REST-API
  liefert die Textbausteine an alle aus, die sie erreichen.
- Das Backend enthält die Textbausteine aus `src/assets/`. Eigene Textbausteine bündelst du beim Bau mit oder legst sie
  in ein Verzeichnis, auf das `TEXT_MODULES_DIR` zeigt. Betreibst du
  den MCP-Server mit Google-Anmeldung, braucht er einen eigenen OAuth-Client (siehe
  [Anmeldung mit Google](#anmeldung-mit-google)).

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

## Backend: REST-API und MCP-Server

Das Backend (`server/`) ist die gemeinsame Schnittstelle für die Web-App und für KI-Agenten. Es liefert die
Textbausteine aus, setzt Zeugnisse zusammen und speichert Entwürfe je Person, über eine REST-API unter `/api` und über
einen MCP-Server ([Model Context Protocol](https://modelcontextprotocol.io/), Streamable HTTP) unter `/mcp`. Beide
sind dünne Schichten über denselben Anwendungsfällen in `server/core/`; den Text setzt das Backend genau wie die App
zusammen (`src/app/reference-text.ts`). Antworten tragen den Hinweis „keine
Rechtsberatung“. Anfrageinhalte protokolliert das Backend nie.

### Aufbau: Ports und Adapter

Der Kern (`server/core/`) kennt weder Express noch MCP noch Google Cloud: Katalog, Schritte, Zusammensetzen und der
Lebenszyklus der Entwürfe (Entwurf, final, Export, Import, Ablauf). Was er von außen braucht, beschreibt er als
Schnittstellen (Ports, `server/core/ports.ts`); die Adapter in `server/adapters/` setzen sie um. REST (`server/http/`)
und MCP (`server/mcp/`) rufen dieselben Anwendungsfälle auf. `server/main.ts` liest als einzige Stelle die
Umgebungsvariablen und verbindet die Adapter.

| Port               | Adapter                                                          | Auswahl                               |
|--------------------|------------------------------------------------------------------|---------------------------------------|
| `TextModuleSource` | mitgebündelte Textbausteine aus `src/assets/` oder ein Verzeichnis | `TEXT_MODULES_DIR`                    |
| `DraftStore`       | Arbeitsspeicher oder Firestore                                   | `DRAFT_STORE`                         |
| `DraftCipher`      | AES-256-GCM mit Schlüsselbund                                    | `DRAFT_ENCRYPTION_KEY`                |
| `IdentityProvider` | signierte IAP-Kopfzeile oder fester Entwicklungsnutzer           | `IAP_AUDIENCE` bzw. `DEV_USER_EMAIL`  |

Für einen Fork genügt meist die Konfiguration: eigene Textbausteine per `TEXT_MODULES_DIR`, Entwürfe im Arbeitsspeicher
oder gar keine (`DRAFT_STORE=off`). Eine andere Datenbank oder Anmeldung baust du als weiteren Adapter desselben Ports;
die Vertragstests (`server/adapters/*.spec.ts`) muss jeder Adapter bestehen.

### Ablauf Schritt für Schritt

Agenten arbeiten Box für Box wie der Stepper der App, statt alle Textbausteine auf einmal zu laden: Einleitung,
Position und Aufgaben, Leistung, Verhalten, Abschluss bzw. Anlass, Dankesformel, Zukunftswünsche.

1. **Entwurf anlegen**: liefert die Schritte in ihrer Reihenfolge, die Angaben zur Person, die in den Textbausteinen
   vorkommen, und den ersten Schritt mit nummerierten Sätzen.
2. **Je Schritt** Sätze wählen und speichern, einen Schritt pro Aufruf. Jeder Schritt nennt seine Regel
   (`selection_rule`): einen Satz (`one_sentence`), eine Notenstufe und einen Satz daraus (`one_rating`), für jedes
   Unterthema mit Notenstufen eine Stufe und einen Satz, Unterthemen ohne Stufen nur bei Bedarf (`each_subtopic`),
   oder das eine passende Unterthema (`one_subtopic`, etwa der Beendigungsgrund).
3. Jede Antwort enthält den **Text bis hierher**, fehlende Angaben, je Schritt Stand und gewählte Sätze im aktuellen
   Wortlaut, die offenen Schritte und `next_step`.
4. **Nächsten Schritt** abrufen und wiederholen, bis `complete` gilt; auf Wunsch **final** markieren.

Die Anrede („Herr“/„Frau“) wählt die Textvariante, wie in der App; sie steht in den Angaben zur Person
(`form_data.salutation`). Gewählt wird nach Nummern, deshalb passt eine Auswahl zu beiden Varianten.

| MCP-Tool         | REST                                    | Zweck                                                     |
|------------------|-----------------------------------------|-----------------------------------------------------------|
| `list_drafts`    | `GET /api/drafts`                       | eigene Entwürfe, neueste zuerst                           |
| `create_draft`   | `POST /api/drafts`                      | Entwurf anlegen                                           |
| `get_step`       | `GET /api/drafts/{id}/steps/{step}`     | genau einen Schritt mit Sätzen und bisheriger Auswahl     |
| `update_draft`   | `PATCH /api/drafts/{id}`                | Angaben zur Person und/oder Auswahl eines Schritts        |
| `get_draft`      | `GET /api/drafts/{id}`                  | aktueller Stand mit vollständigem Wortlaut                |
| `finalize_draft` | `POST /api/drafts/{id}/finalize`        | als final markieren, danach schreibgeschützt              |
| `export_draft`   | `GET /api/drafts/{id}/export`           | JSON-Datenobjekt ohne Besitzer und interne Id             |
| `import_draft`   | `POST /api/drafts/import`               | Export als neuen, bearbeitbaren Entwurf anlegen           |
| –                | `PUT /api/drafts/{id}`                  | Entwurf vollständig ersetzen (Speichern der Web-App)      |
| –                | `DELETE /api/drafts/{id}`               | Entwurf löschen                                           |

Der Prompt `zeugnis_erstellen` startet den Ablauf in MCP-Clients; die Hinweise des Servers beschreiben die
Reihenfolge.

### Weitere Endpunkte

Die vollständige Beschreibung liefert `GET /api/openapi.json` (OpenAPI 3.1).

| Endpunkt                                          | Zweck                                                                    |
|---------------------------------------------------|--------------------------------------------------------------------------|
| `GET /api/health`                                 | Betriebsbereitschaft und Version                                         |
| `GET /api/certificate-types`                      | Zeugnisarten und Anreden                                                 |
| `GET /api/certificate-types/{type}/steps`         | Schritte ohne Entwurf, mit dem ersten Schritt                            |
| `GET /api/certificate-types/{type}/steps/{step}`  | ein Schritt ohne Entwurf                                                 |
| `POST /api/references`                            | Text und Fortschritt aus einer Auswahl, ohne etwas zu speichern          |
| `GET /api/certificate-types/{type}/text-modules`  | alle Textbausteine im Aufbau der JSON-Dateien, für den Stepper der App   |

`{type}` ist `abschlusszeugnis` oder `zwischenzeugnis`, die Textvariante wählt der Parameter `salutation=Frau`.
Fehler kommen als `{"error": {"code", "message", "details"}}`: 400 bei ungültigem Schema, 401 ohne Anmeldung, 404 bei
unbekannten oder fremden Entwürfen, 409 bei Änderungen an finalen Fassungen, 422 bei ungültiger Auswahl (`details`
listet alle Probleme).

Der Inhalt eines Entwurfs (`ReferenceDraft`) hat eine Formatversion (`schema_version`) und enthält Zeugnisart, Angaben
zur Person und die Auswahl aller Schritte, zum Beispiel:

```json
{
  "schema_version": 1,
  "certificate_type": "zwischenzeugnis",
  "form_data": { "salutation": "Frau", "firstname": "Anna", "lastname": "Muster" },
  "selections": [
    { "step": "intro", "sentence": 0 },
    { "step": "performance", "subtopic": "work_attitude", "rating": "sehr gut", "sentence": 1 }
  ]
}
```

Die App lädt die Textbausteine über `text-modules`, weil der Stepper alle Schritte zugleich zeigt. Die Vorschau setzt
sie im Browser mit `src/app/reference-text.ts` zusammen: Sie reagiert ohne Verzögerung auf jede Eingabe, und das
Backend sieht die Eingaben erst, wenn du speicherst.

### Entwürfe speichern

Entwürfe liegen in Firestore (Sammlung `drafts`), je Dokument mit Besitzer (E-Mail-Adresse der angemeldeten Person),
Status (`draft`/`final`), Formatversion, Zeitstempeln und `expireAt`. Jede Änderung setzt `expireAt` auf die letzte
Änderung plus `RETENTION_DAYS` (Standard: 90); Lesen ändert es nicht. Ab `expireAt` behandelt das Backend einen
Entwurf als gelöscht; die TTL-Richtlinie von Firestore auf `expireAt` (der Deploy richtet sie ein) löscht das Dokument
danach, in der Regel innerhalb eines Tages. Jede Person sieht und ändert nur ihre eigenen Entwürfe; fremde beantwortet
das Backend wie nicht vorhandene. Jedes Dokument zählt seine Schreibvorgänge (`revision`); kommt zwischen Lesen und
Schreiben ein anderer Schreibvorgang dazwischen (etwa „final“ während einer Änderung), lehnt die Ablage den zweiten ab
(409), statt ihn stillschweigend zu überschreiben.

Den Inhalt (Angaben zur Person, Auswahl) verschlüsselt das Backend vor dem Speichern mit AES-256-GCM, mit einem neuen
Zufalls-IV je Schreibvorgang. Die Prüfsumme bindet den Inhalt an Id, Besitzer und Formatversion des Dokuments. Im
Klartext stehen nur Besitzer, Status, Formatversion, Schlüssel-Id und Zeitstempel. Der Schlüsselbund kommt aus dem
Secret `draft-encryption-key` im Secret Manager:

```json
{ "active": "k2", "keys": { "k1": "<32 Byte in Base64>", "k2": "<32 Byte in Base64>" } }
```

Geschrieben wird mit dem aktiven Schlüssel, gelesen mit dem Schlüssel, dessen Id im Dokument steht. Den ersten
Schlüssel legst du an, ohne dass er im Terminal erscheint:

```bash
printf '{"active":"k1","keys":{"k1":"%s"}}' "$(openssl rand -base64 32)" \
  | gcloud secrets versions add draft-encryption-key --data-file=-
```

Zum Wechseln fügst du einen neuen Schlüssel hinzu und machst ihn aktiv (mit Leserecht auf das Secret):

```bash
gcloud secrets versions access latest --secret=draft-encryption-key \
  | jq -c --arg key "$(openssl rand -base64 32)" '.keys.k2 = $key | .active = "k2"' \
  | gcloud secrets versions add draft-encryption-key --data-file=-
```

Den alten Schlüssel entfernst du nach Ablauf der Aufbewahrungsfrist (90 Tage), weil kein Dokument ihn dann noch
braucht. Der nächste Deploy übernimmt die neue Version des Secrets.

Exportierte JSON-Dateien sind nicht verschlüsselt.

### Lokal starten

Ohne Entwürfe genügt das Backend allein (siehe [Schnellstart](#schnellstart)). Mit Entwürfen startest du den
Firestore-Emulator und gibst einen Entwicklungsnutzer an, weil lokal kein IAP die Anmeldung liefert:

```bash
gcloud emulators firestore start --host-port=localhost:8686
```

In einem zweiten Terminal:

```bash
npm run build:server
FIRESTORE_EMULATOR_HOST=localhost:8686 GOOGLE_CLOUD_PROJECT=demo-zeugnisgenerator \
  DRAFT_STORE=firestore DEV_USER_EMAIL=entwicklung@example.com \
  DRAFT_ENCRYPTION_KEY="{\"active\":\"dev\",\"keys\":{\"dev\":\"$(openssl rand -base64 32)\"}}" \
  npm run start:server
```

Mit dem Schlüssel aus diesem Aufruf lassen sich die Entwürfe nur bis zum Neustart lesen. `DRAFT_STORE=memory` hält
Entwürfe ohne Emulator im Arbeitsspeicher. `docker compose up --build` startet Web-App, Backend und Emulator samt
Entwicklungsnutzer und festem Entwicklungsschlüssel. Der Emulator kennt keine zusammengesetzten Indizes; den Index für
die Liste der Entwürfe legt erst der Deploy an.

MCP lokal: Setze zusätzlich `MCP_AUTH=none`; die Entwürfe gehören dann dem Entwicklungsnutzer. Einbinden in Claude
Code mit `claude mcp add --transport http zeugnisgenerator http://localhost:8081/mcp` (bei `docker compose`:
`http://localhost:8080/mcp`).

### Konfiguration

| Variable                | Bedeutung                                                                                     |
|-------------------------|-----------------------------------------------------------------------------------------------|
| `API_PORT`              | Port (Standard: 8081; ohne `API_PORT` gilt `PORT`)                                            |
| `TEXT_MODULES_DIR`      | Verzeichnis mit eigenen Textbausteinen (Dateinamen wie in `src/assets/`); sonst mitgebündelte |
| `HOST`                  | Adresse, auf der das Backend lauscht (Standard: `127.0.0.1`)                                  |
| `IAP_AUDIENCE`          | prüft die signierte IAP-Kopfzeile, z. B. `/projects/<Nummer>/locations/<Region>/services/echo` |
| `DRAFT_STORE`           | `off` (Standard, keine Entwürfe), `memory` oder `firestore`                                   |
| `DRAFT_ENCRYPTION_KEY`  | Schlüsselbund als JSON (siehe oben); mit `firestore` Pflicht, sonst startet das Backend nicht |
| `RETENTION_DAYS`        | Tage nach der letzten Änderung, ab denen Entwürfe als gelöscht gelten (Standard: 90)          |
| `DEV_USER_EMAIL`        | Entwicklungsnutzer ohne IAP; nur lokal, nicht zusammen mit `IAP_AUDIENCE` oder auf Cloud Run  |
| `FIRESTORE_EMULATOR_HOST` | Adresse des Firestore-Emulators (lokal)                                                     |
| `MCP_AUTH`              | `off` (Standard, kein `/mcp`), `none` (ohne eigene Anmeldung) oder `google`                   |
| `PUBLIC_URL`            | öffentliche Adresse ohne Pfad, für `MCP_AUTH=google`                                          |
| `TRUST_PROXY`           | Anzahl der Proxys vor dem Backend, deren `X-Forwarded-For` gilt (Standard: 1)                 |
| `GOOGLE_CLIENT_ID`      | Client-ID des OAuth-Clients für die Anmeldung                                                 |
| `GOOGLE_CLIENT_SECRET`  | Clientschlüssel dieses OAuth-Clients (geheim)                                                 |
| `GOOGLE_ALLOWED_DOMAIN` | Google-Workspace-Domain, deren Konten sich anmelden dürfen, z. B. `atra.consulting`           |
| `TOKEN_SECRET`          | 32 Byte in Base64 zum Verschlüsseln der Tokens (geheim), z. B. `openssl rand -base64 32`      |

Mit `MCP_AUTH=google` sind `PUBLIC_URL` und die vier Google-Variablen Pflicht. Lauscht das Backend nicht auf einer
Loopback-Adresse, beantwortet es nur Anfragen an den Host aus `PUBLIC_URL` oder an `localhost`. `MCP_AUTH=none` auf
einer anderen Adresse verweigert den Start ohne `IAP_AUDIENCE` (lokal genügt `DEV_USER_EMAIL`). Mit `DRAFT_STORE`
braucht das Backend eine geprüfte Anmeldung: `IAP_AUDIENCE` oder lokal `DEV_USER_EMAIL`. `TRUST_PROXY` ist auf Cloud
Run 2 (Front-End von Cloud Run und nginx), lokal hinter nginx 1.

### Zugriffsschutz

- **Web-App und REST-API** haben keine eigene Anmeldung. Die Instanz von atra.consulting liegt hinter
  Identity-Aware Proxy (IAP) direkt am Cloud-Run-Dienst; der Browser schickt die Anmeldung bei jedem Aufruf von `/api`
  mit. Mit `IAP_AUDIENCE` prüft das Backend die signierte Kopfzeile `x-goog-iap-jwt-assertion` und nimmt aus ihr die
  E-Mail-Adresse als Besitzer der Entwürfe (`server/adapters/iap-identity.ts`); unsignierten Kopfzeilen wie
  `x-goog-authenticated-user-email` vertraut es nicht. `/api/health` bleibt für die Startprüfung frei.
- **MCP hinter IAP** (`MCP_AUTH=none` mit `IAP_AUDIENCE`, so in der Instanz von atra.consulting): `/mcp` hat keine
  eigene Anmeldung, verlangt aber wie `/api` die geprüfte IAP-Kopfzeile; Besitzer der Entwürfe ist die E-Mail-Adresse
  daraus. Lokale Agenten wie Claude Code kommen mit einem eigenen ID-Token durch IAP (siehe unten). Ein öffentlicher
  Endpunkt ist dafür nicht nötig.
- **Connectors in claude.ai** rufen den Server von den Servern von Anthropic aus auf und können IAP nicht passieren.
  Für sie gibt es `MCP_AUTH=google`: ein öffentlich erreichbarer Dienst mit eigener Anmeldung (siehe
  [Anmeldung mit Google](#anmeldung-mit-google)); Besitzer der Entwürfe ist dann das angemeldete Google-Konto.

### Claude Code über IAP

IAP lässt Programme mit dem ID-Token der Person durch (programmatischer Zugriff). Das Skript
`scripts/mcp-iap-headers.mjs` erzeugt es und gibt es Claude Code als Kopfzeile `Proxy-Authorization: Bearer …` mit;
IAP prüft und entfernt sie.

1. Wer das Google-Cloud-Projekt betreibt, legt einen OAuth-Client vom Typ „Desktop-App“ an und trägt seine Client-ID
   für den programmatischen Zugriff von IAP ein (Allowlist). Ohne diesen Eintrag weist IAP das Token ab.
2. Einmalig mit der JSON-Datei dieses Clients anmelden:

   ```bash
   gcloud auth application-default login --client-id-file=client.json \
     --scopes=openid,https://www.googleapis.com/auth/userinfo.email,https://www.googleapis.com/auth/cloud-platform
   ```

   Das ersetzt die Application Default Credentials. Brauchst du sie für anderes, kopiere die Datei danach woandershin
   und gib den Pfad in `IAP_CREDENTIALS_FILE` an.
3. `.mcp.json` im Projekt (oder `claude mcp add-json`):

   ```json
   {
     "mcpServers": {
       "zeugnisgenerator": {
         "type": "http",
         "url": "https://<adresse-der-instanz>/mcp",
         "headersHelper": "IAP_OAUTH_CLIENT_ID=<client-id> node <repo>/scripts/mcp-iap-headers.mjs"
       }
     }
   }
   ```

Ein ID-Token gilt eine Stunde. Claude Code ruft das Skript beim Verbinden auf; meldet IAP danach 401, verbinde den
Server neu (`/mcp` in Claude Code).

### Anmeldung mit Google

MCP-Clients wie claude.ai erwarten einen OAuth-Server mit dynamischer Client-Registrierung, die Google nicht anbietet.
Der MCP-Server ist deshalb selbst der OAuth-Server und überlässt nur die Anmeldung Google:

1. Der Client registriert sich beim Server. Erlaubt sind nur die Rückleitungsadressen von claude.ai
   (`https://claude.ai/api/mcp/auth_callback`, `https://claude.com/api/mcp/auth_callback`) und Adressen auf
   `localhost` für lokale Clients wie Claude Code. Die Liste steht in `server/http/google-oauth.ts`.
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

### Backend-Image

Das Backend-Image baust du mit `docker build -f server/Dockerfile -t zeugnisgenerator-backend .`; es enthält nur den
gebündelten Server samt Abhängigkeiten und Textbausteinen. Zusammen mit dem Web-Container startest du es mit
`docker compose up --build` (siehe [Betrieb mit Docker](#betrieb-mit-docker)), `/mcp` für den Entwicklungsnutzer mit
`MCP_AUTH=none docker compose up --build`. Neben dem Bündel liegt im Image nur der Firestore-Client mit seinen
Abhängigkeiten (`dist/server/node_modules`), weil er sich nicht bündeln lässt.

---

## Textbausteine

Die Textbausteine liegen als JSON-Dateien in `src/assets/`. Das Backend bündelt sie und liefert sie über die REST-API
aus; der Build der Web-App enthält sie nicht (`angular.json` schließt `data_*.json` aus).

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

- Die Vorschau entsteht im Browser. Eingaben erreichen das Backend erst, wenn du einen Entwurf speicherst.
- Gespeicherte Entwürfe liegen verschlüsselt in Firestore, zugeordnet der E-Mail-Adresse der angemeldeten Person. 90
  Tage nach der letzten Änderung sind sie nicht mehr abrufbar und werden danach gelöscht, in der Regel innerhalb eines
  Tages (siehe [Entwürfe speichern](#entwürfe-speichern)). Exportierte JSON-Dateien sind nicht verschlüsselt.
- `POST /api/references` verarbeitet Angaben zur Person nur für die Dauer der Anfrage und speichert sie nicht.
  Anfrageinhalte protokolliert das Backend nie, auch nicht bei fehlerhaften Anfragen. Bei KI-Agenten liegen die
  Angaben auch beim Anbieter des Agenten. Mit `MCP_AUTH=google` steckt in den Tokens verschlüsselt die E-Mail-Adresse
  des angemeldeten Kontos.
- Eingaben (auch Namen und Geburtsdaten), die gewählten Textbausteine, den erzeugten Text und die Id des geöffneten
  Entwurfs speichert die App außerdem im `localStorage` des Browsers, damit ungespeicherte Arbeit ein Neuladen
  übersteht. Sie bleiben dort, bis du in der Kopfleiste der Eingabeseite auf das Symbol
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
| **Auslieferung**     | nginx (unprivilegiert) als Ingress · Cloud Run mit zwei Containern           |
| **Google-Anbindung** | Google Identity Services · REST-APIs von Docs, Sheets und Drive              |
| **Backend**          | Express · zod · MCP TypeScript SDK · jose · esbuild · Test-Runner von Node.js |
| **Datenhaltung**     | Firestore (Entwürfe, verschlüsselt mit AES-256-GCM) · Emulator für lokal     |
| **CI/CD**            | GitHub Actions · semantic-release · commitlint                               |

---

## Projektstruktur

Die wichtigsten Ordner und Dateien:

```
├── .github/workflows/               Build und Tests, Commit-Prüfung, Release, Deployment
├── deploy/
│   ├── cloud-run/service.yaml       Cloud-Run-Dienst mit zwei Containern
│   └── nginx/                       Konfiguration des Ingress
├── docs/
│   ├── adrs/                        Architekturentscheidungen
│   └── corporate-design.md          Schrift und Farben von atra.consulting
├── server/                          Backend: REST-API und MCP-Server
│   ├── core/                        Kern ohne Frameworks: Ports, Schritte, Entwürfe, Schemas
│   ├── adapters/                    Textbausteine, Ablagen, Verschlüsselung, Anmeldung
│   ├── http/                        REST-API, OpenAPI, Zugriffsschutz, OAuth für MCP
│   ├── mcp/                         MCP-Tools, Prompt und Hinweise für Agenten
│   ├── main.ts                      Konfiguration und Verdrahtung
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
│   │   ├── draft-list/              Liste der Entwürfe auf der Startseite
│   │   ├── drafts.service.ts        Entwürfe über die REST-API
│   │   ├── google-auth.service.ts   Google-Anmeldung
│   │   ├── google-doc.service.ts    Export nach Google Docs und Sheets
│   │   ├── google.config.ts         Client-ID und Vorlage für den Google-Export
│   │   ├── reference-text.ts        Platzhalter und Textaufbau, auch für das Backend
│   │   └── theme.service.ts         helles und dunkles Design
│   ├── assets/                      Textbausteine (data_*.json, nur im Backend) und Logos
│   ├── favicon.ico
│   ├── index.html
│   └── styles.scss                  globales Theme (Angular Material M3)
├── CLAUDE.md                        Hinweise für Coding-Agenten
├── CONTRIBUTING.md                  Mitwirken
├── Dockerfile                       Web-App mit nginx (Ingress)
├── LICENSE
├── SECURITY.md                      Sicherheitslücken melden
├── angular.json
├── compose.yaml                     Web-App, Backend und Firestore-Emulator lokal
├── package.json
├── proxy.conf.json                  Weiterleitung von /api und /mcp im Dev-Server
└── scripts/mcp-iap-headers.mjs      ID-Token für MCP-Clients hinter IAP
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
