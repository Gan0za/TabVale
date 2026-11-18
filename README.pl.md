# TabVale

**Read in:** [English](README.md) · [Русский](README.ru.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [Español](README.es.md) · [Português (Brasil)](README.pt-BR.md) · [Italiano](README.it.md) · [Polski](README.pl.md) · [Türkçe](README.tr.md) · [Українська](README.uk.md) · [中文](README.zh.md) · [日本語](README.ja.md) · [한국어](README.ko.md)

> Krótkie tłumaczenie. Wersja angielska README jest źródłem prawdy. Tłumaczenie wykonał nienatywny użytkownik; poprawki mile widziane przez GitHub Issues.

Rozszerzenie dla Chrome i Microsoft Edge, które zastępuje nową kartę
konfigurowalnym pulpitem: wyszukiwanie, wiele ekranów zakładek, tła i opcjonalne
wtyczki.

## Funkcje

- Wyszukiwanie z wyborem wyszukiwarki; lista jest edytowalna, każda ma własną ikonę.
- Wiele ekranów zakładek: kropki, przesunięcie na pustym obszarze, `Alt+←/→`; przenoszenie zakładek między ekranami.
- Zakładki z ikonami (buforowanymi lokalnie), sortowanie przeciąganiem, edycja i usuwanie.
- Tła: adres, plik lokalny, kolor lub gradient.
- Motywy auto/jasny/ciemny i 13 języków interfejsu.
- Wtyczki — tylko te, które sam zainstalujesz: zegar, notatki, klawiatura, minutnik, hasła, pogoda, statystyki GitHub, launcher aplikacji, RSS, zadania, import zakładek.
- Import i eksport ustawień w JSON.

## Instalacja

1. Otwórz `chrome://extensions` lub `edge://extensions`.
2. Włącz tryb programisty.
3. „Załaduj rozpakowane” i wskaż katalog projektu.
4. Otwórz nową kartę.

## Wtyczki

Domyślnie nie ma żadnej wtyczki. Gotowe pakiety `.tvp` są w
[sekcji „Wtyczki” na stronie](https://gan0za.github.io/TabVale/#plugins) i w
katalogu `docs/plugins/`. Pobierz plik i zainstaluj: Ustawienia → Wtyczki →
„Zainstaluj z pliku…”. Menedżer wybiera strefę — panel, pasek nad lub pod
zakładkami, kafelek, okno pływające; menu kontekstowe wtyczki otwiera jej wiersz,
wyłącza lub usuwa.

## Tworzenie wtyczek (skrót)

Wtyczka to plik `.tvp` (zip) z `manifest.json`, plikiem kodu i opcjonalną ikoną.
Kod definiuje `mount(api)` i działa w sandboxie bez `chrome.*`: dane przez
`api.storage`, sieć przez `api.fetch` zgodnie z listą manifestu, interfejs przez
`api.ui`, ikony witryn przez `api.icon.favicon`.
Pakowanie: `node tools/pack-plugin.mjs path/to/plugin`.

Szczegóły po angielsku: [format](docs/PLUGIN_SPEC.md), [API](docs/PLUGIN_API.md),
[przewodnik](docs/PLUGIN_GUIDE.md).

## Prywatność i uprawnienia

Zakładki, ekrany, tła i ustawienia są w `chrome.storage`; ikony witryn w lokalnym
IndexedDB i nie opuszczają urządzenia. Szczegóły: [PRIVACY.md](PRIVACY.md)
(angielski).

## Licencja

MIT. Zobacz [LICENSE](LICENSE).
