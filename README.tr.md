# TabVale

**Read in:** [English](README.md) · [Русский](README.ru.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [Español](README.es.md) · [Português (Brasil)](README.pt-BR.md) · [Italiano](README.it.md) · [Polski](README.pl.md) · [Türkçe](README.tr.md) · [Українська](README.uk.md) · [中文](README.zh.md) · [日本語](README.ja.md) · [한국어](README.ko.md)

> Kısa çeviri. İngilizce README ana kaynaktır. Çeviri ana dili konuşucusu olmayan biri tarafından yapıldı; düzeltmeler GitHub Issues üzerinden memnuniyetle karşılanır.

Chrome ve Microsoft Edge için, yeni sekme sayfasını özelleştirilebilir bir
panoya dönüştüren uzantı: arama, birden çok yer imi ekranı, arka planlar ve
isteğe bağlı eklentiler.

## Özellikler

- Seçilebilir arama motoru; liste düzenlenebilir, her motorun kendi simgesi olabilir.
- Birden çok yer imi ekranı: noktalar, boş alanda kaydırma, `Alt+←/→`; yer imlerini ekranlar arasında taşıma.
- Yer imleri simgelerle (yerel önbellek), sürükleyerek sıralama, düzenleme ve silme.
- Arka planlar: URL, yerel dosya, renk veya gradyan.
- Otomatik/açık/koyu tema ve 13 arayüz dili.
- Eklentiler — yalnızca sizin kurduklarınız: saat, notlar, klavye, zamanlayıcı, parolalar, hava durumu, GitHub istatistikleri, uygulama başlatıcı, RSS, görevler, özlü sözler, yer imi içe aktarma.
- Ayarların JSON olarak içe ve dışa aktarımı.

## Kurulum

1. `chrome://extensions` veya `edge://extensions` açın.
2. Geliştirici modunu açın.
3. «Paketlenmemiş öğe yükle» ile proje klasörünü seçin.
4. Yeni bir sekme açın.

## Eklentiler

Varsayılan olarak hiçbir eklenti kurulu değildir. Hazır `.tvp` paketleri
[sitedeki «Eklentiler» bölümünde](https://gan0za.github.io/TabVale/#plugins) ve
`docs/plugins/` klasöründe bulunur. Dosyayı indirip kurun: Ayarlar → Eklentiler →
«Dosyadan yükle…». Yönetici bölgeyi seçer — panel, yer imlerinin üstünde veya
altında şerit, döşeme, yüzen pencere; eklentinin bağlam menüsü satırını açar,
kapatır veya kaldırır.

## Eklenti geliştirme (kısa)

Eklenti, `manifest.json`, kod dosyası ve isteğe bağlı simge içeren bir `.tvp`
zip dosyasıdır. Kod `mount(api)` tanımlar ve `chrome.*` olmadan sandbox’ta
çalışır: veriler `api.storage`, ağ manifestteki izin listesine göre `api.fetch`,
arayüz `api.ui`, site simgeleri `api.icon.favicon`.
Paketleme: `node tools/pack-plugin.mjs path/to/plugin`.

Ayrıntılar İngilizce: [format](docs/PLUGIN_SPEC.md), [API](docs/PLUGIN_API.md),
[kılavuz](docs/PLUGIN_GUIDE.md).

## Gizlilik ve izinler

Yer imleri, ekranlar, arka planlar ve ayarlar `chrome.storage` içinde; site
simgeleri yerel IndexedDB’de tutulur ve cihazdan çıkmaz. Ayrıntılar:
[PRIVACY.md](PRIVACY.md) (İngilizce).

## Lisans

MIT. Bkz. [LICENSE](LICENSE).
