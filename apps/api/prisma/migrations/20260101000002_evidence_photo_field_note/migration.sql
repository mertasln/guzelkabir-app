-- "Saha notu" (spec §8.1/§8.2/§12.1/§17, max 200 karakter, opsiyonel).
-- Spec §4 şema bölümünde bu alan için kolon tanımlı değildi (spec boşluğu,
-- bkz. schema.prisma EvidencePhoto.fieldNote yorumu) — kullanıcı kararıyla
-- evidence_photos'a eklendi.

ALTER TABLE "evidence_photos" ADD COLUMN "field_note" VARCHAR(200);
