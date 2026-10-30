export class ActionsQueueExecutionsService {
    /** @type {KnexActionQueueExecutionRepository} */
    #repository; // is initialized in the constructor

    constructor(respository) {
        this.#repository = respository;
    }

    /**
     * get last ActionsQueueExecutions records in the database by action_id
     *
     * @param {string} action_id - action id to filter
     * @returns {Promise<ActionsQueueExecutions>} ActionsQueueExecutions
     */
    async getLastExecution(action_id) {
        const actionsQueueExecution = this.#repository.findLastByActionId(action_id);

        return actionsQueueExecution;
    }
}
