import { jest } from '@jest/globals';
import { CanUpdateCase } from '../../src/shared/domain/rules/CanUpdateCase.js';
import { CustomError } from '../../src/shared/errors/CustomError.js';
import { guardCaseWrite } from '../../src/cases/application/guardCaseWrite.js';

describe('guardCaseWrite', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('throws 404 when the case is missing', () => {
        expect(() => guardCaseWrite(null, {})).toThrow(
            new CustomError('The Case you are trying update does not exist', 404)
        );
    });

    it('throws 403 when CanUpdateCase denies the user', () => {
        jest.spyOn(CanUpdateCase, 'check').mockReturnValue(false);
        expect(() => guardCaseWrite({ fecha_resolucion: {} }, { id: { value: 'u' } })).toThrow(
            new CustomError('You do not have permission to update this case', 403)
        );
    });

    it('throws 403 when the case is resolved and closed updates are off', () => {
        jest.spyOn(CanUpdateCase, 'check').mockReturnValue(true);
        expect(() => guardCaseWrite({ fecha_resolucion: { value: '2020-01-01' } }, { id: { value: 'u' } })).toThrow(
            new CustomError('The case is already resolved; updates are not allowed.', 403)
        );
    });

    it('allows a resolved case when allowUpdateClosedCase is true', () => {
        jest.spyOn(CanUpdateCase, 'check').mockReturnValue(true);
        expect(() =>
            guardCaseWrite(
                { fecha_resolucion: { value: '2020-01-01' } },
                { id: { value: 'u' } },
                { allowUpdateClosedCase: true }
            )
        ).not.toThrow();
    });
});
