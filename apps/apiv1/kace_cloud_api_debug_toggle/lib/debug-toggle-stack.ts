import { Construct } from 'constructs';
import { KApiStack, KApiStackProps } from '@kace/aws-infra/src/KApiStack';
import { StackProps } from 'aws-cdk-lib';
import { NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Effect, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';

export class DebugToggleStack extends KApiStack {
    constructor(scope: Construct, id: string, props: StackProps, kProps: KApiStackProps) {
        super(scope, id, props, kProps);

        const path = 'debug-toggle';
        const lambdaFunction = this.getNodejsFunction(path);
        const lambdaRestApi = this.getLambdaRestApi(path, lambdaFunction);
        const methodOptions = this.getLambdaRestApiMethodOptions();

        const root = lambdaRestApi.root;
        root.addResource('enable').addMethod('POST', undefined, methodOptions);
        root.addResource('disable').addMethod('POST', undefined, methodOptions);
        const statusResource = root.addResource('status');
        statusResource.addResource('{target}').addMethod('GET', undefined, methodOptions);

        this.setBasePath(path, lambdaRestApi);
        this.setWafAssociation(lambdaRestApi);
        this.grantDynamoDbPermissions(id, lambdaFunction);

        // The base grant is read-only; this API also resets the tenant `apps_debug`
        // flag on disable via a surgical UpdateItem (see TenantDebugFlag) — no PutItem,
        // so existing tenant attributes are never replaced/dropped.
        lambdaFunction.addToRolePolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: ['dynamodb:UpdateItem'],
                resources: [this.config.awsDynamoDbMultitenantTableARN],
            })
        );

        const region = this.region;
        const account = this.account;
        const serviceName = this.config.appsServiceName;
        const managedLambdaArnPrefix = `arn:aws:lambda:${region}:${account}:function:${serviceName}*`;

        // The target Lambda is resolved via CloudFormation (the physical name is
        // truncated by CFN, so name-based ListFunctions matching is unreliable).
        lambdaFunction.addToRolePolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: ['cloudformation:ListStackResources', 'cloudformation:DescribeStacks'],
                resources: [`arn:aws:cloudformation:${region}:${account}:stack/${serviceName}*/*`],
            })
        );
        lambdaFunction.addToRolePolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: ['lambda:GetFunctionConfiguration', 'lambda:UpdateFunctionConfiguration'],
                resources: [managedLambdaArnPrefix],
            })
        );

        // A deterministic roleName lets us build the role ARN as a plain string
        // below, instead of using schedulerRole.roleArn (an Fn::GetAtt). That
        // breaks the Lambda -> Role dependency edge: grantInvoke() already makes
        // the role's policy depend on the Lambda, and referencing the role ARN
        // back from the Lambda env / PassRole would close a circular dependency.
        const schedulerRoleName = `${serviceName}-debug-toggle-scheduler`;
        const schedulerRole = new Role(this, 'DebugToggleSchedulerRole', {
            roleName: schedulerRoleName,
            assumedBy: new ServicePrincipal('scheduler.amazonaws.com'),
            description: 'Allows EventBridge Scheduler to invoke the debug-toggle Lambda for delayed disables',
        });
        const schedulerRoleArn = `arn:aws:iam::${account}:role/${schedulerRoleName}`;
        lambdaFunction.grantInvoke(schedulerRole);

        lambdaFunction.addToRolePolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: [
                    'scheduler:CreateSchedule',
                    'scheduler:UpdateSchedule',
                    'scheduler:DeleteSchedule',
                    'scheduler:GetSchedule',
                ],
                resources: [`arn:aws:scheduler:${region}:${account}:schedule/default/debug-disable-*`],
            })
        );
        lambdaFunction.addToRolePolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: ['iam:PassRole'],
                resources: [schedulerRoleArn],
            })
        );

        lambdaFunction.addEnvironment('DEBUG_TOGGLE_SCHEDULER_ROLE_ARN', schedulerRoleArn);
        lambdaFunction.addEnvironment('DEBUG_TOGGLE_SCHEDULE_GROUP', 'default');
        lambdaFunction.addEnvironment('APPS_SERVICE_NAME', this.config.appsServiceName);
    }

    nodejsFunctionDefaultProps(): NodejsFunctionProps {
        const props = super.nodejsFunctionDefaultProps();
        return {
            ...props,
            memorySize: 256,
        };
    }
}
