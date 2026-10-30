import { describe, expect, it } from '@jest/globals';
import { CustomError } from '@kace/core/src/shared/index.js';
import { ScheduleLockConflict } from '@kace/core/src/shift-management';
import { CONFLICT_ERROR } from '@kace/error-codes';
import { scheduleLockConflictResponse } from '../src/Controller.mjs';

describe('scheduleLockConflictResponse', () => {
    it('maps a schedule kept locked by a concurrent delete to a retryable 409', () => {
        const response = scheduleLockConflictResponse(new ScheduleLockConflict(), {});
        const body = JSON.parse(response.toJson().body);

        expect(response.statusCode).toBe(409);
        expect(body.data.code).toBe(CONFLICT_ERROR);
    });

    it('leaves any other error to the remaining handlers', () => {
        expect(scheduleLockConflictResponse(new CustomError('other', 409), {})).toBeNull();
        expect(scheduleLockConflictResponse(new Error('unexpected'), {})).toBeNull();
    });
});
