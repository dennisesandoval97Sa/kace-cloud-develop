import { describe, it, expect, jest } from '@jest/globals';
import { CasePostProcessingRequested } from '@kace/core/src/cases';
import {
    buildCasePostProcessingRequestedEvent,
    publishCasePostProcessingRequested,
} from '../src/casePostProcessingPublisher.mjs';

/**
 * Unit tests for the async-publish seam used by actionCreateWithAux when the
 * async_case_post_processing flag is ON. These exercise the pure event builder
 * and the best-effort publish wrapper in isolation (no DB, no @kace/core wiring),
 * mirroring the CaseCreated publish contract: publishAll([event]) where the event
 * carries the case id as aggregateId and tenant/user in metadata.
 */
const CASE_ID = '11111111-1111-4111-8111-111111111111';
const PARENT_ID = '22222222-2222-4222-8222-222222222222';

describe('buildCasePostProcessingRequestedEvent', () => {
    it('builds a CasePostProcessingRequested with the case id as aggregateId', () => {
        // Arrange
        const caseValue = { id: CASE_ID, parent_id: PARENT_ID };

        // Act
        const event = buildCasePostProcessingRequestedEvent(caseValue, 'acme', 'user-1');

        // Assert
        expect(event).toBeInstanceOf(CasePostProcessingRequested);
        expect(event.eventName).toBe('kace.core.case.post_processing.requested');
        expect(event.aggregateId).toBe(CASE_ID);
        expect(event.payload).toEqual({ parentId: PARENT_ID });
        expect(event.metadata).toMatchObject({ tenant_id: 'acme', user_id: 'user-1' });
    });

    it('defaults parentId to null when the case has no parent', () => {
        // Arrange
        const caseValue = { id: CASE_ID };

        // Act
        const event = buildCasePostProcessingRequestedEvent(caseValue, 'acme', 'user-1');

        // Assert
        expect(event.payload).toEqual({ parentId: null });
    });
});

describe('publishCasePostProcessingRequested', () => {
    it('publishes exactly one event via publishAll when the flag is ON', async () => {
        // Arrange
        const publishAll = jest.fn().mockResolvedValue(undefined);
        const publisher = { publishAll };
        const caseValue = { id: CASE_ID, parent_id: PARENT_ID };

        // Act
        await publishCasePostProcessingRequested(publisher, caseValue, 'acme', 'user-1');

        // Assert
        expect(publishAll).toHaveBeenCalledTimes(1);
        const [events] = publishAll.mock.calls[0];
        expect(events).toHaveLength(1);
        expect(events[0].eventName).toBe('kace.core.case.post_processing.requested');
        expect(events[0].aggregateId).toBe(CASE_ID);
    });

    it('is best-effort: a publisher failure does not throw (case already created)', async () => {
        // Arrange
        const publisher = {
            publishAll: jest.fn().mockRejectedValue(new Error('SQS unavailable')),
        };
        const caseValue = { id: CASE_ID, parent_id: null };

        // Act + Assert: must resolve, never reject, so the 201 stands
        await expect(
            publishCasePostProcessingRequested(publisher, caseValue, 'acme', 'user-1')
        ).resolves.toBeUndefined();
    });

    it('does nothing when no publisher is available', async () => {
        // Arrange
        const caseValue = { id: CASE_ID, parent_id: null };

        // Act + Assert
        await expect(publishCasePostProcessingRequested(null, caseValue, 'acme', 'user-1')).resolves.toBeUndefined();
    });
});
