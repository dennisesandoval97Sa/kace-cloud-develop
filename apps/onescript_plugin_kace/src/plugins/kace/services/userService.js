import { BaseService } from './baseService';
import { getTokenUserId } from '#plugins/kace/utils/getTokenUserId.js';
import {
  getKaceSessionTokensBundle,
  SessionStorageCache,
} from './sessionStorageCache.js';
import { getOnescriptCacheTtlMs } from '#plugins/kace/utils/getOnescriptCacheTtlMs.js';

export class UserService extends BaseService {
  /**
   * @param {Object} params
   * @param {import('./apiService').ApiService} params.apiService
   * @param {any} params.store
   */
  constructor({ apiService, store }) {
    super({ store });
    this.api = apiService;
  }

  /**
   * Fetches and stores authenticated user data.
   * Used by BaseService.get('user.user_data') via fetcher naming.
   * @param {Object} [args={}]
   * @param {string} [args.access_token]
   * @param {number} [args.expires_in]
   * @param {string} [args.id_token]
   * @param {string} [args.refresh_token]
   * @param {string} [args.token_type]
   * @returns {Promise<any>}
   */
  async fetchUserData(args = {}) {
    const getSessionValue = (key) => {
      try {
        if (typeof sessionStorage === 'undefined') return null;
        const bundledTokens = getKaceSessionTokensBundle();
        if (
          bundledTokens &&
          typeof bundledTokens === 'object' &&
          bundledTokens[key] != null
        ) {
          return String(bundledTokens[key]);
        }
        return sessionStorage.getItem(key);
      } catch (_) {
        return null;
      }
    };
    const applyUserDataSideEffects = (userData) => {
      if (!userData) return;
      this.storeService.set('user.user_data', userData);
      this.storeService.set('user.user_id', userData?.user?.id ?? null);
      this.storeService.set(
        'config.selected_group_id',
        userData?.user?.grupo_activo ?? null
      );
      const group = userData?.groups?.find(
        (g) => g.id === userData?.user?.grupo_activo
      );
      this.storeService.set(
        'configuration_id_selected_group',
        group?.configuration_id ?? null
      );
    };
    try {
      if (
        this.api &&
        this.api.authService &&
        !args.access_token &&
        !this.storeService.get('auth.access_token')
      ) {
        await this.api.authService.validateToken();
      }
    } catch (e) {
      //ignore
    }

    const access_token =
      args.access_token ??
      getSessionValue('auth.access_token') ??
      (this.api && this.api.authService
        ? this.api.authService.accessToken
        : null) ??
      this.storeService.get('auth.access_token') ??
      this.storeService.get('auth.token') ??
      '';
    const expires_in =
      args.expires_in ??
      getSessionValue('auth.expires_in') ??
      (this.api && this.api.authService
        ? this.api.authService.expiresIn
        : null) ??
      this.storeService.get('auth.expires_in') ??
      null;
    const id_token =
      args.id_token ??
      getSessionValue('auth.id_token') ??
      (this.api && this.api.authService
        ? this.api.authService.idToken
        : null) ??
      this.storeService.get('auth.id_token') ??
      '';
    const refresh_token =
      args.refresh_token ??
      getSessionValue('auth.refresh_token') ??
      (this.api && this.api.authService
        ? this.api.authService.refreshToken
        : null) ??
      this.storeService.get('auth.refresh_token') ??
      '';
    const token_type =
      args.token_type ??
      getSessionValue('auth.token_type') ??
      (this.api && this.api.authService
        ? this.api.authService.tokenType
        : null) ??
      this.storeService.get('auth.token_type') ??
      'Bearer';
    const tokenUserId = getTokenUserId(id_token);

    const cachedAuthCognitoResponse = await SessionStorageCache.get(
      'auth-cognito',
      'default',
      null,
      0
    );
    const cachedTokenUserId = cachedAuthCognitoResponse?.tokenUserId ?? null;
    const cachedUserData = cachedAuthCognitoResponse?.data ?? null;
    const userIdChanged =
      Boolean(cachedTokenUserId) &&
      Boolean(tokenUserId) &&
      String(cachedTokenUserId) !== String(tokenUserId);

    if (cachedUserData && !userIdChanged) {
      applyUserDataSideEffects(cachedUserData);
      return cachedUserData;
    }

    const response = await this.api.post('/auth-cognito', {
      access_token,
      expires_in,
      id_token,
      refresh_token,
      token_type,
    });
    if (response.status === 200 && response.data) {
      const userData = response.data.data;
      applyUserDataSideEffects(userData);
      const ttlMs = getOnescriptCacheTtlMs(this.storeService);
      if (ttlMs > 0) {
        SessionStorageCache.set(
          'auth-cognito',
          'default',
          {
            ...response.data,
            tokenUserId,
            userId: userData?.user?.id ?? null,
            data: userData,
          },
          ttlMs
        );
      }
      return userData;
    }
    throw new Error('No se pudieron obtener los datos del usuario');
  }

