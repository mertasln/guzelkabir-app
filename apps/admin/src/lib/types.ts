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

export type OrderStatus =
  | "draft"
  | "pending_payment"
  | "confirmed"
  | "assigned"
  | "in_progress"
  | "completed_pending_approval"
  | "closed"
  | "disputed"
  | "refunded"
  | "cancelled";

// apps/api/src/orders/orders.service.ts ORDER_LIST_SELECT ile eşleşir.
export type OrderListItem = {
  id: string;
  orderNumber: string;
  customerId: string;
  serviceType: string;
  status: OrderStatus;
  preferredDate: string | null;
  priceAmount: string;
  currency: "TRY" | "EUR" | "USD" | "GBP";
  assignedPartnerId: string | null;
  assignedAt: string | null;
  completedAt: string | null;
  approvalDeadline: string | null;
  createdAt: string;
  updatedAt: string;
  customer: { fullName: string; email: string };
  graveLocation: { cemetery: { name: string; city: string } };
  assignedPartner: { id: string; user: { fullName: string } } | null;
};

// apps/api/src/common/audit-log/audit-log.service.ts AuditLogEntry ile eşleşir.
export type AuditLogItem = {
  id: string;
  actorId: string | null;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  createdAt: string;
};

export type Cemetery = {
  id: string;
  name: string;
  city: string;
  district: string;
};

export type GraveLocation = {
  id: string;
  section: string | null;
  plot: string | null;
  locationNote: string | null;
  cemetery: Cemetery;
};

// apps/api/src/orders/orders.service.ts OrderWithLocation ile eşleşir
// (GET /orders/:id).
export type OrderDetail = {
  id: string;
  orderNumber: string;
  customerId: string;
  serviceType: string;
  status: OrderStatus;
  preferredDate: string | null;
  specialNotes: string | null;
  priceAmount: string;
  currency: "TRY" | "EUR" | "USD" | "GBP";
  assignedPartnerId: string | null;
  assignedAt: string | null;
  completedAt: string | null;
  approvalDeadline: string | null;
  createdAt: string;
  updatedAt: string;
  customer: { fullName: string; email: string };
  assignedPartner: { id: string; user: { fullName: string } } | null;
  graveLocation: GraveLocation;
};

export type ComplaintCategory = "quality" | "disrespect" | "no_show" | "other";

export type ComplaintStatus =
  | "open"
  | "investigating"
  | "resolved_refund"
  | "resolved_reservice"
  | "rejected";

// apps/api/src/complaints/complaints.service.ts COMPLAINT_LIST_SELECT ile eşleşir.
export type ComplaintListItem = {
  id: string;
  orderId: string;
  raisedBy: string;
  category: ComplaintCategory;
  description: string;
  status: ComplaintStatus;
  resolutionNotes: string | null;
  resolvedAt: string | null;
  slaDeadline: string | null;
  createdAt: string;
  updatedAt: string;
  order: { orderNumber: string; priceAmount: string; currency: string };
  raiser: { fullName: string; email: string };
};

export type StaffRole = "ops_manager" | "support_agent" | "admin";

// apps/api/src/users/users.service.ts STAFF_USER_SELECT ile eşleşir.
export type StaffUserItem = {
  id: string;
  email: string;
  phone: string | null;
  fullName: string;
  role: StaffRole;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type PermitStatus = "pending" | "approved" | "rejected";

// apps/api/src/cemeteries/cemeteries.service.ts'in admin (izinsiz select
// filtresi olmayan) Cemetery dönüşüyle eşleşir — GET /cemeteries/search'in
// PublicCemetery'sinden farklı, permitStatus/permitDocumentUrl içerir.
export type CemeteryAdminItem = {
  id: string;
  name: string;
  city: string;
  district: string;
  municipalityAuthority: string;
  permitStatus: PermitStatus;
  permitDocumentUrl: string | null;
  lat: string | null;
  lng: string | null;
  geotagToleranceM: number | null;
  createdAt: string;
  updatedAt: string;
};
