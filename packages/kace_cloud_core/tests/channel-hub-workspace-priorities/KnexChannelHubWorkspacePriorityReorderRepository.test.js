import { jest } from '@jest/globals';
import { buildReaderConfig, buildWriterConfig, knexConfig } from '../knexfile.js';
import { ChannelHubWorkspacePriorityReorderRequester } from '../../src/channel-hub-workspace-priorities/application/request/ChannelHubWorkspacePriorityReorderRequester.js';
import { ChannelHubWorkspacePriorityReorderRequested } from '../../src/channel-hub-workspace-priorities/domain/events/ChannelHubWorkspacePriorityReorderRequested.js';
import { ChannelHubWorkspacePriorityReorderOutboxPublisher } from '../../src/channel-hub-workspace-priorities/application/publish/ChannelHubWorkspacePriorityReorderOutboxPublisher.js';
import {
    KnexChannelHubWorkspacePriorityReorderRepository,
    serializeChannelHubWorkspacePriorityReorderStatus,
} from '../../src/channel-hub-workspace-priorities/infrastructure/persistence/KnexChannelHubWorkspacePriorityReorderRepository.js';
import {
    CHANNEL_HUB_WORKSPACE_PRIORITY_REORDER_FAILED,
    CHANNEL_HUB_WORKSPACE_PRIORITIES_UNAVAILABLE,
} from '@kace/error-codes';

const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';
const REST_FLOW_ID = '99999999-9999-4999-8999-999999999999';
const OWNER_ID = '88888888-8888-4888-8888-888888888888';

const eventFor = (operationId) =>
    new ChannelHubWorkspacePriorityReorderRequested({
        accountId: ACCOUNT_ID,
        operationId,
        metadata: { tenant_id: 'tenant-a' },
    });

