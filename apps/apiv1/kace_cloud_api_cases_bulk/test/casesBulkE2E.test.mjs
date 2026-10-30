import { production as knexProduction } from '@kace/database/knexfile';
import { KnexCaseRepository } from '@kace/core/src/cases/index.js';
import { KnexFlowRepository } from '@kace/core/src/flow/index.js';
import { KnexTransitionsRepository } from '@kace/core/src/transition/index.js';
import { KnexStateRepository } from '@kace/core/src/state/index.js';
import { KnexAnsRepository } from '@kace/core/src/ans/index.js';
import { CaseFactory } from '@kace/core/src/factories/CaseFactory.js';
import { UserFactory } from '@kace/core/src/factories/UserFactory.js';
import { GroupFactory } from '@kace/core/src/factories/GroupFactory.js';
import AnsMother from '@kace/core/tests/ans/domain/AnsMother.js';
import FlowsMother from '@kace/core/tests/flow/domain/FlowsMother.js';
import { TransitionsMother } from '@kace/core/tests/transition/domain/TransitionsMother.js';
import { StateMother } from '@kace/core/tests/state/domain/StateMother.js';
import { TestHelper } from '@kace/api-common';
import { uuidv4 } from '@kace/core/src/factories/Factory.js';
import { ValueObjectUpdateSource } from '@kace/core/src/cases/domain/ValueObjectUpdateSource.js';
import { Helper } from '@kace/core/src/shared/index.js';
import { KnexTransitionRuleRepository } from '@kace/core/src/transition-rules/infrastructure/KnexTransitionRuleRepository.js';
import { TransitionRuleMother } from '@kace/core/tests/transition-rules/domain/TransitionRuleMother.js';

const casesBulkE2eEnabled = process.env.CASES_BULK_E2E === 'true';

let knexConfig;

function httpStatus(result) {
    return result.response ? result.response.status : result.status;
}

function expectHttpStatus(result, expected) {
    const status = httpStatus(result);
    if (status !== expected) {
        const data = result.response?.data;
        const detail = data === undefined ? String(result.message ?? result) : JSON.stringify(data);
        throw new Error(`HTTP ${status}, expected ${expected}. ${detail}`);
    }
}

function responsePayloadText(result) {
    const data = result.response?.data;
    if (data == null) {
        return '';
    }
    const chunks = [];
    if (typeof data.message === 'string') {
        chunks.push(data.message);
    }
    if (typeof data.errors === 'string') {
        chunks.push(data.errors);
    } else if (data.errors != null) {
        chunks.push(JSON.stringify(data.errors));
    }
    return chunks.join(' ');
}

async function seedLinearFlowTwoCasesSameTransition() {
    const repository = new KnexCaseRepository(knexConfig);
    const flowRepo = new KnexFlowRepository(repository.connection);
    const stateRepo = new KnexStateRepository(repository.connection);
    const transitionRepo = new KnexTransitionsRepository(repository.connection);
    const ansRepo = new KnexAnsRepository(repository.connection);
    const caseFactory = new CaseFactory(knexConfig);

    const A = await StateMother.createState(stateRepo);
    const B = await StateMother.createState(stateRepo);
    const C = await StateMother.createState(stateRepo);
    const flow = await FlowsMother.createFlow(flowRepo);
    const ans = await AnsMother.createAns(ansRepo);
    const T1 = await TransitionsMother.createTransition(transitionRepo, A, flow, B, null, ans.id.value);
    const T2 = await TransitionsMother.createTransition(transitionRepo, B, flow, C, null, ans.id.value);
    const json_flujo = {
        nodes: [{ id: A.id.value }, { id: B.id.value }, { id: C.id.value }],
        edges: [
            { id: 'edge-A-B', source: A.id.value, target: B.id.value, kace_transition: T1.id.value },
            { id: 'edge-B-C', source: B.id.value, target: C.id.value, kace_transition: T2.id.value },
            { id: 'edge-0-A', source: '0', target: A.id.value, kace_transition: T1.id.value },
        ],
    };
    await repository
        .connection('flujos')
        .update({ json_flujo: JSON.stringify(json_flujo) })
        .where({ id: flow.id.value });

    const kase1 = await caseFactory.create({ transicion_id: T1.id.value });
    const kase2 = await caseFactory.create({ transicion_id: T1.id.value });

    return { repository, T1, T2, kase1, kase2 };
}

