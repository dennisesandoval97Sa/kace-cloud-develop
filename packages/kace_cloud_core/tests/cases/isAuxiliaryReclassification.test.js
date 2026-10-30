import { isAuxiliaryReclassification } from '../../src/cases/application/reclassify/isAuxiliaryReclassification.js';

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const C = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

describe('isAuxiliaryReclassification', () => {
    it.each([
        ['missing destino', { destino: undefined, persistida: A }, false],
        ['missing persistida', { destino: C, persistida: undefined }, false],
        ['omit current_* still reclassifies when persistida differs', { destino: C, persistida: A }, true],
        ['same as persisted — no write', { destino: A, persistida: A }, false],
        ['already applied by dedicated API', { destino: C, persistida: C }, false],
        ['advisor A→C, still A in DB', { destino: C, persistida: A }, true],
        ['A/A form after concurrent move to B', { destino: A, persistida: B }, true],
        ['advisor A→C, concurrent moved to B', { destino: C, persistida: B }, true],
    ])('%s', (_label, input, expected) => {
        expect(isAuxiliaryReclassification(input)).toBe(expected);
    });
});
