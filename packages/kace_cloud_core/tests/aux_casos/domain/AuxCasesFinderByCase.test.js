import { AuxCasesFinderByCase } from '../../../src/aux_casos/domain/AuxCasesFinderByCase.js';

describe('AuxCasesFinderByCase — options forwarding', () => {
    it('forwards options unchanged to repository.findByCaseId', async () => {
        const calls = [];
        const repository = {
            findByCaseId: async (caseId, options) => {
                calls.push({ caseId, options });
                return null;
            },
        };
        const finder = new AuxCasesFinderByCase(repository);

        await finder.execute('11111111-1111-4111-8111-111111111111', { skipCache: true });

        expect(calls[0].options).toEqual({ skipCache: true });
    });

    it('defaults to an empty options object when none is given', async () => {
        const calls = [];
        const repository = {
            findByCaseId: async (caseId, options) => {
                calls.push(options);
                return null;
            },
        };
        const finder = new AuxCasesFinderByCase(repository);

        await finder.execute('11111111-1111-4111-8111-111111111111');

        expect(calls[0]).toEqual({});
    });
});
