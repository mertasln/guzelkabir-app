-- Stripe/PayPal Türkiye'de kurulu bir şirket için kullanılamıyor (bkz.
-- CLAUDE.md "Payment provider: iyzico, not Stripe") — yeni birincil (ve tek)
-- sağlayıcı iyzico. Mevcut enum değerleri (stripe/paypal) şema geçmişi için
-- korunuyor, yalnızca yeni bir değer ekleniyor.

ALTER TYPE "PaymentProvider" ADD VALUE 'iyzico';
