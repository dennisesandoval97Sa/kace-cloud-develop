import { Criteria, StatusEnum } from '../../shared/index.js';

/**
 * Resolves an ACTIVE group from an external code, encapsulating the
 * `codigo_externo = ?` query and the `codigos_externos` jsonb array fallback.
 *
 * Inactive (and soft-deleted) groups are treated as "not found" so the callers
 * keep falling through to their own fallback — usually the classification's
 * default group — instead of assigning cases to a group that no longer operates.
 */
export class ActiveGroupFinderByExternalCode {
    /** @type {KnexGroupsRepository} is initialized in the constructor */
    #repository;

    /**
     * @param {KnexGroupsRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
    }

    /**
     * @param {string} externalCode
     * @returns {Promise<Groups|null>} the matching active group, or null.
     */
    async execute(externalCode) {
        let groups = await this.#repository.search(this.#criteriaByExternalCode(externalCode));

        if (!groups || !groups.length) {
            groups = await this.#repository.search(this.#criteriaByExternalCodes(externalCode));
        }

        return groups && groups.length ? groups[0] : null;
    }

    #criteriaByExternalCode(externalCode) {
        return this.#buildCriteria({
            field: 'codigo_externo',
            operator: 'eq',
            value: `${externalCode}`,
            type: 'AND',
        });
    }

    #criteriaByExternalCodes(externalCode) {
        return this.#buildCriteria({
            field: 'codigos_externos',
            operator: 'jsonArrayValue',
            value: `${externalCode}`,
            type: 'AND',
        });
    }

    #buildCriteria(externalCodeFilter) {
        const filters = [
            externalCodeFilter,
            {
                field: 'status',
                operator: 'eq',
                value: StatusEnum.ACTIVE.value,
                type: 'AND',
            },
            {
                field: 'deleted_at',
                operator: 'null',
                value: 'null',
                type: 'AND',
            },
        ];

        const limit = 1;
        const offset = 0;
        return new Criteria(filters, null, limit, offset, null, this.#repository.tableName);
    }
}
