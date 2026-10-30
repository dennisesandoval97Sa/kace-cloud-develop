import { resolveActiveSchedulers } from '../src/resolveActiveSchedulers.mjs';

describe('resolveActiveSchedulers', () => {
    const fast = { name: 'fast' };
    const ans = { name: 'ans' };
    const backlog = { name: 'backlog' };

    it('fast mode runs only the fast scheduler (never ANS nor backlog)', () => {
        expect(resolveActiveSchedulers('fast', { fast, ans, backlog })).toEqual([fast]);
    });

    it('ans mode runs the ANS and backlog schedulers', () => {
        expect(resolveActiveSchedulers('ans', { fast, ans, backlog })).toEqual([ans, backlog]);
    });

    it('all mode runs every scheduler', () => {
        expect(resolveActiveSchedulers('all', { fast, ans, backlog })).toEqual([fast, ans, backlog]);
    });

    it('throws on an unknown mode', () => {
        expect(() => resolveActiveSchedulers('turbo', { fast, ans, backlog })).toThrow(/turbo/);
    });
});
