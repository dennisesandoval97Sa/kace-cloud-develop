import { jest } from '@jest/globals';
import { SecretsFinderByReferences } from '../../src/secrets-vault/domain/SecretsFinderByReferences';
import { ValueObjectReference } from '../../src/secrets-vault/domain/ValueObjectReference';

describe('SecretsFinderByReferences', () => {
    it('returns empty array when references is empty', async () => {
        const repo = { findByReferences: jest.fn() };
        const finder = new SecretsFinderByReferences(repo);

        const result = await finder.execute([]);

        expect(result).toEqual([]);
        expect(repo.findByReferences).not.toHaveBeenCalled();
    });

    it('returns empty array when references is not an array', async () => {
        const repo = { findByReferences: jest.fn() };
        const finder = new SecretsFinderByReferences(repo);

        expect(await finder.execute(null)).toEqual([]);
        expect(await finder.execute(undefined)).toEqual([]);
        expect(repo.findByReferences).not.toHaveBeenCalled();
    });

    it('wraps each string reference in a ValueObjectReference and returns repo result', async () => {
        const fake = [{ referencia: { value: 'REF_A' } }];
        const repo = { findByReferences: jest.fn().mockResolvedValue(fake) };
        const finder = new SecretsFinderByReferences(repo);

        const result = await finder.execute(['REF_A', 'REF_B']);

        expect(result).toBe(fake);
        const arg = repo.findByReferences.mock.calls[0][0];
        expect(arg).toHaveLength(2);
        expect(arg[0]).toBeInstanceOf(ValueObjectReference);
        expect(arg[0].value).toBe('REF_A');
        expect(arg[1].value).toBe('REF_B');
    });

    it('propagates repository errors', async () => {
        const boom = new Error('db down');
        const repo = { findByReferences: jest.fn().mockRejectedValue(boom) };
        const finder = new SecretsFinderByReferences(repo);
        await expect(finder.execute(['REF_A'])).rejects.toBe(boom);
    });
});
