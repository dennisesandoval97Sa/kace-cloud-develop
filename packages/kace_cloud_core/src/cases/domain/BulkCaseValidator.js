import { CASE_BULK_CASES_ALREADY_CLOSED, CASE_BULK_CASES_NOT_FOUND } from '@kace/error-codes';
import { CustomError } from '../../shared/errors/CustomError';

export async function findAndValidateCases(repository, caseIds, { trx, forUpdate } = {}) {
    const uniqueCaseIds = [...new Set(caseIds)];
    const cases = await repository.findByIds(uniqueCaseIds, { trx, forUpdate });

    if (cases.length !== uniqueCaseIds.length) {
        const foundIds = new Set(cases.map((caseRow) => caseRow.id));
        const missingIds = uniqueCaseIds.filter((id) => !foundIds.has(id));
        throw new CustomError(`Cases not found: ${missingIds.join(', ')}`, 404, [], CASE_BULK_CASES_NOT_FOUND);
    }

    const closedCases = cases.filter((caseRow) => caseRow.fecha_resolucion !== null);
    if (closedCases.length > 0) {
        throw new CustomError('Some cases are already closed', 400, [], CASE_BULK_CASES_ALREADY_CLOSED);
    }

    return { uniqueCaseIds, cases };
}
