import { useCallback } from "react";
import { useMutation, type UseMutationOptions } from "@tanstack/react-query";
import { useConfirm, type ConfirmOptions } from "@/components/ConfirmDialogProvider";

type ConfirmedMutationOptions<TData, TVariables> = UseMutationOptions<TData, Error, TVariables> & {
  title: string | ((variables: TVariables) => string);
  description: string | ((variables: TVariables) => string);
  confirmLabel?: string;
  variant?: ConfirmOptions["variant"];
  // Bazı aksiyonlar (örn. partner reddi) modal içinde bir metin girişi ister
  // (spec §11.1: red gerekçesi). `field`, girilen değerin `variables`
  // nesnesinde hangi anahtara yazılacağını belirtir — çağıran taraf o alanı
  // boş geçer (örn. `{ partnerId, reason: "" }`), onay modalı girilen
  // değerle doldurur.
  input?: { field: keyof TVariables; label: string; placeholder?: string; required?: boolean };
};

// spec §11.2'nin "onay modalı" gereksinimini yapısal olarak zorunlu kılan
// tek nokta: TanStack Query'nin ham mutate/mutateAsync'i buradan hiç DIŞARI
// VERİLMİYOR (aşağıdaki destructuring'e bak) — ekran kodu yalnızca
// confirmedMutate'i çağırabilir, bu da her zaman önce ConfirmDialogProvider'ın
// modal'ını açar. audit_log yazımı ayrı, bağımsız bir garanti (backend,
// servis katmanında zaten koşulsuz çalışıyor — bkz. CLAUDE.md "Admin Panel"
// bölümü) — ikisi birbirine güvenmiyor.
export function useConfirmedMutation<TData, TVariables>(
  options: ConfirmedMutationOptions<TData, TVariables>,
) {
  const confirm = useConfirm();
  const { title, description, confirmLabel, variant, input, ...mutationOptions } = options;
  const { mutate: _mutate, mutateAsync: _mutateAsync, ...rest } = useMutation(mutationOptions);

  const confirmedMutate = useCallback(
    (variables: TVariables) => {
      void (async () => {
        const result = await confirm({
          title: typeof title === "function" ? title(variables) : title,
          description: typeof description === "function" ? description(variables) : description,
          confirmLabel,
          variant,
          input: input
            ? { label: input.label, placeholder: input.placeholder, required: input.required }
            : undefined,
        });
        if (!result.confirmed) return;
        const finalVariables = input
          ? { ...variables, [input.field]: result.value }
          : variables;
        _mutate(finalVariables);
      })();
    },
    [confirm, title, description, confirmLabel, variant, input, _mutate],
  );

  return { ...rest, confirmedMutate };
}
