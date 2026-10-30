import { v4 as uuidv4 } from 'uuid';
import Chance from 'chance';

export default class MapperMother {
    /**
     * Generates a Data Transfer Object (DTO) for the Mapper entity.
     *
     * @param {Object} overrides - Values to override defaults
     * @returns {Object} The DTO containing the properties for a Mapper entity.
     */
    static dto(overrides = {}) {
        return {
            id: overrides.id ?? uuidv4(),
            name: overrides.name ?? 'Test Mapper',
            rest_flow_id: overrides.rest_flow_id ?? uuidv4(),
            queue: overrides.queue ?? 'test-queue',
            rules: overrides.rules ?? [
                {
                    id: uuidv4(),
                    target_entity: 'cases',
                    target_field: 'reference',
                    source_field: 'payload.ref',
                    parse_to: 'string',
                },
            ],
            created_at: overrides.created_at ?? new Date().toISOString(),
            created_by: overrides.created_by ?? uuidv4(),
        };
    }

    /**
     * Generates a random DTO using Chance.js.
     *
     * @param {Object} overrides - Values to override random defaults
     * @returns {Object} The DTO with random properties.
     */
    static randomDto(overrides = {}) {
        const chance = new Chance();
        const parseToOptions = ['string', 'number', 'boolean', 'datetime', null];
        return {
            id: uuidv4(),
            name: chance.string({ length: 12, alpha: true }),
            rest_flow_id: uuidv4(),
            queue: chance.string({ length: 10, alpha: true }),
            rules: [
                {
                    id: uuidv4(),
                    target_entity: chance.string({ length: 8, alpha: true }),
                    target_field: chance.string({ length: 8, alpha: true }),
                    source_field: `payload.${chance.string({ length: 6, alpha: true })}`,
                    parse_to: chance.pickone(parseToOptions),
                },
            ],
            created_at: new Date().toISOString(),
            created_by: uuidv4(),
            ...overrides,
        };
    }

    /**
     * Creates a Mapper directly in the database via repository.
     *
     * @param {KnexMapperRepository} repository - The repository to save the Mapper.
     * @param {Object} overrides - Values to override defaults
     * @returns {Promise<Mapper>} The created Mapper DTO.
     */
    static async createMapper(repository, overrides = {}) {
        const dto = MapperMother.dto(overrides);
        await repository.create(dto);
        return dto;
    }

    /**
     * Creates a Mapper with random data directly in the database.
     *
     * @param {KnexMapperRepository} repository - The repository to save the Mapper.
     * @param {Object} overrides - Values to override random defaults
     * @returns {Promise<Object>} The created Mapper DTO.
     */
    static async createRandomMapper(repository, overrides = {}) {
        const dto = MapperMother.randomDto(overrides);
        await repository.create(dto);
        return dto;
    }

    /**
     * Generates a DTO for a mapper rule.
     *
     * @param {Object} overrides - Values to override defaults
     * @returns {Object} A single rule DTO.
     */
    static ruleDto(overrides = {}) {
        return {
            id: overrides.id ?? uuidv4(),
            target_entity: overrides.target_entity ?? 'cases',
            target_field: overrides.target_field ?? 'reference',
            source_field: overrides.source_field ?? 'payload.ref',
            parse_to: overrides.parse_to ?? null,
        };
    }
}
