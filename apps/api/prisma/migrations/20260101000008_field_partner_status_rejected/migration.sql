-- spec §11.1 "Partner Yönetimi: Onboarding onay akışı" (Admin Panel, ADIM 9)
-- ihtiyacı: bir partner KYC incelemesinde reddedilebilmeli. Mevcut enum'da
-- bunun için ayrı bir değer yoktu (yalnızca onboarding/active/suspended/
-- terminated). 'terminated'ı yeniden kullanmak yanlış anlatır — o bir zamanlar
-- aktif olmuş birini ifade eder, hiç onaylanmamış birini değil (kullanıcı
-- kararı, CLAUDE.md'de belgelendi).

ALTER TYPE "FieldPartnerStatus" ADD VALUE 'rejected';
