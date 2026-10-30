import Kace from './Kace';
import { AuthService } from './services/authService';
import { ApiService } from './services/apiService';

import { UserService } from './services/userService';
import { AuxService } from './services/auxService';
import { BaseService } from './services/baseService';
import { CaseService } from './services/caseService';
import { ClassificationsService } from './services/classificationsService';
import { ConfigurationService } from './services/configurationService';
import { CustomListsService } from './services/customListsService';
import { FileService } from './services/fileService';
import { GlobalService } from './services/globalService';
import { LiteralsService } from './services/literalsService';
import { OneScriptService } from './services/oneScriptService';
import { SchemaService } from './services/schemaService';
import { StatesService } from './services/statesService';
import { EmailTemplatesService } from './services/emailTemplatesService';
import { storeService } from './services/storeService';
import { GroupService } from './services/groupService';
import { getKaceSessionTokensBundle } from './services/sessionStorageCache.js';

export function createKaceEngine({
  apiUrl,
  clientId,
  tenantId,
  fingerprint,
  cognitoClientId,
  cognitoUrl,
  refreshToken,
  emitEvent,
  store: storeInstance,
}) {
  if (
    !apiUrl ||
    !tenantId ||
    !fingerprint ||
    !cognitoClientId ||
    !cognitoUrl ||
    !refreshToken
  ) {
    throw new Error('Invalid KaceEngine initialization parameters');
  }
  let plainStore = null;
  let _storeService = null;
  if (storeInstance && typeof storeInstance.get === 'function') {
    _storeService = storeInstance;
    plainStore = _storeService.store;
  } else if (storeInstance && typeof storeInstance === 'object') {
    plainStore = storeInstance;
    _storeService = storeService;
  } else {
    _storeService = storeService;
    plainStore = _storeService.store;
  }

  const kace = new Kace({ store: plainStore, storeService: _storeService });

  const authService = new AuthService({
    apiUrl,
    clientId,
    tenantId,
    fingerprint,
    cognitoClientId,
    cognitoUrl,
    refreshToken,
    storeService: _storeService,
  });
  const apiService = new ApiService({
    apiUrl,
    fingerprint,
    tenantId,
    authService,
    storeService: _storeService,
  });
  const userService = new UserService({ apiService, store: plainStore });
  kace.registerCoreServices({ authService, apiService, userService });

  if (emitEvent) kace.registerValue('emitEvent', emitEvent);

  kace.registerService('base', BaseService);
  kace.registerService('file', FileService, { apiService, store: plainStore });
  kace.registerService('schema', SchemaService, {
    apiService,
    store: plainStore,
  });
  kace.registerService('aux', AuxService, {
    apiService,
    store: plainStore,
    schemaService: kace.getService('schema'),
  });
  kace.registerService('cases', CaseService, {
    apiService,
    store: plainStore,
    emitEvent,
    fileService: kace.getService('file'),
    auxService: kace.getService('aux'),
  });
  kace.registerService('classifications', ClassificationsService, {
    apiService,
    userService,
    store: plainStore,
    emitEvent,
  });
  kace.registerService('configuration', ConfigurationService, {
    apiService,
    userService,
    store: plainStore,
    emitEvent,
  });
  kace.registerService('customLists', CustomListsService, {
    apiService,
    store: plainStore,
  });
  kace.registerService('global', GlobalService, {
    apiService,
    store: plainStore,
  });
  kace.registerService('literals', LiteralsService, {
    apiService,
    store: plainStore,
  });
  kace.registerService('oneScript', OneScriptService, {
    apiService,
    store: plainStore,
    classificationsService: kace.getService('classifications'),
  });
  kace.registerService('states', StatesService, {
    apiService,
    store: plainStore,
    emitEvent,
  });
  kace.registerService('group', GroupService, {
    apiService,
    store: plainStore,
  });
  kace.registerService('email', EmailTemplatesService, {
    apiService,
    store: plainStore,
  });

  try {
    if (typeof globalThis !== 'undefined') globalThis.KACE_ENGINE = kace;
  } catch (_) {}

  return kace;
}

let _cachedKaceEngine = null;

function normalizeKaceEngineApiUrl(value) {
  if (value == null || value === '') return '';
  return String(value).trim().replace(/\/+$/, '');
}

function isKaceEngineInitComplete(initData) {
  return Boolean(
    initData.apiUrl &&
    initData.tenantId &&
    initData.fingerprint &&
    initData.cognitoClientId &&
    initData.cognitoUrl &&
    initData.refreshToken
  );
}

function readSessionRefreshToken() {
  try {
    if (typeof sessionStorage === 'undefined') return null;
    const bundledTokensRaw = getKaceSessionTokensBundle();
    if (bundledTokensRaw) {
      const bundledTokens = JSON.parse(bundledTokensRaw);
      const bundledRefresh = bundledTokens?.['auth.refresh_token'];
      if (bundledRefresh) return String(bundledRefresh);
    }
    return sessionStorage.getItem('auth.refresh_token');
  } catch (_) {
    return null;
  }
}

