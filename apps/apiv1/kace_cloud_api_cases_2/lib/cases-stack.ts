import { StackProps, aws_apigateway } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { KApiStack, KApiStackProps } from '@kace/aws-infra/src/KApiStack';
import { getDbTarget } from '@kace/aws-infra/src/dbRoutingEnv';
import { NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs';

export class CasesStack extends KApiStack {
    constructor(scope: Construct, id: string, props: StackProps, kProps: KApiStackProps) {
        super(scope, id, props, kProps);

        const path = 'cases2';

        const lambdaFunction = this.getNodejsFunction(path);
        lambdaFunction.addEnvironment('DB_TARGET', getDbTarget(path));
        lambdaFunction.addEnvironment('SQL_GUARD_MODE', 'observe');
        const lambdaRestApi = this.getLambdaRestApi(path, lambdaFunction);
        const methodOptions = this.getLambdaRestApiMethodOptions();

        this.setDefaultResources(lambdaRestApi, methodOptions);
        this.setBasePath(path, lambdaRestApi);
        this.setWafAssociation(lambdaRestApi);
        this.grantDynamoDbPermissions(path, lambdaFunction);
        this.grantEventPublishingPermissions(lambdaFunction);

        const viewResource = lambdaRestApi.root.addResource('view');
        viewResource.addMethod('GET', undefined, methodOptions);

        const searchResource = viewResource.addResource('search');
        searchResource.addMethod('POST', undefined, methodOptions);

        const idResource = lambdaRestApi.root.getResource('{id}') ?? lambdaRestApi.root.addResource('{id}');
        const transitionResource = idResource.addResource('transition');
        transitionResource.addMethod('POST', undefined, methodOptions);

        const subcasesResource = idResource.addResource('sub-cases');
        subcasesResource.addMethod('POST', undefined, methodOptions);

        const subcasesDeleteResource = subcasesResource.addResource('delete');
        subcasesDeleteResource.addMethod('POST', undefined, methodOptions);

        const subcasesSearchResource = subcasesResource.addResource('search');
        subcasesSearchResource.addMethod('POST', undefined, methodOptions);

        const auxiliaryResource = lambdaRestApi.root.addResource('auxiliary');
        auxiliaryResource.addMethod('POST', undefined, methodOptions);
        const auxiliaryIdResoruce = auxiliaryResource.addResource('{id}');
        auxiliaryIdResoruce.addMethod('POST', undefined, methodOptions);

        const visibleResource = lambdaRestApi.root.addResource('visible');
        visibleResource.addMethod('POST', undefined, methodOptions);
    }

    setDeleteResource(
        lambdaRestApi: aws_apigateway.LambdaRestApi,
        methodOptions?: {
            authorizationType: aws_apigateway.AuthorizationType;
            authorizer: aws_apigateway.CognitoUserPoolsAuthorizer;
        }
    ) {
        const idResource = lambdaRestApi.root.getResource('{id}') ?? lambdaRestApi.root.addResource('{id}');
        const deleteResource = idResource.addResource('delete');
        deleteResource.addMethod('POST', undefined, methodOptions);
    }

    nodejsFunctionDefaultProps(): NodejsFunctionProps {
        const props = super.nodejsFunctionDefaultProps();
        return {
            ...props,
            memorySize: 1024,
        };
    }
}
