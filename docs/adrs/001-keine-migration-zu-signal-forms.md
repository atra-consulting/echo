# ADR-001: Keine Migration zu Angular Signal Forms

**Datum:** 2026-03-08
**Status:** Akzeptiert

## Kontext

Die Anwendung nutzt Angular 21 und verwendet aktuell **Template-Driven Forms** (`FormsModule` mit `[(ngModel)]`) für alle Formulareingaben. Die Formulardaten werden zentral im `DataStorageService` verwaltet und in localStorage persistiert.

Angular bietet seit Version 19 experimentelle **Signal Forms** (`SignalFormControl`, `SignalFormGroup`, etc.) als signal-basierte Alternative zu Reactive Forms und Template-Driven Forms an. Die Frage ist, ob eine Migration auf Signal Forms sinnvoll wäre.

### Aktueller Stand

- Alle Formular-Komponenten (`IntroComponent`, `PositionComponent`, `BlockSelectorComponent`, `BlockRatingComponent`) nutzen `[(ngModel)]` für Data-Binding.
- Signal-basierte `input()` werden bereits teilweise für Component-Inputs verwendet.
- Der `DataStorageService` verwaltet den Zustand als plain Objects — die Formulare dienen nur als Binding-Schicht.
- Es gibt keine komplexe Validierung, keine dynamischen Formularfelder und keine verschachtelten Formulargruppen.

## Entscheidung

Wir migrieren **nicht** zu Angular Signal Forms.

## Begründung

1. **Experimentelle API:** Signal Forms sind in Angular 21 noch nicht als stable markiert. Eine Migration birgt das Risiko von Breaking Changes in zukünftigen Angular-Versionen.

2. **Geringe Formularkomplexität:** Die Anwendung hat einfache Eingaben (Textfelder, Dropdowns, Datepicker, Radio-Buttons). Template-Driven Forms decken diese Anforderungen vollständig ab.

3. **Zustandsverwaltung liegt außerhalb der Forms:** Die eigentliche Datenverwaltung ist im `DataStorageService` zentralisiert. Signal Forms würden die Binding-Schicht ersetzen, aber keinen Mehrwert für die Zustandslogik bringen.

4. **Ungünstiges Aufwand-Nutzen-Verhältnis:** Alle Formular-Komponenten müssten umgebaut werden, ohne funktionalen Gewinn.

## Alternativen

| Alternative | Bewertung |
|---|---|
| **Signal Forms** | Abgelehnt — experimentelle API, kein funktionaler Mehrwert bei der aktuellen Formularkomplexität. |
| **Reactive Forms** (`FormGroup`/`FormControl`) | Möglicher Zwischenschritt, falls zukünftig komplexere Validierung oder dynamische Formulare benötigt werden. Stabile API mit besserer Testbarkeit. |
| **Template-Driven Forms beibehalten** | Gewählt — einfach, ausreichend für den aktuellen Anwendungsfall, kein Migrationsaufwand. |

## Konsequenzen

- Template-Driven Forms mit `[(ngModel)]` bleiben der Standard für Formulare in dieser Anwendung.
- Die Entscheidung sollte neu bewertet werden, sobald Angular Signal Forms als stable markiert werden und die Formularkomplexität der Anwendung zunimmt.
- Neue Formular-Komponenten sollen ebenfalls Template-Driven Forms verwenden.
