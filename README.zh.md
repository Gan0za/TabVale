# TabVale

**Read in:** [English](README.md) · [Русский](README.ru.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [Español](README.es.md) · [Português (Brasil)](README.pt-BR.md) · [Italiano](README.it.md) · [Polski](README.pl.md) · [Türkçe](README.tr.md) · [Українська](README.uk.md) · [中文](README.zh.md) · [日本語](README.ja.md) · [한국어](README.ko.md)

> 简短翻译。英文 README 是权威版本。本翻译由非母语者完成；欢迎通过 GitHub Issues 指正。

一款适用于 Chrome 和 Microsoft Edge 的扩展,用可自定义的仪表板替代新标签页:搜索、多个书签屏幕、背景和可选插件。

## 功能

- 可选择搜索引擎;列表可编辑,每个引擎都有自己的图标。
- 多个书签屏幕:圆点、空白处滑动、`Alt+←/→`;可在屏幕间移动书签。
- 书签带图标(本地缓存)、拖动排序、编辑和删除。
- 背景:图片链接、本地文件、纯色或渐变。
- 自动/浅色/深色主题和 13 种界面语言。
- 插件 —— 仅安装你选择的插件:时钟、笔记、键盘布局、计时器、密码、天气、GitHub 统计、应用启动器、RSS、书签导入。
- 设置的 JSON 导入与导出。

## 安装

1. 打开 `chrome://extensions` 或 `edge://extensions`。
2. 开启开发者模式。
3. 点击“加载已解压的扩展程序”并选择项目根目录。
4. 打开新标签页。

## 插件

默认不安装任何插件。`.tvp` 包位于
[网站的“插件”部分](https://gan0za.github.io/TabVale/#plugins) 和仓库的
`docs/plugins/` 目录。下载文件后在“设置 → 插件 → 从文件安装…”中安装。
管理器选择区域 —— 面板、书签上方或下方的条带、方块、浮动窗口;插件右键菜单可打开其设置行、关闭或移除。

## 插件开发(简要)

插件是包含 `manifest.json`、代码文件和可选图标的 `.tvp` zip 包。代码定义
`mount(api)`,在无 `chrome.*` 的沙箱中运行:数据用 `api.storage`,网络用
`api.fetch`(受清单白名单限制),界面用 `api.ui`,网站图标用
`api.icon.favicon`。打包:`node tools/pack-plugin.mjs path/to/plugin`。

英文详情:[格式](docs/PLUGIN_SPEC.md)、[API](docs/PLUGIN_API.md)、
[指南](docs/PLUGIN_GUIDE.md)。

## 隐私与权限

书签、屏幕、背景和设置保存在 `chrome.storage`;网站图标保存在本地
IndexedDB,不会离开设备。详情见 [PRIVACY.md](PRIVACY.md)(英文)。

## 许可证

MIT。见 [LICENSE](LICENSE)。
