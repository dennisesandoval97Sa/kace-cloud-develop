import { EntityCache, StatusEnum } from '../../../shared';
import { KnexRepository } from '../../../shared/infrastructure/persistence/KnexRepository';
import { Transitions } from '../../domain/Transitions';
import { Helper } from '../../../shared/infrastructure/utils/Helper.js';
import Creator from '../../../shared/domain/aggregates/Creator.js';
import { QueryDBError } from '../../../shared/errors/QueryDBError.js';
import { DbRequestContext } from '../../../shared/infrastructure/context/DbRequestContext.js';

const TRANSITIONS_NAMESPACE = 'transitions';
const TRANSITIONS_TTL_MS = 120_000;

export class KnexTransitionsRepository extends KnexRepository {
    /**
     *
     * @param {Knex} config
     */
    constructor(config, readerConfig = null) {
        super(config, 'transiciones', readerConfig);
    }

    /**
     *
     * @param {object} dto Data Transfer Object for insert data
     * @param {import('knex').Knex.Transaction} [trx]
     * @returns {Promise<void>}
     */
    async save(dto, trx = null) {
        try {
            DbRequestContext.markWrite();
            await (trx ? this.trxTable(trx) : this.table()).insert({
                id: dto.id.value,
                estado_actual_id: dto.estado_actual_id.value,
                siguiente_estado_id: dto.siguiente_estado_id.value,
                flujo_id: dto.flujo_id.value,
                status: dto.status.value,
                created_at: dto.created_at.value,
                created_by: dto.created_by.value,
                ans_id: dto.ans_id.value,
                is_visible: dto.is_visible.value,
                rule_id: dto.rule_id.value,
            });
            EntityCache.invalidate(TRANSITIONS_NAMESPACE, dto.id.value);
        } catch (error) {
            Helper.logError(error.message, error);
            throw new QueryDBError('save');
        }
    }

    async update(transition, trx = null) {
        await super.update(transition, trx);
        EntityCache.invalidate(TRANSITIONS_NAMESPACE, transition.id.value);
    }

    /**
     *
     * @param {import('../../../shared/index.js').ValueObjectUuid} id id of the transition to search
     * @param {object} [options={}] options
     * @param {boolean} [options.skipCache=false] if true, bypass cache and read fresh
     * @returns {Promise<Transitions>}
     */
    async find(id, { skipCache = false } = {}) {
        try {
            const fetcher = async () => {
                const result = await this.table()
                    .where({ id: id.value })
                    .andWhere({ status: StatusEnum.ACTIVE.value })
                    .first();
                return !result ? null : new Transitions(result);
            };
            if (skipCache) {
                return await fetcher();
            }
            return await EntityCache.get(TRANSITIONS_NAMESPACE, id.value, fetcher, TRANSITIONS_TTL_MS);
        } catch (error) {
            Helper.logError(error.message, error);
            throw new QueryDBError('find');
        }
    }

    /**
     *
     * @param {Criteria} criteria
     * @returns {Promise<Transitions[]>}
     */
    async search(criteria) {
        try {
            const queryBuilder = this.read.table('transiciones').select(`${this.tableName}.*`);
            queryBuilder
                .select(
                    `${this.tableName}.id as id`,
                    'usuarios.id as creator_id',
                    'usuarios.nombres',
                    'usuarios.apellido1',
                    'usuarios.apellido2'
                )
                .leftJoin(this.qualifiedName('usuarios'), `${this.tableName}.created_by`, 'usuarios.id');
            criteria.convertToKnex(queryBuilder);
            const rows = await queryBuilder;

            return rows.map(
                (row) => new Transitions({ ...row, id: row.id }, new Creator({ ...row, id: row.creator_id }))
            );
        } catch (error) {
            Helper.logError(error.message, error);
            throw new QueryDBError('search');
        }
    }

    /**
     * Finds transitions that use a specific state as source or target.
     *
     * @param {import('../../../shared/index.js').ValueObjectUuid} stateId - The state ID to search for.
     * @returns {Promise<Array>} Array of transitions using the state.
     */
    async findByStateId(stateId) {
        try {
            const rows = await this.table()
                .where(function () {
                    this.where('estado_actual_id', stateId.value).orWhere('siguiente_estado_id', stateId.value);
                })
                .andWhere('deleted_at', null)
                .select('*');

            return rows.map((row) => new Transitions(row));
        } catch (error) {
            Helper.logError(error.message, error);
            throw new QueryDBError('search');
        }
    }

    /**
     * Finds the most recent transition matching the business key
     * (flujo_id, estado_actual_id, siguiente_estado_id).
     *
     * @param {string} flujoId
     * @param {string|null} estadoActualId - null for the initial edge of a flow.
     * @param {string} siguienteEstadoId
     * @returns {Promise<Transitions|null>}
     */
    async findByFlowAndTriplet(flujoId, estadoActualId, siguienteEstadoId) {
        try {
            const query = this.table()
                .where({ flujo_id: flujoId })
                .andWhere({ siguiente_estado_id: siguienteEstadoId });

            if (estadoActualId === null || estadoActualId === undefined) {
                query.whereNull('estado_actual_id');
            } else {
                query.andWhere({ estado_actual_id: estadoActualId });
            }

            const row = await query.orderBy('created_at', 'desc').first();

            return !row ? null : new Transitions(row);
        } catch (error) {
            Helper.logError(error.message, error);
            throw new QueryDBError('findByFlowAndTriplet');
        }
    }

    /**
     * Returns all transitions for a given flujo_id.
     *
     * @param {string} flujoId
     * @returns {Promise<Transitions[]>}
     */
    async findByFlowId(flujoId) {
        try {
            const rows = await this.table().where({ flujo_id: flujoId }).orderBy('created_at', 'desc').select('*');
            return rows.map((row) => new Transitions(row));
        } catch (error) {
            Helper.logError(error.message, error);
            throw new QueryDBError('findByFlowId');
        }
    }
}
