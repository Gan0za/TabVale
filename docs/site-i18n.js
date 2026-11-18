// Переводы главной страницы сайта на языки интерфейса расширения.
// Ключи совпадают с data-i18n / data-i18n-attr в index.html.
(function () {
  'use strict';

  const STORAGE_KEY = 'tabvale-site-lang';
  const LANGUAGES = [
    ['en', 'English'],
    ['ru', 'Русский'],
    ['de', 'Deutsch'],
    ['fr', 'Français'],
    ['es', 'Español'],
    ['pt-BR', 'Português (Brasil)'],
    ['it', 'Italiano'],
    ['pl', 'Polski'],
    ['tr', 'Türkçe'],
    ['uk', 'Українська'],
    ['zh-CN', '中文'],
    ['ja', '日本語'],
    ['ko', '한국어'],
  ];

  const DICT = {
    en: {
      title: 'TabVale — a new tab with room for every bookmark',
      description: "TabVale replaces the browser's new tab with search, independent bookmark screens and calm backgrounds. All data stays in your browser.",
      ogDescription: 'Search, several bookmark screens and calm backgrounds in one quiet page. No accounts, no tracking, no servers.',
      skip: 'Skip to content',
      navFeatures: 'Features',
      navScreenshots: 'Screenshots',
      navPrivacy: 'Privacy',
      eyebrow: 'Chrome & Edge extension',
      heroTitle: 'A new tab with room for every bookmark.',
      lead: 'Search, independent bookmark screens and calm backgrounds — in one quiet page. No accounts, no analytics, no servers: your data stays in the browser.',
      ctaGitHub: 'View on GitHub',
      ctaInstall: 'Install from source',
      ctaStore: 'Chrome Web Store — coming soon',
      factLanguages: '13 languages',
      factThemes: 'Light, dark and auto themes',
      factLocal: 'Data stays local',
      heroAlt: 'TabVale new tab page in the dark theme with bookmark tiles and a search field',
      featuresTitle: 'Everything on one calm page',
      featuresLead: 'Built for people who keep a lot of links and want them close.',
      cardSearchTitle: 'Search your way',
      cardSearchText: 'Pick the search engine, edit the list and give each engine its own icon.',
      cardScreensTitle: 'Screens for everything',
      cardScreensText: 'Separate bookmark sets for work, study and hobbies. Switch with dots, a swipe, or Alt + arrows.',
      cardBookmarksTitle: 'Bookmarks that stay tidy',
      cardBookmarksText: 'Drag to reorder, edit in place, delete from the context menu, and get title suggestions. Site icons are cached locally, so they stay visible even offline.',
      cardBackgroundsTitle: 'Backgrounds your mood',
      cardBackgroundsText: 'An image URL, a local file, a solid colour or a gradient — with cover, contain, tile or centre placement.',
      cardThemeTitle: 'Light, dark, automatic',
      cardThemeText: 'Follow the system theme or pin one you like; every screen and panel adapts.',
      cardLanguagesTitle: '13 languages',
      cardLanguagesText: 'English, Russian, German, French, Spanish, Portuguese, Italian, Polish, Turkish, Ukrainian, Chinese, Japanese and Korean.',
      shotsTitle: 'Screenshots',
      shotsLead: 'Fictional demo data; every shot is 1280×800.',
      themeDark: 'Dark',
      themeLight: 'Light',
      shot1: 'Main page — search and bookmark tiles',
      shot2: 'Screens — separate bookmark sets',
      shot3: 'Backgrounds — images, colours and gradients',
      shot4: 'Search engines — pick and customise',
      shot5: 'Context menu — edit, move, copy, delete',
      shot6: 'Deleting a screen — move bookmarks or remove them',
      privacyTitle: 'Private by design',
      privacyText: 'Bookmarks, screens, backgrounds and settings live in chrome.storage. Nothing is sent to a server, and there is no telemetry.',
      privacyCta: 'Read the privacy policy',
    },

    ru: {
      title: 'TabVale — новая вкладка с местом для каждой закладки',
      description: 'TabVale заменяет новую вкладку браузера поиском, отдельными экранами закладок и спокойными фонами. Все данные остаются в браузере.',
      ogDescription: 'Поиск, несколько экранов закладок и спокойные фоны на одной тихой странице. Без аккаунтов, трекинга и серверов.',
      skip: 'Перейти к содержимому',
      navFeatures: 'Возможности',
      navScreenshots: 'Скриншоты',
      navPrivacy: 'Приватность',
      eyebrow: 'Расширение для Chrome и Edge',
      heroTitle: 'Новая вкладка с местом для каждой закладки.',
      lead: 'Поиск, отдельные экраны закладок и спокойные фоны — на одной тихой странице. Без аккаунтов, аналитики и серверов: ваши данные остаются в браузере.',
      ctaGitHub: 'Открыть на GitHub',
      ctaInstall: 'Установить из исходников',
      ctaStore: 'Chrome Web Store — скоро',
      factLanguages: '13 языков',
      factThemes: 'Светлая, тёмная и автотема',
      factLocal: 'Данные остаются локально',
      heroAlt: 'Новая вкладка TabVale в тёмной теме с плитками закладок и полем поиска',
      featuresTitle: 'Всё на одной спокойной странице',
      featuresLead: 'Для тех, у кого много ссылок и они нужны под рукой.',
      cardSearchTitle: 'Поиск по-своему',
      cardSearchText: 'Выберите поисковую систему, отредактируйте список и задайте каждой свою иконку.',
      cardScreensTitle: 'Экраны для всего',
      cardScreensText: 'Отдельные наборы закладок для работы, учёбы и хобби. Переключение точками, свайпом или Alt + стрелками.',
      cardBookmarksTitle: 'Закладки всегда в порядке',
      cardBookmarksText: 'Перетаскивайте для сортировки, правьте на месте, удаляйте из контекстного меню и получайте подсказки названий. Иконки сайтов кэшируются локально и остаются видны даже без сети.',
      cardBackgroundsTitle: 'Фон под настроение',
      cardBackgroundsText: 'Ссылка на изображение, файл с устройства, сплошной цвет или градиент — с заполнением, вписыванием, плиткой или по центру.',
      cardThemeTitle: 'Светлая, тёмная, автоматическая',
      cardThemeText: 'Следуйте теме системы или закрепите свою; подстраиваются все экраны и панели.',
      cardLanguagesTitle: '13 языков',
      cardLanguagesText: 'Английский, русский, немецкий, французский, испанский, португальский, итальянский, польский, турецкий, украинский, китайский, японский и корейский.',
      shotsTitle: 'Скриншоты',
      shotsLead: 'Вымышленные демо-данные; каждый снимок 1280×800.',
      themeDark: 'Тёмная',
      themeLight: 'Светлая',
      shot1: 'Главная — поиск и плитки закладок',
      shot2: 'Экраны — отдельные наборы закладок',
      shot3: 'Фоны — изображения, цвета и градиенты',
      shot4: 'Поисковые системы — выбор и настройка',
      shot5: 'Контекстное меню — правка, перенос, копирование, удаление',
      shot6: 'Удаление экрана — перенести закладки или удалить',
      privacyTitle: 'Приватность по умолчанию',
      privacyText: 'Закладки, экраны, фоны и настройки хранятся в chrome.storage. Ничего не отправляется на сервер, телеметрии нет.',
      privacyCta: 'Политика конфиденциальности',
    },

    de: {
      title: 'TabVale — ein neuer Tab mit Platz für jedes Lesezeichen',
      description: 'TabVale ersetzt den neuen Tab des Browsers durch Suche, getrennte Lesezeichen-Bildschirme und ruhige Hintergründe. Alle Daten bleiben im Browser.',
      ogDescription: 'Suche, mehrere Lesezeichen-Bildschirme und ruhige Hintergründe auf einer stillen Seite. Keine Konten, kein Tracking, keine Server.',
      skip: 'Zum Inhalt springen',
      navFeatures: 'Funktionen',
      navScreenshots: 'Screenshots',
      navPrivacy: 'Datenschutz',
      eyebrow: 'Erweiterung für Chrome und Edge',
      heroTitle: 'Ein neuer Tab mit Platz für jedes Lesezeichen.',
      lead: 'Suche, getrennte Lesezeichen-Bildschirme und ruhige Hintergründe — auf einer stillen Seite. Keine Konten, keine Analyse, keine Server: Ihre Daten bleiben im Browser.',
      ctaGitHub: 'Auf GitHub ansehen',
      ctaInstall: 'Aus dem Quellcode installieren',
      ctaStore: 'Chrome Web Store — bald',
      factLanguages: '13 Sprachen',
      factThemes: 'Helles, dunkles und automatisches Design',
      factLocal: 'Daten bleiben lokal',
      heroAlt: 'TabVale-Neuer-Tab im dunklen Design mit Lesezeichen-Kacheln und Suchfeld',
      featuresTitle: 'Alles auf einer ruhigen Seite',
      featuresLead: 'Für Menschen mit vielen Links, die sie griffbereit brauchen.',
      cardSearchTitle: 'Suchen, wie Sie möchten',
      cardSearchText: 'Wählen Sie die Suchmaschine, bearbeiten Sie die Liste und geben Sie jeder ein eigenes Symbol.',
      cardScreensTitle: 'Bildschirme für alles',
      cardScreensText: 'Getrennte Lesezeichen-Sammlungen für Arbeit, Studium und Hobbys. Wechseln mit Punkten, Wischen oder Alt + Pfeiltasten.',
      cardBookmarksTitle: 'Lesezeichen, immer in Ordnung',
      cardBookmarksText: 'Ziehen zum Sortieren, direkt bearbeiten, im Kontextmenü löschen und Titelvorschläge erhalten. Website-Symbole werden lokal zwischengespeichert und bleiben auch offline sichtbar.',
      cardBackgroundsTitle: 'Hintergründe nach Stimmung',
      cardBackgroundsText: 'Eine Bild-URL, eine lokale Datei, eine Volltonfarbe oder ein Verlauf — mit Füllen, Einpassen, Kacheln oder Zentrieren.',
      cardThemeTitle: 'Hell, dunkel, automatisch',
      cardThemeText: 'Folgen Sie dem Systemdesign oder legen Sie Ihr eigenes fest; jeder Bildschirm und jedes Panel passt sich an.',
      cardLanguagesTitle: '13 Sprachen',
      cardLanguagesText: 'Englisch, Russisch, Deutsch, Französisch, Spanisch, Portugiesisch, Italienisch, Polnisch, Türkisch, Ukrainisch, Chinesisch, Japanisch und Koreanisch.',
      shotsTitle: 'Screenshots',
      shotsLead: 'Fiktive Demodaten; jeder Screenshot ist 1280×800.',
      themeDark: 'Dunkel',
      themeLight: 'Hell',
      shot1: 'Hauptseite — Suche und Lesezeichen-Kacheln',
      shot2: 'Bildschirme — getrennte Lesezeichen-Sammlungen',
      shot3: 'Hintergründe — Bilder, Farben und Verläufe',
      shot4: 'Suchmaschinen — auswählen und anpassen',
      shot5: 'Kontextmenü — bearbeiten, verschieben, kopieren, löschen',
      shot6: 'Bildschirm löschen — Lesezeichen verschieben oder entfernen',
      privacyTitle: 'Privat von Grund auf',
      privacyText: 'Lesezeichen, Bildschirme, Hintergründe und Einstellungen liegen in chrome.storage. Nichts wird an einen Server gesendet, es gibt keine Telemetrie.',
      privacyCta: 'Datenschutzerklärung lesen',
    },

    fr: {
      title: 'TabVale — un nouvel onglet avec de la place pour chaque favori',
      description: "TabVale remplace le nouvel onglet du navigateur par la recherche, des écrans de favoris indépendants et des arrière-plans apaisants. Toutes les données restent dans le navigateur.",
      ogDescription: 'Recherche, plusieurs écrans de favoris et des arrière-plans apaisants sur une page paisible. Sans comptes, sans suivi, sans serveurs.',
      skip: 'Aller au contenu',
      navFeatures: 'Fonctionnalités',
      navScreenshots: "Captures d'écran",
      navPrivacy: 'Confidentialité',
      eyebrow: 'Extension pour Chrome et Edge',
      heroTitle: 'Un nouvel onglet avec de la place pour chaque favori.',
      lead: "Recherche, écrans de favoris indépendants et arrière-plans apaisants — sur une page paisible. Sans comptes, sans analyse, sans serveurs : vos données restent dans le navigateur.",
      ctaGitHub: 'Voir sur GitHub',
      ctaInstall: 'Installer depuis les sources',
      ctaStore: 'Chrome Web Store — bientôt',
      factLanguages: '13 langues',
      factThemes: 'Thèmes clair, sombre et automatique',
      factLocal: 'Données locales',
      heroAlt: 'Nouvel onglet TabVale en thème sombre avec des tuiles de favoris et un champ de recherche',
      featuresTitle: 'Tout sur une page paisible',
      featuresLead: 'Pour ceux qui gardent beaucoup de liens à portée de main.',
      cardSearchTitle: 'Cherchez à votre façon',
      cardSearchText: 'Choisissez le moteur de recherche, modifiez la liste et donnez à chacun sa propre icône.',
      cardScreensTitle: 'Des écrans pour tout',
      cardScreensText: 'Des ensembles de favoris séparés pour le travail, les études et les loisirs. Basculez avec les points, un balayage ou Alt + flèches.',
      cardBookmarksTitle: 'Des favoris toujours en ordre',
      cardBookmarksText: "Glissez pour réordonner, modifiez sur place, supprimez depuis le menu contextuel et obtenez des suggestions de titre. Les icônes des sites sont mises en cache localement et restent visibles même hors ligne.",
      cardBackgroundsTitle: "Un fond selon l'humeur",
      cardBackgroundsText: "Une URL d'image, un fichier local, une couleur unie ou un dégradé — avec un placement couvrir, contenir, mosaïque ou centré.",
      cardThemeTitle: 'Clair, sombre, automatique',
      cardThemeText: "Suivez le thème du système ou fixez celui que vous aimez ; chaque écran et panneau s'adapte.",
      cardLanguagesTitle: '13 langues',
      cardLanguagesText: 'Anglais, russe, allemand, français, espagnol, portugais, italien, polonais, turc, ukrainien, chinois, japonais et coréen.',
      shotsTitle: "Captures d'écran",
      shotsLead: 'Données de démonstration fictives ; chaque capture fait 1280×800.',
      themeDark: 'Sombre',
      themeLight: 'Clair',
      shot1: 'Page principale — recherche et tuiles de favoris',
      shot2: 'Écrans — ensembles de favoris séparés',
      shot3: 'Arrière-plans — images, couleurs et dégradés',
      shot4: 'Moteurs de recherche — choisir et personnaliser',
      shot5: 'Menu contextuel — modifier, déplacer, copier, supprimer',
      shot6: "Suppression d'un écran — déplacer les favoris ou les supprimer",
      privacyTitle: 'Privé par conception',
      privacyText: "Favoris, écrans, arrière-plans et réglages vivent dans chrome.storage. Rien n'est envoyé à un serveur et il n'y a aucune télémétrie.",
      privacyCta: 'Lire la politique de confidentialité',
    },

    es: {
      title: 'TabVale — una pestaña nueva con sitio para cada marcador',
      description: 'TabVale sustituye la pestaña nueva del navegador por búsqueda, pantallas de marcadores independientes y fondos tranquilos. Todos los datos se quedan en el navegador.',
      ogDescription: 'Búsqueda, varias pantallas de marcadores y fondos tranquilos en una página serena. Sin cuentas, sin rastreo, sin servidores.',
      skip: 'Ir al contenido',
      navFeatures: 'Funciones',
      navScreenshots: 'Capturas',
      navPrivacy: 'Privacidad',
      eyebrow: 'Extensión para Chrome y Edge',
      heroTitle: 'Una pestaña nueva con sitio para cada marcador.',
      lead: 'Búsqueda, pantallas de marcadores independientes y fondos tranquilos — en una página serena. Sin cuentas, sin analítica, sin servidores: tus datos se quedan en el navegador.',
      ctaGitHub: 'Ver en GitHub',
      ctaInstall: 'Instalar desde el código',
      ctaStore: 'Chrome Web Store — próximamente',
      factLanguages: '13 idiomas',
      factThemes: 'Temas claro, oscuro y automático',
      factLocal: 'Datos locales',
      heroAlt: 'Pestaña nueva de TabVale en tema oscuro con mosaicos de marcadores y un campo de búsqueda',
      featuresTitle: 'Todo en una página serena',
      featuresLead: 'Para quien guarda muchos enlaces y los quiere a mano.',
      cardSearchTitle: 'Busca a tu manera',
      cardSearchText: 'Elige el buscador, edita la lista y dale a cada uno su propio icono.',
      cardScreensTitle: 'Pantallas para todo',
      cardScreensText: 'Conjuntos de marcadores separados para trabajo, estudio y aficiones. Cambia con puntos, un deslizamiento o Alt + flechas.',
      cardBookmarksTitle: 'Marcadores siempre en orden',
      cardBookmarksText: 'Arrastra para reordenar, edita en el sitio, borra desde el menú contextual y recibe sugerencias de título. Los iconos de los sitios se guardan en caché local y siguen visibles incluso sin conexión.',
      cardBackgroundsTitle: 'Fondos a tu estado de ánimo',
      cardBackgroundsText: 'Una URL de imagen, un archivo local, un color sólido o un degradado — con ajuste cubrir, contener, mosaico o centrado.',
      cardThemeTitle: 'Claro, oscuro, automático',
      cardThemeText: 'Sigue el tema del sistema o fija el que te guste; cada pantalla y panel se adapta.',
      cardLanguagesTitle: '13 idiomas',
      cardLanguagesText: 'Inglés, ruso, alemán, francés, español, portugués, italiano, polaco, turco, ucraniano, chino, japonés y coreano.',
      shotsTitle: 'Capturas',
      shotsLead: 'Datos de demostración ficticios; cada captura mide 1280×800.',
      themeDark: 'Oscuro',
      themeLight: 'Claro',
      shot1: 'Página principal — búsqueda y mosaicos de marcadores',
      shot2: 'Pantallas — conjuntos de marcadores separados',
      shot3: 'Fondos — imágenes, colores y degradados',
      shot4: 'Buscadores — elegir y personalizar',
      shot5: 'Menú contextual — editar, mover, copiar, borrar',
      shot6: 'Borrar una pantalla — mover los marcadores o eliminarlos',
      privacyTitle: 'Privado por diseño',
      privacyText: 'Marcadores, pantallas, fondos y ajustes viven en chrome.storage. Nada se envía a un servidor y no hay telemetría.',
      privacyCta: 'Leer la política de privacidad',
    },

    'pt-BR': {
      title: 'TabVale — uma nova aba com espaço para cada favorito',
      description: 'O TabVale substitui a nova aba do navegador por busca, telas de favoritos independentes e fundos calmos. Todos os dados ficam no navegador.',
      ogDescription: 'Busca, várias telas de favoritos e fundos calmos em uma página tranquila. Sem contas, sem rastreamento, sem servidores.',
      skip: 'Ir para o conteúdo',
      navFeatures: 'Recursos',
      navScreenshots: 'Capturas',
      navPrivacy: 'Privacidade',
      eyebrow: 'Extensão para Chrome e Edge',
      heroTitle: 'Uma nova aba com espaço para cada favorito.',
      lead: 'Busca, telas de favoritos independentes e fundos calmos — em uma página tranquila. Sem contas, sem análise, sem servidores: seus dados ficam no navegador.',
      ctaGitHub: 'Ver no GitHub',
      ctaInstall: 'Instalar a partir do código',
      ctaStore: 'Chrome Web Store — em breve',
      factLanguages: '13 idiomas',
      factThemes: 'Temas claro, escuro e automático',
      factLocal: 'Dados locais',
      heroAlt: 'Nova aba do TabVale no tema escuro com blocos de favoritos e campo de busca',
      featuresTitle: 'Tudo em uma página tranquila',
      featuresLead: 'Para quem guarda muitos links e quer tê-los por perto.',
      cardSearchTitle: 'Busque do seu jeito',
      cardSearchText: 'Escolha o mecanismo de busca, edite a lista e dê a cada um o seu próprio ícone.',
      cardScreensTitle: 'Telas para tudo',
      cardScreensText: 'Conjuntos de favoritos separados para trabalho, estudos e hobbies. Troque com pontos, um deslize ou Alt + setas.',
      cardBookmarksTitle: 'Favoritos sempre em ordem',
      cardBookmarksText: 'Arraste para reordenar, edite no lugar, exclua pelo menu de contexto e receba sugestões de título. Os ícones dos sites ficam em cache local e continuam visíveis mesmo offline.',
      cardBackgroundsTitle: 'Fundos para o seu humor',
      cardBackgroundsText: 'Uma URL de imagem, um arquivo local, uma cor sólida ou um gradiente — com preenchimento cobrir, conter, mosaico ou centralizado.',
      cardThemeTitle: 'Claro, escuro, automático',
      cardThemeText: 'Siga o tema do sistema ou fixe o que você gosta; cada tela e painel se adapta.',
      cardLanguagesTitle: '13 idiomas',
      cardLanguagesText: 'Inglês, russo, alemão, francês, espanhol, português, italiano, polonês, turco, ucraniano, chinês, japonês e coreano.',
      shotsTitle: 'Capturas de tela',
      shotsLead: 'Dados de demonstração fictícios; cada captura tem 1280×800.',
      themeDark: 'Escuro',
      themeLight: 'Claro',
      shot1: 'Página principal — busca e blocos de favoritos',
      shot2: 'Telas — conjuntos de favoritos separados',
      shot3: 'Fundos — imagens, cores e gradientes',
      shot4: 'Mecanismos de busca — escolher e personalizar',
      shot5: 'Menu de contexto — editar, mover, copiar, excluir',
      shot6: 'Excluir uma tela — mover os favoritos ou removê-los',
      privacyTitle: 'Privado por padrão',
      privacyText: 'Favoritos, telas, fundos e ajustes ficam no chrome.storage. Nada é enviado a um servidor e não há telemetria.',
      privacyCta: 'Ler a política de privacidade',
    },

    it: {
      title: 'TabVale — una nuova scheda con spazio per ogni segnalibro',
      description: 'TabVale sostituisce la nuova scheda del browser con ricerca, schermate di segnalibri indipendenti e sfondi tranquilli. Tutti i dati restano nel browser.',
      ogDescription: 'Ricerca, più schermate di segnalibri e sfondi tranquilli in un’unica pagina silenziosa. Niente account, niente tracciamento, niente server.',
      skip: 'Vai al contenuto',
      navFeatures: 'Funzioni',
      navScreenshots: 'Schermate',
      navPrivacy: 'Privacy',
      eyebrow: 'Estensione per Chrome e Edge',
      heroTitle: 'Una nuova scheda con spazio per ogni segnalibro.',
      lead: 'Ricerca, schermate di segnalibri indipendenti e sfondi tranquilli — in un’unica pagina silenziosa. Niente account, niente analisi, niente server: i tuoi dati restano nel browser.',
      ctaGitHub: 'Vedi su GitHub',
      ctaInstall: 'Installa dal codice',
      ctaStore: 'Chrome Web Store — in arrivo',
      factLanguages: '13 lingue',
      factThemes: 'Temi chiaro, scuro e automatico',
      factLocal: 'Dati locali',
      heroAlt: 'Nuova scheda di TabVale in tema scuro con riquadri dei segnalibri e campo di ricerca',
      featuresTitle: 'Tutto in una pagina silenziosa',
      featuresLead: 'Per chi tiene molti link e li vuole a portata di mano.',
      cardSearchTitle: 'Cerca a modo tuo',
      cardSearchText: 'Scegli il motore di ricerca, modifica l’elenco e assegna a ciascuno la propria icona.',
      cardScreensTitle: 'Schermate per tutto',
      cardScreensText: 'Gruppi di segnalibri separati per lavoro, studio e hobby. Cambia con i punti, uno scorrimento o Alt + frecce.',
      cardBookmarksTitle: 'Segnalibri sempre in ordine',
      cardBookmarksText: 'Trascina per riordinare, modifica sul posto, elimina dal menu contestuale e ricevi suggerimenti sul titolo. Le icone dei siti vengono salvate in cache locale e restano visibili anche offline.',
      cardBackgroundsTitle: 'Sfondi a seconda dell’umore',
      cardBackgroundsText: 'Un URL di immagine, un file locale, un colore pieno o un gradiente — con riempimento, adattamento, piastrellatura o centratura.',
      cardThemeTitle: 'Chiaro, scuro, automatico',
      cardThemeText: 'Segui il tema di sistema o blocca quello che preferisci; ogni schermata e pannello si adatta.',
      cardLanguagesTitle: '13 lingue',
      cardLanguagesText: 'Inglese, russo, tedesco, francese, spagnolo, portoghese, italiano, polacco, turco, ucraino, cinese, giapponese e coreano.',
      shotsTitle: 'Schermate',
      shotsLead: 'Dati dimostrativi fittizi; ogni immagine è 1280×800.',
      themeDark: 'Scuro',
      themeLight: 'Chiaro',
      shot1: 'Pagina principale — ricerca e riquadri dei segnalibri',
      shot2: 'Schermate — gruppi di segnalibri separati',
      shot3: 'Sfondi — immagini, colori e gradienti',
      shot4: 'Motori di ricerca — scelta e personalizzazione',
      shot5: 'Menu contestuale — modifica, sposta, copia, elimina',
      shot6: 'Eliminazione di una schermata — sposta i segnalibri o rimuovili',
      privacyTitle: 'Privato per progettazione',
      privacyText: 'Segnalibri, schermate, sfondi e impostazioni vivono in chrome.storage. Nulla viene inviato a un server e non esiste telemetria.',
      privacyCta: 'Leggi l’informativa sulla privacy',
    },

    pl: {
      title: 'TabVale — nowa karta z miejscem na każdą zakładkę',
      description: 'TabVale zastępuje nową kartę przeglądarki wyszukiwaniem, osobnymi ekranami zakładek i spokojnymi tłami. Wszystkie dane zostają w przeglądarce.',
      ogDescription: 'Wyszukiwanie, kilka ekranów zakładek i spokojne tła na jednej cichej stronie. Bez kont, bez śledzenia, bez serwerów.',
      skip: 'Przejdź do treści',
      navFeatures: 'Funkcje',
      navScreenshots: 'Zrzuty ekranu',
      navPrivacy: 'Prywatność',
      eyebrow: 'Rozszerzenie dla Chrome i Edge',
      heroTitle: 'Nowa karta z miejscem na każdą zakładkę.',
      lead: 'Wyszukiwanie, osobne ekrany zakładek i spokojne tła — na jednej cichej stronie. Bez kont, analityki i serwerów: Twoje dane pozostają w przeglądarce.',
      ctaGitHub: 'Zobacz na GitHub',
      ctaInstall: 'Zainstaluj ze źródeł',
      ctaStore: 'Chrome Web Store — wkrótce',
      factLanguages: '13 języków',
      factThemes: 'Jasny, ciemny i automatyczny motyw',
      factLocal: 'Dane pozostają lokalnie',
      heroAlt: 'Nowa karta TabVale w ciemnym motywie z kafelkami zakładek i polem wyszukiwania',
      featuresTitle: 'Wszystko na jednej cichej stronie',
      featuresLead: 'Dla osób, które mają wiele linków i chcą je mieć pod ręką.',
      cardSearchTitle: 'Szukaj po swojemu',
      cardSearchText: 'Wybierz wyszukiwarkę, edytuj listę i nadaj każdej własną ikonę.',
      cardScreensTitle: 'Ekrany do wszystkiego',
      cardScreensText: 'Osobne zestawy zakładek do pracy, nauki i hobby. Przełączaj kropkami, przesunięciem lub Alt + strzałki.',
      cardBookmarksTitle: 'Zakładki zawsze w porządku',
      cardBookmarksText: 'Przeciągaj, aby zmienić kolejność, edytuj na miejscu, usuwaj z menu kontekstowego i korzystaj z podpowiedzi tytułu. Ikony witryn są buforowane lokalnie i pozostają widoczne także offline.',
      cardBackgroundsTitle: 'Tło pod nastrój',
      cardBackgroundsText: 'Adres obrazu, plik z urządzenia, jednolity kolor lub gradient — z wypełnieniem, dopasowaniem, kafelkowaniem lub wyśrodkowaniem.',
      cardThemeTitle: 'Jasny, ciemny, automatyczny',
      cardThemeText: 'Podążaj za motywem systemu lub ustaw własny; każdy ekran i panel się dostosowuje.',
      cardLanguagesTitle: '13 języków',
      cardLanguagesText: 'Angielski, rosyjski, niemiecki, francuski, hiszpański, portugalski, włoski, polski, turecki, ukraiński, chiński, japoński i koreański.',
      shotsTitle: 'Zrzuty ekranu',
      shotsLead: 'Fikcyjne dane demonstracyjne; każdy zrzut ma 1280×800.',
      themeDark: 'Ciemny',
      themeLight: 'Jasny',
      shot1: 'Strona główna — wyszukiwanie i kafelki zakładek',
      shot2: 'Ekrany — osobne zestawy zakładek',
      shot3: 'Tła — obrazy, kolory i gradienty',
      shot4: 'Wyszukiwarki — wybór i dostosowanie',
      shot5: 'Menu kontekstowe — edycja, przenoszenie, kopiowanie, usuwanie',
      shot6: 'Usuwanie ekranu — przenieś zakładki lub usuń je',
      privacyTitle: 'Prywatność z założenia',
      privacyText: 'Zakładki, ekrany, tła i ustawienia są przechowywane w chrome.storage. Nic nie jest wysyłane na serwer i nie ma telemetrii.',
      privacyCta: 'Przeczytaj politykę prywatności',
    },

    tr: {
      title: 'TabVale — her yer imine yer olan yeni sekme',
      description: 'TabVale, tarayıcının yeni sekmesini arama, ayrı yer imi ekranları ve sakin arka planlarla değiştirir. Tüm veriler tarayıcıda kalır.',
      ogDescription: 'Arama, birkaç yer imi ekranı ve sakin arka planlar tek bir sessiz sayfada. Hesap yok, izleme yok, sunucu yok.',
      skip: 'İçeriğe geç',
      navFeatures: 'Özellikler',
      navScreenshots: 'Ekran görüntüleri',
      navPrivacy: 'Gizlilik',
      eyebrow: 'Chrome ve Edge uzantısı',
      heroTitle: 'Her yer imine yer olan yeni sekme.',
      lead: 'Arama, ayrı yer imi ekranları ve sakin arka planlar — tek bir sessiz sayfada. Hesap, analitik ve sunucu yok: verileriniz tarayıcıda kalır.',
      ctaGitHub: 'GitHub’da görüntüle',
      ctaInstall: 'Kaynaktan yükle',
      ctaStore: 'Chrome Web Store — yakında',
      factLanguages: '13 dil',
      factThemes: 'Açık, koyu ve otomatik tema',
      factLocal: 'Veriler yerelde kalır',
      heroAlt: 'Koyu temada yer imi kutucukları ve arama alanı olan TabVale yeni sekmesi',
      featuresTitle: 'Her şey tek bir sakin sayfada',
      featuresLead: 'Çok sayıda bağlantısı olan ve elinin altında isteyenler için.',
      cardSearchTitle: 'Kendi yönteminizle arayın',
      cardSearchText: 'Arama motorunu seçin, listeyi düzenleyin ve her birine kendi simgesini verin.',
      cardScreensTitle: 'Her şey için ekranlar',
      cardScreensText: 'İş, okul ve hobiler için ayrı yer imi kümeleri. Noktalarla, kaydırmayla veya Alt + oklarla geçin.',
      cardBookmarksTitle: 'Yer imleri hep düzenli',
      cardBookmarksText: 'Sıralamak için sürükleyin, yerinde düzenleyin, bağlam menüsünden silin ve başlık önerileri alın. Site simgeleri yerelde önbelleğe alınır ve çevrimdışıyken bile görünür kalır.',
      cardBackgroundsTitle: 'Ruh halinize göre arka planlar',
      cardBackgroundsText: 'Bir görsel adresi, yerel dosya, düz renk veya gradyan — kapla, sığdır, döşe veya ortala yerleşimiyle.',
      cardThemeTitle: 'Açık, koyu, otomatik',
      cardThemeText: 'Sistem temasını izleyin veya beğendiğinizi sabitleyin; her ekran ve panel uyum sağlar.',
      cardLanguagesTitle: '13 dil',
      cardLanguagesText: 'İngilizce, Rusça, Almanca, Fransızca, İspanyolca, Portekizce, İtalyanca, Lehçe, Türkçe, Ukraynaca, Çince, Japonca ve Korece.',
      shotsTitle: 'Ekran görüntüleri',
      shotsLead: 'Hayali demo verileri; her görüntü 1280×800.',
      themeDark: 'Koyu',
      themeLight: 'Açık',
      shot1: 'Ana sayfa — arama ve yer imi kutucukları',
      shot2: 'Ekranlar — ayrı yer imi kümeleri',
      shot3: 'Arka planlar — görseller, renkler ve gradyanlar',
      shot4: 'Arama motorları — seç ve özelleştir',
      shot5: 'Bağlam menüsü — düzenle, taşı, kopyala, sil',
      shot6: 'Ekranı silme — yer imlerini taşı veya kaldır',
      privacyTitle: 'Tasarımı gereği gizli',
      privacyText: 'Yer imleri, ekranlar, arka planlar ve ayarlar chrome.storage içinde yaşar. Sunucuya hiçbir şey gönderilmez ve telemetri yoktur.',
      privacyCta: 'Gizlilik politikasını okuyun',
    },

    uk: {
      title: 'TabVale — нова вкладка з місцем для кожної закладки',
      description: 'TabVale замінює нову вкладку браузера пошуком, окремими екранами закладок і спокійними фонами. Усі дані залишаються в браузері.',
      ogDescription: 'Пошук, кілька екранів закладок і спокійні фони на одній тихій сторінці. Без акаунтів, трекінгу й серверів.',
      skip: 'Перейти до вмісту',
      navFeatures: 'Можливості',
      navScreenshots: 'Скриншоти',
      navPrivacy: 'Приватність',
      eyebrow: 'Розширення для Chrome і Edge',
      heroTitle: 'Нова вкладка з місцем для кожної закладки.',
      lead: 'Пошук, окремі екрани закладок і спокійні фони — на одній тихій сторінці. Без акаунтів, аналітики й серверів: ваші дані залишаються в браузері.',
      ctaGitHub: 'Відкрити на GitHub',
      ctaInstall: 'Встановити з джерел',
      ctaStore: 'Chrome Web Store — скоро',
      factLanguages: '13 мов',
      factThemes: 'Світла, темна й автотема',
      factLocal: 'Дані залишаються локально',
      heroAlt: 'Нова вкладка TabVale у темній темі з плитками закладок і полем пошуку',
      featuresTitle: 'Усе на одній спокійній сторінці',
      featuresLead: 'Для тих, у кого багато посилань і вони потрібні під рукою.',
      cardSearchTitle: 'Пошук по-своєму',
      cardSearchText: 'Виберіть пошукову систему, відредагуйте список і задайте кожній свою іконку.',
      cardScreensTitle: 'Екрани для всього',
      cardScreensText: 'Окремі набори закладок для роботи, навчання й хобі. Перемикання точками, свайпом або Alt + стрілками.',
      cardBookmarksTitle: 'Закладки завжди в порядку',
      cardBookmarksText: 'Перетягуйте для сортування, редагуйте на місці, видаляйте з контекстного меню й отримуйте підказки назв. Іконки сайтів кешуються локально й залишаються видимими навіть без мережі.',
      cardBackgroundsTitle: 'Фон під настрій',
      cardBackgroundsText: 'Посилання на зображення, файл з пристрою, суцільний колір або градієнт — із заповненням, вписуванням, плиткою чи по центру.',
      cardThemeTitle: 'Світла, темна, автоматична',
      cardThemeText: 'Дотримуйтеся теми системи або закріпіть свою; підлаштовуються всі екрани й панелі.',
      cardLanguagesTitle: '13 мов',
      cardLanguagesText: 'Англійська, російська, німецька, французька, іспанська, португальська, італійська, польська, турецька, українська, китайська, японська й корейська.',
      shotsTitle: 'Скриншоти',
      shotsLead: 'Вигадані демо-дані; кожен знімок 1280×800.',
      themeDark: 'Темна',
      themeLight: 'Світла',
      shot1: 'Головна — пошук і плитки закладок',
      shot2: 'Екрани — окремі набори закладок',
      shot3: 'Фони — зображення, кольори й градієнти',
      shot4: 'Пошукові системи — вибір і налаштування',
      shot5: 'Контекстне меню — редагування, перенесення, копіювання, видалення',
      shot6: 'Видалення екрана — перенести закладки або видалити',
      privacyTitle: 'Приватність за задумом',
      privacyText: 'Закладки, екрани, фони й налаштування зберігаються в chrome.storage. Нічого не надсилається на сервер, телеметрії немає.',
      privacyCta: 'Політика конфіденційності',
    },

    'zh-CN': {
      title: 'TabVale — 为每个书签留出空间的新标签页',
      description: 'TabVale 用搜索、独立的书签屏幕和安静背景替代浏览器的新标签页。所有数据都留在浏览器中。',
      ogDescription: '搜索、多个书签屏幕和安静背景都在一个安静的页面里。没有账户，没有跟踪，没有服务器。',
      skip: '跳到内容',
      navFeatures: '功能',
      navScreenshots: '截图',
      navPrivacy: '隐私',
      eyebrow: 'Chrome 与 Edge 扩展',
      heroTitle: '为每个书签留出空间的新标签页。',
      lead: '搜索、独立的书签屏幕和安静背景——都在一个安静的页面里。没有账户，没有分析，没有服务器：数据留在浏览器中。',
      ctaGitHub: '在 GitHub 上查看',
      ctaInstall: '从源码安装',
      ctaStore: 'Chrome 应用商店 — 即将上线',
      factLanguages: '13 种语言',
      factThemes: '浅色、深色和自动主题',
      factLocal: '数据留在本地',
      heroAlt: '深色主题下的 TabVale 新标签页，带有书签块和搜索框',
      featuresTitle: '一切都在一个安静的页面上',
      featuresLead: '为收藏了大量链接、希望触手可及的人而做。',
      cardSearchTitle: '按你的方式搜索',
      cardSearchText: '选择搜索引擎，编辑列表，并为每个引擎设置自己的图标。',
      cardScreensTitle: '适用于一切的屏幕',
      cardScreensText: '为工作、学习和爱好提供各自独立的书签集合。用圆点、滑动或 Alt + 方向键切换。',
      cardBookmarksTitle: '书签始终整齐',
      cardBookmarksText: '拖动排序、就地编辑、从右键菜单删除，并获得标题建议。网站图标缓存在本地，离线时也能显示。',
      cardBackgroundsTitle: '符合心情的背景',
      cardBackgroundsText: '图片链接、本地文件、纯色或渐变——支持填充、适应、平铺或居中。',
      cardThemeTitle: '浅色、深色、自动',
      cardThemeText: '跟随系统主题或固定你喜欢的一个；每个屏幕和面板都会随之调整。',
      cardLanguagesTitle: '13 种语言',
      cardLanguagesText: '英语、俄语、德语、法语、西班牙语、葡萄牙语、意大利语、波兰语、土耳其语、乌克兰语、中文、日语和韩语。',
      shotsTitle: '截图',
      shotsLead: '虚构的演示数据；每张截图都是 1280×800。',
      themeDark: '深色',
      themeLight: '浅色',
      shot1: '主页——搜索和书签块',
      shot2: '屏幕——独立的书签集合',
      shot3: '背景——图片、颜色和渐变',
      shot4: '搜索引擎——选择与自定义',
      shot5: '右键菜单——编辑、移动、复制、删除',
      shot6: '删除屏幕——移动或移除书签',
      privacyTitle: '天生私密',
      privacyText: '书签、屏幕、背景和设置都保存在 chrome.storage 中。不会发送到服务器，也没有遥测。',
      privacyCta: '阅读隐私政策',
    },

    ja: {
      title: 'TabVale — すべてのブックマークのための新しいタブ',
      description: 'TabVale はブラウザの新しいタブを、検索、独立したブックマーク画面、落ち着いた背景に置き換えます。データはすべてブラウザ内に残ります。',
      ogDescription: '検索、複数のブックマーク画面、落ち着いた背景を 1 つの静かなページに。アカウントなし、追跡なし、サーバーなし。',
      skip: 'コンテンツへスキップ',
      navFeatures: '機能',
      navScreenshots: 'スクリーンショット',
      navPrivacy: 'プライバシー',
      eyebrow: 'Chrome と Edge の拡張機能',
      heroTitle: 'すべてのブックマークのための新しいタブ。',
      lead: '検索、独立したブックマーク画面、落ち着いた背景を 1 つの静かなページに。アカウントなし、分析なし、サーバーなし。データはブラウザ内に残ります。',
      ctaGitHub: 'GitHub で見る',
      ctaInstall: 'ソースからインストール',
      ctaStore: 'Chrome ウェブストア — 近日公開',
      factLanguages: '13 言語',
      factThemes: 'ライト、ダーク、自動テーマ',
      factLocal: 'データはローカルに保存',
      heroAlt: 'ダークテーマの TabVale の新しいタブ。ブックマークタイルと検索フィールド',
      featuresTitle: 'すべてを 1 つの静かなページに',
      featuresLead: '多くのリンクを手元に置いておきたい人のために。',
      cardSearchTitle: '自分らしい検索',
      cardSearchText: '検索エンジンを選び、リストを編集し、それぞれにアイコンを設定できます。',
      cardScreensTitle: 'あらゆる用途の画面',
      cardScreensText: '仕事、勉強、趣味用に分かれたブックマークセット。ドット、スワイプ、Alt + 矢印で切り替えます。',
      cardBookmarksTitle: 'いつも整ったブックマーク',
      cardBookmarksText: 'ドラッグで並べ替え、その場で編集し、右クリックメニューから削除。タイトルの候補も表示されます。サイトのアイコンはローカルにキャッシュされ、オフラインでも表示されます。',
      cardBackgroundsTitle: '気分に合わせた背景',
      cardBackgroundsText: '画像 URL、ローカルファイル、単色、グラデーション — カバー、フィット、タイル、中央の配置に対応。',
      cardThemeTitle: 'ライト、ダーク、自動',
      cardThemeText: 'システムのテーマに従うか、好きなテーマを固定できます。すべての画面とパネルが合わせて変わります。',
      cardLanguagesTitle: '13 言語',
      cardLanguagesText: '英語、ロシア語、ドイツ語、フランス語、スペイン語、ポルトガル語、イタリア語、ポーランド語、トルコ語、ウクライナ語、中国語、日本語、韓国語。',
      shotsTitle: 'スクリーンショット',
      shotsLead: '架空のデモデータ。各画像は 1280×800 です。',
      themeDark: 'ダーク',
      themeLight: 'ライト',
      shot1: 'メインページ — 検索とブックマークタイル',
      shot2: '画面 — 独立したブックマークセット',
      shot3: '背景 — 画像、色、グラデーション',
      shot4: '検索エンジン — 選択とカスタマイズ',
      shot5: '右クリックメニュー — 編集、移動、コピー、削除',
      shot6: '画面の削除 — ブックマークを移動または削除',
      privacyTitle: '設計からプライベート',
      privacyText: 'ブックマーク、画面、背景、設定は chrome.storage に保存されます。サーバーには何も送信されず、テレメトリもありません。',
      privacyCta: 'プライバシーポリシーを読む',
    },

    ko: {
      title: 'TabVale — 모든 북마크를 위한 공간이 있는 새 탭',
      description: 'TabVale은 브라우저의 새 탭을 검색, 독립적인 북마크 화면, 차분한 배경으로 바꿉니다. 모든 데이터는 브라우저에 남습니다.',
      ogDescription: '검색, 여러 북마크 화면, 차분한 배경을 하나의 조용한 페이지에. 계정도, 추적도, 서버도 없습니다.',
      skip: '본문으로 이동',
      navFeatures: '기능',
      navScreenshots: '스크린샷',
      navPrivacy: '개인정보',
      eyebrow: 'Chrome 및 Edge 확장 프로그램',
      heroTitle: '모든 북마크를 위한 공간이 있는 새 탭.',
      lead: '검색, 독립적인 북마크 화면, 차분한 배경 — 하나의 조용한 페이지에. 계정도, 분석도, 서버도 없습니다. 데이터는 브라우저에 남습니다.',
      ctaGitHub: 'GitHub에서 보기',
      ctaInstall: '소스에서 설치',
      ctaStore: 'Chrome 웹 스토어 — 곧 공개',
      factLanguages: '13개 언어',
      factThemes: '라이트, 다크, 자동 테마',
      factLocal: '데이터는 로컬에 보관',
      heroAlt: '다크 테마의 TabVale 새 탭. 북마크 타일과 검색 필드',
      featuresTitle: '모든 것을 하나의 조용한 페이지에',
      featuresLead: '많은 링크를 손닿는 곳에 두고 싶은 사람을 위한 페이지.',
      cardSearchTitle: '나만의 방식으로 검색',
      cardSearchText: '검색 엔진을 고르고 목록을 편집하며 각 엔진에 아이콘을 지정하세요.',
      cardScreensTitle: '무엇이든 위한 화면',
      cardScreensText: '업무, 공부, 취미를 위한 별도의 북마크 세트. 점, 스와이프 또는 Alt + 화살표로 전환하세요.',
      cardBookmarksTitle: '항상 정리된 북마크',
      cardBookmarksText: '끌어서 순서를 바꾸고, 그 자리에서 편집하고, 컨텍스트 메뉴에서 삭제하며 제목 추천도 받으세요. 사이트 아이콘은 로컬에 캐시되어 오프라인에서도 보입니다.',
      cardBackgroundsTitle: '기분에 맞는 배경',
      cardBackgroundsText: '이미지 URL, 로컬 파일, 단색 또는 그라데이션 — 채우기, 맞추기, 타일, 가운데 배치를 지원합니다.',
      cardThemeTitle: '라이트, 다크, 자동',
      cardThemeText: '시스템 테마를 따르거나 원하는 테마를 고정하세요. 모든 화면과 패널이 함께 바뀝니다.',
      cardLanguagesTitle: '13개 언어',
      cardLanguagesText: '영어, 러시아어, 독일어, 프랑스어, 스페인어, 포르투갈어, 이탈리아어, 폴란드어, 터키어, 우크라이나어, 중국어, 일본어, 한국어.',
      shotsTitle: '스크린샷',
      shotsLead: '가상의 데모 데이터이며 각 이미지는 1280×800입니다.',
      themeDark: '다크',
      themeLight: '라이트',
      shot1: '메인 페이지 — 검색과 북마크 타일',
      shot2: '화면 — 별도의 북마크 세트',
      shot3: '배경 — 이미지, 색상, 그라데이션',
      shot4: '검색 엔진 — 선택과 설정',
      shot5: '컨텍스트 메뉴 — 편집, 이동, 복사, 삭제',
      shot6: '화면 삭제 — 북마크를 옮기거나 제거',
      privacyTitle: '설계부터 프라이빗',
      privacyText: '북마크, 화면, 배경, 설정은 chrome.storage에 보관됩니다. 서버로 아무것도 전송되지 않으며 텔레메트리도 없습니다.',
      privacyCta: '개인정보 처리방침 읽기',
    },
  };

  function normalizeLang(raw) {
    const value = String(raw || '').toLowerCase().replace('_', '-');
    const map = {
      en: 'en', ru: 'ru', de: 'de', fr: 'fr', es: 'es', it: 'it', pl: 'pl', tr: 'tr', uk: 'uk', ja: 'ja', ko: 'ko',
      zh: 'zh-CN', 'zh-cn': 'zh-CN', 'zh-hans': 'zh-CN', 'zh-sg': 'zh-CN',
      pt: 'pt-BR', 'pt-br': 'pt-BR', 'pt-pt': 'pt-BR',
    };
    if (map[value]) return map[value];
    return map[value.split('-')[0]] || 'en';
  }

  function detectLang() {
    return normalizeLang(navigator.language || 'en');
  }

  const originals = new Map();
  const originalAttrs = new Map();

  function captureOriginals() {
    // Храним исходную разметку: в английской версии в текстах есть
    // <kbd> и <code>, которые textContent бы стёр.
    document.querySelectorAll('[data-i18n]').forEach((el) => originals.set(el, el.innerHTML));
    document.querySelectorAll('[data-i18n-attr]').forEach((el) => {
      el.getAttribute('data-i18n-attr').split(',').forEach((pair) => {
        const [attr] = pair.split(':');
        originalAttrs.set(el, { ...(originalAttrs.get(el) || {}), [attr]: el.getAttribute(attr) });
      });
    });
  }

  function applyLang(code) {
    const lang = DICT[code] ? code : 'en';
    const dict = DICT[lang];

    document.documentElement.lang = lang;

    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.dataset.i18n;
      const original = originals.get(el);
      if (lang === 'en') {
        if (el.innerHTML !== original) el.innerHTML = original;
      } else {
        el.textContent = dict[key] || el.textContent;
      }
    });

    document.querySelectorAll('[data-i18n-attr]').forEach((el) => {
      el.getAttribute('data-i18n-attr').split(',').forEach((pair) => {
        const [attr, key] = pair.split(':');
        if (!attr || !key) return;
        const original = originalAttrs.get(el)?.[attr] ?? '';
        el.setAttribute(attr, lang === 'en' ? original : (dict[key] || original));
      });
    });

    document.title = dict.title;
  }

  function init() {
    captureOriginals();

    // Свой список вместо нативного <select>: системный popup в Edge
    // рисовал светлый список поверх тёмной страницы, и языки терялись.
    const button = document.getElementById('site-lang');
    const list = document.getElementById('site-lang-list');
    const entries = [['auto', 'Auto'], ...LANGUAGES];

    let stored = 'auto';
    try { stored = localStorage.getItem(STORAGE_KEY) || 'auto'; } catch { /* приватный режим */ }

    const labelFor = (value) => (entries.find(([code]) => code === value) || entries[0])[1];

    const closeList = () => {
      if (!list) return;
      list.hidden = true;
      button?.setAttribute('aria-expanded', 'false');
    };

    const choose = (value) => {
      stored = value;
      try { localStorage.setItem(STORAGE_KEY, value); } catch { /* приватный режим */ }
      applyLang(value === 'auto' ? detectLang() : value);
      if (button) button.textContent = labelFor(value);
      if (list) {
        list.querySelectorAll('button').forEach((item) => {
          item.setAttribute('aria-selected', String(item.dataset.value === value));
        });
      }
      closeList();
    };

    if (button && list) {
      for (const [code, name] of entries) {
        const item = document.createElement('li');
        const option = document.createElement('button');
        option.type = 'button';
        option.dataset.value = code;
        option.setAttribute('role', 'option');
        option.textContent = name;
        option.addEventListener('click', () => choose(code));
        item.append(option);
        list.append(item);
      }

      button.addEventListener('click', (event) => {
        event.stopPropagation();
        const open = list.hidden;
        if (!open) { closeList(); return; }
        list.hidden = false;
        button.setAttribute('aria-expanded', 'true');
        list.querySelector('button[aria-selected="true"]')?.focus();
      });

      document.addEventListener('click', (event) => {
        if (list.hidden) return;
        if (list.contains(event.target)) return;
        closeList();
      });

      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !list.hidden) {
          closeList();
          button.focus();
        }
      });
    }

    choose(stored);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Небольшой доступ для проверки словаря из тестов.
  window.__tabvaleSiteI18n = { DICT, LANGUAGES, normalizeLang };
}());
