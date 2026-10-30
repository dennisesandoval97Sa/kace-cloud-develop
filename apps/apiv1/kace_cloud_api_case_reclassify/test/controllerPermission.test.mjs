import { jest } from '@jest/globals';
import Joi from 'joi';
import { hasCaseReclassifyPermission } from '@kace/api-common/src/security/CaseReclassifyPermission.js';
import { applyServerManagedFields } from '@kace/api-common/src/security/ObjectIdentityAuthorization.js';

class BaseControllerStub {
    constructor(event, knexConfig) {
        this.event = event;
        this.database_connection = knexConfig;
        this.user = event.user;
    }

    payload() {
        return JSON.parse(this.event.body || '{}');
    }

    pathParameters() {
        return this.event.pathParameters || {};
    }

    validateId() {
        return false;
    }

    getActionExecutionService() {
        return {};
    }
}

const response = (type, statusCode, payload = {}) => ({ type, statusCode, ...payload });

const HttpResponse = {
    ok: (payload) => response('ok', 200, payload),
    forbidden: (payload) => response('forbidden', 403, payload),
    badRequest: (payload) => response('badRequest', 400, payload),
    validationsFail: (payload) => response('validationsFail', 400, payload),
    internalServerError: (payload) => response('internalServerError', 500, payload),
};

jest.unstable_mockModule('@kace/api-common', () => ({
    BaseController: BaseControllerStub,
    HttpResponse,
    hasCaseReclassifyPermission,
    applyServerManagedFields,
    caseStaleSnapshotFields: { current_clasificacion_id: Joi.string().uuid().allow(null).optional() },
}));

jest.unstable_mockModule('@kace/core/src/cases', () => ({
    CaseReclassifier: jest.fn(),
    CaseUpdater: jest.fn(),
    KnexCaseRepository: jest.fn().mockImplementation(() => ({})),
    KnexSubcaseRelationshipRepository: jest.fn().mockImplementation(() => ({})),
}));

jest.unstable_mockModule('@kace/core/src/classifications', () => ({
    KnexClassificationRepository: jest.fn().mockImplementation(() => ({})),
}));

jest.unstable_mockModule('@kace/core/src/classification-group-relationships', () => ({
    KnexClassificationGroupRelationshipRepository: jest.fn().mockImplementation(() => ({})),
}));

jest.unstable_mockModule('@kace/core/src/cases/infrastructure/persistence/KnexTransitionsCaseRepository.js', () => ({
    KnexTransitionsCaseRepository: jest.fn().mockImplementation(() => ({})),
}));

jest.unstable_mockModule('@kace/core/src/transition-rules/infrastructure/KnexTransitionRuleRepository.js', () => ({
    KnexTransitionRuleRepository: jest.fn().mockImplementation(() => ({})),
}));

jest.unstable_mockModule('@kace/core/src/comments', () => ({
    CommentCreator: jest.fn(),
    KnexCommentsRepository: jest.fn().mockImplementation(() => ({})),
}));

jest.unstable_mockModule('@kace/core/src/shared/errors/CustomError', () => ({
    CustomError: class CustomError extends Error {},
}));

jest.unstable_mockModule(
    '@kace/core/src/folio-configurations/infrastructure/KnexFolioConfigurationRepository.js',
    () => ({ KnexFolioConfigurationRepository: jest.fn(() => ({})) })
);

jest.unstable_mockModule('@kace/core/src/folio-configurations/infrastructure/KnexFolioSequenceRepository.js', () => ({
    KnexFolioSequenceRepository: jest.fn(() => ({})),
}));

jest.unstable_mockModule('@kace/core/src/cases/application/folio/CaseFolioResolver.js', () => ({
    CaseFolioResolver: jest.fn(() => ({})),
}));

jest.unstable_mockModule('@kace/core/src/aux_casos/infrastructure/persitance/KnexAuxCasesRepository.js', () => ({
    KnexAuxCasesRepository: jest.fn(() => ({})),
}));

jest.unstable_mockModule('@kace/core/src/aux_casos/domain/AuxCasesFinderByCase.js', () => ({
    AuxCasesFinderByCase: jest.fn(() => ({})),
}));

jest.unstable_mockModule('@kace/core/src/shared/index.js', () => ({
    Helper: { logInfo: jest.fn(), logDebug: jest.fn(), logError: jest.fn() },
}));

const { Controller } = await import('../src/controller.mjs');

const buildController = (grantedNamespaces) =>
    new Controller(
        {
            body: JSON.stringify({}),
            pathParameters: { id: 'not-a-valid-id' },
            user: {
                id: { value: '11111111-1111-4111-8111-111111111111' },
                hasPermission: (namespace, moduleId, name) =>
                    grantedNamespaces.includes(namespace) && moduleId === 'cases' && name === 'CaseReclassify',
            },
        },
        {}
    );

describe('case_reclassify permission gate', () => {
    it('rejects a user without the permission in either namespace', async () => {
        const result = await buildController([]).actionUpdate();

        expect(result.statusCode).toBe(403);
    });

    it.each([['administrador'], ['agente']])(
        'lets a user with the permission as %s through the gate',
        async (namespace) => {
            const result = await buildController([namespace]).actionUpdate();

            expect(result.statusCode).not.toBe(403);
            expect(result.type).toBe('badRequest');
        }
    );
});
