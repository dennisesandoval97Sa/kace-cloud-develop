import { InMemoryEventBus } from '../../../../src/shared/infrastructure/events/InMemoryEventBus.js';
import { DomainEvent } from '../../../../src/shared/domain/events/DomainEvent.js';
import { ValueObjectUuid } from '../../../../src/shared/domain/value-object/ValueObjectUuid.js';
import { jest } from '@jest/globals';

describe('InMemoryEventBus', () => {
    let eventBus;
    const aggregateId = ValueObjectUuid.random();

    beforeEach(() => {
        eventBus = new InMemoryEventBus();
    });

    afterEach(() => {
        eventBus.clear();
    });

    const createEvent = (eventName, payload = {}) => {
        return new DomainEvent({
            eventName,
            aggregateId,
            payload,
        });
    };

    describe('subscribe', () => {
        it('should register a handler for an event', () => {
            // Arrange
            const handler = jest.fn();

            // Act
            eventBus.subscribe('test.event', handler);

            // Assert
            expect(eventBus.subscriberCount()).toBe(1);
            expect(eventBus.subscriberCountFor('test.event')).toBe(1);
        });

        it('should allow multiple handlers for the same event', () => {
            // Arrange
            const handler1 = jest.fn();
            const handler2 = jest.fn();
            const handler3 = jest.fn();

            // Act
            eventBus.subscribe('test.event', handler1);
            eventBus.subscribe('test.event', handler2);
            eventBus.subscribe('test.event', handler3);

            // Assert
            expect(eventBus.subscriberCountFor('test.event')).toBe(3);
        });

        it('should allow handlers for different events', () => {
            // Arrange
            const handler1 = jest.fn();
            const handler2 = jest.fn();

            // Act
            eventBus.subscribe('event.one', handler1);
            eventBus.subscribe('event.two', handler2);

            // Assert
            expect(eventBus.subscriberCount()).toBe(2);
            expect(eventBus.subscriberCountFor('event.one')).toBe(1);
            expect(eventBus.subscriberCountFor('event.two')).toBe(1);
        });

        it('should throw error if handler is not a function', () => {
            // Arrange & Act & Assert
            expect(() => eventBus.subscribe('test.event', 'not a function')).toThrow(
                'InMemoryEventBus.subscribe: handler must be a function'
            );
            expect(() => eventBus.subscribe('test.event', null)).toThrow(
                'InMemoryEventBus.subscribe: handler must be a function'
            );
            expect(() => eventBus.subscribe('test.event', {})).toThrow(
                'InMemoryEventBus.subscribe: handler must be a function'
            );
        });

        it('should not add duplicate handlers', () => {
            // Arrange
            const handler = jest.fn();

            // Act
            eventBus.subscribe('test.event', handler);
            eventBus.subscribe('test.event', handler); // Same handler

            // Assert
            expect(eventBus.subscriberCountFor('test.event')).toBe(1);
        });
    });

    describe('publish', () => {
        it('should call subscribed handlers with the event', async () => {
            // Arrange
            const handler = jest.fn();
            const event = createEvent('test.event', { data: 'test' });
            eventBus.subscribe('test.event', handler);

            // Act
            await eventBus.publish(event);

            // Assert
            expect(handler).toHaveBeenCalledTimes(1);
            expect(handler).toHaveBeenCalledWith(event);
        });

        it('should call all subscribed handlers', async () => {
            // Arrange
            const handler1 = jest.fn();
            const handler2 = jest.fn();
            const event = createEvent('test.event');
            eventBus.subscribe('test.event', handler1);
            eventBus.subscribe('test.event', handler2);

            // Act
            await eventBus.publish(event);

            // Assert
            expect(handler1).toHaveBeenCalledTimes(1);
            expect(handler2).toHaveBeenCalledTimes(1);
        });

        it('should not call handlers subscribed to different events', async () => {
            // Arrange
            const handler1 = jest.fn();
            const handler2 = jest.fn();
            eventBus.subscribe('event.one', handler1);
            eventBus.subscribe('event.two', handler2);
            const event = createEvent('event.one');

            // Act
            await eventBus.publish(event);

            // Assert
            expect(handler1).toHaveBeenCalledTimes(1);
            expect(handler2).not.toHaveBeenCalled();
        });

        it('should call wildcard handlers for all events', async () => {
            // Arrange
            const wildcardHandler = jest.fn();
            const specificHandler = jest.fn();
            eventBus.subscribe('*', wildcardHandler);
            eventBus.subscribe('specific.event', specificHandler);

            const event1 = createEvent('specific.event');
            const event2 = createEvent('another.event');

            // Act
            await eventBus.publish(event1);
            await eventBus.publish(event2);

            // Assert
            expect(wildcardHandler).toHaveBeenCalledTimes(2);
            expect(specificHandler).toHaveBeenCalledTimes(1);
        });

        it('should handle errors in handlers gracefully', async () => {
            // Arrange
            const errorHandler = jest.fn(() => {
                throw new Error('Handler error');
            });
            const successHandler = jest.fn();
            eventBus.subscribe('test.event', errorHandler);
            eventBus.subscribe('test.event', successHandler);
            const event = createEvent('test.event');

            // Act - should not throw
            await eventBus.publish(event);

            // Assert
            expect(errorHandler).toHaveBeenCalled();
            expect(successHandler).toHaveBeenCalled(); // Should still be called
        });

        it('should handle async handlers', async () => {
            // Arrange
            const results = [];
            const asyncHandler = jest.fn(async (event) => {
                await new Promise((resolve) => setTimeout(resolve, 10));
                results.push(event.eventName);
            });
            eventBus.subscribe('test.event', asyncHandler);
            const event = createEvent('test.event');

            // Act
            await eventBus.publish(event);

            // Assert
            expect(asyncHandler).toHaveBeenCalled();
            expect(results).toContain('test.event');
        });

        it('should handle null event gracefully', async () => {
            // Arrange
            const handler = jest.fn();
            eventBus.subscribe('test.event', handler);

            // Act & Assert - should not throw
            await eventBus.publish(null);
            expect(handler).not.toHaveBeenCalled();
        });

        it('should do nothing when no handlers are subscribed', async () => {
            // Arrange
            const event = createEvent('unsubscribed.event');

            // Act & Assert - should not throw
            await expect(eventBus.publish(event)).resolves.toBeUndefined();
        });
    });

    describe('publishBatch', () => {
        it('should publish multiple events', async () => {
            // Arrange
            const handler = jest.fn();
            eventBus.subscribe('test.event', handler);
            const events = [createEvent('test.event'), createEvent('test.event'), createEvent('test.event')];

            // Act
            await eventBus.publishBatch(events);

            // Assert
            expect(handler).toHaveBeenCalledTimes(3);
        });

        it('should publish events to their respective handlers', async () => {
            // Arrange
            const handler1 = jest.fn();
            const handler2 = jest.fn();
            eventBus.subscribe('event.one', handler1);
            eventBus.subscribe('event.two', handler2);
            const events = [createEvent('event.one'), createEvent('event.two'), createEvent('event.one')];

            // Act
            await eventBus.publishBatch(events);

            // Assert
            expect(handler1).toHaveBeenCalledTimes(2);
            expect(handler2).toHaveBeenCalledTimes(1);
        });

        it('should handle empty array', async () => {
            // Arrange
            const handler = jest.fn();
            eventBus.subscribe('test.event', handler);

            // Act & Assert - should not throw
            await eventBus.publishBatch([]);
            expect(handler).not.toHaveBeenCalled();
        });

        it('should handle null gracefully', async () => {
            // Arrange
            const handler = jest.fn();
            eventBus.subscribe('test.event', handler);

            // Act & Assert - should not throw
            await eventBus.publishBatch(null);
            expect(handler).not.toHaveBeenCalled();
        });
    });

    describe('unsubscribe', () => {
        it('should remove a handler from an event', async () => {
            // Arrange
            const handler = jest.fn();
            eventBus.subscribe('test.event', handler);
            const event = createEvent('test.event');

            // Act
            eventBus.unsubscribe('test.event', handler);
            await eventBus.publish(event);

            // Assert
            expect(handler).not.toHaveBeenCalled();
            expect(eventBus.subscriberCountFor('test.event')).toBe(0);
        });

        it('should only remove the specific handler', async () => {
            // Arrange
            const handler1 = jest.fn();
            const handler2 = jest.fn();
            eventBus.subscribe('test.event', handler1);
            eventBus.subscribe('test.event', handler2);
            const event = createEvent('test.event');

            // Act
            eventBus.unsubscribe('test.event', handler1);
            await eventBus.publish(event);

            // Assert
            expect(handler1).not.toHaveBeenCalled();
            expect(handler2).toHaveBeenCalled();
        });

        it('should handle unsubscribing from non-existent event', () => {
            // Arrange
            const handler = jest.fn();

            // Act & Assert - should not throw
            expect(() => eventBus.unsubscribe('non.existent', handler)).not.toThrow();
        });

        it('should handle unsubscribing non-registered handler', () => {
            // Arrange
            const registeredHandler = jest.fn();
            const unregisteredHandler = jest.fn();
            eventBus.subscribe('test.event', registeredHandler);

            // Act & Assert - should not throw
            expect(() => eventBus.unsubscribe('test.event', unregisteredHandler)).not.toThrow();
            expect(eventBus.subscriberCountFor('test.event')).toBe(1);
        });
    });

    describe('clear', () => {
        it('should remove all subscribers', async () => {
            // Arrange
            const handler1 = jest.fn();
            const handler2 = jest.fn();
            eventBus.subscribe('event.one', handler1);
            eventBus.subscribe('event.two', handler2);
            eventBus.subscribe('*', handler1);
            const event = createEvent('event.one');

            // Act
            eventBus.clear();
            await eventBus.publish(event);

            // Assert
            expect(handler1).not.toHaveBeenCalled();
            expect(handler2).not.toHaveBeenCalled();
            expect(eventBus.subscriberCount()).toBe(0);
        });
    });

    describe('subscriberCount', () => {
        it('should return 0 when no subscribers', () => {
            // Assert
            expect(eventBus.subscriberCount()).toBe(0);
        });

        it('should return correct total count', () => {
            // Arrange
            eventBus.subscribe('event.one', jest.fn());
            eventBus.subscribe('event.one', jest.fn());
            eventBus.subscribe('event.two', jest.fn());
            eventBus.subscribe('*', jest.fn());

            // Assert
            expect(eventBus.subscriberCount()).toBe(4);
        });
    });

    describe('subscriberCountFor', () => {
        it('should return 0 for non-existent event', () => {
            // Assert
            expect(eventBus.subscriberCountFor('non.existent')).toBe(0);
        });

        it('should return correct count for specific event', () => {
            // Arrange
            eventBus.subscribe('test.event', jest.fn());
            eventBus.subscribe('test.event', jest.fn());
            eventBus.subscribe('other.event', jest.fn());

            // Assert
            expect(eventBus.subscriberCountFor('test.event')).toBe(2);
            expect(eventBus.subscriberCountFor('other.event')).toBe(1);
        });
    });
});
