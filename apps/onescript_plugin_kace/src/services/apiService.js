import axios from 'axios';
import { convertTimestamps } from '#util/convertTimestamps.js';
import { validateError } from '#util/validationErrors.js';
import { KaceEngine } from '#plugins/kace/KaceEngine.js';
import { storeService } from '#plugins/kace/services/storeService.js';

const api = axios.create({
  timeout: 40000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  async (config) => {
    if (config.kace_request === false) return config;
    const kaceEngine = KaceEngine();
    const authService = kaceEngine.getService('authService');
    const authData = storeService.get('auth');
    const id_token = authData.id_token;
    const tenant_id = authData.tenant_id;
    const fingerprint = authData.fingerprint;

    if (!id_token) {
      await authService.refreshTokenFlow();
    } else {
      await authService.validateToken();
    }
    config.headers['X-Client-Fingerprint'] = fingerprint;
    config.headers.Authorization = id_token;
    config.headers['X-Tenant-ID'] = tenant_id;

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => {
    if (response.data) {
      response.data = convertTimestamps(response.data);
    }
    return response;
  },
  (error) => {
    const customError = validateError(error);
    if (customError) {
      return Promise.reject(customError);
    }
    return Promise.reject(error);
  }
);

const resolveRequest = (method, url, config, data = null) => {
  if (method === 'get' || method === 'delete') {
    return api[method](url, config);
  }

  return api[method](url, data, config);
};

export const apiService = {
  get: (url, config = {}) => resolveRequest('get', url, config),
  post: (url, data, config = {}) => resolveRequest('post', url, config, data),
};
