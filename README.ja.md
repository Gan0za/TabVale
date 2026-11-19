# TabVale

**Read in:** [English](README.md) · [Русский](README.ru.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [Español](README.es.md) · [Português (Brasil)](README.pt-BR.md) · [Italiano](README.it.md) · [Polski](README.pl.md) · [Türkçe](README.tr.md) · [Українська](README.uk.md) · [中文](README.zh.md) · [日本語](README.ja.md) · [한국어](README.ko.md)

> 短い翻訳です。英語の README が正式な情報源です。この翻訳は非ネイティブによるものです。修正は GitHub Issues で歓迎します。

Chrome と Microsoft Edge 向けの拡張機能で、新しいタブをカスタマイズ可能な
ダッシュボードに置き換えます:検索、複数のブックマーク画面、背景、任意の
プラグイン。

## 機能

- 検索エンジンを選択可能。一覧は編集でき、各エンジンにアイコンを設定できます。
- 複数のブックマーク画面:ドット、空白部分のスワイプ、`Alt+←/→`。画面間でブックマークを移動。
- アイコン付きブックマーク(ローカルにキャッシュ)、ドラッグで並べ替え、編集・削除。
- 背景:画像 URL、ローカルファイル、単色、グラデーション。
- 自動/ライト/ダークテーマと 13 言語の UI。
- プラグイン — 自分でインストールしたものだけ:時計、メモ、キーボード配列、タイマー、パスワード、天気、GitHub 統計、アプリ起動、RSS、タスク、ことわざ、ブックマーク取り込み。
- 設定の JSON インポート/エクスポート。

## インストール

1. `chrome://extensions` または `edge://extensions` を開きます。
2. デベロッパーモードを有効にします。
3. 「パッケージ化されていない拡張機能を読み込む」でプロジェクトのルートを選びます。
4. 新しいタブを開きます。

## プラグイン

既定では何もインストールされません。`.tvp` パッケージは
[サイトの「プラグイン」セクション](https://gan0za.github.io/TabVale/#plugins)
と `docs/plugins/` にあります。ファイルをダウンロードし、設定 → プラグイン →
「ファイルからインストール…」で導入します。マネージャーで配置を選びます —
パネル、ブックマークの上/下のストリップ、タイル、フローティングウィンドウ。
プラグインの右クリックメニューから設定行を開く、オフにする、削除できます。

## プラグイン開発(概要)

プラグインは `manifest.json`、コード、任意のアイコンを含む `.tvp`(zip)です。
コードは `mount(api)` を定義し、`chrome.*` のないサンドボックスで動作します:
データは `api.storage`、通信はマニフェストの許可リストに従う `api.fetch`、
UI は `api.ui`、サイトアイコンは `api.icon.favicon`。
パッケージ化:`node tools/pack-plugin.mjs path/to/plugin`。

詳細(英語):[仕様](docs/PLUGIN_SPEC.md)、[API](docs/PLUGIN_API.md)、
[ガイド](docs/PLUGIN_GUIDE.md)。

## プライバシーと権限

ブックマーク、画面、背景、設定は `chrome.storage` に、サイトアイコンは
ローカルの IndexedDB に保存され、端末外へ出ません。詳細:
[PRIVACY.md](PRIVACY.md)(英語)。

## ライセンス

MIT。[LICENSE](LICENSE) を参照してください。
