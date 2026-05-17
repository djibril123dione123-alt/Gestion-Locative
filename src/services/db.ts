/**
 * Tiny IndexedDB wrapper — no external library needed.
 * Used by localBackup and offlineQueue services.
 */

const DB_NAME = 'samay-keur-local';
const DB_VERSION = 1;

export interface DBSchema {
  snapshots: {
    key: string;
    value: { id: string; data: unknown[]; timestamp: number };
  };
  pending_mutations: {
    key: number;
    value: {
      id?: number;
      action: string;
      entity_type: string;
      payload: Record<string, unknown>;
      timestamp: number;
      created_at?: number;
      updated_at?: number;
      client_mutation_id?: string;
      mutation_key?: string;
      last_attempt_at?: number;
      next_retry_at?: number;
      status: 'pending' | 'syncing' | 'done' | 'error';
      retries?: number;
      error?: string;
    };
  };
}

let _db: IDBDatabase | null = null;

export function openDB(): Promise<IDBDatabase> {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('snapshots')) {
        db.createObjectStore('snapshots', { keyPath: 'id' });
      }
      let pendingStore: IDBObjectStore | null = null;
      if (!db.objectStoreNames.contains('pending_mutations')) {
        pendingStore = db.createObjectStore('pending_mutations', {
          keyPath: 'id',
          autoIncrement: true,
        });
      } else {
        pendingStore = (e.target as IDBOpenDBRequest).transaction?.objectStore('pending_mutations') ?? null;
      }
      if (pendingStore) {
        if (!pendingStore.indexNames.contains('status')) {
          pendingStore.createIndex('status', 'status', { unique: false });
        }
        if (!pendingStore.indexNames.contains('mutation_key')) {
          pendingStore.createIndex('mutation_key', 'mutation_key', { unique: false });
        }
        if (!pendingStore.indexNames.contains('next_retry_at')) {
          pendingStore.createIndex('next_retry_at', 'next_retry_at', { unique: false });
        }
      }
    };
    req.onsuccess = (e) => {
      _db = (e.target as IDBOpenDBRequest).result;
      _db.onversionchange = () => {
        _db?.close();
        _db = null;
      };
      resolve(_db!);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function dbPut<S extends keyof DBSchema>(
  storeName: S,
  value: DBSchema[S]['value'],
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName as string, 'readwrite');
    const req = tx.objectStore(storeName as string).put(value);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function dbGet<S extends keyof DBSchema>(
  storeName: S,
  key: DBSchema[S]['key'],
): Promise<DBSchema[S]['value'] | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName as string, 'readonly');
    const req = tx.objectStore(storeName as string).get(key as IDBValidKey);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function dbGetAll<S extends keyof DBSchema>(
  storeName: S,
): Promise<DBSchema[S]['value'][]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName as string, 'readonly');
    const req = tx.objectStore(storeName as string).getAll();
    req.onsuccess = () => resolve(req.result ?? []);
    req.onerror = () => reject(req.error);
  });
}

export async function dbDelete<S extends keyof DBSchema>(
  storeName: S,
  key: DBSchema[S]['key'],
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName as string, 'readwrite');
    const req = tx.objectStore(storeName as string).delete(key as IDBValidKey);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function dbClear<S extends keyof DBSchema>(storeName: S): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName as string, 'readwrite');
    const req = tx.objectStore(storeName as string).clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function dbGetByIndex<S extends keyof DBSchema>(
  storeName: S,
  indexName: string,
  value: IDBValidKey,
): Promise<DBSchema[S]['value'][]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName as string, 'readonly');
    const idx = tx.objectStore(storeName as string).index(indexName);
    const req = idx.getAll(value);
    req.onsuccess = () => resolve(req.result ?? []);
    req.onerror = () => reject(req.error);
  });
}
