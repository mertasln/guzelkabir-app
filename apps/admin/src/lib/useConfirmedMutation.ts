import { useCallback } from "react";
import { useMutation, type UseMutationOptions } from "@tanstack/react-query";
import { useConfirm, type ConfirmOptions } from "@/components/ConfirmDialogProvider";

type ConfirmedMutationOptions<TData, TVariables> = UseMutationOptions<TData, Error, TVariables> & {
  title: string | ((variables: TVariables) => string);
  description: string | ((variables: TVariables) => string);
  confirmLabel?: string;
  variant?: ConfirmOptions["variant"];
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
  const { title, description, confirmLabel, variant, ...mutationOptions } = options;
  const { mutate: _mutate, mutateAsync: _mutateAsync, ...rest } = useMutation(mutationOptions);

  const confirmedMutate = useCallback(
    (variables: TVariables) => {
      void (async () => {
        const ok = await confirm({
          title: typeof title === "function" ? title(variables) : title,
          description: typeof description === "function" ? description(variables) : description,
          confirmLabel,
          variant,
        });
        if (ok) {
          _mutate(variables);
        }
      })();
    },
    [confirm, title, description, confirmLabel, variant, _mutate],
  );

  return { ...rest, confirmedMutate };
}
