import { EventPublisher } from '../../../../src/shared/application/events/EventPublisher.js';
import { DomainEvent } from '../../../../src/shared/domain/events/DomainEvent.js';
import { ValueObjectUuid } from '../../../../src/shared/domain/value-object/ValueObjectUuid.js';
import { jest } from '@jest/globals';

describe('EventPublisher', () => {
    const aggregateId = ValueObjectUuid.random();

    const createEvent = (eventName = 'test.event', payload = {}) => {
        return new DomainEvent({
            eventName,
            aggregateId,
            payload,
        });
    };

    const createMockEventBus = () => ({
        publish: jest.fn(async () => {}),
        publishBatch: jest.fn(async () => {}),
        subscribe: jest.fn(),
        unsubscribe: jest.fn(),
    });

    describe('constructor', () => {
        it('should create EventPublisher with valid eventBus', () => {
            // Arrange
            const eventBus = createMockEventBus();

            // Act & Assert - should not throw
            expect(() => new EventPublisher(eventBus)).not.toThrow();
        });

        it('should throw error when eventBus is not provided', () => {
            // Arrange & Act & Assert
            expect(() => new EventPublisher()).toThrow('EventPublisher: eventBus is required');
            expect(() => new EventPublisher(null)).toThrow('EventPublisher: eventBus is required');
            expect(() => new EventPublisher(undefined)).toThrow('EventPublisher: eventBus is required');
        });
    });

    describe('publish', () => {
        it('should publish a single event', async () => {
            // Arrange
            const eventBus = createMockEventBus();
            const publisher = new EventPublisher(eventBus);
            const event = createEvent('test.created');

            // Act
            await publisher.publish(event);

            // Assert
            expect(eventBus.publish).toHaveBeenCalledTimes(1);
            expect(eventBus.publish).toHaveBeenCalledWith(event);
        });

        it('should skip publishing when event is null', async () => {
            // Arrange
            const eventBus = createMockEventBus();
            const publisher = new EventPublisher(eventBus);

            // Act
            await publisher.publish(null);

            // Assert
            expect(eventBus.publish).not.toHaveBeenCalled();
        });

        it('should skip publishing when event is undefined', async () => {
            // Arrange
            const eventBus = createMockEventBus();
            const publisher = new EventPublisher(eventBus);

            // Act
            await publisher.publish(undefined);

            // Assert
            expect(eventBus.publish).not.toHaveBeenCalled();
        });

        it('should propagate errors from eventBus', async () => {
            // Arrange
            const eventBus = createMockEventBus();
            eventBus.publish.mockRejectedValue(new Error('Publish failed'));
            const publisher = new EventPublisher(eventBus);
            const event = createEvent();

            // Act & Assert
            await expect(publisher.publish(event)).rejects.toThrow('Publish failed');
        });
    });

    describe('publishAll', () => {
        it('should publish multiple events using publishBatch', async () => {
            // Arrange
            const eventBus = createMockEventBus();
            const publisher = new EventPublisher(eventBus);
            const events = [createEvent('event.one'), createEvent('event.two'), createEvent('event.three')];

            // Act
            await publisher.publishAll(events);

            // Assert
            expect(eventBus.publishBatch).toHaveBeenCalledTimes(1);
            expect(eventBus.publishBatch).toHaveBeenCalledWith(events);
        });

        it('should skip when events array is empty', async () => {
            // Arrange
            const eventBus = createMockEventBus();
            const publisher = new EventPublisher(eventBus);

            // Act
            await publisher.publishAll([]);

            // Assert
            expect(eventBus.publishBatch).not.toHaveBeenCalled();
        });

        it('should skip when events is null', async () => {
            // Arrange
            const eventBus = createMockEventBus();
            const publisher = new EventPublisher(eventBus);

            // Act
            await publisher.publishAll(null);

            // Assert
            expect(eventBus.publishBatch).not.toHaveBeenCalled();
        });

        it('should skip when events is undefined', async () => {
            // Arrange
            const eventBus = createMockEventBus();
            const publisher = new EventPublisher(eventBus);

            // Act
            await publisher.publishAll(undefined);

            // Assert
            expect(eventBus.publishBatch).not.toHaveBeenCalled();
        });

        it('should propagate errors from eventBus', async () => {
            // Arrange
            const eventBus = createMockEventBus();
            eventBus.publishBatch.mockRejectedValue(new Error('Batch publish failed'));
            const publisher = new EventPublisher(eventBus);
            const events = [createEvent()];

            // Act & Assert
            await expect(publisher.publishAll(events)).rejects.toThrow('Batch publish failed');
        });

        it('should return the result from eventBus.publishBatch', async () => {
            const eventBus = createMockEventBus();
            const expected = { successful: 2, failed: 1, failedAggregateIds: ['exec-9'] };
            eventBus.publishBatch.mockResolvedValue(expected);
            const publisher = new EventPublisher(eventBus);
            const events = [createEvent('event.one'), createEvent('event.two')];
            const result = await publisher.publishAll(events);
            expect(result).toEqual(expected);
        });
    });

    describe('integration scenario', () => {
        it('should work with a real-ish event flow', async () => {
            // Arrange
            const eventBus = createMockEventBus();
            const publisher = new EventPublisher(eventBus);

            // Simulate aggregate producing events
            const events = [
                createEvent('case.created', { caseNumber: 'CASE-001' }),
                createEvent('case.assigned', { assignee: 'user-123' }),
            ];

            // Act
            await publisher.publishAll(events);

            // Assert
            expect(eventBus.publishBatch).toHaveBeenCalledWith(events);
            expect(eventBus.publishBatch.mock.calls[0][0]).toHaveLength(2);
            expect(eventBus.publishBatch.mock.calls[0][0][0].eventName).toBe('case.created');
            expect(eventBus.publishBatch.mock.calls[0][0][1].eventName).toBe('case.assigned');
        });
    });
});
