import { RelationsRepository } from '../../../infrastructure/relations/RelationsRepository.js';
import { RelationsCollectionResponse } from './RelationsCollectionResponse.js';
import { Criteria } from '../../../criteria/Criteria.js';
import { Helper } from '../../../infrastructure/utils/Helper.js';

/**
 * @class RelationsGetEntities
 * @description Application service that retrieves all relations or unique entities.
 */
export class RelationsGetEntities {
    /** @type {RelationsRepository} */
    #repository;

    /** @type {KnexAuxDefinitionsRepository} */
    #definitionsRepository;

    constructor(repository, definitionsRepository) {
        this.#repository = repository;
        this.#definitionsRepository = definitionsRepository;
    }

    /**
     * Executes the use case.
     * @param {{ unique?: boolean }} [options]
     * @returns {Promise<RelationsCollectionResponse>}
     */
    async execute() {
        const relations = this.#repository.findAll();
        const uniqueEntityes = [];

        relations.forEach((relation) => {
            if (!uniqueEntityes.includes(relation.entity.value)) {
                uniqueEntityes.push(relation.entity.value);
            }
        });

        const criteria = new Criteria(
            [
                {
                    field: 'is_active',
                    operator: 'eq',
                    value: true,
                    type: 'and',
                },
            ],
            null,
            null,
            0,
            {
                field: 'name',
                direction: 'asc',
            },
            'aux_definitions'
        );
        const auxiliaries = await this.#definitionsRepository.search(criteria);

        if (!auxiliaries) {
            return uniqueEntityes;
        }

        for (const aux of auxiliaries) {
            uniqueEntityes.push(aux.tablename.value);
        }

        return uniqueEntityes;
    }
}
