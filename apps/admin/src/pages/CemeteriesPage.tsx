import { useState } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { apiRequest, ApiError } from "@/lib/api";
import type { CemeteryAdminItem, CursorPage, PermitStatus } from "@/lib/types";
import { useConfirmedMutation } from "@/lib/useConfirmedMutation";
import { DataTable } from "@/components/DataTable";
import { StatusBadge, type BadgeTone } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

const PERMIT_LABELS: Record<PermitStatus, string> = {
  pending: "Beklemede",
  approved: "Onaylandı",
  rejected: "Reddedildi",
};

const PERMIT_TONE: Record<PermitStatus, BadgeTone> = {
  pending: "warning",
  approved: "success",
  rejected: "destructive",
};

// spec §11.1 "Mezarlık & İzin Yönetimi: Mezarlık kayıtları, belediye izin
// statüsü ve belge arşivi." İzin durumu/belge URL'i güncellemesi mevcut
// PATCH /cemeteries/:id'yi kullanıyor (kullanıcı talimatı, ADIM 9 Phase 8
// notu) — apps/api tarafında yeni/paralel bir endpoint açılmadı.
export function CemeteriesPage() {
  const queryClient = useQueryClient();
  const [permitFilter, setPermitFilter] = useState<PermitStatus | "">("");
  const [search, setSearch] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: "",
    city: "",
    district: "",
    municipalityAuthority: "",
  });
  const [editingId, setEditingId] = useState<string | null>(null);

  const query = useInfiniteQuery({
    queryKey: ["cemeteries", permitFilter, search],
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams();
      if (permitFilter) params.set("permitStatus", permitFilter);
      if (search) params.set("q", search);
      if (pageParam) params.set("cursor", pageParam);
      return apiRequest<CursorPage<CemeteryAdminItem>>(`/cemeteries?${params.toString()}`);
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const items = query.data?.pages.flatMap((page) => page.items) ?? [];

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["cemeteries"] });
  }

  const create = useConfirmedMutation<CemeteryAdminItem, typeof createForm>({
    mutationFn: (variables) =>
      apiRequest<CemeteryAdminItem>("/cemeteries", {
        method: "POST",
        body: JSON.stringify(variables),
      }),
    title: (v) => `${v.name} mezarlığını oluştur`,
    description: (v) => `${v.city}/${v.district} — ${v.municipalityAuthority}.`,
    onSuccess: () => {
      invalidate();
      setShowCreateForm(false);
      setCreateForm({ name: "", city: "", district: "", municipalityAuthority: "" });
    },
  });

  const updatePermit = useConfirmedMutation<
    CemeteryAdminItem,
    { cemeteryId: string; permitStatus: PermitStatus; permitDocumentUrl: string; name: string }
  >({
    mutationFn: ({ cemeteryId, permitStatus, permitDocumentUrl }) =>
      apiRequest<CemeteryAdminItem>(`/cemeteries/${cemeteryId}`, {
        method: "PATCH",
        body: JSON.stringify({
          permitStatus,
          ...(permitDocumentUrl ? { permitDocumentUrl } : {}),
        }),
      }),
    title: (v) => `${v.name} için izin durumunu güncelle`,
    description: (v) => `Yeni durum: ${PERMIT_LABELS[v.permitStatus]}.`,
    onSuccess: () => {
      invalidate();
      setEditingId(null);
    },
  });

  const anyError = create.error ?? updatePermit.error;

  const columns: ColumnDef<CemeteryAdminItem, unknown>[] = [
    { id: "name", header: "Mezarlık", accessorFn: (r) => r.name },
    { id: "location", header: "Şehir / İlçe", accessorFn: (r) => `${r.city} / ${r.district}` },
    { id: "authority", header: "Belediye", accessorFn: (r) => r.municipalityAuthority },
    {
      id: "permit",
      header: "İzin Durumu",
      cell: ({ row }) => (
        <StatusBadge
          label={PERMIT_LABELS[row.original.permitStatus]}
          tone={PERMIT_TONE[row.original.permitStatus]}
        />
      ),
    },
    {
      id: "document",
      header: "Belge",
      cell: ({ row }) =>
        row.original.permitDocumentUrl ? (
          <a
            href={row.original.permitDocumentUrl}
            target="_blank"
            rel="noreferrer"
            className="text-[var(--primary)] underline"
          >
            Görüntüle
          </a>
        ) : (
          <span className="text-[var(--muted-foreground)]">—</span>
        ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const cemetery = row.original;
        if (editingId !== cemetery.id) {
          return (
            <Button size="sm" variant="outline" onClick={() => setEditingId(cemetery.id)}>
              İzni Düzenle
            </Button>
          );
        }
        return (
          <PermitEditForm
            cemetery={cemetery}
            isPending={updatePermit.isPending}
            onSave={(permitStatus, permitDocumentUrl) =>
              updatePermit.confirmedMutate({
                cemeteryId: cemetery.id,
                permitStatus,
                permitDocumentUrl,
                name: cemetery.name,
              })
            }
            onCancel={() => setEditingId(null)}
          />
        );
      },
    },
  ];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Mezarlık & İzin Yönetimi</h1>
        <Button size="sm" onClick={() => setShowCreateForm((v) => !v)}>
          {showCreateForm ? "Vazgeç" : "Yeni Mezarlık Ekle"}
        </Button>
      </div>

      {showCreateForm && (
        <Card className="mb-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              placeholder="Mezarlık Adı"
              value={createForm.name}
              onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
            />
            <Input
              placeholder="Şehir"
              value={createForm.city}
              onChange={(e) => setCreateForm((f) => ({ ...f, city: e.target.value }))}
            />
            <Input
              placeholder="İlçe"
              value={createForm.district}
              onChange={(e) => setCreateForm((f) => ({ ...f, district: e.target.value }))}
            />
            <Input
              placeholder="Belediye"
              value={createForm.municipalityAuthority}
              onChange={(e) => setCreateForm((f) => ({ ...f, municipalityAuthority: e.target.value }))}
            />
          </div>
          <Button
            size="sm"
            className="mt-3"
            disabled={
              create.isPending ||
              !createForm.name ||
              !createForm.city ||
              !createForm.district ||
              !createForm.municipalityAuthority
            }
            onClick={() => create.confirmedMutate(createForm)}
          >
            Oluştur
          </Button>
        </Card>
      )}

      <div className="mb-4 flex flex-wrap gap-3">
        <select
          className="rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm"
          value={permitFilter}
          onChange={(e) => setPermitFilter(e.target.value as PermitStatus | "")}
        >
          <option value="">Tüm İzin Durumları</option>
          {(Object.keys(PERMIT_LABELS) as PermitStatus[]).map((status) => (
            <option key={status} value={status}>
              {PERMIT_LABELS[status]}
            </option>
          ))}
        </select>
        <Input
          placeholder="Ada/şehir ara"
          className="w-56"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {anyError && (
        <p className="mb-3 text-sm text-[var(--destructive)]">
          {anyError instanceof ApiError ? anyError.message : "Bir hata oluştu."}
        </p>
      )}

      <DataTable columns={columns} data={items} emptyMessage="Bu filtreye uyan mezarlık yok." />

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

function PermitEditForm({
  cemetery,
  isPending,
  onSave,
  onCancel,
}: {
  cemetery: CemeteryAdminItem;
  isPending: boolean;
  onSave: (permitStatus: PermitStatus, permitDocumentUrl: string) => void;
  onCancel: () => void;
}) {
  const [status, setStatus] = useState<PermitStatus>(cemetery.permitStatus);
  const [url, setUrl] = useState(cemetery.permitDocumentUrl ?? "");

  return (
    <div className="flex flex-col gap-2">
      <select
        className="rounded-md border border-[var(--border)] bg-white px-2 py-1.5 text-sm"
        value={status}
        onChange={(e) => setStatus(e.target.value as PermitStatus)}
      >
        {(Object.keys(PERMIT_LABELS) as PermitStatus[]).map((s) => (
          <option key={s} value={s}>
            {PERMIT_LABELS[s]}
          </option>
        ))}
      </select>
      <Input
        placeholder="Belge URL'i (opsiyonel)"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
      />
      <div className="flex gap-2">
        <Button size="sm" disabled={isPending} onClick={() => onSave(status, url)}>
          Kaydet
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel}>
          Vazgeç
        </Button>
      </div>
    </div>
  );
}
