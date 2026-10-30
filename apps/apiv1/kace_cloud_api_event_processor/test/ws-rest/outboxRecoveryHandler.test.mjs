import { describe, expect, it, jest } from '@jest/globals';
import { createWorkspacePriorityOutboxRecoveryHandler } from '../../src/ws-rest/outboxRecoveryHandler.mjs';

describe('workspace priority outbox recovery handler', () => {
    it('scans and publishes due staged events for the orchestrated tenant', async () => {
        const repository = { destroyConnection: jest.fn().mockResolvedValue(undefined) };
        const Repository = jest.fn().mockReturnValue(repository);
        const publisher = {
            publishDue: jest.fn().mockResolvedValue({ claimed: 2, published: 2, failed: 0 }),
        };
        const Publisher = jest.fn().mockReturnValue(publisher);
        const eventBus = { publish: jest.fn() };
        const buildEventBus = jest.fn().mockReturnValue(eventBus);
        const baseHandler = createWorkspacePriorityOutboxRecoveryHandler({
            Repository,
            Publisher,
            buildEventBus,
        });
        const tenant = { id: { value: 'tenant-a' } };
        const writerConfig = { client: 'pg', connection: { host: 'writer' }, schema: 'tenant-a' };

        const result = await baseHandler({ tenantContext: { tenant, knexConfig: writerConfig } });

        expect(Repository).toHaveBeenCalledWith(writerConfig);
        expect(buildEventBus).toHaveBeenCalledWith(tenant);
        expect(Publisher).toHaveBeenCalledWith({ operationRepository: repository, eventBus });
        expect(publisher.publishDue).toHaveBeenCalledWith({ limit: 25 });
        expect(repository.destroyConnection).toHaveBeenCalled();
        expect(result).toEqual({ claimed: 2, published: 2, failed: 0 });
    });

    it('destroys the tenant pool when publishing fails unexpectedly', async () => {
        const repository = { destroyConnection: jest.fn().mockResolvedValue(undefined) };
        const Publisher = jest.fn().mockReturnValue({
            publishDue: jest.fn().mockRejectedValue(new Error('database unavailable')),
        });
        const baseHandler = createWorkspacePriorityOutboxRecoveryHandler({
            Repository: jest.fn().mockReturnValue(repository),
            Publisher,
            buildEventBus: jest.fn().mockReturnValue({}),
        });

        await expect(
            baseHandler({
                tenantContext: {
                    tenant: { id: { value: 'tenant-a' } },
                    knexConfig: { client: 'pg' },
                },
            })
        ).rejects.toThrow('database unavailable');
        expect(repository.destroyConnection).toHaveBeenCalled();
    });
});
