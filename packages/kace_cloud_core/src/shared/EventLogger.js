import { EventCreator, KnexEventRepository } from '../event-log';
import { ValueObjectUuid } from './domain/value-object/ValueObjectUuid';
import { Helper } from './infrastructure/utils/Helper';
import { Parameters } from './domain/params/Parameters.js';

export class EventLogger {
    /** @type {EventCreator} is initialized in the constructor */
    #eventCreator;
    /** @type {KnexEventRepository} is initialized in the constructor */
    #repository;

    #userCache = new Map();
    #stateCache = new Map();
    #flowCache = new Map();

    constructor(repository) {
        if (!repository || !repository.connection) {
            throw new Error('Invalid repository provided to EventLogger');
        }
        this.#repository = new KnexEventRepository(repository.connection);
        this.#eventCreator = new EventCreator(this.#repository);
    }

    async log(eventName, aggregateId, initiatedByUser, body = {}, caseId = null, clientId = null, oldData = {}) {
        try {
            initiatedByUser = initiatedByUser || Parameters.defaultUserId;
            await this.#addUserInfo(body, initiatedByUser);
            await this.#enrichEventData(eventName, aggregateId, body, oldData);

            const eventDto = {
                id: ValueObjectUuid.random(),
                event_name: eventName,
                occurred_at: new Date(),
                initiated_by_user: initiatedByUser,
                aggregate_id: aggregateId,
                body,
                old_data: oldData,
                case_id: caseId,
                client_id: clientId,
            };

            await this.#eventCreator.execute(eventDto);
        } catch (error) {
            Helper.logError(`Error logging event ${eventName}:`, error);
        }
    }

    /**
     * Enriquecer el body del evento según su tipo
     * @private
     */
    async #enrichEventData(eventName, aggregateId, body, oldData) {
        try {
            if (eventName === 'ws-rest-flows.executed') {
                return await this.#enrichFlowExecutionEvent(aggregateId, body);
            }

            if (eventName === 'ws-rest-workflow-steps.executed') {
                return await this.#enrichWorkflowStepExecutionEvent(body);
            }

            if (eventName.startsWith('case.') || eventName === 'action.executed') {
                return await this.#enrichCaseEvent(body, oldData);
            }
        } catch (error) {
            Helper.logError(`Error enriching event body for ${eventName}:`, error);
        }
    }

    /**
     * Enriquecer eventos de ejecución de flujos
     * @private
     */
    async #enrichFlowExecutionEvent(aggregateId, body) {
        if (!aggregateId) {
            throw new Error('aggregateId is required for ws-rest-flows.executed events');
        }

        const flowInfo = await this.#getFlowById(aggregateId);
        body.flow = flowInfo;
    }

    /**
     * Enriquecer eventos de ejecución de pasos de workflow
     * @private
     */
    async #enrichWorkflowStepExecutionEvent(body) {
        try {
            const flowInfo = await this.#getFlowById(body.flow_id);
            body.flow = flowInfo;
        } catch (error) {
            Helper.logError(`Error fetching flow info for flowId ${body.flowId}:`, error);
            body.flow = { error: 'Failed to fetch flow details' };
        }
    }

    /**
     * Enriquecer eventos relacionados con casos
     * @private
     */
    async #enrichCaseEvent(body, oldData) {
        await this.#enrichCaseData(body);
        if (oldData && Object.keys(oldData).length > 0) {
            await this.#enrichCaseData(oldData);
        }
    }

    async #enrichCaseData(data) {
        if (data.transicion_id) {
            data.state = await this.#getStateByTransitionId(data.transicion_id);
        }

        if (data.responsable_id) {
            data.responsable = await this.#getUserById(data.responsable_id);
        }

        if (data.ws_rest_flow_id) {
            data.flow = await this.#getFlowById(data.ws_rest_flow_id);
        }
    }

    /**
     * Agregar información del usuario al body
     * @private
     */
    async #addUserInfo(body, userId) {
        try {
            const userInfo = await this.#getUserById(userId);
            body.initiator = userInfo;
        } catch (error) {
            Helper.logError(`Error getting user info for ${userId}:`, error);
            body.initiator = { error: 'Failed to fetch user details' };
        }
    }

    async #getStateByTransitionId(transitionId) {
        if (this.#stateCache.has(transitionId)) return this.#stateCache.get(transitionId);
        const state = await this.#repository.getStateByTransitionID(new ValueObjectUuid('transition_id', transitionId));
        this.#stateCache.set(transitionId, state);
        return state;
    }

    async #getUserById(userId) {
        if (this.#userCache.has(userId)) return this.#userCache.get(userId);
        const user = await this.#repository.getUserByID(new ValueObjectUuid('user_id', userId));
        this.#userCache.set(userId, user);
        return user;
    }

    async #getFlowById(flowId) {
        if (this.#flowCache.has(flowId)) return this.#flowCache.get(flowId);
        const flow = await this.#repository.getFlowByID(new ValueObjectUuid('flow_id', flowId));
        this.#flowCache.set(flowId, flow);
        return flow;
    }
}
