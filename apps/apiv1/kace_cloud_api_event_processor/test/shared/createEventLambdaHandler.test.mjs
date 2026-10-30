import { jest } from '@jest/globals';
import { randomUUID } from 'node:crypto';

jest.unstable_mockModule('@kace/api-common/src/middleware/TenantContextManager.js', () => ({
    TenantContextManager: {
        getTenant: jest.fn().mockResolvedValue({ id: { value: 't-1' } }),
        buildKnexConfig: jest.fn().mockReturnValue({ pool: { max: 5 } }),
        buildReaderConfig: jest.fn().mockReturnValue({ pool: { max: 5 }, role: 'reader' }),
    },
}));

const { TenantContextManager } = await import('@kace/api-common/src/middleware/TenantContextManager.js');

jest.unstable_mockModule('@kace/core/src/shared/infrastructure/context/TenantContext.js', () => ({
    TenantContext: {
        run: jest.fn(async (_tenant, fn) => fn()),
        getTenant: jest.fn().mockReturnValue(null),
        getTenantId: jest.fn().mockReturnValue(null),
        getService: jest.fn().mockReturnValue(null),
    },
}));

const destroyConnectionMock = jest.fn().mockResolvedValue(undefined);
jest.unstable_mockModule('@kace/core/src/users/index.js', () => ({
    KnexUsersRepository: jest.fn().mockImplementation(() => ({
        connection: { mock: 'knex' },
        destroyConnection: destroyConnectionMock,
    })),
}));

jest.unstable_mockModule('../../src/shared/runWithDeduplication.mjs', () => ({
    runWithDeduplication: jest.fn(),
}));

const logMetricMock = jest.fn();
jest.unstable_mockModule('@kace/core/src/shared/infrastructure/utils/Helper.js', () => ({
    Helper: { logMetric: logMetricMock, logDebug: jest.fn(), logError: jest.fn(), logInfo: jest.fn() },
}));

const { createEventLambdaHandler } = await import('../../src/shared/createEventLambdaHandler.mjs');
const { runWithDeduplication } = await import('../../src/shared/runWithDeduplication.mjs');
const { KnexUsersRepository } = await import('@kace/core/src/users/index.js');
const { Helper } = await import('@kace/core/src/shared/infrastructure/utils/Helper.js');

function makeSqsEvent(domainEventBody, messageId = 'm-1') {
    return {
        Records: [{ body: JSON.stringify(domainEventBody), messageId }],
    };
}

const sampleDomainEvent = {
    eventId: randomUUID(),
    eventName: 'kace.core.case.created',
    aggregateId: randomUUID(),
    occurredOn: new Date().toISOString(),
    payload: {},
    metadata: { tenant_id: 't-1' },
};

