import { v4 as uuidv4 } from 'uuid';
import { jest } from '@jest/globals';
import { MapperCreator } from '../../../../src/rabbitmq/application/create/MapperCreator.js';
import { KnexMapperRepository } from '../../../../src/rabbitmq/infrastructure/persistence/KnexMapperRepository.js';
import { Helper } from '../../../../src/shared/infrastructure/utils/Helper.js';
import { knexConfig } from '../../../knexfile.js';
import MapperMother from '../../domain/MapperMother.js';

describe('MapperCreator', () => {
    const repository = new KnexMapperRepository(knexConfig);

    it('generates a random mapper id (and rule ids) when the dto omits them', async () => {
        const dto = MapperMother.dto();
        delete dto.id;
        delete dto.rules[0].id;

        const creator = new MapperCreator(repository);

        const created = await creator.execute(dto);

        expect(created.id).toEqual(expect.any(String));
        expect(created.id.length).toBeGreaterThan(0);

        const stored = await repository.findById(created.id);
        expect(stored).not.toBeNull();
        expect(stored.name).toBe(dto.name);
        expect(stored.rules).toHaveLength(1);
        expect(stored.rules[0].id).toEqual(expect.any(String));
    });

    it('keeps the dto-provided mapper id and each rule id when present', async () => {
        const mapperId = uuidv4();
        const ruleId = uuidv4();
        const dto = MapperMother.dto({ id: mapperId, rules: [{ ...MapperMother.ruleDto({ id: ruleId }) }] });

        const creator = new MapperCreator(repository);
        const created = await creator.execute(dto);

        expect(created.id).toBe(mapperId);

        const stored = await repository.findById(mapperId);
        expect(stored.rules).toHaveLength(1);
        expect(stored.rules[0].id).toBe(ruleId);
    });

    // NOTA: `for (const r of dto.rules || []) { ... }` (MapperCreator.js:43) tiene un fallback
    // a `[]` para cuando `dto.rules` es falsy, pero es inalcanzable: `Mapper.create(dto)` (linea
    // 32, se ejecuta ANTES) ya exige `Array.isArray(rules)` y lanza `Mapper invalid: rules must
    // be an array` para cualquier valor no-array (incluido `undefined`/`null`). Y un array vacio
    // `[]` es truthy en JS, asi que tampoco activa el fallback (el bucle simplemente no itera).
    // Verificado: `delete dto.rules` hace que `Mapper.create()` lance antes de llegar a la linea 43.
    // Se documenta como codigo muerto, no se fuerza con un rodeo.
    it('throws a 400 CustomError when a mapper with the same id already exists', async () => {
        const mapperId = uuidv4();
        const creator = new MapperCreator(repository);
        await creator.execute(MapperMother.dto({ id: mapperId }));

        await expect(creator.execute(MapperMother.dto({ id: mapperId }))).rejects.toMatchObject({
            message: `Mapper with id ${mapperId} already exists`,
            statusCode: 400,
        });
    });

    // CORRECCION IMPORTANTE tras verificar en ejecucion: `KnexMapperRepository` SI expone
    // `saveHistory` -- lo hereda de la clase base `KnexRepository` (src/shared/infrastructure/
    // persistence/KnexRepository.js:233), que lo implementa genericamente para cualquier
    // repositorio. Por tanto, para CUALQUIER instancia real de `KnexMapperRepository`,
    // `this.#repository.saveHistory` es SIEMPRE truthy (ya cubierto por los 3 tests previos, que
    // usan el repositorio real sin decorar). La rama que de verdad hace falta forzar aparte es la
    // "false" (repositorio SIN saveHistory), solo alcanzable con un colaborador que no herede de
    // KnexRepository -- ver el test siguiente.
    // Este test SOBRESCRIBE saveHistory con un jest.fn() (motivo de fallo inventado) para
    // probar la resiliencia de execute() ante CUALQUIER fallo de historial, sea cual sea la
    // causa. NO ejercita el saveHistory real heredado -- para eso ver el test siguiente, que
    // usa el repositorio sin sobrescribir nada.
    it('does not fail when saveHistory rejects, regardless of the reason (mocked failure)', async () => {
        // Instancia real y propia (no un clone/Object.create): los campos privados de
        // KnexRepository viven en un WeakMap ligado a la instancia concreta, asi que clonar
        // via prototipo rompe `this` en sus metodos. Aqui solo se le agrega una propiedad
        // propia extra (`saveHistory`) a una instancia real conectada a Postgres.
        const repositoryWithHistory = new KnexMapperRepository(knexConfig);
        const saveHistory = jest.fn().mockRejectedValue(new Error('history backend unavailable'));
        repositoryWithHistory.saveHistory = saveHistory;
        const creator = new MapperCreator(repositoryWithHistory);
        const dto = MapperMother.dto();

        const created = await creator.execute(dto);

        expect(saveHistory).toHaveBeenCalledTimes(1);
        const [historyArg] = saveHistory.mock.calls[0];
        expect(historyArg.name).toBe(dto.name);
        // A pesar de que saveHistory rechaza, execute() no propaga el error.
        expect(created.id).toEqual(expect.any(String));

        const stored = await repository.findById(created.id);
        expect(stored).not.toBeNull();
    });

    // BUG DE PRODUCCION (real, sin mockear saveHistory): `KnexRepository.saveHistory`
    // (heredado por KnexMapperRepository desde src/shared/infrastructure/persistence/
    // KnexRepository.js:233) asume un AggregateRoot -- llama `aggregate.toJson()`. `Mapper`
    // (src/rabbitmq/domain/Mapper.js) NO extiende AggregateRoot y no tiene `.toJson()`, asi
    // que la llamada real revienta con `TypeError: aggregate.toJson is not a function`. El
    // try/catch de MapperCreator.js:53-58 se lo traga en silencio (solo llama a
    // Helper.logError(e)) -- por eso aqui se verifica el TypeError concreto interceptando
    // Helper.logError con un spy, en vez de mockear saveHistory: el repositorio es el real,
    // sin ninguna sobrescritura.
    it('BUG: the real (inherited, non-mocked) saveHistory always throws TypeError("aggregate.toJson is not a function") for a Mapper, and it is swallowed silently', async () => {
        const logErrorSpy = jest.spyOn(Helper, 'logError');
        const creator = new MapperCreator(repository);
        const dto = MapperMother.dto();

        const created = await creator.execute(dto);

        expect(created.id).toEqual(expect.any(String));
        expect(logErrorSpy).toHaveBeenCalledTimes(1);
        const [loggedError] = logErrorSpy.mock.calls[0];
        expect(loggedError).toBeInstanceOf(TypeError);
        expect(loggedError.message).toBe('aggregate.toJson is not a function');

        logErrorSpy.mockRestore();
    });

    it('skips saveHistory entirely when the collaborator does not implement it at all', async () => {
        const realRepository = new KnexMapperRepository(knexConfig);
        // Objeto plano que delega create/findById a la instancia real (misma BD, sin mocks),
        // pero que NO hereda de KnexRepository: no tiene `saveHistory` en absoluto, ni propio ni
        // heredado. Es la unica forma de alcanzar la rama "false" de `if (this.#repository.saveHistory)`.
        const repositoryWithoutSaveHistory = {
            create: realRepository.create.bind(realRepository),
            findById: realRepository.findById.bind(realRepository),
        };
        expect(repositoryWithoutSaveHistory.saveHistory).toBeUndefined();
        const creator = new MapperCreator(repositoryWithoutSaveHistory);
        const dto = MapperMother.dto();

        const created = await creator.execute(dto);

        const stored = await realRepository.findById(created.id);
        expect(stored).not.toBeNull();
        expect(stored.name).toBe(dto.name);
    });
});
