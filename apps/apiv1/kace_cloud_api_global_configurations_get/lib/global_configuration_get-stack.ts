import { Construct } from 'constructs';
import { KApiStack, KApiStackProps } from '@kace/aws-infra/src/KApiStack';
import { getDbTarget } from '@kace/aws-infra/src/dbRoutingEnv';
import { StackProps } from 'aws-cdk-lib';

export class GlobalConfigurationGetStack extends KApiStack {
    constructor(scope: Construct, id: string, props: StackProps, kProps: KApiStackProps) {
        super(scope, id, props, kProps);

        const path = 'global-configuration-get';
        const lambdaFunction = this.getNodejsFunction(path);
        lambdaFunction.addEnvironment('DB_TARGET', getDbTarget(path));
        const lambdaRestApi = this.getLambdaRestApi(path, lambdaFunction);
        const methodOptions = this.getLambdaRestApiMethodOptions();

        const resource = lambdaRestApi.root.addResource('{id}');

        resource?.addMethod('GET', undefined, {
            ...methodOptions,
            requestParameters: {
                'method.request.path.id': true,
                'method.request.querystring.type': true,
                'method.request.querystring.application': true,
                'method.request.querystring.module': true,
            },
            requestValidatorOptions: {
                validateRequestBody: true,
                validateRequestParameters: true,
            },
        });

        this.setBasePath(path, lambdaRestApi);
        this.setWafAssociation(lambdaRestApi);
        this.grantDynamoDbPermissions(path, lambdaFunction);
    }
}
