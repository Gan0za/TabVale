# TabVale

**Read in:** [English](README.md) · [Русский](README.ru.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [Español](README.es.md) · [Português (Brasil)](README.pt-BR.md) · [Italiano](README.it.md) · [Polski](README.pl.md) · [Türkçe](README.tr.md) · [Українська](README.uk.md) · [中文](README.zh.md) · [日本語](README.ja.md) · [한국어](README.ko.md)

> Kurze Übersetzung. Das englische README ist maßgeblich. Die Übersetzung wurde von einem Nicht-Muttersprachler erstellt; Korrekturen sind über GitHub Issues willkommen.

Eine Erweiterung für Chrome und Microsoft Edge, die die neue Tabseite durch
ein anpassbares Dashboard ersetzt: Suche, mehrere Lesezeichen-Bildschirme,
Hintergründe und optionale Plugins.

## Funktionen

- Suche mit wählbarer Suchmaschine; die Liste ist bearbeitbar, jede hat ein eigenes Symbol.
- Mehrere Lesezeichen-Bildschirme: Punkte, Wischen auf leerer Fläche, `Alt+←/→`; Lesezeichen zwischen Bildschirmen verschieben.
- Lesezeichen mit Symbolen (lokal zwischengespeichert), Ziehen zum Sortieren, Bearbeiten und Löschen.
- Hintergründe: URL, lokale Datei, Farbe oder Verlauf.
- Designs automatisch/hell/dunkel und 13 Sprachen der Oberfläche.
- Plugins — nur die, die Sie selbst installieren: Uhr, Notizen, Tastaturbelegung, Timer, Passwörter, Wetter, GitHub-Statistik, App-Starter, RSS, Aufgaben, Lesezeichen-Import.
- Import und Export der Einstellungen als JSON.

## Installation

1. `chrome://extensions` oder `edge://extensions` öffnen.
2. Entwicklermodus einschalten.
3. „Entpackte Erweiterung laden“ und den Projektordner wählen.
4. Einen neuen Tab öffnen.

## Plugins

Standardmäßig ist kein Plugin installiert. Fertige `.tvp`-Pakete liegen im
[Abschnitt „Plugins“ der Website](https://gan0za.github.io/TabVale/#plugins)
und im Ordner `docs/plugins/`. Datei herunterladen und installieren:
Einstellungen → Plugins → „Aus Datei installieren…“. Der Manager wählt die Zone
— Panel, Leiste über oder unter den Lesezeichen, Kachel, schwebendes Fenster;
das Kontextmenü eines Plugins öffnet seine Zeile, schaltet es aus oder entfernt es.

## Plugin-Entwicklung (kurz)

Ein Plugin ist ein `.tvp`-Zip mit `manifest.json`, Codedatei und optionalem
Symbol. Der Code definiert `mount(api)` und läuft in einer Sandbox ohne
`chrome.*`: Daten über `api.storage`, Netz über `api.fetch` gemäß Allowlist des
Manifests, Oberfläche über `api.ui`, Website-Symbole über `api.icon.favicon`.
Packen: `node tools/pack-plugin.mjs path/to/plugin`.

Details auf Englisch: [Paketformat](docs/PLUGIN_SPEC.md),
[API](docs/PLUGIN_API.md), [Anleitung](docs/PLUGIN_GUIDE.md).

## Datenschutz und Berechtigungen

Lesezeichen, Bildschirme, Hintergründe und Einstellungen liegen in
`chrome.storage`; Website-Symbole im lokalen IndexedDB und verlassen das Gerät
nicht. Details: [PRIVACY.md](PRIVACY.md) (englisch).

## Lizenz

MIT. Siehe [LICENSE](LICENSE).
