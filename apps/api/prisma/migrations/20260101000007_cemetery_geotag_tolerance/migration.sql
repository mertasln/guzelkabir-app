-- spec §8.1: "varsayılan tolerans: 150 metre — mezarlık büyüklüğüne göre
-- yapılandırılabilir". Spec §4'te bu alan için kolon tanımlı değildi (bilinen
-- spec boşluğu, ADIM 7 kararı). NULL ise uygulama katmanında
-- GEOTAG_DEFAULT_TOLERANCE_M env değerine düşer.

ALTER TABLE "cemeteries" ADD COLUMN "geotag_tolerance_m" INTEGER;
