import { TenantContext } from '../../src/shared/infrastructure/context/TenantContext.js';

// Crypto (src/shared/domain/crypto/index.js) base64-decodes secret_iv/secret_key
// and requires the decoded IV to be exactly 16 bytes (key must be 32 bytes for
// aes-256-*). These are the base64 encodings of 16 and 32 raw ASCII bytes
// respectively, not raw 16/32-character strings.
const TEST_SECRET_IV = 'MTIzNDU2Nzg5MDEyMzQ1Ng==';
const TEST_SECRET_KEY = 'MTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTI=';
const TEST_ENCRYPTION_METHOD = 'aes-256-cbc';

/**
 * Tenant determinista para tests que construyen entidades que cifran.
 * Los valores son fijos para que el cifrado sea reproducible entre corridas.
 *
 * @returns {object}
 */
export const buildTestTenant = () => ({
    id: { value: 'test-tenant' },
    secret_iv: { value: TEST_SECRET_IV },
    secret_key: { value: TEST_SECRET_KEY },
    encryption_method: { value: TEST_ENCRYPTION_METHOD },
});

/**
 * Ejecuta fn dentro de un TenantContext con el tenant de prueba.
 *
 * @template T
 * @param {() => T | Promise<T>} fn
 * @returns {Promise<T>}
 */
export const withTestTenant = (fn) => TenantContext.run(buildTestTenant(), fn);
