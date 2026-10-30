import { jest } from '@jest/globals';

import { LambdaDebugService } from '../src/services/LambdaDebugService.mjs';
import { DebugScheduler, SCHEDULE_SOURCE_MARKER } from '../src/services/DebugScheduler.mjs';
import { schemaEnable, schemaDisable } from '../src/schemas.mjs';

const buildLambdaClient = (overrides = {}) => {
    const send = jest.fn(async (command) => {
        const name = command.constructor.name;
        if (overrides[name]) return overrides[name](command);
        if (name === 'GetFunctionConfigurationCommand') {
            return {
                Environment: {
                    Variables: {
                        APPS_DEBUG: 'false',
                        APPS_DEBUG_LEVEL: '1',
                        DB_HOST: 'irrelevant.example',
                        OTHER_FLAG: 'keep-me',
                    },
                },
            };
        }
        if (name === 'UpdateFunctionConfigurationCommand') return {};
        throw new Error(`Unmocked command: ${name}`);
    });
    return { send };
};

// CloudFormation mock: by default the stack contains a single AWS::Lambda::Function
// whose PhysicalResourceId is the (non-truncated) real function name.
const buildCfnClient = (overrides = {}) => {
    const send = jest.fn(async (command) => {
        const name = command.constructor.name;
        if (overrides[name]) return overrides[name](command);
        if (name === 'ListStackResourcesCommand') {
            return {
                StackResourceSummaries: [
                    { ResourceType: 'AWS::ApiGateway::RestApi', LogicalResourceId: 'api', PhysicalResourceId: 'abc' },
                    {
                        ResourceType: 'AWS::Lambda::Function',
                        LogicalResourceId: 'userslambda1A2B',
                        PhysicalResourceId: 'DEVAPIUsersStack-users_lambda1A2B',
                    },
                ],
            };
        }
        throw new Error(`Unmocked command: ${name}`);
    });
    return { send };
};

const validationError = (msg = 'Stack does not exist') => Object.assign(new Error(msg), { name: 'ValidationError' });

const buildSchedulerClient = (overrides = {}) => {
    const send = jest.fn(async (command) => {
        const name = command.constructor.name;
        if (overrides[name]) return overrides[name](command);
        return {};
    });
    return { send };
};

describe('LambdaDebugService.normalizeTarget', () => {
    const service = new LambdaDebugService({
        client: buildLambdaClient(),
        cfnClient: buildCfnClient(),
        serviceName: 'DEVAPI',
    });

    test.each([
        ['UsersStack', 'usersstack'],
        ['Users', 'users'],
        ['users', 'users'],
        ['ActionBatchExecutionStack', 'actionbatchexecutionstack'],
        ['  UsersStack  ', 'usersstack'],
    ])('"%s" → "%s"', (input, expected) => {
        expect(service.normalizeTarget(input)).toBe(expected);
    });
});