async function attachNonMatchingRuleToTransition(repository, transitionId) {
    const ruleRepo = new KnexTransitionRuleRepository(repository.connection);
    const rule = await TransitionRuleMother.create(ruleRepo, {
        conditions: {
            combinator: 'and',
            rules: [
                {
                    field: 'cases.id',
                    operator: '=',
                    value: uuidv4(),
                    type: 'manual_input',
                    value_type: 'text',
                },
            ],
        },
    });
    await repository.connection('transiciones').update({ rule_id: rule.id.value }).where({ id: transitionId });
}

(casesBulkE2eEnabled ? describe : describe.skip)('Cases bulk transition E2E', () => {
    let repository;

    const baseUrl =
        process.env.APPS_ENVIRONMENT === 'staging'
            ? `https://${process.env.APPS_API_SUBDOMAIN}.${process.env.APPS_DOMAIN}/cases-bulk`
            : 'http://127.0.0.1:60096';

    beforeAll(async () => {
        if (process.env.DB_TEST_HOST && process.env.DB_TEST_SCHEMA) {
            try {
                const tenant = await TestHelper.getTenant();
                knexConfig = tenant.buildKnexConfig();
            } catch {
                knexConfig = knexProduction;
            }
        } else {
            knexConfig = knexProduction;
        }
        const probe = await TestHelper.postRequest(`${baseUrl}/transition`, {
            case_ids: [uuidv4()],
            transition_id: uuidv4(),
        });
        const probeStatus = httpStatus(probe);
        const probeText = responsePayloadText(probe);
        if (probeStatus === 400 && probeText.includes('not active')) {
            throw new Error(
                'E2E bloqueado: cuenta TEST_APP_USER inactiva (Cognito o usuarios en BD). Activa el usuario usado en TEST_APP_USER / TEST_APP_PASSWORD.'
            );
        }
    });

    afterAll(async () => {
        try {
            if (repository?.connection) {
                await repository.connection.destroy();
            }
        } catch (error) {
            Helper.logInfo(error);
        }
    });

    it('POST /transition returns 200 and updates cases with update_source bulk', async () => {
        const seeded = await seedLinearFlowTwoCasesSameTransition();
        repository = seeded.repository;
        const { T2, kase1, kase2 } = seeded;

        const response = await TestHelper.postRequest(`${baseUrl}/transition`, {
            case_ids: [kase1.id.value, kase2.id.value],
            transition_id: T2.id.value,
        });

        expectHttpStatus(response, 200);

        const row1 = await repository.connection('cases').first('*').where({ id: kase1.id.value });
        const row2 = await repository.connection('cases').first('*').where({ id: kase2.id.value });
        expect(row1.transicion_id).toBe(T2.id.value);
        expect(row2.transicion_id).toBe(T2.id.value);
        expect(row1.update_source).toBe(ValueObjectUpdateSource.BULK);
        expect(row2.update_source).toBe(ValueObjectUpdateSource.BULK);
    });

    it('POST /transition returns 404 when transition does not exist', async () => {
        const seeded = await seedLinearFlowTwoCasesSameTransition();
        repository = seeded.repository;
        const { kase1, kase2 } = seeded;
        const fakeTransitionId = uuidv4();

        const response = await TestHelper.postRequest(`${baseUrl}/transition`, {
            case_ids: [kase1.id.value, kase2.id.value],
            transition_id: fakeTransitionId,
        });

        expectHttpStatus(response, 404);
    });

    it('POST /transition returns 404 when a case id is missing', async () => {
        const seeded = await seedLinearFlowTwoCasesSameTransition();
        repository = seeded.repository;
        const { T2, kase1 } = seeded;

        const response = await TestHelper.postRequest(`${baseUrl}/transition`, {
            case_ids: [kase1.id.value, uuidv4()],
            transition_id: T2.id.value,
        });

        expectHttpStatus(response, 404);
    });

    it('POST /transition returns 400 when a case is closed', async () => {
        const seeded = await seedLinearFlowTwoCasesSameTransition();
        repository = seeded.repository;
        const { T1, T2, kase1 } = seeded;
        const caseFactory = new CaseFactory(knexConfig);
        const kaseClosed = await caseFactory.create({ transicion_id: T1.id.value }, 'closed');

        const response = await TestHelper.postRequest(`${baseUrl}/transition`, {
            case_ids: [kase1.id.value, kaseClosed.id.value],
            transition_id: T2.id.value,
        });

        expectHttpStatus(response, 400);
        expect(responsePayloadText(response)).toContain('Some cases are already closed');
    });

    it('POST /transition returns 400 when cases have different current transitions', async () => {
        const seeded = await seedLinearFlowTwoCasesSameTransition();
        repository = seeded.repository;
        const { T2, kase1 } = seeded;
        const caseFactory = new CaseFactory(knexConfig);
        const kaseOther = await caseFactory.create({ transicion_id: T2.id.value });

        const response = await TestHelper.postRequest(`${baseUrl}/transition`, {
            case_ids: [kase1.id.value, kaseOther.id.value],
            transition_id: T2.id.value,
        });

        expectHttpStatus(response, 400);
        expect(responsePayloadText(response)).toContain('same current transition');
    });

    it('POST /transition rejects when transition rule conditions are not met', async () => {
        const seeded = await seedLinearFlowTwoCasesSameTransition();
        repository = seeded.repository;
        const { T1, T2, kase1, kase2 } = seeded;
        await attachNonMatchingRuleToTransition(repository, T2.id.value);

        const response = await TestHelper.postRequest(`${baseUrl}/transition`, {
            case_ids: [kase1.id.value, kase2.id.value],
            transition_id: T2.id.value,
        });

        const status = httpStatus(response);
        expect([400, 422]).toContain(status);
        expect(responsePayloadText(response)).toContain('The conditions configured for this transition are not met');

        const row1 = await repository.connection('cases').first('*').where({ id: kase1.id.value });
        const row2 = await repository.connection('cases').first('*').where({ id: kase2.id.value });
        expect(row1.transicion_id).toBe(T1.id.value);
        expect(row2.transicion_id).toBe(T1.id.value);
    });
});

