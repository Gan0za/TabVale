# TabVale

**Read in:** [English](README.md) · [Русский](README.ru.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [Español](README.es.md) · [Português (Brasil)](README.pt-BR.md) · [Italiano](README.it.md) · [Polski](README.pl.md) · [Türkçe](README.tr.md) · [Українська](README.uk.md) · [中文](README.zh.md) · [日本語](README.ja.md) · [한국어](README.ko.md)

> Traduzione breve. Il README in inglese è la fonte di verità. Traduzione di un non madrelingua; correzioni benvenute via GitHub Issues.

Un’estensione per Chrome e Microsoft Edge che sostituisce la nuova scheda con
una dashboard personalizzabile: ricerca, più schermate di segnalibri, sfondi e
plugin opzionali.

## Funzioni

- Ricerca con motore selezionabile; l’elenco è modificabile e ogni motore ha la sua icona.
- Più schermate di segnalibri: punti, scorrimento su area vuota, `Alt+←/→`; spostamento dei segnalibri tra schermate.
- Segnalibri con icone (in cache locale), ordinamento tramite trascinamento, modifica ed eliminazione.
- Sfondi: URL, file locale, colore o gradiente.
- Temi auto/chiaro/scuro e 13 lingue dell’interfaccia.
- Plugin — solo quelli che installi: orologio, note, tastiera, timer, password, meteo, statistiche GitHub, avvio applicazioni, RSS, attività, citazioni, importazione segnalibri.
- Importazione ed esportazione delle impostazioni in JSON.

## Installazione

1. Apri `chrome://extensions` o `edge://extensions`.
2. Attiva la modalità sviluppatore.
3. «Carica estensione non pacchettizzata» e scegli la cartella del progetto.
4. Apri una nuova scheda.

## Plugin

Nessun plugin è installato per impostazione predefinita. I pacchetti `.tvp`
sono nella [sezione «Plugin» del sito](https://gan0za.github.io/TabVale/#plugins)
e in `docs/plugins/`. Scarica il file e installalo: Impostazioni → Plugin →
«Installa da file…». Il gestore sceglie la zona — pannello, striscia sopra o
sotto i segnalibri, riquadro, finestra flottante; il menu contestuale del plugin
apre la sua riga, lo disattiva o lo rimuove.

## Sviluppo di plugin (breve)

Un plugin è uno zip `.tvp` con `manifest.json`, file di codice e icona
opzionale. Il codice definisce `mount(api)` e gira in una sandbox senza
`chrome.*`: dati con `api.storage`, rete con `api.fetch` secondo la lista del
manifest, interfaccia con `api.ui`, icone dei siti con `api.icon.favicon`.
Creazione del pacchetto: `node tools/pack-plugin.mjs path/to/plugin`.

Dettagli in inglese: [formato](docs/PLUGIN_SPEC.md), [API](docs/PLUGIN_API.md),
[guida](docs/PLUGIN_GUIDE.md).

## Privacy e autorizzazioni

Segnalibri, schermate, sfondi e impostazioni stanno in `chrome.storage`; le
icone dei siti nell’IndexedDB locale e non lasciano il dispositivo. Dettagli:
[PRIVACY.md](PRIVACY.md) (inglese).

## Licenza

MIT. Vedi [LICENSE](LICENSE).
