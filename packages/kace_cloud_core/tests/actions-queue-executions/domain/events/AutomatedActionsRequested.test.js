import { AutomatedActionsRequested } from '../../../../src/actions-queue-executions/domain/events/AutomatedActionsRequested.js';
import { DomainEvent } from '../../../../src/shared/domain/events/DomainEvent.js';
import { ValueObjectUuid } from '../../../../src/shared/domain/value-object/ValueObjectUuid.js';

describe('AutomatedActionsRequested', () => {
    const executionId = ValueObjectUuid.random();
    const actionId = ValueObjectUuid.random();
    const caseId = ValueObjectUuid.random();
    const clientId = ValueObjectUuid.random();
    const createdBy = ValueObjectUuid.random();

    const createEvent = (overrides = {}) => {
        return new AutomatedActionsRequested({
            executionId,
            actionId,
            caseId,
            clientId,
            triggerType: 'cron_job',
            metadata: {
                tenant_id: 'tenant-acme',
                user_id: createdBy,
                correlation_id: 'corr-123',
            },
            ...overrides,
        });
    };

    it('should create the event as a DomainEvent', () => {
        const event = createEvent();

        expect(event).toBeInstanceOf(AutomatedActionsRequested);
        expect(event).toBeInstanceOf(DomainEvent);
    });

    it('should use the expected event name and aggregate id', () => {
        const event = createEvent();

        expect(AutomatedActionsRequested.EVENT_NAME).toBe('kace.core.automated_actions.requested');
        expect(event.eventName).toBe('kace.core.automated_actions.requested');
        expect(event.aggregateId).toBe(executionId);
    });

    it('should include execution payload and metadata', () => {
        const event = createEvent();

        expect(event.payload.actionId).toBe(actionId);
        expect(event.payload.caseId).toBe(caseId);
        expect(event.payload.clientId).toBe(clientId);
        expect(event.payload.triggerType).toBe('cron_job');

        expect(event.metadata.tenant_id).toBe('tenant-acme');
        expect(event.metadata.user_id).toBe(createdBy);
        expect(event.metadata.correlation_id).toBe('corr-123');
    });

    it('should be immutable and serializable', () => {
        const event = createEvent();
        const json = event.toJson();

        expect(Object.isFrozen(event)).toBe(true);
        expect(json.eventName).toBe('kace.core.automated_actions.requested');
        expect(json.aggregateId).toBe(executionId);
        expect(json.payload.actionId).toBe(actionId);
    });
});
