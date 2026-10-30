import { handler } from '../../src/cases/handler.mjs';

describe('cases-events handler wiring', () => {
    it('exports a function (Lambda handler)', () => {
        expect(typeof handler).toBe('function');
    });
});
