import { describe, it, expect } from '@jest/globals';
import { caseWithAuxSchema } from '../src/schemas.mjs';
import { caseWithAuxSchema as caseWithAuxSchema2 } from '../../kace_cloud_api_cases_2/src/schemas.mjs';

describe('caseWithAuxSchema comment', () => {
    it.each([
        ['cases', caseWithAuxSchema],
        ['cases_2', caseWithAuxSchema2],
    ])('%s rejects a comment shorter than 3', (_label, schema) => {
        const { error } = schema.validate(
            { case: {}, aux_cases: {}, comment: { descripcion: 'ab' } },
            { abortEarly: false }
        );
        expect(error).toBeTruthy();
    });

    it.each([
        ['cases', caseWithAuxSchema],
        ['cases_2', caseWithAuxSchema2],
    ])('%s allows a missing comment', (_label, schema) => {
        const { error } = schema.validate({ case: {}, aux_cases: {} }, { abortEarly: false });
        expect(error).toBeUndefined();
    });
});
