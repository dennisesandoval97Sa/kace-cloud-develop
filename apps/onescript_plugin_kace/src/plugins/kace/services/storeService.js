import { kaceStore } from '../shared/kaceStore';
import kace_data from '#plugins/kace/shared/KaceData.js';
import { STORE_TO_LEGACY_MAP } from '#plugins/kace/data/constants.js';

class StoreService {
  /**
   * @param {Object} [store=kaceStore]
   */
  constructor(store = kaceStore) {
    if (typeof globalThis !== 'undefined') {
      if (!globalThis.__KACE_ENGINE_SHARED_STORE) {
        globalThis.__KACE_ENGINE_SHARED_STORE = { ...store };
      }
      this.store = globalThis.__KACE_ENGINE_SHARED_STORE;
    } else {
      this.store = store;
    }

    if (typeof globalThis !== 'undefined') {
      globalThis.__KACE_ENGINE_SHARED_STORE = this.store;
    }
  }

  /**
   * Loads persisted store data from localStorage (if present) into the in-memory store.
   * @returns {void}
   */
  initializeStore() {
    const lsData = localStorage.getItem('kace_engine_data');
    if (lsData) {
      try {
        const parsedData = JSON.parse(lsData);
        this.store = { ...this.store, ...parsedData };
        if (typeof globalThis !== 'undefined')
          globalThis.__KACE_ENGINE_SHARED_STORE = this.store;
        this.syncToLegacy();
        return;
      } catch (e) {
        // ignore
      }
    }
  }

  /**
   * Gets a value by dot-path from the store.
   * @param {string} path
   * @returns {any}
   */
  get(path) {
    const keys = path.split('.');
    let ref = this.store;
    for (const key of keys) {
      if (ref == null || !(key in ref)) return undefined;
      ref = ref[key];
    }
    return ref;
  }

  /**
   * Sets a value by dot-path in the store and persists to localStorage.
   * @param {string} path
   * @param {any} value
   * @returns {void}
   */
  set(path, value) {
    const keys = path.split('.');
    let ref = this.store;
    for (let i = 0; i < keys.length - 1; i++) {
      if (
        !(keys[i] in ref) ||
        typeof ref[keys[i]] !== 'object' ||
        ref[keys[i]] === null
      ) {
        ref[keys[i]] = {};
      }
      ref = ref[keys[i]];
    }
    ref[keys[keys.length - 1]] = value;
    this.syncKeyToLegacy(path);
    try {
      const ts = new Date().toISOString();
      const summary = (() => {
        try {
          return JSON.stringify(this.store);
        } catch (e) {
          return String(this.store);
        }
      })();
      const stack = new Error().stack;
      if (typeof globalThis !== 'undefined')
        globalThis.__KACE_ENGINE_SHARED_STORE = this.store;
      localStorage.setItem('kace_engine_data', summary);
    } catch (e) {
      /* ignore */
    }
  }

  /**
   * Clears the in-memory store and removes persisted data.
   * @returns {void}
   */
  clear() {
    this.store = { ...kaceStore };
    this.syncToLegacy();
    if (typeof globalThis !== 'undefined') {
      globalThis.__KACE_ENGINE_SHARED_STORE = this.store;
    }
    try {
      localStorage.removeItem('kace_engine_data');
    } catch (e) {
      /* ignore */
    }
  }

  /**
   * Synchronizes all mapped keys from store into legacy KaceData.
   * @returns {void}
   */
  syncToLegacy() {
    try {
      Object.entries(STORE_TO_LEGACY_MAP).forEach(
        ([storePath, legacyProperty]) => {
          const value = this.get(storePath);
          kace_data[legacyProperty] = value;
        }
      );
    } catch (error) {
      console.error('Error syncing store to legacy KaceData', error);
    }
  }

  /**
   * Synchronizes one mapped store key into legacy KaceData.
   * @param {string} path
   * @returns {void}
   */
  syncKeyToLegacy(path) {
    try {
      const legacyProperty = STORE_TO_LEGACY_MAP[path];
      if (!legacyProperty) return;
      kace_data[legacyProperty] = this.get(path);
    } catch (error) {
      console.error(`Error syncing key "${path}" to legacy KaceData`, error);
    }
  }
}

const storeService = new StoreService(kaceStore);
export { StoreService, storeService };
