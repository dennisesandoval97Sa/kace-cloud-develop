import { handler } from '../../src/action-jobs/handler.mjs';

describe('action-jobs-events handler wiring', () => {
    it('exports a function (Lambda handler)', () => {
        expect(typeof handler).toBe('function');
    });
});