describe('createEventLambdaHandler', () => {
    beforeEach(() => {
        runWithDeduplication.mockReset();
        runWithDeduplication.mockResolvedValue({ deduped: false });
        destroyConnectionMock.mockClear();
        KnexUsersRepository.mockClear();
        TenantContextManager.getTenant.mockReset();
        TenantContextManager.getTenant.mockResolvedValue({ id: { value: 't-1' } });
        logMetricMock.mockClear();
    });

    it('processes a single SQS event end-to-end (no failures)', async () => {
        const handler = createEventLambdaHandler({
            handlerFactories: new Map([['kace.core.case.created', jest.fn()]]),
            lambdaName: 'TestProcessor',
        });

        const result = await handler(makeSqsEvent(sampleDomainEvent));

        expect(runWithDeduplication).toHaveBeenCalledTimes(1);
        expect(result).toEqual({ batchItemFailures: [] });
        expect(destroyConnectionMock).toHaveBeenCalledTimes(1);
    });

    it('propagates the tenant writer config and live Lambda remaining time to event handlers', async () => {
        const routedHandler = jest.fn().mockResolvedValue(undefined);
        runWithDeduplication.mockImplementation(async (domainEvent, userRepository, handlers) => {
            await handlers.get(domainEvent.eventName)({ userRepository }, domainEvent);
            return { deduped: false };
        });
        const handler = createEventLambdaHandler({
            handlerFactories: new Map([['kace.core.case.created', routedHandler]]),
            lambdaName: 'TestProcessor',
        });
        const lambdaContext = { getRemainingTimeInMillis: jest.fn().mockReturnValue(42_000) };

        await handler(makeSqsEvent(sampleDomainEvent), lambdaContext);

        const routedContext = routedHandler.mock.calls[0][0];
        expect(routedContext.writerConfig).toEqual({ pool: { max: 5 } });
        expect(routedContext.readerConfig).toEqual({ pool: { max: 5 }, role: 'reader' });
        expect(routedContext.getRemainingTimeInMillis()).toBe(42_000);
        expect(lambdaContext.getRemainingTimeInMillis).toHaveBeenCalled();
    });

    it('marks message as batch failure when handler throws', async () => {
        runWithDeduplication.mockRejectedValueOnce(new Error('handler boom'));
        const onRecordFailure = jest.fn().mockResolvedValue(undefined);
        const handler = createEventLambdaHandler({
            handlerFactories: new Map([['kace.core.case.created', jest.fn()]]),
            lambdaName: 'TestProcessor',
            onRecordFailure,
        });

        const event = makeSqsEvent(sampleDomainEvent, 'm-fail');
        const result = await handler(event);

        expect(result.batchItemFailures).toEqual([{ itemIdentifier: 'm-fail' }]);
        expect(onRecordFailure).toHaveBeenCalledWith({
            record: event.Records[0],
            domainEvent: expect.objectContaining({ eventId: sampleDomainEvent.eventId }),
            tenant: { id: { value: 't-1' } },
            error: expect.objectContaining({ message: 'handler boom' }),
        });
    });

    it('keeps the record failed when failure handling also throws', async () => {
        runWithDeduplication.mockRejectedValueOnce(new Error('handler boom'));
        const handler = createEventLambdaHandler({
            handlerFactories: new Map([['kace.core.case.created', jest.fn()]]),
            lambdaName: 'TestProcessor',
            onRecordFailure: jest.fn().mockRejectedValue(new Error('visibility update failed')),
        });

        const result = await handler(makeSqsEvent(sampleDomainEvent, 'm-fail'));

        expect(result.batchItemFailures).toEqual([{ itemIdentifier: 'm-fail' }]);
    });

    it('marks parse failures as batch failures', async () => {
        const handler = createEventLambdaHandler({
            handlerFactories: new Map(),
            lambdaName: 'TestProcessor',
        });

        const result = await handler({
            Records: [{ body: 'not-json{', messageId: 'm-bad' }],
        });

        expect(result.batchItemFailures).toEqual([{ itemIdentifier: 'm-bad' }]);
        expect(runWithDeduplication).not.toHaveBeenCalled();
    });

    it('processes EventBridge-format events', async () => {
        const handler = createEventLambdaHandler({
            handlerFactories: new Map([['kace.core.case.created', jest.fn()]]),
            lambdaName: 'TestProcessor',
        });

        const result = await handler({
            'detail-type': 'kace.core.case.created',
            detail: sampleDomainEvent,
            id: 'eb-id',
        });

        expect(runWithDeduplication).toHaveBeenCalledTimes(1);
        expect(result.batchItemFailures).toEqual([]);
    });

    it('skips events with missing tenant_id (no failure, no invoke)', async () => {
        const eventNoTenant = { ...sampleDomainEvent, eventId: randomUUID(), aggregateId: randomUUID(), metadata: {} };
        const handler = createEventLambdaHandler({
            handlerFactories: new Map([['kace.core.case.created', jest.fn()]]),
            lambdaName: 'TestProcessor',
        });

        const result = await handler(makeSqsEvent(eventNoTenant));

        expect(runWithDeduplication).not.toHaveBeenCalled();
        expect(result.batchItemFailures).toEqual([]);
    });

    it('groups multiple events of same tenant into a single connection', async () => {
        const handler = createEventLambdaHandler({
            handlerFactories: new Map([['kace.core.case.created', jest.fn()]]),
            lambdaName: 'TestProcessor',
        });

        const events = {
            Records: [
                { body: JSON.stringify({ ...sampleDomainEvent, eventId: randomUUID() }), messageId: 'a' },
                { body: JSON.stringify({ ...sampleDomainEvent, eventId: randomUUID() }), messageId: 'b' },
            ],
        };
        await handler(events);

        expect(runWithDeduplication).toHaveBeenCalledTimes(2);
        expect(destroyConnectionMock).toHaveBeenCalledTimes(1);
    });

    it('tenant-load failure marks all items of that tenant as batch failures', async () => {
        TenantContextManager.getTenant.mockRejectedValueOnce(new Error('DynamoDB unavailable'));

        const handler = createEventLambdaHandler({
            handlerFactories: new Map([['kace.core.case.created', jest.fn()]]),
            lambdaName: 'TestProcessor',
        });

        const events = {
            Records: [
                { body: JSON.stringify({ ...sampleDomainEvent, eventId: randomUUID() }), messageId: 'm-fail-1' },
                { body: JSON.stringify({ ...sampleDomainEvent, eventId: randomUUID() }), messageId: 'm-fail-2' },
            ],
        };

        const result = await handler(events);

        expect(result.batchItemFailures).toEqual(
            expect.arrayContaining([{ itemIdentifier: 'm-fail-1' }, { itemIdentifier: 'm-fail-2' }])
        );
        expect(result.batchItemFailures).toHaveLength(2);
        expect(runWithDeduplication).not.toHaveBeenCalled();
        expect(destroyConnectionMock).not.toHaveBeenCalled();
    });

    it('destroys the connection even when a per-item handler throws', async () => {
        runWithDeduplication.mockRejectedValueOnce(new Error('boom'));

        const handler = createEventLambdaHandler({
            handlerFactories: new Map([['kace.core.case.created', jest.fn()]]),
            lambdaName: 'TestProcessor',
        });

        const result = await handler(makeSqsEvent({ ...sampleDomainEvent, eventId: randomUUID() }, 'm-item-fail'));

        expect(result.batchItemFailures).toEqual([{ itemIdentifier: 'm-item-fail' }]);
        expect(destroyConnectionMock).toHaveBeenCalledTimes(1);
    });

    it('emits HandlerLatency metric for a processed event', async () => {
        runWithDeduplication.mockResolvedValue({ deduped: false });
        const handler = createEventLambdaHandler({
            handlerFactories: new Map([['kace.core.case.created', jest.fn()]]),
            lambdaName: 'TestProcessor',
        });
        await handler(makeSqsEvent(sampleDomainEvent));
        expect(Helper.logMetric).toHaveBeenCalledWith(
            'EventProcessor.HandlerLatency',
            expect.any(Number),
            'Milliseconds',
            { BC: 'TestProcessor', EventName: 'kace.core.case.created' }
        );
    });

    it('emits DedupHits metric when the event was deduped', async () => {
        runWithDeduplication.mockResolvedValue({ deduped: true });
        const handler = createEventLambdaHandler({
            handlerFactories: new Map([['kace.core.case.created', jest.fn()]]),
            lambdaName: 'TestProcessor',
        });
        await handler(makeSqsEvent(sampleDomainEvent));
        expect(Helper.logMetric).toHaveBeenCalledWith('EventProcessor.DedupHits', 1, 'Count', {
            BC: 'TestProcessor',
            EventName: 'kace.core.case.created',
        });
    });

    it('emits HandlerErrors metric when the handler throws', async () => {
        runWithDeduplication.mockRejectedValueOnce(new Error('handler boom'));
        const handler = createEventLambdaHandler({
            handlerFactories: new Map([['kace.core.case.created', jest.fn()]]),
            lambdaName: 'TestProcessor',
        });
        await handler(makeSqsEvent(sampleDomainEvent, 'm-fail'));
        expect(Helper.logMetric).toHaveBeenCalledWith('EventProcessor.HandlerErrors', 1, 'Count', {
            BC: 'TestProcessor',
            EventName: 'kace.core.case.created',
            ErrorType: 'Error',
        });
    });

    it('multi-tenant isolation: one tenant failure does not block the other and each gets its own connection', async () => {
        const okTenantId = 't-ok';
        const failTenantId = 't-fail';

        const okEvent = {
            ...sampleDomainEvent,
            eventId: randomUUID(),
            aggregateId: randomUUID(),
            metadata: { tenant_id: okTenantId },
        };
        const failEvent = {
            ...sampleDomainEvent,
            eventId: randomUUID(),
            aggregateId: randomUUID(),
            metadata: { tenant_id: failTenantId },
        };

        runWithDeduplication.mockImplementation(async (domainEvent) => {
            if (domainEvent.metadata.tenant_id === failTenantId) {
                throw new Error('processing failed for t-fail');
            }
            return { deduped: false };
        });

        const handler = createEventLambdaHandler({
            handlerFactories: new Map([['kace.core.case.created', jest.fn()]]),
            lambdaName: 'TestProcessor',
        });

        const events = {
            Records: [
                { body: JSON.stringify(okEvent), messageId: 'm-ok' },
                { body: JSON.stringify(failEvent), messageId: 'm-fail' },
            ],
        };

        const result = await handler(events);

        expect(KnexUsersRepository).toHaveBeenCalledTimes(2);
        expect(destroyConnectionMock).toHaveBeenCalledTimes(2);
        expect(runWithDeduplication).toHaveBeenCalledTimes(2);
        expect(result.batchItemFailures).toEqual([{ itemIdentifier: 'm-fail' }]);
    });
});
