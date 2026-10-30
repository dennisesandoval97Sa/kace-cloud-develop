import { Flow } from '../../index';
import { KnexRepository, StatusEnum } from '../../../shared';
import { Helper } from '../../../shared/infrastructure/utils/Helper.js';
import { QueryDBError } from '../../../shared/errors/QueryDBError.js';
import { Criteria } from '../../../shared/criteria/Criteria.js';
import { KnexCaseRepository } from '../../../cases/index.js';

export class KnexFlowRepository extends KnexRepository {
    constructor(config) {
        super(config, 'flujos');
    }

    /**
     *
     * @param {Flow} dto
     * @param {import('knex').Knex.Transaction} [trx]
     * @throws {QueryDBError}
     */

    async save(dto, trx = null) {
        try {
            await (trx ? this.trxTable(trx) : this.table()).insert({
                id: dto.id.value,
                nombre: dto.nombre.value,
                json_flujo: dto.json_flujo.value,
                status: dto.status.value,
                created_at: dto.created_at.value,
                created_by: dto.created_by.value,
            });
        } catch (error) {
            Helper.logInfo(error);
            throw new QueryDBError('save');
        }
    }

    /**
     *
     * @param {ValueObjectUuid} id Id for search
     * @returns {null|Object}
     * @throws {QueryDBError}
     */
    async find(id) {
        try {
            const result = await this.table().where({ id: id.value }).whereNull('deleted_at').first('*');

            return !result ? null : new Flow(result);
        } catch (error) {
            Helper.logInfo(error);
            throw new QueryDBError('find');
        }
    }

    /**
     *
     * @param {Criteria} criteria
     * @returns {Promise<Flow[]>}
     */
    async search(criteria) {
        try {
            // SONAR-EXC: Se deja el TODO ya que es deuda tecnica que se resolverá a futuro
            const queryBuilder = this.table().select('*'); //TODO: Agregar en el select los campos a traer: tener en cuenta relaciones

            criteria.convertToKnex(queryBuilder);

            queryBuilder.whereNull('deleted_by');

            const rows = await queryBuilder;

            /**
             * FRAGMENTO PARA INCLUIR KACE_TRANSITION DE FORMA RETROACTIVA
             *
             */
            for (const row of rows) {
                const edges = row.json_flujo.edges;

                if (edges && edges.length > 0) {
                    for (const edge of edges) {
                        if (edge.kace_transition) {
                            continue;
                        }

                        const dto = {
                            filter: [
                                {
                                    field: 'estado_actual_id',
                                    operator: edge.source === '0' ? 'null' : 'eq',
                                    value: edge.source === '0' ? 'null' : edge.source,
                                    type: 'AND',
                                },
                                {
                                    field: 'siguiente_estado_id',
                                    operator: 'eq',
                                    value: edge.target,
                                    type: 'AND',
                                },
                            ],
                            order: {
                                field: 'created_at',
                                direction: 'desc',
                            },
                            limit: 10,
                            offset: 0,
                        };

                        const transitionsCriteria = new Criteria(
                            dto.filter,
                            dto.relationship,
                            dto.limit,
                            dto.offset,
                            dto.order,
                            'transiciones'
                        );

                        const transitionQuery = this.table('transiciones').select('*');
                        transitionsCriteria.convertToKnex(transitionQuery);
                        const transition = await transitionQuery;

                        edge.kace_transition = transition.length > 0 ? transition[0].id : null;
                    }

                    row.json_flujo.edges = edges;

                    await this.table()
                        .update({ json_flujo: row.json_flujo })
                        .where({ id: row.id })
                        .whereNull('deleted_at');
                }
            }
            /**
             * FINAL DEL FRAGMENTO PARA INCLUIR KACE_TRANSITION DE FORMA RETROACTIVA
             *
             */

            return rows.map((row) => new Flow(row));
        } catch (error) {
            Helper.logInfo(error);
            throw new QueryDBError('search');
        }
    }

    /**
     *
     * @param {ValueObjectUuid} id
     * @returns {Promise<boolen>}
     */
    async validateFlowIsInUse(id) {
        try {
            const transitions = await this.table('transiciones')
                .select('id')
                .where({ flujo_id: id.value })
                .andWhere({ status: StatusEnum.ACTIVE.value })
                .first('*');

            if (transitions !== undefined && transitions.id !== null) {
                const hasCaseRelation = await this.table('cases')
                    .select('id')
                    .where({ transicion_id: transitions.id })
                    .first('id');

                return hasCaseRelation;
            }

            return false;
        } catch (error) {
            Helper.logInfo(error);
            throw new QueryDBError('custom', 'An error ocurred validating if flow is in usee');
        }
    }

    /**
     *
     * @param {String} flujo_id
     * @param {Array} activeIds
     * @param {import('knex').Knex.Transaction} [trx]
     * @returns {null|Promise<boolean>}
     * @throws {QueryDBError}
     */
    async updateTransitionStatus(flujo_id, activeIds, trx = null) {
        if (!Array.isArray(activeIds) || activeIds.length === 0) {
            return null;
        }

        try {
            const tableRef = trx ? this.trxTable(trx, 'transiciones') : this.table('transiciones');
            const rawRef = trx ? trx : this.connection;
            await tableRef.where({ flujo_id }).update({
                status: rawRef.raw(
                    `CASE
                            WHEN id IN (${activeIds.map(() => '?').join(', ')})
                            THEN CAST(? AS smallint)
                            ELSE CAST(? AS smallint)
                        END`,
                    [...activeIds, StatusEnum.ACTIVE.value, StatusEnum.INACTIVE.value]
                ),
            });
            return true;
        } catch (err) {
            Helper.logInfo(err);
            throw new QueryDBError('custom', 'Error validando updateTransitionStatus');
        }
    }
}
