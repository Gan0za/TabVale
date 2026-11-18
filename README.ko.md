# TabVale

**Read in:** [English](README.md) · [Русский](README.ru.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [Español](README.es.md) · [Português (Brasil)](README.pt-BR.md) · [Italiano](README.it.md) · [Polski](README.pl.md) · [Türkçe](README.tr.md) · [Українська](README.uk.md) · [中文](README.zh.md) · [日本語](README.ja.md) · [한국어](README.ko.md)

> 짧은 번역입니다. 영어 README가 기준 문서입니다. 이 번역은 비원어민이 작성했습니다. 수정은 GitHub Issues를 통해 환영합니다.

Chrome 및 Microsoft Edge용 확장 프로그램으로, 새 탭을 사용자 지정 가능한
대시보드로 바꿉니다: 검색, 여러 북마크 화면, 배경, 선택적 플러그인.

## 기능

- 검색 엔진 선택; 목록을 편집할 수 있고 각 엔진에 아이콘을 지정할 수 있습니다.
- 여러 북마크 화면: 점, 빈 영역 스와이프, `Alt+←/→`; 화면 간 북마크 이동.
- 아이콘이 있는 북마크(로컬 캐시), 드래그로 정렬, 편집 및 삭제.
- 배경: 이미지 URL, 로컬 파일, 단색, 그라데이션.
- 자동/라이트/다크 테마와 13개 인터페이스 언어.
- 플러그인 — 직접 설치한 것만: 시계, 메모, 키보드 배열, 타이머, 비밀번호, 날씨, GitHub 통계, 앱 실행기, RSS, 할 일, 북마크 가져오기.
- 설정의 JSON 가져오기/내보내기.

## 설치

1. `chrome://extensions` 또는 `edge://extensions`를 엽니다.
2. 개발자 모드를 켭니다.
3. "압축해제된 확장 프로그램을 로드"로 프로젝트 루트를 선택합니다.
4. 새 탭을 엽니다.

## 플러그인

기본으로 설치되는 플러그인은 없습니다. `.tvp` 패키지는
[사이트의 "플러그인" 섹션](https://gan0za.github.io/TabVale/#plugins)과
`docs/plugins/` 폴더에 있습니다. 파일을 내려받아 설정 → 플러그인 →
"파일에서 설치…"로 설치하세요. 관리자에서 영역을 선택합니다 — 패널, 북마크
위/아래 띠, 타일, 떠 있는 창. 플러그인 컨텍스트 메뉴에서 설정 행 열기, 끄기,
삭제가 가능합니다.

## 플러그인 개발(요약)

플러그인은 `manifest.json`, 코드 파일, 선택적 아이콘을 담은 `.tvp` zip입니다.
코드는 `mount(api)`를 정의하며 `chrome.*`가 없는 샌드박스에서 실행됩니다:
데이터는 `api.storage`, 네트워크는 매니페스트 허용 목록에 따른 `api.fetch`,
인터페이스는 `api.ui`, 사이트 아이콘은 `api.icon.favicon`.
패키징: `node tools/pack-plugin.mjs path/to/plugin`.

자세한 내용(영어): [형식](docs/PLUGIN_SPEC.md), [API](docs/PLUGIN_API.md),
[가이드](docs/PLUGIN_GUIDE.md).

## 개인정보와 권한

북마크, 화면, 배경, 설정은 `chrome.storage`에, 사이트 아이콘은 로컬
IndexedDB에 저장되며 기기를 떠나지 않습니다. 자세히:
[PRIVACY.md](PRIVACY.md)(영어).

## 라이선스

MIT. [LICENSE](LICENSE)를 참고하세요.
