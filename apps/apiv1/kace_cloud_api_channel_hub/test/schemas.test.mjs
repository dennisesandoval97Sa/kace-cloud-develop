import { describe, expect, it } from '@jest/globals';

import { ChannelHubCreateSchema, ChannelHubUpdateSchema, WorkspacePriorityUpdateSchema } from '../src/schemas.mjs';

const FLOW_ID = '4f7f9d13-65b9-445d-a839-d8e0ece2ed03';
const LIST_FLOW_ID = '97c63872-c414-47db-8671-9d060345af26';
const PRIORITY_UPDATE_FLOW_ID = 'a67046c5-fd1a-4433-96cc-2ffa3e405809';
const USER_ID = '11111111-1111-4111-8111-111111111111';
const BASE_DATE = '2026-07-21T12:00:00.000Z';
const WORKSPACE_ID = '55555555-5555-4555-8555-555555555555';

const createPayload = (overrides = {}) => ({
    id: '22222222-2222-4222-8222-222222222222',
    email: 'support@example.com',
    name: 'Support inbox',
    country_id: 'CO',
    operator_id: 'gmail',
    rest_flow_id: FLOW_ID,
    mail_rule_list_rest_flow_id: LIST_FLOW_ID,
    mail_rule_priority_update_rest_flow_id: PRIORITY_UPDATE_FLOW_ID,
    is_active: true,
    created_at: BASE_DATE,
    created_by: USER_ID,
    updated_at: BASE_DATE,
    updated_by: USER_ID,
    ...overrides,
});

describe('Channel Hub account schemas', () => {
    it('accepts legacy account creation without mail-rule RestFlows', () => {
        const valid = ChannelHubCreateSchema.validate(createPayload(), { abortEarly: false });
        const missing = createPayload();
        delete missing.mail_rule_list_rest_flow_id;
        delete missing.mail_rule_priority_update_rest_flow_id;
        const legacy = ChannelHubCreateSchema.validate(missing, { abortEarly: false });

        expect(valid.error).toBeUndefined();
        expect(legacy.error).toBeUndefined();
    });

    it.each(['mail_rule_list_rest_flow_id', 'mail_rule_priority_update_rest_flow_id'])(
        'validates an optional %s when supplied',
        (field) => {
            const { error } = ChannelHubCreateSchema.validate(createPayload({ [field]: 'not-a-uuid' }));
            expect(error.details[0].path).toEqual([field]);
        }
    );

    it('allows either mail-rule RestFlow to be changed independently on update', () => {
        const common = { updated_at: BASE_DATE, updated_by: USER_ID };

        expect(
            ChannelHubUpdateSchema.validate({ ...common, mail_rule_list_rest_flow_id: LIST_FLOW_ID }).error
        ).toBeUndefined();
        expect(
            ChannelHubUpdateSchema.validate({
                ...common,
                mail_rule_priority_update_rest_flow_id: PRIORITY_UPDATE_FLOW_ID,
            }).error
        ).toBeUndefined();
    });

    it('accepts only a revision and a unique non-empty list of workspace ids for priority updates', () => {
        expect(
            WorkspacePriorityUpdateSchema.validate({
                revision: 'revision-1',
                orderedWorkspaceIds: [WORKSPACE_ID],
            }).error
        ).toBeUndefined();

        for (const invalidPayload of [
            null,
            {},
            { revision: 'revision-1', orderedWorkspaceIds: [] },
            { revision: 'revision-1', orderedWorkspaceIds: [WORKSPACE_ID, WORKSPACE_ID] },
            { revision: 'revision-1', orderedWorkspaceIds: ['not-a-workspace-id'] },
        ]) {
            expect(WorkspacePriorityUpdateSchema.validate(invalidPayload).error).toBeDefined();
        }
    });
});
