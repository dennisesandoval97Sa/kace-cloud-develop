import { ValueObjectMotivoBaja } from '../../src/cases/domain/ValueObjectMotivoBaja.js';

describe('ValueObjectMotivoBaja length', () => {
    it('accepts a 5000 character value', () => {
        const vo = new ValueObjectMotivoBaja('Motivo baja', 'a'.repeat(5000), true);

        expect(vo.value).toHaveLength(5000);
    });

    it('rejects a 5001 character value', () => {
        expect(() => new ValueObjectMotivoBaja('Motivo baja', 'a'.repeat(5001), true)).toThrow(
            'Motivo baja: The value must be at most 5000 characters long'
        );
    });
});
