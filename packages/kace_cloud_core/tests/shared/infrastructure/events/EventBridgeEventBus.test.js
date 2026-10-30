import { jest } from '@jest/globals';
import { EventBridgeEventBus } from '../../../../src/shared/infrastructure/events/EventBridgeEventBus.js';
import { DomainEvent } from '../../../../src/shared/domain/events/DomainEvent.js';
import { ValueObjectUuid } from '../../../../src/shared/domain/value-object/ValueObjectUuid.js';

describe('EventBridgeEventBus', () => {
    let eventBridgeEventBus;
    let mockEventBridgeClient;
    const eventBusName = 'kace-events';
    const source = 'kace.core';
    const aggregateId = ValueObjectUuid.random();

    const createEvent = (eventName = 'kace.core.case.created', metadata = {}) => {
        return new DomainEvent({
            eventName,
            aggregateId,
            payload: { clientId: ValueObjectUuid.random() },
            metadata,
        });
    };

    beforeEach(() => {
        mockEventBridgeClient = {
            send: jest.fn().mockResolvedValue({
                FailedEntryCount: 0,
                Entries: [{ EventId: 'eb-event-id-123' }],
            }),
        };
    });

    describe('constructor', () => {
        it('should create an instance with valid params', () => {
            // Act
            const bus = new EventBridgeEventBus({
                eventBridgeClient: mockEventBridgeClient,
                eventBusName,
                source,
            });

            // Assert
            expect(bus).toBeInstanceOf(EventBridgeEventBus);
        });

        it('should throw if eventBridgeClient is not provided', () => {
            // Act & Assert
            expect(() => new EventBridgeEventBus({ eventBusName })).toThrow(
                'EventBridgeEventBus: eventBridgeClient is required'
            );
        });

        it('should use default eventBusName and source if not provided', () => {
            // Act
            const bus = new EventBridgeEventBus({ eventBridgeClient: mockEventBridgeClient });

            // Assert
            expect(bus).toBeInstanceOf(EventBridgeEventBus);
        });
    });

    describe('publish', () => {
        beforeEach(() => {
            eventBridgeEventBus = new EventBridgeEventBus({
                eventBridgeClient: mockEventBridgeClient,
                eventBusName,
                source,
            });
        });

        it('should send a PutEvents command with correct entry', async () => {
            // Arrange
            const event = createEvent();

            // Act
            await eventBridgeEventBus.publish(event);

            // Assert
            expect(mockEventBridgeClient.send).toHaveBeenCalledTimes(1);
            const sentCommand = mockEventBridgeClient.send.mock.calls[0][0];
            const entry = sentCommand.input.Entries[0];

            expect(entry.Source).toBe(source);
            expect(entry.DetailType).toBe('kace.core.case.created');
            expect(entry.EventBusName).toBe(eventBusName);
            expect(entry.Resources).toEqual([aggregateId]);

            const detail = JSON.parse(entry.Detail);
            expect(detail.eventName).toBe('kace.core.case.created');
            expect(detail.aggregateId).toBe(aggregateId);
        });

        it('should include event payload in Detail', async () => {
            // Arrange
            const event = createEvent();

            // Act
            await eventBridgeEventBus.publish(event);

            // Assert
            const sentCommand = mockEventBridgeClient.send.mock.calls[0][0];
            const detail = JSON.parse(sentCommand.input.Entries[0].Detail);

            expect(detail.payload).toBeDefined();
            expect(detail.payload.clientId).toBeDefined();
        });

        it('should include event metadata in Detail', async () => {
            // Arrange
            const event = createEvent('kace.core.case.created', {
                tenant_id: 'tenant-acme',
                user_id: 'user-001',
            });

            // Act
            await eventBridgeEventBus.publish(event);

            // Assert
            const sentCommand = mockEventBridgeClient.send.mock.calls[0][0];
            const detail = JSON.parse(sentCommand.input.Entries[0].Detail);

            expect(detail.metadata.tenant_id).toBe('tenant-acme');
            expect(detail.metadata.user_id).toBe('user-001');
        });

        it('should set Time from event occurredOn', async () => {
            // Arrange
            const event = createEvent();

            // Act
            await eventBridgeEventBus.publish(event);

            // Assert
            const sentCommand = mockEventBridgeClient.send.mock.calls[0][0];
            const entry = sentCommand.input.Entries[0];

            expect(entry.Time).toBeInstanceOf(Date);
        });

        it('should handle null event gracefully', async () => {
            // Act
            const result = await eventBridgeEventBus.publish(null);

            // Assert
            expect(result).toBeUndefined();
            expect(mockEventBridgeClient.send).not.toHaveBeenCalled();
        });

        it('should throw when EventBridge reports failed entries', async () => {
            // Arrange
            const event = createEvent();
            mockEventBridgeClient.send.mockResolvedValueOnce({
                FailedEntryCount: 1,
                Entries: [{ ErrorCode: 'InternalFailure', ErrorMessage: 'Service error' }],
            });

            // Act & Assert
            await expect(eventBridgeEventBus.publish(event)).rejects.toThrow(
                'EventBridgeEventBus: Failed to publish event: InternalFailure - Service error'
            );
        });

        it('should propagate EventBridge SDK errors', async () => {
            // Arrange
            const event = createEvent();
            mockEventBridgeClient.send.mockRejectedValueOnce(new Error('EventBridge Service Unavailable'));

            // Act & Assert
            await expect(eventBridgeEventBus.publish(event)).rejects.toThrow('EventBridge Service Unavailable');
        });
    });

    describe('publishBatch', () => {
        beforeEach(() => {
            eventBridgeEventBus = new EventBridgeEventBus({
                eventBridgeClient: mockEventBridgeClient,
                eventBusName,
                source,
            });
        });

        it('should send a batch of events with correct entries', async () => {
            // Arrange
            const events = [createEvent('kace.core.case.created'), createEvent('kace.core.case.state_changed')];
            mockEventBridgeClient.send.mockResolvedValueOnce({
                FailedEntryCount: 0,
                Entries: [{ EventId: 'eb-1' }, { EventId: 'eb-2' }],
            });

            // Act
            const result = await eventBridgeEventBus.publishBatch(events);

            // Assert
            expect(mockEventBridgeClient.send).toHaveBeenCalledTimes(1);
            const sentCommand = mockEventBridgeClient.send.mock.calls[0][0];
            expect(sentCommand.input.Entries).toHaveLength(2);
            expect(result).toEqual({ successful: 2, failed: 0 });
        });

        it('should split into multiple batches when more than 10 events', async () => {
            // Arrange
            const events = Array.from({ length: 12 }, (_, i) => createEvent(`kace.core.event.${i}`));
            mockEventBridgeClient.send
                .mockResolvedValueOnce({
                    FailedEntryCount: 0,
                    Entries: Array.from({ length: 10 }, () => ({ EventId: 'eb-id' })),
                })
                .mockResolvedValueOnce({
                    FailedEntryCount: 0,
                    Entries: [{ EventId: 'eb-11' }, { EventId: 'eb-12' }],
                });

            // Act
            const result = await eventBridgeEventBus.publishBatch(events);

            // Assert
            expect(mockEventBridgeClient.send).toHaveBeenCalledTimes(2);
            expect(result).toEqual({ successful: 12, failed: 0 });
        });

        it('should report failed entries in batch', async () => {
            // Arrange
            const events = [createEvent(), createEvent(), createEvent()];
            mockEventBridgeClient.send.mockResolvedValueOnce({
                FailedEntryCount: 1,
                Entries: [
                    { EventId: 'eb-1' },
                    { ErrorCode: 'InternalFailure', ErrorMessage: 'Error' },
                    { EventId: 'eb-3' },
                ],
            });

            // Act
            const result = await eventBridgeEventBus.publishBatch(events);

            // Assert
            expect(result).toEqual({ successful: 2, failed: 1 });
        });

        it('should handle empty array', async () => {
            // Act
            const result = await eventBridgeEventBus.publishBatch([]);

            // Assert
            expect(result).toEqual({ successful: 0, failed: 0 });
            expect(mockEventBridgeClient.send).not.toHaveBeenCalled();
        });

        it('should handle null input', async () => {
            // Act
            const result = await eventBridgeEventBus.publishBatch(null);

            // Assert
            expect(result).toEqual({ successful: 0, failed: 0 });
            expect(mockEventBridgeClient.send).not.toHaveBeenCalled();
        });

        it('should propagate EventBridge SDK errors', async () => {
            // Arrange
            const events = [createEvent()];
            mockEventBridgeClient.send.mockRejectedValueOnce(new Error('EventBridge Batch Error'));

            // Act & Assert
            await expect(eventBridgeEventBus.publishBatch(events)).rejects.toThrow('EventBridge Batch Error');
        });
    });

    describe('subscribe', () => {
        it('should throw an error', () => {
            // Arrange
            eventBridgeEventBus = new EventBridgeEventBus({
                eventBridgeClient: mockEventBridgeClient,
            });

            // Act & Assert
            expect(() => eventBridgeEventBus.subscribe('test.event', jest.fn())).toThrow(
                'EventBridgeEventBus does not support subscribe'
            );
        });
    });

    describe('unsubscribe', () => {
        it('should throw an error', () => {
            // Arrange
            eventBridgeEventBus = new EventBridgeEventBus({
                eventBridgeClient: mockEventBridgeClient,
            });

            // Act & Assert
            expect(() => eventBridgeEventBus.unsubscribe('test.event', jest.fn())).toThrow(
                'EventBridgeEventBus does not support unsubscribe'
            );
        });
    });
});
