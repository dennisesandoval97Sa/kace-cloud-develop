import { Construct } from 'constructs';
import { KApiStack, KApiStackProps } from '@kace/aws-infra/src/KApiStack';
import { OrchestratorHelper } from '@kace/aws-infra/src/helpers/OrchestratorHelper';
import { StackProps } from 'aws-cdk-lib';
import { Rule, Schedule } from 'aws-cdk-lib/aws-events';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';

export class DashboardCountsRefreshStack extends KApiStack {
    constructor(scope: Construct, id: string, props: StackProps, kProps: KApiStackProps) {
        super(scope, id, props, kProps);

        const path = 'dashboard-counts-refresh';

        const lambdaFunction = this.getNodejsFunction(path);

        const lambdaRestApi = this.getLambdaRestApi(path, lambdaFunction);

        const methodOptions = this.getLambdaRestApiMethodOptions();

        this.setDefaultResources(lambdaRestApi, methodOptions);

        this.setBasePath(path, lambdaRestApi);
        this.setWafAssociation(lambdaRestApi);
        this.grantDynamoDbPermissions(path, lambdaFunction);

        // EventBridge Orchestrator Lambda para multi-tenant
        const orchestratorFunction = OrchestratorHelper.createOrchestrator({
            endpoint: path,
            targetLambdaArn: lambdaFunction.functionArn,
            scope: this,
            suffix: this.config.appsServiceName,
        });

        // EventBridge Schedule invoca el orchestrator (no el handler principal)
        const scheduleRule = new Rule(this, `${path}ScheduleRule`, {
            schedule: Schedule.expression('cron(* * * * ? *)'), // Cada minuto
            description: 'Multi-tenant dashboard count matview refresh (via orchestrator)',
        });

        scheduleRule.addTarget(new LambdaFunction(orchestratorFunction));
    }
}
