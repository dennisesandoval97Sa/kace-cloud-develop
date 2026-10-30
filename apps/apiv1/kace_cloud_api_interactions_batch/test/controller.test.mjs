import { jest } from '@jest/globals';
import { v4 as uuidv4 } from 'uuid';
import { User } from '@kace/core/src/users/index.js';
import { Controller } from '../src/controller.mjs';
import { MAX_BATCH_SIZE } from '../src/schemas.mjs';

function tenant() {
    return {
        apps_debug: { value: 'true' },
        apps_allowed_origins: { value: '*' },
        aws_cognito_user_pool_id: { value: 'us-east-1_localpool' },
        aws_cognito_app_client_id: { value: 'local-client' },
        aws_sqs_region: { value: 'us-east-1' },
        aws_sqs_events_queue_url: { value: 'https://sqs.example/queue.fifo' },
        aws_event_bridge_region: { value: 'us-east-1' },
        aws_event_bridge_event_bus_name: { value: 'local-bus' },
    };
}

function eventFor(payload) {
    const t = tenant();

    return {
        resource: '/',
        httpMethod: 'POST',
        path: '/interactions-batch',
        body: JSON.stringify(payload),
        headers: {},
        tenant: t,
        tenantContext: { tenant: t },
        kContext: { awsRequestId: 'test-request-id' },
    };
}

function knexConfig() {
    return {
        client: 'sqlite3',
        connection: { filename: ':memory:' },
        useNullAsDefault: true,
    };
}

function userWithPermission(granted = true) {
    const user = Object.create(User.prototype);
    Object.defineProperty(user, 'id', { value: { value: uuidv4() } });
    Object.defineProperty(user, 'hasPermission', { value: jest.fn(() => granted) });

    return user;
}

/**
 * Stub repository that records every relationship lookup, so the tests can assert that the
 * broad check runs once per unique id instead of once per batch item.
 */
function stubRepository() {
    const relationshipLookups = [];
    const transaction = { commit: jest.fn().mockResolvedValue(), rollback: jest.fn().mockResolvedValue() };

    return {
        relationshipLookups,
        transaction,
        table: jest.fn((tableName) => {
            const query = {
                select: () => query,
                where: (criteria) => {
                    relationshipLookups.push({ table: tableName, id: criteria.id });
                    return query;
                },
                modify: () => query,
                first: () => Promise.resolve({ id: relationshipLookups.at(-1).id }),
            };
            return query;
        }),
        startTransaction: jest.fn(async () => transaction),
        findByEmailIds: jest.fn().mockResolvedValue([]),
        save: jest.fn().mockResolvedValue(),
        saveHistory: jest.fn().mockResolvedValue(),
        destroyConnection: jest.fn().mockResolvedValue(),
    };
}

function controllerFor(payload, { granted = true, repository = stubRepository() } = {}) {
    const controller = new Controller(eventFor(payload), knexConfig());
    controller.user = userWithPermission(granted);
    controller.repository = repository;

    return { controller, repository };
}

const buildItem = (overrides = {}) => ({
    channel_id: 'email',
    client_identifier: uuidv4(),
    external_identifier: `ext-${uuidv4().substring(0, 8)}`,
    priority: 'normal',
    workspace_id: uuidv4(),
    conversation_id: uuidv4(),
    ...overrides,
});

describe('interactions batch controller', () => {
    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('returns forbidden when the user lacks InteractionsCreate', async () => {
        const { controller, repository } = controllerFor([buildItem()], { granted: false });

        const response = await controller.actionCreate();

        expect(response.toJson().statusCode).toBe(403);
        expect(controller.user.hasPermission).toHaveBeenCalledWith(
            'administrador',
            'interactions',
            'InteractionsCreate'
        );
        expect(repository.save).not.toHaveBeenCalled();
    });

    it('rejects a batch larger than the maximum size', async () => {
        const payload = Array.from({ length: MAX_BATCH_SIZE + 1 }, () => buildItem());
        const { controller, repository } = controllerFor(payload);

        const response = await controller.actionCreate();

        expect(response.toJson().statusCode).toBe(400);
        expect(repository.startTransaction).not.toHaveBeenCalled();
    });

    it('rejects an empty batch', async () => {
        const { controller } = controllerFor([]);

        expect((await controller.actionCreate()).toJson().statusCode).toBe(400);
    });

    it('rejects imported closed state without the bulk-close permission', async () => {
        const payload = [
            buildItem({
                is_migrated: true,
                is_closed: true,
                closed_at: new Date().toISOString(),
                closed_by: uuidv4(),
            }),
        ];
        const { controller, repository } = controllerFor(payload);
        controller.user.hasPermission.mockImplementation(
            (role, moduleId, permission) =>
                role === 'administrador' && moduleId === 'interactions' && permission === 'InteractionsCreate'
        );

        const response = await controller.actionCreate();

        expect(response.toJson().statusCode).toBe(403);
        expect(controller.user.hasPermission).toHaveBeenCalledWith(
            'administrador',
            'interactions',
            'InteractionsBulkClose'
        );
        expect(repository.startTransaction).not.toHaveBeenCalled();
    });

    it('checks each related id once, no matter how many items reference it', async () => {
        const workspaceId = uuidv4();
        const emailIds = [uuidv4(), uuidv4()];
        const payload = [
            buildItem({ workspace_id: workspaceId, email_id: emailIds[0] }),
            buildItem({ workspace_id: workspaceId, email_id: emailIds[1] }),
            buildItem({ workspace_id: workspaceId }),
        ];
        const { controller, repository } = controllerFor(payload);

        const response = await controller.actionCreate();

        expect(response.toJson().statusCode).toBe(201);
        // One lookup per unique id: 1 workspace + 2 emails, instead of 3 + 2.
        expect(repository.relationshipLookups).toHaveLength(3);
        expect(repository.relationshipLookups.filter(({ table }) => table === 'workspaces')).toHaveLength(1);
        expect(repository.relationshipLookups.filter(({ table }) => table === 'emails')).toHaveLength(2);
    });

    it('returns the created ids in the order of the request items', async () => {
        const payload = [buildItem(), buildItem(), buildItem()];
        const { controller, repository } = controllerFor(payload);

        const response = await controller.actionCreate();
        const { ids } = JSON.parse(response.toJson().body).data;

        expect(response.toJson().statusCode).toBe(201);
        expect(ids).toHaveLength(payload.length);
        const savedIds = repository.save.mock.calls.map(([interaction]) => interaction.id.value);
        expect(ids).toEqual(savedIds);
        expect(repository.transaction.commit).toHaveBeenCalledTimes(1);
    });
});
