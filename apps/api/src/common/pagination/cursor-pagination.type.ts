// spec §5.1: "Tüm liste endpointleri cursor-based pagination kullanır
// (limit/offset yerine) — büyük veri setlerinde tutarlılık için."
export type CursorPage<T> = {
  items: T[];
  nextCursor: string | null;
};

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
