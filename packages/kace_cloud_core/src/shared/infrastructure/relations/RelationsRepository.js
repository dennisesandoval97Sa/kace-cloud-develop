import { RELATIONS_LIST } from './RELATIONS_LIST.js';
import { Relations } from '../../domain/aggregates/Relations.js';
import { Helper } from '../utils/Helper.js';

/**
 * @class RelationsRepository
 * @description Infrastructure repository that provides read access to predefined relations.
 */
export class RelationsRepository {
    /**
     * Returns all relations as domain aggregates.
     * @returns {Relations[]}
     */
    findAll() {
        return RELATIONS_LIST.map(item => Relations.create({
            ...item
        }));
    }

    /**
     * Finds all relations for a given entity.
     * @param {string} entityName
     * @returns {Relations[]}
     */
    findByEntity(entityName) {
        const entities = RELATIONS_LIST.filter(r => r.entity === entityName);
        Helper.logDebug('filterByEntity', entityName,entities)

        const relations = entities.map(r => Relations.create({...r}))
        Helper.logDebug('relations', relations)

        return relations;
    }

}
