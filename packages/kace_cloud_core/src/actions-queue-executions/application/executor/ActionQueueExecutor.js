import { ActionQueueExecutorFactory } from '../../infrastructure/factory/ActionQueueExecutorFactory.js';
import { Helper } from '../../../shared/index.js';
import { ActionQueueExecutorResponse } from './ActionQueueExecutorResponse.js';

/**
 * Processor that facilitates the execution of the action queue
 * Acts as a simplified interface for invoking the queue execution service from client applications
 */
export class ActionQueueExecutor {
    /**
     * @type {KnexActionsQueueExecutionsRepository}
     */
    #repository;

    /**
     * @param {KnexActionsQueueExecutionsRepository} repository The repository for accessing the action queue executions
     */
    constructor(repository) {
        this.#repository = repository;
    }

    /**
     * Processes all pending executions in the action queue
     *
     * @returns {Promise<ActionQueueExecutorResponse>} The result of the action queue processing
     */
    async execute() {
        Helper.logDebug('Iniciando procesamiento de cola de acciones');

        const actionQueueExecutorService = ActionQueueExecutorFactory.createActionQueueExecutorService(
            this.#repository.connection
        );

        const result = await actionQueueExecutorService.execute();

        Helper.logDebug('Procesamiento de cola de acciones completado', result);

        return new ActionQueueExecutorResponse(result);
    }

    /**
     * Processes one execution using data directly from the event payload,
     * skipping the DB lookup for the execution record.
     *
     * @param {Object} payload
     * @param {string} payload.executionId
     * @param {string} payload.actionId
     * @param {string} payload.caseId
     * @param {string} payload.triggerType
     * @returns {Promise<ActionQueueExecutorResponse>}
     */
    async executeByEventPayload(payload) {
        Helper.logDebug('Iniciando procesamiento directo desde evento', {
            executionId: payload.executionId,
            actionId: payload.actionId,
            caseId: payload.caseId,
        });

        const actionQueueExecutorService = ActionQueueExecutorFactory.createActionQueueExecutorService(
            this.#repository.connection
        );

        const result = await actionQueueExecutorService.executeByEventPayload(payload);

        Helper.logDebug('Procesamiento directo desde evento completado', {
            executionId: payload.executionId,
            ...result,
        });

        return new ActionQueueExecutorResponse(result);
    }
}
