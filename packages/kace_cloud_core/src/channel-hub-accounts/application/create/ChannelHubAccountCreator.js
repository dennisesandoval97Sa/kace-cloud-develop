import { CustomError } from '../../../shared/errors/CustomError.js';
import { ChannelHubAccount } from '../../domain/ChannelHubAccount.js';

export class ChannelHubAccountCreator {
    #repository;
    #registrationFlowValidator;

    constructor(repository, registrationFlowValidator) {
        this.#repository = repository;
        this.#registrationFlowValidator = registrationFlowValidator;
    }

    async execute(dto) {
        const account = ChannelHubAccount.create(dto);

        const existing = await this.#repository.findByEmail(dto.email);
        if (existing) {
            throw new CustomError(`Channel Hub account with email ${dto.email} already exists`, 400);
        }

        const restFlows = [
            ['rest_flow_id', account.rest_flow_id],
            ['mail_rule_list_rest_flow_id', account.mail_rule_list_rest_flow_id],
            ['mail_rule_priority_update_rest_flow_id', account.mail_rule_priority_update_rest_flow_id],
        ];

        for (const [field, restFlowId] of restFlows) {
            if (restFlowId.value) {
                await this.#registrationFlowValidator.execute(restFlowId, field);
            }
        }

        await this.#repository.save(account);
    }
}
