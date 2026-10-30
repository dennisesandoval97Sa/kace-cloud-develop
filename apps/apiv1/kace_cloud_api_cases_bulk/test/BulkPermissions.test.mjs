import { jest } from '@jest/globals';
import { HttpResponse, Response } from '@kace/api-common';
import { AUTHORIZATION_ERROR, CASE_BULK_TRANSITION_NOT_FOUND } from '@kace/error-codes';
import { CustomError } from '@kace/core/src/shared/index.js';

const executeTransition = jest.fn();

class MockBaseController {
    constructor(event, knexConfig) {
        this.event = event;
        this.knexConfig = knexConfig;
        this.user = { hasPermission: jest.fn().mockReturnValue(false) };
    }

    payload() {
        return typeof this.event.body === 'string' ? JSON.parse(this.event.body || '{}') : this.event.body;
    }
}

jest.unstable_mockModule('@kace/api-common', () => ({ HttpResponse, Response, BaseController: MockBaseController }));

jest.unstable_mockModule('@kace/core/src/cases/index.js', () => ({
    CaseBulkCloser: jest.fn(),
    CaseBulkTransitionsUpdater: jest.fn(() => ({ execute: executeTransition })),
    CaseBulkAssigner: jest.fn(),
    KnexCaseRepository: jest.fn(),
    KnexTransitionsCaseRepository: jest.fn(),
}));
jest.unstable_mockModule('@kace/core/src/transition-rules/infrastructure/KnexTransitionRuleRepository.js', () => ({
    KnexTransitionRuleRepository: jest.fn(),
}));
jest.unstable_mockModule('@kace/core/src/users/index.js', () => ({ KnexUsersRepository: jest.fn() }));
jest.unstable_mockModule('@kace/core/src/grupos/index.js', () => ({ KnexGroupsRepository: jest.fn() }));
jest.unstable_mockModule('@kace/core/src/user-group-relationships/index.js', () => ({
    KnexUserGroupRelationshipRepository: jest.fn(),
}));
jest.unstable_mockModule('@kace/core/src/global-config/index.js', () => ({
    KnexGlobalConfigurationRepository: jest.fn(),
}));
jest.unstable_mockModule('@kace/core/src/shared/assignation/AssignationService.js', () => ({
    AssignationService: jest.fn(),
}));

const { BulkCloseController } = await import('../src/BulkCloseController.mjs');
const { BulkTransitionController } = await import('../src/BulkTransitionController.mjs');
const { BulkAssignController } = await import('../src/BulkAssignController.mjs');

describe('cases bulk controllers require dedicated bulk permissions', () => {
    it.each([
        ['BulkCloseController', BulkCloseController, 'CasesBulkClose'],
        ['BulkTransitionController', BulkTransitionController, 'CasesBulkTransition'],
        ['BulkAssignController', BulkAssignController, 'CasesBulkAssign'],
    ])('%s returns 403 and checks administrador/cases/%s', async (_label, Controller, permissionName) => {
        const controller = new Controller({ body: '{}' }, { client: 'sqlite3' });

        const json = (await controller.actionCreate()).toJson();

        expect(json.statusCode).toBe(403);
        expect(JSON.parse(json.body).data?.code).toBe(AUTHORIZATION_ERROR);
        expect(controller.user.hasPermission).toHaveBeenCalledTimes(1);
        expect(controller.user.hasPermission).toHaveBeenCalledWith('administrador', 'cases', permissionName);
    });

    it('propaga el publicErrorCode del CustomError lanzado por el transition updater', async () => {
        executeTransition.mockRejectedValue(
            new CustomError('Transition with id missing', 404, [], CASE_BULK_TRANSITION_NOT_FOUND)
        );
        const body = JSON.stringify({
            case_ids: ['6f1c2d4e-0b7a-4c1e-9a55-1d2b3c4d5e61'],
            transition_id: '7f1c2d4e-0b7a-4c1e-9a55-1d2b3c4d5e62',
        });
        const controller = new BulkTransitionController({ body }, { client: 'sqlite3' });
        controller.user.hasPermission.mockReturnValue(true);
        const json = (await controller.actionCreate()).toJson();
        expect(json.statusCode).toBe(404);
        expect(JSON.parse(json.body).data?.code).toBe(CASE_BULK_TRANSITION_NOT_FOUND);
    });
});
