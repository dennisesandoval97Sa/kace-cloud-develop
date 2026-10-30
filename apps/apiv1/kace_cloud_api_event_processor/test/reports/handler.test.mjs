import { handler } from '../../src/reports/handler.mjs';

describe('reports-events handler wiring', () => {
    it('exports a function (Lambda handler)', () => {
        expect(typeof handler).toBe('function');
    });
});
