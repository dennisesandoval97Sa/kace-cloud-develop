import type { Duration } from 'aws-cdk-lib';
import type { IEventBus, Rule, Schedule } from 'aws-cdk-lib/aws-events';
import type { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';
import type { NodejsFunction, NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs';
import type { IQueue } from 'aws-cdk-lib/aws-sqs';
import type { Construct } from 'constructs';
import type { OrchestratorConfig } from '@kace/aws-infra/src/helpers/OrchestratorHelper';

export interface WorkspacePriorityOutboxRecoveryDependencies {
    scope: Construct;
    endpoint: string;
    appsServiceName: string;
    wsRestQueue: IQueue;
    eventBus: IEventBus;
    getNodejsFunction(name: string, options: Partial<NodejsFunctionProps>): NodejsFunction;
    grantDynamoDbPermissions(id: string, target: NodejsFunction): void;
    createOrchestrator(options: OrchestratorConfig): NodejsFunction;
    Rule: typeof Rule;
    scheduleExpression(expression: string): Schedule;
    LambdaTarget: typeof LambdaFunction;
    durationSeconds(seconds: number): Duration;
}

export function configureWorkspacePriorityOutboxRecovery(dependencies: WorkspacePriorityOutboxRecoveryDependencies): {
    recoveryLambda: NodejsFunction;
    orchestrator: NodejsFunction;
    recoverySchedule: Rule;
};
