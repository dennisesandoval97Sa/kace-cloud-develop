import { jest } from '@jest/globals';
import { HttpResponse, Response } from '@kace/api-common';

const CASE_ID = '6f1c2d4e-0b7a-4c1e-9a55-1d2b3c4d5e61';
const USER_ID = '7a2d3e5f-1c8b-4d2f-8b66-2e3c4d5e6f72';

const closerExecute = jest.fn();
const CaseCloser = jest.fn(() => ({ execute: closerExecute }));
const commentExecute = jest.fn();
const CommentCreator = jest.fn(() => ({ execute: commentExecute }));

class MockBaseController {
    constructor(event, knexConfig) {
        this.event = event;
        this.knexConfig = knexConfig;
        this.database_connection = {};
        this.user = { id: { value: USER_ID }, hasPermission: jest.fn().mockReturnValue(true) };
    }

    payload() {
        return typeof this.event.body === 'string' ? JSON.parse(this.event.body || '{}') : this.event.body;
    }

    pathParameters() {
        return this.event.pathParameters;
    }

    validateId(id) {
        return typeof id === 'string' && id.length > 0;
    }
}

jest.unstable_mockModule('@kace/api-common', () => ({ HttpResponse, Response, BaseController: MockBaseController }));
jest.unstable_mockModule('@kace/core/src/cases', () => ({
    CaseCloser,
    KnexCaseRepository: jest.fn(),
    KnexSubcaseRelationshipRepository: jest.fn(),
}));
jest.unstable_mockModule('@kace/core/src/comments', () => ({ CommentCreator, KnexCommentsRepository: jest.fn() }));
jest.unstable_mockModule('@kace/core/src/grupos', () => ({ KnexGroupsRepository: jest.fn() }));
jest.unstable_mockModule('@kace/core/src/global-config', () => ({ KnexGlobalConfigurationRepository: jest.fn() }));

const { Controller } = await import('../src/controller.mjs');

const buildController = (body) =>
    new Controller({ pathParameters: { id: CASE_ID }, body: JSON.stringify(body) }, { client: 'sqlite3' });

describe('case-close controller', () => {
    beforeEach(() => {
        closerExecute.mockReset();
        commentExecute.mockReset();
        CaseCloser.mockClear();
        CommentCreator.mockClear();
    });

    it('returns 403 and checks administrador/cases/CaseClose when the user lacks the permission', async () => {
        const controller = buildController({ motivo_baja: 'Resolved by phone' });
        controller.user.hasPermission.mockReturnValue(false);

        const json = (await controller.actionUpdate()).toJson();

        expect(json.statusCode).toBe(403);
        expect(controller.user.hasPermission).toHaveBeenCalledWith('administrador', 'cases', 'CaseClose');
        expect(CaseCloser).not.toHaveBeenCalled();
        expect(CommentCreator).not.toHaveBeenCalled();
    });

    it('closes the case and creates the automatic comment from motivo_baja', async () => {
        const controller = buildController({ motivo_baja: 'Resolved by phone' });

        const json = (await controller.actionUpdate()).toJson();

        expect(json.statusCode).toBe(200);
        expect(closerExecute).toHaveBeenCalledTimes(1);
        expect(closerExecute.mock.calls[0][0]).toBe(CASE_ID);
        expect(closerExecute.mock.calls[0][1]).toMatchObject({ motivo_baja: 'Resolved by phone' });
        expect(commentExecute).toHaveBeenCalledTimes(1);
        expect(commentExecute.mock.calls[0][0]).toMatchObject({
            descripcion: 'Resolved by phone',
            caso_id: CASE_ID,
            created_by: USER_ID,
        });
    });

    it('rejects a motivo_baja shorter than 3 chars without closing or commenting', async () => {
        const controller = buildController({ motivo_baja: 'ab' });

        const json = (await controller.actionUpdate()).toJson();

        expect(json.statusCode).toBe(400);
        expect(CaseCloser).not.toHaveBeenCalled();
        expect(closerExecute).not.toHaveBeenCalled();
        expect(CommentCreator).not.toHaveBeenCalled();
        expect(commentExecute).not.toHaveBeenCalled();
    });

    it('rejects a motivo_baja longer than a comment (5000 chars) with 400', async () => {
        const controller = buildController({ motivo_baja: 'a'.repeat(5001) });

        const json = (await controller.actionUpdate()).toJson();

        expect(json.statusCode).toBe(400);
        expect(CaseCloser).not.toHaveBeenCalled();
        expect(CommentCreator).not.toHaveBeenCalled();
    });

    it('closes the case when motivo_baja is 5000 characters', async () => {
        const controller = buildController({ motivo_baja: 'a'.repeat(5000) });

        const json = (await controller.actionUpdate()).toJson();

        expect(json.statusCode).toBe(200);
        expect(closerExecute).toHaveBeenCalledTimes(1);
        expect(commentExecute).toHaveBeenCalledTimes(1);
    });
});
