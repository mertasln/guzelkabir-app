import { openDB, type DBSchema, type IDBPDatabase } from "idb";

// spec §12.2: "Service Worker (Workbox) ile görev listesi ve form durumu
// IndexedDB'de cache'lenir" + "Fotoğraflar önce cihazda (IndexedDB/Blob)
// saklanır". Tek bir birleşik kuyruk (start/evidence/complete) — kullanıcı
// onaylı karar (ADIM 8b planı): yalnızca fotoğrafları özel durum yapmak,
// "Başla"/"Tamamla"yı online-only bırakırdı, ki saha partneri akışın HERHANGİ
// bir adımında sinyal kaybedebilir.
export type ActionType = "start" | "evidence" | "complete";

export type EvidencePayload = {
  photoType: "wide_shot" | "detail_shot";
  blob: Blob;
  fieldNote?: string;
};

export type PendingAction = {
  id: string; // client-generated, sabit — Idempotency-Key olarak da kullanılır (bkz. queue.ts)
  orderId: string;
  type: ActionType;
  payload?: EvidencePayload;
  status: "pending" | "syncing" | "synced" | "failed";
  error?: string;
  createdAt: number;
  // Sıralama garantisi için (aynı orderId içinde start → evidence → evidence
  // → complete sırası bozulmamalı): monoton artan bir sequence.
  seq: number;
};

interface FieldPwaDB extends DBSchema {
  pendingActions: {
    key: string;
    value: PendingAction;
    indexes: { "by-status": string; "by-order": string };
  };
}

let dbPromise: Promise<IDBPDatabase<FieldPwaDB>> | null = null;

export function getDb(): Promise<IDBPDatabase<FieldPwaDB>> {
  if (!dbPromise) {
    dbPromise = openDB<FieldPwaDB>("gk-field-pwa", 1, {
      upgrade(db) {
        const store = db.createObjectStore("pendingActions", { keyPath: "id" });
        store.createIndex("by-status", "status");
        store.createIndex("by-order", "orderId");
      },
    });
  }
  return dbPromise;
}
