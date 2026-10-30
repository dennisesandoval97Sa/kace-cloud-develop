import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, jest } from '@jest/globals';
import { production as knexConfig } from '@kace/database/knexfile';
import {
    createApiEvent,
    createAuthenticatedUser,
    permission,
} from '@kace/api-common/tests/helpers/ObjectIdentityFixtures.js';

const CASE_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '44444444-4444-4444-8444-444444444444';

const caseUpdaterExecuteCalls = [];

const casesBarrel = readFileSync(
    fileURLToPath(new URL('../../../../packages/kace_cloud_core/src/cases/index.js', import.meta.url)),
    'utf8'
);
const casesExportNames = [...casesBarrel.matchAll(/^export\s+\{([^}]+)\}/gm)].map((match) => {
    const [exported, alias] = match[1].split(/\s+as\s+/);
    return (alias ?? exported).trim();
});

jest.unstable_mockModule('@kace/core/src/cases', () => {
    const mod = {};
    for (const name of casesExportNames) {
        mod[name] = jest.fn();
    }

    class MockCaseUpdater {
        async execute(id, value) {
            caseUpdaterExecuteCalls.push({ id, value });
            return true;
        }
    }

    class MockKnexCaseRepository {
        constructor() {
            this.connection = () => this.connection;
            this.connection.client = { config: { client: 'pg' }, on: () => {} };
            this.qualifiedName = (table) => table;
            this.destroyConnection = jest.fn(async () => {});
        }
        table(tableName) {
            return {
                select: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                whereNull: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                first: jest.fn(async () => ({ id: `${tableName}-id` })),
            };
        }
    }

    mod.CaseUpdater = MockCaseUpdater;
    mod.KnexCaseRepository = MockKnexCaseRepository;
    return mod;
});

const { Controller } = await import('../src/controller.mjs');

describe('cases_2 audit fields propagation to FakeCaseUpdater', () => {
    it('propagates edited_by and edited_at to FakeCaseUpdater in actionUpdate for regular users', async () => {
        caseUpdaterExecuteCalls.length = 0;
        const fakeCaseExecuteCalls = [];

        const body = {
            descripcion_caso: 'Updated Case Description',
        };

        const event = createApiEvent({ body, pathParameters: { id: CASE_ID } });
        const controller = new Controller(event, knexConfig);
        controller.user = createAuthenticatedUser({
            permissions: {
                agente: [permission('agente', 'cases', 'CasesUpdate')],
            },
        });
        controller.user.account_type = 1;

        controller.fakeCaseUpdaterFactory = () => ({
            execute: jest.fn(async (id, payload) => {
                fakeCaseExecuteCalls.push({ id, payload });
            }),
        });

        const response = await controller.actionUpdate();

        expect(response.statusCode).toBe(200);

        expect(fakeCaseExecuteCalls).toHaveLength(1);
        expect(fakeCaseExecuteCalls[0].id).toBe(CASE_ID);
        const fakePayload = fakeCaseExecuteCalls[0].payload;
        expect(fakePayload.edited_by).toBe(controller.user.id.value);
        expect(fakePayload.edited_at).toBeDefined();
        expect(fakePayload.transicion_id).toBeNull();
    });

    it('does NOT set edited_by or edited_at on FakeCaseUpdater in actionUpdate for service accounts', async () => {
        caseUpdaterExecuteCalls.length = 0;
        const fakeCaseExecuteCalls = [];

        const body = {
            descripcion_caso: 'Updated Case by Service',
        };

        const event = createApiEvent({ body, pathParameters: { id: CASE_ID } });
        const controller = new Controller(event, knexConfig);
        controller.user = createAuthenticatedUser({
            permissions: {
                agente: [permission('agente', 'cases', 'CasesUpdate')],
            },
        });
        controller.user.account_type = 2; // Service account

        controller.fakeCaseUpdaterFactory = () => ({
            execute: jest.fn(async (id, payload) => {
                fakeCaseExecuteCalls.push({ id, payload });
            }),
        });

        const response = await controller.actionUpdate();

        expect(response.statusCode).toBe(200);

        expect(fakeCaseExecuteCalls).toHaveLength(1);
        expect(fakeCaseExecuteCalls[0].id).toBe(CASE_ID);
        const fakePayload = fakeCaseExecuteCalls[0].payload;
        expect(fakePayload.edited_by).toBeUndefined();
        expect(fakePayload.edited_at).toBeUndefined();
    });

    it('propagates edited_by and edited_at to FakeCaseUpdater in actionUpdateWithAux for regular users', async () => {
        caseUpdaterExecuteCalls.length = 0;
        const fakeCaseExecuteCalls = [];

        const body = {
            case: {
                descripcion_caso: 'Description update by regular user',
            },
            aux_cases: {},
        };

        const event = createApiEvent({ body, pathParameters: { id: CASE_ID } });
        const controller = new Controller(event, knexConfig);
        controller.user = createAuthenticatedUser({
            permissions: {
                agente: [permission('agente', 'cases', 'CasesUpdate')],
            },
        });
        controller.user.account_type = 1;

        controller.fakeCaseUpdaterFactory = () => ({
            execute: jest.fn(async (id, payload) => {
                fakeCaseExecuteCalls.push({ id, payload });
            }),
        });

        const response = await controller.actionUpdateWithAux();

        expect(response.statusCode).toBe(200);

        expect(fakeCaseExecuteCalls).toHaveLength(1);
        expect(fakeCaseExecuteCalls[0].id).toBe(CASE_ID);
        const fakePayload = fakeCaseExecuteCalls[0].payload;
        expect(fakePayload.edited_by).toBe(controller.user.id.value);
        expect(fakePayload.edited_at).toBeDefined();
        expect(fakePayload.transicion_id).toBeNull();
    });

    it('does NOT set edited_by or edited_at on FakeCaseUpdater in actionUpdateWithAux for service accounts', async () => {
        caseUpdaterExecuteCalls.length = 0;
        const fakeCaseExecuteCalls = [];

        const body = {
            case: {
                descripcion_caso: 'Description update by service account',
            },
            aux_cases: {},
        };

        const event = createApiEvent({ body, pathParameters: { id: CASE_ID } });
        const controller = new Controller(event, knexConfig);
        controller.user = createAuthenticatedUser({
            permissions: {
                agente: [permission('agente', 'cases', 'CasesUpdate')],
            },
        });
        controller.user.account_type = 2; // Service account

        controller.fakeCaseUpdaterFactory = () => ({
            execute: jest.fn(async (id, payload) => {
                fakeCaseExecuteCalls.push({ id, payload });
            }),
        });

        const response = await controller.actionUpdateWithAux();

        expect(response.statusCode).toBe(200);

        expect(fakeCaseExecuteCalls).toHaveLength(1);
        expect(fakeCaseExecuteCalls[0].id).toBe(CASE_ID);
        const fakePayload = fakeCaseExecuteCalls[0].payload;
        expect(fakePayload.edited_by).toBeUndefined();
        expect(fakePayload.edited_at).toBeUndefined();
    });
});
