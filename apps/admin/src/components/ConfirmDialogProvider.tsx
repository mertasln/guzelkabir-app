import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

// spec §11.2: "Tüm kritik aksiyonlar (statü değişikliği, iade onayı) için
// 'onay modalı' ... zorunlu." Bu, uygulamanın TEK onay modalı — imperative
// confirm() Promise<boolean> döner, her ekran kendi modal'ını yazmaz.
// bkz. lib/useConfirmedMutation.ts: gerçek mutasyon çağrısı YALNIZCA bu
// modal'dan geçerek tetiklenebilir.
export type ConfirmOptions = {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
};

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

type PendingConfirm = {
  options: ConfirmOptions;
  resolve: (result: boolean) => void;
};

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  const confirm = useCallback<ConfirmFn>((options) => {
    return new Promise<boolean>((resolve) => {
      setPending({ options, resolve });
    });
  }, []);

  function settle(result: boolean) {
    pending?.resolve(result);
    setPending(null);
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-sm">
            <h2 className="mb-2 text-base font-semibold">{pending.options.title}</h2>
            <p className="mb-6 text-sm text-[var(--muted-foreground)]">
              {pending.options.description}
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => settle(false)}>
                {pending.options.cancelLabel ?? "Vazgeç"}
              </Button>
              <Button
                variant={pending.options.variant === "destructive" ? "destructive" : "default"}
                size="sm"
                onClick={() => settle(true)}
              >
                {pending.options.confirmLabel ?? "Onayla"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within ConfirmDialogProvider");
  return ctx;
}
