import { useState } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { apiRequest, ApiError } from "@/lib/api";
import type { CursorPage, FieldPartnerStatus, PartnerListItem } from "@/lib/types";
import { useConfirmedMutation } from "@/lib/useConfirmedMutation";
import { DataTable } from "@/components/DataTable";
import { StatusBadge, type BadgeTone } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { PartnerPayoutsPanel } from "./PartnerPayoutsPanel";

const STATUS_LABELS: Record<FieldPartnerStatus, string> = {
  onboarding: "Onboarding",
  active: "Aktif",
  suspended: "Askıya Alındı",
  terminated: "Sonlandırıldı",
  rejected: "Reddedildi",
};

const STATUS_TONE: Record<FieldPartnerStatus, BadgeTone> = {
  onboarding: "warning",
  active: "success",
  suspended: "warning",
  terminated: "muted",
  rejected: "destructive",
};

// spec §11.1 "Partner Yönetimi: Onboarding onay akışı (KYC belge inceleme),
// performans/puan geçmişi, ödeme hak ediş (payout) listesi." — Admin Panel
// Phase 4. Onboarding onay/red akışı, tracked "onboarding→active" blocker'ının
// (bkz. CLAUDE.md) gerçek çözümü — bu ekran o backend'in ilk canlı tüketicisi.
export function PartnersPage() {
  const [statusFilter, setStatusFilter] = useState<FieldPartnerStatus | "">("onboarding");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const query = useInfiniteQuery({
    queryKey: ["partners", statusFilter],
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (pageParam) params.set("cursor", pageParam);
      return apiRequest<CursorPage<PartnerListItem>>(`/partners?${params.toString()}`);
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const items = query.data?.pages.flatMap((page) => page.items) ?? [];

  const approve = useConfirmedMutation<PartnerListItem, { partnerId: string }>({
    mutationFn: ({ partnerId }) =>
      apiRequest<PartnerListItem>(`/partners/${partnerId}/approve`, { method: "POST" }),
    title: "Ortağı onayla",
    description:
      "Bu ortağı onaylayacaksınız — durumu 'active'e geçecek ve göreve atanabilir hale gelecek.",
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["partners"] }),
  });

  const reject = useConfirmedMutation<PartnerListItem, { partnerId: string; reason: string }>({
    mutationFn: ({ partnerId, reason }) =>
      apiRequest<PartnerListItem>(`/partners/${partnerId}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      }),
    title: "Ortağı reddet",
    description:
      "Bu ortağı reddedeceksiniz — durumu 'rejected'e geçecek, bu işlem geri alınamaz.",
    variant: "destructive",
    input: {
      field: "reason",
      label: "Red gerekçesi",
      placeholder: "Örn. sabıka kaydı belgesi eksik/geçersiz",
      required: true,
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["partners"] }),
  });

  const actionError = approve.error ?? reject.error;

  const columns: ColumnDef<PartnerListItem, unknown>[] = [
    { id: "name", header: "Ad Soyad", accessorFn: (r) => r.user.fullName },
    { id: "email", header: "E-posta", accessorFn: (r) => r.user.email },
    { id: "phone", header: "Telefon", accessorFn: (r) => r.user.phone ?? "—" },
    { id: "cities", header: "Şehirler", accessorFn: (r) => r.serviceCities.join(", ") },
    {
      id: "status",
      header: "Durum",
      cell: ({ row }) => (
        <StatusBadge label={STATUS_LABELS[row.original.status]} tone={STATUS_TONE[row.original.status]} />
      ),
    },
    {
      id: "createdAt",
      header: "Kayıt Tarihi",
      accessorFn: (r) => new Date(r.createdAt).toLocaleDateString("tr-TR"),
    },
    {
      id: "actions",
      header: "İşlemler",
      cell: ({ row }) => {
        const partner = row.original;
        return (
          <div className="flex flex-wrap gap-2">
            {partner.status === "onboarding" && (
              <>
                <Button
                  size="sm"
                  disabled={approve.isPending}
                  onClick={() => approve.confirmedMutate({ partnerId: partner.id })}
                >
                  Onayla
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={reject.isPending}
                  onClick={() => reject.confirmedMutate({ partnerId: partner.id, reason: "" })}
                >
                  Reddet
                </Button>
              </>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setExpandedId(expandedId === partner.id ? null : partner.id)}
            >
              {expandedId === partner.id ? "Ödemeleri Gizle" : "Ödemeler"}
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Partner Yönetimi</h1>
        <select
          className="rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as FieldPartnerStatus | "")}
        >
          <option value="">Tümü</option>
          {(Object.keys(STATUS_LABELS) as FieldPartnerStatus[]).map((status) => (
            <option key={status} value={status}>
              {STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </div>

      {actionError && (
        <p className="mb-3 text-sm text-[var(--destructive)]">
          {actionError instanceof ApiError ? actionError.message : "Bir hata oluştu."}
        </p>
      )}

      <DataTable
        columns={columns}
        data={items}
        emptyMessage="Bu filtreye uyan partner yok."
        renderRowDetail={(row) =>
          row.id === expandedId ? <PartnerPayoutsPanel partnerId={row.id} /> : null
        }
      />

      {query.hasNextPage && (
        <div className="mt-4 flex justify-center">
          <Button
            variant="outline"
            onClick={() => void query.fetchNextPage()}
            disabled={query.isFetchingNextPage}
          >
            {query.isFetchingNextPage ? "Yükleniyor…" : "Daha fazla yükle"}
          </Button>
        </div>
      )}
    </div>
  );
}
