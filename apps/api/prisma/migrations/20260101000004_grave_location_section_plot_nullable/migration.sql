-- "Yardım isteyin" akışı: müşteri ada/parsel bilmediğinde saha ekibi sahada
-- tespit edip PATCH /grave-locations/:id ile dolduracak (kullanıcı kararı,
-- ADIM 5). Sahte/yer tutucu metin yazmak yerine gerçek NULL — spec'in aynı
-- tabloda lat/lng'ye uyguladığı "sonradan doldurulur" prensibiyle tutarlı.

ALTER TABLE "grave_locations" ALTER COLUMN "section" DROP NOT NULL;
ALTER TABLE "grave_locations" ALTER COLUMN "plot" DROP NOT NULL;
