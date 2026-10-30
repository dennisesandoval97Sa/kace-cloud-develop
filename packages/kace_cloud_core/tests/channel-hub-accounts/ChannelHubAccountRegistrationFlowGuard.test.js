import { jest } from '@jest/globals';
import { ChannelHubAccountCreator } from '../../src/channel-hub-accounts/application/create/ChannelHubAccountCreator.js';
import { ChannelHubAccountRegistrar } from '../../src/channel-hub-accounts/application/register/ChannelHubAccountRegistrar.js';
import { ChannelHubAccountUpdater } from '../../src/channel-hub-accounts/application/update/ChannelHubAccountUpdater.js';
import { ChannelHubAccount } from '../../src/channel-hub-accounts/domain/ChannelHubAccount.js';
import { ValidationFailError } from '../../src/shared/index.js';

const ACCOUNT_ID = '22222222-2222-4222-8222-222222222222';
const FLOW_ID = '33333333-3333-4333-8333-333333333333';
const OTHER_FLOW_ID = '44444444-4444-4444-8444-444444444444';
const LIST_FLOW_ID = '97c63872-c414-47db-8671-9d060345af26';
const PRIORITY_UPDATE_FLOW_ID = 'a67046c5-fd1a-4433-96cc-2ffa3e405809';
const USER_ID = '11111111-1111-4111-8111-111111111111';
const BASE_DATE = '2026-06-04T00:00:00.000Z';

const accountDto = (overrides = {}) => ({
    id: ACCOUNT_ID,
    email: 'support@example.com',
    name: 'Support inbox',
    country_id: 'CO',
    operator_id: 'imap',
    rest_flow_id: FLOW_ID,
    mail_rule_list_rest_flow_id: LIST_FLOW_ID,
    mail_rule_priority_update_rest_flow_id: PRIORITY_UPDATE_FLOW_ID,
    channel_hub_connection_id: null,
    is_active: true,
    created_at: BASE_DATE,
    created_by: USER_ID,
    updated_at: BASE_DATE,
    updated_by: USER_ID,
    deleted_at: null,
    deleted_by: null,
    channel_hub_error: null,
    ...overrides,
});

const account = (overrides = {}) => new ChannelHubAccount(accountDto(overrides));

describe('Channel Hub account registration flow guards', () => {
    it('validates the selected flow before creating an account', async () => {
        const repository = {
            findByEmail: jest.fn().mockResolvedValue(null),
            save: jest.fn().mockResolvedValue(undefined),
        };
        const validator = { execute: jest.fn().mockResolvedValue(undefined) };

        await new ChannelHubAccountCreator(repository, validator).execute(accountDto());

        expect(validator.execute).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({ value: FLOW_ID }),
            'rest_flow_id'
        );
        expect(validator.execute).toHaveBeenNthCalledWith(
            2,
            expect.objectContaining({ value: LIST_FLOW_ID }),
            'mail_rule_list_rest_flow_id'
        );
        expect(validator.execute).toHaveBeenNthCalledWith(
            3,
            expect.objectContaining({ value: PRIORITY_UPDATE_FLOW_ID }),
            'mail_rule_priority_update_rest_flow_id'
        );
        expect(repository.save).toHaveBeenCalled();
    });

    it('does not save a new account when the selected flow is invalid', async () => {
        const repository = {
            findByEmail: jest.fn().mockResolvedValue(null),
            save: jest.fn(),
        };
        const validator = { execute: jest.fn().mockRejectedValue(new ValidationFailError('invalid', 'rest_flow_id')) };

        await expect(new ChannelHubAccountCreator(repository, validator).execute(accountDto())).rejects.toThrow(
            ValidationFailError
        );

        expect(repository.save).not.toHaveBeenCalled();
    });

    it('validates rest_flow_id changes before updating an account', async () => {
        const repository = {
            find: jest.fn().mockResolvedValue(account()),
            update: jest.fn().mockResolvedValue(undefined),
        };
        const validator = { execute: jest.fn().mockResolvedValue(undefined) };

        await new ChannelHubAccountUpdater(repository, validator).execute(ACCOUNT_ID, {
            rest_flow_id: OTHER_FLOW_ID,
            updated_at: BASE_DATE,
            updated_by: USER_ID,
        });

        expect(validator.execute).toHaveBeenCalledWith(OTHER_FLOW_ID, 'rest_flow_id');
        expect(repository.update).toHaveBeenCalled();
    });

    it('validates only the supplied mail-rule RestFlow on update', async () => {
        const repository = {
            find: jest.fn().mockResolvedValue(account()),
            update: jest.fn().mockResolvedValue(undefined),
        };
        const validator = { execute: jest.fn().mockResolvedValue(undefined) };

        await new ChannelHubAccountUpdater(repository, validator).execute(ACCOUNT_ID, {
            mail_rule_list_rest_flow_id: OTHER_FLOW_ID,
            updated_at: BASE_DATE,
            updated_by: USER_ID,
        });

        expect(validator.execute).toHaveBeenCalledTimes(1);
        expect(validator.execute).toHaveBeenCalledWith(OTHER_FLOW_ID, 'mail_rule_list_rest_flow_id');
        expect(repository.update).toHaveBeenCalled();
    });

    it('does not update an account when a supplied priority RestFlow is invalid', async () => {
        const repository = {
            find: jest.fn().mockResolvedValue(account()),
            update: jest.fn(),
        };
        const validator = {
            execute: jest
                .fn()
                .mockRejectedValue(new ValidationFailError('invalid', 'mail_rule_priority_update_rest_flow_id')),
        };

        await expect(
            new ChannelHubAccountUpdater(repository, validator).execute(ACCOUNT_ID, {
                mail_rule_priority_update_rest_flow_id: OTHER_FLOW_ID,
                updated_at: BASE_DATE,
                updated_by: USER_ID,
            })
        ).rejects.toThrow(ValidationFailError);

        expect(repository.update).not.toHaveBeenCalled();
    });

    it('does not revalidate updates that do not change rest_flow_id', async () => {
        const repository = {
            find: jest.fn().mockResolvedValue(account()),
            update: jest.fn().mockResolvedValue(undefined),
        };
        const validator = { execute: jest.fn() };

        await new ChannelHubAccountUpdater(repository, validator).execute(ACCOUNT_ID, {
            name: 'Updated inbox',
            updated_at: BASE_DATE,
            updated_by: USER_ID,
        });

        expect(validator.execute).not.toHaveBeenCalled();
        expect(repository.update).toHaveBeenCalled();
    });

    it('validates the stored flow before registering an account in Channel Hub', async () => {
        const repository = {
            find: jest.fn().mockResolvedValue(account()),
        };
        const workflowExecutor = { execute: jest.fn() };
        const validator = { execute: jest.fn().mockRejectedValue(new ValidationFailError('invalid', 'rest_flow_id')) };

        await expect(
            new ChannelHubAccountRegistrar(repository, workflowExecutor, validator).execute(ACCOUNT_ID, USER_ID)
        ).rejects.toThrow(ValidationFailError);

        expect(validator.execute).toHaveBeenCalledWith(expect.objectContaining({ value: FLOW_ID }));
        expect(workflowExecutor.execute).not.toHaveBeenCalled();
    });
});
