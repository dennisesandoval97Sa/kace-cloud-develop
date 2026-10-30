import { ValueObjectUuid, CustomError, Helper } from '../../../shared/index.js';
import { DomainMapperFinder } from '../../domain/DomainMapperFinder.js';

export class MapperUpdater {
    /** @type {Object} repository */
    #repository;

    /** @type {DomainMapperFinder} */
    #mapperFinder;

    constructor(repository) {
        this.#repository = repository;
        this.#mapperFinder = new DomainMapperFinder(repository);
    }

    /**
     * Update a mapper after validating existence and id format.
     * @param {string} id
     * @param {Object} dto
     */
    async execute(id, dto) {
        const validId = new ValueObjectUuid('id', id).value;

        const existing = await this.#mapperFinder.execute(validId);
        if (!existing) throw new CustomError(`Mapper with id ${validId} not found`, 404);

        const rules = Array.isArray(dto.rules) ? dto.rules.map((r) => ({ ...r, mapper_id: validId })) : undefined;
        const changes = { ...dto, ...(rules ? { rules } : {}) };

        const result = await this.#repository.update(validId, changes);

        if (this.#repository.saveHistory) {
            try {
                await this.#repository.saveHistory({ id: validId, updated: true, changes: dto });
            } catch (e) {
                Helper.logError(e);
                // history save failure should not block update
            }
        }

        return result;
    }
}
