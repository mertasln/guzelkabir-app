// apps/api'nin yanıt şekilleriyle elle eşleşen tipler — apps/web/apps/field-pwa
// ile aynı desen (packages/shared-types hâlâ boş placeholder, ADIM 4'ten beri).

export type CursorPage<T> = { items: T[]; nextCursor: string | null };

export type FieldPartnerStatus =
  | "onboarding"
  | "active"
  | "suspended"
  | "terminated"
  | "rejected";

// apps/api/src/partners/partners.service.ts PARTNER_LIST_SELECT ile eşleşir.
export type PartnerListItem = {
  id: string;
  userId: string;
  criminalRecordCheck: boolean;
  documentUrl: string | null;
  insurancePolicyNo: string | null;
  serviceCities: string[];
  ratingAvg: string | null;
  status: FieldPartnerStatus;
  contractSignedAt: string | null;
  ethicsTrainingCompletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  user: { fullName: string; email: string; phone: string | null };
};

export type PayoutStatus = "pending" | "paid" | "held_dispute";

export type PartnerPayout = {
  id: string;
  fieldPartnerId: string;
  orderId: string;
  amount: string;
  status: PayoutStatus;
  paidAt: string | null;
  payoutBatchId: string | null;
  createdAt: string;
};
