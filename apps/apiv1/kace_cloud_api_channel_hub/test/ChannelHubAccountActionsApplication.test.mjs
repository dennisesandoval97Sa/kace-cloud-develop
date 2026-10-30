import { describe, expect, it } from '@jest/globals';
import {
    ChannelHubAccountActionsApplication,
    ChannelHubAccountAuthorizationError,
    ChannelHubAccountPaginationError,
} from '../src/ChannelHubAccountActionsApplication.mjs';
import { ChannelHubCreateSchema, ChannelHubUpdateSchema } from '../src/schemas.mjs';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const ACCOUNT_ID = '22222222-2222-4222-8222-222222222222';
const REST_FLOW_ID = '33333333-3333-4333-8333-333333333333';
const LIST_FLOW_ID = '44444444-4444-4444-8444-444444444444';
const UPDATE_FLOW_ID = '55555555-5555-4555-8555-555555555555';
const CONTROLLER_STARTED_AT = new Date('2026-06-04T12:00:00.000Z');
const ACTION_NOW = new Date('2026-06-04T12:01:00.000Z');

class RecordingCommand {
    calls = [];

    async execute(...args) {
        this.calls.push(args);
    }
}

class RecordingQuery extends RecordingCommand {
    constructor(result) {
        super();
        this.result = result;
    }

    async execute(...args) {
        this.calls.push(args);
        return this.result;
    }
}

const accountPayload = () => ({
    email: 'support@example.com',
    name: 'Support inbox',
    country_id: 'CO',
    operator_id: 'imap',
    rest_flow_id: REST_FLOW_ID,
    mail_rule_list_rest_flow_id: LIST_FLOW_ID,
    mail_rule_priority_update_rest_flow_id: UPDATE_FLOW_ID,
    is_active: true,
});

const permittedUser = (allowed = true) => ({
    id: { value: USER_ID },
    hasPermission: () => allowed,
});

const createSubject = ({ ownedResources = [] } = {}) => {
    const dependencies = {
        creator: new RecordingCommand(),
        updater: new RecordingCommand(),
        deleter: new RecordingCommand(),
        registrar: new RecordingCommand(),
        finder: new RecordingQuery({ toJson: () => ({ data: { id: ACCOUNT_ID } }) }),
        searcher: new RecordingQuery({
            toJson: () => ({ data: { items: [{ id: ACCOUNT_ID }] }, metadata: { count: 1 } }),
        }),
    };
    const subject = new ChannelHubAccountActionsApplication({
        ...dependencies,
        createSchema: ChannelHubCreateSchema,
        updateSchema: ChannelHubUpdateSchema,
        idGenerator: () => ACCOUNT_ID,
        clock: () => ACTION_NOW,
        createdAt: CONTROLLER_STARTED_AT,
        ownedResources,
    });
    return { subject, dependencies };
};

describe('ChannelHubAccountActionsApplication', () => {
    it('disposes every independently owned composition resource', async () => {
        const first = { destroy: async () => (first.destroyCalls += 1), destroyCalls: 0 };
        const second = { destroyConnection: async () => (second.destroyCalls += 1), destroyCalls: 0 };
        const { subject } = createSubject({ ownedResources: [first, second] });

        await subject.destroy();

        expect([first.destroyCalls, second.destroyCalls]).toEqual([1, 1]);
    });

    it('creates an account with generated identity and audit fields', async () => {
        const { subject, dependencies } = createSubject();

        await subject.create(accountPayload(), permittedUser());

        expect(dependencies.creator.calls).toEqual([
            [
                expect.objectContaining({
                    id: ACCOUNT_ID,
                    email: 'support@example.com',
                    created_at: CONTROLLER_STARTED_AT,
                    created_by: USER_ID,
                    updated_at: CONTROLLER_STARTED_AT,
                    updated_by: USER_ID,
                }),
            ],
        ]);
    });

    it('updates an account by id with audit fields', async () => {
        const { subject, dependencies } = createSubject();

        await subject.update(ACCOUNT_ID, { name: 'Updated inbox' }, permittedUser());

        expect(dependencies.updater.calls).toEqual([
            [
                ACCOUNT_ID,
                expect.objectContaining({
                    name: 'Updated inbox',
                    updated_at: ACTION_NOW,
                    updated_by: USER_ID,
                }),
            ],
        ]);
    });

    it('deletes an account with soft-delete audit fields', async () => {
        const { subject, dependencies } = createSubject();

        await subject.delete(ACCOUNT_ID, permittedUser());

        expect(dependencies.deleter.calls).toEqual([
            [
                ACCOUNT_ID,
                {
                    updated_at: ACTION_NOW,
                    updated_by: USER_ID,
                    deleted_at: ACTION_NOW,
                    deleted_by: USER_ID,
                },
            ],
        ]);
    });

    it('registers an account for the current user', async () => {
        const { subject, dependencies } = createSubject();

        await subject.register(ACCOUNT_ID, permittedUser());

        expect(dependencies.registrar.calls).toEqual([[ACCOUNT_ID, USER_ID]]);
    });

    it('finds an account by id', async () => {
        const { subject, dependencies } = createSubject();

        const result = await subject.find(ACCOUNT_ID, permittedUser());

        expect(dependencies.finder.calls).toEqual([[ACCOUNT_ID]]);
        expect(result.toJson()).toEqual({ data: { id: ACCOUNT_ID } });
    });

    it('caps requested pagination before searching accounts', async () => {
        const { subject, dependencies } = createSubject();

        const result = await subject.index({ limit: '500', offset: '20' }, permittedUser());

        expect(dependencies.searcher.calls).toEqual([
            [
                {
                    filter: undefined,
                    relationship: undefined,
                    limit: 100,
                    offset: 20,
                    order: { field: 'created_at', direction: 'desc' },
                },
            ],
        ]);
        expect(result.toJson()).toEqual({
            data: { items: [{ id: ACCOUNT_ID }] },
            metadata: { count: 1 },
        });
    });

    it('rejects invalid pagination before searching', async () => {
        const { subject, dependencies } = createSubject();

        await expect(subject.index({ limit: 'abc', offset: '0' }, permittedUser())).rejects.toBeInstanceOf(
            ChannelHubAccountPaginationError
        );
        expect(dependencies.searcher.calls).toEqual([]);
    });

    it('rejects every account action before invoking dependencies when permission is absent', async () => {
        const { subject, dependencies } = createSubject();
        const user = permittedUser(false);
        const actions = [
            () => subject.create(accountPayload(), user),
            () => subject.update(ACCOUNT_ID, { name: 'Updated' }, user),
            () => subject.delete(ACCOUNT_ID, user),
            () => subject.register(ACCOUNT_ID, user),
            () => subject.find(ACCOUNT_ID, user),
            () => subject.index({}, user),
        ];

        for (const action of actions) {
            await expect(action()).rejects.toBeInstanceOf(ChannelHubAccountAuthorizationError);
        }
        for (const dependency of Object.values(dependencies)) {
            expect(dependency.calls).toEqual([]);
        }
    });
});
