import { CustomError } from '../../../shared/errors/CustomError';
import { FlowFinderDomain, FlowValidateIsInUse } from '../../index';

export class FlowDeleter {
    /** @type {KnexFlowRepository} is initialized in the constructor*/
    #repository;

    /** @type {FlowFinderDomain} is initialized in the constructor*/
    #finder;

    /** @type {FlowValidateIsInUse} is initialized in the constructor*/
    #validate;

    /**
     *
     * @param {KnexFlowRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
        this.#finder = new FlowFinderDomain(repository);
        this.#validate = new FlowValidateIsInUse(repository);
    }

    /**
     *
     * @param {string} id id for delete
     * @param {object} dto object with delete fields, example {deleted_at: new Date(), deleted_by: 'user_id'}
     * @throws {CustomError} if the flow does not exist
     * @returns {Promise<void>}
     */

    async execute(id, dto) {
        const flow = await this.#finder.execute(id);

        if (flow === null) throw new CustomError(`The flow you are trying delete does not exist`, 404);

        const existFlowInUse = await this.#validate.execute(id);

        if (existFlowInUse) {
            throw new CustomError('The flow you are trying update is in use', 400);
        }

        flow.delete(dto);

        await this.#repository.delete(flow);

        flow.flushChanges();
    }
}
