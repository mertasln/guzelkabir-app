import { useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, ApiError } from "@/lib/api";
import type { ComplaintCategory, ComplaintListItem, ComplaintStatus, CursorPage } from "@/lib/types";
import { useConfirmedMutation } from "@/lib/useConfirmedMutation";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge, type BadgeTone } from "@/components/StatusBadge";
import { SlaCountdown } from "@/components/SlaCountdown";

const CATEGORY_LABELS: Record<ComplaintCategory, string> = {
  quality: "Kalite",
  disrespect: "Saygısızlık",
  no_show: "Gelmedi",
  other: "Diğer",
};

type Outcome = "resolved_refund" | "resolved_reservice" | "rejected";

const OUTCOME_LABELS: Record<Outcome, string> = {
  resolved_refund: "İade Edildi",
  resolved_reservice: "Yeniden Hizmet",
  rejected: "Reddedildi",
};

const OUTCOME_TONE: Record<Outcome, BadgeTone> = {
  resolved_refund: "success",
  resolved_reservice: "default",
  rejected: "muted",
};

// spec §11.1 "Şikayet Yönetimi: ... çözüm şablonları" — CRUD'lu bir şablon
// yönetimi istenmiyor, yalnızca hızlı seçim kolaylığı (bkz.
// ResolveComplaintDto yorumu). Seçilen şablon metni düzenlenebilir textarea'ya
// öntanımlı olarak yazılır.
const RESOLUTION_TEMPLATES: Record<Outcome, string> = {
  resolved_refund: "Şikayetiniz değerlendirildi, ödemenizin tamamı iade edilecektir.",
  resolved_reservice:
    "Şikayetiniz değerlendirildi, hizmetiniz saha ekibimiz tarafından ücretsiz olarak tekrar gerçekleştirilecektir.",
  rejected: "Şikayetiniz incelendi, mevcut hizmet kalitesinin yeterli olduğu değerlendirilmiştir.",
};

// spec §11.1 "Şikayet Yönetimi: Kanban board (Açık/İnceleniyor/Çözüldü)" —
// spec literal olarak 3 kolon adı veriyor; resolved_refund/resolved_reservice/
// rejected'in üçü de "Çözüldü" kolonunda toplanıyor, her kart kendi sonucunu
// bir rozetle gösteriyor (5 durumu 5 ayrı kolona bölmek spec'in 3 kolon
// tanımından sapardı).
export function ComplaintsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["complaints"],
    queryFn: () =>
      apiRequest<CursorPage<ComplaintListItem>>(`/complaints?${new URLSearchParams({ limit: "100" })}`),
  });

  const items = query.data?.items ?? [];
  const open = items.filter((c) => c.status === "open");
  const investigating = items.filter((c) => c.status === "investigating");
  const resolved = items.filter((c) =>
    (["resolved_refund", "resolved_reservice", "rejected"] as ComplaintStatus[]).includes(c.status),
  );

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["complaints"] });
  }

  const investigate = useConfirmedMutation<ComplaintListItem, { complaintId: string; orderNumber: string }>({
    mutationFn: ({ complaintId }) =>
      apiRequest<ComplaintListItem>(`/complaints/${complaintId}/investigate`, { method: "POST" }),
    title: (v) => `${v.orderNumber} şikayetini incelemeye al`,
    description: () => "Bu şikayeti 'İnceleniyor' durumuna alacaksınız.",
    onSuccess: invalidate,
  });

  const resolve = useConfirmedMutation<
    ComplaintListItem,
    { complaintId: string; outcome: Outcome; resolutionNotes: string; orderNumber: string }
  >({
    mutationFn: ({ complaintId, outcome, resolutionNotes }) =>
      apiRequest<ComplaintListItem>(`/complaints/${complaintId}/resolve`, {
        method: "POST",
        body: JSON.stringify({ outcome, resolutionNotes }),
      }),
    title: (v) => `${v.orderNumber} şikayetini çöz`,
    description: (v) => `Sonuç: ${OUTCOME_LABELS[v.outcome]}. "${v.resolutionNotes}"`,
    onSuccess: invalidate,
  });

  const processRefund = useConfirmedMutation<{ success: boolean }, { complaintId: string; orderNumber: string }>({
    mutationFn: ({ complaintId }) =>
      apiRequest<{ success: boolean }>(`/complaints/${complaintId}/process-refund`, { method: "POST" }),
    title: (v) => `${v.orderNumber} için iadeyi gerçekleştir`,
    description: () =>
      "Bu, gerçek bir iyzico iade çağrısı tetikleyecek — müşteriye gerçek para iadesi yapılacak. Bu işlem geri alınamaz.",
    variant: "destructive",
    confirmLabel: "İadeyi Gerçekleştir",
    onSuccess: invalidate,
  });

  const anyError = investigate.error ?? resolve.error ?? processRefund.error;

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Şikayet Yönetimi</h1>
      {anyError && (
        <p className="mb-3 text-sm text-[var(--destructive)]">
          {anyError instanceof ApiError ? anyError.message : "Bir hata oluştu."}
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-3">
        <KanbanColumn title="Açık" count={open.length}>
          {open.map((c) => (
            <ComplaintCard key={c.id} complaint={c}>
              <Button
                size="sm"
                disabled={investigate.isPending}
                onClick={() => investigate.confirmedMutate({ complaintId: c.id, orderNumber: c.order.orderNumber })}
              >
                İncelemeye Al
              </Button>
            </ComplaintCard>
          ))}
        </KanbanColumn>

        <KanbanColumn title="İnceleniyor" count={investigating.length}>
          {investigating.map((c) => (
            <ComplaintCard key={c.id} complaint={c}>
              <ResolveForm
                isPending={resolve.isPending}
                onResolve={(outcome, resolutionNotes) =>
                  resolve.confirmedMutate({
                    complaintId: c.id,
                    outcome,
                    resolutionNotes,
                    orderNumber: c.order.orderNumber,
                  })
                }
              />
            </ComplaintCard>
          ))}
        </KanbanColumn>

        <KanbanColumn title="Çözüldü" count={resolved.length}>
          {resolved.map((c) => (
            <ComplaintCard key={c.id} complaint={c}>
              <StatusBadge
                label={OUTCOME_LABELS[c.status as Outcome]}
                tone={OUTCOME_TONE[c.status as Outcome]}
              />
              {c.status === "resolved_refund" && (user?.role === "ops_manager" || user?.role === "admin") && (
                <Button
                  size="sm"
                  variant="destructive"
                  className="mt-2 w-full"
                  disabled={processRefund.isPending}
                  onClick={() =>
                    processRefund.confirmedMutate({ complaintId: c.id, orderNumber: c.order.orderNumber })
                  }
                >
                  İadeyi Gerçekleştir
                </Button>
              )}
            </ComplaintCard>
          ))}
        </KanbanColumn>
      </div>
    </div>
  );
}

