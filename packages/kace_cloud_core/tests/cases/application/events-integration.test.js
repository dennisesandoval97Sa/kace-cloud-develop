import { jest } from '@jest/globals';
import { InMemoryEventBus } from '../../../src/shared/infrastructure/events/InMemoryEventBus.js';
import { EventPublisher } from '../../../src/shared/application/events/EventPublisher.js';
import { CaseCreated } from '../../../src/cases/domain/events/CaseCreated.js';
import { ValueObjectUuid } from '../../../src/shared/domain/value-object/ValueObjectUuid.js';

describe('Case Domain Events - Integration with InMemoryEventBus', () => {
    let eventBus;
    let eventPublisher;
    let receivedEvents;

    beforeEach(() => {
        eventBus = new InMemoryEventBus();
        eventPublisher = new EventPublisher(eventBus);
        receivedEvents = [];
    });

    describe('CaseCreated event flow', () => {
        it('should publish and receive CaseCreated event', async () => {
            // Arrange
            const caseId = ValueObjectUuid.random();
            const handler = async (event) => {
                receivedEvents.push(event);
            };
            eventBus.subscribe('kace.core.case.created', handler);

            const event = new CaseCreated({
                caseId,
                clientId: ValueObjectUuid.random(),
                responsibleId: ValueObjectUuid.random(),
                classificationId: ValueObjectUuid.random(),
                groupId: ValueObjectUuid.random(),
                transitionId: ValueObjectUuid.random(),
                metadata: { user_id: 'creator-001' },
            });

            // Act
            await eventPublisher.publish(event);

            // Assert
            expect(receivedEvents).toHaveLength(1);
            expect(receivedEvents[0]).toBeInstanceOf(CaseCreated);
            expect(receivedEvents[0].eventName).toBe('kace.core.case.created');
            expect(receivedEvents[0].aggregateId).toBe(caseId);
            expect(receivedEvents[0].metadata.user_id).toBe('creator-001');
        });
    });

    describe('batch publishing', () => {
        it('should publish multiple CaseCreated events in batch', async () => {
            // Arrange
            const allEvents = [];
            eventBus.subscribe('kace.core.case.created', async (event) => allEvents.push(event));

            const events = [
                new CaseCreated({
                    caseId: ValueObjectUuid.random(),
                    clientId: ValueObjectUuid.random(),
                    responsibleId: ValueObjectUuid.random(),
                    classificationId: ValueObjectUuid.random(),
                    groupId: ValueObjectUuid.random(),
                    transitionId: ValueObjectUuid.random(),
                }),
                new CaseCreated({
                    caseId: ValueObjectUuid.random(),
                    clientId: ValueObjectUuid.random(),
                    responsibleId: ValueObjectUuid.random(),
                    classificationId: ValueObjectUuid.random(),
                    groupId: ValueObjectUuid.random(),
                    transitionId: ValueObjectUuid.random(),
                }),
            ];

            // Act
            await eventPublisher.publishAll(events);

            // Assert
            expect(allEvents).toHaveLength(2);
            expect(allEvents[0].eventName).toBe('kace.core.case.created');
            expect(allEvents[1].eventName).toBe('kace.core.case.created');
        });
    });

    describe('wildcard subscription', () => {
        it('should receive all case events with wildcard subscription', async () => {
            // Arrange
            const caseId = ValueObjectUuid.random();
            eventBus.subscribe('*', async (event) => receivedEvents.push(event));

            const event = new CaseCreated({
                caseId,
                clientId: ValueObjectUuid.random(),
                responsibleId: ValueObjectUuid.random(),
                classificationId: ValueObjectUuid.random(),
                groupId: ValueObjectUuid.random(),
                transitionId: ValueObjectUuid.random(),
            });

            // Act
            await eventPublisher.publish(event);

            // Assert
            expect(receivedEvents).toHaveLength(1);
            expect(receivedEvents[0].eventName).toBe('kace.core.case.created');
        });
    });

    describe('event serialization', () => {
        it('should serialize and preserve all case event data', () => {
            // Arrange
            const caseId = ValueObjectUuid.random();
            const clientId = ValueObjectUuid.random();

            const event = new CaseCreated({
                caseId,
                clientId,
                responsibleId: ValueObjectUuid.random(),
                classificationId: ValueObjectUuid.random(),
                groupId: ValueObjectUuid.random(),
                transitionId: ValueObjectUuid.random(),
                metadata: { user_id: 'user-001', tenant_id: 'tenant-acme' },
            });

            // Act
            const json = event.toJson();

            // Assert
            expect(json.eventName).toBe('kace.core.case.created');
            expect(json.aggregateId).toBe(caseId);
            expect(json.payload.clientId).toBe(clientId);
            expect(json.metadata.user_id).toBe('user-001');
            expect(json.metadata.tenant_id).toBe('tenant-acme');
            expect(json.eventId).toBeDefined();
            expect(json.occurredOn).toBeDefined();
        });
    });
});
