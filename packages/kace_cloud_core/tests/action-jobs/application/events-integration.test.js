import { jest } from '@jest/globals';
import { InMemoryEventBus } from '../../../src/shared/infrastructure/events/InMemoryEventBus.js';
import { EventPublisher } from '../../../src/shared/application/events/EventPublisher.js';
import { ActionJobCreated } from '../../../src/action-jobs/domain/events/ActionJobCreated.js';
import { ValueObjectUuid } from '../../../src/shared/domain/value-object/ValueObjectUuid.js';

describe('ActionJob Domain Events - Integration with InMemoryEventBus', () => {
    let eventBus;
    let eventPublisher;
    let receivedEvents;

    beforeEach(() => {
        eventBus = new InMemoryEventBus();
        eventPublisher = new EventPublisher(eventBus);
        receivedEvents = [];
    });

    describe('ActionJobCreated event flow', () => {
        it('should publish and receive ActionJobCreated event', async () => {
            // Arrange
            const actionJobId = ValueObjectUuid.random();
            const handler = async (event) => {
                receivedEvents.push(event);
            };
            eventBus.subscribe('kace.core.action_job.created', handler);

            const event = new ActionJobCreated({
                actionJobId,
                type: 'filter',
                actionId: ValueObjectUuid.random(),
                restflowId: null,
                totalRecords: 200,
                metadata: { user_id: 'creator-001', tenant_id: 'tenant-acme' },
            });

            // Act
            await eventPublisher.publish(event);

            // Assert
            expect(receivedEvents).toHaveLength(1);
            expect(receivedEvents[0]).toBeInstanceOf(ActionJobCreated);
            expect(receivedEvents[0].eventName).toBe('kace.core.action_job.created');
            expect(receivedEvents[0].aggregateId).toBe(actionJobId);
            expect(receivedEvents[0].metadata.user_id).toBe('creator-001');
        });
    });

    describe('event serialization', () => {
        it('should serialize and preserve all action job event data', () => {
            // Arrange
            const actionJobId = ValueObjectUuid.random();
            const actionId = ValueObjectUuid.random();

            const event = new ActionJobCreated({
                actionJobId,
                type: 'filter_clients',
                actionId,
                restflowId: null,
                totalRecords: 75,
                metadata: { user_id: 'user-001', tenant_id: 'tenant-acme' },
            });

            // Act
            const json = event.toJson();

            // Assert
            expect(json.eventName).toBe('kace.core.action_job.created');
            expect(json.aggregateId).toBe(actionJobId);
            expect(json.payload.type).toBe('filter_clients');
            expect(json.payload.actionId).toBe(actionId);
            expect(json.payload.restflowId).toBeNull();
            expect(json.payload.totalRecords).toBe(75);
            expect(json.metadata.user_id).toBe('user-001');
            expect(json.metadata.tenant_id).toBe('tenant-acme');
            expect(json.eventId).toBeDefined();
            expect(json.occurredOn).toBeDefined();
        });
    });
});
