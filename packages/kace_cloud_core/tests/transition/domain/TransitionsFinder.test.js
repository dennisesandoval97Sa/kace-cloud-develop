import { TransitionsFinder } from '../../../src/transition/domain/TransitionsFinder.js';

describe('TransitionsFinder — options forwarding', () => {
    it('forwards options unchanged to repository.find', async () => {
        const calls = [];
        const repository = {
            find: async (id, options) => {
                calls.push(options);
                return null;
            },
        };
        const finder = new TransitionsFinder(repository);

        await finder.execute('11111111-1111-4111-8111-111111111111', { skipCache: true });

        expect(calls[0]).toEqual({ skipCache: true });
    });

    it('defaults to an empty options object when none is given', async () => {
        const calls = [];
        const repository = {
            find: async (id, options) => {
                calls.push(options);
                return null;
            },
        };
        const finder = new TransitionsFinder(repository);

        await finder.execute('11111111-1111-4111-8111-111111111111');

        expect(calls[0]).toEqual({});
    });
});
