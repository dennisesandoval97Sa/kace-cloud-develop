import { describe, expect, it, jest } from '@jest/globals';
import { configureWorkspacePriorityOutboxRecovery } from '../../src/ws-rest/configureWorkspacePriorityOutboxRecovery.mjs';

describe('configureWorkspacePriorityOutboxRecovery', () => {
    it('targets the tenant orchestrator every minute and grants the recovery publisher its queue and bus access', () => {
        const recoveryLambda = { functionArn: 'arn:aws:lambda:recovery' };
        const orchestrator = { functionArn: 'arn:aws:lambda:orchestrator' };
        const addTarget = jest.fn();
        const Rule = jest.fn().mockImplementation((_scope, _id, options) => ({ options, addTarget }));
        const LambdaTarget = jest.fn().mockImplementation((target) => ({ target }));
        const wsRestQueue = { grantSendMessages: jest.fn() };
        const eventBus = { grantPutEventsTo: jest.fn() };
        const getNodejsFunction = jest.fn().mockReturnValue(recoveryLambda);
        const grantDynamoDbPermissions = jest.fn();
        const createOrchestrator = jest.fn().mockReturnValue(orchestrator);
        const scheduleExpression = jest.fn().mockReturnValue({ expression: 'every-minute' });
        const durationSeconds = jest.fn().mockReturnValue({ seconds: 60 });
        const scope = { stack: 'event-processor' };

        const result = configureWorkspacePriorityOutboxRecovery({
            scope,
            endpoint: 'event-processor',
            appsServiceName: 'kace-dev',
            wsRestQueue,
            eventBus,
            getNodejsFunction,
            grantDynamoDbPermissions,
            createOrchestrator,
            Rule,
            scheduleExpression,
            LambdaTarget,
            durationSeconds,
        });

        expect(getNodejsFunction).toHaveBeenCalledWith('event-processor-workspace-priority-outbox-recovery', {
            entry: 'src/ws-rest/outboxRecoveryHandler.mjs',
            timeout: { seconds: 60 },
            memorySize: 512,
        });
        expect(grantDynamoDbPermissions).toHaveBeenCalledWith('WorkspacePriorityOutboxRecovery', recoveryLambda);
        expect(wsRestQueue.grantSendMessages).toHaveBeenCalledWith(recoveryLambda);
        expect(eventBus.grantPutEventsTo).toHaveBeenCalledWith(recoveryLambda);
        expect(createOrchestrator).toHaveBeenCalledWith({
            endpoint: 'event-processor-workspace-priority-outbox-recovery',
            targetLambdaArn: recoveryLambda.functionArn,
            scope,
            suffix: 'kace-dev',
        });
        expect(scheduleExpression).toHaveBeenCalledWith('cron(* * * * ? *)');
        expect(Rule).toHaveBeenCalledWith(scope, 'WorkspacePriorityOutboxRecoverySchedule', {
            schedule: { expression: 'every-minute' },
            description: 'Publishes staged Channel Hub workspace priority reorder events for every tenant',
        });
        expect(LambdaTarget).toHaveBeenCalledWith(orchestrator);
        expect(addTarget).toHaveBeenCalledWith({ target: orchestrator });
        expect(result).toEqual({
            recoveryLambda,
            orchestrator,
            recoverySchedule: expect.objectContaining({ addTarget }),
        });
    });
});
