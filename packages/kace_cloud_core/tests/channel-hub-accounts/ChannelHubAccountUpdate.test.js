import { ChannelHubAccount } from '../../src/channel-hub-accounts/domain/ChannelHubAccount.js';
import { ChannelHubAccountResponse } from '../../src/channel-hub-accounts/application/ChannelHubAccountResponse.js';

const CHANNEL_HUB_FLOW_ID = '4f7f9d13-65b9-445d-a839-d8e0ece2ed03';
const OTHER_FLOW_ID = '8a1f2c34-1111-4222-8333-d8e0ece2ed03';
const LIST_FLOW_ID = '97c63872-c414-47db-8671-9d060345af26';
const PRIORITY_UPDATE_FLOW_ID = 'a67046c5-fd1a-4433-96cc-2ffa3e405809';
const USER_ID = '11111111-1111-4111-8111-111111111111';
const BASE_DATE = '2026-06-04T00:00:00.000Z';

const account = (overrides = {}) =>
    new ChannelHubAccount({
        id: '22222222-2222-4222-8222-222222222222',
        email: 'support@example.com',
        name: 'Support inbox',
        country_id: 'CO',
        operator_id: 'imap',
        rest_flow_id: CHANNEL_HUB_FLOW_ID,
        mail_rule_list_rest_flow_id: null,
        mail_rule_priority_update_rest_flow_id: null,
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

describe('ChannelHubAccount.update', () => {
    it('applies a changed name (editable on update)', () => {
        const entity = account();

        entity.update({ name: 'New name', updated_at: BASE_DATE, updated_by: USER_ID });

        expect(entity.name.value).toBe('New name');
    });

    it('applies a changed country_id (editable on update)', () => {
        const entity = account();

        entity.update({ country_id: 'US', updated_at: BASE_DATE, updated_by: USER_ID });

        expect(entity.country_id.value).toBe('US');
    });

    it('applies a changed rest_flow_id (editable on update to fix a wrong pick)', () => {
        const entity = account();

        entity.update({ rest_flow_id: OTHER_FLOW_ID, updated_at: BASE_DATE, updated_by: USER_ID });

        expect(entity.rest_flow_id.value).toBe(OTHER_FLOW_ID);
    });

    it('applies a changed operator_id', () => {
        const entity = account();

        entity.update({ operator_id: 'gmail', updated_at: BASE_DATE, updated_by: USER_ID });

        expect(entity.operator_id.value).toBe('gmail');
    });

    it('configures and serializes the mail-rule RestFlows while preserving nullable legacy accounts', () => {
        const entity = account();

        expect(entity.toJson()).toMatchObject({
            mail_rule_list_rest_flow_id: null,
            mail_rule_priority_update_rest_flow_id: null,
        });

        entity.update({
            mail_rule_list_rest_flow_id: LIST_FLOW_ID,
            mail_rule_priority_update_rest_flow_id: PRIORITY_UPDATE_FLOW_ID,
            updated_at: BASE_DATE,
            updated_by: USER_ID,
        });

        expect(entity.toJson()).toMatchObject({
            mail_rule_list_rest_flow_id: LIST_FLOW_ID,
            mail_rule_priority_update_rest_flow_id: PRIORITY_UPDATE_FLOW_ID,
        });
    });
});

describe('ChannelHubAccountResponse', () => {
    it('includes both configured mail-rule RestFlows', () => {
        const response = new ChannelHubAccountResponse(
            account({
                mail_rule_list_rest_flow_id: LIST_FLOW_ID,
                mail_rule_priority_update_rest_flow_id: PRIORITY_UPDATE_FLOW_ID,
            })
        );

        expect(response.toJson().data).toMatchObject({
            mail_rule_list_rest_flow_id: LIST_FLOW_ID,
            mail_rule_priority_update_rest_flow_id: PRIORITY_UPDATE_FLOW_ID,
        });
    });
});
