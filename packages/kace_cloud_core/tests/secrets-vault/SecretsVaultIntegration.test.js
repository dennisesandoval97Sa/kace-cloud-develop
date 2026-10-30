import { v4 as uuidv4 } from 'uuid';
import {
    SecretCreator,
    SecretDeleter,
    SecretFinder,
    SecretReplacer,
    SecretsCollectionResponse,
    SecretsCounter,
    SecretSearcher,
    SecretsResponse,
    SecretsVault,
    SecretUpdater,
} from '../../src/secrets-vault';
import { KnexSecretsVaultRepository } from '../../src/secrets-vault/infrastructure/persistence/KnexSecretsVaultRepository';
import { knexConfig } from '../knexfile.js';
import { SecretsVaultMother } from './domain/SecretsVaultMother';
import { CustomError, ValidationFailError } from '../../src/shared/index.js';
import { QueryDBError } from '../../src/shared/errors/QueryDBError.js';
import { TenantContext } from '../../src/shared/infrastructure/context/TenantContext.js';
import LocalTenantRepository from '../../src/tenant/infrastructure/local/LocalTenantRepository.js';
import { ValueObjectReference } from '../../src/secrets-vault/domain/ValueObjectReference';

const tenant = await new LocalTenantRepository().find();
const repository = new KnexSecretsVaultRepository(knexConfig);
const cryptoParams = {
    secret_iv: tenant.secret_iv.value,
    secret_key: tenant.secret_key.value,
    encryption_method: tenant.encryption_method.value,
};

