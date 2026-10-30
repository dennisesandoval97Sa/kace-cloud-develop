import { v4 as uuidv4 } from 'uuid';
import { SecretCreator, SecretsVault } from '../../../src/secrets-vault';
import { Chance } from 'chance';
import TestHelper from '../../TestHelper.js';
import { TenantContext, ValueObjectUuid } from '../../../src/shared/index.js';

export class SecretsVaultMother {
    /**
     * Generates a Data Transfer Object (DTO) for the `SecretsVault` entity.
     *
     * @returns {Object} The DTO containing the properties for an `SecretsVault` entity.
     */
    static dto(overrides = {}) {
        return {
            id: uuidv4(),
            descripcion: 'Secret vault data tst ',
            referencia: 'SECRET_TEST',
            secreto: 'secret test',
            created_by: uuidv4(),
            created_at: new Date().toISOString(),
            ...overrides,
        };
    }

    /**
     * Creates an `SecretsVault` instance and saves it to the repository.
     *
     * @param {KnexSecretsVaultRepository} repository - The repository to save the `SecretsVault` instance.
     * @returns {Promise<SecretsVault>} The created `SecretsVault` instance.
     */
    static async createSecret(repository, overrides = {}) {
        const secret = SecretsVault.create(SecretsVaultMother.dto(overrides));
        await repository.save(secret);
        return secret;
    }

    /**
     * Generates a random Data Transfer Object (DTO) for the `SecretsVault` entity.
     *
     * @returns {Object} The DTO containing random properties for a `SecretsVault` entity.
     */
    static randomDto() {
        const chance = new Chance();
        return {
            id: uuidv4(),
            descripcion: TestHelper.generateSafeValue(() => chance.string({ length: 10, alpha: true })),
            referencia: TestHelper.generateSafeValue(() => chance.string({ length: 10, alpha: true, casing: 'upper' })),
            secreto: TestHelper.generateSafeValue(() => chance.string({ length: 10, alpha: true })),
            created_by: uuidv4(),
            created_at: new Date().toISOString(),
        };
    }

    /**
     * Creates a `SecretsVault` instance with random properties and saves it to the repository.
     *
     * @param {KnexSecretsVaultRepository} repository - The repository to save the `SecretsVault` instance.
     * @returns {Promise<SecretsVault>} The created `SecretsVault` instance.
     */
    static async createRandomSecret(repository) {
        const secret = SecretsVault.create(SecretsVaultMother.randomDto());
        await repository.save(secret);
        return secret;
    }

    /**
     * Creates an encrypted `SecretsVault` instance and saves it to the repository.
     * @param {KnexSecretsVaultRepository} repository - The repository to save the `SecretsVault` instance.
     * @param {Object} overrides
     * @returns {Promise<SecretsVault|null>} The created `SecretsVault` instance.
     */
    static async createEncryptedSecret(repository, overrides = {}) {
        const secret = SecretsVaultMother.dto(overrides);
        const tenant = TenantContext.getTenant();
        await new SecretCreator(repository, {
            secret_iv: tenant.secret_iv.value,
            secret_key: tenant.secret_key.value,
            encryption_method: tenant.encryption_method.value,
        }).execute(secret);

        return repository.find(new ValueObjectUuid('id', secret.id));
    }
}
