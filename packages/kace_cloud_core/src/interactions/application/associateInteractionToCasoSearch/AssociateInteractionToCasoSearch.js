import { Criteria } from '../../../shared/index.js';
import { InteractionCounter } from '../../domain/InteractionCounter.js';
import { KnexAssociateInteractionToCasoRepo } from '../../infrastructure/persistence/KnexAssociateInteractionToCasoRepo.js';
import { KnexInteractionRepository } from '../../infrastructure/persistence/KnexInteractionRepository.js';
import { InteractionCollectionResponse } from '../InteractionCollectionResponse.js';

export class AssociateInteractionToCasoSearch {
    /**
     * @type {KnexAssociateInteractionToCasoRepo}
     * is initialized in the constructor
     */
    #repository;

    /**
     * @type {KnexInteractionRepository}
     * is initialized in the constructor
     */
    #interactionRepo;

    /** @type {InteractionCounter} is initialized in the constructor */
    #counter;

    /**
     *
     * @param {KnexAssociateInteractionToCasoRepo} repository
     * @param {KnexInteractionRepository} interactionRepo
     */
    constructor(repository, interactionRepo) {
        this.#repository = repository;
        this.#interactionRepo = interactionRepo;
        this.#counter = new InteractionCounter(interactionRepo);
    }

    /**
     *
     * @param {object} dtoCriteria criteria for filter interactions
     * @returns {Promise<InteractionCollectionResponse>} collection of interactions
     */
    async execute(dtoCriteria) {
        const tablename = this.#repository.tableName;
        const pivotCriteria = new Criteria(
            dtoCriteria.filter,
            dtoCriteria.relationships,
            dtoCriteria.limit,
            dtoCriteria.offset,
            dtoCriteria.order,
            tablename
        );

        const pivotRows = await this.#repository.search(pivotCriteria);

        const interactionIds = [...new Set(pivotRows.map((r) => r.interaction_id))];

        if (!interactionIds?.length) {
            return new InteractionCollectionResponse([], 0);
        }

        const filter = [
            {
                field: 'id',
                operator: 'in',
                value: interactionIds.join(','),
                type: 'AND',
            },
        ];

        const interactionCriteria = new Criteria(
            filter,
            dtoCriteria.relationships,
            dtoCriteria.limit,
            dtoCriteria.offset,
            dtoCriteria.order,
            this.#interactionRepo.tableName
        );

        const result = await this.#interactionRepo.search(interactionCriteria);
        const counter = await this.#counter.execute(interactionCriteria);
        return new InteractionCollectionResponse(result, counter);
    }
}
