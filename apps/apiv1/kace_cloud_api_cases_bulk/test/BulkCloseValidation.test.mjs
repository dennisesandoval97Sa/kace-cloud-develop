import { jest } from '@jest/globals';
import { HttpResponse, Response } from '@kace/api-common';
import { AUTHORIZATION_ERROR, CASE_BULK_CASES_ALREADY_CLOSED } from '@kace/error-codes';
import { CustomError } from '@kace/core/src/shared/index.js';

const execute = jest.fn();
const CaseBulkCloser = jest.fn(() => ({ execute }));

class MockBaseController {
    constructor(event, knexConfig) {
        this.event = event;
        this.knexConfig = knexConfig;
        this.user = { hasPermission: jest.fn().mockReturnValue(true) };
    }

    payload() {
        return typeof this.event.body === 'string' ? JSON.parse(this.event.body || '{}') : this.event.body;
    }
}

jest.unstable_mockModule('@kace/api-common', () => ({ HttpResponse, Response, BaseController: MockBaseController }));
jest.unstable_mockModule('@kace/core/src/cases/index.js', () => ({
    CaseBulkCloser,
    KnexCaseRepository: jest.fn(),
}));
jest.unstable_mockModule('@kace/core/src/comments/index.js', () => ({ KnexCommentsRepository: jest.fn() }));

const { BulkCloseController } = await import('../src/BulkCloseController.mjs');
const { schemaBulkClose } = await import('../src/schemas.mjs');

const CASE_ID = '6f1c2d4e-0b7a-4c1e-9a55-1d2b3c4d5e61';

describe('bulk close reason validation', () => {
    beforeEach(() => {
        execute.mockReset();
        CaseBulkCloser.mockClear();
    });

    it('schemaBulkClose rejects a close_reason shorter than a valid comment (3 chars)', () => {
        const { error } = schemaBulkClose.validate({ case_ids: [CASE_ID], close_reason: 'ab' });

        expect(error).toBeDefined();
    });

    it('schemaBulkClose rejects a close_reason longer than a comment (5000 chars)', () => {
        const { error } = schemaBulkClose.validate({ case_ids: [CASE_ID], close_reason: 'a'.repeat(5001) });

        expect(error).toBeDefined();
    });

    it('schemaBulkClose accepts a 5000 char close_reason', () => {
        const { error } = schemaBulkClose.validate({ case_ids: [CASE_ID], close_reason: 'a'.repeat(5000) });

        expect(error).toBeUndefined();
    });

    it('schemaBulkClose accepts a 3 char close_reason', () => {
        const { error } = schemaBulkClose.validate({ case_ids: [CASE_ID], close_reason: 'abc' });

        expect(error).toBeUndefined();
    });

    it('schemaBulkClose rejects a close_reason with characters outside the allowed set', () => {
        const { error } = schemaBulkClose.validate({ case_ids: [CASE_ID], close_reason: 'rstars<' });

        expect(error).toBeDefined();
    });

    it.each([
        ['rstars<', false],
        ['motivo {con llaves}', true],
        ['motivo: con dos puntos', true],
    ])('schemaBulkClose %s -> válido=%s', (value, expectedValid) => {
        const { error } = schemaBulkClose.validate({ case_ids: [CASE_ID], close_reason: value });

        expect(error === undefined).toBe(expectedValid);
    });

    it('the controller returns a validation failure and never calls the closer for close_reason "ab"', async () => {
        const body = JSON.stringify({ case_ids: [CASE_ID], close_reason: 'ab' });
        const controller = new BulkCloseController({ body }, { client: 'sqlite3' });

        const json = (await controller.actionCreate()).toJson();

        expect(json.statusCode).toBe(400);
        expect(CaseBulkCloser).not.toHaveBeenCalled();
        expect(execute).not.toHaveBeenCalled();
    });

    it('the controller returns a validation failure and never calls the closer for a 5001 char close_reason', async () => {
        const body = JSON.stringify({ case_ids: [CASE_ID], close_reason: 'a'.repeat(5001) });
        const controller = new BulkCloseController({ body }, { client: 'sqlite3' });

        const json = (await controller.actionCreate()).toJson();

        expect(json.statusCode).toBe(400);
        expect(CaseBulkCloser).not.toHaveBeenCalled();
        expect(execute).not.toHaveBeenCalled();
    });

    it('incluye AUTHORIZATION_ERROR en el cuerpo del 403', async () => {
        const controller = new BulkCloseController({ body: '{}' }, { client: 'sqlite3' });
        controller.user.hasPermission.mockReturnValue(false);
        const json = (await controller.actionCreate()).toJson();
        expect(json.statusCode).toBe(403);
        expect(JSON.parse(json.body).data?.code).toBe(AUTHORIZATION_ERROR);
    });

    it('propaga el publicErrorCode del CustomError lanzado por el closer', async () => {
        execute.mockRejectedValue(
            new CustomError('Some cases are already closed', 400, [], CASE_BULK_CASES_ALREADY_CLOSED)
        );
        const body = JSON.stringify({ case_ids: [CASE_ID], close_reason: 'abc' });
        const json = (await new BulkCloseController({ body }, { client: 'sqlite3' }).actionCreate()).toJson();
        expect(json.statusCode).toBe(400);
        expect(JSON.parse(json.body).data?.code).toBe(CASE_BULK_CASES_ALREADY_CLOSED);
    });
});