describe('LambdaDebugService.resolveFunctionName', () => {
    test('resolves the single Lambda PhysicalResourceId from the stack', async () => {
        let requestedStack;
        const cfnClient = buildCfnClient({
            ListStackResourcesCommand: async (cmd) => {
                requestedStack = cmd.input.StackName;
                return {
                    StackResourceSummaries: [
                        {
                            ResourceType: 'AWS::Lambda::Function',
                            LogicalResourceId: 'actionjobslambdaBBBB',
                            PhysicalResourceId: 'DEVAPIActionBatchExe-actionjobslambda5B8F1017-R4oOfpx82K65',
                        },
                    ],
                };
            },
        });
        const service = new LambdaDebugService({ client: buildLambdaClient(), cfnClient, serviceName: 'DEVAPI' });
        const fn = await service.resolveFunctionName('ActionBatchExecutionStack');
        expect(fn).toBe('DEVAPIActionBatchExe-actionjobslambda5B8F1017-R4oOfpx82K65');
        // stack name = serviceName + StackId (drives the CFN lookup)
        expect(requestedStack).toBe('DEVAPIActionBatchExecutionStack');
    });

    test('ignores CDK helper Lambdas (LogRetention) and resolves the main handler', async () => {
        const cfnClient = buildCfnClient({
            ListStackResourcesCommand: async () => ({
                StackResourceSummaries: [
                    {
                        ResourceType: 'AWS::Lambda::Function',
                        LogicalResourceId: 'LogRetentionaaaabbbb',
                        PhysicalResourceId: 'DEVAPIUsersStack-LogRetention1234',
                    },
                    {
                        ResourceType: 'AWS::Lambda::Function',
                        LogicalResourceId: 'userslambda1A2B',
                        PhysicalResourceId: 'DEVAPIUsersStack-users_lambda1A2B',
                    },
                ],
            }),
        });
        const service = new LambdaDebugService({ client: buildLambdaClient(), cfnClient, serviceName: 'DEVAPI' });
        await expect(service.resolveFunctionName('UsersStack')).resolves.toBe('DEVAPIUsersStack-users_lambda1A2B');
    });

    test('404 when the stack does not exist (CFN ValidationError)', async () => {
        const cfnClient = buildCfnClient({
            ListStackResourcesCommand: async () => {
                throw validationError();
            },
        });
        const service = new LambdaDebugService({ client: buildLambdaClient(), cfnClient, serviceName: 'DEVAPI' });
        await expect(service.resolveFunctionName('NopeStack')).rejects.toMatchObject({ statusCode: 404 });
    });

    test('404 when the stack has no Lambda resource', async () => {
        const cfnClient = buildCfnClient({
            ListStackResourcesCommand: async () => ({
                StackResourceSummaries: [
                    { ResourceType: 'AWS::ApiGateway::RestApi', LogicalResourceId: 'api', PhysicalResourceId: 'x' },
                ],
            }),
        });
        const service = new LambdaDebugService({ client: buildLambdaClient(), cfnClient, serviceName: 'DEVAPI' });
        await expect(service.resolveFunctionName('UsersStack')).rejects.toMatchObject({ statusCode: 404 });
    });

    test('409 when the stack has more than one (non-helper) Lambda', async () => {
        const cfnClient = buildCfnClient({
            ListStackResourcesCommand: async () => ({
                StackResourceSummaries: [
                    {
                        ResourceType: 'AWS::Lambda::Function',
                        LogicalResourceId: 'oneLambda',
                        PhysicalResourceId: 'DEVAPIUsersStack-one',
                    },
                    {
                        ResourceType: 'AWS::Lambda::Function',
                        LogicalResourceId: 'twoLambda',
                        PhysicalResourceId: 'DEVAPIUsersStack-two',
                    },
                ],
            }),
        });
        const service = new LambdaDebugService({ client: buildLambdaClient(), cfnClient, serviceName: 'DEVAPI' });
        await expect(service.resolveFunctionName('UsersStack')).rejects.toMatchObject({ statusCode: 409 });
    });

    test('paginates ListStackResources via NextToken', async () => {
        let calls = 0;
        const cfnClient = buildCfnClient({
            ListStackResourcesCommand: async (cmd) => {
                calls += 1;
                if (!cmd.input.NextToken) {
                    return {
                        StackResourceSummaries: [
                            {
                                ResourceType: 'AWS::ApiGateway::RestApi',
                                LogicalResourceId: 'api',
                                PhysicalResourceId: 'x',
                            },
                        ],
                        NextToken: 'page2',
                    };
                }
                return {
                    StackResourceSummaries: [
                        {
                            ResourceType: 'AWS::Lambda::Function',
                            LogicalResourceId: 'userslambda1A2B',
                            PhysicalResourceId: 'DEVAPIUsersStack-users_lambda1A2B',
                        },
                    ],
                };
            },
        });
        const service = new LambdaDebugService({ client: buildLambdaClient(), cfnClient, serviceName: 'DEVAPI' });
        await expect(service.resolveFunctionName('UsersStack')).resolves.toBe('DEVAPIUsersStack-users_lambda1A2B');
        expect(calls).toBe(2);
    });

    test('caches result across calls (one CFN lookup per stack)', async () => {
        const cfnClient = buildCfnClient();
        const service = new LambdaDebugService({ client: buildLambdaClient(), cfnClient, serviceName: 'DEVAPI' });
        await service.resolveFunctionName('UsersStack');
        await service.resolveFunctionName('UsersStack');
        const listCalls = cfnClient.send.mock.calls.filter(
            (c) => c[0].constructor.name === 'ListStackResourcesCommand'
        );
        expect(listCalls).toHaveLength(1);
    });
});

