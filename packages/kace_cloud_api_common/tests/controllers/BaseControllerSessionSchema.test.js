import { jest } from '@jest/globals';

const requestedTables = [];

const queryBuilder = {
    where: jest.fn(() => queryBuilder),
    update: jest.fn(() => {
        const table = requestedTables.at(-1);
        if (table === 'usuarios') {
            throw new Error('relation "usuarios" does not exist');
        }
        return Promise.resolve(1);
    }),
};

const connection = jest.fn((table) => {
    requestedTables.push(table);
    return queryBuilder;
});
connection.client = { config: { client: 'pg', schema: 'tenant_schema' }, on: jest.fn() };
connection.destroy = jest.fn(() => Promise.resolve());

jest.unstable_mockModule('knex', () => ({
    default: jest.fn(() => connection),
}));

const { BaseController } = await import('../../src/controllers/BaseController.js');
const { HttpResponse } = await import('../../src/http_responses/HttpResponse.js');
const { User } = await import('@kace/core/src/users/domain/User.js');
const { SecurePasswordEncoder, StatusEnum, AccountTypeEnum } = await import('@kace/core/src/shared/index.js');

const TENANT_SCHEMA = 'tenant_schema';
const USER_ID = '3db4b68d-2bf7-44db-8c4c-740b77d7ab55';

function eventFor(resource = '/') {
    return {
        httpMethod: 'GET',
        resource,
        headers: {
            Host: 'api.example.com',
            'X-Client-Fingerprint': 'current-fingerprint',
        },
        tenantContext: {
            tenant: {
                id: { value: 'tenant-id' },
                aws_cognito_user_pool_id: { value: 'pool-id' },
                aws_cognito_app_client_id: { value: 'client-id' },
                apps_service_name: { value: 'DEVELOPMENT' },
                aws_sqs_region: { value: 'us-east-1' },
                aws_event_bridge_event_bus_name: { value: 'test-bus' },
                aws_cases_events_queue_url: { value: 'https://sqs.us-east-1.amazonaws.com/123/cases' },
                aws_action_jobs_events_queue_url: { value: 'https://sqs.us-east-1.amazonaws.com/123/action-jobs' },
                aws_automated_actions_events_queue_url: {
                    value: 'https://sqs.us-east-1.amazonaws.com/123/automated-actions',
                },
                aws_ws_rest_events_queue_url: { value: 'https://sqs.us-east-1.amazonaws.com/123/ws-rest' },
                aws_reports_events_queue_url: { value: 'https://sqs.us-east-1.amazonaws.com/123/reports' },
            },
        },
    };
}

function activeDirectoryUser(overrides = {}) {
    return new User({
        id: USER_ID,
        login: 'agent',
        nombres: 'Agent',
        apellido1: 'Example',
        apellido2: null,
        email: 'agent@example.com',
        rol_id: '7572f212-bfa6-4026-9d3f-f12de9f5959b',
        is_active: StatusEnum.ACTIVE.value,
        account_type: AccountTypeEnum.ACTIVE_DIRECTORY.value,
        created_at: new Date('2026-01-01T00:00:00.000Z'),
        created_by: USER_ID,
        ...overrides,
    });
}

class SessionRotationController extends BaseController {
    #loggedInUser;

    constructor(event, knexConfig, loggedInUser) {
        super(event, knexConfig);
        this.#loggedInUser = loggedInUser;
    }

    async getLoggedInUser() {
        return this.#loggedInUser;
    }

    async actionIndex() {
        return HttpResponse.ok({ event: this.event });
    }

    async destroyDbConnection() {}
}

describe('BaseController tenant-qualified session writes', () => {
    beforeEach(() => {
        requestedTables.length = 0;
        jest.clearAllMocks();
    });

    it('self-heals a stale session hash inside the configured tenant schema', async () => {
        const controller = new BaseController(eventFor(), { client: 'pg', schema: TENANT_SCHEMA });
        const staleHash = SecurePasswordEncoder.createHash('old-session-value');

        await expect(
            controller.verifySessionHash(staleHash, { email: 'agent@example.com', sub: 'agent' }, activeDirectoryUser())
        ).resolves.not.toThrow();

        expect(requestedTables).toContain(`${TENANT_SCHEMA}.usuarios`);
        expect(requestedTables).not.toContain('usuarios');
    });

    it('rotates a session key inside the configured tenant schema', async () => {
        const nineHoursAgo = new Date(Date.now() - 9 * 60 * 60 * 1000).toISOString();
        const user = activeDirectoryUser({
            session_key: 'existing-session-key',
            session_key_rotated_at: nineHoursAgo,
        });
        const controller = new SessionRotationController(eventFor(), { client: 'pg', schema: TENANT_SCHEMA }, user);

        await expect(controller.run()).resolves.toEqual(expect.objectContaining({ statusCode: 200 }));

        expect(requestedTables).toContain(`${TENANT_SCHEMA}.usuarios`);
        expect(requestedTables).not.toContain('usuarios');
    });

    it('destroys connections when authentication fails before action dispatch', async () => {
        const controller = new BaseController(eventFor(), { client: 'pg', schema: TENANT_SCHEMA });
        jest.spyOn(controller, 'getLoggedInUser').mockRejectedValue(new Error('Invalid credentials'));
        const cleanup = jest.spyOn(controller, 'destroyDbConnection').mockResolvedValue();
        const action = jest.spyOn(controller, 'actionIndex');

        const response = await controller.run();

        expect(response.statusCode).toBe(400);
        expect(action).not.toHaveBeenCalled();
        expect(cleanup).toHaveBeenCalledTimes(1);
    });
});
