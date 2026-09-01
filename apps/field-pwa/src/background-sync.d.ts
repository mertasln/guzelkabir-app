// Background Sync API — deliberately not part of TypeScript's built-in DOM/
// WebWorker lib (still non-standard/Chromium-only). Minimal ambient
// declarations for the subset used in sw.ts/lib/queue.ts.
interface SyncManager {
  register(tag: string): Promise<void>;
  getTags(): Promise<string[]>;
}

interface ServiceWorkerRegistration {
  readonly sync: SyncManager;
}

interface SyncEvent extends ExtendableEvent {
  readonly tag: string;
  readonly lastChance: boolean;
}

interface ServiceWorkerGlobalScopeEventMap {
  sync: SyncEvent;
}
