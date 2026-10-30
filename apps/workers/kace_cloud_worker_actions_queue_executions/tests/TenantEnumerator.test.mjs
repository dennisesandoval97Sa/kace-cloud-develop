import { jest } from '@jest/globals';
import { TenantEnumerator } from '../src/TenantEnumerator.mjs';

describe('TenantEnumerator', () => {
    it("returns the array from the repository's findAll()", async () => {
        const tenant1 = { id: { value: 't-1' } };
        const tenant2 = { id: { value: 't-2' } };
        const repository = { findAll: jest.fn().mockResolvedValue([tenant1, tenant2]) };
        const sut = new TenantEnumerator(repository);

        const tenants = await sut.list();

        expect(tenants).toEqual([tenant1, tenant2]);
        expect(repository.findAll).toHaveBeenCalledTimes(1);
    });

    it('propagates errors from the repository', async () => {
        const repository = { findAll: jest.fn().mockRejectedValue(new Error('dynamo down')) };
        const sut = new TenantEnumerator(repository);

        await expect(sut.list()).rejects.toThrow('dynamo down');
    });

    it('returns an empty list when the repository returns nothing', async () => {
        const repository = { findAll: jest.fn().mockResolvedValue([]) };
        const sut = new TenantEnumerator(repository);

        const tenants = await sut.list();

        expect(tenants).toEqual([]);
    });
});
