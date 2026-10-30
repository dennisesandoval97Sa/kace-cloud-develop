import axios from 'axios';
import { applyKaceHttpMocks } from '#plugins/kace/mocks/kaceHttpMocks.js';
import { AuthService } from './authService';
import { runInFlight } from '#plugins/kace/utils/runInFlight.js';
import { ENABLE_KACE_ENGINE_REQUEST_LOG } from '#plugins/kace/env/index.js';
import {
  buildKaceResponseCacheKey,
  isKaceDefaultPostCacheableUrl,
  isKaceNeverCacheableGetUrl,
  kaceResponseCacheGet,
  kaceResponseCacheSet,
  kaceResponseCacheableStatus,
} from '#plugins/kace/utils/kaceResponseCache.js';
import { getOnescriptCacheTtlMs } from '#plugins/kace/utils/getOnescriptCacheTtlMs.js';

const KACE_ENGINE_REQUEST_LOG_IDENTIFIER = '[KaceEngine][ApiService]';

export class ApiService {
  /**
   * @param {Object} params
   * @param {string} params.apiUrl
   * @param {string} params.fingerprint
   * @param {string} params.tenantId
   * @param {AuthService} params.authService
   * @param {number} [params.maxRetries=1]
   * @param {number} [params.retryDelayMs=400]
   */
  constructor({
    apiUrl,
    fingerprint,
    tenantId,
    authService,
    storeService,
    maxRetries = 1,
    retryDelayMs = 400,
  }) {
    this.apiUrl = apiUrl;
    this.fingerprint = fingerprint;
    this.tenantId = tenantId;
    this.authService = authService;
    this.storeService = storeService;
    this.maxRetries = maxRetries;
    this.retryDelayMs = retryDelayMs;

    this.api = axios.create({
      baseURL: this.apiUrl,
      timeout: 40000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.api.interceptors.request.use(async (config) => {
      if (config?.kace_request === false) return config;

      if (ENABLE_KACE_ENGINE_REQUEST_LOG) {
        const method = (config?.method || 'GET').toUpperCase();
        const endpoint = config?.url || '';
        console.info(
          `${KACE_ENGINE_REQUEST_LOG_IDENTIFIER} ${method} ${endpoint}`
        );
      }

      if (this.authService) {
        await this.authService.validateToken();
        const token =
          this.authService.getSessionToken('auth.id_token') ||
          this.authService.getSessionToken('auth.access_token') ||
          this.authService.idToken ||
          this.authService.accessToken;
        if (token) {
          config.headers.Authorization = `${token}`;
        }
      }

      config.headers['X-Client-Fingerprint'] = this.fingerprint;
      config.headers['X-Tenant-ID'] = this.tenantId;

      return config;
    });

    this.api.interceptors.response.use(
      (response) => response,
      async (error) => {
        const config = error?.config;
        if (!config) return Promise.reject(error);

        config.__kaceRetryCount = config.__kaceRetryCount || 0;

        const status = error?.response?.status;
        const isNetworkError = !error?.response;
        const isTransientServerError = status >= 500 && status <= 599;
        const isAuthError = status === 401;

        if (isAuthError && !config.__kaceDidAuthRefresh && this.authService) {
          config.__kaceDidAuthRefresh = true;
          try {
            await this.authService.refreshTokenFlow();
            return this.api.request(config);
          } catch (refreshErr) {
            return Promise.reject(refreshErr);
          }
        }

        if (
          (isNetworkError || isTransientServerError) &&
          config.__kaceRetryCount < this.maxRetries
        ) {
          config.__kaceRetryCount += 1;
          const delay = this.retryDelayMs * config.__kaceRetryCount;
          await new Promise((resolve) => setTimeout(resolve, delay));
          return this.api.request(config);
        }

        return Promise.reject(error);
      }
    );

    applyKaceHttpMocks(this.api);
  }

  /**
   * @param {string} url
   * @param {import('axios').AxiosRequestConfig} [config]
   * @returns {Promise<import('axios').AxiosResponse<any>>}
   */
  get(url, config = {}) {
    const singleFlightOff = Boolean(config && config.__singleFlight === false);
    const bypass = Boolean(config?.__kaceBypassCache);
    const force = Boolean(config?.__kaceForceRefresh);
    const neverCache = isKaceNeverCacheableGetUrl(url);
    let cacheKey = null;
    try {
      cacheKey = buildKaceResponseCacheKey(
        this.tenantId,
        'GET',
        url,
        config.params ?? null,
        null
      );
    } catch (_) {
      cacheKey = null;
    }

    const ttlMs = this.storeService
      ? getOnescriptCacheTtlMs(this.storeService)
      : 0;
    const cacheEnabled = ttlMs > 0;

    const runNetwork = () =>
      this.api.get(url, config).then((res) => {
        if (
          cacheKey &&
          !bypass &&
          !neverCache &&
          cacheEnabled &&
          kaceResponseCacheableStatus(res)
        ) {
          kaceResponseCacheSet(cacheKey, res, ttlMs);
        }
        return res;
      });

    try {
      if (cacheKey && !bypass && !force && !neverCache && cacheEnabled) {
        const hit = kaceResponseCacheGet(cacheKey);
        if (hit) return Promise.resolve(hit);
      }
      if (singleFlightOff) return runNetwork();
      const key = `GET:${url}:${safeStringify(config.params ?? {})}`;
      return runInFlight(key, runNetwork);
    } catch (e) {
      return this.api.get(url, config);
    }
  }

  /**
   * @param {string} url
   * @param {any} data
   * @param {import('axios').AxiosRequestConfig} [config]
   * @returns {Promise<import('axios').AxiosResponse<any>>}
   */
  post(url, data, config = {}) {
    const singleFlightOff = Boolean(config && config.__singleFlight === false);
    const bypass = Boolean(config?.__kaceBypassCache);
    const force = Boolean(config?.__kaceForceRefresh);
    const allowPostCache =
      Boolean(config?.__kaceCacheRead) || isKaceDefaultPostCacheableUrl(url);
    let cacheKey = null;
    try {
      cacheKey = buildKaceResponseCacheKey(
        this.tenantId,
        'POST',
        url,
        null,
        data
      );
    } catch (_) {
      cacheKey = null;
    }

    const ttlMs = this.storeService
      ? getOnescriptCacheTtlMs(this.storeService)
      : 0;
    const cacheEnabled = ttlMs > 0;

    const runNetwork = () =>
      this.api.post(url, data, config).then((res) => {
        if (
          cacheKey &&
          !bypass &&
          cacheEnabled &&
          allowPostCache &&
          kaceResponseCacheableStatus(res)
        ) {
          kaceResponseCacheSet(cacheKey, res, ttlMs);
        }
        return res;
      });

    try {
      if (cacheKey && !bypass && !force && allowPostCache && cacheEnabled) {
        const hit = kaceResponseCacheGet(cacheKey);
        if (hit) return Promise.resolve(hit);
      }
      if (singleFlightOff) return runNetwork();
      const key = `POST:${url}:${safeStringify(data ?? {})}`;
      return runInFlight(key, runNetwork);
    } catch (e) {
      return this.api.post(url, data, config);
    }
  }

  /**
   * @param {string} url
   * @param {any} data
   * @param {import('axios').AxiosRequestConfig} [config]
   * @returns {Promise<import('axios').AxiosResponse<any>>}
   */
  put(url, data, config = {}) {
    try {
      if (config && config.__singleFlight === false)
        return this.api.put(url, data, config);
      const key = `PUT:${url}:${safeStringify(data ?? {})}`;
      return runInFlight(key, () => this.api.put(url, data, config));
    } catch (e) {
      return this.api.put(url, data, config);
    }
  }

  /**
   * @param {string} url
   * @param {import('axios').AxiosRequestConfig} [config]
   * @returns {Promise<import('axios').AxiosResponse<any>>}
   */
  delete(url, config = {}) {
    try {
      if (config && config.__singleFlight === false)
        return this.api.delete(url, config);
      const key = `DELETE:${url}:${safeStringify(config.params ?? {})}`;
      return runInFlight(key, () => this.api.delete(url, config));
    } catch (e) {
      return this.api.delete(url, config);
    }
  }
}

function safeStringify(val) {
  try {
    return JSON.stringify(val);
  } catch (e) {
    try {
      return String(val);
    } catch (_) {
      return '';
    }
  }
}
