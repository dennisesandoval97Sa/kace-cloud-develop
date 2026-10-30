import { jest } from '@jest/globals';
import Joi from 'joi';
import { hasCaseReclassifyPermission } from '@kace/api-common/src/security/CaseReclassifyPermission.js';
import { applyServerManagedFields } from '@kace/api-common/src/security/ObjectIdentityAuthorization.js';

// Regresión de dos bugs: el dto que se construía y no se pasaba (`cambio_clasificacion` sin
// persistir, `comment` viajando al agregado) y los `null` en user, eventPublisher y tenant.

const USER_ID = '11111111-1111-4111-8111-111111111111';
const CASE_ID = '22222222-2222-4222-8222-222222222222';

const eventPublisher = { publishAll: jest.fn(async () => true) };
const tenant = { id: { value: 'tenant-1' } };

class BaseControllerStub {
    constructor(event, knexConfig) {
        this.event = event;
        this.database_connection = knexConfig;
        this.user = event.user;
        this.eventPublisher = eventPublisher;
        this.tenant = tenant;
    }

    payload() {
        return JSON.parse(this.event.body || '{}');
    }

    pathParameters() {
        return this.event.pathParameters || {};
    }

    validateId() {
        return true;
    }

    getActionExecutionService() {
        return { id: 'action-execution-service' };
    }
}

const response = (type, statusCode, payload = {}) => ({ type, statusCode, ...payload });

// El doble de `internalServerError` reproduce lo que hace la clase `Response` real cuando recibe
// un `CustomError` en `errors`: adopta su `statusCode` y publica su `publicErrorCode`. Está
// fijado en el repo por `PublicErrorResponse.test.js` ("preserves public codes carried by custom
// domain errors") y por `HttpResponse.test.js` ("CustomError returns a custom status code"). Sin
// esta fidelidad el doble devolvería 500 siempre y los tests de abajo probarían un mapeo que en
// producción no existe.
const HttpResponse = {
    ok: (payload) => response('ok', 200, payload),
    forbidden: (payload) => response('forbidden', 403, payload),
    validationsFail: (payload) => response('validationsFail', 400, payload),
    badRequest: (payload) => response('badRequest', 400, payload),
    internalServerError: ({ errors, ...payload } = {}) => {
        const statusCode = errors instanceof CustomError ? errors.statusCode : 500;

        return response('internalServerError', statusCode, { ...payload, code: errors?.publicErrorCode ?? null });
    },
};

jest.unstable_mockModule('@kace/api-common', () => ({
    BaseController: BaseControllerStub,
    HttpResponse,
    hasCaseReclassifyPermission,
    applyServerManagedFields,
    caseStaleSnapshotFields: {
        current_clasificacion_id: Joi.string().uuid().allow(null).optional(),
    },
}));

const caseRepository = { name: 'case-repository' };
const transitionsCaseRepository = { name: 'transitions-case-repository' };
const transitionRuleRepository = { name: 'transition-rule-repository' };
const classificationsRepository = { name: 'classifications-repository' };
const classificationGroupRelationshipRepository = { name: 'classification-group-relationship-repository' };
const subcaseRelationshipRepository = { name: 'subcase-relationship-repository' };

const CaseUpdater = jest.fn(function CaseUpdaterMock(...args) {
    this.args = args;
});
const reclassifierExecute = jest.fn(async () => ({}));
const CaseReclassifier = jest.fn(function CaseReclassifierMock() {
    this.execute = reclassifierExecute;
});
const commentCreatorExecute = jest.fn(async () => true);
const CommentCreator = jest.fn(function CommentCreatorMock() {
    this.execute = commentCreatorExecute;
});

jest.unstable_mockModule('@kace/core/src/cases', () => ({
    CaseReclassifier,
    CaseUpdater,
    KnexCaseRepository: jest.fn(() => caseRepository),
    KnexSubcaseRelationshipRepository: jest.fn(() => subcaseRelationshipRepository),
}));

jest.unstable_mockModule('@kace/core/src/cases/infrastructure/persistence/KnexTransitionsCaseRepository.js', () => ({
    KnexTransitionsCaseRepository: jest.fn(() => transitionsCaseRepository),
}));