function buildInitDataFromStore() {
  const _storeService = storeService;
  return {
    apiUrl: _storeService.get('config.api_url') || null,
    clientId: _storeService.get('auth.client_id') || null,
    tenantId: _storeService.get('auth.tenant_id') || null,
    fingerprint: _storeService.get('auth.fingerprint') || null,
    cognitoClientId: _storeService.get('auth.cognito_client_id') || null,
    cognitoUrl: _storeService.get('auth.cognito_url') || null,
    refreshToken:
      readSessionRefreshToken() ||
      _storeService.get('auth.refresh_token') ||
      null,
    emitEvent: (eventName, payload) => {
      document.dispatchEvent(new CustomEvent(eventName, { detail: payload }));
    },
    store: _storeService,
  };
}

function syncKaceEngineFromStore() {
  const initData = buildInitDataFromStore();
  const desiredApiUrl = normalizeKaceEngineApiUrl(initData.apiUrl);

  if (_cachedKaceEngine) {
    const apiSvc = _cachedKaceEngine.getService?.('apiService');
    const cachedApiUrl = normalizeKaceEngineApiUrl(apiSvc?.apiUrl);
    if (desiredApiUrl === cachedApiUrl) {
      return _cachedKaceEngine;
    }
    _cachedKaceEngine = null;
  }

  if (!isKaceEngineInitComplete(initData)) {
    return null;
  }

  _cachedKaceEngine = createKaceEngine(initData);
  try {
    if (typeof globalThis !== 'undefined')
      globalThis.KACE_ENGINE = _cachedKaceEngine;
  } catch (_) {}
  return _cachedKaceEngine;
}

async function waitForKaceEngineReady(maxMs = 25000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const engine = syncKaceEngineFromStore();
    if (engine) return engine;
    await new Promise((r) => setTimeout(r, 50));
  }
  return null;
}

function bindDeferredEngineMethod(prop) {
  return (...args) =>
    waitForKaceEngineReady().then((engine) => {
      if (!engine) {
        throw new Error('KACE_ENGINE_NOT_READY');
      }
      const fn = engine[prop];
      if (typeof fn !== 'function') {
        throw new Error(`KACE_ENGINE_METHOD_UNAVAILABLE:${String(prop)}`);
      }
      return fn.apply(engine, args);
    });
}

function bindDeferredServiceMethod(serviceName, prop) {
  return (...args) =>
    waitForKaceEngineReady().then((engine) => {
      if (!engine) {
        throw new Error('KACE_ENGINE_NOT_READY');
      }
      const svc = engine.getService(serviceName);
      if (!svc) {
        throw new Error(`KACE_SERVICE_UNAVAILABLE:${serviceName}`);
      }
      const fn = svc[prop];
      if (typeof fn !== 'function') {
        throw new Error(
          `KACE_SERVICE_METHOD_UNAVAILABLE:${serviceName}.${String(prop)}`
        );
      }
      return fn.apply(svc, args);
    });
}

const serviceForwardProxies = new Map();

function getServiceForwardProxy(name) {
  const key = String(name);
  if (!serviceForwardProxies.has(key)) {
    serviceForwardProxies.set(
      key,
      new Proxy(
        {},
        {
          get(_, prop) {
            if (typeof prop === 'symbol') return undefined;
            const engine = _cachedKaceEngine;
            if (engine) {
              const svc = engine.getService(key);
              if (svc == null) return undefined;
              const v = Reflect.get(svc, prop, svc);
              if (typeof v === 'function') return v.bind(svc);
              return v;
            }
            return bindDeferredServiceMethod(key, prop);
          },
        }
      )
    );
  }
  return serviceForwardProxies.get(key);
}

let kaceFacadeProxy = null;

function getKaceFacadeProxy() {
  if (!kaceFacadeProxy) {
    kaceFacadeProxy = new Proxy(
      {},
      {
        get(_, prop) {
          if (typeof prop === 'symbol') return undefined;
          if (prop === 'getService') {
            return (name) => getServiceForwardProxy(name);
          }
          const engine = _cachedKaceEngine;
          if (engine) {
            const v = Reflect.get(engine, prop, engine);
            if (typeof v === 'function') return v.bind(engine);
            return v;
          }
          return bindDeferredEngineMethod(prop);
        },
      }
    );
  }
  return kaceFacadeProxy;
}

export function resetKaceEngineCache() {
  _cachedKaceEngine = null;
  try {
    if (typeof globalThis !== 'undefined') {
      delete globalThis.KACE_ENGINE;
    }
  } catch (_) {}
}

export function notifyKaceAuthReady() {
  try {
    storeService.set('config.kace_auth_ready', true);
  } catch (_) {}
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('kace.auth_ready', '1');
    }
  } catch (_) {}
  try {
    if (typeof window !== 'undefined') {
      window['__KACE_AUTH_READY__'] = true;
      window.dispatchEvent(new CustomEvent('kaceAuthReady'));
    }
  } catch (_) {}
}

export const KaceEngine = () => {
  try {
    syncKaceEngineFromStore();
  } catch (_) {}
  return getKaceFacadeProxy();
};
