import { Action } from '..';
import { KnexRepository } from '../../shared/index';
import { Helper } from '../../shared/infrastructure/utils/Helper.js';
import { QueryDBError } from '../../shared/errors/QueryDBError.js';

export class KnexActionRepository extends KnexRepository {
    constructor(config) {
        super(config, 'actions');
    }

    /**
     * Saves a new action record in the database.
     * @param {Action} action
     * @returns {Promise<void>}
     */
    async save(action) {
        try {
            await this.table().insert({
                id: action.id.value,
                action_type: action.action_type.value,
                description: action.description.value,
                conditions: action.conditions.value,
                permissions: action.permissions.value,
                triggers: JSON.stringify(action.triggers.value),
                state_id: action.state_id.value,
                group_id: action.group_id.value,
                responsible_id: action.responsible_id.value,
                template_id: action.template_id.value,
                mail_account_id: action.mail_account_id.value,
                advisor_list_id: action.advisor_list_id.value,
                group_list_id: action.group_list_id.value,
                ws_rest_flow_id: action.ws_rest_flow_id.value,
                model_update_id: action.model_update_id.value,
                external_group_code: action.external_group_code.value,
                external_user_code: action.external_user_code.value,
                external_group_dynamic_code: action.external_group_dynamic_code.value,
                external_user_dynamic_code: action.external_user_dynamic_code.value,
                priority: action.priority.value,
                is_active: action.is_active.value,
                automation_id: action.automation_id.value,
                entity: action.entity.value,
                created_at: action.created_at.value,
                created_by: action.created_by.value,
            });
        } catch (error) {
            Helper.logError('Error saving an action:', error);
            throw new QueryDBError('save');
        }
    }

    /**
     * Finds an action record by ID.
     * @param {ValueObjectUuid} id
     * @returns {Promise<Action | null>}
     */
    async find(id) {
        try {
            const result = await this.table().where({ id: id.value }).first();

            return result ? new Action(result) : null;
        } catch (error) {
            Helper.logError('Error finding action:', error);
            throw new QueryDBError('find');
        }
    }

    /**
     * Finds action records by description using ILIKE for case-insensitive search.
     * @param {ValueObjectDescription} description - The description to search for.
     * @returns {Promise<Action[]>}
     */
    async findByDescription(description) {
        try {
            const searchValue = `%${description.value.toLowerCase()}%`;

            let query = this.table().andWhere({ deleted_at: null }).first();

            query = query.whereRaw('"description" ILIKE ?', [searchValue]);

            const result = await query;

            return result ? new Action(result) : null;
        } catch (error) {
            Helper.logError('Error finding actions by description:', error);
            throw new QueryDBError('find');
        }
    }

    /**
     * Obtiene los datos necesarios y devuelve un JSON con la estructura especificada.
     * @param {Case} kase Case to be validated
     * @returns {Promise<Object>}
     */
    async getCasoInfo(kase) {
        try {
            if (!kase) {
                return null;
            }

            const aux_casos = await this.table('aux_cases')
                .where({ caso_id: kase.id.value })
                .select('data as aux_cases')
                .first();
            const clientes = await this.table('clients').where({ id: kase.cliente_id.value }).select('*').first();
            const aux_clientes = await this.table('aux_clients')
                .where({ cliente_id: kase.cliente_id.value })
                .select('data as aux_clients')
                .first();
            const clasificaciones = await this.table('clasificaciones')
                .where({ id: kase.clasificacion_id.value })
                .select('*')
                .first();
            // TODO(MSKT-1392): deriva el estado en vivo desde transiciones.siguiente_estado_id en
            // vez de leer la columna persistida cases.estado_id — mismo TODO que KnexEventRepository.
            const estados = await this.table('transiciones')
                .leftJoin(this.qualifiedName('estados'), 'transiciones.siguiente_estado_id', 'estados.id')
                .where({ 'transiciones.id': kase.transicion_id.value })
                .select('estados.id', 'estados.nombre')
                .first();

            if (clasificaciones) {
                const descriptionParts = Array.from({ length: 10 }, (_, i) => clasificaciones[`nivel${i + 1}`]).filter(
                    Boolean
                );
                clasificaciones.description = descriptionParts.join(' -> ');
            }

            const result = {
                cases: kase.toJson(),
                clients: clientes,
                ...aux_casos,
                ...aux_clientes,
                clasificaciones: clasificaciones,
                estados: {
                    id: estados?.id,
                    nombre: estados?.nombre,
                },
            };

            return result;
        } catch (error) {
            Helper.logError(error.message, error);
            throw new QueryDBError('custom', 'Transaction failed: error retrieving case information.');
        }
    }

    /**
     * Searches for `Action` instances based on the given criteria.
     *
     * @param {Object} criteria - The criteria for the search operation.
     * @returns {Promise<Action[]>} A promise that resolves to an array of `Action` instances matching the criteria.
     */
    async search(criteria) {
        try {
            const queryBuilder = this.table().select('*');

            criteria.convertToKnex(queryBuilder);

            queryBuilder.whereNull('deleted_by');

            const rows = await queryBuilder;
            return rows.map((row) => new Action(row));
        } catch (error) {
            Helper.logError('Error searching actions:', error);
            throw new QueryDBError('search');
        }
    }

    /**
     * Retrieves the schema ID associated with the 'aux_cases' table.
     * @returns {Promise<string | null>} The schema ID if found, otherwise null.
     * @throws {QueryDBError} If any database query error occurs.
     */
    async getAuxCasesSchemaId() {
        try {
            const auxDefinitionsTable = this.qualifiedName('aux_definitions');
            const schema = await this.table('schemas')
                .select('*')
                .where('id', function () {
                    this.select('schema_id')
                        .from(auxDefinitionsTable)
                        .where({ tablename: 'aux_cases' })
                        .whereNull('deleted_at')
                        .limit(1);
                })
                .first();

            if (!schema) return null;

            return schema.id;
        } catch (error) {
            Helper.logError('Error getting schema id', error);
            throw new QueryDBError('find', 'getSchemaId');
        }
    }
}
