import { jest } from '@jest/globals';
import dotenv from 'dotenv';

dotenv.config({ path: '../../../.env' });

// Only allowed mock: the outbound HTTP performed by CallWsService.
jest.unstable_mockModule('@kace/core/src/actions/domain/types/CallWsService.js', () => ({
    CallWsService: jest.fn().mockImplementation(() => ({
        execute: jest.fn().mockResolvedValue(true),
    })),
}));

const { default: knex } = await import('knex');
const { KnexActionRepository, ActionTypes } = await import('@kace/core/src/actions/index.js');
const { KnexGroupsRepository } = await import('@kace/core/src/grupos/index.js');
const { KnexShiftManagementRepository } = await import('@kace/core/src/shift-management/index.js');
const { KnexAutomationSettingsRepository } =
    await import('@kace/core/src/automation-settings/infrastructure/persistence/KnexAutomationSettingsRepository.js');
const { default: ActionMother } = await import('@kace/core/tests/actions/domain/ActionMother.js');
const { GroupsMother } = await import('@kace/core/tests/groups/domain/GroupsMother.js');
const { default: AutomationSettingsMother } =
    await import('@kace/core/tests/automation-settings/domain/AutomationSettingsMother.js');
const { ActionTriggers } = await import('@kace/core/src/shared/domain/enum/ActionTriggersEnum.js');
const { RuleOperator } = await import('@kace/core/src/actions/domain/QueryTranslator/RuleOperator.js');
const { globalUserId } = await import('@kace/database/seeds/20241125105900_usuario_base.js');

const hasDbEnv =
    Boolean(process.env.DB_TEST_HOST) &&
    Boolean(process.env.DB_TEST_DATABASE) &&
    Boolean(process.env.DB_TEST_USER) &&
    Boolean(process.env.DB_TEST_PASSWORD);

const workerId = process.env.JEST_WORKER_ID || '1';
const schemaName = `${process.env.DB_TEST_SCHEMA ?? 'kace_test'}_w${workerId}_groups_job`;

const buildRawPgConfig = () => ({
    client: 'pg',
    pool: {
        min: 1,
        max: 5,
        afterCreate: (conn, done) => {
            conn.query(`SET search_path TO ${schemaName};`, done);
        },
    },
    connection: {
        host: process.env.DB_TEST_HOST,
        database: process.env.DB_TEST_DATABASE,
        user: process.env.DB_TEST_USER,
        password: process.env.DB_TEST_PASSWORD,
        port: Number(process.env.DB_TEST_PORT || 5432),
    },
    schema: schemaName,
    migrations: {
        tableName: 'knex_migrations',
        directory: './node_modules/@kace/database/migrations',
    },
    seeds: {
        directory: './node_modules/@kace/database/seeds',
    },
});

// Stub TenantContextManager.buildKnexConfig to use our test DB config.
jest.unstable_mockModule('@kace/api-common', () => ({
    TenantContextManager: { buildKnexConfig: () => buildRawPgConfig() },
}));

const { GroupsActionsJob } = await import('../../src/jobs/GroupsActionsJob.mjs');

const conditionalDescribe = hasDbEnv ? describe : describe.skip;

