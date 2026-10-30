import { DomainEvent } from '../../../../src/shared/domain/events/DomainEvent.js';
import { ValueObjectUuid } from '../../../../src/shared/domain/value-object/ValueObjectUuid.js';

describe('DomainEvent', () => {
    const validAggregateId = ValueObjectUuid.random();
    const eventName = 'test.event.created';

    describe('constructor', () => {
        it('should create event with valid parameters', () => {
            // Arrange
            const payload = { field1: 'value1', field2: 123 };
            const metadata = {
                tenant_id: 'tenant-123',
                user_id: 'user-456',
                correlation_id: 'corr-789',
                causation_id: 'cause-012',
            };

            // Act
            const event = new DomainEvent({
                eventName,
                aggregateId: validAggregateId,
                payload,
                metadata,
            });

            // Assert
            expect(event.eventName).toBe(eventName);
            expect(event.aggregateId).toBe(validAggregateId);
            expect(event.payload).toEqual(payload);
            expect(event.metadata.tenant_id).toBe('tenant-123');
            expect(event.metadata.user_id).toBe('user-456');
            expect(event.metadata.correlation_id).toBe('corr-789');
            expect(event.metadata.causation_id).toBe('cause-012');
            expect(event.eventId).toBeDefined();
            expect(event.occurredOn).toBeDefined();
        });

        it('should create event with empty payload', () => {
            // Arrange & Act
            const event = new DomainEvent({
                eventName,
                aggregateId: validAggregateId,
            });

            // Assert
            expect(event.payload).toEqual({});
        });

        it('should create event with default metadata values', () => {
            // Arrange & Act
            const event = new DomainEvent({
                eventName,
                aggregateId: validAggregateId,
            });

            // Assert
            expect(event.metadata.tenant_id).toBeNull();
            expect(event.metadata.user_id).toBeNull();
            expect(event.metadata.correlation_id).toBeNull();
            expect(event.metadata.causation_id).toBeNull();
        });

        it('should generate unique IDs for each event', () => {
            // Arrange & Act
            const event1 = new DomainEvent({ eventName, aggregateId: validAggregateId });
            const event2 = new DomainEvent({ eventName, aggregateId: validAggregateId });

            // Assert
            expect(event1.eventId).not.toBe(event2.eventId);
        });

        it('should use provided eventId when specified', () => {
            // Arrange
            const customEventId = ValueObjectUuid.random();

            // Act
            const event = new DomainEvent({
                eventName,
                aggregateId: validAggregateId,
                eventId: customEventId,
            });

            // Assert
            expect(event.eventId).toBe(customEventId);
        });

        it('should use provided occurredOn when specified', () => {
            // Arrange
            const customOccurredOn = '2024-01-15T10:30:00.000Z';

            // Act
            const event = new DomainEvent({
                eventName,
                aggregateId: validAggregateId,
                occurredOn: customOccurredOn,
            });

            // Assert
            expect(event.occurredOn).toBe(customOccurredOn);
        });

        it('should throw error when eventName is not provided', () => {
            // Arrange & Act & Assert
            expect(() => {
                new DomainEvent({
                    aggregateId: validAggregateId,
                });
            }).toThrow('DomainEvent: eventName is required');
        });

        it('should throw error when aggregateId is not provided', () => {
            // Arrange & Act & Assert
            expect(() => {
                new DomainEvent({
                    eventName,
                });
            }).toThrow('DomainEvent: aggregateId is required');
        });

        it('should throw error when aggregateId is not a valid UUID', () => {
            // Arrange & Act & Assert
            expect(() => {
                new DomainEvent({
                    eventName,
                    aggregateId: 'invalid-uuid',
                });
            }).toThrow(/Invalid value.*for object uuid/);
        });
    });

    describe('immutability', () => {
        it('should be frozen after creation', () => {
            // Arrange
            const event = new DomainEvent({
                eventName,
                aggregateId: validAggregateId,
            });

            // Assert
            expect(Object.isFrozen(event)).toBe(true);
        });

        it('should have frozen payload', () => {
            // Arrange
            const payload = { field1: 'value1' };
            const event = new DomainEvent({
                eventName,
                aggregateId: validAggregateId,
                payload,
            });

            // Assert
            expect(Object.isFrozen(event.payload)).toBe(true);
        });

        it('should have frozen metadata', () => {
            // Arrange
            const event = new DomainEvent({
                eventName,
                aggregateId: validAggregateId,
                metadata: { tenant_id: 'test' },
            });

            // Assert
            expect(Object.isFrozen(event.metadata)).toBe(true);
        });
    });

    describe('toJson', () => {
        it('should return correct JSON representation', () => {
            // Arrange
            const payload = { field1: 'value1' };
            const metadata = { tenant_id: 'tenant-123' };
            const eventId = ValueObjectUuid.random();
            const occurredOn = '2024-01-15T10:30:00.000Z';

            const event = new DomainEvent({
                eventName,
                aggregateId: validAggregateId,
                payload,
                metadata,
                eventId,
                occurredOn,
            });

            // Act
            const json = event.toJson();

            // Assert
            expect(json).toEqual({
                eventId,
                eventName,
                aggregateId: validAggregateId,
                occurredOn,
                payload: { field1: 'value1' },
                metadata: expect.objectContaining({
                    tenant_id: 'tenant-123',
                }),
            });
        });

        it('should return a new object each time', () => {
            // Arrange
            const event = new DomainEvent({
                eventName,
                aggregateId: validAggregateId,
            });

            // Act
            const json1 = event.toJson();
            const json2 = event.toJson();

            // Assert
            expect(json1).not.toBe(json2);
            expect(json1).toEqual(json2);
        });
    });

    describe('fromJson', () => {
        it('should reconstruct event from JSON', () => {
            // Arrange
            const originalEvent = new DomainEvent({
                eventName,
                aggregateId: validAggregateId,
                payload: { field1: 'value1' },
                metadata: { tenant_id: 'tenant-123' },
            });
            const json = originalEvent.toJson();

            // Act
            const reconstructedEvent = DomainEvent.fromJson(json);

            // Assert
            expect(reconstructedEvent.eventId).toBe(originalEvent.eventId);
            expect(reconstructedEvent.eventName).toBe(originalEvent.eventName);
            expect(reconstructedEvent.aggregateId).toBe(originalEvent.aggregateId);
            expect(reconstructedEvent.occurredOn).toBe(originalEvent.occurredOn);
            expect(reconstructedEvent.payload).toEqual(originalEvent.payload);
            expect(reconstructedEvent.metadata.tenant_id).toBe(originalEvent.metadata.tenant_id);
        });

        it('should throw error for invalid JSON input', () => {
            // Arrange & Act & Assert
            expect(() => DomainEvent.fromJson(null)).toThrow('DomainEvent.fromJson: invalid JSON input');
            expect(() => DomainEvent.fromJson('string')).toThrow('DomainEvent.fromJson: invalid JSON input');
            expect(() => DomainEvent.fromJson(123)).toThrow('DomainEvent.fromJson: invalid JSON input');
        });

        it('should handle missing optional fields in JSON', () => {
            // Arrange
            const json = {
                eventId: ValueObjectUuid.random(),
                eventName,
                aggregateId: validAggregateId,
                occurredOn: new Date().toISOString(),
            };

            // Act
            const event = DomainEvent.fromJson(json);

            // Assert
            expect(event.payload).toEqual({});
            expect(event.metadata.tenant_id).toBeNull();
        });
    });
});
