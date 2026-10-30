/**
 * Compatibilidad: el sistema unificado está en `kaceHttpMocks.js`.
 */
export {
  mockHttp,
  clearHttpMocks,
  applyKaceHttpMocks,
} from '#plugins/kace/mocks/kaceHttpMocks.js';

export { applyKaceHttpMocks as applyHttpMocksFromEnv } from '#plugins/kace/mocks/kaceHttpMocks.js';
export { applyKaceHttpMocks as applySubcasesSearchMockFromEnv } from '#plugins/kace/mocks/kaceHttpMocks.js';

export {
  SUBCASES_SEARCH_MOCK_PARENT_ID,
  SUBCASES_SEARCH_MOCK_RESPONSE,
} from '#plugins/kace/mocks/subcasesSearch.mock.data.js';

import { SUBCASES_SEARCH_MOCK_RESPONSE } from '#plugins/kace/mocks/subcasesSearch.mock.data.js';

/**
 * @returns {typeof SUBCASES_SEARCH_MOCK_RESPONSE}
 */
export function getSubcasesSearchMockResponse() {
  return SUBCASES_SEARCH_MOCK_RESPONSE;
}

/**
 * Adapter Axios aislado (tests).
 */
export function createSubcasesSearchMockAdapter(options = {}) {
  const payload = options.data ?? SUBCASES_SEARCH_MOCK_RESPONSE;
  return (config) =>
    Promise.resolve({
      data: payload,
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/json' },
      config,
      request: {},
    });
}
