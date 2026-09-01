import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

// spec §11.2: "Tüm kritik aksiyonlar (statü değişikliği, iade onayı) için
// 'onay modalı' ... zorunlu." Bu, uygulamanın TEK onay modalı — imperative
// confirm() Promise<{confirmed, value}> döner, her ekran kendi modal'ını
// yazmaz. bkz. lib/useConfirmedMutation.ts: gerçek mutasyon çağrısı YALNIZCA
// bu modal'dan geçerek tetiklenebilir.
//
// input: bazı aksiyonlar (örn. partner reddi) bir metin girişi gerektirir
// (spec §11.1: red gerekçesi) — ayrı bir modal yazmak yerine aynı modal'a
// opsiyonel bir alan eklendi, tek onay modalı deseni bozulmadı.
export type ConfirmOptions = {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
  input?: { label: string; placeholder?: string; required?: boolean };
};

export type ConfirmResult = { confirmed: boolean; value: string };

type ConfirmFn = (options: ConfirmOptions) => Promise<ConfirmResult>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

type PendingConfirm = {
  options: ConfirmOptions;
  resolve: (result: ConfirmResult) => void;
};

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const [inputValue, setInputValue] = useState("");

  const confirm = useCallback<ConfirmFn>((options) => {
    return new Promise<ConfirmResult>((resolve) => {
      setInputValue("");
      setPending({ options, resolve });
    });
  }, []);

  function settle(confirmed: boolean) {
    pending?.resolve({ confirmed, value: inputValue });
    setPending(null);
  }

  const requiresInput = pending?.options.input?.required ?? false;
  const confirmDisabled = requiresInput && inputValue.trim().length === 0;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-sm">
            <h2 className="mb-2 text-base font-semibold">{pending.options.title}</h2>
            <p className="mb-4 text-sm text-[var(--muted-foreground)]">
              {pending.options.description}
            </p>
            {pending.options.input && (
              <label className="mb-6 block">
                <span className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">
                  {pending.options.input.label}
                </span>
                <Input
                  autoFocus
                  placeholder={pending.options.input.placeholder}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                />
              </label>
            )}
            {!pending.options.input && <div className="mb-2" />}
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => settle(false)}>
                {pending.options.cancelLabel ?? "Vazgeç"}
              </Button>
              <Button
                variant={pending.options.variant === "destructive" ? "destructive" : "default"}
                size="sm"
                disabled={confirmDisabled}
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
