import { ValueObjectAssignmentChangeType } from '../../src/cases/domain/ValueObjectAssignmentChangeType.js';

describe('ValueObjectAssignmentChangeType', () => {
    it('accepts the five valid codes', () => {
        const codes = ['manual', 'action', 'automatic', 'creation', 'bulk'];
        codes.forEach((code) => {
            const vo = new ValueObjectAssignmentChangeType('assignment_change_type', code, false);
            expect(vo.value).toBe(code);
        });
    });

    it('exposes the codes as static constants', () => {
        expect(ValueObjectAssignmentChangeType.MANUAL).toBe('manual');
        expect(ValueObjectAssignmentChangeType.ACTION).toBe('action');
        expect(ValueObjectAssignmentChangeType.AUTOMATIC).toBe('automatic');
        expect(ValueObjectAssignmentChangeType.CREATION).toBe('creation');
        expect(ValueObjectAssignmentChangeType.BULK).toBe('bulk');
    });

    it('allows null when nullable', () => {
        const vo = new ValueObjectAssignmentChangeType('assignment_change_type', null, true);
        expect(vo.value).toBeNull();
    });

    it('throws on an invalid code', () => {
        expect(() => new ValueObjectAssignmentChangeType('assignment_change_type', 'other', false)).toThrow();
    });
});
