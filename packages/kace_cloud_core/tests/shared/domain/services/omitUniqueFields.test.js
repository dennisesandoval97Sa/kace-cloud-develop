import { omitUniqueFields } from '../../../../src/shared/domain/services/omitUniqueFields.js';

describe('omitUniqueFields', () => {
    it('drops top-level unique fields and keeps the rest', () => {
        const dataStructure = { document: { type: 'string', unique: true }, note: { type: 'string' } };

        expect(omitUniqueFields(dataStructure, { document: 'A-1', note: 'keep' })).toEqual({ note: 'keep' });
    });

    it('drops unique fields nested in object fields', () => {
        const dataStructure = {
            form: {
                type: 'object',
                data_structure: { document: { type: 'string', unique: true }, note: { type: 'string' } },
            },
        };

        expect(omitUniqueFields(dataStructure, { form: { document: 'A-1', note: 'keep' } })).toEqual({
            form: { note: 'keep' },
        });
    });

    it('keeps fields not described by the structure', () => {
        const dataStructure = { document: { type: 'string', unique: true } };

        expect(omitUniqueFields(dataStructure, { document: 'A-1', extra: 1 })).toEqual({ extra: 1 });
    });

    it('returns the data unchanged when there is no structure', () => {
        expect(omitUniqueFields({}, { document: 'A-1' })).toEqual({ document: 'A-1' });
    });

    it.each([
        ['an array', ['a', 'b']],
        ['a string', 'legacy'],
        ['null', null],
    ])('keeps %s stored under an object field unchanged', (_, value) => {
        const dataStructure = {
            form: {
                type: 'object',
                data_structure: { document: { type: 'string', unique: true } },
            },
        };

        expect(omitUniqueFields(dataStructure, { form: value, note: 'keep' })).toEqual({ form: value, note: 'keep' });
    });

    it('returns data that is not a plain object unchanged', () => {
        const dataStructure = { document: { type: 'string', unique: true } };

        expect(omitUniqueFields(dataStructure, null)).toBeNull();
        expect(omitUniqueFields(dataStructure, ['a'])).toEqual(['a']);
    });

    it('does not mutate the input data', () => {
        const dataStructure = { document: { type: 'string', unique: true } };
        const data = { document: 'A-1' };

        omitUniqueFields(dataStructure, data);

        expect(data).toEqual({ document: 'A-1' });
    });

    it('does not mutate nested objects in the input data', () => {
        const dataStructure = {
            form: {
                type: 'object',
                data_structure: { document: { type: 'string', unique: true } },
            },
        };
        const data = { form: { document: 'A-1', note: 'keep' } };
        const originalNested = data.form;

        omitUniqueFields(dataStructure, data);

        expect(data.form).toBe(originalNested);
        expect(data.form).toEqual({ document: 'A-1', note: 'keep' });
    });
});
