import { v4 as uuidv4 } from 'uuid';

import { buildTestTenant, withTestTenant } from './testTenant.js';
import { SecretsVault } from '../../src/secrets-vault/index.js';
import { TenantContext } from '../../src/shared/infrastructure/context/TenantContext.js';
import { Crypto } from '../../src/shared/domain/crypto/index.js';

const secretDto = () => ({
    id: uuidv4(),
    descripcion: 'test secret',
    referencia: 'SECRET_TEST',
    secreto: 'secret value',
    created_by: uuidv4(),
    created_at: new Date().toISOString(),
});

describe('testTenant helper', () => {
    it('builds an entity that encrypts without error inside withTestTenant', async () => {
        const secret = await withTestTenant(() => SecretsVault.create(secretDto()));

        expect(secret).toBeInstanceOf(SecretsVault);
    });

    it('fails to build the same entity outside of withTestTenant', () => {
        expect(TenantContext.getTenant()).toBeNull();
        expect(() => SecretsVault.create(secretDto())).toThrow();
    });

    it('round-trips encrypted data using the fixed tenant secret material', async () => {
        const dto = secretDto();

        const decrypted = await withTestTenant(() => {
            const tenant = buildTestTenant();
            const crypto = new Crypto(tenant.secret_iv.value, tenant.secret_key.value, tenant.encryption_method.value);
            const secret = SecretsVault.create({ ...dto, secreto: crypto.encryptData(dto.secreto) });

            return secret.decryptSecret();
        });

        expect(decrypted).toBe(dto.secreto);
    });

    it('exposes a stable, deterministic tenant shape', () => {
        const tenant = buildTestTenant();

        expect(tenant).toEqual(buildTestTenant());
        expect(tenant.id.value).toBe('test-tenant');
    });
});
