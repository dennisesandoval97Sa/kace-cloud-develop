import { jest } from '@jest/globals';
import { v4 as uuidv4 } from 'uuid';
import { KnexAdapterSettingsRepository } from '../../src/rabbitmq/infrastructure/persistence/KnexAdapterSettingsRepository';
import { AdapterCreator } from '../../src/rabbitmq/application/create/AdapterCreator';
import { AdapterUpdater } from '../../src/rabbitmq/application/update/AdapterUpdater';
import { Crypto } from '../../src/shared/domain/crypto';
import { knexConfig } from '../knexfile.js';
import { TenantContext } from '../../src/shared/index.js';

describe('RabbitMQ Adapter Integration Test', () => {
    const repository = new KnexAdapterSettingsRepository(knexConfig);
    const legacyMethod = 'aes-256-cbc';
    const gcmMethod = 'aes-256-gcm';
    const secretKey = process.env.SECRET_KEY || '12345678901234567890123456789012'; // 32 bytes for aes-256
    const secretIv = process.env.SECRET_IV || '1234567890123456'; // 16 bytes

    // Base64 encoding for crypto usage if needed, or stick to what ENV provides.
    // The codebase uses base64 encoded keys usually.
    // Assuming process.env.SECRET_KEY is already correct format (base64 or string).
    // Let's use the mocks to be consistent.

    beforeAll(async () => {
        // Enforce GCM for current environment
        process.env.LEGACY_ENCRYPTION_METHOD = legacyMethod;
        process.env.ENCRYPTION_METHOD = gcmMethod;

        // Mock TenantContext if used by Repositories (RabbitMQ repo doesn't seems to use it directly, but AdapterCreator might via passed params)
    });

    it('should migrate legacy password to GCM on update', async () => {
        const id = uuidv4();
        const plainPassword = 'my-secret-password';

        // 1. Create Legacy Crypto and Encrypt
        const legacyCrypto = new Crypto(secretIv, secretKey, legacyMethod);
        const encryptedPasswordLegacy = legacyCrypto.encryptData(plainPassword);

        // 2. Insert Legacy Record directly into DB
        await repository.connection('broker_adapters').insert({
            id: id,
            name: 'Legacy Adapter',
            host: 'localhost',
            port: 5672,
            queue: 'test_queue',
            password: encryptedPasswordLegacy,
            // password_encryption_migrated: null // Default legacy
        });

        // 3. Setup Updater with GCM Environment
        const cryptoParams = {
            secret_iv: secretIv,
            secret_key: secretKey,
            encryption_method: gcmMethod,
        };
        const updater = new AdapterUpdater(repository, cryptoParams);

        // 4. Update a non-password field to trigger lazy migration
        await updater.execute(id, { name: 'Updated Adapter Name' });

        // 5. Verify Migration
        const updatedRecord = await repository.connection('broker_adapters').where({ id }).first();

        // Expect Truthy because it should be migrated
        expect(updatedRecord.password_encryption_migrated).toBeTruthy();

        // Check Password format (GCM has parts separated by :)
        expect(updatedRecord.password).toContain(':');

        // 6. Verify Decryption with GCM
        const gcmCrypto = new Crypto(secretIv, secretKey, gcmMethod);
        const decrypted = gcmCrypto.decryptData(updatedRecord.password);
        expect(decrypted).toBe(plainPassword);
    });

    it('should set flag to true when creating new adapter with GCM', async () => {
        const id = uuidv4();
        const cryptoParams = {
            secret_iv: secretIv,
            secret_key: secretKey,
            encryption_method: gcmMethod,
        };

        const creator = new AdapterCreator(repository, cryptoParams);
        await creator.execute({
            id: id,
            name: 'New GCM Adapter',
            host: 'localhost',
            port: 5672,
            queue: 'queue',
            password: 'new-password',
        });

        const record = await repository.connection('broker_adapters').where({ id }).first();
        expect(record.password_encryption_migrated).toBeTruthy();
    });
});
