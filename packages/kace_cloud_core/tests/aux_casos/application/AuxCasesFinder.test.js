import { AuxCasesFinder } from '../../../src/aux_casos/application/find/AuxCasesFinder.js';

describe('AuxCasesFinder — options forwarding', () => {
    it('forwards options unchanged to DomainAuxCasesFinderByCase.execute', async () => {
        const calls = [];
        // Constructor takes a repository; stub only the method AuxCasesFinderByCase calls on it.
        const repository = {
            findByCaseId: async (caseId, options) => {
                calls.push(options);
                return null;
            },
        };
        const finder = new AuxCasesFinder(repository);

        await finder.execute('11111111-1111-4111-8111-111111111111', { skipCache: true });

        expect(calls[0]).toEqual({ skipCache: true });
    });
});
