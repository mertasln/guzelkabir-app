import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import type { CursorPage, OrderListItem, PartnerListItem } from "@/lib/types";
import { useConfirmedMutation } from "@/lib/useConfirmedMutation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SlaCountdown } from "@/components/SlaCountdown";
import { cn } from "@/lib/utils";

type AssignVariables = {
  orderId: string;
  fieldPartnerId: string;
  orderNumber: string;
  partnerName: string;
};

// spec §11.1 "Atama Ekranı: Bekleyen siparişler + müsait saha partnerleri
// yan yana (kanban veya liste görünüm), tek tıkla atama, SLA sayaç
// göstergesi." 'confirmed' durumundaki bir sipariş, tanım gereği hiç
// atanmamıştır (assign() yalnızca 'confirmed'den geçişe izin verir ve aynı
// anda hem status'u hem assignedPartnerId'yi değiştirir) — bu yüzden ayrı
// bir "atanmamış" filtresi gerekmiyor, status=confirmed yeterli.
export function AssignmentPage() {
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const ordersQuery = useQuery({
    queryKey: ["orders", "confirmed", "assignment-queue"],
    queryFn: () =>
      apiRequest<CursorPage<OrderListItem>>(
        `/orders?${new URLSearchParams({ status: "confirmed", limit: "50" })}`,
      ),
  });

  const partnersQuery = useQuery({
    queryKey: ["partners", "active", "assignment-queue"],
    queryFn: () =>
      apiRequest<CursorPage<PartnerListItem>>(
        `/partners?${new URLSearchParams({ status: "active", limit: "50" })}`,
      ),
  });

  const assign = useConfirmedMutation<OrderListItem, AssignVariables>({
    mutationFn: ({ orderId, fieldPartnerId }) =>
      apiRequest<OrderListItem>(`/orders/${orderId}/assign`, {
        method: "PATCH",
        body: JSON.stringify({ fieldPartnerId }),
      }),
    title: (v) => `${v.orderNumber} siparişini ata`,
    description: (v) => `Bu siparişi ${v.partnerName} adlı saha partnerine atayacaksınız.`,
    onSuccess: () => {
      setSelectedOrderId(null);
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });

  const orders = ordersQuery.data?.items ?? [];
  const partners = partnersQuery.data?.items ?? [];
  const selectedOrder = orders.find((o) => o.id === selectedOrderId);

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Atama Ekranı</h1>
      {assign.isError && (
        <p className="mb-3 text-sm text-[var(--destructive)]">
          {assign.error instanceof Error ? assign.error.message : "Bir hata oluştu."}
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <h2 className="mb-2 text-sm font-semibold text-[var(--muted-foreground)]">
            Bekleyen Siparişler ({orders.length})
          </h2>
          <div className="flex flex-col gap-2">
            {orders.length === 0 && (
              <Card>
                <p className="text-sm text-[var(--muted-foreground)]">
                  Atama bekleyen sipariş yok.
                </p>
              </Card>
            )}
            {orders.map((order) => (
              <Card
                key={order.id}
                className={cn(
                  "cursor-pointer transition-colors",
                  selectedOrderId === order.id && "border-[var(--primary)] bg-[var(--primary)]/5",
                )}
                onClick={() => setSelectedOrderId(order.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{order.orderNumber}</p>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      {order.graveLocation.cemetery.name} — {order.graveLocation.cemetery.city}
                    </p>
                    <p className="text-xs text-[var(--muted-foreground)]">{order.customer.fullName}</p>
                  </div>
                  <SlaCountdown referenceTime={order.updatedAt} />
                </div>
              </Card>
            ))}
          </div>
        </div>

        <div>
          <h2 className="mb-2 text-sm font-semibold text-[var(--muted-foreground)]">
            Müsait Saha Partnerleri ({partners.length})
          </h2>
          {!selectedOrder && (
            <p className="mb-2 text-xs text-[var(--muted-foreground)]">
              Atamak için önce soldan bir sipariş seçin.
            </p>
          )}
          <div className="flex flex-col gap-2">
            {partners.length === 0 && (
              <Card>
                <p className="text-sm text-[var(--muted-foreground)]">Aktif saha partneri yok.</p>
              </Card>
            )}
            {partners.map((partner) => (
              <Card key={partner.id} className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{partner.user.fullName}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {partner.serviceCities.join(", ")}
                  </p>
                </div>
                <Button
                  size="sm"
                  disabled={!selectedOrder || assign.isPending}
                  onClick={() =>
                    selectedOrder &&
                    assign.confirmedMutate({
                      orderId: selectedOrder.id,
                      fieldPartnerId: partner.id,
                      orderNumber: selectedOrder.orderNumber,
                      partnerName: partner.user.fullName,
                    })
                  }
                >
                  Ata
                </Button>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
