import { ActionJobCreated } from '../../../../src/action-jobs/domain/events/ActionJobCreated.js';
import { DomainEvent } from '../../../../src/shared/domain/events/DomainEvent.js';
import { ValueObjectUuid } from '../../../../src/shared/domain/value-object/ValueObjectUuid.js';

describe('ActionJobCreated', () => {
    const actionJobId = ValueObjectUuid.random();
    const actionId = ValueObjectUuid.random();

    const createEvent = (overrides = {}) => {
        return new ActionJobCreated({
            actionJobId,
            type: 'filter',
            actionId,
            restflowId: null,
            totalRecords: 150,
            metadata: { user_id: 'creator-123', tenant_id: 'tenant-acme' },
            ...overrides,
        });
    };

    describe('constructor', () => {
        it('should create an ActionJobCreated event with valid params', () => {
            // Arrange & Act
            const event = createEvent();

            // Assert
            expect(event).toBeInstanceOf(ActionJobCreated);
            expect(event).toBeInstanceOf(DomainEvent);
        });

        it('should set the correct event name', () => {
            // Arrange & Act
            const event = createEvent();

            // Assert
            expect(event.eventName).toBe('kace.core.action_job.created');
            expect(ActionJobCreated.EVENT_NAME).toBe('kace.core.action_job.created');
        });

        it('should set the aggregateId to actionJobId', () => {
            // Arrange & Act
            const event = createEvent();

            // Assert
            expect(event.aggregateId).toBe(actionJobId);
        });

        it('should include all action job data in the payload', () => {
            // Arrange & Act
            const event = createEvent();

            // Assert
            expect(event.payload.type).toBe('filter');
            expect(event.payload.actionId).toBe(actionId);
            expect(event.payload.restflowId).toBeNull();
            expect(event.payload.totalRecords).toBe(150);
        });

        it('should include metadata', () => {
            // Arrange & Act
            const event = createEvent();

            // Assert
            expect(event.metadata.user_id).toBe('creator-123');
            expect(event.metadata.tenant_id).toBe('tenant-acme');
        });

        it('should default metadata to empty object', () => {
            // Arrange & Act
            const event = new ActionJobCreated({
                actionJobId,
                type: 'filter',
                actionId,
                restflowId: null,
                totalRecords: 150,
            });

            // Assert
            expect(event.metadata).toBeDefined();
            expect(event.metadata.user_id).toBeNull();
        });

        it('should generate a unique eventId', () => {
            // Arrange & Act
            const event1 = createEvent();
            const event2 = createEvent();

            // Assert
            expect(event1.eventId).toBeDefined();
            expect(event2.eventId).toBeDefined();
            expect(event1.eventId).not.toBe(event2.eventId);
        });

        it('should be immutable', () => {
            // Arrange & Act
            const event = createEvent();

            // Assert
            expect(Object.isFrozen(event)).toBe(true);
        });
    });

    describe('toJson', () => {
        it('should return a JSON representation with all fields', () => {
            // Arrange
            const event = createEvent();

            // Act
            const json = event.toJson();

            // Assert
            expect(json.eventName).toBe('kace.core.action_job.created');
            expect(json.aggregateId).toBe(actionJobId);
            expect(json.payload.type).toBe('filter');
            expect(json.payload.actionId).toBe(actionId);
            expect(json.payload.restflowId).toBeNull();
            expect(json.payload.totalRecords).toBe(150);
            expect(json.eventId).toBeDefined();
            expect(json.occurredOn).toBeDefined();
        });
    });
});
