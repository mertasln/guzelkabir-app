-- spec §5.1: webhook idempotency/replay koruması — işlenmiş event ID'leri
-- burada tutulur, aynı (provider, event_id) çifti ikinci kez işlenmez.

CREATE TABLE "processed_webhook_events" (
    "id" UUID NOT NULL,
    "provider" VARCHAR(20) NOT NULL,
    "event_id" VARCHAR(255) NOT NULL,
    "event_type" VARCHAR(120) NOT NULL,
    "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processed_webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "processed_webhook_events_provider_event_id_key" ON "processed_webhook_events"("provider", "event_id");
