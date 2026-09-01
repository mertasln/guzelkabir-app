-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "postgis";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('customer', 'ops_manager', 'field_partner', 'support_agent', 'admin');

-- CreateEnum
CREATE TYPE "KycStatus" AS ENUM ('pending', 'verified', 'rejected');

-- CreateEnum
CREATE TYPE "FieldPartnerStatus" AS ENUM ('onboarding', 'active', 'suspended', 'terminated');

-- CreateEnum
CREATE TYPE "PermitStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "ServiceType" AS ENUM ('cleaning', 'watering', 'flowers', 'full_package', 'subscription');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('draft', 'pending_payment', 'confirmed', 'assigned', 'in_progress', 'completed_pending_approval', 'closed', 'disputed', 'refunded', 'cancelled');

-- CreateEnum
CREATE TYPE "OrderCurrency" AS ENUM ('TRY', 'EUR', 'USD', 'GBP');

-- CreateEnum
CREATE TYPE "PhotoType" AS ENUM ('wide_shot', 'detail_shot', 'before', 'after');

-- CreateEnum
CREATE TYPE "GeotagValidationStatus" AS ENUM ('valid', 'gps_mismatch', 'timestamp_mismatch', 'missing_exif', 'manual_review');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('stripe', 'paypal');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('requires_action', 'succeeded', 'failed', 'refunded', 'chargeback');

-- CreateEnum
CREATE TYPE "SubscriptionPlan" AS ENUM ('monthly', 'annual');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('active', 'past_due', 'cancelled');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('pending', 'paid', 'held_dispute');

-- CreateEnum
CREATE TYPE "ComplaintCategory" AS ENUM ('quality', 'disrespect', 'no_show', 'other');

-- CreateEnum
CREATE TYPE "ComplaintStatus" AS ENUM ('open', 'investigating', 'resolved_refund', 'resolved_reservice', 'rejected');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('sms', 'email', 'whatsapp', 'push');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('queued', 'sent', 'delivered', 'failed');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(20),
    "password_hash" VARCHAR(255) NOT NULL,
    "role" "UserRole" NOT NULL,
    "full_name" VARCHAR(255) NOT NULL,
    "locale" VARCHAR(10) NOT NULL,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "kyc_status" "KycStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "field_partners" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "national_id_encrypted" TEXT NOT NULL,
    "criminal_record_check" BOOLEAN NOT NULL DEFAULT false,
    "document_url" TEXT,
    "insurance_policy_no" VARCHAR(100),
    "service_cities" TEXT[],
    "rating_avg" DECIMAL(3,2),
    "status" "FieldPartnerStatus" NOT NULL DEFAULT 'onboarding',
    "contract_signed_at" TIMESTAMP(3),
    "ethics_training_completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "field_partners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cemeteries" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "city" VARCHAR(120) NOT NULL,
    "district" VARCHAR(120) NOT NULL,
    "municipality_authority" VARCHAR(255) NOT NULL,
    "permit_status" "PermitStatus" NOT NULL DEFAULT 'pending',
    "permit_document_url" TEXT,
    "lat" DECIMAL,
    "lng" DECIMAL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "cemeteries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grave_locations" (
    "id" UUID NOT NULL,
    "cemetery_id" UUID NOT NULL,
    "section" VARCHAR(50) NOT NULL,
    "plot" VARCHAR(50) NOT NULL,
    "grave_no" VARCHAR(50),
    "deceased_name" VARCHAR(255),
    "location_note" TEXT,
    "lat" DECIMAL,
    "lng" DECIMAL,
    "reference_photo_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "grave_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "order_number" VARCHAR(20) NOT NULL,
    "customer_id" UUID NOT NULL,
    "grave_location_id" UUID NOT NULL,
    "service_type" "ServiceType" NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'draft',
    "preferred_date" DATE,
    "special_notes" VARCHAR(500),
    "price_amount" DECIMAL(10,2) NOT NULL,
    "currency" "OrderCurrency" NOT NULL,
    "assigned_partner_id" UUID,
    "assigned_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "approval_deadline" TIMESTAMP(3),
    "subscription_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence_photos" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "uploaded_by" UUID NOT NULL,
    "photo_type" "PhotoType" NOT NULL,
    "file_url" TEXT NOT NULL,
    "exif_gps_lat" DECIMAL,
    "exif_gps_lng" DECIMAL,
    "exif_timestamp" TIMESTAMP(3),
    "server_received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "geotag_validation_status" "GeotagValidationStatus" NOT NULL DEFAULT 'manual_review',
    "distance_from_grave_m" DECIMAL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "evidence_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "provider_payment_intent_id" VARCHAR(255),
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" "OrderCurrency" NOT NULL,
    "status" "PaymentStatus" NOT NULL,
    "payment_method_type" VARCHAR(50),
    "three_ds_status" VARCHAR(50),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "grave_location_id" UUID NOT NULL,
    "plan" "SubscriptionPlan" NOT NULL,
    "price_amount" DECIMAL(10,2) NOT NULL,
    "currency" "OrderCurrency" NOT NULL,
    "stripe_subscription_id" VARCHAR(255),
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'active',
    "next_billing_date" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_payouts" (
    "id" UUID NOT NULL,
    "field_partner_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'pending',
    "paid_at" TIMESTAMP(3),
    "payout_batch_id" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "partner_payouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "complaints" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "raised_by" UUID NOT NULL,
    "category" "ComplaintCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "status" "ComplaintStatus" NOT NULL DEFAULT 'open',
    "resolution_notes" TEXT,
    "resolved_at" TIMESTAMP(3),
    "sla_deadline" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "complaints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "template_key" VARCHAR(120) NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'queued',
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" UUID NOT NULL,
    "actor_id" UUID,
    "actor_role" VARCHAR(50),
    "action" VARCHAR(120) NOT NULL,
    "entity_type" VARCHAR(80) NOT NULL,
    "entity_id" UUID NOT NULL,
    "old_value" JSONB,
    "new_value" JSONB,
    "ip_address" VARCHAR(45),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "field_partners_user_id_key" ON "field_partners"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_order_number_key" ON "orders"("order_number");

-- CreateIndex
CREATE INDEX "orders_status_assigned_partner_id_idx" ON "orders"("status", "assigned_partner_id");

-- CreateIndex
CREATE INDEX "orders_customer_id_created_at_idx" ON "orders"("customer_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "evidence_photos_order_id_idx" ON "evidence_photos"("order_id");

-- CreateIndex
CREATE INDEX "audit_log_entity_type_entity_id_idx" ON "audit_log"("entity_type", "entity_id");

-- AddForeignKey
ALTER TABLE "field_partners" ADD CONSTRAINT "field_partners_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grave_locations" ADD CONSTRAINT "grave_locations_cemetery_id_fkey" FOREIGN KEY ("cemetery_id") REFERENCES "cemeteries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_grave_location_id_fkey" FOREIGN KEY ("grave_location_id") REFERENCES "grave_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_assigned_partner_id_fkey" FOREIGN KEY ("assigned_partner_id") REFERENCES "field_partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_photos" ADD CONSTRAINT "evidence_photos_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_photos" ADD CONSTRAINT "evidence_photos_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_grave_location_id_fkey" FOREIGN KEY ("grave_location_id") REFERENCES "grave_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_payouts" ADD CONSTRAINT "partner_payouts_field_partner_id_fkey" FOREIGN KEY ("field_partner_id") REFERENCES "field_partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_payouts" ADD CONSTRAINT "partner_payouts_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_raised_by_fkey" FOREIGN KEY ("raised_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

