import { StackProps, Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { KApiStack, KApiStackProps } from '@kace/aws-infra/src/KApiStack';
import { OrchestratorHelper } from '@kace/aws-infra/src/helpers/OrchestratorHelper';
import { Rule, Schedule } from 'aws-cdk-lib/aws-events';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';

export class ImportsProcessorStack extends KApiStack {
    // 12 min: Allows processing the maximum possible number of records per tenant import batch.
    // Value also adjusted to accommodate recent breaking changes.
    static readonly LAMBDA_SECONDS_TIMEOUT = 720;

    constructor(scope: Construct, id: string, props: StackProps, kProps: KApiStackProps) {
        super(scope, id, props, kProps);

        const endpoint = 'imports-processor';

        const lambdaFunction = this.getNodejsFunction(endpoint);
        this.grantDynamoDbPermissions(id, lambdaFunction);

        // EventBridge Orchestrator Lambda para multi-tenant (red de seguridad para el camino reactivo)
        const orchestratorFunction = OrchestratorHelper.createOrchestrator({
            endpoint,
            targetLambdaArn: lambdaFunction.functionArn,
            scope: this,
            // 5 min is enough since orchestrator invokes target Lambda asynchronously (Event)
            timeoutMinutes: 5,
            suffix: this.config.appsServiceName,
        });

        // EventBridge Schedule invoca el orchestrator para reconciliación periódica
        const scheduleRule = new Rule(this, `${endpoint}ScheduleRule`, {
            schedule: Schedule.expression(`cron(${kProps.importCron})`),
            description: 'Imports reconciliation sweep (safety net for the reactive path)',
        });

        scheduleRule.addTarget(new LambdaFunction(orchestratorFunction));
    }

    nodejsFunctionDefaultProps() {
        const baseProps = super.nodejsFunctionDefaultProps();
        return {
            ...baseProps,
            timeout: Duration.seconds(ImportsProcessorStack.LAMBDA_SECONDS_TIMEOUT),
        };
    }
}
