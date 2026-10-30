import { v4 as uuidv4 } from 'uuid';
import { jest } from '@jest/globals';
import { AdapterSearcher } from '../../../../src/rabbitmq/application/search/AdapterSearcher.js';
import { AdapterCollectionResponse } from '../../../../src/rabbitmq/application/AdapterCollectionResponse.js';
import { KnexAdapterSettingsRepository } from '../../../../src/rabbitmq/infrastructure/persistence/KnexAdapterSettingsRepository.js';
import { knexConfig } from '../../../knexfile.js';

describe('AdapterSearcher', () => {
    const repository = new KnexAdapterSettingsRepository(knexConfig);

    it('builds its own AdapterCounter (default, not passed) and returns a matching collection', async () => {
        const name = `Adapter-${uuidv4()}`;
        await repository.connection('broker_adapters').insert({
            id: uuidv4(),
            name,
            host: 'broker.local',
            port: 5672,
            queue: 'q1',
        });
        const searcher = new AdapterSearcher(repository);

        const result = await searcher.execute({
            filter: [{ field: 'name', operator: 'eq', value: name, type: 'AND' }],
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: undefined,
        });

        expect(result).toBeInstanceOf(AdapterCollectionResponse);
        const json = result.toJson();
        expect(json.data.items).toHaveLength(1);
        expect(json.data.items[0].name).toBe(name);
        // BUG DE PRODUCCION: `KnexAdapterSettingsRepository.count()` (a diferencia de
        // `KnexMapperRepository.count()`, que SI desenvuelve el resultado a un `number`)
        // devuelve la fila cruda de postgres tal cual (`{count: '1'}`), y `AdapterCounter.execute()`
        // la reenvia sin desenvolver como `{count: {count: '1'}}`. `AdapterSearcher` pasa ese
        // objeto completo como `metadata.count` en vez de un numero. Se documenta el
        // comportamiento observado (no se corrige: solo tests).
        expect(json.metadata.count).toEqual({ count: '1' });
    });

    it('uses an explicitly injected counter instead of building its own', async () => {
        const name = `Adapter-${uuidv4()}`;
        await repository.connection('broker_adapters').insert({
            id: uuidv4(),
            name,
            host: 'broker.local',
            port: 5672,
            queue: 'q1',
        });
        const injectedCounter = { execute: jest.fn().mockResolvedValue({ count: 42 }) };
        const searcher = new AdapterSearcher(repository, injectedCounter);

        const result = await searcher.execute({
            filter: [{ field: 'name', operator: 'eq', value: name, type: 'AND' }],
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: undefined,
        });

        expect(injectedCounter.execute).toHaveBeenCalledTimes(1);
        expect(result.toJson().metadata.count).toBe(42);
    });
});
