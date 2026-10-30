import { jest } from '@jest/globals';
import { hasCaseReclassifyPermission } from '@kace/api-common/src/security/CaseReclassifyPermission.js';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const CASE_ID = '22222222-2222-4222-8222-222222222222';
const CLASSIFICATION_ID = '33333333-3333-4333-8333-333333333333';

const knexConfig = { connection: { host: 'writer' } };
const readerConfig = { connection: { host: 'reader' } };

class BaseControllerStub {
    constructor(event, config) {
        this.event = event;
        this.database_connection = config;
        this.user = event.user;
    }

    pathParameters() {
        return this.event.pathParameters || {};
    }

    validateId(id) {
        return typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id);
    }

    async destroyDbConnection() {}
}

const response = (type, statusCode, payload = {}) => ({ type, statusCode, ...payload });

const HttpResponse = {
    ok: (payload) => response('ok', 200, payload),
    forbidden: (payload) => response('forbidden', 403, payload),
    notFound: (payload) => response('notFound', 404, payload),
    badRequest: (payload) => response('badRequest', 400, payload),
    internalServerError: (payload) => response('internalServerError', 500, payload),
};

// El helper de permiso entra REAL en el mock del barril: la resolución de los dos namespaces es
// justamente lo que cuidan los tests de permiso de abajo.
jest.unstable_mockModule('@kace/api-common', () => ({
    BaseController: BaseControllerStub,
    HttpResponse,
    hasCaseReclassifyPermission,
}));

const makeRepo = (name) => ({ name, connection: `${name}-connection`, destroyConnection: jest.fn(async () => {}) });

const caseRepository = makeRepo('case');
const classificationsRepository = makeRepo('classifications');
const classificationGroupRelationshipRepository = makeRepo('classification-group');
const transitionsCaseRepository = makeRepo('transitions');
const subcaseRelationshipRepository = makeRepo('subcase');

const KnexCaseRepository = jest.fn(() => caseRepository);
const KnexClassificationRepository = jest.fn(() => classificationsRepository);
const KnexClassificationGroupRelationshipRepository = jest.fn(() => classificationGroupRelationshipRepository);
const KnexTransitionsCaseRepository = jest.fn(() => transitionsCaseRepository);
const KnexSubcaseRelationshipRepository = jest.fn(() => subcaseRelationshipRepository);

// El veredicto elegible trae la clasificación ya resuelta; el controller debe pasarla tal cual al
// finder en vez de hacer que éste la relea por id.
const classification = { id: { value: CLASSIFICATION_ID } };

const evaluate = jest.fn(async () => ({ eligible: true, blocker: null, classification }));
const CaseReclassificationEligibility = jest.fn(function EligibilityMock() {
    this.evaluate = evaluate;
});

const flowStatesForClassification = jest.fn(async () => ({
    toJson: () => ({ data: { items: [{ transition: { id: 'tr-1' } }] } }),
}));
const flowStatesExecute = jest.fn();
const ClassificationFlowStatesFinder = jest.fn(function FlowStatesMock() {
    this.execute = flowStatesExecute;
    this.executeForClassification = flowStatesForClassification;
});

const TRANSITION_RULES = [
    { transicion_id: 'tr-1', rule_id: 'rule-1', nombre: 'Monto minimo', conditions: { combinator: 'and', rules: [] } },
];
const flowRulesForClassification = jest.fn(async () => TRANSITION_RULES);
const ClassificationFlowTransitionRulesFinder = jest.fn(function FlowRulesMock() {
    this.executeForClassification = flowRulesForClassification;
});

jest.unstable_mockModule('@kace/core/src/cases', () => ({
    CaseReclassificationEligibility,
    ClassificationFlowStatesFinder,
    ClassificationFlowTransitionRulesFinder,
    KnexCaseRepository,
    KnexSubcaseRelationshipRepository,
}));

jest.unstable_mockModule('@kace/core/src/cases/infrastructure/persistence/KnexTransitionsCaseRepository.js', () => ({
    KnexTransitionsCaseRepository,
}));

jest.unstable_mockModule('@kace/core/src/classifications', () => ({ KnexClassificationRepository }));

jest.unstable_mockModule('@kace/core/src/classification-group-relationships', () => ({
    KnexClassificationGroupRelationshipRepository,
}));

jest.unstable_mockModule('@kace/core/src/shared/index.js', () => ({
    Helper: { logInfo: jest.fn(), logDebug: jest.fn(), logError: jest.fn() },
}));

const { Controller } = await import('../src/controller.mjs');

const buildController = ({
    granted = ['agente'],
    id = CASE_ID,
    query = { clasificacion_id: CLASSIFICATION_ID },
} = {}) =>
    new Controller(
        {
            pathParameters: { id },
            queryStringParameters: query,
            tenantContext: { knexConfig, readerConfig },
            user: {
                id: { value: USER_ID },
                hasPermission: (namespace, moduleId, name) =>
                    granted.includes(namespace) && moduleId === 'cases' && name === 'CaseReclassify',
            },
        },
        knexConfig
    );