describe('KnexChannelHubWorkspacePriorityReorderRepository', () => {
    let repository;

    beforeEach(async () => {
        await knexConfig('ws_rest_flows').insert({ id: REST_FLOW_ID });
        await knexConfig('channel_hub_accounts').insert({
            id: ACCOUNT_ID,
            email: 'priority-test@example.com',
            name: 'Priority test',
            country_id: 'CO',
            operator_id: 'imap',
            rest_flow_id: REST_FLOW_ID,
            channel_hub_connection_id: 'connection-priority-test',
            is_active: true,
            created_by: OWNER_ID,
            created_at: new Date(),
            updated_by: OWNER_ID,
            updated_at: new Date(),
        });
        repository = new KnexChannelHubWorkspacePriorityReorderRepository(buildWriterConfig(), buildReaderConfig());
    });

    afterEach(async () => repository.destroyConnection());

    it('serializes same-revision requests through the database active-operation constraint', async () => {
        const priorityManager = { validateReorderRequest: jest.fn().mockResolvedValue({}) };
        const eventBus = { publish: jest.fn().mockResolvedValue(undefined) };
        const requester = new ChannelHubWorkspacePriorityReorderRequester({
            priorityManager,
            operationRepository: repository,
            eventBus,
        });
        const input = { revision: 'same-revision', orderedWorkspaceIds: ['workspace-a'] };

        const outcomes = await Promise.allSettled([
            requester.execute(ACCOUNT_ID, input),
            requester.execute(ACCOUNT_ID, input),
        ]);

        expect(outcomes.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
        const accepted = outcomes.find(({ status }) => status === 'fulfilled').value;
        const rejection = outcomes.find(({ status }) => status === 'rejected');
        expect(rejection.reason).toMatchObject({
            statusCode: 409,
            activeOperation: {
                operationId: accepted.operationId,
                status: 'pending',
            },
        });
        expect(eventBus.publish).toHaveBeenCalledTimes(1);
    });

    it('returns camel-case ownership fields and exposes a safe public status shape', async () => {
        const operation = await repository.create({
            operationId: '33333333-3333-4333-8333-333333333333',
            accountId: ACCOUNT_ID,
            revision: 'revision-1',
            orderedWorkspaceIds: ['workspace-a'],
            requestedBy: null,
            event: eventFor('33333333-3333-4333-8333-333333333333'),
        });

        expect(operation).toMatchObject({
            id: '33333333-3333-4333-8333-333333333333',
            operationId: '33333333-3333-4333-8333-333333333333',
            channelHubAccountId: ACCOUNT_ID,
            accountId: ACCOUNT_ID,
            orderedWorkspaceIds: ['workspace-a'],
            status: 'pending',
            attemptCount: 0,
        });
        expect(serializeChannelHubWorkspacePriorityReorderStatus(operation)).not.toHaveProperty('accountId');
        expect(serializeChannelHubWorkspacePriorityReorderStatus(operation)).not.toHaveProperty('orderedWorkspaceIds');
    });

    it('atomically stages a fixed-id reorder event with the reserved operation', async () => {
        const operationId = '12121212-1212-4212-8212-121212121212';
        const event = eventFor(operationId);

        await repository.create({
            operationId,
            accountId: ACCOUNT_ID,
            revision: 'revision-1',
            orderedWorkspaceIds: ['workspace-a'],
            event,
        });

        const publications = await repository.findPendingPublications({ accountId: ACCOUNT_ID });
        expect(publications).toEqual([
            expect.objectContaining({
                operationId,
                event: event.toJson(),
                publishedAt: null,
            }),
        ]);
    });

    it('keeps receipt status and active-conflict serialization on the writer while outbox scans use the reader', async () => {
        const operationId = '17171717-1717-4717-8717-171717171717';
        await repository.create({
            operationId,
            accountId: ACCOUNT_ID,
            revision: 'revision-reader-routing',
            orderedWorkspaceIds: ['workspace-a'],
            event: eventFor(operationId),
        });
        let writerQueries = 0;
        const countWriterQuery = () => {
            writerQueries += 1;
        };
        repository.connection.on('query', countWriterQuery);

        await repository.findPendingPublications({ accountId: ACCOUNT_ID });
        expect(writerQueries).toBe(0);

        await repository.findById(operationId);
        expect(writerQueries).toBeGreaterThan(0);
        const queriesAfterStatusRead = writerQueries;

        await repository.findActiveByAccountId(ACCOUNT_ID);
        expect(writerQueries).toBeGreaterThan(queriesAfterStatusRead);
        repository.connection.off('query', countWriterQuery);
    });

    it('recovers a crash after reservation by scanning and publishing the staged fixed-id event', async () => {
        const operationId = '15151515-1515-4515-8515-151515151515';
        const event = eventFor(operationId);
        await repository.create({
            operationId,
            accountId: ACCOUNT_ID,
            revision: 'revision-1',
            orderedWorkspaceIds: ['workspace-a'],
            event,
        });
        const [publication] = await repository.findPendingPublications({ accountId: ACCOUNT_ID });
        const eventBus = { publish: jest.fn().mockResolvedValue(undefined) };
        const publisher = new ChannelHubWorkspacePriorityReorderOutboxPublisher({
            operationRepository: repository,
            eventBus,
            ownerIdFactory: () => OWNER_ID,
            now: () => publication.nextAttemptAt,
        });

        await expect(publisher.publishDue()).resolves.toEqual({ claimed: 1, published: 1, failed: 0 });
        await expect(publisher.publishDue()).resolves.toEqual({ claimed: 0, published: 0, failed: 0 });
        expect(eventBus.publish).toHaveBeenCalledTimes(1);
        expect(eventBus.publish.mock.calls[0][0].eventId).toBe(event.eventId);
    });

    it('lets an expired outbox claimant take over and rejects the stale publisher acknowledgement', async () => {
        const operationId = '16161616-1616-4616-8616-161616161616';
        const successorId = '77777777-7777-4777-8777-777777777777';
        const event = eventFor(operationId);
        await repository.create({
            operationId,
            accountId: ACCOUNT_ID,
            revision: 'revision-1',
            orderedWorkspaceIds: ['workspace-a'],
            event,
        });
        const [publication] = await repository.findPendingPublications({ accountId: ACCOUNT_ID });
        await repository.claimPublication(operationId, {
            ownerId: OWNER_ID,
            leaseDurationMs: 1_000,
            now: publication.nextAttemptAt,
        });
        const takeover = await repository.claimPublication(operationId, {
            ownerId: successorId,
            leaseDurationMs: 30_000,
            now: new Date(publication.nextAttemptAt.getTime() + 2_000),
        });

        await expect(
            repository.markPublicationPublished(operationId, {
                eventId: event.eventId,
                ownerId: OWNER_ID,
                now: new Date(publication.nextAttemptAt.getTime() + 3_000),
            })
        ).resolves.toBeNull();
        expect(takeover).toMatchObject({ claimOwnerId: successorId, publishAttemptCount: 2 });
    });

    it('atomically claims an operation lease and rejects a live competing owner', async () => {
        const operationId = '13131313-1313-4313-8313-131313131313';
        await repository.create({
            operationId,
            accountId: ACCOUNT_ID,
            revision: 'revision-1',
            orderedWorkspaceIds: ['workspace-a'],
            event: eventFor(operationId),
        });

        const claimed = await repository.claim(operationId, {
            ownerId: OWNER_ID,
            leaseDurationMs: 60_000,
            now: new Date('2026-08-25T12:00:00.000Z'),
        });
        const competing = await repository.claim(operationId, {
            ownerId: '77777777-7777-4777-8777-777777777777',
            leaseDurationMs: 60_000,
            now: new Date('2026-08-25T12:00:30.000Z'),
        });

        expect(claimed).toMatchObject({
            status: 'in_progress',
            attemptCount: 1,
            leaseOwnerId: OWNER_ID,
            heartbeatAt: new Date('2026-08-25T12:00:00.000Z'),
        });
        expect(competing).toBeNull();
    });

    it('allows lease takeover after expiry and prevents the stale owner from completing', async () => {
        const operationId = '14141414-1414-4414-8414-141414141414';
        const successorId = '77777777-7777-4777-8777-777777777777';
        await repository.create({
            operationId,
            accountId: ACCOUNT_ID,
            revision: 'revision-1',
            orderedWorkspaceIds: ['workspace-a'],
            event: eventFor(operationId),
        });
        await repository.claim(operationId, {
            ownerId: OWNER_ID,
            leaseDurationMs: 1_000,
            now: new Date('2026-08-25T12:00:00.000Z'),
        });
        await repository.claim(operationId, {
            ownerId: successorId,
            leaseDurationMs: 60_000,
            now: new Date('2026-08-25T12:00:02.000Z'),
        });

        const staleCompletion = await repository.markCompleted(
            operationId,
            { items: [], revision: 'revision-final', canReorder: true, conflicts: [] },
            { ownerId: OWNER_ID }
        );

        expect(staleCompletion).toBeNull();
        await expect(repository.findById(operationId)).resolves.toMatchObject({
            status: 'in_progress',
            attemptCount: 2,
            leaseOwnerId: successorId,
        });
    });

    it('persists completed results without priority fields and restores their ordered positions on hydration', async () => {
        const operationId = '77777777-7777-4777-8777-777777777777';
        const orderedWorkspaceIds = ['workspace-support', 'workspace-sales'];
        await repository.create({
            operationId,
            accountId: ACCOUNT_ID,
            revision: 'revision-1',
            orderedWorkspaceIds,
        });

        const completed = await repository.markCompleted(operationId, {
            items: [
                {
                    workspaceId: 'workspace-support',
                    description: 'Customer Support',
                    tag: 'support',
                    priority: 1,
                },
                {
                    workspaceId: 'workspace-sales',
                    description: 'Sales',
                    tag: 'sales',
                    priority: 2,
                },
            ],
            revision: 'revision-2',
            canReorder: true,
            conflicts: [],
        });

        const row = await knexConfig('channel_hub_workspace_priority_reorders').where({ id: operationId }).first();
        const persistedResult = row.result;
        expect(persistedResult.items).toEqual([
            { workspaceId: 'workspace-support', description: 'Customer Support', tag: 'support' },
            { workspaceId: 'workspace-sales', description: 'Sales', tag: 'sales' },
        ]);
        expect(row.ordered_workspace_ids).toEqual(orderedWorkspaceIds);
        expect(completed.result.items).toEqual([
            {
                workspaceId: 'workspace-support',
                description: 'Customer Support',
                tag: 'support',
                priority: 1,
            },
            { workspaceId: 'workspace-sales', description: 'Sales', tag: 'sales', priority: 2 },
        ]);
        expect(serializeChannelHubWorkspacePriorityReorderStatus(completed).result).toEqual(completed.result);
    });

    it('stores only bounded error code and message fields', async () => {
        const operationId = '44444444-4444-4444-8444-444444444444';
        await repository.create({
            operationId,
            accountId: ACCOUNT_ID,
            revision: 'revision-1',
            orderedWorkspaceIds: ['workspace-a'],
        });

        await repository.markFailed(operationId, {
            publicErrorCode: ` ${CHANNEL_HUB_WORKSPACE_PRIORITIES_UNAVAILABLE} `,
            message: 'safe message',
            stack: 'secret stack',
            response: { data: { token: 'secret' } },
        });

        const stored = await repository.findById(operationId);
        expect(stored.error).toEqual({
            code: CHANNEL_HUB_WORKSPACE_PRIORITIES_UNAVAILABLE,
            message: 'Workspace priority reorder failed',
        });
        const row = await knexConfig('channel_hub_workspace_priority_reorders').where({ id: operationId }).first();
        expect(JSON.stringify(row)).not.toContain('secret');
    });

    it('does not persist arbitrary internal error messages', async () => {
        const operationId = '55555555-5555-4555-8555-555555555555';
        await repository.create({
            operationId,
            accountId: ACCOUNT_ID,
            revision: 'revision-1',
            orderedWorkspaceIds: ['workspace-a'],
        });

        await repository.markFailed(operationId, new Error('password=do-not-store'));

        await expect(repository.findById(operationId)).resolves.toMatchObject({
            error: {
                code: CHANNEL_HUB_WORKSPACE_PRIORITY_REORDER_FAILED,
                message: 'Workspace priority reorder failed',
            },
        });
    });

    it('does not trust status-bearing upstream messages without a public code', async () => {
        const operationId = '66666666-6666-4666-8666-666666666666';
        await repository.create({
            operationId,
            accountId: ACCOUNT_ID,
            revision: 'revision-1',
            orderedWorkspaceIds: ['workspace-a'],
        });

        await repository.markFailed(operationId, {
            name: 'ChannelHubMailRulesRestFlowError',
            statusCode: 502,
            message: 'provider host=private.internal token=do-not-store',
        });

        await expect(repository.findById(operationId)).resolves.toMatchObject({
            error: {
                code: CHANNEL_HUB_WORKSPACE_PRIORITIES_UNAVAILABLE,
                message: 'Workspace priority reorder failed',
            },
        });
    });
});
