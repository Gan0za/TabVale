# TabVale

**Read in:** [English](README.md) · [Русский](README.ru.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [Español](README.es.md) · [Português (Brasil)](README.pt-BR.md) · [Italiano](README.it.md) · [Polski](README.pl.md) · [Türkçe](README.tr.md) · [Українська](README.uk.md) · [中文](README.zh.md) · [日本語](README.ja.md) · [한국어](README.ko.md)

> Traduction courte. Le README anglais fait foi. Traduction réalisée par un non-natif ; corrections bienvenues via GitHub Issues.

Une extension pour Chrome et Microsoft Edge qui remplace le nouvel onglet par
un tableau de bord personnalisable : recherche, plusieurs écrans de favoris,
arrière-plans et plugins optionnels.

## Fonctionnalités

- Recherche avec moteur au choix ; la liste est modifiable, chaque moteur a son icône.
- Plusieurs écrans de favoris : points, balayage sur une zone vide, `Alt+←/→` ; déplacement des favoris entre écrans.
- Favoris avec icônes (mises en cache localement), tri par glisser-déposer, édition et suppression.
- Arrière-plans : URL, fichier local, couleur ou dégradé.
- Thèmes auto/clair/sombre et 13 langues d’interface.
- Plugins — uniquement ceux que vous installez : horloge, notes, clavier, minuteur, mots de passe, météo, statistiques GitHub, lanceur d’applications, RSS, import de favoris.
- Import et export des réglages en JSON.

## Installation

1. Ouvrez `chrome://extensions` ou `edge://extensions`.
2. Activez le mode développeur.
3. « Charger l’extension non empaquetée » puis le dossier du projet.
4. Ouvrez un nouvel onglet.

## Plugins

Aucun plugin n’est installé par défaut. Les paquets `.tvp` sont dans la
[section « Plugins » du site](https://gan0za.github.io/TabVale/#plugins) et
dans `docs/plugins/`. Téléchargez le fichier puis : Réglages → Plugins →
« Installer depuis un fichier… ». Le gestionnaire choisit la zone — panneau,
bande au-dessus ou en dessous des favoris, tuile, fenêtre flottante ; le menu
contextuel du plugin ouvre sa ligne, le désactive ou le supprime.

## Développement de plugins (bref)

Un plugin est une archive `.tvp` avec `manifest.json`, le fichier de code et une
icône facultative. Le code définit `mount(api)` et s’exécute dans une sandbox
sans `chrome.*` : données via `api.storage`, réseau via `api.fetch` selon la
liste blanche du manifeste, interface via `api.ui`, icônes de sites via
`api.icon.favicon`. Empaquetage : `node tools/pack-plugin.mjs path/to/plugin`.

Détails en anglais : [format](docs/PLUGIN_SPEC.md), [API](docs/PLUGIN_API.md),
[guide](docs/PLUGIN_GUIDE.md).

## Confidentialité et autorisations

Favoris, écrans, arrière-plans et réglages sont dans `chrome.storage` ; les
icônes de sites dans IndexedDB local et ne quittent pas l’appareil. Détails :
[PRIVACY.md](PRIVACY.md) (anglais).

## Licence

MIT. Voir [LICENSE](LICENSE).
