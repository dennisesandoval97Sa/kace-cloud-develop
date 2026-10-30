import { describe, expect, it } from '@jest/globals';
import { CustomError } from '@kace/core/src/shared/index.js';
import { CONFLICT_ERROR, NOT_FOUND_ERROR, SHIFT_MANAGEMENT_IN_USE_BY_GROUPS } from '@kace/error-codes';
import { ScheduleLockConflict } from '@kace/core/src/shift-management';
import { shiftManagementDeleteErrorResponse } from '../src/controller.mjs';

describe('shiftManagementDeleteErrorResponse', () => {
    it('maps a schedule still used by groups to its public 400 response', () => {
        const error = new CustomError(
            'Cannot delete: 2 group(s) still use this schedule',
            400,
            { count: 2 },
            SHIFT_MANAGEMENT_IN_USE_BY_GROUPS
        );

        const response = shiftManagementDeleteErrorResponse(error, {});
        const body = JSON.parse(response.toJson().body);

        expect(response.statusCode).toBe(400);
        expect(body.data.code).toBe(SHIFT_MANAGEMENT_IN_USE_BY_GROUPS);
    });

    it('maps a schedule that does not exist to a 404', () => {
        const error = new CustomError('ShiftManagement with ID x does not exist.', 404, [], NOT_FOUND_ERROR);

        const response = shiftManagementDeleteErrorResponse(error, {});
        const body = JSON.parse(response.toJson().body);

        expect(response.statusCode).toBe(404);
        expect(body.data.code).toBe(NOT_FOUND_ERROR);
    });

    it('maps a schedule kept locked by a concurrent group save to a retryable 409', () => {
        const response = shiftManagementDeleteErrorResponse(new ScheduleLockConflict(), {});
        const body = JSON.parse(response.toJson().body);

        expect(response.statusCode).toBe(409);
        expect(body.data.code).toBe(CONFLICT_ERROR);
    });

    it('leaves unexpected errors for the internal-server-error path', () => {
        expect(shiftManagementDeleteErrorResponse(new Error('unexpected'), {})).toBeNull();
        expect(shiftManagementDeleteErrorResponse(new CustomError('unexpected', 400), {})).toBeNull();
    });
});
