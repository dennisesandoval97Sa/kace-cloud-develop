import { handler } from '../../src/automated-actions/handler.mjs';

describe('automated-actions-events handler wiring', () => {
    it('exports a function (Lambda handler)', () => {
        expect(typeof handler).toBe('function');
    });
});