(casesBulkE2eEnabled ? describe : describe.skip)('Cases bulk close E2E', () => {
    let repository;

    const baseUrl =
        process.env.APPS_ENVIRONMENT === 'staging'
            ? `https://${process.env.APPS_API_SUBDOMAIN}.${process.env.APPS_DOMAIN}/cases-bulk`
            : 'http://127.0.0.1:60096';

    beforeAll(async () => {
        if (process.env.DB_TEST_HOST && process.env.DB_TEST_SCHEMA) {
            try {
                const tenant = await TestHelper.getTenant();
                knexConfig = tenant.buildKnexConfig();
            } catch {
                knexConfig = knexProduction;
            }
        } else {
            knexConfig = knexProduction;
        }
    });

    afterAll(async () => {
        try {
            if (repository?.connection) {
                await repository.connection.destroy();
            }
        } catch (error) {
            Helper.logInfo(error);
        }
    });

    it('POST /close returns 200 and cases have fecha_resolucion and motivo_baja persisted', async () => {
        const seeded = await seedLinearFlowTwoCasesSameTransition();
        repository = seeded.repository;
        const { kase1, kase2 } = seeded;
        const closeReason = 'Resolved in bulk E2E';

        const response = await TestHelper.postRequest(`${baseUrl}/close`, {
            case_ids: [kase1.id.value, kase2.id.value],
            close_reason: closeReason,
        });

        expectHttpStatus(response, 200);

        const row1 = await repository.connection('cases').first('*').where({ id: kase1.id.value });
        const row2 = await repository.connection('cases').first('*').where({ id: kase2.id.value });
        expect(row1.fecha_resolucion).not.toBeNull();
        expect(row2.fecha_resolucion).not.toBeNull();
        expect(row1.motivo_baja).toBe(closeReason);
        expect(row2.motivo_baja).toBe(closeReason);
        expect(row1.update_source).toBe(ValueObjectUpdateSource.BULK);
        expect(row2.update_source).toBe(ValueObjectUpdateSource.BULK);
    });

    it('POST /close returns 404 when a case_id does not exist', async () => {
        const seeded = await seedLinearFlowTwoCasesSameTransition();
        repository = seeded.repository;
        const { kase1 } = seeded;

        const response = await TestHelper.postRequest(`${baseUrl}/close`, {
            case_ids: [kase1.id.value, uuidv4()],
            close_reason: 'Test',
        });

        expectHttpStatus(response, 404);
    });

    it('POST /close returns 400 when a case is already closed', async () => {
        const seeded = await seedLinearFlowTwoCasesSameTransition();
        repository = seeded.repository;
        const { T1, kase1 } = seeded;
        const caseFactory = new CaseFactory(knexConfig);
        const kaseClosed = await caseFactory.create({ transicion_id: T1.id.value }, 'closed');

        const response = await TestHelper.postRequest(`${baseUrl}/close`, {
            case_ids: [kase1.id.value, kaseClosed.id.value],
            close_reason: 'Test',
        });

        expectHttpStatus(response, 400);
        expect(responsePayloadText(response)).toContain('Some cases are already closed');
    });
});

