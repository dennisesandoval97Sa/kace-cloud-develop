import { CasePostProcessingRequested } from '../../../../src/cases/domain/events/CasePostProcessingRequested.js';
import { DomainEvent } from '../../../../src/shared/domain/events/DomainEvent.js';
import { ValueObjectUuid } from '../../../../src/shared/domain/value-object/ValueObjectUuid.js';

describe('CasePostProcessingRequested', () => {
    const caseId = ValueObjectUuid.random();
    const parentId = ValueObjectUuid.random();

    const createEvent = (overrides = {}) => {
        return new CasePostProcessingRequested({
            caseId,
            parentId,
            metadata: { user_id: 'creator-123' },
            ...overrides,
        });
    };

    describe('constructor', () => {
        it('should create a CasePostProcessingRequested event with valid params', () => {
            // Arrange & Act
            const event = createEvent();

            // Assert
            expect(event).toBeInstanceOf(CasePostProcessingRequested);
            expect(event).toBeInstanceOf(DomainEvent);
        });

        it('should set the correct event name', () => {
            // Arrange & Act
            const event = createEvent();

            // Assert
            expect(event.eventName).toBe('kace.core.case.post_processing.requested');
            expect(CasePostProcessingRequested.EVENT_NAME).toBe('kace.core.case.post_processing.requested');
        });

        it('should set the aggregateId to caseId', () => {
            // Arrange & Act
            const event = createEvent();

            // Assert
            expect(event.aggregateId).toBe(caseId);
        });

        it('should include parentId in the payload', () => {
            // Arrange & Act
            const event = createEvent();

            // Assert
            expect(event.payload.parentId).toBe(parentId);
        });

        it('should include metadata', () => {
            // Arrange & Act
            const event = createEvent();

            // Assert
            expect(event.metadata.user_id).toBe('creator-123');
        });

        it('should default parentId to null when not provided', () => {
            // Arrange & Act
            const event = new CasePostProcessingRequested({ caseId });

            // Assert
            expect(event.payload.parentId).toBeNull();
        });

        it('should default metadata to empty object', () => {
            // Arrange & Act
            const event = new CasePostProcessingRequested({ caseId });

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
            expect(json.eventName).toBe('kace.core.case.post_processing.requested');
            expect(json.aggregateId).toBe(caseId);
            expect(json.payload.parentId).toBe(parentId);
            expect(json.eventId).toBeDefined();
            expect(json.occurredOn).toBeDefined();
        });
    });
});