jest.unstable_mockModule('@kace/core/src/transition-rules/infrastructure/KnexTransitionRuleRepository.js', () => ({
    KnexTransitionRuleRepository: jest.fn(() => transitionRuleRepository),
}));

jest.unstable_mockModule('@kace/core/src/classifications', () => ({
    KnexClassificationRepository: jest.fn(() => classificationsRepository),
}));

jest.unstable_mockModule('@kace/core/src/classification-group-relationships', () => ({
    KnexClassificationGroupRelationshipRepository: jest.fn(() => classificationGroupRelationshipRepository),
}));

jest.unstable_mockModule('@kace/core/src/comments', () => ({
    CommentCreator,
    KnexCommentsRepository: jest.fn(() => ({})),
}));

class CustomError extends Error {
    constructor(message, statusCode, fields = [], publicErrorCode = null) {
        super(message);
        this.statusCode = statusCode;
        this.fields = fields;
        this.publicErrorCode = publicErrorCode;
    }
}

jest.unstable_mockModule('@kace/core/src/shared/errors/CustomError', () => ({ CustomError }));

const caseFolioResolver = { execute: jest.fn(async () => null) };
const auxCasesFinderByCase = { execute: jest.fn(async () => null) };

jest.unstable_mockModule(
    '@kace/core/src/folio-configurations/infrastructure/KnexFolioConfigurationRepository.js',
    () => ({ KnexFolioConfigurationRepository: jest.fn(() => ({})) })
);

jest.unstable_mockModule('@kace/core/src/folio-configurations/infrastructure/KnexFolioSequenceRepository.js', () => ({
    KnexFolioSequenceRepository: jest.fn(() => ({})),
}));

jest.unstable_mockModule('@kace/core/src/cases/application/folio/CaseFolioResolver.js', () => ({
    CaseFolioResolver: jest.fn(() => caseFolioResolver),
}));

jest.unstable_mockModule('@kace/core/src/aux_casos/infrastructure/persitance/KnexAuxCasesRepository.js', () => ({
    KnexAuxCasesRepository: jest.fn(() => ({})),
}));

jest.unstable_mockModule('@kace/core/src/aux_casos/domain/AuxCasesFinderByCase.js', () => ({
    AuxCasesFinderByCase: jest.fn(() => auxCasesFinderByCase),
}));

jest.unstable_mockModule('@kace/core/src/shared/index.js', () => ({
    Helper: { logInfo: jest.fn(), logDebug: jest.fn(), logError: jest.fn() },
}));

const { Controller } = await import('../src/controller.mjs');

const validBody = {
    clasificacion_id: '33333333-3333-4333-8333-333333333333',
    transicion_id: '44444444-4444-4444-8444-444444444444',
    comment: { descripcion: 'Motivo de la reclasificación' },
};

const buildController = (body = validBody) =>
    new Controller(
        {
            body: JSON.stringify(body),
            pathParameters: { id: CASE_ID },
            user: {
                id: { value: USER_ID },
                hasPermission: (namespace, moduleId, name) =>
                    namespace === 'agente' && moduleId === 'cases' && name === 'CaseReclassify',
            },
        },
        {}
    );

beforeEach(() => {
    jest.clearAllMocks();
    reclassifierExecute.mockResolvedValue({});
});

