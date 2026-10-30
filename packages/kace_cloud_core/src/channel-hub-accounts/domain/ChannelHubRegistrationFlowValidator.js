import {
    CHANNEL_HUB_MAIL_RULE_LIST_FLOW_INVALID,
    CHANNEL_HUB_MAIL_RULE_PRIORITY_UPDATE_FLOW_INVALID,
    CHANNEL_HUB_REGISTRATION_FLOW_INVALID,
} from '@kace/error-codes';
import { ValidationFailError, ValueObjectUuid } from '../../shared/index.js';

const FLOW_PURPOSES = Object.freeze({
    rest_flow_id: {
        externalCode: 'channelhub-connection',
        allowVariants: true,
        publicErrorCode: CHANNEL_HUB_REGISTRATION_FLOW_INVALID,
        description: 'registration',
    },
    mail_rule_list_rest_flow_id: {
        externalCode: 'channelhub-mail-rules-list',
        allowVariants: false,
        publicErrorCode: CHANNEL_HUB_MAIL_RULE_LIST_FLOW_INVALID,
        description: 'mail-rule list',
    },
    mail_rule_priority_update_rest_flow_id: {
        externalCode: 'channelhub-mail-rule-priority-update',
        allowVariants: false,
        publicErrorCode: CHANNEL_HUB_MAIL_RULE_PRIORITY_UPDATE_FLOW_INVALID,
        description: 'mail-rule priority update',
    },
});

export class ChannelHubRestFlowValidator {
    #repository;

    constructor(repository) {
        this.#repository = repository;
    }

    async execute(restFlowId, field) {
        const purpose = FLOW_PURPOSES[field];
        if (!purpose) {
            throw new Error(`Unsupported Channel Hub RestFlow field: ${field}`);
        }

        const id = restFlowId?.value ? restFlowId : new ValueObjectUuid(field, restFlowId);
        const isValid = await this.#repository.isValidChannelHubFlow(id, purpose.externalCode, {
            allowVariants: purpose.allowVariants,
        });

        if (!isValid) {
            throw new ValidationFailError(
                `The selected Rest Flow is not a valid Channel Hub ${purpose.description} flow`,
                field,
                [],
                purpose.publicErrorCode
            );
        }
    }
}

/**
 * Backward-compatible name retained for existing controller composition.
 * The implementation now validates every Channel Hub RestFlow purpose.
 */
export class ChannelHubRegistrationFlowValidator extends ChannelHubRestFlowValidator {
    async execute(restFlowId, field = 'rest_flow_id') {
        return super.execute(restFlowId, field);
    }
}
