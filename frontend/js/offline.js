// Offline Support
//
// Scope (deliberately limited - see note in showOfflineBanner):
//  - Products/categories are cached to IndexedDB on every successful load so
//    the POS screen still has something to sell from with no connection.
//  - CASH sales made while offline are queued locally and synced
//    automatically the moment the browser comes back online.
//  - M-Pesa, PayHero, and manual-till payments all need a live network round
//    trip (STK push, or a cashier reading an SMS that only arrives with
//    signal) - those stay disabled while offline rather than pretending to
//    queue something that can't actually be confirmed offline.
//  - Stock shown while offline is the last-synced count minus whatever this
//    device has sold offline since - it's a local estimate, not an atomic
//    reservation. The authoritative deduction happens server-side once each
//    queued sale syncs, exactly like `deduct_stock_atomically` does online.
//    If two offline terminals sell the last unit of the same product before
//    either syncs, the second sync can push stock negative - same risk any
//    offline-first POS carries; this makes it visible via a stock warning
//    rather than losing the sale.

const OfflineStore = {
  DB_NAME: 'pos_offline_db',
  DB_VERSION: 1,
  db: null,

  async init() {
    if (this.db) return this.db;

    this.db = await new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('products')) {
          db.createObjectStore('products', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('categories')) {
          db.createObjectStore('categories', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains('pending_sales')) {
          const store = db.createObjectStore('pending_sales', { keyPath: 'local_id' });
          store.createIndex('status', 'status');
        }
      };

      request.onsuccess = (event) => resolve(event.target.result);
      request.onerror = () => reject(request.error);
    });

    return this.db;
  },

  async tx(storeName, mode) {
    const db = await this.init();
    return db.transaction(storeName, mode).objectStore(storeName);
  },

  async cacheProducts(products) {
    const db = await this.init();
    const tx = db.transaction('products', 'readwrite');
    const store = tx.objectStore('products');
    await new Promise((resolve, reject) => {
      const clearReq = store.clear();
      clearReq.onsuccess = () => resolve();
      clearReq.onerror = () => reject(clearReq.error);
    });
    for (const p of products) {
      store.put(p);
    }
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });

    const metaStore = await this.tx('meta', 'readwrite');
    metaStore.put({ key: 'products_cached_at', value: new Date().toISOString() });
  },

  async getCachedProducts() {
    const store = await this.tx('products', 'readonly');
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  },

  async cacheCategories(categories) {
    const db = await this.init();
    const tx = db.transaction('categories', 'readwrite');
    const store = tx.objectStore('categories');
    await new Promise((resolve, reject) => {
      const clearReq = store.clear();
      clearReq.onsuccess = () => resolve();
      clearReq.onerror = () => reject(clearReq.error);
    });
    for (const c of categories) {
      store.put(c);
    }
    return new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  },

  async getCachedCategories() {
    const store = await this.tx('categories', 'readonly');
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  },

  // Applies a locally-sold quantity so the cached stock reflects offline
  // sales until the next successful online product reload replaces it.
  async decrementCachedStock(productId, quantity) {
    const db = await this.init();
    const tx = db.transaction('products', 'readwrite');
    const store = tx.objectStore('products');
    const product = await new Promise((resolve, reject) => {
      const req = store.get(productId);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    if (product) {
      product.stock_quantity = Math.max(0, (product.stock_quantity || 0) - quantity);
      store.put(product);
    }
    return new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  },

  async queueSale(saleData) {
    const localId = `offline-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const record = {
      local_id: localId,
      local_receipt_number: `OFFLINE-${localId.slice(-10).toUpperCase()}`,
      status: 'pending',
      created_at: new Date().toISOString(),
      payload: saleData
    };

    const store = await this.tx('pending_sales', 'readwrite');
    await new Promise((resolve, reject) => {
      const req = store.add(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });

    for (const item of saleData.items) {
      await this.decrementCachedStock(item.product_id, item.quantity);
    }

    return record;
  },

  async getPendingSales() {
    const store = await this.tx('pending_sales', 'readonly');
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result || []).filter(s => s.status === 'pending'));
      req.onerror = () => reject(req.error);
    });
  },

  async markSaleSynced(localId) {
    const store = await this.tx('pending_sales', 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.delete(localId);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },

  // Prevents two overlapping sync passes (e.g. the 'online' event and a
  // manual "Sync now" click firing close together) from posting the same
  // queued sale twice.
  async markSaleSyncing(localId) {
    const store = await this.tx('pending_sales', 'readwrite');
    const record = await new Promise((resolve, reject) => {
      const req = store.get(localId);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    if (!record || record.status === 'syncing') return false;
    record.status = 'syncing';
    store.put(record);
    return true;
  },

  async unmarkSaleSyncing(localId) {
    const store = await this.tx('pending_sales', 'readwrite');
    const record = await new Promise((resolve, reject) => {
      const req = store.get(localId);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    if (record) {
      record.status = 'pending';
      store.put(record);
    }
  }
};

const OfflineSync = {
  syncing: false,
  listeners: [],

  onStatusChange(fn) {
    this.listeners.push(fn);
  },

  notify() {
    this.listeners.forEach(fn => fn());
  },

  isOnline() {
    return navigator.onLine;
  },

  init() {
    window.addEventListener('online', () => {
      this.notify();
      this.syncPendingSales();
    });
    window.addEventListener('offline', () => {
      this.notify();
    });

    // Catch sales that were queued in a previous session and never synced
    // (e.g. tab closed before connectivity returned).
    if (this.isOnline()) {
      this.syncPendingSales();
    }
  },

  async getPendingCount() {
    const pending = await OfflineStore.getPendingSales();
    return pending.length;
  },

  async syncPendingSales() {
    if (this.syncing || !this.isOnline()) return;
    this.syncing = true;
    this.notify();

    try {
      const pending = await OfflineStore.getPendingSales();

      for (const sale of pending) {
        const gotLock = await OfflineStore.markSaleSyncing(sale.local_id);
        if (!gotLock) continue;

        try {
          const response = await Api.post(API.SALES, sale.payload);
          if (response.success) {
            await OfflineStore.markSaleSynced(sale.local_id);
          } else {
            await OfflineStore.unmarkSaleSyncing(sale.local_id);
          }
        } catch (err) {
          console.error('Failed to sync offline sale:', err);
          await OfflineStore.unmarkSaleSyncing(sale.local_id);
          // Stop on first failure (likely means we're not really online yet,
          // e.g. flaky connection) rather than hammering the API for every
          // queued sale.
          break;
        }
      }
    } finally {
      this.syncing = false;
      this.notify();
    }
  }
};

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.error('Service worker registration failed:', err);
    });
  });
}

OfflineSync.init();
