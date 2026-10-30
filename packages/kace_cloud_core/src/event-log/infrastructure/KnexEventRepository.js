import { EventLog } from '../index.js';
import { EntityCache, Helper, InvalidArgumentError, KnexRepository } from '../../shared/index.js';
import { QueryDBError } from '../../shared/errors/QueryDBError.js';
import { DbRequestContext } from '../../shared/infrastructure/context/DbRequestContext.js';

const EVENT_LOGS_COUNT_NAMESPACE = 'event_logs:countByCase';
const EVENT_LOGS_TTL_MS = 300_000;

export class KnexEventRepository extends KnexRepository {
    constructor(config, readerConfig = null) {
        super(config, 'event_logs', readerConfig);
    }

    /**
     * Saves an event instance to the repository.
     * @param {EventLog} event - The event instance to save.
     * @returns {Promise<EventLog>}
     */
    async save(event) {
        try {
            DbRequestContext.markWrite();
            const [insertedRecord] = await this.table()
                .insert({
                    id: event.id.value,
                    event_name: event.event_name.value,
                    occurred_at: event.occurred_at.value,
                    initiated_by_user: event.initiated_by_user.value,
                    aggregate_id: event.aggregate_id.value,
                    body: JSON.stringify(event.body.value),
                    old_data: JSON.stringify(event.old_data.value),
                    case_id: event.case_id?.value || null,
                    client_id: event.client_id?.value || null,
                })
                .returning('*');

            if (event.case_id?.value) {
                EntityCache.invalidate(EVENT_LOGS_COUNT_NAMESPACE, event.case_id.value);
            }
            return new EventLog(insertedRecord);
        } catch (error) {
            Helper.logInfo(error);
            throw new QueryDBError('save');
        }
    }

    /**
     * Finds an event by ID.
     * @param {ValueObjectUuid} id - The ID of the event to find.
     * @returns {Promise<Event|null>}
     */
    async find(id) {
        try {
            if (!id?.value) throw new InvalidArgumentError('ID must be provided');

            const result = await this.read.table('event_logs').where({ id: id.value }).first();

            return result ? new EventLog(result) : null;
        } catch (error) {
            Helper.logInfo('Error finding event', error);
            throw new QueryDBError('find');
        }
    }

    /**
     * Searches for events based on criteria.
     * @param {Object} criteria - The criteria for the search operation.
     * @returns {Promise<Event[]>} A promise that resolves to an array of `Event` instances matching the criteria.
     */
    async search(criteria) {
        try {
            const queryBuilder = this.read.table('event_logs').select('*');
            criteria.convertToKnex(queryBuilder);

            const rows = await queryBuilder;
            return rows.map((row) => new EventLog(row));
        } catch (error) {
            Helper.logInfo('Error searching events', error);
            throw new QueryDBError('search');
        }
    }

    /**
     * Counts the number of events based on criteria.
     * @param {Object} criteria
     * @returns {Promise<number>}
     */
    async count(criteria) {
        try {
            const query = criteria.convertToKnex(this.read.table('event_logs').count());
            const [row] = await query;
            return row;
        } catch (error) {
            Helper.logInfo('Error counting events', error);
            throw new QueryDBError('count');
        }
    }

    /**
     * Finds events by case_id.
     * @param {ValueObjectUuid} case_id - The Case ID to match with events.
     * @param {Object} criteria - The criteria for the search operation.
     * @returns {Promise<Event|null>}
     */
    async getEventsByCaseId(case_id, criteria) {
        try {
            if (!case_id?.value) throw new InvalidArgumentError('ID must be provided');
            const queryBuilder = this.read.table('event_logs').select('*').where({ case_id: case_id.value });
            criteria.convertToKnex(queryBuilder);

            const rows = await queryBuilder;
            return rows.map((row) => new EventLog(row));
        } catch (error) {
            Helper.logInfo(error);
            throw new QueryDBError('getEventsByCaseId');
        }
    }

    /**
     * Counts the number of events based on Case ID.
     * @param {ValueObjectUuid} case_id - The Case ID to match with events.
     * @returns {Promise<number>}
     */
    async countEventByCaseId(case_id) {
        try {
            if (!case_id?.value) throw new InvalidArgumentError('ID must be provided');
            return await EntityCache.get(
                EVENT_LOGS_COUNT_NAMESPACE,
                case_id.value,
                async () => {
                    const queryBuilder = this.read
                        .table('event_logs')
                        .count('* as count')
                        .where({ case_id: case_id.value })
                        .first();
                    const rows = await queryBuilder;
                    return Number(rows.count);
                },
                EVENT_LOGS_TTL_MS
            );
        } catch (error) {
            Helper.logInfo('Error counting events', error);
            throw new QueryDBError('count');
        }
    }

    /**
     * Gets the estate (estado) by transition ID.
     * Joins the 'transiciones' and 'estados' tables to find the next state.
     *
     * @param {ValueObjectUuid} transitionID - The transition ID (transiciones.id)
     * @returns {Promise<Object|null>} - The estado with 'id' and 'nombre', or null if not found.
     */
    async getStateByTransitionID(transitionID) {
        try {
            // TODO(MSKT-1392): deriva el estado en vivo desde transiciones.siguiente_estado_id;
            // cases.estado_id es ahora la columna persistida y fuente de verdad (ver
            // KnexCaseRepository#estadoIdFromTransition). Hoy coinciden porque todo write path
            // los mantiene sincronizados, pero son dos fuentes de verdad, no una.
            const estado = await this.read
                .table('transiciones')
                .leftJoin(this.qualifiedName('estados'), 'transiciones.siguiente_estado_id', 'estados.id')
                .where({ 'transiciones.id': transitionID.value })
                .select('estados.id', 'estados.nombre', 'estados.descripcion', 'estados.icon_class')
                .first();

            return estado || null;
        } catch (error) {
            Helper.logInfo('Error in getStateByTransitionID', error);
            throw new QueryDBError('custom', 'Error in getting estate by transition ID');
        }
    }

    /**
     * Gets a user by their ID.
     *
     * @param {ValueObjectUuid} userID - The ID of the user to retrieve.
     * @returns {Promise<Object|null>} - Returns user object or null if not found.
     */
    async getUserByID(userID) {
        try {
            const user = await this.read
                .table('usuarios')
                .select('id', 'nombres', 'apellido1', 'apellido2', 'account_type')
                .where({ id: userID.value })
                .first();

            return user || null;
        } catch (error) {
            Helper.logInfo('Error in getUserByID', error);
            throw new QueryDBError('custom', 'Error getting user by ID');
        }
    }

    /**
     * Gets a flow by its ID.
     *
     * @param {ValueObjectUuid} flowID - The ID of the flow to retrieve.
     * @returns {Promise<Object|null>} - Returns the flow object or null if not found.
     */
    async getFlowByID(flowID) {
        try {
            const flow = await this.read
                .table('ws_rest_flows')
                .select('id', 'description')
                .where({ id: flowID.value })
                .first();

            return flow || null;
        } catch (error) {
            Helper.logInfo('Error in getFlowByID', error);
            throw new QueryDBError('custom', 'Error getting flow by ID');
        }
    }
}
