-- Spec §4.8: "grave_locations üzerinde PostGIS GIST indeksi (konum bazlı yakınlık
-- sorguları için)". Prisma'nın şema DSL'i PostGIS geography sütununu ve GIST indeks
-- tipini native temsil edemediği için bu migration elle yazıldı (schema.prisma'daki
-- lat/lng sütunlarından türetilen bir generated column + GIST indeksi).
--
-- generated column: lat/lng her güncellendiğinde location otomatik yeniden hesaplanır,
-- böylece uygulama katmanı iki kaynağı senkron tutmak zorunda kalmaz.

ALTER TABLE "grave_locations"
  ADD COLUMN "location" geography(Point, 4326)
  GENERATED ALWAYS AS (
    CASE
      WHEN "lat" IS NOT NULL AND "lng" IS NOT NULL
        THEN ST_SetSRID(ST_MakePoint("lng"::double precision, "lat"::double precision), 4326)::geography
      ELSE NULL
    END
  ) STORED;

CREATE INDEX "grave_locations_location_gist_idx" ON "grave_locations" USING GIST ("location");