describe('LambdaDebugService.enable / disable', () => {
    test('enable preserves existing env and only changes APPS_DEBUG/APPS_DEBUG_LEVEL', async () => {
        let updatedVars;
        const client = buildLambdaClient({
            UpdateFunctionConfigurationCommand: async (cmd) => {
                updatedVars = cmd.input.Environment.Variables;
                return {};
            },
        });
        const service = new LambdaDebugService({ client, cfnClient: buildCfnClient(), serviceName: 'DEVAPI' });
        const result = await service.enable('users', 2);

        expect(result.fnName).toBe('DEVAPIUsersStack-users_lambda1A2B');
        expect(result.previousAppsDebug).toBe('false');
        expect(updatedVars).toEqual({
            APPS_DEBUG: 'true',
            APPS_DEBUG_LEVEL: '2',
            DB_HOST: 'irrelevant.example',
            OTHER_FLAG: 'keep-me',
        });
    });

    test('enable level defaults to 1 when not 2', async () => {
        let updatedVars;
        const client = buildLambdaClient({
            UpdateFunctionConfigurationCommand: async (cmd) => {
                updatedVars = cmd.input.Environment.Variables;
                return {};
            },
        });
        const service = new LambdaDebugService({ client, cfnClient: buildCfnClient(), serviceName: 'DEVAPI' });
        await service.enable('users');
        expect(updatedVars.APPS_DEBUG_LEVEL).toBe('1');
    });

    test('disable fixes APPS_DEBUG=false and APPS_DEBUG_LEVEL=1 while preserving other vars', async () => {
        let updatedVars;
        const client = buildLambdaClient({
            GetFunctionConfigurationCommand: async () => ({
                Environment: {
                    Variables: {
                        APPS_DEBUG: 'true',
                        APPS_DEBUG_LEVEL: '2',
                        DB_HOST: 'irrelevant.example',
                        OTHER_FLAG: 'keep-me',
                    },
                },
            }),
            UpdateFunctionConfigurationCommand: async (cmd) => {
                updatedVars = cmd.input.Environment.Variables;
                return {};
            },
        });
        const service = new LambdaDebugService({ client, cfnClient: buildCfnClient(), serviceName: 'DEVAPI' });
        await service.disable('users');
        expect(updatedVars).toEqual({
            APPS_DEBUG: 'false',
            APPS_DEBUG_LEVEL: '1',
            DB_HOST: 'irrelevant.example',
            OTHER_FLAG: 'keep-me',
        });
    });
});

