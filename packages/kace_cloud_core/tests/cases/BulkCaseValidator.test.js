import { describe, expect, it, jest } from '@jest/globals';
import { CASE_BULK_CASES_ALREADY_CLOSED, CASE_BULK_CASES_NOT_FOUND } from '@kace/error-codes';
import { findAndValidateCases } from '../../src/cases/domain/BulkCaseValidator.js';
import { CustomError } from '../../src/shared/index.js';

describe('findAndValidateCases', () => {
    it('throws CASE_BULK_CASES_NOT_FOUND when a case id is missing', async () => {
        const repository = {
            findByIds: jest.fn().mockResolvedValue([{ id: 'case-1', fecha_resolucion: null }]),
        };

        const error = await findAndValidateCases(repository, ['case-1', 'case-2']).catch((caught) => caught);

        expect(error).toBeInstanceOf(CustomError);
        expect(error.message).toBe('Cases not found: case-2');
        expect(error.statusCode).toBe(404);
        expect(error.publicErrorCode).toBe(CASE_BULK_CASES_NOT_FOUND);
    });

    it('throws CASE_BULK_CASES_ALREADY_CLOSED when any case is already closed', async () => {
        const repository = {
            findByIds: jest.fn().mockResolvedValue([
                { id: 'case-1', fecha_resolucion: null },
                { id: 'case-2', fecha_resolucion: '2026-10-14T00:00:00.000Z' },
            ]),
        };

        const error = await findAndValidateCases(repository, ['case-1', 'case-2']).catch((caught) => caught);

        expect(error).toBeInstanceOf(CustomError);
        expect(error.message).toBe('Some cases are already closed');
        expect(error.statusCode).toBe(400);
        expect(error.publicErrorCode).toBe(CASE_BULK_CASES_ALREADY_CLOSED);
    });
});
