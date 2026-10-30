import { jest } from '@jest/globals';
import { ActionQueueExecutionsExecutor } from '../../src/actions-queue-executions/application/executions/ActionQueueExecutionsExecutor.js';

function makeTenant() {
    return { id: { value: 'tenant-1' } };
}
function makeRepoMocks() {
    const noop = jest.fn(async () => {});
    return {
        repository: { save: noop, find: jest.fn(async () => null), connection: function fakeKnex() {} },
        actionRepository: {},
        caseRepository: { connection: function fakeKnex() {}, read: {} },
        backgroundExecutionRepository: { updateBackgroundExecution: noop, findByProcess: jest.fn(async () => null) },
        automationSettingsRepository: {},
        groupsRepository: {},
        userListsRepository: {},
    };
}
// DomainEvent validates aggregateId (== dto.id) as a UUID, so DTO ids must be
// real UUIDs. Build deterministic UUIDs keyed by index so tests can reference them.
function execId(i) {
    return `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
}
function makeDto(i) {
    return {
        id: execId(i),
        action_id: `00000000-0000-4000-8000-${String(1000 + i).padStart(12, '0')}`,
        case_id: `00000000-0000-4000-8000-${String(2000 + i).padStart(12, '0')}`,
        client_id: `00000000-0000-4000-8000-${String(3000 + i).padStart(12, '0')}`,
        status: 'pending',
        trigger_type: 'cron_job',
        created_at: new Date().toISOString(),
        created_by: '00000000-0000-4000-8000-000000009999',
    };
}
function buildExecutor(eventPublisher) {
    const m = makeRepoMocks();
    return new ActionQueueExecutionsExecutor(
        m.repository,
        m.actionRepository,
        m.caseRepository,
        m.backgroundExecutionRepository,
        m.automationSettingsRepository,
        m.groupsRepository,
        m.userListsRepository,
        eventPublisher,
        makeTenant()
    );
}
describe('ActionQueueExecutionsExecutor publish batch path', () => {
    let eventPublisher;
    beforeEach(() => {
        eventPublisher = {
            publish: jest.fn(async () => {}),
            publishAll: jest.fn(async () => ({ successful: 0, failed: 0, failedAggregateIds: [] })),
        };
    });
    it('publishes all persisted events in a single publishAll call (no per-event publish)', async () => {
        const executor = buildExecutor(eventPublisher);
        await executor._publishPersistedExecutionsForTest([makeDto(1), makeDto(2), makeDto(3)]);
        expect(eventPublisher.publishAll).toHaveBeenCalledTimes(1);
        expect(eventPublisher.publish).not.toHaveBeenCalled();
        expect(eventPublisher.publishAll.mock.calls[0][0]).toHaveLength(3);
    });
    it('reconciles failedAggregateIds into EVENT_PUBLISH_FAILED count', async () => {
        eventPublisher.publishAll.mockResolvedValue({ successful: 2, failed: 1, failedAggregateIds: [execId(2)] });
        const executor = buildExecutor(eventPublisher);
        const failedCount = await executor._publishPersistedExecutionsForTest([makeDto(1), makeDto(2), makeDto(3)]);
        expect(failedCount).toBe(1);
    });
    it('counts all events as failed when publishAll throws (no event lost)', async () => {
        eventPublisher.publishAll.mockRejectedValue(new Error('SQS down'));
        const executor = buildExecutor(eventPublisher);
        const failedCount = await executor._publishPersistedExecutionsForTest([makeDto(1), makeDto(2)]);
        expect(failedCount).toBe(2);
    });
});
