# TabVale

**Read in:** [English](README.md) · [Русский](README.ru.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [Español](README.es.md) · [Português (Brasil)](README.pt-BR.md) · [Italiano](README.it.md) · [Polski](README.pl.md) · [Türkçe](README.tr.md) · [Українська](README.uk.md) · [中文](README.zh.md) · [日本語](README.ja.md) · [한국어](README.ko.md)

> Tradução curta. O README em inglês é a fonte da verdade. Tradução feita por um não nativo; correções são bem-vindas via GitHub Issues.

Uma extensão para Chrome e Microsoft Edge que substitui a nova aba por um
painel personalizável: busca, várias telas de favoritos, fundos e plugins
opcionais.

## Recursos

- Busca com mecanismo selecionável; a lista é editável e cada um tem seu ícone.
- Várias telas de favoritos: pontos, deslize em área vazia, `Alt+←/→`; mover favoritos entre telas.
- Favoritos com ícones (em cache local), ordenação por arrastar, edição e exclusão.
- Fundos: URL, arquivo local, cor ou gradiente.
- Temas automático/claro/escuro e 13 idiomas de interface.
- Plugins — apenas os que você instalar: relógio, notas, teclado, timer, senhas, clima, estatísticas do GitHub, inicializador de aplicativos, RSS, tarefas, importação de favoritos.
- Importação e exportação de ajustes em JSON.

## Instalação

1. Abra `chrome://extensions` ou `edge://extensions`.
2. Ative o modo desenvolvedor.
3. «Carregar sem compactação» e escolha a pasta do projeto.
4. Abra uma nova aba.

## Plugins

Nenhum plugin é instalado por padrão. Os pacotes `.tvp` estão na
[seção «Plugins» do site](https://gan0za.github.io/TabVale/#plugins) e em
`docs/plugins/`. Baixe o arquivo e instale: Configurações → Plugins →
«Instalar do arquivo…». O gerenciador escolhe a zona — painel, faixa acima ou
abaixo dos favoritos, bloco, janela flutuante; o menu de contexto do plugin abre
sua linha, desativa ou remove.

## Desenvolvimento de plugins (breve)

Um plugin é um zip `.tvp` com `manifest.json`, arquivo de código e ícone
opcional. O código define `mount(api)` e roda em sandbox sem `chrome.*`: dados
com `api.storage`, rede com `api.fetch` conforme a lista do manifesto,
interface com `api.ui`, ícones de sites com `api.icon.favicon`.
Empacotamento: `node tools/pack-plugin.mjs path/to/plugin`.

Detalhes em inglês: [formato](docs/PLUGIN_SPEC.md), [API](docs/PLUGIN_API.md),
[guia](docs/PLUGIN_GUIDE.md).

## Privacidade e permissões

Favoritos, telas, fundos e ajustes ficam em `chrome.storage`; os ícones de sites
no IndexedDB local e não saem do dispositivo. Detalhes: [PRIVACY.md](PRIVACY.md)
(inglês).

## Licença

MIT. Veja [LICENSE](LICENSE).
