# Şampiyonlar Ligi Kura Simülasyonu

Bu proje, üç farklı torbada yer alan toplam 24 takım için Şampiyonlar Ligi formatına benzer bir kura çekim deneyimi sunar. Her takım, her torbadan ikişer rakip seçer; böylece her takım 6 farklı rakiple tek maç yapar. Tüm eşleşmeler benzersizdir ve rövanş oynanmaz.

## Özellikler

- 3 torbada 8'er takım ve rastgele kura algoritması
- Her takım için her torbadan ikişer rakip ataması (toplam 6 maç)
- Animasyonlu ve aşamalı kura sunumu (rakipler sırayla açıklanır)
- Arayüz üzerinden takım isimlerini düzenleyip yalnızca seçilen takım için kura animasyonu başlatabilme
- 2. ve 3. torbada yer alan 16 takımı tek tıkla rastgele iki torbaya bölen "Torbaları Karıştır" aracı
- Eşleşmeler her iki takımın kartında eş zamanlı görünür, aktif kura kartı modal pencerede vurgulanır
- Her takımın rakipleri torba bazında gruplandırılmış olarak gösterilir
- Tek tıkla yeni kura üretme ve simülasyonu sıfırlama

## Başlangıç

```bash
npm install
npm run dev
```

Tarayıcıdan varsayılan olarak `http://localhost:5173` adresine giderek canlı kura simülasyonunu izleyebilirsiniz.

## Komutlar

| Komut           | Açıklama                                      |
|-----------------|-----------------------------------------------|
| `npm run dev`   | Geliştirme sunucusunu başlatır                |
| `npm run build` | Üretim için optimize edilmiş derlemeyi üretir |
| `npm run preview` | Derlenmiş çıktıyı yerel sunucuda test eder |

## Notlar

- Kura algoritması her çalıştırıldığında tüm eşleşmeler rastgele oluşturulur ancak tüm kısıtları koruyacak şekilde doğrulanır.
- "Yeni Kura Oluştur" butonu ile anında yeni eşleşmeler oluşturabilir, "Sıfırla" ile animasyonu başa sarabilirsiniz.
- Arayüz karanlık tema ile hazır gelir; ihtiyaç hâlinde stilleri `src/App.css` dosyasında güncelleyebilirsiniz.
