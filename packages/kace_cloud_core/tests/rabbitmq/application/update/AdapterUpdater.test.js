import { v4 as uuidv4 } from 'uuid';
import { jest } from '@jest/globals';
import { AdapterUpdater } from '../../../../src/rabbitmq/application/update/AdapterUpdater.js';
import { KnexAdapterSettingsRepository } from '../../../../src/rabbitmq/infrastructure/persistence/KnexAdapterSettingsRepository.js';
import { Crypto } from '../../../../src/shared/domain/crypto/index.js';
import { Helper } from '../../../../src/shared/infrastructure/utils/Helper.js';
import { knexConfig } from '../../../knexfile.js';

const insertAdapter = async (repository, overrides = {}) => {
    const id = uuidv4();
    await repository.connection('broker_adapters').insert({
        id,
        name: `Adapter-${id}`,
        host: 'broker.local',
        port: 5672,
        queue: 'test-queue',
        ...overrides,
    });
    return id;
};

describe('AdapterUpdater', () => {
    const repository = new KnexAdapterSettingsRepository(knexConfig);
    const secretKey = process.env.SECRET_KEY || '12345678901234567890123456789012';
    const secretIv = process.env.SECRET_IV || '1234567890123456';
    const gcmMethod = Crypto.ENCRYPTION_METHOD;
    const legacyMethod = Crypto.LEGACY_ENCRYPTION_METHOD;

    it('updates without cryptoParams (default, not passed)', async () => {
        const id = await insertAdapter(repository);
        const updater = new AdapterUpdater(repository);

        await updater.execute(id, { name: 'Renamed' });

        const row = await repository.connection('broker_adapters').where({ id }).first();
        expect(row.name).toBe('Renamed');
    });

    it('throws a 404 CustomError when the adapter does not exist', async () => {
        const updater = new AdapterUpdater(repository);

        await expect(updater.execute(uuidv4(), { name: 'x' })).rejects.toMatchObject({ statusCode: 404 });
    });

    it('treats a missing dto as an empty object (Object.entries(dto || {})), which knex then rejects as an empty UPDATE', async () => {
        const id = await insertAdapter(repository, { name: 'Untouched' });
        const updater = new AdapterUpdater(repository);

        // `cleanedDto` termina siendo `{}`: Postgres/knex no aceptan un UPDATE sin columnas, asi
        // que la fila sigue intacta y la promesa se rechaza -- no es un no-op silencioso.
        await expect(updater.execute(id, undefined)).rejects.toThrow();

        const row = await repository.connection('broker_adapters').where({ id }).first();
        expect(row.name).toBe('Untouched');
    });

    it('normalizes empty-string values: nulls nullable fields, drops non-nullable ones', async () => {
        const id = await insertAdapter(repository, { exchange: 'old-exchange', name: 'OriginalName' });
        const updater = new AdapterUpdater(repository);

        await updater.execute(id, { exchange: '', name: '' });

        const row = await repository.connection('broker_adapters').where({ id }).first();
        expect(row.exchange).toBeNull();
        // `name` no esta en nullableFields: un '' se descarta por completo, no se envia al UPDATE.
        expect(row.name).toBe('OriginalName');
    });

    it('stores the password unencrypted when cryptoParams is not configured', async () => {
        const id = await insertAdapter(repository);
        const updater = new AdapterUpdater(repository);

        await updater.execute(id, { password: 'plain-password' });

        const row = await repository.connection('broker_adapters').where({ id }).first();
        expect(row.password).toBe('plain-password');
    });

    it('encrypts a new password and marks migrated=true with the current (GCM) method', async () => {
        const id = await insertAdapter(repository);
        const cryptoParams = { secret_iv: secretIv, secret_key: secretKey, encryption_method: gcmMethod };
        const updater = new AdapterUpdater(repository, cryptoParams);

        await updater.execute(id, { password: 'my-new-password' });

        const row = await repository.connection('broker_adapters').where({ id }).first();
        expect(row.password).not.toBe('my-new-password');
        expect(row.password_encryption_migrated).toBeTruthy();
        const crypto = new Crypto(secretIv, secretKey, gcmMethod);
        expect(crypto.decryptData(row.password)).toBe('my-new-password');
    });

    // El adaptador se siembra con `password_encryption_migrated: true` A PROPOSITO: si naciera
    // con el flag ya NULO, "resetear a null" y "no tocar nada" serian indistinguibles y el
    // assert pasaria igual aunque AdapterUpdater olvidase el reseteo. Partiendo de `true` se
    // comprueba el comportamiento real que protege esta linea: un adaptador YA migrado que
    // recifra su contraseña con el metodo legacy tiene que volver a marcarse como NO migrado;
    // si conservara `true`, las lecturas posteriores intentarian descifrar con GCM un secreto
    // cifrado con el metodo legacy.
    it('encrypts a new password and resets migrated back to NULL with the legacy method', async () => {
        const id = await insertAdapter(repository, { password_encryption_migrated: true });
        const cryptoParams = { secret_iv: secretIv, secret_key: secretKey, encryption_method: legacyMethod };
        const updater = new AdapterUpdater(repository, cryptoParams);

        await updater.execute(id, { password: 'my-new-password' });

        const row = await repository.connection('broker_adapters').where({ id }).first();
        expect(row.password).not.toBe('my-new-password');
        expect(row.password_encryption_migrated).toBeNull();
        const legacyCrypto = new Crypto(secretIv, secretKey, legacyMethod);
        expect(legacyCrypto.decryptData(row.password)).toBe('my-new-password');
    });

    it('does not touch the password at all when cryptoParams is set but the dto has no password and the adapter is already migrated', async () => {
        const cryptoParams = { secret_iv: secretIv, secret_key: secretKey, encryption_method: gcmMethod };
        const crypto = new Crypto(secretIv, secretKey, gcmMethod);
        const id = await insertAdapter(repository, {
            password: crypto.encryptData('already-migrated-password'),
            password_encryption_migrated: true,
        });
        const updater = new AdapterUpdater(repository, cryptoParams);

        await updater.execute(id, { name: 'JustRenamed' });

        const row = await repository.connection('broker_adapters').where({ id }).first();
        expect(row.name).toBe('JustRenamed');
        expect(crypto.decryptData(row.password)).toBe('already-migrated-password');
    });

    it('auto-migrates a legacy password to GCM on any update when cryptoParams uses GCM and the adapter is not yet migrated', async () => {
        const legacyCrypto = new Crypto(secretIv, secretKey, legacyMethod);
        const id = await insertAdapter(repository, {
            password: legacyCrypto.encryptData('legacy-plain-password'),
            // password_encryption_migrated omitted -> falsy/NULL, "not yet migrated"
        });
        const cryptoParams = { secret_iv: secretIv, secret_key: secretKey, encryption_method: gcmMethod };
        const updater = new AdapterUpdater(repository, cryptoParams);

        await updater.execute(id, { name: 'TriggersMigration' });

        const row = await repository.connection('broker_adapters').where({ id }).first();
        expect(row.password_encryption_migrated).toBeTruthy();
        const gcmCrypto = new Crypto(secretIv, secretKey, gcmMethod);
        expect(gcmCrypto.decryptData(row.password)).toBe('legacy-plain-password');
    });

    it('does not auto-migrate when cryptoParams uses the legacy method (even if not yet migrated)', async () => {
        const legacyCrypto = new Crypto(secretIv, secretKey, legacyMethod);
        const originalEncrypted = legacyCrypto.encryptData('legacy-plain-password');
        const id = await insertAdapter(repository, { password: originalEncrypted });
        const cryptoParams = { secret_iv: secretIv, secret_key: secretKey, encryption_method: legacyMethod };
        const updater = new AdapterUpdater(repository, cryptoParams);

        await updater.execute(id, { name: 'NoMigration' });

        const row = await repository.connection('broker_adapters').where({ id }).first();
        expect(row.password).toBe(originalEncrypted);
        expect(row.password_encryption_migrated).toBeFalsy();
    });

    // Este test SOBRESCRIBE saveHistory con un jest.fn() (motivo de fallo inventado) para
    // probar la resiliencia de execute() ante CUALQUIER fallo de historial, sea cual sea la
    // causa. NO ejercita el saveHistory real heredado -- para eso ver el test siguiente, que
    // usa el repositorio sin sobrescribir nada.
    it('does not fail when saveHistory rejects, regardless of the reason (mocked failure)', async () => {
        const repositoryWithFailingHistory = new KnexAdapterSettingsRepository(knexConfig);
        const saveHistory = jest.fn().mockRejectedValue(new Error('history backend unavailable'));
        repositoryWithFailingHistory.saveHistory = saveHistory;
        const id = await insertAdapter(repositoryWithFailingHistory);
        const updater = new AdapterUpdater(repositoryWithFailingHistory);

        await updater.execute(id, { name: 'HistoryTested' });

        expect(saveHistory).toHaveBeenCalledTimes(1);
        const [historyArg] = saveHistory.mock.calls[0];
        expect(historyArg).toEqual({ id, updated: true, changes: { name: 'HistoryTested' } });
    });

    // BUG DE PRODUCCION (real, sin mockear saveHistory): `KnexRepository.saveHistory`
    // (heredado por KnexAdapterSettingsRepository) asume un AggregateRoot -- llama
    // `aggregate.toJson()`. Aqui `AdapterUpdater.js:80` le pasa un objeto plano
    // (`{ id, updated: true, changes: dto }`), que tampoco tiene `.toJson()`, asi que la
    // llamada real revienta con `TypeError: aggregate.toJson is not a function` igual que con
    // una `AdapterSettings` real. El try/catch de AdapterUpdater.js:78-83 se lo traga en
    // silencio (solo llama a Helper.logError(e)) -- por eso aqui se verifica el TypeError
    // concreto interceptando Helper.logError con un spy, en vez de mockear saveHistory: el
    // repositorio es el real, sin ninguna sobrescritura.
    it('BUG: the real (inherited, non-mocked) saveHistory always throws TypeError("aggregate.toJson is not a function"), and it is swallowed silently', async () => {
        const repository = new KnexAdapterSettingsRepository(knexConfig);
        const id = await insertAdapter(repository);
        const logErrorSpy = jest.spyOn(Helper, 'logError');
        const updater = new AdapterUpdater(repository);

        await updater.execute(id, { name: 'RealSaveHistoryBug' });

        expect(logErrorSpy).toHaveBeenCalledTimes(1);
        const [loggedError] = logErrorSpy.mock.calls[0];
        expect(loggedError).toBeInstanceOf(TypeError);
        expect(loggedError.message).toBe('aggregate.toJson is not a function');

        const row = await repository.connection('broker_adapters').where({ id }).first();
        expect(row.name).toBe('RealSaveHistoryBug');

        logErrorSpy.mockRestore();
    });

    it('skips saveHistory entirely when the collaborator does not implement it at all', async () => {
        const realRepository = new KnexAdapterSettingsRepository(knexConfig);
        const id = await insertAdapter(realRepository);
        const repositoryWithoutSaveHistory = {
            findById: realRepository.findById.bind(realRepository),
            update: realRepository.update.bind(realRepository),
        };
        expect(repositoryWithoutSaveHistory.saveHistory).toBeUndefined();
        const updater = new AdapterUpdater(repositoryWithoutSaveHistory);

        await updater.execute(id, { name: 'NoHistoryCollaborator' });

        const row = await realRepository.connection('broker_adapters').where({ id }).first();
        expect(row.name).toBe('NoHistoryCollaborator');
    });
});
