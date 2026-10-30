import { Construct } from 'constructs';
import { KApiStack, KApiStackProps } from '@kace/aws-infra/src/KApiStack';
import { getDbTarget } from '@kace/aws-infra/src/dbRoutingEnv';
import { StackProps, aws_apigateway, aws_lambda_nodejs } from 'aws-cdk-lib';

export class ActionUpdateModelStack extends KApiStack {
    constructor(scope: Construct, id: string, props: StackProps, kProps: KApiStackProps) {
        super(scope, id, props, kProps);

        this.setDefaultOptions('action-update-model');
    }

    setDefaultOptions(id: string, extraEnv: Record<string, string> = {}): aws_lambda_nodejs.NodejsFunction {
        const lambdaFunction = this.getNodejsFunction(id);

        lambdaFunction.addEnvironment('DB_TARGET', getDbTarget(id));

        for (const [key, value] of Object.entries(extraEnv)) {
            lambdaFunction.addEnvironment(key, value);
        }

        const lambdaRestApi = this.getLambdaRestApi(id, lambdaFunction);
        const methodOptions = this.getLambdaRestApiMethodOptions();
        this.setDefaultResources(lambdaRestApi, methodOptions);
        this.setBasePath(id, lambdaRestApi);
        this.setWafAssociation(lambdaRestApi);
        this.grantDynamoDbPermissions(id, lambdaFunction);
        this.addCustomRoutes(lambdaRestApi, lambdaFunction);

        return lambdaFunction;
    }

    addCustomRoutes(lambdaRestApi: aws_apigateway.LambdaRestApi, methodOptions?: aws_lambda_nodejs.NodejsFunction) {
        this.addCustomRoute(lambdaRestApi, 'GET', 'types', methodOptions);
        this.addCustomRoute(lambdaRestApi, 'GET', 'formulas', methodOptions);
        this.addCustomRoute(lambdaRestApi, 'GET', 'aggregates', methodOptions);
        this.addCustomRoute(lambdaRestApi, 'GET', 'customer-fields', methodOptions);
        this.addCustomRoute(lambdaRestApi, 'GET', 'case-fields', methodOptions);
    }

    addCustomRoute(
        lambdaRestApi: aws_apigateway.LambdaRestApi,
        method: string,
        resource: string,
        methodOptions?: aws_apigateway.MethodOptions | aws_lambda_nodejs.NodejsFunction
    ) {
        const customResource = lambdaRestApi.root.addResource(resource);

        const integration =
            methodOptions instanceof aws_lambda_nodejs.NodejsFunction
                ? new aws_apigateway.LambdaIntegration(methodOptions)
                : undefined;

        const options = methodOptions instanceof aws_lambda_nodejs.NodejsFunction ? undefined : methodOptions;

        customResource.addMethod(method, integration, options);
    }
}
