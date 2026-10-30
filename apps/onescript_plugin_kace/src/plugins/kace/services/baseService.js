import { storeService } from './storeService';

export class BaseService {
  /**
   * @param {Object} params
   * @param {any} params.store
   */
  constructor({ store }) {
    this.storeService = storeService;
  }

  /**
   * Magic dynamic getter: get('propName', args)
   * Attempts to read from store, otherwise calls fetchPropName(args) if available.
   * @param {string} prop
   * @param {Object} [args={}]
   * @returns {Promise<any>}
   */
  async get(prop, args = {}) {
    let value = this.storeService.get(prop);
    if (value !== undefined && value !== null) {
      return value;
    }

    const normalize = (s = '') => String(s).replace(/[_-]/g, '').toLowerCase();
    const target = normalize(prop.split('.').pop());

    const findPath = (obj, currentPath = []) => {
      if (!obj || typeof obj !== 'object') return null;
      for (const key of Object.keys(obj)) {
        const nextPath = [...currentPath, key];
        if (normalize(key) === target) return nextPath;
        const child = obj[key];
        if (child && typeof child === 'object') {
          const found = findPath(child, nextPath);
          if (found) return found;
        }
      }
      return null;
    };

    const canonicalPath = findPath(this.storeService.store, []);
    if (canonicalPath) {
      const canonicalKey = canonicalPath.join('.');
      value = this.storeService.get(canonicalKey);
      if (value !== undefined && value !== null) return value;
    }

    const lastSegment = prop.split('.').pop();
    const parts = lastSegment.split(/[_-]/).filter(Boolean);
    const capitalized = parts
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join('');
    const fetcherName = `fetch${capitalized}`;

    if (typeof this[fetcherName] === 'function') {
      const fetchedValue = await this[fetcherName](args);
      this.storeService.set(prop, fetchedValue);
      if (canonicalPath) {
        const canonicalKey = canonicalPath.join('.');
        this.storeService.set(canonicalKey, fetchedValue);
      }
      return fetchedValue;
    }

    throw new Error(
      `No se encontró ningún buscador para la propiedad '${lastSegment}' y no esta en el store.`
    );
  }
}
