import { v4 as uuidv4 } from 'uuid';
import { jest } from '@jest/globals';
import { AdapterCreator } from '../../../../src/rabbitmq/application/create/AdapterCreator.js';
import { KnexAdapterSettingsRepository } from '../../../../src/rabbitmq/infrastructure/persistence/KnexAdapterSettingsRepository.js';
import { Crypto } from '../../../../src/shared/domain/crypto/index.js';
import { Helper } from '../../../../src/shared/infrastructure/utils/Helper.js';
import { knexConfig } from '../../../knexfile.js';

const baseDto = (overrides = {}) => ({
    id: uuidv4(),
    name: `Adapter-${uuidv4()}`,
    host: 'broker.local',
    port: 5672,
    queue: 'test-queue',
    ...overrides,
});

describe('AdapterCreator', () => {
    const repository = new KnexAdapterSettingsRepository(knexConfig);
    const secretKey = process.env.SECRET_KEY || '12345678901234567890123456789012';
    const secretIv = process.env.SECRET_IV || '1234567890123456';

    it('creates an adapter without cryptoParams (default, not passed)', async () => {
        const dto = baseDto();
        const creator = new AdapterCreator(repository);

        const result = await creator.execute(dto);

        expect(result.name).toBe(dto.name);
        const stored = await repository.findById(dto.id);
        expect(stored).not.toBeNull();
        expect(stored.name).toBe(dto.name);
    });

    it('treats a missing dto as an empty object (Object.entries(dto || {})) and fails AdapterSettings validation', async () => {
        const creator = new AdapterCreator(repository);

        await expect(creator.execute(undefined)).rejects.toThrow();
    });

    it('normalizes empty-string values: nulls nullable fields, drops non-nullable ones', async () => {
        const dto = baseDto({ exchange: '', vhost: '', username: '', password: '', name: 'kept-name' });
        const creator = new AdapterCreator(repository);

        const result = await creator.execute(dto);

        expect(result.name).toBe('kept-name');
        const stored = await repository.findById(dto.id);
        expect(stored.exchange).toBeNull();
        expect(stored.vhost).toBeNull();
        expect(stored.username).toBeNull();
    });

    it('silently drops a non-nullable field sent as an empty string (host is required, not in nullableFields)', async () => {
        const dto = baseDto({ host: '' });
        const creator = new AdapterCreator(repository);

        // `host` queda fuera de `cleanedDto` (no esta en `nullableFields`, asi que un '' no se
        // convierte en null: simplemente se omite), y ValueObjectHost exige un valor no vacio.
        await expect(creator.execute(dto)).rejects.toThrow('host is required');
    });

    it('does not touch cryptoParams-dependent fields when cryptoParams is set but there is no password', async () => {
        const cryptoParams = {
            secret_iv: secretIv,
            secret_key: secretKey,
            encryption_method: Crypto.ENCRYPTION_METHOD,
        };
        const dto = baseDto();
        const creator = new AdapterCreator(repository, cryptoParams);

        const result = await creator.execute(dto);

        expect(result.password).toBeNull();
        expect(result.password_encryption_migrated.value).toBeUndefined();
    });

    it('encrypts the password and marks password_encryption_migrated=true when using the current encryption method', async () => {
        const cryptoParams = {
            secret_iv: secretIv,
            secret_key: secretKey,
            encryption_method: Crypto.ENCRYPTION_METHOD,
        };
        const dto = baseDto({ password: 'super-secret' });
        const creator = new AdapterCreator(repository, cryptoParams);

        const result = await creator.execute(dto);

        expect(result.password).not.toBe('super-secret');
        expect(result.password_encryption_migrated.value).toBe(true);
    });

    it('leaves password_encryption_migrated=null when using the legacy encryption method', async () => {
        const cryptoParams = {
            secret_iv: secretIv,
            secret_key: secretKey,
            encryption_method: Crypto.LEGACY_ENCRYPTION_METHOD,
        };
        const dto = baseDto({ password: 'super-secret' });
        const creator = new AdapterCreator(repository, cryptoParams);

        const result = await creator.execute(dto);

        expect(result.password).not.toBe('super-secret');
        expect(result.password_encryption_migrated.value).toBeNull();
    });

    // `id` es PK NOT NULL en `broker_adapters` (ver migracion 20251203132240_table_broker_adapter.js:
    // `table.string('id', 36).primary()`), asi que un adapter sin id nunca sobrevive a un INSERT real:
    // esta rama solo puede observarse en el nivel de AdapterCreator (que NO debe llamar a
    // adapterFinder.findById cuando adapter.id es falsy), no en la fila persistida. Se usa un
    // colaborador con `create`/`findById` en memoria solo para esta aserción de control de flujo;
    // el resto de este archivo prueba `create()` contra la base real.
    it('skips the id-uniqueness lookup entirely when the dto has no id', async () => {
        const dto = baseDto();
        delete dto.id;
        const findById = jest.fn();
        const create = jest.fn().mockImplementation(async (adapter) => adapter);
        const creator = new AdapterCreator({ findById, create });

        const result = await creator.execute(dto);

        expect(findById).not.toHaveBeenCalled();
        expect(create).toHaveBeenCalledTimes(1);
        expect(result.id).toBeNull();
        expect(result.name).toBe(dto.name);
    });

    it('throws a 400 CustomError when an adapter with the same id already exists', async () => {
        const dto = baseDto();
        const creator = new AdapterCreator(repository);
        await creator.execute(dto);

        await expect(creator.execute(baseDto({ id: dto.id }))).rejects.toMatchObject({
            message: `Adapter with id ${dto.id} already exists`,
            statusCode: 400,
        });
    });

    // Este test MOCKEA saveHistory (motivo de fallo inventado) para probar la resiliencia de
    // execute() ante CUALQUIER fallo de historial, sea cual sea la causa. NO ejercita el
    // saveHistory real heredado -- para eso ver el test siguiente, que usa el repositorio sin
    // sobrescribir nada.
    it('does not fail when saveHistory rejects, regardless of the reason (mocked failure)', async () => {
        const repositoryWithFailingHistory = new KnexAdapterSettingsRepository(knexConfig);
        const saveHistory = jest.fn().mockRejectedValue(new Error('history backend unavailable'));
        repositoryWithFailingHistory.saveHistory = saveHistory;
        const creator = new AdapterCreator(repositoryWithFailingHistory);
        const dto = baseDto();

        const result = await creator.execute(dto);

        expect(saveHistory).toHaveBeenCalledTimes(1);
        expect(result.name).toBe(dto.name);
    });

    // BUG DE PRODUCCION (real, sin mockear saveHistory): `KnexRepository.saveHistory`
    // (heredado por KnexAdapterSettingsRepository desde src/shared/infrastructure/persistence/
    // KnexRepository.js:233) asume un AggregateRoot -- llama `aggregate.toJson()` y
    // `aggregate.changedAttributes`. `AdapterSettings` (src/rabbitmq/domain/AdapterSettings.js)
    // NO extiende AggregateRoot y no tiene `.toJson()`, asi que la llamada real revienta con
    // `TypeError: aggregate.toJson is not a function`. El try/catch de AdapterCreator.js:70-75
    // se lo traga en silencio (solo llama a Helper.logError) -- por eso aqui se verifica el
    // TypeError concreto interceptando Helper.logError con un spy, en vez de mockear
    // saveHistory: el repositorio es el real, sin ninguna sobrescritura.
    it('BUG: the real (inherited, non-mocked) saveHistory always throws TypeError("aggregate.toJson is not a function") for an AdapterSettings, and it is swallowed silently', async () => {
        const repository = new KnexAdapterSettingsRepository(knexConfig);
        const logErrorSpy = jest.spyOn(Helper, 'logError');
        const creator = new AdapterCreator(repository);
        const dto = baseDto();

        const result = await creator.execute(dto);

        expect(result.name).toBe(dto.name);
        expect(logErrorSpy).toHaveBeenCalledWith(
            'AdapterCreator.saveHistory failed',
            'aggregate.toJson is not a function'
        );

        logErrorSpy.mockRestore();
    });

    it('falls back to logging the raw rejection value when it has no .message (empty-message Error)', async () => {
        const repositoryWithFailingHistory = new KnexAdapterSettingsRepository(knexConfig);
        // `new Error()` sin argumento tiene `.message === ''` (falsy): ejercita el lado `: e`
        // del ternario `e && e.message ? e.message : e` en AdapterCreator.js:74.
        const saveHistory = jest.fn().mockRejectedValue(new Error());
        repositoryWithFailingHistory.saveHistory = saveHistory;
        const creator = new AdapterCreator(repositoryWithFailingHistory);
        const dto = baseDto();

        const result = await creator.execute(dto);

        expect(saveHistory).toHaveBeenCalledTimes(1);
        expect(result.name).toBe(dto.name);
    });

    it('skips saveHistory entirely when the collaborator does not implement it at all', async () => {
        const realRepository = new KnexAdapterSettingsRepository(knexConfig);
        const repositoryWithoutSaveHistory = {
            create: realRepository.create.bind(realRepository),
            findById: realRepository.findById.bind(realRepository),
        };
        expect(repositoryWithoutSaveHistory.saveHistory).toBeUndefined();
        const creator = new AdapterCreator(repositoryWithoutSaveHistory);
        const dto = baseDto();

        const result = await creator.execute(dto);

        const stored = await realRepository.findById(dto.id);
        expect(stored).not.toBeNull();
        expect(result.name).toBe(dto.name);
    });
});
