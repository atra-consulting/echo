# Mitwirken am Zeugnisgenerator

Danke für dein Interesse! Der Zeugnisgenerator ist ein Werkzeug von atra.consulting, der Code steht unter der
[MIT-Lizenz](LICENSE). Issues und Pull Requests sind willkommen.

## Bevor du loslegst

- Für Fehlerkorrekturen und kleine Verbesserungen reicht ein Pull Request.
- Größere Änderungen, etwa neue Funktionen, Umbauten oder neue Abhängigkeiten, stimmst du bitte vorher in einem Issue
  ab.
- Vorschläge zu den Textbausteinen (`src/assets/data_*.json`) reichst du bitte nur als Issue ein, nicht als Pull
  Request. Die Textbausteine stehen nicht unter der MIT-Lizenz (siehe [Lizenz](#lizenz)).
- Sicherheitslücken meldest du bitte nicht öffentlich, sondern wie in [SECURITY.md](SECURITY.md) beschrieben.

## Lokal einrichten

Du brauchst Node.js 22.12+ oder 24+ und für die Tests Google Chrome.

```bash
npm ci
npm run dev
```

Die App läuft dann unter http://localhost:4200/.

## Tests und Build

```bash
npx ng test --watch=false --browsers=ChromeHeadless
npm run build
```

Beides muss vor einem Pull Request fehlerfrei durchlaufen. Die Warnung, dass das Initial-Bundle das Budget von 1 MB
überschreitet, ist bekannt. Neue Logik bekommt passende Tests. Der Workflow `.github/workflows/ci.yml` führt Build und
Tests in jedem Pull Request noch einmal aus.

## Abhängigkeiten

Der Docker-Build verwendet npm 10 (aus `node:22-alpine`). Ändere Abhängigkeiten deshalb mit npm 10, zum Beispiel
`npx -y npm@10 install <paket>`, damit `package-lock.json` mit npm 10 installierbar bleibt.

Installiere sonst immer mit `npm ci`. Mit npm 11 (Node.js 24) schreibt schon ein einfaches `npm install` die Datei
`package-lock.json` um, und `npm ci` mit npm 10 schlägt danach fehl („Missing: chokidar@5.0.0 from lock file“). Solche
Änderungen an `package-lock.json` committest du bitte nicht.

## Commit-Nachrichten

Commits folgen [Conventional Commits](https://www.conventionalcommits.org/de/v1.0.0/) mit Typen wie `feat:`, `fix:`,
`docs:` oder `chore:`. In jedem Pull Request prüft commitlint die Nachrichten. Nach dem Merge auf `main` leitet
semantic-release daraus die nächste Version und das Changelog ab.

## Code-Stil

- [Angular Style Guide](https://angular.dev/style-guide), Standalone Components mit `OnPush`
- TypeScript im Strict Mode
- 4 Leerzeichen, LF, höchstens 120 Zeichen pro Zeile (siehe `.editorconfig`)
- Komponenten-Selektoren mit dem Präfix `app-`
- Texte in der Oberfläche auf Deutsch, mit der Anrede „Sie“

## Pull Requests

1. Forke das Repository und lege einen Branch an.
2. Behandle ein Thema pro Pull Request.
3. Beschreibe, was du änderst, warum und wie du es getestet hast.
4. Richte den Pull Request auf `main`.

## Lizenz

Beiträge zum Code stehen unter der [MIT-Lizenz](LICENSE); mit einem Pull Request bestätigst du, dass du sie unter
dieser Lizenz beisteuern darfst.

Die Textbausteine sind von der MIT-Lizenz ausgenommen (siehe [README](README.md#lizenz)). Mit einem Vorschlag zu den
Textbausteinen bestätigst du, dass du ihn einreichen darfst, etwa weil die Formulierung von dir stammt. Zugleich
erlaubst du der atra.consulting GmbH & Co. KG, ihn unentgeltlich und zeitlich unbeschränkt zu nutzen, zu bearbeiten und
in die Textbausteine zu übernehmen sowie als Teil davon zu veröffentlichen und Dritten zur Nutzung zu überlassen.
