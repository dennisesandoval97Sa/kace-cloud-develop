import { AggregateRoot } from '../../../src/shared/domain/AggregateRoot.js';
import { DomainEvent } from '../../../src/shared/domain/events/DomainEvent.js';
import { ValueObjectUuid } from '../../../src/shared/domain/value-object/ValueObjectUuid.js';

/**
 * Test aggregate for testing domain events functionality
 */
class TestAggregate extends AggregateRoot {
    constructor(id) {
        super(id);
    }
}

describe('AggregateRoot Domain Events', () => {
    let aggregate;
    let aggregateId;

    beforeEach(() => {
        aggregateId = ValueObjectUuid.random();
        aggregate = new TestAggregate(aggregateId);
    });

    describe('recordDomainEvent', () => {
        it('should record a single domain event', () => {
            // Arrange
            const event = new DomainEvent({
                eventName: 'test.created',
                aggregateId,
            });

            // Act
            aggregate.recordDomainEvent(event);

            // Assert
            expect(aggregate.hasDomainEvents()).toBe(true);
        });

        it('should allow recording multiple domain events', () => {
            // Arrange
            const event1 = new DomainEvent({
                eventName: 'test.created',
                aggregateId,
            });
            const event2 = new DomainEvent({
                eventName: 'test.updated',
                aggregateId,
            });
            const event3 = new DomainEvent({
                eventName: 'test.deleted',
                aggregateId,
            });

            // Act
            aggregate.recordDomainEvent(event1);
            aggregate.recordDomainEvent(event2);
            aggregate.recordDomainEvent(event3);

            // Assert
            const events = aggregate.pullDomainEvents();
            expect(events).toHaveLength(3);
            expect(events[0].eventName).toBe('test.created');
            expect(events[1].eventName).toBe('test.updated');
            expect(events[2].eventName).toBe('test.deleted');
        });

        it('should preserve event order', () => {
            // Arrange
            const eventNames = ['first', 'second', 'third', 'fourth'];
            const events = eventNames.map(
                (name) =>
                    new DomainEvent({
                        eventName: name,
                        aggregateId,
                    })
            );

            // Act
            events.forEach((event) => aggregate.recordDomainEvent(event));

            // Assert
            const pulledEvents = aggregate.pullDomainEvents();
            pulledEvents.forEach((event, index) => {
                expect(event.eventName).toBe(eventNames[index]);
            });
        });
    });

    describe('pullDomainEvents', () => {
        it('should return and clear all recorded events', () => {
            // Arrange
            const event1 = new DomainEvent({
                eventName: 'test.event1',
                aggregateId,
            });
            const event2 = new DomainEvent({
                eventName: 'test.event2',
                aggregateId,
            });
            aggregate.recordDomainEvent(event1);
            aggregate.recordDomainEvent(event2);

            // Act
            const events = aggregate.pullDomainEvents();

            // Assert
            expect(events).toHaveLength(2);
            expect(aggregate.hasDomainEvents()).toBe(false);
            expect(aggregate.pullDomainEvents()).toHaveLength(0);
        });

        it('should return empty array when no events recorded', () => {
            // Arrange - fresh aggregate with no events

            // Act
            const events = aggregate.pullDomainEvents();

            // Assert
            expect(events).toEqual([]);
            expect(events).toHaveLength(0);
        });

        it('should return a copy of events array, not the original', () => {
            // Arrange
            const event = new DomainEvent({
                eventName: 'test.event',
                aggregateId,
            });
            aggregate.recordDomainEvent(event);

            // Act
            const events1 = aggregate.pullDomainEvents();
            aggregate.recordDomainEvent(event);
            const events2 = aggregate.pullDomainEvents();

            // Assert
            expect(events1).not.toBe(events2);
            events1.push(event); // Modifying returned array
            expect(events2).toHaveLength(1); // Should not affect subsequent pulls
        });

        it('should allow recording new events after pulling', () => {
            // Arrange
            const event1 = new DomainEvent({
                eventName: 'test.first',
                aggregateId,
            });
            const event2 = new DomainEvent({
                eventName: 'test.second',
                aggregateId,
            });

            // Act
            aggregate.recordDomainEvent(event1);
            const firstPull = aggregate.pullDomainEvents();
            aggregate.recordDomainEvent(event2);
            const secondPull = aggregate.pullDomainEvents();

            // Assert
            expect(firstPull).toHaveLength(1);
            expect(firstPull[0].eventName).toBe('test.first');
            expect(secondPull).toHaveLength(1);
            expect(secondPull[0].eventName).toBe('test.second');
        });
    });

    describe('hasDomainEvents', () => {
        it('should return false when no events are recorded', () => {
            // Arrange - fresh aggregate

            // Act & Assert
            expect(aggregate.hasDomainEvents()).toBe(false);
        });

        it('should return true when events are recorded', () => {
            // Arrange
            const event = new DomainEvent({
                eventName: 'test.event',
                aggregateId,
            });

            // Act
            aggregate.recordDomainEvent(event);

            // Assert
            expect(aggregate.hasDomainEvents()).toBe(true);
        });

        it('should return false after events are pulled', () => {
            // Arrange
            const event = new DomainEvent({
                eventName: 'test.event',
                aggregateId,
            });
            aggregate.recordDomainEvent(event);

            // Act
            aggregate.pullDomainEvents();

            // Assert
            expect(aggregate.hasDomainEvents()).toBe(false);
        });

        it('should correctly track multiple record and pull cycles', () => {
            // Arrange
            const event = new DomainEvent({
                eventName: 'test.event',
                aggregateId,
            });

            // Act & Assert - Cycle 1
            expect(aggregate.hasDomainEvents()).toBe(false);
            aggregate.recordDomainEvent(event);
            expect(aggregate.hasDomainEvents()).toBe(true);
            aggregate.pullDomainEvents();
            expect(aggregate.hasDomainEvents()).toBe(false);

            // Act & Assert - Cycle 2
            aggregate.recordDomainEvent(event);
            aggregate.recordDomainEvent(event);
            expect(aggregate.hasDomainEvents()).toBe(true);
            aggregate.pullDomainEvents();
            expect(aggregate.hasDomainEvents()).toBe(false);
        });
    });

    describe('integration with AggregateRoot', () => {
        it('should not interfere with existing AggregateRoot functionality', () => {
            // Arrange
            const event = new DomainEvent({
                eventName: 'test.event',
                aggregateId,
            });

            // Act
            aggregate.recordDomainEvent(event);
            aggregate.created_at = new Date().toISOString();
            aggregate.created_by = ValueObjectUuid.random();

            // Assert
            expect(aggregate.id.value).toBe(aggregateId);
            expect(aggregate.created_at).toBeDefined();
            expect(aggregate.created_by).toBeDefined();
            expect(aggregate.hasDomainEvents()).toBe(true);
        });

        it('should work correctly after toJson is called', () => {
            // Arrange
            const event = new DomainEvent({
                eventName: 'test.event',
                aggregateId,
            });

            // Act
            aggregate.recordDomainEvent(event);
            const json = aggregate.toJson();
            const events = aggregate.pullDomainEvents();

            // Assert
            expect(json.id).toBe(aggregateId);
            expect(events).toHaveLength(1);
        });
    });
});
