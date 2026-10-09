# Sicherheit

## Sicherheitslücke melden

Bitte melde Sicherheitslücken **nicht als öffentliches Issue**, sondern per E-Mail an
**datenschutz@atra.consulting**.

Hilfreich sind:

- eine kurze Beschreibung der Lücke und ihrer möglichen Auswirkung,
- die Schritte zur Reproduktion mit betroffener Datei, Commit und Browser,
- falls vorhanden ein Vorschlag zur Behebung.

Wir melden uns so bald wie möglich und stimmen das weitere Vorgehen mit dir ab. Bitte veröffentliche Details erst, wenn
die Lücke behoben ist.

## Geltungsbereich

Diese Richtlinie gilt für den Code in diesem Repository: die Web-App Zeugnisgenerator einschließlich Google-Export,
Dockerfile und GitHub-Workflows. Besonders interessieren uns:

- der Umgang mit personenbezogenen Daten im Browser (`localStorage`),
- die Google-Anmeldung und das Zugriffstoken,
- die Darstellung von Eingaben und Textbausteinen in der Vorschau.

Nicht dazu gehören Lücken in Diensten von Google oder in Abhängigkeiten ohne konkreten Bezug zu diesem Projekt (bitte
direkt beim jeweiligen Anbieter bzw. Projekt melden) sowie Instanzen, die Dritte selbst betreiben.

## Unterstützte Versionen

Sicherheitskorrekturen gibt es nur für den aktuellen Stand von `main`.