  /**
   * Computes and stores the configuration id for the currently selected group.
   * @param {Object} [args={}]
   * @returns {Promise<any>}
   */
  async fetchConfigurationIdSelectedGroup(args = {}) {
    let userData = this.storeService.get('auth.user_data');
    if (!userData && args) {
      userData = await this.get('userData', args);
    }
    const groupId =
      this.storeService.get('config.selected_group_id') ??
      userData?.user?.grupo_activo;
    const group = userData?.groups?.find((g) => g.id === groupId);
    const configId = group?.configuration_id ?? null;
    this.storeService.set('configuration_id_selected_group', configId);
    return configId;
  }

  /**
   * Computes and stores the selected group id.
   * @param {Object} [args={}]
   * @returns {Promise<any>}
   */
  async fetchSelectedGroupId(args = {}) {
    let userData = this.storeService.get('auth.user_data');
    if (!userData && args) {
      userData = await this.get('userData', args);
    }
    const groupId = userData?.user?.grupo_activo ?? null;
    this.storeService.set('config.selected_group_id', groupId);
    return groupId;
  }

  /**
   * Synchronous check aligned with legacy `KaceData._userCanEditCase()` (used by hooks/UI).
   * Reads `user.user_data` from the store (same payload as after `fetchUserData`).
   *
   * @returns {boolean}
   */
  canEditCaseSync() {
    const caseData = this.storeService.get('cases.case_data');
    const userData =
      this.storeService.get('user.user_data') ??
      this.storeService.get('auth.user_data');
    if (caseData && userData) {
      const caseDesignatedUserId = caseData?.responsable_id;
      const userId = userData?.user?.id;
      const hasPermission =
        userData?.permisions?.administrador?.filter(
          (item) => item.name === 'CaseUpdateNotOwner'
        ) ?? [];
      return (
        caseDesignatedUserId === userId ||
        (hasPermission.length > 0 && hasPermission[0].granted) ||
        false
      );
    }
    return true;
  }

  /**
   * Checks whether the current user has permission to edit the current case.
   * @returns {Promise<boolean>}
   */
  async userCanEditCase() {
    const caseData = this.storeService.get('cases.case_data');
    const userData =
      this.storeService.get('user.user_data') ??
      this.storeService.get('auth.user_data');
    if (!caseData) return;
    if (!userData) return false;
    if (caseData && userData) {
      const caseDesignatedUserId = caseData?.responsable_id;
      const userId = userData?.user?.id;
      const hasPermission = userData?.permisions?.administrador?.filter(
        (item) => item.name === 'CaseUpdateNotOwner'
      );
      return (
        caseDesignatedUserId === userId ||
        (hasPermission?.length > 0 && hasPermission[0].granted) ||
        false
      );
    }
    return false;
  }

  /**
   * Searches for users in the database.
   * @param {Object} [args={}]
   * @param {string} [storeKey='users.search_users_data']
   * @returns {Promise<any[]>} The users data or an empty array if the request fails
   */
  async searchUsers(args = {}, storeKey = null) {
    try {
      let usersData = storeKey ? this.storeService.get(storeKey) : null;

      if (!usersData) {
        const response = await this.api.post('/users/search', args);
        if (response.status === 200 && response.data) {
          if (storeKey) {
            this.storeService.set(storeKey, response.data.data.items);
          }
          return response.data.data.items;
        }
      }

      return usersData || [];
    } catch (error) {
      throw new Error(
        `Error al obtener los datos de los usuarios: ${error.message}`
      );
    }
  }
}
