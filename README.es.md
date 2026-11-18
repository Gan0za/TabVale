# TabVale

**Read in:** [English](README.md) · [Русский](README.ru.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [Español](README.es.md) · [Português (Brasil)](README.pt-BR.md) · [Italiano](README.it.md) · [Polski](README.pl.md) · [Türkçe](README.tr.md) · [Українська](README.uk.md) · [中文](README.zh.md) · [日本語](README.ja.md) · [한국어](README.ko.md)

> Traducción breve. El README en inglés es la fuente de verdad. Traducción hecha por un no nativo; correcciones bienvenidas en GitHub Issues.

Una extensión para Chrome y Microsoft Edge que sustituye la pestaña nueva por
un panel personalizable: búsqueda, varias pantallas de marcadores, fondos y
plugins opcionales.

## Funciones

- Búsqueda con motor seleccionable; la lista se edita y cada motor tiene su icono.
- Varias pantallas de marcadores: puntos, deslizamiento en zona vacía, `Alt+←/→`; mover marcadores entre pantallas.
- Marcadores con iconos (en caché local), ordenar arrastrando, editar y borrar.
- Fondos: URL, archivo local, color o degradado.
- Temas automático/claro/oscuro y 13 idiomas de interfaz.
- Plugins — solo los que usted instala: reloj, notas, teclado, temporizador, contraseñas, tiempo, estadísticas de GitHub, lanzador de aplicaciones, RSS, tareas, citas, importación de marcadores.
- Importación y exportación de ajustes en JSON.

## Instalación

1. Abra `chrome://extensions` o `edge://extensions`.
2. Active el modo desarrollador.
3. «Cargar descomprimida» y elija la carpeta del proyecto.
4. Abra una pestaña nueva.

## Plugins

No hay plugins instalados por defecto. Los paquetes `.tvp` están en la
[sección «Plugins» del sitio](https://gan0za.github.io/TabVale/#plugins) y en
`docs/plugins/`. Descargue el archivo e instálelo: Ajustes → Plugins →
«Instalar desde archivo…». El gestor elige la zona — panel, franja sobre o bajo
los marcadores, mosaico, ventana flotante; el menú contextual del plugin abre su
fila, lo desactiva o lo elimina.

## Desarrollo de plugins (breve)

Un plugin es un zip `.tvp` con `manifest.json`, el archivo de código y un icono
opcional. El código define `mount(api)` y se ejecuta en un sandbox sin
`chrome.*`: datos con `api.storage`, red con `api.fetch` según la lista blanca
del manifiesto, interfaz con `api.ui`, iconos de sitios con `api.icon.favicon`.
Empaquetado: `node tools/pack-plugin.mjs path/to/plugin`.

Detalles en inglés: [formato](docs/PLUGIN_SPEC.md), [API](docs/PLUGIN_API.md),
[guía](docs/PLUGIN_GUIDE.md).

## Privacidad y permisos

Marcadores, pantallas, fondos y ajustes viven en `chrome.storage`; los iconos
de sitios en IndexedDB local y no salen del dispositivo. Detalles:
[PRIVACY.md](PRIVACY.md) (inglés).

## Licencia

MIT. Ver [LICENSE](LICENSE).
