import { EntityCache } from '../../../shared/infrastructure/cache/EntityCache.js';
import { KnexRepository } from '../../../shared/infrastructure/persistence/KnexRepository.js';
import { ValueObjectUuid } from '../../../shared/domain/value-object/ValueObjectUuid.js';
import { Helper } from '../../../shared/infrastructure/utils/Helper.js';
import { QueryDBError } from '../../../shared/errors/QueryDBError.js';
import { WSRestWorkflowStep } from '../../domain/WSRestWorkflowStep.js';
import { Criteria } from '../../../shared/criteria/Criteria.js';
import { ValueObjectString } from '../../../shared/index.js';
import { DbRequestContext } from '../../../shared/infrastructure/context/DbRequestContext.js';

const WORKFLOW_STEPS_NAMESPACE = 'workflow_steps';
const WORKFLOW_STEPS_TTL_MS = 120_000;

export class KnexWSRestWorkflowStepRepository extends KnexRepository {
    /**
     * Creates an instance of KnexWSRestWorkflowStepRepository
     * @param {Knex.Config | function} config
     */
    constructor(config, readerConfig = null) {
        super(config, 'ws_rest_workflow_steps', readerConfig);
    }

    /**
     *
     * @param {WSRestWorkflowStep} restWorkflowStep
     */
    async save(restWorkflowStep) {
        try {
            DbRequestContext.markWrite();
            await this.table().insert({
                id: restWorkflowStep.id.value,
                flow_id: restWorkflowStep.flow_id.value,
                order: restWorkflowStep.order.value,
                endpoint_id: restWorkflowStep.endpoint_id.value,
                function_id: restWorkflowStep.function_id.value,
                conditional_id: restWorkflowStep.conditional_id.value,
                created_at: restWorkflowStep.created_at.value,
                created_by: restWorkflowStep.created_by.value,
            });
            EntityCache.invalidate(WORKFLOW_STEPS_NAMESPACE, restWorkflowStep.id.value);
        } catch (error) {
            Helper.logError('Error saving rest workflow step', error);
            throw new QueryDBError('save');
        }
    }

    /**
     * Update a rest workflow step in the database
     * @param {WSRestWorkflowStep} restWorkflowStep
     * @returns {Promise<void>}
     * @throws {InvalidArgumentError}
     */
    async update(restWorkflowStep) {
        try {
            DbRequestContext.markWrite();
            await this.table().where({ id: restWorkflowStep.id.value }).update(restWorkflowStep.changedAttributes);
            EntityCache.invalidate(WORKFLOW_STEPS_NAMESPACE, restWorkflowStep.id.value);
        } catch (error) {
            Helper.logError('Error updating rest workflow step', error);
            throw new QueryDBError('update');
        }
    }

    /**
     * Find a rest workflow step by id
     * @param {ValueObjectUuid} id
     * @returns {Promise<WSRestWorkflowStep|null>}
     * @throws {InvalidArgumentError}
     */
    async find(id) {
        try {
            return await EntityCache.get(
                WORKFLOW_STEPS_NAMESPACE,
                id.value,
                async () => {
                    const restWorkflowStep = await this.read.table(this.tableName).where({ id: id.value }).first();
                    return restWorkflowStep ? new WSRestWorkflowStep(restWorkflowStep) : null;
                },
                WORKFLOW_STEPS_TTL_MS
            );
        } catch (error) {
            Helper.logError('Error finding rest workflow step', error);
            throw new QueryDBError('find');
        }
    }

    /**
     * Search for rest workflow steps based on criteria
     * @param {Criteria} criteria
     * @returns {Promise<WSRestWorkflowStep[]>}
     */
    async search(criteria) {
        try {
            const queryBuilder = this.read.table(this.tableName).select('*');
            const query = criteria.convertToKnex(queryBuilder);

            const restWorkflowSteps = await query;
            return restWorkflowSteps.map((restWorkflowStep) => new WSRestWorkflowStep(restWorkflowStep));
        } catch (error) {
            Helper.logError('Error searching rest workflow steps', error);
            throw new QueryDBError('search');
        }
    }

