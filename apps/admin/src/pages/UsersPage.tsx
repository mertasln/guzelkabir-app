import { useState } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { apiRequest, ApiError } from "@/lib/api";
import type { CursorPage, StaffRole, StaffUserItem } from "@/lib/types";
import { useConfirmedMutation } from "@/lib/useConfirmedMutation";
import { useAuth } from "@/lib/auth";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

const ROLE_LABELS: Record<StaffRole, string> = {
  ops_manager: "Ops Manager",
  support_agent: "Support Agent",
  admin: "Admin",
};

// spec §11.1 "Kullanıcı & Rol Yönetimi: Admin/Support/Ops kullanıcı CRUD, rol
// atama" — spec §6.1'e göre yalnızca Admin rolü bu ekrana erişebilir
// (ProtectedRoute rol bazlı sayfa erişimini kısıtlamıyor, ama backend zaten
// admin-only, bu ekran diğer roller için yalnızca 403 hataları gösterir —
// gelecekte nav'ı role göre gizlemek bir iyileştirme olabilir).
export function UsersPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [roleFilter, setRoleFilter] = useState<StaffRole | "">("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [form, setForm] = useState({
    email: "",
    password: "",
    fullName: "",
    phone: "",
    role: "support_agent" as StaffRole,
  });

  const query = useInfiniteQuery({
    queryKey: ["staff-users", roleFilter],
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams();
      if (roleFilter) params.set("role", roleFilter);
      if (pageParam) params.set("cursor", pageParam);
      return apiRequest<CursorPage<StaffUserItem>>(`/users?${params.toString()}`);
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const items = query.data?.pages.flatMap((page) => page.items) ?? [];

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["staff-users"] });
  }

  const create = useConfirmedMutation<StaffUserItem, typeof form>({
    mutationFn: (variables) =>
      apiRequest<StaffUserItem>("/users", {
        method: "POST",
        body: JSON.stringify({ ...variables, phone: variables.phone || undefined }),
      }),
    title: (v) => `${v.fullName} için hesap oluştur`,
    description: (v) => `${v.email} — ${ROLE_LABELS[v.role]} rolüyle yeni bir iç ekip hesabı oluşturulacak.`,
    onSuccess: () => {
      invalidate();
      setShowCreateForm(false);
      setForm({ email: "", password: "", fullName: "", phone: "", role: "support_agent" });
    },
  });

  const changeRole = useConfirmedMutation<
    StaffUserItem,
    { userId: string; role: StaffRole; fullName: string }
  >({
    mutationFn: ({ userId, role }) =>
      apiRequest<StaffUserItem>(`/users/${userId}`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      }),
    title: (v) => `${v.fullName} için rolü değiştir`,
    description: (v) => `Yeni rol: ${ROLE_LABELS[v.role]}.`,
    onSuccess: invalidate,
  });

  const toggleActive = useConfirmedMutation<
    StaffUserItem,
    { userId: string; isActive: boolean; fullName: string }
  >({
    mutationFn: ({ userId, isActive }) =>
      apiRequest<StaffUserItem>(`/users/${userId}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive }),
      }),
    title: (v) => (v.isActive ? `${v.fullName} hesabını aktif et` : `${v.fullName} hesabını devre dışı bırak`),
    description: (v) =>
      v.isActive
        ? "Bu hesap tekrar giriş yapabilecek."
        : "Bu hesap artık giriş yapamayacak (mevcut oturumu da 7 gün içinde sona erecek).",
    variant: "destructive",
    onSuccess: invalidate,
  });

  const anyError = create.error ?? changeRole.error ?? toggleActive.error;

  const columns: ColumnDef<StaffUserItem, unknown>[] = [
    { id: "name", header: "Ad Soyad", accessorFn: (r) => r.fullName },
    { id: "email", header: "E-posta", accessorFn: (r) => r.email },
    { id: "phone", header: "Telefon", accessorFn: (r) => r.phone ?? "—" },
    {
      id: "role",
      header: "Rol",
      cell: ({ row }) => {
        const staff = row.original;
        return (
          <select
            className="rounded-md border border-[var(--border)] bg-white px-2 py-1 text-sm"
            value={staff.role}
            disabled={changeRole.isPending}
            onChange={(e) =>
              changeRole.confirmedMutate({
                userId: staff.id,
                role: e.target.value as StaffRole,
                fullName: staff.fullName,
              })
            }
          >
            {(Object.keys(ROLE_LABELS) as StaffRole[]).map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </select>
        );
      },
    },
    {
      id: "status",
      header: "Durum",
      cell: ({ row }) => (
        <StatusBadge
          label={row.original.deletedAt ? "Devre Dışı" : "Aktif"}
          tone={row.original.deletedAt ? "muted" : "success"}
        />
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const staff = row.original;
        const isSelf = staff.id === user?.sub;
        if (isSelf) {
          return <span className="text-xs text-[var(--muted-foreground)]">Kendi hesabınız</span>;
        }
        const isActive = !staff.deletedAt;
        return (
          <Button
            size="sm"
            variant={isActive ? "destructive" : "outline"}
            disabled={toggleActive.isPending}
            onClick={() =>
              toggleActive.confirmedMutate({
                userId: staff.id,
                isActive: !isActive,
                fullName: staff.fullName,
              })
            }
          >
            {isActive ? "Devre Dışı Bırak" : "Aktif Et"}
          </Button>
        );
      },
    },
  ];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Kullanıcı & Rol Yönetimi</h1>
        <Button size="sm" onClick={() => setShowCreateForm((v) => !v)}>
          {showCreateForm ? "Vazgeç" : "Yeni Kullanıcı Ekle"}
        </Button>
      </div>

      {showCreateForm && (
        <Card className="mb-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              placeholder="E-posta"
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
            <Input
              placeholder="Parola (min 10 karakter)"
              type="password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            />
            <Input
              placeholder="Ad Soyad"
              value={form.fullName}
              onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
            />
            <Input
              placeholder="Telefon (opsiyonel, +90...)"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />
            <select
              className="rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm"
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as StaffRole }))}
            >
              {(Object.keys(ROLE_LABELS) as StaffRole[]).map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </select>
          </div>
          <Button
            size="sm"
            className="mt-3"
            disabled={
              create.isPending ||
              !form.email ||
              form.password.length < 10 ||
              !form.fullName
            }
            onClick={() => create.confirmedMutate(form)}
          >
            Oluştur
          </Button>
        </Card>
      )}

      <div className="mb-4">
        <select
          className="rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as StaffRole | "")}
        >
          <option value="">Tüm Roller</option>
          {(Object.keys(ROLE_LABELS) as StaffRole[]).map((role) => (
            <option key={role} value={role}>
              {ROLE_LABELS[role]}
            </option>
          ))}
        </select>
      </div>

      {anyError && (
        <p className="mb-3 text-sm text-[var(--destructive)]">
          {anyError instanceof ApiError ? anyError.message : "Bir hata oluştu."}
        </p>
      )}

      <DataTable columns={columns} data={items} emptyMessage="Bu filtreye uyan kullanıcı yok." />

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
