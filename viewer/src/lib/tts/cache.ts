type CacheRecord = {
  key: string;
  blob: Blob;
  size: number;
  createdAt: number;
  lastAccessed: number;
};

const DB_NAME = 'tts-audio-cache';
const STORE_NAME = 'audio';

const openDatabase = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'));
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        store.createIndex('lastAccessed', 'lastAccessed', { unique: false });
      }
    };
  });
};

const sha256Hex = async (value: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(value);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const bytes = Array.from(new Uint8Array(hashBuffer));
  return bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
};

export const buildAudioCacheKey = async (provider: string, voiceId: string, text: string): Promise<string> => {
  const hash = await sha256Hex(text);
  return `${provider}:${voiceId}:${hash}`;
};

export class AudioCache {
  private readonly maxBytes: number;

  constructor(maxBytes = 100 * 1024 * 1024) {
    this.maxBytes = maxBytes;
  }

  async get(key: string): Promise<Blob | null> {
    const db = await openDatabase();
    try {
      const record = await this.getRecord(db, key);
      if (!record) {
        return null;
      }
      await this.updateLastAccessed(db, key);
      return record.blob;
    } finally {
      db.close();
    }
  }

  async set(key: string, blob: Blob): Promise<void> {
    const db = await openDatabase();
    try {
      const now = Date.now();
      const record: CacheRecord = {
        key,
        blob,
        size: blob.size,
        createdAt: now,
        lastAccessed: now,
      };

      await this.putRecord(db, record);
      await this.evictIfNeeded(db);
    } finally {
      db.close();
    }
  }

  async clear(): Promise<void> {
    const db = await openDatabase();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.onerror = () => reject(tx.error ?? new Error('Failed to clear cache'));
        tx.oncomplete = () => resolve();
        tx.objectStore(STORE_NAME).clear();
      });
    } finally {
      db.close();
    }
  }

  async getSizeBytes(): Promise<number> {
    const db = await openDatabase();
    try {
      const records = await this.getAllRecords(db);
      return records.reduce((sum, record) => sum + record.size, 0);
    } finally {
      db.close();
    }
  }

  private async getRecord(db: IDBDatabase, key: string): Promise<CacheRecord | null> {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).get(key);
      request.onerror = () => reject(request.error ?? new Error('Failed to read cache record'));
      request.onsuccess = () => resolve((request.result as CacheRecord | undefined) ?? null);
    });
  }

  private async putRecord(db: IDBDatabase, record: CacheRecord): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.onerror = () => reject(tx.error ?? new Error('Failed to write cache record'));
      tx.oncomplete = () => resolve();
      tx.objectStore(STORE_NAME).put(record);
    });
  }

  private async updateLastAccessed(db: IDBDatabase, key: string): Promise<void> {
    const existing = await this.getRecord(db, key);
    if (!existing) {
      return;
    }
    const updated: CacheRecord = { ...existing, lastAccessed: Date.now() };
    await this.putRecord(db, updated);
  }

  private async getAllRecords(db: IDBDatabase): Promise<CacheRecord[]> {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).getAll();
      request.onerror = () => reject(request.error ?? new Error('Failed to read cache records'));
      request.onsuccess = () => resolve((request.result as CacheRecord[]) ?? []);
    });
  }

  private async deleteRecord(db: IDBDatabase, key: string): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.onerror = () => reject(tx.error ?? new Error('Failed to delete cache record'));
      tx.oncomplete = () => resolve();
      tx.objectStore(STORE_NAME).delete(key);
    });
  }

  private async evictIfNeeded(db: IDBDatabase): Promise<void> {
    const records = await this.getAllRecords(db);
    let total = records.reduce((sum, record) => sum + record.size, 0);
    if (total <= this.maxBytes) {
      return;
    }

    const sorted = [...records].sort((a, b) => a.lastAccessed - b.lastAccessed);
    for (const record of sorted) {
      await this.deleteRecord(db, record.key);
      total -= record.size;
      if (total <= this.maxBytes) {
        break;
      }
    }
  }
}
