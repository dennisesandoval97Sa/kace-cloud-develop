import { handler } from '../../src/case-post-processing/handler.mjs';

describe('case-post-processing handler wiring', () => {
    it('exports a function (Lambda handler)', () => {
        expect(typeof handler).toBe('function');
    });
});
