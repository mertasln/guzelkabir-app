-- spec §4.6'nın "stripe_subscription_id" alanı, Stripe artık kullanılamadığı
-- için iyzico'nun kendi Subscription API referans koduna göre yeniden
-- adlandırıldı (bkz. CLAUDE.md "Payment provider: iyzico, not Stripe").

ALTER TABLE "subscriptions" RENAME COLUMN "stripe_subscription_id" TO "iyzico_subscription_reference_code";
