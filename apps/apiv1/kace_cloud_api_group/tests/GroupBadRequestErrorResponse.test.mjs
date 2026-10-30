import { groupBadRequestErrorResponse } from '../src/Controller.mjs';
import { describe, expect, it } from '@jest/globals';
import { CustomError, ValidationFailError } from '@kace/core/src/shared/index.js';
import { GROUP_CREATE_USERS_NOT_FOUND, GROUP_SCHEDULE_UNAVAILABLE, RESOURCE_ALREADY_EXISTS } from '@kace/error-codes';

describe('groupBadRequestErrorResponse', () => {
    it('maps group membership validation errors to their public 400 response', () => {
        const error = new ValidationFailError(
            'One or more user_ids do not exist',
            'user_ids',
            [],
            GROUP_CREATE_USERS_NOT_FOUND
        );

        const response = groupBadRequestErrorResponse(error, {});
        const body = JSON.parse(response.toJson().body);

        expect(response.statusCode).toBe(400);
        expect(body.data.code).toBe(GROUP_CREATE_USERS_NOT_FOUND);
    });

    it('maps expected uniqueness failures to their public 400 response', () => {
        const error = new ValidationFailError(
            'The following value already exists',
            'uniqueness',
            [{ field: 'nombre', value: 'Support' }],
            RESOURCE_ALREADY_EXISTS
        );

        const response = groupBadRequestErrorResponse(error, {});
        const body = JSON.parse(response.toJson().body);

        expect(response.statusCode).toBe(400);
        expect(body.data.code).toBe(RESOURCE_ALREADY_EXISTS);
    });

    it('maps an unavailable schedule to its public 400 response', () => {
        const error = new ValidationFailError(
            'The selected schedule does not exist or was deleted',
            'horario_id',
            [],
            GROUP_SCHEDULE_UNAVAILABLE
        );

        const response = groupBadRequestErrorResponse(error, {});
        const body = JSON.parse(response.toJson().body);

        expect(response.statusCode).toBe(400);
        expect(body.data.code).toBe(GROUP_SCHEDULE_UNAVAILABLE);
    });

    it('leaves unexpected errors for the internal-server-error path', () => {
        expect(groupBadRequestErrorResponse(new Error('unexpected'), {})).toBeNull();
        expect(groupBadRequestErrorResponse(new ValidationFailError('unexpected', 'field'), {})).toBeNull();
        expect(groupBadRequestErrorResponse(new CustomError('unexpected', 400), {})).toBeNull();
    });
});
