import { Construct } from 'constructs';
import { KApiStack, KApiStackProps } from '@kace/aws-infra/src/KApiStack';
import { OrchestratorHelper } from '@kace/aws-infra/src/helpers/OrchestratorHelper';
import { StackProps, Duration } from 'aws-cdk-lib';
import { Rule, Schedule } from 'aws-cdk-lib/aws-events';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';

export class AnsCalculateStack extends KApiStack {
    constructor(scope: Construct, id: string, props: StackProps, kProps: KApiStackProps) {
        super(scope, id, props, kProps);

        const path = 'ans-calculate';

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
            suffix: this.config.appsServiceName
        });

        // EventBridge Schedule invoca el orchestrator (no el handler principal)
        const scheduleRule = new Rule(this, `${path}ScheduleRule`, {
            schedule: Schedule.expression('cron(*/5 * * * ? *)'), // Cada 5 minutos
            description: 'Multi-tenant ANS calculation (via orchestrator)',
        });

        scheduleRule.addTarget(new LambdaFunction(orchestratorFunction));
    }
}
