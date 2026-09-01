import { useEffect, useState } from "react";
import { listActionsForOrder } from "./queue";
import type { PendingAction } from "./db";

// idb'de yerleşik bir reaktivite yok — bu ölçekte (tek partner, birkaç kayıt)
// basit polling yeterli ve basit; bir "canlı sorgu" katmanı kurmak bu
// ADIM'ın kapsamına göre gereksiz karmaşıklık olurdu.
const POLL_MS = 1000;

export function useOrderActions(orderId: string | undefined): PendingAction[] {
  const [actions, setActions] = useState<PendingAction[]>([]);

  useEffect(() => {
    if (!orderId) return;
    let cancelled = false;
    async function tick() {
      const items = await listActionsForOrder(orderId!);
      if (!cancelled) setActions(items);
    }
    void tick();
    const interval = setInterval(() => void tick(), POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [orderId]);

  return actions;
}
