import { Construct } from 'constructs';
import { KApiStack, KApiStackProps } from '@kace/aws-infra/src/KApiStack';
import { getDbTarget } from '@kace/aws-infra/src/dbRoutingEnv';
import { StackProps } from 'aws-cdk-lib';
import { NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs';

export class BoardsStack extends KApiStack {
    constructor(scope: Construct, id: string, props: StackProps, kProps: KApiStackProps) {
        super(scope, id, props, kProps);

        const path = 'boards';

        const lambdaFunction = this.getNodejsFunction(path);
        lambdaFunction.addEnvironment('DB_TARGET', getDbTarget(path));

        const lambdaRestApi = this.getLambdaRestApi(path, lambdaFunction);

        const methodOptions = this.getLambdaRestApiMethodOptions();

        this.setDefaultResources(lambdaRestApi, methodOptions);

        const resourceRelations = lambdaRestApi.root.addResource('relations');
        resourceRelations.addMethod('GET', undefined, methodOptions);
        const resourceAvailable = lambdaRestApi.root.addResource('available');
        resourceAvailable.addMethod('GET', undefined, methodOptions);
        const resourceRelationsEntity = resourceRelations.addResource('{entity}');
        resourceRelationsEntity.addMethod('GET', undefined, methodOptions);

        const idResource = lambdaRestApi.root.getResource('{id}');
        const RegisterBoardResource = idResource?.addResource('resources');
        RegisterBoardResource?.addMethod('POST', undefined, methodOptions);

        this.setBasePath(path, lambdaRestApi);
        this.setWafAssociation(lambdaRestApi);
        this.grantDynamoDbPermissions(path, lambdaFunction);
    }

    nodejsFunctionDefaultProps(): NodejsFunctionProps {
        const props = super.nodejsFunctionDefaultProps();
        return {
            ...props,
            memorySize: 512,
        };
    }
}
