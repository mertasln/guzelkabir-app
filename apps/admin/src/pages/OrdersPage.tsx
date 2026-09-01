import { useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import type { ColumnDef } from "@tanstack/react-table";
import { apiRequest } from "@/lib/api";
import type { CursorPage, OrderListItem, OrderStatus, PartnerListItem } from "@/lib/types";
import { ORDER_STATUS_LABELS, ORDER_STATUS_TONE } from "@/lib/orderStatus";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// spec §11.1 "Sipariş Yönetimi: Filtrelenebilir/aranabilir tablo (durum,
// şehir, tarih, partner), toplu işlem desteği, sipariş detay sayfası."
//
// ⚠️ "Toplu işlem desteği" bilinçli olarak bu fazda YOK — spec hangi toplu
// aksiyonların (toplu iptal? toplu dışa aktarım? toplu atama?) istendiğini
// belirtmiyor, ve sipariş durumu gibi SLA'ya bağlı bir alanda icat edilmiş
// bir aksiyon yanlış olabilir. Bkz. CLAUDE.md "Admin Panel" bölümü — takip
// edilen, kullanıcıdan netlik beklenen bir boşluk.
export function OrdersPage() {
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "">("");
  const [cityFilter, setCityFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [partnerFilter, setPartnerFilter] = useState("");

  const partnersQuery = useQuery({
    queryKey: ["partners", "active", "filter-options"],
    queryFn: () =>
      apiRequest<CursorPage<PartnerListItem>>(
        `/partners?${new URLSearchParams({ status: "active", limit: "100" })}`,
      ),
  });

  const query = useInfiniteQuery({
    queryKey: ["orders", statusFilter, cityFilter, dateFilter, partnerFilter],
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (cityFilter) params.set("city", cityFilter);
      if (dateFilter) params.set("date", dateFilter);
      if (partnerFilter) params.set("partnerId", partnerFilter);
      if (pageParam) params.set("cursor", pageParam);
      return apiRequest<CursorPage<OrderListItem>>(`/orders?${params.toString()}`);
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const items = query.data?.pages.flatMap((page) => page.items) ?? [];

  const columns: ColumnDef<OrderListItem, unknown>[] = [
    { id: "orderNumber", header: "Sipariş No", accessorFn: (r) => r.orderNumber },
    { id: "customer", header: "Müşteri", accessorFn: (r) => r.customer.fullName },
    {
      id: "city",
      header: "Mezarlık / Şehir",
      accessorFn: (r) => `${r.graveLocation.cemetery.name} — ${r.graveLocation.cemetery.city}`,
    },
    {
      id: "partner",
      header: "Partner",
      accessorFn: (r) => r.assignedPartner?.user.fullName ?? "—",
    },
    {
      id: "status",
      header: "Durum",
      cell: ({ row }) => (
        <StatusBadge
          label={ORDER_STATUS_LABELS[row.original.status]}
          tone={ORDER_STATUS_TONE[row.original.status]}
        />
      ),
    },
    {
      id: "price",
      header: "Tutar",
      accessorFn: (r) => `${r.priceAmount} ${r.currency}`,
    },
    {
      id: "createdAt",
      header: "Oluşturulma",
      accessorFn: (r) => new Date(r.createdAt).toLocaleDateString("tr-TR"),
    },
    {
      id: "detail",
      header: "",
      cell: ({ row }) => (
        <Link to={`/siparisler/${row.original.id}`}>
          <Button size="sm" variant="outline">
            Detay
          </Button>
        </Link>
      ),
    },
  ];

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Sipariş Yönetimi</h1>

      <div className="mb-4 flex flex-wrap gap-3">
        <select
          className="rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as OrderStatus | "")}
        >
          <option value="">Tüm Durumlar</option>
          {(Object.keys(ORDER_STATUS_LABELS) as OrderStatus[]).map((status) => (
            <option key={status} value={status}>
              {ORDER_STATUS_LABELS[status]}
            </option>
          ))}
        </select>
        <Input
          placeholder="Şehir"
          className="w-40"
          value={cityFilter}
          onChange={(e) => setCityFilter(e.target.value)}
        />
        <Input
          type="date"
          className="w-40"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
        />
        <select
          className="rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm"
          value={partnerFilter}
          onChange={(e) => setPartnerFilter(e.target.value)}
        >
          <option value="">Tüm Partnerler</option>
          {partnersQuery.data?.items.map((partner) => (
            <option key={partner.id} value={partner.id}>
              {partner.user.fullName}
            </option>
          ))}
        </select>
      </div>

      <DataTable columns={columns} data={items} emptyMessage="Bu filtreye uyan sipariş yok." />

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
