import { jest } from '@jest/globals';
import { MapperSearcher } from '../../../../src/rabbitmq/application/search/MapperSearcher.js';
import { MapperCollectionResponse } from '../../../../src/rabbitmq/application/MapperCollectionResponse.js';
import { KnexMapperRepository } from '../../../../src/rabbitmq/infrastructure/persistence/KnexMapperRepository.js';
import { knexConfig } from '../../../knexfile.js';
import MapperMother from '../../domain/MapperMother.js';

describe('MapperSearcher', () => {
    const repository = new KnexMapperRepository(knexConfig);

    it('builds its own MapperCounter (default, not passed) and returns a matching collection', async () => {
        const dto = MapperMother.dto();
        await repository.create(dto);
        const searcher = new MapperSearcher(repository);

        const result = await searcher.execute({
            filter: [{ field: 'name', operator: 'eq', value: dto.name, type: 'AND' }],
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: undefined,
        });

        expect(result).toBeInstanceOf(MapperCollectionResponse);
        const json = result.toJson();
        expect(json.data.items).toHaveLength(1);
        expect(json.data.items[0].name).toBe(dto.name);
        expect(json.metadata.count).toBe(1);
    });

    it('uses an explicitly injected counter instead of building its own', async () => {
        const dto = MapperMother.dto();
        await repository.create(dto);
        const injectedCounter = { execute: jest.fn().mockResolvedValue({ count: 99 }) };
        const searcher = new MapperSearcher(repository, injectedCounter);

        const result = await searcher.execute({
            filter: [{ field: 'name', operator: 'eq', value: dto.name, type: 'AND' }],
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: undefined,
        });

        expect(injectedCounter.execute).toHaveBeenCalledTimes(1);
        expect(result.toJson().metadata.count).toBe(99);
    });
});