    /**
     * Delete all steps for a given flow ID
     * @param {string} flowId - The flow ID
     * @returns {Promise<void>}
     */
    async deleteByFlowId(flowId) {
        try {
            DbRequestContext.markWrite();
            const deletedCount = await this.table().where({ flow_id: flowId }).del();
            EntityCache.invalidateNamespace(WORKFLOW_STEPS_NAMESPACE);
            return deletedCount;
        } catch (error) {
            Helper.logError('Error deleting rest workflow steps by flow_id', error);
            throw new QueryDBError('deleteByFlowId', error.message);
        }
    }

    /**
     * @param {ValueObjectString} externalCode
     * @returns {Promise<ValueObjectUuid|null>}
     */
    async findFlowIdByExternalCode(externalCode) {
        let flow = null;

        try {
            flow = await this.read
                .table('ws_rest_flows')
                .where('external_code', externalCode.value)
                .where('is_active', true)
                .select('id')
                .first();
        } catch (error) {
            Helper.logError('Error finding flow ID by external code', error);
            throw new QueryDBError('findFlowIdByExternalCode', error.message);
        }

        if (!flow || !flow.id) {
            throw new QueryDBError('Flow not found');
        }

        return new ValueObjectUuid('flow_id', flow.id);
    }

    /**
     * Find all workflow steps by flow id with relations
     *
     * @param {ValueObjectUuid} flowId
     *
     * @param {Object} options
     * @param {boolean} options.loadEndpoint - Whether to load the endpoint relation
     * @param {boolean} options.loadFunction - Whether to load the function relation
     * @param {boolean} options.loadConditional - Whether to load the conditional relation
     */
    async findByFlowIdWithRelations(flowId, options = {}) {
        try {
            let query = this.read
                .table(this.tableName)
                .where(`${this.tableName}.flow_id`, flowId.value)
                .whereNull(`${this.tableName}.deleted_at`)
                .orderBy(`${this.tableName}.order`, 'asc')
                .select(`${this.tableName}.*`);

            query.join(this.qualifiedName('ws_rest_flows'), `${this.tableName}.flow_id`, 'ws_rest_flows.id');

            query.select([
                'ws_rest_flows.id as flow_id',
                'ws_rest_flows.initial_context as flow_initial_context',
                'ws_rest_flows.description as flow_description',
                'ws_rest_flows.external_code as flow_external_code',
                'ws_rest_flows.json_diagram_properties as flow_json_diagram_properties',
                'ws_rest_flows.is_active as flow_is_active',
                'ws_rest_flows.created_at as flow_created_at',
                'ws_rest_flows.created_by as flow_created_by',
                'ws_rest_flows.updated_at as flow_updated_at',
                'ws_rest_flows.updated_by as flow_updated_by',
            ]);

            if (options.loadEndpoint) {
                query.leftJoin(
                    this.qualifiedName('ws_rest_endpoints'),
                    `${this.tableName}.endpoint_id`,
                    'ws_rest_endpoints.id'
                );
                query.select([
                    'ws_rest_endpoints.id as endpoint_id',
                    'ws_rest_endpoints.description as endpoint_description',
                    'ws_rest_endpoints.type as endpoint_type',
                    'ws_rest_endpoints.url as endpoint_url',
                    'ws_rest_endpoints.method as endpoint_method',
                    'ws_rest_endpoints.headers as endpoint_headers',
                    'ws_rest_endpoints.body as endpoint_body',
                    'ws_rest_endpoints.body_type as endpoint_body_type',
                    'ws_rest_endpoints.is_dynamic_body as endpoint_is_dynamic_body',
                    'ws_rest_endpoints.is_active as endpoint_is_active',
                    'ws_rest_endpoints.created_at as endpoint_created_at',
                    'ws_rest_endpoints.created_by as endpoint_created_by',
                    'ws_rest_endpoints.updated_at as endpoint_updated_at',
                    'ws_rest_endpoints.updated_by as endpoint_updated_by',
                    'ws_rest_endpoints.authorization_id as endpoint_authorization_id',
                    'ws_rest_endpoints.is_dynamic_header as endpoint_is_dynamic_header',
                    'ws_rest_endpoints.filter_input as endpoint_filter_input',
                    'ws_rest_endpoints.context_position as endpoint_context_position',
                    'ws_rest_endpoints.on_success as endpoint_on_success',
                    'ws_rest_endpoints.on_error as endpoint_on_error',
                    'ws_rest_endpoints.attempts as endpoint_attempts',
                ]);

                query.leftJoin(
                    `${this.qualifiedName('ws_rest_endpoints')} as auth_endpoint`,
                    'ws_rest_endpoints.authorization_id',
                    'auth_endpoint.id'
                );
                query.select([
                    'auth_endpoint.id as auth_id',
                    'auth_endpoint.description as auth_description',
                    'auth_endpoint.type as auth_type',
                    'auth_endpoint.url as auth_url',
                    'auth_endpoint.method as auth_method',
                    'auth_endpoint.headers as auth_headers',
                    'auth_endpoint.body as auth_body',
                    'auth_endpoint.is_dynamic_body as auth_is_dynamic_body',
                    'auth_endpoint.is_active as auth_is_active',
                    'auth_endpoint.created_at as auth_created_at',
                    'auth_endpoint.created_by as auth_created_by',
                    'auth_endpoint.updated_at as auth_updated_at',
                    'auth_endpoint.updated_by as auth_updated_by',
                    'auth_endpoint.is_dynamic_header as auth_is_dynamic_header',
                    'auth_endpoint.filter_input as auth_filter_input',
                    'auth_endpoint.context_position as auth_context_position',
                    'auth_endpoint.on_success as auth_on_success',
                    'auth_endpoint.on_error as auth_on_error',
                    'auth_endpoint.attempts as auth_attempts',
                    'auth_endpoint.cache_expires_in_path as auth_cache_expires_in_path',
                    'auth_endpoint.cache_default_ttl_seconds as auth_cache_default_ttl_seconds',
                ]);
            }

            if (options.loadFunction) {
                query.leftJoin(
                    this.qualifiedName('ws_rest_functions'),
                    `${this.tableName}.function_id`,
                    'ws_rest_functions.id'
                );
                query.select([
                    'ws_rest_functions.id as function_id',
                    'ws_rest_functions.description as function_description',
                    'ws_rest_functions.type as function_type',
                    'ws_rest_functions.filter_input as function_filter_input',
                    'ws_rest_functions.context_position as function_context_position',
                    'ws_rest_functions.value_static as function_value_static',
                    'ws_rest_functions.value_dynamic as function_value_dynamic',
                    'ws_rest_functions.is_active as function_is_active',
                    'ws_rest_functions.created_at as function_created_at',
                    'ws_rest_functions.created_by as function_created_by',
                    'ws_rest_functions.updated_at as function_updated_at',
                    'ws_rest_functions.updated_by as function_updated_by',
                    'ws_rest_functions.deleted_at as function_deleted_at',
                    'ws_rest_functions.deleted_by as function_deleted_by',
                ]);
            }

            if (options.loadConditional) {
                query.leftJoin(
                    this.qualifiedName('ws_rest_conditionals'),
                    `${this.tableName}.conditional_id`,
                    'ws_rest_conditionals.id'
                );
                query.select([
                    'ws_rest_conditionals.id as conditional_id',
                    'ws_rest_conditionals.satisfied as conditional_satisfied',
                    'ws_rest_conditionals.unsatisfied as conditional_unsatisfied',
                    'ws_rest_conditionals.input_path_a as conditional_input_path_a',
                    'ws_rest_conditionals.input_path_b as conditional_input_path_b',
                    'ws_rest_conditionals.operator as conditional_operator',
                    'ws_rest_conditionals.created_at as conditional_created_at',
                    'ws_rest_conditionals.created_by as conditional_created_by',
                ]);
            }

            const results = await query;

            Helper.logDebug('Raw results from findByFlowIdWithRelations', {
                count: results.length,
                allSteps: results.map((r) => ({
                    step_id: r.id,
                    order: r.order,
                    step_conditional_id: r.conditional_id,
                    conditional_table_id: r.conditional_id,
                    has_conditional_data: r.conditional_satisfied !== undefined && r.conditional_satisfied !== null,
                })),
            });

            return results.map((result) => this.#mapRowToWorkflowStepWithRelations(result, options));
        } catch (error) {
            Helper.logError('Error finding workflow steps with relations', error);
            throw new QueryDBError('findByFlowIdWithRelations', error.message);
        }
    }

    /**
     * Map the database row to a workflow step object with relations
     *
     * @param {Object} row - The database row
     * @param {Object} options - Options for loading relations
     * @param {boolean} options.loadEndpoint - Whether to load the endpoint relation
     * @param {boolean} options.loadFunction - Whether to load the function relation
     *
     * @return {Object} The mapped workflow step object with relations
     * @private
     */
    #mapRowToWorkflowStepWithRelations(row, options) {
        /**
         * Local function to parse JSON fields
         *
         * @param {string} value - The value to parse
         * @returns {Object|string} The parsed JSON object or the original value
         */
        const parseJsonField = (value) => {
            if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
                try {
                    return JSON.parse(value);
                } catch {
                    // SI: error al parsear JSON no afecta el flujo, devolvemos el valor original sin interrupciones.
                    return value;
                }
            }
            return value;
        };