conditionalDescribe('GroupsActionsJob (integration)', () => {
    let db;
    let actionRepository;
    let groupsRepository;
    let shiftManagementRepository;
    let automationSettingsRepository;
    const tenant = { id: { value: 't-int-groups' } };
    let createdActionIds = [];
    let createdGroupIds = [];
    let createdAutomationIds = [];

    beforeAll(async () => {
        db = knex(buildRawPgConfig());
        await db.raw(`CREATE SCHEMA IF NOT EXISTS ${schemaName}`);
        await db.raw(`SET search_path TO ${schemaName}`);
        // The first migrate.latest() call may throw "request for 'dotenv' is from a
        // module not been linked" — a pre-existing Jest ESM VM issue (affects the first
        // dynamic import of any migration that uses env-config.js → dotenv). After the
        // first call, dotenv is registered in the module cache and the retry succeeds.
        try {
            await db.migrate.latest();
        } catch {
            await db.migrate.latest();
        }
        // Run seeds to populate base data: global role, system users, and shift
        // management needed for FK constraints and entity executor currentUser lookup.
        await db.seed.run();
        actionRepository = new KnexActionRepository(db);
        groupsRepository = new KnexGroupsRepository(db);
        shiftManagementRepository = new KnexShiftManagementRepository(db);
        automationSettingsRepository = new KnexAutomationSettingsRepository(db);
    });

    afterEach(async () => {
        if (createdActionIds.length) {
            await db('actions').whereIn('id', createdActionIds).delete();
            createdActionIds = [];
        }
        if (createdGroupIds.length) {
            await db('grupos').whereIn('id', createdGroupIds).delete();
            createdGroupIds = [];
        }
        if (createdAutomationIds.length) {
            await db('automation_settings').whereIn('id', createdAutomationIds).delete();
            createdAutomationIds = [];
        }
    });

    afterAll(async () => {
        await db.raw(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);
        await db.destroy();
    });

    it('executes a cron_job group action exactly once for the matching active group', async () => {
        const active = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository, {
            status: 1,
            nombre: 'TargetGroup',
            created_by: globalUserId,
        });
        const inactive = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository, {
            status: 2,
            nombre: 'TargetGroup',
            created_by: globalUserId,
        });
        createdGroupIds.push(active.id.value, inactive.id.value);

        const automation = await AutomationSettingsMother.create(automationSettingsRepository, {
            created_by: globalUserId,
        });
        createdAutomationIds.push(automation.id.value);

        const action = await ActionMother.create(actionRepository, {
            entity: 'group',
            triggers: [ActionTriggers.CRON_JOB.value],
            action_type: ActionTypes.CONSUMO_REST_FLOW.value,
            is_active: true,
            automation_id: automation.id.value,
            conditions: {
                combinator: 'and',
                rules: [{ field: 'nombre', operator: RuleOperator.EQUALS, value: 'TargetGroup', type: 'manual_input' }],
            },
        });
        createdActionIds.push(action.id.value);

        const result = await new GroupsActionsJob().run(tenant);

        expect(result.matched).toBe(1);
        expect(result.executed).toBe(1);
        expect(result.failed).toBe(0);
    });

    it('ignores user-entity actions', async () => {
        const g1 = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository, {
            status: 1,
            nombre: 'AnyGroup',
            created_by: globalUserId,
        });
        createdGroupIds.push(g1.id.value);

        const automation = await AutomationSettingsMother.create(automationSettingsRepository, {
            created_by: globalUserId,
        });
        createdAutomationIds.push(automation.id.value);

        const userAction = await ActionMother.create(actionRepository, {
            entity: 'user',
            triggers: [ActionTriggers.CRON_JOB.value],
            action_type: ActionTypes.CONSUMO_REST_FLOW.value,
            is_active: true,
            automation_id: automation.id.value,
        });
        createdActionIds.push(userAction.id.value);

        const result = await new GroupsActionsJob().run(tenant);

        expect(result.processed).toBe(0);
    });

    it('skips actions whose automation cron does not match the current minute', async () => {
        const g1 = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository, {
            status: 1,
            nombre: 'TargetGroup',
            created_by: globalUserId,
        });
        createdGroupIds.push(g1.id.value);

        const now = new Date();
        const otherMinute = (now.getMinutes() + 30) % 60;
        const automation = await AutomationSettingsMother.create(automationSettingsRepository, {
            frequency: `${otherMinute} * * * *`,
            created_by: globalUserId,
        });
        createdAutomationIds.push(automation.id.value);

        const action = await ActionMother.create(actionRepository, {
            entity: 'group',
            triggers: [ActionTriggers.CRON_JOB.value],
            action_type: ActionTypes.CONSUMO_REST_FLOW.value,
            is_active: true,
            automation_id: automation.id.value,
            conditions: {
                combinator: 'and',
                rules: [{ field: 'nombre', operator: RuleOperator.EQUALS, value: 'TargetGroup', type: 'manual_input' }],
            },
        });
        createdActionIds.push(action.id.value);

        const result = await new GroupsActionsJob().run(tenant);

        expect(result).toEqual({ processed: 0, matched: 0, executed: 0, failed: 0 });
    });
});
