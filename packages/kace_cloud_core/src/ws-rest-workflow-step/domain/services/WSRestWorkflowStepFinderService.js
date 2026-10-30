import { Criteria } from '../../../shared/criteria/Criteria';
import { ValueObjectUuid } from '../../../shared/domain/value-object/ValueObjectUuid';
import { ValueObjectString } from '../../../shared/domain/value-object/ValueObjectString';
import { WSRestFlow } from '../../../ws-rest-flows/domain/WSRestFlow';
import { WSRestEndpoint } from '../../../ws-rest-endpoints/domain/WSRestEndpoint';
import { WSRestFunction } from '../../../ws_rest_functions/domain/WSRestFunction';
import { WSRestConditional } from '../../../ws-rest-conditionals/domain/WSRestConditional';
import { WSRestWorkflowStep } from '../WSRestWorkflowStep';
import { InvalidArgumentError, Helper } from '../../../shared';

/**
 * Domain service for finding workflow steps.
 */
export class WSRestWorkflowStepFinderService {
    /** @type {KnexWSRestWorkflowStepRepository} */
    #repository;

    /**
     * @param {KnexWSRestWorkflowStepRepository} repository Repository for accessing workflow steps
     */
    constructor(repository) {
        this.#repository = repository;
    }

    /**
     * Get the repository instance
     * @returns {KnexWSRestWorkflowStepRepository}
     */
    get repository() {
        return this.#repository;
    }

    /**
     * Find a single workflow step by its ID
     *
     * @param {string} id Workflow step ID
     * @returns {Promise<WSRestWorkflowStep|null>}
     */
    async findById(id) {
        return this.#repository.find(new ValueObjectUuid('id', id));
    }

    /**
     * Find workflow steps by flow ID with relationships
     *
     * @param {Object} params Parameters for finding workflow steps
     * @param {string|null} params.flowId Flow ID to search for
     * @param {string|null} [params.externalCode=null] External code for additional filtering
     * @param {Object} [params.options={}] Additional options for the query
     * @param {boolean} [params.options.loadEndpoint]  Load endpoint relationship
     * @param {boolean} [params.options.loadFunction] Load function relationship
     * @param {boolean} [params.options.loadConditional] Load conditional relationship
     *
     * @returns {Promise<WSRestWorkflowStep[]>}
     */
    async findByFlowIdentifier(params) {
        let flowId = null;

        if (params.flowId) {
            flowId = new ValueObjectUuid('flow_id', params.flowId);
        } else if (params.externalCode) {
            const externalCode = new ValueObjectString('external_code', params.externalCode);
            flowId = await this.#repository.findFlowIdByExternalCode(externalCode);
        } else {
            throw new InvalidArgumentError('Either flowId or externalCode must be provided');
        }

        const rowSteps = await this.#repository.findByFlowIdWithRelations(flowId, params.options);
        return rowSteps.map((flowStep) => this.#hydrateRelations(flowStep));
    }

    /**
     * Generic search method with criteria support
     *
     * @param {Object} filter Search criteria filters
     * @param {Object} [relationship] Relationships configuration
     * @param {Object} [orderBy] Order specification
     * @param {number} [offset=0] Pagination offset
     * @param {number} [limit=null] Pagination limit
     * @param {string} [tablename] Table name for the query
     * @returns {Promise<WSRestWorkflowStep[]>}
     */
    async search(filter, relationship = null, orderBy = null, offset = 0, limit = null, tablename = null) {
        const criteria = new Criteria(filter, relationship, limit, offset, orderBy, tablename);

        return this.#repository.search(criteria);
    }

    #hydrateRelations(row) {
        const rawStep = row.step;
        const rawFlow = row.flow;
        const rawEndpoint = row.endpoint;
        const rawFunction = row.function;
        const rawConditional = row.conditional;

        Helper.logDebug('Hydrating workflow step', {
            step_id: rawStep.id,
            endpoint_id: rawStep.endpoint_id,
            function_id: rawStep.function_id,
            conditional_id: rawStep.conditional_id,
            order: rawStep.order,
            rawConditional,
        });

        const workflowStep = new WSRestWorkflowStep(rawStep);

        if (rawFlow) {
            workflowStep.setFlow(new WSRestFlow(rawFlow));
        }

        if (rawEndpoint) {
            const endpoint = new WSRestEndpoint(rawEndpoint);

            if (rawEndpoint.authorization) {
                const authorizationEndpoint = new WSRestEndpoint(rawEndpoint.authorization);
                endpoint.setAuthorizationEndpoint(authorizationEndpoint);
            }

            workflowStep.setEndpoint(endpoint);
        }

        if (rawFunction) {
            workflowStep.setFunction(new WSRestFunction(rawFunction));
        }

        if (rawConditional) {
            workflowStep.setConditional(new WSRestConditional(rawConditional));
        }

        return workflowStep;
    }
}
