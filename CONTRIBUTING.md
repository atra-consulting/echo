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

Du brauchst Node.js 26 und für die Tests Google Chrome.

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

CI und Docker-Builds installieren mit `npm ci` unter Node.js 26, also mit npm 11. Ändere Abhängigkeiten deshalb mit
npm 11 (`npm install <paket>`), damit `package-lock.json` damit installierbar bleibt.

Installiere sonst immer mit `npm ci`. Änderungen an `package-lock.json`, die nicht zu einer geänderten Abhängigkeit
gehören, committest du bitte nicht.

## Commit-Nachrichten

Schreib eine kurze Betreffzeile auf Englisch im Imperativ und erkläre bei Bedarf im Text darunter, warum sich etwas
ändert. Präfixe nach [Conventional Commits](https://www.conventionalcommits.org/de/v1.0.0/) wie `feat:`, `fix:` oder
`chore:` sind üblich, werden aber nicht mehr geprüft oder ausgewertet. Automatische Releases gibt es nicht mehr.

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
