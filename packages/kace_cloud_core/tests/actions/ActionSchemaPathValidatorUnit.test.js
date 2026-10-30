import { ActionSchemaPathValidator } from '../../src/actions/domain/validators/ActionSchemaPathValidator.js';

describe('ActionSchemaPathValidator', () => {
    const dataStructure = {
        data_structure: {
            campo1: { data_structure: { subcampo1: 'string' } },
            campo2: 'string',
        },
    };

    it('returns false when dataStructure is falsy', () => {
        expect(ActionSchemaPathValidator.validate(null, 'campo1')).toBe(false);
        expect(ActionSchemaPathValidator.validate(undefined, 'campo1')).toBe(false);
    });

    it('returns false when path is falsy', () => {
        expect(ActionSchemaPathValidator.validate(dataStructure, '')).toBe(false);
        expect(ActionSchemaPathValidator.validate(dataStructure, null)).toBe(false);
    });

    it('returns false when dataStructure is not an object', () => {
        expect(ActionSchemaPathValidator.validate('not-an-object', 'campo1')).toBe(false);
    });

    it('returns false when path is not a string', () => {
        expect(ActionSchemaPathValidator.validate(dataStructure, 42)).toBe(false);
    });

    it('returns true for a top-level field that exists', () => {
        expect(ActionSchemaPathValidator.validate(dataStructure, 'campo2')).toBe(true);
    });

    it('returns true for a nested field that exists', () => {
        expect(ActionSchemaPathValidator.validate(dataStructure, 'campo1.subcampo1')).toBe(true);
    });

    it('returns false for a field that does not exist', () => {
        expect(ActionSchemaPathValidator.validate(dataStructure, 'campo_inexistente')).toBe(false);
    });

    it('documents a bug: traversing past a leaf (non-object) field throws instead of returning false', () => {
        // BUG: once traversal reaches a leaf value (here `campo2`, a string), the loop's
        // `key in currentDataStructure` check assumes `currentDataStructure` is still an
        // object. For a string primitive, the `in` operator throws
        // `TypeError: Cannot use 'in' operator to search for 'subcampo' in string`
        // instead of the (presumably intended) `false`. Documented, not fixed: production
        // code changes are out of scope for this test task.
        expect(() => ActionSchemaPathValidator.validate(dataStructure, 'campo2.subcampo')).toThrow(
            "Cannot use 'in' operator"
        );
    });
});
