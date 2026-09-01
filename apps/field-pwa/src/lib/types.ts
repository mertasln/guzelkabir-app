// apps/api/src/{orders,partners}'ın gerçek Prisma dönüş şekilleriyle birebir
// eşleşir (bkz. PartnersService.TaskListItem / OrdersService.OrderWithLocation).
// packages/shared-types henüz boş placeholder olduğundan burada elle tutuluyor.

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

export type ServiceType = "cleaning" | "watering" | "flowers" | "full_package" | "subscription";

export type Cemetery = {
  id: string;
  name: string;
  city: string;
  district: string;
  lat: string | null;
  lng: string | null;
  geotagToleranceM: number | null;
};

export type GraveLocation = {
  id: string;
  section: string | null;
  plot: string | null;
  graveNo: string | null;
  locationNote: string | null;
  lat: string | null;
  lng: string | null;
  cemetery: Cemetery;
};

export type Task = {
  id: string;
  orderNumber: string;
  serviceType: ServiceType;
  status: OrderStatus;
  specialNotes: string | null;
  assignedAt: string | null;
  graveLocation: GraveLocation;
};

export type CursorPage<T> = {
  items: T[];
  nextCursor: string | null;
};

export type PhotoType = "wide_shot" | "detail_shot";

export type GeotagValidationStatus =
  | "valid"
  | "gps_mismatch"
  | "timestamp_mismatch"
  | "missing_exif"
  | "manual_review";

export type EvidencePhoto = {
  id: string;
  photoType: PhotoType;
  geotagValidationStatus: GeotagValidationStatus;
};
