import { jest } from '@jest/globals';
import { AutomationSettingsFinder } from '../../src/automation-settings/domain/AutomationSettingsFinder.js';
import { TenantContext } from '../../src/shared/infrastructure/context/TenantContext.js';

// The cache is module-scoped (like Helper.tenantDebugCache), so each test uses
// a distinct id to avoid cross-test cache collisions.
const ID_CACHE_MISS = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000001';
const ID_CACHE_HIT = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000002';
const ID_TTL_RELOAD = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000003';
const ID_TENANT_ISOLATION = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000004';
const ID_INITIAL_MISS = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000005';

describe('AutomationSettingsFinder TTL cache', () => {
    let repository;
    let finder;
    const fakeRow = { id: ID_CACHE_MISS, start_date: null, end_date: null, frequency: '* * * * *' };

    beforeEach(() => {
        repository = { find: jest.fn().mockResolvedValue(fakeRow) };
        finder = new AutomationSettingsFinder(repository);
    });

    it('returns the row from repository on cache miss', async () => {
        const result = await finder.execute(ID_CACHE_MISS);
        expect(result).toBe(fakeRow);
        expect(repository.find).toHaveBeenCalledTimes(1);
    });

    it('serves subsequent calls from cache within TTL window', async () => {
        await finder.execute(ID_CACHE_HIT);
        await finder.execute(ID_CACHE_HIT);
        await finder.execute(ID_CACHE_HIT);
        expect(repository.find).toHaveBeenCalledTimes(1);
    });

    it('reloads after TTL expires (Date.now mocked)', async () => {
        const nowSpy = jest.spyOn(Date, 'now');
        nowSpy.mockReturnValue(1_000);
        await finder.execute(ID_TTL_RELOAD);
        nowSpy.mockReturnValue(1_000 + 300_001); // 5min + 1ms after first call
        await finder.execute(ID_TTL_RELOAD);
        expect(repository.find).toHaveBeenCalledTimes(2);
        nowSpy.mockRestore();
    });

    it('does not cache a missing row that may be created immediately afterward', async () => {
        const createdRow = { ...fakeRow, id: ID_INITIAL_MISS };
        repository.find.mockResolvedValueOnce(null).mockResolvedValueOnce(createdRow);

        expect(await finder.execute(ID_INITIAL_MISS)).toBeNull();
        expect(await finder.execute(ID_INITIAL_MISS)).toBe(createdRow);
        expect(repository.find).toHaveBeenCalledTimes(2);
    });

    it('keys cache by tenantId+id to avoid cross-tenant collision', async () => {
        const fakeTenant = (id) => ({ id: { value: id } });
        // Run within TenantContext for tenant A: two calls, only one DB hit
        await TenantContext.run(fakeTenant('tenantA'), async () => {
            await finder.execute(ID_TENANT_ISOLATION);
            await finder.execute(ID_TENANT_ISOLATION);
        });
        // Run within TenantContext for tenant B with same automation_settings id:
        // different cache key → must query the repository again
        await TenantContext.run(fakeTenant('tenantB'), async () => {
            await finder.execute(ID_TENANT_ISOLATION);
        });
        // tenantA hit cache once, tenantB had to query → 2 total queries
        expect(repository.find).toHaveBeenCalledTimes(2);
    });
});
