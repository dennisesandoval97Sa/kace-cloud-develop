import { jest } from '@jest/globals';
import {
    ChannelHubRegistrationFlowValidator,
    ChannelHubRestFlowValidator,
} from '../../src/channel-hub-accounts/domain/ChannelHubRegistrationFlowValidator.js';
import { CHANNEL_HUB_MAIL_RULE_LIST_FLOW_INVALID, CHANNEL_HUB_REGISTRATION_FLOW_INVALID } from '@kace/error-codes';
import { ValidationFailError, ValueObjectUuid } from '../../src/shared/index.js';

const FLOW_ID = '33333333-3333-4333-8333-333333333333';

describe('ChannelHubRegistrationFlowValidator', () => {
    it('accepts a valid Channel Hub registration flow', async () => {
        const repository = {
            isValidChannelHubFlow: jest.fn().mockResolvedValue(true),
        };
        const validator = new ChannelHubRegistrationFlowValidator(repository);

        await expect(validator.execute(FLOW_ID)).resolves.toBeUndefined();

        expect(repository.isValidChannelHubFlow).toHaveBeenCalledWith(
            expect.objectContaining({ value: FLOW_ID }),
            'channelhub-connection',
            { allowVariants: true }
        );
    });

    it('rejects invalid registration flows with a public validation code', async () => {
        const repository = {
            isValidChannelHubFlow: jest.fn().mockResolvedValue(false),
        };
        const validator = new ChannelHubRegistrationFlowValidator(repository);

        await expect(validator.execute(new ValueObjectUuid('rest_flow_id', FLOW_ID))).rejects.toMatchObject({
            publicErrorCode: CHANNEL_HUB_REGISTRATION_FLOW_INVALID,
            field: 'rest_flow_id',
        });
        await expect(validator.execute(FLOW_ID)).rejects.toThrow(ValidationFailError);
    });

    it('validates the list RestFlow against its own external-code family', async () => {
        const repository = {
            isValidChannelHubFlow: jest.fn().mockResolvedValue(false),
        };
        const validator = new ChannelHubRestFlowValidator(repository);

        await expect(validator.execute(FLOW_ID, 'mail_rule_list_rest_flow_id')).rejects.toMatchObject({
            publicErrorCode: CHANNEL_HUB_MAIL_RULE_LIST_FLOW_INVALID,
            field: 'mail_rule_list_rest_flow_id',
        });
        expect(repository.isValidChannelHubFlow).toHaveBeenCalledWith(
            expect.objectContaining({ value: FLOW_ID }),
            'channelhub-mail-rules-list',
            { allowVariants: false }
        );
    });
});
