import { v4 as uuidv4 } from 'uuid';
import { MapperFinder } from '../../../../src/rabbitmq/application/find/MapperFinder.js';
import { MapperResponse } from '../../../../src/rabbitmq/application/MapperResponse.js';
import { KnexMapperRepository } from '../../../../src/rabbitmq/infrastructure/persistence/KnexMapperRepository.js';
import { knexConfig } from '../../../knexfile.js';
import MapperMother from '../../domain/MapperMother.js';

describe('MapperFinder', () => {
    const repository = new KnexMapperRepository(knexConfig);

    it('returns null when the mapper does not exist', async () => {
        const finder = new MapperFinder(repository);

        const result = await finder.execute(uuidv4());

        expect(result).toBeNull();
    });

    it('returns a MapperResponse wrapping the found mapper', async () => {
        const dto = MapperMother.dto();
        await repository.create(dto);
        const finder = new MapperFinder(repository);

        const result = await finder.execute(dto.id);

        expect(result).toBeInstanceOf(MapperResponse);
        expect(result.toJson().data.name).toBe(dto.name);
    });
});
