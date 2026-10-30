import { CaseCreated } from '../../../../src/cases/domain/events/CaseCreated.js';
import { DomainEvent } from '../../../../src/shared/domain/events/DomainEvent.js';
import { ValueObjectUuid } from '../../../../src/shared/domain/value-object/ValueObjectUuid.js';

describe('CaseCreated', () => {
    const caseId = ValueObjectUuid.random();
    const clientId = ValueObjectUuid.random();
    const responsibleId = ValueObjectUuid.random();
    const classificationId = ValueObjectUuid.random();
    const groupId = ValueObjectUuid.random();
    const transitionId = ValueObjectUuid.random();

    const createEvent = (overrides = {}) => {
        return new CaseCreated({
            caseId,
            clientId,
            responsibleId,
            classificationId,
            groupId,
            transitionId,
            metadata: { user_id: 'creator-123' },
            ...overrides,
        });
    };

    describe('constructor', () => {
        it('should create a CaseCreated event with valid params', () => {
            // Arrange & Act
            const event = createEvent();

            // Assert
            expect(event).toBeInstanceOf(CaseCreated);
            expect(event).toBeInstanceOf(DomainEvent);
        });

        it('should set the correct event name', () => {
            // Arrange & Act
            const event = createEvent();

            // Assert
            expect(event.eventName).toBe('kace.core.case.created');
            expect(CaseCreated.EVENT_NAME).toBe('kace.core.case.created');
        });

        it('should set the aggregateId to caseId', () => {
            // Arrange & Act
            const event = createEvent();

            // Assert
            expect(event.aggregateId).toBe(caseId);
        });

        it('should include all case data in the payload', () => {
            // Arrange & Act
            const event = createEvent();

            // Assert
            expect(event.payload.clientId).toBe(clientId);
            expect(event.payload.responsibleId).toBe(responsibleId);
            expect(event.payload.classificationId).toBe(classificationId);
            expect(event.payload.groupId).toBe(groupId);
            expect(event.payload.transitionId).toBe(transitionId);
        });

        it('should include metadata', () => {
            // Arrange & Act
            const event = createEvent();

            // Assert
            expect(event.metadata.user_id).toBe('creator-123');
        });

        it('should default metadata to empty object', () => {
            // Arrange & Act
            const event = new CaseCreated({
                caseId,
                clientId,
                responsibleId,
                classificationId,
                groupId,
                transitionId,
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
            expect(json.eventName).toBe('kace.core.case.created');
            expect(json.aggregateId).toBe(caseId);
            expect(json.payload.clientId).toBe(clientId);
            expect(json.payload.responsibleId).toBe(responsibleId);
            expect(json.payload.classificationId).toBe(classificationId);
            expect(json.payload.groupId).toBe(groupId);
            expect(json.payload.transitionId).toBe(transitionId);
            expect(json.eventId).toBeDefined();
            expect(json.occurredOn).toBeDefined();
        });
    });
});
