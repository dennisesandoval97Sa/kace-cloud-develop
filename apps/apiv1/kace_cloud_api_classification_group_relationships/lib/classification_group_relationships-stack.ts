import { Construct } from 'constructs';
import { KApiStack, KApiStackProps } from '@kace/aws-infra/src/KApiStack';
import { getDbTarget } from '@kace/aws-infra/src/dbRoutingEnv';
import { StackProps } from 'aws-cdk-lib';

export class ClassificationGroupRelationshipsStack extends KApiStack {
    constructor(scope: Construct, id: string, props: StackProps, kProps: KApiStackProps) {
        super(scope, id, props, kProps);

        const path = 'classifications-groups-relationships';
        const lambdaFunction = this.getNodejsFunction(path);
        lambdaFunction.addEnvironment('DB_TARGET', getDbTarget(path));
        const lambdaRestApi = this.getLambdaRestApi(path, lambdaFunction);
        const methodOptions = this.getLambdaRestApiMethodOptions();

        this.setDefaultResources(lambdaRestApi, methodOptions);

        const groupResource = lambdaRestApi.root
            .addResource('classification')
            .addResource('{classificationId}')
            .addResource('group')
            .addResource('{groupId}');
        groupResource.addMethod('GET', undefined, methodOptions);

        const groupDeleteResource = groupResource.addResource('delete');
        groupDeleteResource.addMethod('GET', undefined, methodOptions);

        this.setBasePath(path, lambdaRestApi);
        this.setWafAssociation(lambdaRestApi);
        this.grantDynamoDbPermissions(path, lambdaFunction);
    }
}
