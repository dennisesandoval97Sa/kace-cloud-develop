import { BaseService } from './baseService';
import { applyGlobalConfigToStore } from '#plugins/kace/utils/applyGlobalConfigToStore.js';
import { configSignature } from '#plugins/kace/utils/configSignature.js';
import { getOnescriptCacheTtlMs } from '#plugins/kace/utils/getOnescriptCacheTtlMs.js';
import { KaceHttpCache } from '#plugins/kace/utils/kaceHttpCache.js';
import {
  readSignature,
  writeTtl,
} from '#plugins/kace/utils/kaceCacheTtlStore.js';
import { SessionStorageCache } from '#plugins/kace/services/sessionStorageCache.js';

export class ConfigurationService extends BaseService {
  constructor({ apiService, userService, store, emitEvent }) {
    super({ store });
    this.api = apiService;
    this.userService = userService;
    this.emitEvent = emitEvent;
  }

  async fetchGlobalConfig(args = {}) {
    await this.userService.get('user.user_data');
    const configId = this.storeService.get('configuration_id_selected_group');
    const response = await this.api.get(`/global-configuration/${configId}`);
    if (response.status === 200 && response.data) {
      const settings = response.data.data.settings;
      const newSignature = configSignature(settings);

      const oldSignature = readSignature();
      if (oldSignature !== newSignature) {
        KaceHttpCache.clear();
        SessionStorageCache.invalidate('auth-cognito', 'default');
      }

      applyGlobalConfigToStore(this.storeService, settings);

      const ttl = getOnescriptCacheTtlMs(this.storeService);
      writeTtl(ttl, newSignature);

      if (this.emitEvent) {
        this.emitEvent('kaceAttachmentsLoading', false);
      }
      return settings;
    }

    throw new Error('Error al obtener los datos de configuración global');
  }
}
