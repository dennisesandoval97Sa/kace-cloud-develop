import { Helper, KnexRepository, ValueObject } from '../../../shared/index.js';
import { QueryDBError } from '../../../shared/errors/QueryDBError.js';
import { DbRequestContext } from '../../../shared/infrastructure/context/DbRequestContext.js';

export class KnexAssociateInteractionToCasoRepo extends KnexRepository {
    constructor(config, readerConfig = null) {
        super(config, 'interaction_casos', readerConfig);
    }

    /**
     *
     * @param {object} dto data for insert
     * @returns {Promise<void>}
     */
    async save(dto, { trx } = {}) {
        try {
            // Direct insert into a pivot table with no history table → mark the write manually so
            // read-after-write routes subsequent reads to the writer (Tier C).
            DbRequestContext.markWrite();
            await (trx ? this.trxTable(trx) : this.table()).insert({
                interaction_id: dto.interaction_id,
                caso_id: dto.caso_id,
                created_by: dto.created_by,
                created_at: dto.created_at,
            });
        } catch (error) {
            Helper.logInfo(error);
            throw new QueryDBError('save');
        }
    }

    /**
     * @param {string} interactionId
     * @param {string} casoId
     * @throws {CustomError}
     */
    async exists(interactionId, casoId, { trx } = {}) {
        try {
            const row = await (trx ? this.trxTable(trx) : this.table())
                .where({ interaction_id: interactionId, caso_id: casoId })
                .first();
            return !!row;
        } catch (error) {
            Helper.logError(error);
            throw new QueryDBError('find');
        }
    }

    /**
     * @param {string} interactionId
     * @returns {Promise<{caso_id: string}[]>}
     */
    async findByInteractionId(interactionId) {
        try {
            const rows = await this.table()
                .where({ interaction_id: interactionId })
                .whereNull('deleted_by')
                .select('caso_id');
            return rows;
        } catch (error) {
            Helper.logError(error);
            throw new QueryDBError('findByInteractionId');
        }
    }

    /**
     * @param {Criteria} criteria
     * @returns {Promise<AsociateInteractionCase[]>}
     */
    async search(criteria) {
        try {
            const queryBuilder = this.read.table('interaction_casos').select('*');

            criteria.convertToKnex(queryBuilder);

            queryBuilder.whereNull('deleted_by');

            const rows = await queryBuilder;
            return rows;
        } catch (error) {
            Helper.logError(error);
            throw new QueryDBError('search associate interaction case');
        }
    }
}
