import { jest } from '@jest/globals';
import { RoutingEventBus } from '../../../../src/shared/infrastructure/events/RoutingEventBus.js';
import { ImportExecutionRequested } from '../../../../src/imports/domain/events/ImportExecutionRequested.js';
import { ValueObjectUuid } from '../../../../src/shared/domain/value-object/ValueObjectUuid.js';
import { Helper } from '../../../../src/shared/infrastructure/utils/Helper.js';

function makeMockSqsClient() {
    return { send: jest.fn().mockResolvedValue({ MessageId: 'msg-fifo-1' }) };
}

function makeMockArchiveBus() {
    return {
        publish: jest.fn().mockResolvedValue(undefined),
        publishBatch: jest.fn().mockResolvedValue({ successful: 0, failed: 0 }),
    };
}

describe('RoutingEventBus FIFO Partitioning (User Story 3 - FR-004, SC-005)', () => {
    let sqsClient;
    let archiveBus;
    let bus;

    const queueMap = {
        'kace.core.import_execution.requested': 'https://sqs.test/imports-events-queue.fifo',
        'kace.core.case.created': 'https://sqs.test/cases.fifo',
    };

    beforeEach(() => {
        sqsClient = makeMockSqsClient();
        archiveBus = makeMockArchiveBus();
        bus = new RoutingEventBus({ sqsClient, archiveBus, queueMap });
        jest.spyOn(Helper, 'logMetric').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('assigns MessageGroupId as tenant_id and MessageDeduplicationId as fileId for ImportExecutionRequested', async () => {
        const fileId = ValueObjectUuid.random();
        const tenantId = ValueObjectUuid.random();
        const event = new ImportExecutionRequested({
            fileId,
            targetTable: 'usuarios',
            actionType: 'CREATE',
            metadata: { tenant_id: tenantId, user_id: ValueObjectUuid.random() },
        });

        await bus.publish(event);

        expect(sqsClient.send).toHaveBeenCalledTimes(1);
        const command = sqsClient.send.mock.calls[0][0];
        expect(command.input.QueueUrl).toBe('https://sqs.test/imports-events-queue.fifo');
        expect(command.input.MessageGroupId).toBe(tenantId);
        expect(command.input.MessageDeduplicationId).toBe(fileId);
    });

    it('ensures two imports for the same tenant share the same MessageGroupId for FIFO sequencing', async () => {
        const tenantId = ValueObjectUuid.random();
        const fileId1 = ValueObjectUuid.random();
        const fileId2 = ValueObjectUuid.random();
        const event1 = new ImportExecutionRequested({
            fileId: fileId1,
            targetTable: 'usuarios',
            metadata: { tenant_id: tenantId },
        });
        const event2 = new ImportExecutionRequested({
            fileId: fileId2,
            targetTable: 'usuarios',
            metadata: { tenant_id: tenantId },
        });

        await bus.publish(event1);
        await bus.publish(event2);

        expect(sqsClient.send).toHaveBeenCalledTimes(2);
        const cmd1 = sqsClient.send.mock.calls[0][0];
        const cmd2 = sqsClient.send.mock.calls[1][0];

        expect(cmd1.input.MessageGroupId).toBe(tenantId);
        expect(cmd2.input.MessageGroupId).toBe(tenantId);
        expect(cmd1.input.MessageDeduplicationId).toBe(fileId1);
        expect(cmd2.input.MessageDeduplicationId).toBe(fileId2);
    });

    it('ensures imports for different tenants have distinct MessageGroupIds for concurrent execution', async () => {
        const tenantA = ValueObjectUuid.random();
        const tenantB = ValueObjectUuid.random();

        const eventA = new ImportExecutionRequested({
            fileId: ValueObjectUuid.random(),
            metadata: { tenant_id: tenantA },
        });
        const eventB = new ImportExecutionRequested({
            fileId: ValueObjectUuid.random(),
            metadata: { tenant_id: tenantB },
        });

        await bus.publish(eventA);
        await bus.publish(eventB);

        const cmdA = sqsClient.send.mock.calls[0][0];
        const cmdB = sqsClient.send.mock.calls[1][0];

        expect(cmdA.input.MessageGroupId).toBe(tenantA);
        expect(cmdB.input.MessageGroupId).toBe(tenantB);
    });

    it('assigns MessageGroupId as tenant_id and MessageDeduplicationId as fileId in publishBatch', async () => {
        const tenantId = ValueObjectUuid.random();
        const fileId1 = ValueObjectUuid.random();
        const fileId2 = ValueObjectUuid.random();
        const event1 = new ImportExecutionRequested({
            fileId: fileId1,
            metadata: { tenant_id: tenantId },
        });
        const event2 = new ImportExecutionRequested({
            fileId: fileId2,
            metadata: { tenant_id: tenantId },
        });

        await bus.publishBatch([event1, event2]);

        expect(sqsClient.send).toHaveBeenCalledTimes(1);
        const batchCommand = sqsClient.send.mock.calls[0][0];
        const entries = batchCommand.input.Entries;

        expect(entries[0].MessageGroupId).toBe(tenantId);
        expect(entries[0].MessageDeduplicationId).toBe(fileId1);
        expect(entries[1].MessageGroupId).toBe(tenantId);
        expect(entries[1].MessageDeduplicationId).toBe(fileId2);
    });

    it('preserves standard aggregateId and eventId behavior for non-import events', async () => {
        const caseEvent = {
            eventId: 'evt-case-1',
            eventName: 'kace.core.case.created',
            aggregateId: 'agg-case-999',
            metadata: { tenant_id: 't-random' },
            toJson() {
                return { eventId: this.eventId, eventName: this.eventName };
            },
        };

        await bus.publish(caseEvent);

        const cmd = sqsClient.send.mock.calls[0][0];
        expect(cmd.input.MessageGroupId).toBe('agg-case-999');
        expect(cmd.input.MessageDeduplicationId).toBe('evt-case-1');
    });
});