(casesBulkE2eEnabled ? describe : describe.skip)('Cases bulk assign E2E', () => {
    let repository;

    const baseUrl =
        process.env.APPS_ENVIRONMENT === 'staging'
            ? `https://${process.env.APPS_API_SUBDOMAIN}.${process.env.APPS_DOMAIN}/cases-bulk`
            : 'http://127.0.0.1:60096';

    beforeAll(async () => {
        if (process.env.DB_TEST_HOST && process.env.DB_TEST_SCHEMA) {
            try {
                const tenant = await TestHelper.getTenant();
                knexConfig = tenant.buildKnexConfig();
            } catch {
                knexConfig = knexProduction;
            }
        } else {
            knexConfig = knexProduction;
        }
    });

    afterAll(async () => {
        try {
            if (repository?.connection) {
                await repository.connection.destroy();
            }
        } catch (error) {
            Helper.logInfo(error);
        }
    });

    it('POST /assign returns 200 and cases have responsible_id and group_id columns updated in DB', async () => {
        const seeded = await seedLinearFlowTwoCasesSameTransition();
        repository = seeded.repository;
        const { kase1, kase2 } = seeded;

        const userFactory = new UserFactory(knexConfig);
        const groupFactory = new GroupFactory(knexConfig);
        const targetUser = await userFactory.create();
        const targetGroup = await groupFactory.create();

        await repository.connection('rel_usuarios_grupos').insert({
            usuario_id: targetUser.id.value,
            grupo_id: targetGroup.id.value,
        });

        const response = await TestHelper.postRequest(`${baseUrl}/assign`, {
            case_ids: [kase1.id.value, kase2.id.value],
            group_id: targetGroup.id.value,
            responsible_id: targetUser.id.value,
        });

        expectHttpStatus(response, 200);

        const row1 = await repository.connection('cases').first('*').where({ id: kase1.id.value });
        const row2 = await repository.connection('cases').first('*').where({ id: kase2.id.value });
        expect(row1.responsable_id).toBe(targetUser.id.value);
        expect(row2.responsable_id).toBe(targetUser.id.value);
        expect(row1.grupo_id).toBe(targetGroup.id.value);
        expect(row2.grupo_id).toBe(targetGroup.id.value);
        expect(row1.update_source).toBe(ValueObjectUpdateSource.BULK);
        expect(row2.update_source).toBe(ValueObjectUpdateSource.BULK);
    });

    it('POST /assign returns 404 when a case_id does not exist', async () => {
        const seeded = await seedLinearFlowTwoCasesSameTransition();
        repository = seeded.repository;
        const { kase1 } = seeded;

        const userFactory = new UserFactory(knexConfig);
        const groupFactory = new GroupFactory(knexConfig);
        const targetUser = await userFactory.create();
        const targetGroup = await groupFactory.create();

        await repository.connection('rel_usuarios_grupos').insert({
            usuario_id: targetUser.id.value,
            grupo_id: targetGroup.id.value,
        });

        const response = await TestHelper.postRequest(`${baseUrl}/assign`, {
            case_ids: [kase1.id.value, uuidv4()],
            group_id: targetGroup.id.value,
            responsible_id: targetUser.id.value,
        });

        expectHttpStatus(response, 404);
    });

    it('POST /assign returns 400 when a case is already closed', async () => {
        const seeded = await seedLinearFlowTwoCasesSameTransition();
        repository = seeded.repository;
        const { T1, kase1 } = seeded;
        const caseFactory = new CaseFactory(knexConfig);
        const kaseClosed = await caseFactory.create({ transicion_id: T1.id.value }, 'closed');

        const userFactory = new UserFactory(knexConfig);
        const groupFactory = new GroupFactory(knexConfig);
        const targetUser = await userFactory.create();
        const targetGroup = await groupFactory.create();

        await repository.connection('rel_usuarios_grupos').insert({
            usuario_id: targetUser.id.value,
            grupo_id: targetGroup.id.value,
        });

        const response = await TestHelper.postRequest(`${baseUrl}/assign`, {
            case_ids: [kase1.id.value, kaseClosed.id.value],
            group_id: targetGroup.id.value,
            responsible_id: targetUser.id.value,
        });

        expectHttpStatus(response, 400);
        expect(responsePayloadText(response)).toContain('Some cases are already closed');
    });

    it('POST /assign returns validation error when user does not belong to the group', async () => {
        const seeded = await seedLinearFlowTwoCasesSameTransition();
        repository = seeded.repository;
        const { kase1, kase2 } = seeded;

        const userFactory = new UserFactory(knexConfig);
        const groupFactory = new GroupFactory(knexConfig);
        const targetUser = await userFactory.create();
        const targetGroup = await groupFactory.create();

        const response = await TestHelper.postRequest(`${baseUrl}/assign`, {
            case_ids: [kase1.id.value, kase2.id.value],
            group_id: targetGroup.id.value,
            responsible_id: targetUser.id.value,
        });

        const status = httpStatus(response);
        expect([400, 422]).toContain(status);
        expect(responsePayloadText(response)).toContain('The user does not belong to the specified group');
    });

    it('POST /assign returns 200 and updates only group in DB when responsible_id is not sent', async () => {
        const seeded = await seedLinearFlowTwoCasesSameTransition();
        repository = seeded.repository;
        const { kase1, kase2 } = seeded;

        const groupFactory = new GroupFactory(knexConfig);
        const targetGroup = await groupFactory.create();

        const originalRow1 = await repository.connection('cases').first('*').where({ id: kase1.id.value });

        const response = await TestHelper.postRequest(`${baseUrl}/assign`, {
            case_ids: [kase1.id.value, kase2.id.value],
            group_id: targetGroup.id.value,
        });

        expectHttpStatus(response, 200);

        const row1 = await repository.connection('cases').first('*').where({ id: kase1.id.value });
        const row2 = await repository.connection('cases').first('*').where({ id: kase2.id.value });
        expect(row1.grupo_id).toBe(targetGroup.id.value);
        expect(row2.grupo_id).toBe(targetGroup.id.value);
        expect(row1.responsable_id).toBe(originalRow1.responsable_id);
        expect(row1.update_source).toBe(ValueObjectUpdateSource.BULK);
        expect(row2.update_source).toBe(ValueObjectUpdateSource.BULK);
    });
});
