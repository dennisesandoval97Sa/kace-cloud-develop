import { describe, expect, it } from '@jest/globals';
import { createWsRestHandlerFactories } from '../../src/ws-rest/createWsRestHandlerFactories.mjs';

describe('createWsRestHandlerFactories', () => {
    it('routes each event name to its application handler', async () => {
        const calls = [];
        const restFlowHandler = async (context, event) => calls.push({ route: 'rest-flow', context, event });
        const workspacePriorityReorderHandler = async (context, event) =>
            calls.push({ route: 'workspace-priority-reorder', context, event });
        const factories = createWsRestHandlerFactories({
            restFlowEventName: 'rest-flow-requested',
            restFlowHandler,
            workspacePriorityReorderEventName: 'workspace-priority-reorder-requested',
            workspacePriorityReorderHandler,
        });
        const context = { tenantId: 'tenant-id' };

        await factories.get('rest-flow-requested')(context, { eventId: 'event-1' });
        await factories.get('workspace-priority-reorder-requested')(context, { eventId: 'event-2' });

        expect(calls).toEqual([
            { route: 'rest-flow', context, event: { eventId: 'event-1' } },
            { route: 'workspace-priority-reorder', context, event: { eventId: 'event-2' } },
        ]);
    });
});