describe('DebugScheduler', () => {
    test('scheduleName is deterministic per target', () => {
        const sched = new DebugScheduler({
            client: buildSchedulerClient(),
            lambdaArn: 'arn:lambda',
            roleArn: 'arn:role',
            groupName: 'default',
        });
        expect(sched.scheduleName('users')).toBe('debug-disable-users');
        expect(sched.scheduleName('action-batch-executions')).toBe('debug-disable-action-batch-executions');
    });

    test('scheduleDisable creates, falls back to UpdateSchedule on ConflictException', async () => {
        const calls = [];
        const conflictErr = Object.assign(new Error('exists'), { name: 'ConflictException' });
        const client = buildSchedulerClient({
            CreateScheduleCommand: async (cmd) => {
                calls.push(['create', cmd.input.Name]);
                throw conflictErr;
            },
            UpdateScheduleCommand: async (cmd) => {
                calls.push(['update', cmd.input.Name]);
                return {};
            },
        });
        const sched = new DebugScheduler({
            client,
            lambdaArn: 'arn:lambda',
            roleArn: 'arn:role',
            groupName: 'default',
        });
        const result = await sched.scheduleDisable('users', 15);
        expect(calls).toEqual([
            ['create', 'debug-disable-users'],
            ['update', 'debug-disable-users'],
        ]);
        expect(result.expiresAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
        expect(result.scheduleName).toBe('debug-disable-users');
    });

    test('scheduleDisable payload routes to SCHEDULE_SOURCE_MARKER, target and tenantId', async () => {
        let createdInput;
        const client = buildSchedulerClient({
            CreateScheduleCommand: async (cmd) => {
                createdInput = JSON.parse(cmd.input.Target.Input);
                return {};
            },
        });
        const sched = new DebugScheduler({
            client,
            lambdaArn: 'arn:lambda',
            roleArn: 'arn:role',
            groupName: 'default',
        });
        await sched.scheduleDisable('users', 5, 'acme');
        expect(createdInput).toEqual({ source: SCHEDULE_SOURCE_MARKER, target: 'users', tenantId: 'acme' });
    });

    test('payload carries the original Stack id (not the kebab) so the scheduled disable resolves the right stack', async () => {
        let created;
        const client = buildSchedulerClient({
            CreateScheduleCommand: async (cmd) => {
                created = { name: cmd.input.Name, input: JSON.parse(cmd.input.Target.Input) };
                return {};
            },
        });
        const sched = new DebugScheduler({
            client,
            lambdaArn: 'arn:lambda',
            roleArn: 'arn:role',
            groupName: 'default',
        });
        await sched.scheduleDisable('usersstack', 5, 'acme', 'UsersStack');
        expect(created.name).toBe('debug-disable-usersstack');
        expect(created.input).toEqual({ source: SCHEDULE_SOURCE_MARKER, target: 'UsersStack', tenantId: 'acme' });
    });

    test('scheduleDisable defaults tenantId to null when not provided', async () => {
        let createdInput;
        const client = buildSchedulerClient({
            CreateScheduleCommand: async (cmd) => {
                createdInput = JSON.parse(cmd.input.Target.Input);
                return {};
            },
        });
        const sched = new DebugScheduler({
            client,
            lambdaArn: 'arn:lambda',
            roleArn: 'arn:role',
            groupName: 'default',
        });
        await sched.scheduleDisable('users', 5);
        expect(createdInput).toEqual({ source: SCHEDULE_SOURCE_MARKER, target: 'users', tenantId: null });
    });

    test('cancelPending returns canceled:false on ResourceNotFoundException', async () => {
        const notFound = Object.assign(new Error('missing'), { name: 'ResourceNotFoundException' });
        const client = buildSchedulerClient({
            DeleteScheduleCommand: async () => {
                throw notFound;
            },
        });
        const sched = new DebugScheduler({
            client,
            lambdaArn: 'arn:lambda',
            roleArn: 'arn:role',
            groupName: 'default',
        });
        await expect(sched.cancelPending('users')).resolves.toEqual({ canceled: false });
    });

    test('getPending returns expiresAt parsed from ScheduleExpression', async () => {
        const client = buildSchedulerClient({
            GetScheduleCommand: async () => ({ ScheduleExpression: 'at(2026-05-28T12:34:56)' }),
        });
        const sched = new DebugScheduler({
            client,
            lambdaArn: 'arn:lambda',
            roleArn: 'arn:role',
            groupName: 'default',
        });
        const { expiresAt } = await sched.getPending('users');
        expect(expiresAt).toBe('2026-05-28T12:34:56.000Z');
    });
});

describe('Joi schemas', () => {
    test('schemaEnable accepts stack-id forms and rejects package-name forms', () => {
        for (const target of ['UsersStack', 'Users', 'users']) {
            const { error } = schemaEnable.validate({ target, minutes: 15 });
            expect(error).toBeUndefined();
        }
        for (const target of ['@kace/api-users', 'api-users', 'action-batch-executions']) {
            const { error } = schemaEnable.validate({ target, minutes: 15 });
            expect(error).toBeDefined();
        }
    });

    test('schemaEnable rejects minutes out of range', () => {
        expect(schemaEnable.validate({ target: 'users', minutes: 0 }).error).toBeDefined();
        expect(schemaEnable.validate({ target: 'users', minutes: 61 }).error).toBeDefined();
        expect(schemaEnable.validate({ target: 'users', minutes: 15 }).error).toBeUndefined();
    });

    test('schemaEnable level defaults to 1 and rejects other values', () => {
        const { value, error } = schemaEnable.validate({ target: 'users', minutes: 5 });
        expect(error).toBeUndefined();
        expect(value.level).toBe(1);
        expect(schemaEnable.validate({ target: 'users', minutes: 5, level: 3 }).error).toBeDefined();
    });

    test('schemaDisable rejects extra keys', () => {
        const { error } = schemaDisable.validate({ target: 'users', minutes: 5 });
        expect(error).toBeDefined();
    });
});
