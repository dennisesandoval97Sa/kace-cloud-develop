import { jest } from '@jest/globals';
import { EntityCache } from '../../../../src/shared/infrastructure/cache/EntityCache.js';

describe('EntityCache', () => {
    beforeEach(() => {
        EntityCache.clear();
    });

    describe('get', () => {
        it('calls fetcher on miss and caches result for the TTL', async () => {
            const fetcher = jest.fn().mockResolvedValue({ id: '1', name: 'x' });

            const first = await EntityCache.get('schemas', 'k1', fetcher, 60_000);
            const second = await EntityCache.get('schemas', 'k1', fetcher, 60_000);

            expect(first).toEqual({ id: '1', name: 'x' });
            expect(second).toBe(first);
            expect(fetcher).toHaveBeenCalledTimes(1);
        });
    });

    describe('TTL', () => {
        it('refetches after TTL expires', async () => {
            const fetcher = jest.fn().mockResolvedValueOnce('v1').mockResolvedValueOnce('v2');

            await EntityCache.get('ns', 'k', fetcher, 50);
            await new Promise((resolve) => setTimeout(resolve, 70));
            const second = await EntityCache.get('ns', 'k', fetcher, 50);

            expect(second).toBe('v2');
            expect(fetcher).toHaveBeenCalledTimes(2);
        });
    });

    describe('concurrent dedupe', () => {
        it('deduplicates parallel requests for the same key', async () => {
            let resolveFetcher;
            const fetcher = jest.fn().mockImplementation(
                () =>
                    new Promise((resolve) => {
                        resolveFetcher = resolve;
                    })
            );

            const p1 = EntityCache.get('ns', 'k', fetcher, 60_000);
            const p2 = EntityCache.get('ns', 'k', fetcher, 60_000);

            resolveFetcher('shared');
            const [r1, r2] = await Promise.all([p1, p2]);

            expect(r1).toBe('shared');
            expect(r2).toBe('shared');
            expect(fetcher).toHaveBeenCalledTimes(1);
        });

        it('removes pending entry when fetcher rejects', async () => {
            const fetcher = jest.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce('ok');

            await expect(EntityCache.get('ns', 'k', fetcher, 60_000)).rejects.toThrow('boom');
            const second = await EntityCache.get('ns', 'k', fetcher, 60_000);

            expect(second).toBe('ok');
            expect(fetcher).toHaveBeenCalledTimes(2);
        });
    });

    describe('invalidate', () => {
        it('invalidate(ns, key) drops only that entry', async () => {
            const fetcher = jest.fn().mockResolvedValueOnce('v1').mockResolvedValueOnce('v2');

            await EntityCache.get('ns', 'k', fetcher, 60_000);
            EntityCache.invalidate('ns', 'k');
            const second = await EntityCache.get('ns', 'k', fetcher, 60_000);

            expect(second).toBe('v2');
            expect(fetcher).toHaveBeenCalledTimes(2);
        });

        it('invalidateNamespace drops every entry of the namespace', async () => {
            const fA = jest.fn().mockResolvedValueOnce('A1').mockResolvedValueOnce('A2');
            const fB = jest.fn().mockResolvedValueOnce('B1').mockResolvedValueOnce('B2');
            const fOther = jest.fn().mockResolvedValueOnce('O1');

            await EntityCache.get('schemas', 'a', fA, 60_000);
            await EntityCache.get('schemas', 'b', fB, 60_000);
            await EntityCache.get('users', 'o', fOther, 60_000);

            EntityCache.invalidateNamespace('schemas');

            await EntityCache.get('schemas', 'a', fA, 60_000);
            await EntityCache.get('schemas', 'b', fB, 60_000);
            await EntityCache.get('users', 'o', fOther, 60_000);

            expect(fA).toHaveBeenCalledTimes(2);
            expect(fB).toHaveBeenCalledTimes(2);
            expect(fOther).toHaveBeenCalledTimes(1);
        });
    });

    describe('multi-tenant', () => {
        it('separates entries between tenants via TenantContext', async () => {
            const { TenantContext } = await import('../../../../src/shared/infrastructure/context/TenantContext.js');
            const fetcher = jest.fn().mockResolvedValueOnce('tenant-A').mockResolvedValueOnce('tenant-B');

            const tenantA = { id: { value: 'A' } };
            const tenantB = { id: { value: 'B' } };

            const valueA = await TenantContext.run(tenantA, () =>
                EntityCache.get('schemas', 'shared-key', fetcher, 60_000)
            );
            const valueB = await TenantContext.run(tenantB, () =>
                EntityCache.get('schemas', 'shared-key', fetcher, 60_000)
            );

            expect(valueA).toBe('tenant-A');
            expect(valueB).toBe('tenant-B');
            expect(fetcher).toHaveBeenCalledTimes(2);
        });

        it('uses "default" key segment when no tenant in context', async () => {
            const fetcher = jest.fn().mockResolvedValue('value');

            const first = await EntityCache.get('schemas', 'k', fetcher, 60_000);
            const second = await EntityCache.get('schemas', 'k', fetcher, 60_000);

            expect(first).toBe('value');
            expect(second).toBe('value');
            expect(fetcher).toHaveBeenCalledTimes(1);
        });
    });
});