describe('Secrets Vault Test', () => {
    it('should create a new Secrets Vault instance', async () => {
        await TenantContext.run(tenant, async () => {
            const dto = SecretsVaultMother.dto();
            await new SecretCreator(repository, cryptoParams).execute(dto);

            const secret = await repository.connection('boveda_secretos').select('*');

            expect(secret).toBeDefined();
            expect(secret.length).toBe(1);
        });
    });

    it('should return error when create a secret with exist reference', async () => {
        await TenantContext.run(tenant, async () => {
            const secret = await SecretsVaultMother.createSecret(repository);
            const dto = {
                id: secret.id.value,
                descripcion: secret.descripcion.value,
                referencia: secret.referencia.value,
                secreto: secret.secreto.value,
                created_by: uuidv4(),
                created_at: new Date().toISOString(),
            };
            await expect(
                new SecretCreator(repository, {
                    secret_iv: process.env.SECRET_IV,
                    secret_key: process.env.SECRET_KEY,
                    encryption_method: process.env.ENCRYPTION_METHOD,
                }).execute(dto)
            ).rejects.toThrow(Error);
        });
    });

    it('should not create a new Secrets Vault instance when null dto', async () => {
        await TenantContext.run(tenant, async () => {
            const dto = null;
            const secretCreator = new SecretCreator(repository, cryptoParams);

            await expect(secretCreator.execute(dto)).rejects.toThrow(Error);
        });
    });

    it('finds an existing Secret instance by id', async () => {
        await TenantContext.run(tenant, async () => {
            const secret = await SecretsVaultMother.createSecret(repository);
            const secretFinder = new SecretFinder(repository);

            const secretResult = await secretFinder.execute(secret.id.value);

            expect(secretResult).not.toBeNull();
            expect(secretResult).toBeInstanceOf(SecretsResponse);
        });
    });

    it('return null if not found a record', async () => {
        await TenantContext.run(tenant, async () => {
            const secretFinder = new SecretFinder(repository);
            await expect(secretFinder.execute(uuidv4())).rejects.toThrow(CustomError);
        });
    });

    it('updates an existing secret Record', async () => {
        await TenantContext.run(tenant, async () => {
            const secret = await SecretsVaultMother.createSecret(repository);
            const secretUpdater = new SecretUpdater(repository, cryptoParams);

            const dtoUpdate = {
                secreto: 'secret updater new',
                referencia: 'REFERENCE_UPDATED',
                descripcion: 'Description updater',
            };

            await secretUpdater.execute(dtoUpdate, secret.id.value);
            const result = await repository.find(secret.id);

            expect(result).toBeInstanceOf(SecretsVault);
            expect(result.secreto.value).toBe(dtoUpdate.secreto);
            expect(result.referencia.value).toBe(dtoUpdate.referencia);
            expect(result.descripcion.value).toBe(dtoUpdate.descripcion);
        });
    });

    it('should return an error when update a non-existent Secret instance', async () => {
        await TenantContext.run(tenant, async () => {
            await SecretsVaultMother.createSecret(repository);
            const secretUpdater = new SecretUpdater(repository, cryptoParams);

            await expect(secretUpdater.execute({}, uuidv4())).rejects.toThrow(Error);
        });
    });

    it('should return an error when update an existent reference Secret', async () => {
        await TenantContext.run(tenant, async () => {
            const secret = await SecretsVaultMother.createSecret(repository);
            const secret1 = await SecretsVaultMother.createRandomSecret(repository);
            const secretUpdater = new SecretUpdater(repository, cryptoParams);

            await expect(
                secretUpdater.execute({ referencia: secret.referencia.value }, secret1.id.value)
            ).rejects.toThrow(ValidationFailError);
        });
    });

    it('deletes an existing Secret instance by id', async () => {
        await TenantContext.run(tenant, async () => {
            const secret = await SecretsVaultMother.createSecret(repository);
            const secretDeleter = new SecretDeleter(repository);

            const deleteDto = {
                deleted_at: new Date().toISOString(),
                deleted_by: uuidv4(),
            };

            await secretDeleter.execute(secret.id.value, deleteDto);

            const dtoCriteria = {
                filter: undefined,
                relationship: undefined,
                limit: 10,
                offset: 0,
                order: { field: 'deleted_at', direction: 'asc' },
            };

            const secretSearcher = new SecretSearcher(repository);

            const secretResult = (await secretSearcher.execute(dtoCriteria)).toJson();

            expect(secretResult.data.items).toHaveLength(0);
        });
    });

    it('should return an error when delete a non-existent Secret instance', async () => {
        await TenantContext.run(tenant, async () => {
            await SecretsVaultMother.createSecret(repository);
            const secretDeleter = new SecretDeleter(repository);

            const deleteDto = {
                deleted_at: new Date().toISOString(),
                deleted_by: uuidv4(),
            };

            await expect(secretDeleter.execute(uuidv4(), deleteDto)).rejects.toThrow(CustomError);
        });
    });

    it('searches for Secret instances with given criteria', async () => {
        await TenantContext.run(tenant, async () => {
            for (let i = 0; i < 10; i++) {
                await SecretsVaultMother.createRandomSecret(repository);
            }
            const dtoCriteria = {
                filter: undefined,
                relationship: undefined,
                limit: 10,
                offset: 0,
                order: { field: 'created_at', direction: 'asc' },
            };
            const secretSearcher = new SecretSearcher(repository);

            const secretResult = await secretSearcher.execute(dtoCriteria);

            expect(secretResult).toBeInstanceOf(SecretsCollectionResponse);
        });
    });

    it('should return an error when not exist field is filtered', async () => {
        await TenantContext.run(tenant, async () => {
            for (let i = 0; i < 10; i++) {
                await SecretsVaultMother.createRandomSecret(repository);
            }
            const dtoCriteria = {
                filter: [
                    {
                        field: 'not_exist',
                        operator: 'eq',
                        value: 'value',
                        type: 'AND',
                    },
                ],
                relationship: undefined,
                limit: 10,
                offset: 0,
                order: { field: 'created_at', direction: 'asc' },
            };

            await expect(new SecretSearcher(repository).execute(dtoCriteria)).rejects.toThrow(QueryDBError);
        });
    });

    it('counts the total number of Search instances', async () => {
        await TenantContext.run(tenant, async () => {
            for (let i = 0; i < 10; i++) {
                await SecretsVaultMother.createRandomSecret(repository);
            }

            const dtoCriteria = {
                filter: undefined,
                relationship: undefined,
                limit: 10,
                offset: 0,
                order: { field: 'created_at', direction: 'asc' },
            };

            const secretCounter = new SecretsCounter(repository);

            const secretResponse = await secretCounter.execute(dtoCriteria);

            expect(Number(secretResponse.count)).toBe(10);
        });
    });

    it('should return a zero for not found criteria', async () => {
        await TenantContext.run(tenant, async () => {
            for (let i = 0; i < 10; i++) {
                await SecretsVaultMother.createRandomSecret(repository);
            }

            const dtoCriteria = {
                filter: [
                    {
                        field: 'descripcion',
                        operator: 'eq',
                        value: 'random',
                        type: 'AND',
                    },
                ],
                relationship: undefined,
                limit: 10,
                offset: 0,
                order: { field: 'created_at', direction: 'asc' },
            };

            const secretCounter = new SecretsCounter(repository);

            const secretResult = await secretCounter.execute(dtoCriteria);

            expect(Number(secretResult.count)).toBe(0);
        });
    });

    it('should replace secrets in URL', async () => {
        await TenantContext.run(tenant, async () => {
            const creator = new SecretCreator(repository, cryptoParams);
            const dto = SecretsVaultMother.dto();
            dto.referencia = 'MY_SECRET';
            await creator.execute(dto);

            const url = 'https://api.example.com/SECRET_MY_SECRET/test';
            const secretReplacer = new SecretReplacer(repository);

            const result = await secretReplacer.replaceSecretsInUrl(url);

            expect(result).toBe('https://api.example.com/secret test/test');
        });
    });

    it('should replace secrets in body', async () => {
        await TenantContext.run(tenant, async () => {
            const creator = new SecretCreator(repository, cryptoParams);

            const dto = SecretsVaultMother.dto();
            dto.referencia = 'SECRET_SECRET_TEST';
            dto.secreto = 'super-secret-plain-text'; // EN CLARO: el creator lo cifra

            await creator.execute(dto); // Guarda cifrado en boveda_secretos

            const body = {
                data: 'SECRET_SECRET_TEST',
            };

            const secretReplacer = new SecretReplacer(repository);

            const result = await secretReplacer.replaceSecretsInBody(body);

            expect(result.data).toBe('SECRET_SECRET_TEST');
        });
    });

    it('should replace secrets in header', async () => {
        await TenantContext.run(tenant, async () => {
            const creator = new SecretCreator(repository, cryptoParams);
            const dto = SecretsVaultMother.dto();
            await creator.execute(dto);

            const headers = {
                authorization: 'SECRET_SECRET_TEST',
            };

            const secretReplacer = new SecretReplacer(repository);

            const result = await secretReplacer.replaceSecretsInHeader(headers);

            expect(result.authorization).toBe('secret test');
        });
    });

    it('should replace secrets in value', async () => {
        await TenantContext.run(tenant, async () => {
            const creator = new SecretCreator(repository, cryptoParams);
            const dto = SecretsVaultMother.dto();
            await creator.execute(dto);

            const value = 'SECRET_SECRET_TEST';
            const secretReplacer = new SecretReplacer(repository);

            const result = await secretReplacer.replaceSecretsInValue(value);

            expect(result).toBe('secret test');
        });
    });

    it('should return the body as-is if the body is null or undefined', async () => {
        await TenantContext.run(tenant, async () => {
            const secretReplacer = new SecretReplacer(repository);

            expect(await secretReplacer.replaceSecretsInBody(null)).toBeNull();
            expect(await secretReplacer.replaceSecretsInBody(undefined)).toBeUndefined();
        });
    });

    it('should handle missing secret', async () => {
        await TenantContext.run(tenant, async () => {
            const secretReplacer = new SecretReplacer(repository);

            const result = await secretReplacer.replaceSecretsInUrl('https://api.example.com/SECRET_MISSING_TEST/test');

            expect(result).toBe('https://api.example.com/SECRET_MISSING_TEST/test');
        });
    });

    it('should throw an error if the input text is invalid', async () => {
        await TenantContext.run(tenant, async () => {
            const secretReplacer = new SecretReplacer(repository);

            await expect(secretReplacer.replaceSecretsInUrl(123)).rejects.toThrow(
                'SecretReplacer: El texto a reemplazar debe ser una cadena válida.'
            );
        });
    });

    it('should encrypt with GCM when ENCRYPTION_METHOD is aes-256-gcm', async () => {
        await TenantContext.run(tenant, async () => {
            const dto = SecretsVaultMother.dto();
            dto.id = uuidv4();
            const originalSecret = dto.secreto;

            const newEncryptionMethod = 'aes-256-gcm';

            // 1. Create with GCM explicitly (overriding config for this call)
            await new SecretCreator(repository, {
                secret_iv: process.env.SECRET_IV,
                secret_key: process.env.SECRET_KEY,
                encryption_method: newEncryptionMethod,
            }).execute(dto);

            // 2. Verify Storage Format in DB
            const secret = await repository.connection('boveda_secretos').select('*').where('id', dto.id);

            const encryptedValue = secret[0].secreto;

            // Format should be IV:AuthTag:Ciphertext -> splits to 3 parts
            const parts = encryptedValue.split(':');
            expect(parts.length).toBe(3);

            // 3. Verify Decryption with Legacy Config (Hybrid Mode check)
            const entity = await repository.find({ value: dto.id });

            const decrypted = entity.decryptSecret();
            expect(decrypted).toBe(originalSecret);
        });
    });

    it('should create a secret whitout password_encryption_migrated and this has a true value in DB', async () => {
        await TenantContext.run(tenant, async () => {
            const dto = SecretsVaultMother.dto();

            await new SecretCreator(repository, {
                secret_iv: process.env.SECRET_IV,
                secret_key: process.env.SECRET_KEY,
                encryption_method: 'aes-256-gcm', // Simulate Env Upgrade
            }).execute(dto);

            let secretRecord = await repository.connection('boveda_secretos').select('*').where('id', dto.id);

            expect(secretRecord.length).toBe(1);
            expect(secretRecord[0].password_encryption_migrated).toBe(true);
        });
    });

    it('should migrate legacy secret to GCM when updated', async () => {
        await TenantContext.run(tenant, async () => {
            const dto = SecretsVaultMother.dto();
            const originalSecret = dto.secreto;

            // 1. Simulate inserting a LEGACY secret (CBC) via Repository directly
            await new SecretCreator(repository, {
                secret_iv: process.env.SECRET_IV,
                secret_key: process.env.SECRET_KEY,
                encryption_method: 'aes-256-cbc', // Force Legacy
            }).execute(dto);

            //set null value to simulate legacy data in DB
            await repository
                .connection('boveda_secretos')
                .where('id', dto.id)
                .update({ password_encryption_migrated: null });

            let secretRecord = await repository.connection('boveda_secretos').select('*').where('id', dto.id).first();

            expect(secretRecord.password_encryption_migrated).toBeNull();

            // 2. Read it (Should work using Legacy decryption)
            const entity = await repository.find({ value: dto.id });
            const decrypted = entity.decryptSecret();
            expect(decrypted).toBe(originalSecret);

            // 3. Update the secret while simulating ENCRYPTION_METHOD = GCM
            const secretUpdater = new SecretUpdater(repository, {
                secret_iv: process.env.SECRET_IV,
                secret_key: process.env.SECRET_KEY,
                encryption_method: 'aes-256-gcm', // Simulate Env Upgrade
            });

            const updateDto = {
                secreto: 'new secret value',
                referencia: 'UPDATED_REF',
            };

            await secretUpdater.execute(updateDto, dto.id);

            // 4. Verify Migration in DB
            secretRecord = await repository.connection('boveda_secretos').select('*').where('id', dto.id).first();

            // Check Flag
            expect(secretRecord.password_encryption_migrated).toBe(true);
            // Check Format (split by colon -> 3 parts)
            const encryptedValue = secretRecord.secreto;
            const parts = encryptedValue.split(':');
            expect(parts.length).toBe(3);

            // 5. Verify Decryption of NEW value
            const updatedEntity = await repository.find({ value: dto.id });
            const decryptedNew = updatedEntity.decryptSecret();
            expect(decryptedNew).toBe('new secret value');
        });
    });

    it('should migrate legacy secret to GCM even when only updating description', async () => {
        await TenantContext.run(tenant, async () => {
            const dto = SecretsVaultMother.dto();
            dto.id = uuidv4();
            const originalSecret = dto.secreto;

            // 1. Insert Legacy
            await new SecretCreator(repository, {
                secret_iv: process.env.SECRET_IV,
                secret_key: process.env.SECRET_KEY,
                encryption_method: 'aes-256-cbc',
            }).execute(dto);

            //set null value to simulate legacy data in DB
            await repository
                .connection('boveda_secretos')
                .where('id', dto.id)
                .update({ password_encryption_migrated: null });

            // 2. Update Description only (Environment GCM)
            const secretUpdater = new SecretUpdater(repository, {
                secret_iv: process.env.SECRET_IV,
                secret_key: process.env.SECRET_KEY,
                encryption_method: 'aes-256-gcm',
            });

            await secretUpdater.execute({ descripcion: 'Updated Desc' }, dto.id);

            // 3. Verify Migration
            const secretRecord = await repository.connection('boveda_secretos').select('*').where('id', dto.id).first();

            expect(secretRecord.descripcion).toBe('Updated Desc');
            expect(secretRecord.password_encryption_migrated).toBe(true); // Should be migrated
            expect(secretRecord.secreto.split(':').length).toBe(3); // GCM format

            // 4. Verify Decryption
            const entity = await repository.find({ value: dto.id });
            expect(entity.decryptSecret()).toBe(originalSecret);
        });
    });

    it('returns empty array when given empty references', async () => {
        await TenantContext.run(tenant, async () => {
            const result = await repository.findByReferences([]);
            expect(result).toEqual([]);
        });
    });

    it('returns only the secrets that exist for the given references', async () => {
        await TenantContext.run(tenant, async () => {
            await SecretsVaultMother.createSecret(repository, { referencia: 'REF_A', secreto: 'va' });
            await SecretsVaultMother.createSecret(repository, { referencia: 'REF_B', secreto: 'vb' });
            const refs = [
                new ValueObjectReference('Referencia', 'REF_A'),
                new ValueObjectReference('Referencia', 'NOT_EXISTS'),
                new ValueObjectReference('Referencia', 'REF_B'),
            ];

            const result = await repository.findByReferences(refs);

            expect(result).toHaveLength(2);
            expect(result.map((r) => r.referencia.value).sort()).toEqual(['REF_A', 'REF_B']);
            expect(result.every((r) => r instanceof SecretsVault)).toBe(true);
        });
    });

    it('should replace ALL occurrences of a repeated placeholder', async () => {
        await TenantContext.run(tenant, async () => {
            const creator = new SecretCreator(repository, cryptoParams);
            const dto = SecretsVaultMother.dto();
            dto.referencia = 'TOKEN';
            dto.secreto = 'abc123';
            await creator.execute(dto);

            const replacer = new SecretReplacer(repository);
            const body = { a: 'SECRET_TOKEN', b: 'SECRET_TOKEN', nested: { c: 'SECRET_TOKEN' } };

            const result = await replacer.replaceSecretsInBody(body);

            expect(result).toEqual({ a: 'abc123', b: 'abc123', nested: { c: 'abc123' } });
        });
    });

    it('should fetch all referenced secrets in a single SELECT against boveda_secretos', async () => {
        await TenantContext.run(tenant, async () => {
            const creator = new SecretCreator(repository, cryptoParams);
            for (const ref of ['REF_A', 'REF_B', 'REF_C']) {
                const dto = SecretsVaultMother.dto();
                dto.referencia = ref;
                dto.secreto = `value-${ref.toLowerCase()}`;
                await creator.execute(dto);
            }

            let bovedaSelectCount = 0;
            const queryListener = ({ sql }) => {
                if (
                    typeof sql === 'string' &&
                    sql.toLowerCase().startsWith('select') &&
                    sql.includes('boveda_secretos')
                ) {
                    bovedaSelectCount++;
                }
            };
            repository.connection.on('query', queryListener);

            try {
                const replacer = new SecretReplacer(repository);
                await replacer.replaceSecretsInValue(
                    'SECRET_REF_A SECRET_REF_B SECRET_REF_C SECRET_REF_A SECRET_REF_B'
                );
            } finally {
                repository.connection.off('query', queryListener);
            }

            expect(bovedaSelectCount).toBe(1);
        });
    });

    it('should not query the database when text has no SECRET_ placeholder', async () => {
        await TenantContext.run(tenant, async () => {
            let bovedaSelectCount = 0;
            const listener = ({ sql }) => {
                if (
                    typeof sql === 'string' &&
                    sql.toLowerCase().startsWith('select') &&
                    sql.includes('boveda_secretos')
                ) {
                    bovedaSelectCount++;
                }
            };
            repository.connection.on('query', listener);

            try {
                const replacer = new SecretReplacer(repository);
                const result = await replacer.replaceSecretsInValue('plain text without placeholders');
                expect(result).toBe('plain text without placeholders');
            } finally {
                repository.connection.off('query', listener);
            }

            expect(bovedaSelectCount).toBe(0);
        });
    });
});