describe('case_reclassify actionUpdate', () => {
    it('delegates the reclassification to CaseReclassifier', async () => {
        const result = await buildController().actionUpdate();

        expect(result.statusCode).toBe(200);
        expect(CaseReclassifier).toHaveBeenCalledTimes(1);
        expect(CaseReclassifier).toHaveBeenCalledWith({
            caseRepository,
            classificationsRepository,
            classificationGroupRelationshipRepository,
            transitionsCaseRepository,
            subcaseRelationshipRepository,
            getGlobalConfig: expect.any(Function),
            caseUpdater: expect.any(CaseUpdater),
            // El caso de uso crea el motivo, así que necesita el repositorio de comentarios.
            commentsRepository: expect.any(Object),
            // Folio configurable: el caso sin folio lo obtiene al reclasificarse.
            folioResolver: caseFolioResolver,
            auxCasesFinderByCase,
        });
        const { comment: _comment, ...expectedDto } = validBody;
        expect(reclassifierExecute).toHaveBeenCalledWith(
            CASE_ID,
            expect.objectContaining(expectedDto),
            expect.any(Object)
        );
    });

    it('injects user, eventPublisher and tenant into the CaseUpdater it hands over', async () => {
        await buildController().actionUpdate();

        const [, , updaterUser, updaterEventPublisher, updaterTenant, ruleRepository, transitionsRepository] =
            CaseUpdater.mock.calls[0];

        expect(updaterUser).toEqual(expect.objectContaining({ id: { value: USER_ID } }));
        expect(updaterEventPublisher).toBe(eventPublisher);
        expect(updaterTenant).toBe(tenant);
        expect(ruleRepository).toBe(transitionRuleRepository);
        expect(transitionsRepository).toBe(transitionsCaseRepository);
    });

    /**
     * El motivo lo crea `CaseReclassifier`, no el controlador: su id tiene que entrar en el dto
     * para que el caso lo enlace en la misma escritura. Si el controlador lo creara aparte, el
     * comentario quedaría sin que nada apunte a él.
     */
    it('hands the comment over to the use case instead of creating it itself', async () => {
        const comment = { descripcion: 'Motivo de la reclasificación' };

        const result = await buildController({ ...validBody, comment }).actionUpdate();

        expect(result.statusCode).toBe(200);
        expect(commentCreatorExecute).not.toHaveBeenCalled();

        const [, dto, options] = reclassifierExecute.mock.calls[0];
        expect(dto).not.toHaveProperty('comment');
        expect(options).toMatchObject({ comment });
    });

    it('rejects a payload with no comment', async () => {
        const { comment, ...bodyWithoutComment } = validBody;

        const result = await buildController(bodyWithoutComment).actionUpdate();

        expect(result.statusCode).toBe(400);
        expect(reclassifierExecute).not.toHaveBeenCalled();
    });

    it('rejects a comment carrying a client-assigned id', async () => {
        const comment = {
            id: '55555555-5555-4555-8555-555555555555',
            descripcion: 'Motivo de la reclasificación',
        };

        const result = await buildController({ ...validBody, comment }).actionUpdate();

        expect(result.statusCode).toBe(400);
        expect(reclassifierExecute).not.toHaveBeenCalled();
    });

    it('hands the classification snapshot over as an option, not as part of the dto', async () => {
        const snapshot = '66666666-6666-4666-8666-666666666666';

        await buildController({ ...validBody, current_clasificacion_id: snapshot }).actionUpdate();

        const [, dto, options] = reclassifierExecute.mock.calls[0];

        expect(dto).not.toHaveProperty('current_clasificacion_id');
        expect(options).toMatchObject({ clasificacionSnapshot: snapshot });
    });

    it('surfaces a stale snapshot as a 409 with its own public error code', async () => {
        reclassifierExecute.mockRejectedValue(new CustomError('classification changed', 409, [], '0x030062'));

        const result = await buildController({
            ...validBody,
            current_clasificacion_id: '66666666-6666-4666-8666-666666666666',
        }).actionUpdate();

        expect(result.statusCode).toBe(409);
        expect(result.code).toBe('0x030062');
    });

    it('leaves the snapshot option undefined when the payload carries none', async () => {
        await buildController().actionUpdate();

        expect(reclassifierExecute.mock.calls[0][2]).toEqual({
            clasificacionSnapshot: undefined,
            comment: validBody.comment,
        });
    });

    it.each([[404], [400], [409]])('propagates a CustomError %s with its public error code', async (statusCode) => {
        reclassifierExecute.mockRejectedValue(new CustomError('nope', statusCode, [], '0x030057'));

        const result = await buildController().actionUpdate();

        expect(result.statusCode).toBe(statusCode);
        expect(result.code).toBe('0x030057');
        expect(commentCreatorExecute).not.toHaveBeenCalled();
    });

    it('falls back to a 500 for an unexpected error', async () => {
        reclassifierExecute.mockRejectedValue(new Error('boom'));

        const result = await buildController().actionUpdate();

        expect(result.statusCode).toBe(500);
        expect(result.code).toBeNull();
    });
});
