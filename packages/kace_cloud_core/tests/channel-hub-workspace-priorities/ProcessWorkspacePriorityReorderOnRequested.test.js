import { jest } from '@jest/globals';
import { ProcessWorkspacePriorityReorderOnRequested } from '../../src/channel-hub-workspace-priorities/application/event-handlers/ProcessWorkspacePriorityReorderOnRequested.js';

describe('ProcessWorkspacePriorityReorderOnRequested', () => {
    it('processes the operation identified by the domain event', async () => {
        const processor = { execute: jest.fn().mockResolvedValue({ status: 'completed' }) };
        const handler = new ProcessWorkspacePriorityReorderOnRequested(processor);

        await handler.handle({ payload: { operationId: '11111111-1111-4111-8111-111111111111' } });

        expect(processor.execute).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111');
    });
});
