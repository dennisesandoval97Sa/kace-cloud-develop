import { ValueObjectUuid } from '../value-object/ValueObjectUuid.js';
import { Criteria } from '../../criteria/Criteria.js';
import { HistoryCounter } from '../HistoryCounter.js';
import { Helper } from '../../index';

export class SearchHistory {
    /** @type {KnexRepository} */
    #repository;
    /** @type {Counter} is initialized in the constructor */
    #counter;

    /**
     * @param {KnexRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
    }

    /**
     * Busca el historial de una entidad según los criterios dados y retorna una colección estándar.
     * @param {string} id - UUID de la entidad a buscar historial
     * @param {Object} dtoCriteria - Criterios de búsqueda (filter, relationship, limit, offset, order)
     * @returns {Promise<Object>} Respuesta estructurada con items y metadata
     */
    async execute(id, dtoCriteria) {
        try {
            const entityId = new ValueObjectUuid('entity_id', id);
            const historyTableName = `history_${this.#repository.tableName}`;
            const historyCounter = new HistoryCounter(this.#repository, historyTableName);

            const criteria = new Criteria(
                dtoCriteria.filter,
                dtoCriteria.relationship,
                dtoCriteria.limit,
                dtoCriteria.offset,
                dtoCriteria.order,
                historyTableName
            );

            const rows = await this.#repository.searchHistory(entityId, criteria);

            const count = await historyCounter.execute(dtoCriteria, entityId.value);
            const countResult = count.count ?? count['count(*)'];
            const countNumber = Number(countResult) || 0;
            return {
                data: {
                    items: rows.map((history) => ({
                        id: history.id.value,
                        entity_id: history.entity_id.value,
                        changed_attributes: history.changed_attributes.value,
                        new_attributes: history.new_attributes.value,
                        original_attributes: history.original_attributes.value,
                        creator_name: history.creator_name.value ?? 'Not registered',
                    })),
                },
                metadata: {
                    count: countNumber,
                },
            };
        } catch (error) {
            Helper.logError(error);
            throw error;
        }
    }
}
