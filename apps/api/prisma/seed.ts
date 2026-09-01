/**
 * apps/web'deki hardcoded prototip verilerini (mezarlıklar, "Murat Y." panel
 * senaryosu, örnek siparişler, Aylık Abonelik) yeni şemaya seed data olarak taşır.
 * Kaynaklar: apps/web/src/app/page.tsx, siparis/page.tsx, panel/page.tsx.
 *
 * national_id_encrypted burada gerçek bir TC/pasaport no DEĞİL — üretimde bu alan
 * AES-256 ile uygulama katmanında şifrelenmiş olarak yazılır (spec §14.1); seed'de
 * yalnızca placeholder bir ciphertext-benzeri değer kullanıldı.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // --- 4.3 cemeteries — pilot kapsamındaki 4 mezarlık (page.tsx / siparis/page.tsx) ---
  const [zincirlikuyu, karacaahmet, edirnekapi, eyupsultan] = await Promise.all([
    prisma.cemetery.upsert({
      where: { id: "00000000-0000-4000-8000-000000000001" },
      update: {},
      create: {
        id: "00000000-0000-4000-8000-000000000001",
        name: "Zincirlikuyu",
        city: "İstanbul",
        district: "Şişli",
        municipalityAuthority: "İstanbul Büyükşehir Belediyesi",
        permitStatus: "approved",
        // hero rozetindeki "Konum doğrulandı" örnek koordinatı (page.tsx)
        lat: 41.0668,
        lng: 29.0073,
      },
    }),
    prisma.cemetery.upsert({
      where: { id: "00000000-0000-4000-8000-000000000002" },
      update: {},
      create: {
        id: "00000000-0000-4000-8000-000000000002",
        name: "Karacaahmet",
        city: "İstanbul",
        district: "Üsküdar",
        municipalityAuthority: "İstanbul Büyükşehir Belediyesi",
        permitStatus: "approved",
        // panel.tsx COORD sabiti
        lat: 41.0012,
        lng: 29.0361,
      },
    }),
    prisma.cemetery.upsert({
      where: { id: "00000000-0000-4000-8000-000000000003" },
      update: {},
      create: {
        id: "00000000-0000-4000-8000-000000000003",
        name: "Edirnekapı",
        city: "İstanbul",
        district: "Eyüpsultan",
        municipalityAuthority: "İstanbul Büyükşehir Belediyesi",
        permitStatus: "approved",
        lat: 41.0392,
        lng: 28.9394,
      },
    }),
    prisma.cemetery.upsert({
      where: { id: "00000000-0000-4000-8000-000000000004" },
      update: {},
      create: {
        id: "00000000-0000-4000-8000-000000000004",
        name: "Eyüpsultan",
        city: "İstanbul",
        district: "Eyüpsultan",
        municipalityAuthority: "İstanbul Büyükşehir Belediyesi",
        permitStatus: "approved",
        lat: 41.0483,
        lng: 28.9339,
      },
    }),
  ]);

  // --- 4.1 users — panel.tsx'teki hardcoded "Murat Y." müşterisi + "Hasan Kaya" ustası ---
  const customer = await prisma.user.upsert({
    where: { email: "murat.y@example.com" },
    update: {},
    create: {
      email: "murat.y@example.com",
      phone: "+493012345678", // Köln, Almanya — testimonial (page.tsx)
      passwordHash: "SEED_PLACEHOLDER_HASH",
      role: "customer",
      fullName: "Murat Y.",
      locale: "tr",
      isVerified: true,
    },
  });

  const partnerUser = await prisma.user.upsert({
    where: { email: "hasan.kaya@example.com" },
    update: {},
    create: {
      email: "hasan.kaya@example.com",
      phone: "+905551234567",
      passwordHash: "SEED_PLACEHOLDER_HASH",
      role: "field_partner",
      fullName: "Hasan Kaya",
      locale: "tr",
      isVerified: true,
      kycStatus: "verified",
    },
  });

  // --- 4.2 field_partners ---
  const fieldPartner = await prisma.fieldPartner.upsert({
    where: { userId: partnerUser.id },
    update: {},
    create: {
      userId: partnerUser.id,
      nationalIdEncrypted: "SEED_PLACEHOLDER_ENCRYPTED_VALUE",
      criminalRecordCheck: true,
      insurancePolicyNo: "SEED-POL-0001",
      serviceCities: ["İstanbul"],
      ratingAvg: 4.9,
      status: "active",
      contractSignedAt: new Date("2026-01-15T09:00:00Z"),
      ethicsTrainingCompletedAt: new Date("2026-01-16T09:00:00Z"),
    },
  });

  // --- 4.3 grave_locations — panel.tsx: "Karacaahmet · Ada 14 / Parsel 207", merhum "Mehmet Yılmaz" ---
  const graveLocation = await prisma.graveLocation.upsert({
    where: { id: "00000000-0000-4000-8000-000000000101" },
    update: {},
    create: {
      id: "00000000-0000-4000-8000-000000000101",
      cemeteryId: karacaahmet.id,
      section: "14", // Ada
      plot: "207", // Parsel
      deceasedName: "Mehmet Yılmaz",
      lat: 41.0012,
      lng: 29.0361,
    },
  });

  // --- 4.6 subscriptions — panel.tsx aside-card "Aboneliğiniz": Aylık Abonelik, ₺1.200/ay, sonraki yenileme 12 Haz 2026 ---
  const subscription = await prisma.subscription.upsert({
    where: { id: "00000000-0000-4000-8000-000000000201" },
    update: {},
    create: {
      id: "00000000-0000-4000-8000-000000000201",
      customerId: customer.id,
      graveLocationId: graveLocation.id,
      plan: "monthly",
      priceAmount: 1200.0,
      currency: "TRY",
      status: "active",
      nextBillingDate: new Date("2026-06-12"),
    },
  });

  // --- 4.4 orders + 4.5 evidence_photos + 4.6 payments/partner_payouts —
  // panel.tsx: HISTORY (3 kayıt, onaylı), PENDING (onay bekliyor), ACTIVE (planlandı) ---
  type SeedOrder = {
    orderNumber: string;
    preferredDate: string;
    status: "closed" | "completed_pending_approval" | "assigned";
    completedAt: string | null;
    // saha notu (spec §8.1/§8.2, max 200 karakter) — panel.tsx'teki usta notlarından
    fieldNote: string | null;
  };

  const seedOrders: SeedOrder[] = [
    {
      orderNumber: "#MB-2026-00001",
      preferredDate: "2026-02-24",
      status: "closed",
      completedAt: "2026-02-24T11:30:00+03:00",
      fieldNote: "İlk tespit ve kapsamlı temizlik. Mezar konumu doğrulandı ve fotoğraflandı.",
    }, // İlk bakım
    {
      orderNumber: "#MB-2026-00002",
      preferredDate: "2026-03-26",
      status: "closed",
      completedAt: "2026-03-26T14:03:00+03:00",
      fieldNote: "Kış sonrası ilk kapsamlı bakım. Taş yüzeyi temizlendi, çevre düzenlendi.",
    }, // Mart ayı bakımı
    {
      orderNumber: "#MB-2026-00003",
      preferredDate: "2026-04-28",
      status: "closed",
      completedAt: "2026-04-28T10:15:00+03:00",
      fieldNote: "Mermer temizliği, yabani ot alımı ve sulama yapıldı. Bahar yağmurları sonrası toprak düzenlendi.",
    }, // Nisan ayı bakımı
    {
      orderNumber: "#MB-2026-00004",
      preferredDate: "2026-05-29",
      status: "completed_pending_approval",
      completedAt: "2026-05-29T11:42:00+03:00",
      fieldNote:
        "Mermer ve taş yüzeyi temizlendi, yabani otlar alındı, toprak havalandırıldı ve sulama yapıldı. Mezar taşı yazısı okunaklı; çatlak veya hasar görülmedi.",
    }, // Mayıs ayı bakımı — onay bekliyor
    { orderNumber: "#MB-2026-00005", preferredDate: "2026-06-05", status: "assigned", completedAt: null, fieldNote: null }, // Bayram öncesi özel bakım
    { orderNumber: "#MB-2026-00006", preferredDate: "2026-06-12", status: "assigned", completedAt: null, fieldNote: null }, // Haziran ayı bakımı
  ];

  for (const so of seedOrders) {
    const completedAt = so.completedAt ? new Date(so.completedAt) : null;
    const approvalDeadline = completedAt
      ? new Date(completedAt.getTime() + 48 * 60 * 60 * 1000)
      : null;

    const order = await prisma.order.upsert({
      where: { orderNumber: so.orderNumber },
      update: {},
      create: {
        orderNumber: so.orderNumber,
        customerId: customer.id,
        graveLocationId: graveLocation.id,
        serviceType: "subscription",
        status: so.status,
        preferredDate: new Date(so.preferredDate),
        priceAmount: 1200.0,
        currency: "TRY",
        assignedPartnerId: fieldPartner.id,
        assignedAt: new Date(new Date(so.preferredDate).getTime() - 24 * 60 * 60 * 1000),
        completedAt,
        approvalDeadline,
        subscriptionId: subscription.id,
      },
    });

    // Tamamlanmış/onay bekleyen siparişlerde kanıt fotoğrafı + ödeme + hakediş var;
    // henüz sahaya çıkılmamış planlanan siparişlerde (assigned) yok.
    if (completedAt) {
      const existing = await prisma.evidencePhoto.findFirst({ where: { orderId: order.id } });
      if (!existing) {
        await prisma.evidencePhoto.create({
          data: {
            orderId: order.id,
            uploadedBy: partnerUser.id,
            photoType: "before",
            fileUrl: "/bakimsiz-mezar.jpeg",
            exifGpsLat: 41.0012,
            exifGpsLng: 29.0361,
            exifTimestamp: completedAt,
            serverReceivedAt: completedAt,
            geotagValidationStatus: "valid",
            distanceFromGraveM: 4.2,
            fieldNote: so.fieldNote,
          },
        });
        await prisma.evidencePhoto.create({
          data: {
            orderId: order.id,
            uploadedBy: partnerUser.id,
            photoType: "after",
            fileUrl: "/bakimli-mezar.png",
            exifGpsLat: 41.0012,
            exifGpsLng: 29.0361,
            exifTimestamp: completedAt,
            serverReceivedAt: completedAt,
            geotagValidationStatus: "valid",
            distanceFromGraveM: 4.2,
            fieldNote: so.fieldNote,
          },
        });
      }

      const existingPayment = await prisma.payment.findFirst({ where: { orderId: order.id } });
      if (!existingPayment) {
        await prisma.payment.create({
          data: {
            orderId: order.id,
            provider: "iyzico",
            providerPaymentIntentId: `tok_seed_${order.orderNumber.replace(/\W/g, "")}`,
            amount: 1200.0,
            currency: "TRY",
            status: "succeeded",
            paymentMethodType: "card",
            threeDsStatus: "succeeded",
          },
        });
      }

      // Ödeme hak edişi (payout): yalnızca müşteri onayı verilmiş (closed) siparişlerde
      // 'paid' — onay bekleyen (completed_pending_approval) siparişte ödeme ustaya
      // henüz aktarılmadığı için 'pending' (spec: "önce onay, sonra ödeme").
      const existingPayout = await prisma.partnerPayout.findFirst({ where: { orderId: order.id } });
      if (!existingPayout) {
        await prisma.partnerPayout.create({
          data: {
            fieldPartnerId: fieldPartner.id,
            orderId: order.id,
            amount: 1200.0,
            status: so.status === "closed" ? "paid" : "pending",
            paidAt: so.status === "closed" ? completedAt : null,
          },
        });
      }
    }
  }

  console.log("Seed tamamlandı:", {
    cemeteries: [zincirlikuyu, karacaahmet, edirnekapi, eyupsultan].map((c) => c.name),
    customer: customer.email,
    fieldPartner: partnerUser.email,
    graveLocation: `${graveLocation.section}/${graveLocation.plot}`,
    subscription: subscription.id,
    orders: seedOrders.length,
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
