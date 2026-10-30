import { Construct } from 'constructs';
import { KApiStack, KApiStackProps } from '@kace/aws-infra/src/KApiStack';
import { OrchestratorHelper } from '@kace/aws-infra/src/helpers/OrchestratorHelper';
import { StackProps } from 'aws-cdk-lib';
import { Rule, Schedule } from 'aws-cdk-lib/aws-events';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';

export class PartitionMaintenanceStack extends KApiStack {
    constructor(scope: Construct, id: string, props: StackProps, kProps: KApiStackProps) {
        super(scope, id, props, kProps);

        const path = 'partition-maintenance';

        const lambdaFunction = this.getNodejsFunction(path);
        const lambdaRestApi = this.getLambdaRestApi(path, lambdaFunction);
        const methodOptions = this.getLambdaRestApiMethodOptions();

        this.setDefaultResources(lambdaRestApi, methodOptions);
        this.setBasePath(path, lambdaRestApi);
        this.setWafAssociation(lambdaRestApi);
        this.grantDynamoDbPermissions(path, lambdaFunction);

        const orchestratorFunction = OrchestratorHelper.createOrchestrator({
            endpoint: path,
            targetLambdaArn: lambdaFunction.functionArn,
            scope: this,
            suffix: this.config.appsServiceName,
        });

        const scheduleRule = new Rule(this, `${path}ScheduleRule`, {
            schedule: Schedule.expression('cron(0 3 1 * ? *)'), // day 1 of each month at 03:00 UTC
            description: 'Multi-tenant monthly partition maintenance for ws_rest_flow_executions',
        });

        scheduleRule.addTarget(new LambdaFunction(orchestratorFunction));
    }
}
