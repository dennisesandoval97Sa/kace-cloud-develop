import { WSRestFlow } from '../../index';
import { KnexRepository } from '../../../shared';
import { Helper } from '../../../shared/infrastructure/utils/Helper.js';
import { QueryDBError } from '../../../shared/errors/QueryDBError.js';
import { DbRequestContext } from '../../../shared/infrastructure/context/DbRequestContext.js';

export class KnexWSRestFlowRepository extends KnexRepository {
    constructor(config, readerConfig = null) {
        super(config, 'ws_rest_flows', readerConfig);
    }

    /**
     * Saves a new WS REST flow in the database.
     * @param {WSRestFlow} flow
     * @returns {Promise<void>}
     */
    async save(flow) {
        try {
            DbRequestContext.markWrite();
            await this.table().insert({
                id: flow.id.value,
                description: flow.description.value,
                external_code: flow.external_code.value,
                json_diagram_properties: flow.json_diagram_properties.value,
                is_primary: flow.is_primary.value,
                is_active: flow.is_active.value,
                created_at: flow.created_at.value,
                created_by: flow.created_by.value,
                deleted_at: flow.deleted_at.value,
                deleted_by: flow.deleted_by.value,
            });
        } catch (error) {
            Helper.logError(`Error saving WS REST flow: ${error}`);
            throw new QueryDBError('save');
        }
    }

    /**
     * Finds a WS REST flow by ID.
     * @param {ValueObjectUuid} id
     * @returns {Promise<WSRestFlow | null>}
     */
    async find(id) {
        try {
            const result = await this.read.table(this.tableName).where({ id: id.value }).first();

            return result ? new WSRestFlow(result) : null;
        } catch (error) {
            Helper.logError('Error finding WS REST flow:', error);
            throw new QueryDBError('find');
        }
    }

    /**
     * Searches for `WSRestFlow` instances based on the given criteria.
     *
     * @param {Object} criteria - The criteria for the search operation.
     * @returns {Promise<WSRestFlow[]>} A promise that resolves to an array of `WSRestFlow` instances matching the criteria.
     */
    async search(criteria) {
        try {
            const queryBuilder = this.read.table(this.tableName).select('*');

            criteria.convertToKnex(queryBuilder);

            queryBuilder.whereNull('deleted_by');

            const rows = await queryBuilder;

            return rows.map((row) => new WSRestFlow(row));
        } catch (error) {
            Helper.logError('Error searching WS REST flows:', error);
            throw new QueryDBError('search');
        }
    }

    async findByExternalCode(externalCode) {
        try {
            const result = await this.read
                .table(this.tableName)
                .where({ external_code: externalCode })
                .whereNull('deleted_at')
                .first();
            return result ? new WSRestFlow(result) : null;
        } catch (error) {
            Helper.logInfo(error);
            throw new QueryDBError('findByExternalCode');
        }
    }

    async isValidChannelHubFlow(id, externalCode, { allowVariants = false } = {}) {
        try {
            const query = this.read
                .table(this.tableName)
                .select('id')
                .where({
                    id: id.value,
                    is_active: true,
                    is_primary: true,
                })
                .whereNull('deleted_at')
                .whereNull('deleted_by');

            if (allowVariants) {
                query.andWhere((variantQuery) => {
                    variantQuery
                        .where('external_code', externalCode)
                        .orWhere('external_code', 'like', `${externalCode}-%`)
                        .orWhere('external_code', 'like', `${externalCode}_%`);
                });
            } else {
                query.andWhere('external_code', externalCode);
            }

            const result = await query.first();

            return Boolean(result);
        } catch (error) {
            Helper.logInfo(error);
            throw new QueryDBError('isValidChannelHubFlow');
        }
    }

    async isValidChannelHubRegistrationFlow(id) {
        return this.isValidChannelHubFlow(id, 'channelhub-connection', { allowVariants: true });
    }
}
