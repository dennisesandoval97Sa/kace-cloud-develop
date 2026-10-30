import { Counter } from '../Counter';

export class AnsCasesCounter {
    /** @type {Counter} is initialized in the constructor*/
    #counter;
    /** @type {Counter} is initialized in the constructor*/
    #caseRepository;

    /**
     * Constructor for AnsCasesCounterService.
     * @param {KnexCaseRepository} caseRepository - Instance of CaseRepository.
     */
    constructor(caseRepository) {
        this.#caseRepository = caseRepository;
        this.#counter = new Counter(caseRepository);
    }

    /**
     * Execute the case counting process for a given ID.
     * @async
     * @param {('group' | 'responsible')} type - The type of ID ('group' or 'responsible').
     * @param {string} id - ID of the group, responsible, or ans to count cases for.
     * @returns {Promise<{ expired: number, intermediate: number, notExpired: number }>} - Object with counts of expired, intermediate, and not expired cases.
     */
    async execute(type, id) {
        const criteria = this.#generateCriteria(type, id);
        const expired = await this.#counter.execute(criteria.expired);
        const intermediate = await this.#counter.execute(criteria.intermediate);
        const notExpired = await this.#counter.execute(criteria.notExpired);

        return {
            expired,
            intermediate,
            notExpired,
        };
    }

    /**
     * Execute the case counting process for multiple users
     * @param {('group' | 'responsible')} type - The type of ID
     * @param {string[]} ids - Array of user IDs
     * @returns {Promise<Map<string, { expired: number, intermediate: number, notExpired: number }>>}
     */
    async executeForMultiple(type, ids) {
        if (!ids.length) return new Map();

        const idFields = {
            group: 'grupo_id',
            responsible: 'responsable_id',
        };

        const counts = await this.#caseRepository.getCasesCountByUsers({
            idField: idFields[type],
            ids,
        });

        return this.#formatResults(counts);
    }

    /**
     * Generate criteria for counting cases.
     * @param {string} id - ID to generate criteria for.
     * @param {('group' | 'responsible')} type - The type of ID ('group' or 'responsible').
     * @returns {{ expired: object, intermediate: object, notExpired: object }} - Criteria objects for different case statuses.
     */
    #generateCriteria(type, id) {
        const idFields = {
            group: 'grupo_id',
            responsible: 'responsable_id',
        };

        const idField = idFields[`${type}`];

        if (!idField) {
            throw new Error(`Invalid type provided: ${type}. Valid types are 'group', 'responsible', 'ans'.`);
        }

        const createDtoCriteria = (position) => ({
            filter: [
                { field: idField, operator: 'eq', value: id, type: 'and' },
                { field: 'ans_posicion', operator: 'eq', value: position, type: 'and' },
                { field: 'fecha_resolucion', operator: 'null', value: 'null', type: 'and' },
            ],
            relationship: undefined,
            limit: null,
            offset: 0,
            order: null,
        });

        return {
            expired: createDtoCriteria(3),
            intermediate: createDtoCriteria(2),
            notExpired: createDtoCriteria(1),
        };
    }

    #formatResults(counts) {
        const resultMap = new Map();

        counts.forEach((row) => {
            resultMap.set(row.id, {
                expired: row.posicion_3 || 0,
                intermediate: row.posicion_2 || 0,
                notExpired: row.posicion_1 || 0,
            });
        });

        return resultMap;
    }
}
