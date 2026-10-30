import { BaseService } from './baseService';
import {
  KaceHttpCache,
  buildKaceHttpCacheKey,
} from '#plugins/kace/utils/kaceHttpCache.js';
import { getOnescriptCacheTtlMs } from '#plugins/kace/utils/getOnescriptCacheTtlMs.js';

const SCHEMAS_RULES_SEARCH_PATH = '/schemas/rules/search';

export class SchemaService extends BaseService {
  constructor({ apiService, store }) {
    super({ store });
    this.api = apiService;
  }

  async fetchSchema(args = {}) {
    const schemaId = args.schemaId;
    if (!schemaId) throw new Error('No schemaId provided');
    const res = await this.api.get(`/schemas/${schemaId}`);
    if (!res.ok) throw new Error('Failed to fetch schema');
    return res.json();
  }

  async fetchRulesSearch(args = {}) {
    const body = args.body ?? {};
    const tenantId = this.storeService.get('auth.tenant_id') ?? 'default';
    const cacheKey = buildKaceHttpCacheKey(
      tenantId,
      'POST',
      SCHEMAS_RULES_SEARCH_PATH,
      null,
      body
    );

    if (args.forceRefresh) {
      KaceHttpCache.clear();
      const res = await this.api.post(
        SCHEMAS_RULES_SEARCH_PATH,
        body,
        args.config ?? {}
      );
      return res.data;
    }

    const ttlMs = getOnescriptCacheTtlMs(this.storeService);
    if (ttlMs <= 0) {
      const res = await this.api.post(
        SCHEMAS_RULES_SEARCH_PATH,
        body,
        args.config ?? {}
      );
      return res.data;
    }

    const hit = KaceHttpCache.get(cacheKey);
    if (hit) return hit.data;

    const res = await this.api.post(
      SCHEMAS_RULES_SEARCH_PATH,
      body,
      args.config ?? {}
    );
    if (res && res.status >= 200 && res.status < 300) {
      KaceHttpCache.set(cacheKey, res, ttlMs);
    }
    return res.data;
  }
}
