import { CustomError } from '../../../shared/errors/CustomError.js';
import { ChannelHubAccountFinder as DomainFinder } from '../../domain/ChannelHubAccountFinder.js';

export class ChannelHubAccountUpdater {
    #finder;
    #repository;
    #registrationFlowValidator;

    constructor(repository, registrationFlowValidator) {
        this.#repository = repository;
        this.#registrationFlowValidator = registrationFlowValidator;
        this.#finder = new DomainFinder(repository);
    }

    async execute(id, dto) {
        const account = await this.#finder.execute(id);

        if (!account) {
            throw new CustomError('The Channel Hub account you are trying to update does not exist', 404);
        }

        const restFlowFields = [
            'rest_flow_id',
            'mail_rule_list_rest_flow_id',
            'mail_rule_priority_update_rest_flow_id',
        ];

        for (const field of restFlowFields) {
            if (dto[field]) {
                await this.#registrationFlowValidator.execute(dto[field], field);
            }
        }

        account.update(dto);
        await this.#repository.update(account);
    }
}
