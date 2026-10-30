import { Construct } from 'constructs';
import { KApiStack, KApiStackProps } from '@kace/aws-infra/src/KApiStack';
import { OrchestratorHelper } from '@kace/aws-infra/src/helpers/OrchestratorHelper';
import { getDbTarget } from '@kace/aws-infra/src/dbRoutingEnv';
import { StackProps, Duration } from 'aws-cdk-lib';
import { Schedule, Rule } from 'aws-cdk-lib/aws-events';
import { LambdaFunction as eventsTargets } from 'aws-cdk-lib/aws-events-targets';

export class GenerateCsvStack extends KApiStack {
    constructor(scope: Construct, id: string, props: StackProps, kProps: KApiStackProps) {
        super(scope, id, props, kProps);

        const endpoint = 'generate-csv';
        const lambdaFunction = this.getNodejsFunction(endpoint);

        // Route heavy view reads to the replica for ALL branches (REST + manual execute + cron worker).
        // Manual stack (no setDefaultOptions), so wire DB_TARGET explicitly.
        lambdaFunction.addEnvironment('DB_TARGET', getDbTarget('generate-csv'));

        const lambdaRestApi = this.getLambdaRestApi(endpoint, lambdaFunction);

        const methodOptions = this.getLambdaRestApiMethodOptions();

        this.setDefaultResources(lambdaRestApi, methodOptions);

        const idResource = lambdaRestApi.root.getResource('{id}') ?? lambdaRestApi.root.addResource('{id}');
        const executeResource = idResource.addResource('execute');
        executeResource.addMethod('GET', undefined, methodOptions);
        this.setBasePath(endpoint, lambdaRestApi);
        this.setWafAssociation(lambdaRestApi);
        this.grantDynamoDbPermissions(endpoint, lambdaFunction);

        // EventBridge Orchestrator Lambda para multi-tenant
        const orchestratorFunction = OrchestratorHelper.createOrchestrator({
            endpoint,
            targetLambdaArn: lambdaFunction.functionArn,
            scope: this,
            timeoutMinutes: 5,
            suffix: this.config.appsServiceName,
        });

        // EventBridge Schedule invoca el orchestrator (no el handler principal)
        const scheduleRule = new Rule(this, `${endpoint}ScheduleRule`, {
            schedule: Schedule.expression('cron(0 * * * ? *)'),
            description: 'Multi-tenant CSV generation (via orchestrator)',
        });

        scheduleRule.addTarget(new eventsTargets(orchestratorFunction));
    }
}
