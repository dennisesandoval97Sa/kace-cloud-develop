import { Criteria } from '../../../shared';
import { Counter } from '../../../shared/domain/Counter';
import { AgendaCollectionResponse } from '../AgendaCollectionResponse';

export class AgendaSearcher {
    /**
     * @type {KnexAgendaRepository} is initialized in the constructor
     */
    #repository;

    /**
     * @type {Counter} is initialized in the constructor
     */
    #counter;

    constructor(repository) {
        this.#repository = repository;
        this.#counter = new Counter(repository);
    }

    /**
     * Executes the search of Agenda objects based on the criteria provided.
     *
     * @param {Object} criteria - The criteria to search for Agenda objects.
     * @returns {Promise<AgendaCollectionResponse>} A promise that resolves with the collection of Agenda objects found.
     */
    async execute({ filter, relationship, limit, offset, order }) {
        const tablename = this.#repository.tableName;
        const criteria = new Criteria(filter, relationship, limit, offset, order, tablename);

        const agendas = await this.#repository.search(criteria);
        const agendasCount = await this.#counter.execute({
            filter,
            relationship,
            limit,
            offset,
            order,
        });

        return new AgendaCollectionResponse(agendas, agendasCount);
    }
}