        const workflowStep = {
            step: {
                id: row.id,
                flow_id: row.flow_id,
                order: row.order,
                endpoint_id: row.endpoint_id,
                function_id: row.function_id,
                conditional_id: row.conditional_id,
                created_at: row.created_at,
                created_by: row.created_by,
            },
            flow: null,
            endpoint: null,
            function: null,
            conditional: null,
        };

        if (row.flow_id) {
            workflowStep.flow = {
                id: row.flow_id,
                description: row.flow_description,
                initial_context: row.flow_initial_context,
                external_code: row.flow_external_code,
                json_diagram_properties: parseJsonField(row.flow_json_diagram_properties),
                is_active: row.flow_is_active,
                created_at: row.flow_created_at,
                created_by: row.flow_created_by,
            };
        }

        if (options.loadEndpoint && row.endpoint_id) {
            workflowStep.endpoint = {
                id: row.endpoint_id,
                description: row.endpoint_description,
                type: row.endpoint_type,
                url: row.endpoint_url,
                method: row.endpoint_method,
                headers: parseJsonField(row.endpoint_headers),
                body: parseJsonField(row.endpoint_body),
                body_type: row.endpoint_body_type ?? 'json',
                is_dynamic_body: row.endpoint_is_dynamic_body,
                is_active: row.endpoint_is_active,
                authorization_id: row.endpoint_authorization_id,
                is_dynamic_header: row.endpoint_is_dynamic_header,
                filter_input: parseJsonField(row.endpoint_filter_input),
                context_position: parseJsonField(row.endpoint_context_position),
                on_success: parseJsonField(row.endpoint_on_success),
                on_error: parseJsonField(row.endpoint_on_error),
                attempts: row.endpoint_attempts,
                created_at: row.endpoint_created_at,
                created_by: row.endpoint_created_by,
            };

            if (row.auth_id) {
                workflowStep.endpoint.authorization = {
                    id: row.auth_id,
                    description: row.auth_description,
                    type: row.auth_type,
                    url: row.auth_url,
                    method: row.auth_method,
                    headers: parseJsonField(row.auth_headers),
                    body: parseJsonField(row.auth_body),
                    is_dynamic_body: row.auth_is_dynamic_body,
                    is_active: row.auth_is_active,
                    is_dynamic_header: row.auth_is_dynamic_header,
                    filter_input: parseJsonField(row.auth_filter_input),
                    context_position: parseJsonField(row.auth_context_position),
                    on_success: parseJsonField(row.auth_on_success),
                    on_error: parseJsonField(row.auth_on_error),
                    attempts: row.auth_attempts,
                    cache_expires_in_path: row.auth_cache_expires_in_path ?? null,
                    cache_default_ttl_seconds: row.auth_cache_default_ttl_seconds ?? null,
                    created_at: row.auth_created_at,
                    created_by: row.auth_created_by,
                };
            }
        }

        if (options.loadFunction && row.function_id) {
            workflowStep.function = {
                id: row.function_id,
                description: row.function_description,
                type: row.function_type,
                filter_input: parseJsonField(row.function_filter_input),
                context_position: row.function_context_position,
                value_static: row.function_value_static,
                value_dynamic: row.function_value_dynamic,
                is_active: row.function_is_active,
                created_at: row.function_created_at,
                created_by: row.function_created_by,
            };
        }

        if (options.loadConditional && row.conditional_id) {
            workflowStep.conditional = {
                id: row.conditional_id,
                satisfied: row.conditional_satisfied,
                unsatisfied: row.conditional_unsatisfied,
                input_path_a: row.conditional_input_path_a,
                input_path_b: row.conditional_input_path_b,
                operator: row.conditional_operator,
                created_at: row.conditional_created_at,
                created_by: row.conditional_created_by,
            };
        }

        return workflowStep;
    }
}