beforeEach(() => {
    jest.clearAllMocks();
    evaluate.mockResolvedValue({ eligible: true, blocker: null, classification });
});

describe('case_reclassify_precheck actionRead', () => {
    it('answers with the target flow states when the case is eligible', async () => {
        const result = await buildController().actionRead();

        expect(result.statusCode).toBe(200);
        expect(result.data).toEqual({
            eligible: true,
            blocker: null,
            states: [{ transition: { id: 'tr-1' } }],
            transition_rules: TRANSITION_RULES,
        });
        // Con la clasificación del veredicto, no releyéndola por id.
        expect(flowStatesForClassification).toHaveBeenCalledWith(classification);
        expect(flowStatesExecute).not.toHaveBeenCalled();
    });

    it('publishes the transition rules of the target flow so the plugin can anticipate a block', async () => {
        await buildController().actionRead();

        // Del mismo repositorio de transiciones, con la clasificación del veredicto: el plugin
        // indexa las reglas por `transicion_id`, que es lo que la lista de estados publica.
        expect(ClassificationFlowTransitionRulesFinder).toHaveBeenCalledWith(transitionsCaseRepository);
        expect(flowRulesForClassification).toHaveBeenCalledWith(classification);
    });

    it('asks the shared eligibility collaborator without a transition', async () => {
        await buildController().actionRead();

        expect(CaseReclassificationEligibility).toHaveBeenCalledWith({
            caseRepository,
            classificationsRepository,
            classificationGroupRelationshipRepository,
            transitionsCaseRepository,
            subcaseRelationshipRepository,
            getGlobalConfig: expect.any(Function),
            // Este servicio no escribe: sus lecturas del caso salen por la réplica.
            replicaSafeCaseRead: true,
        });
        expect(evaluate).toHaveBeenCalledWith(CASE_ID, { clasificacionId: CLASSIFICATION_ID });
    });

    it('reports a business blocker as a 200 carrying its public error code', async () => {
        evaluate.mockResolvedValue({
            eligible: false,
            blocker: { message: 'The target classification is not active.', statusCode: 400, code: '0x030057' },
        });

        const result = await buildController().actionRead();

        expect(result.statusCode).toBe(200);
        expect(result.data).toEqual({
            eligible: false,
            blocker: { code: '0x030057', message: 'The target classification is not active.' },
            states: [],
            transition_rules: [],
        });
        expect(flowStatesForClassification).not.toHaveBeenCalled();
        expect(flowRulesForClassification).not.toHaveBeenCalled();
    });

    it('returns 404 when the case or the classification does not exist', async () => {
        evaluate.mockResolvedValue({
            eligible: false,
            blocker: { message: 'Classification not found', statusCode: 404, code: null },
        });

        const result = await buildController().actionRead();

        expect(result.statusCode).toBe(404);
        expect(flowStatesForClassification).not.toHaveBeenCalled();
    });

    it('rejects a user without CaseReclassify in either namespace', async () => {
        const result = await buildController({ granted: [] }).actionRead();

        expect(result.statusCode).toBe(403);
        expect(evaluate).not.toHaveBeenCalled();
    });

    it.each([['administrador'], ['agente']])('lets a user with the permission as %s through', async (namespace) => {
        const result = await buildController({ granted: [namespace] }).actionRead();

        expect(result.statusCode).toBe(200);
    });

    it.each([
        ['an invalid case id', { id: 'not-a-uuid' }],
        ['a missing clasificacion_id', { query: {} }],
        ['an invalid clasificacion_id', { query: { clasificacion_id: 'nope' } }],
    ])('rejects %s with a 400', async (_label, overrides) => {
        const result = await buildController(overrides).actionRead();

        expect(result.statusCode).toBe(400);
        expect(evaluate).not.toHaveBeenCalled();
    });

    it('builds the replica-capable repositories from config objects, not from a Knex instance', async () => {
        buildController();

        for (const factory of [
            KnexCaseRepository,
            KnexClassificationRepository,
            KnexClassificationGroupRelationshipRepository,
            KnexTransitionsCaseRepository,
        ]) {
            expect(factory).toHaveBeenCalledWith(knexConfig, readerConfig);
        }

        expect(KnexSubcaseRelationshipRepository).toHaveBeenCalledWith(caseRepository.connection);
    });

    it('closes the pools it opened', async () => {
        await buildController().destroyDbConnection();

        for (const repo of [
            caseRepository,
            classificationsRepository,
            classificationGroupRelationshipRepository,
            transitionsCaseRepository,
        ]) {
            expect(repo.destroyConnection).toHaveBeenCalledTimes(1);
        }
    });

    it('falls back to a 500 for an unexpected error', async () => {
        evaluate.mockRejectedValue(new Error('boom'));

        const result = await buildController().actionRead();

        expect(result.statusCode).toBe(500);
    });
});