function KanbanColumn({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold text-[var(--muted-foreground)]">
        {title} ({count})
      </h2>
      <div className="flex flex-col gap-2">
        {count === 0 && (
          <Card>
            <p className="text-sm text-[var(--muted-foreground)]">Kayıt yok.</p>
          </Card>
        )}
        {children}
      </div>
    </div>
  );
}

function ComplaintCard({
  complaint,
  children,
}: {
  complaint: ComplaintListItem;
  children: ReactNode;
}) {
  return (
    <Card>
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <p className="font-medium">{complaint.order.orderNumber}</p>
          <p className="text-xs text-[var(--muted-foreground)]">
            {CATEGORY_LABELS[complaint.category]} — {complaint.raiser.fullName}
          </p>
        </div>
        {complaint.slaDeadline && complaint.status !== "resolved_refund" && (
          <SlaCountdown deadline={complaint.slaDeadline} />
        )}
      </div>
      <p className="mb-3 text-sm">{complaint.description}</p>
      {children}
    </Card>
  );
}

function ResolveForm({
  isPending,
  onResolve,
}: {
  isPending: boolean;
  onResolve: (outcome: Outcome, resolutionNotes: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>("resolved_refund");
  const [notes, setNotes] = useState(RESOLUTION_TEMPLATES.resolved_refund);

  function handleOutcomeChange(next: Outcome) {
    setOutcome(next);
    // Kullanıcı zaten şablonu düzenlemişse üzerine yazmıyoruz — yalnızca
    // hâlâ bir önceki şablonun aynısıysa yeni şablona geçiyoruz.
    setNotes((prev) => (prev === RESOLUTION_TEMPLATES[outcome] ? RESOLUTION_TEMPLATES[next] : prev));
  }

  if (!expanded) {
    return (
      <Button size="sm" variant="outline" onClick={() => setExpanded(true)}>
        Çöz
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <select
        className="rounded-md border border-[var(--border)] bg-white px-2 py-1.5 text-sm"
        value={outcome}
        onChange={(e) => handleOutcomeChange(e.target.value as Outcome)}
      >
        {(Object.keys(OUTCOME_LABELS) as Outcome[]).map((o) => (
          <option key={o} value={o}>
            {OUTCOME_LABELS[o]}
          </option>
        ))}
      </select>
      <textarea
        className="min-h-20 rounded-md border border-[var(--border)] bg-white px-2 py-1.5 text-sm"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={isPending || notes.trim().length < 5}
          onClick={() => onResolve(outcome, notes)}
        >
          Çöz
        </Button>
        <Button size="sm" variant="outline" onClick={() => setExpanded(false)}>
          Vazgeç
        </Button>
      </div>
    </div>
  );
}
