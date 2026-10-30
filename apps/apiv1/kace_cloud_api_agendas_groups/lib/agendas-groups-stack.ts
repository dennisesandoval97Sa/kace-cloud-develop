import { Construct } from 'constructs';
import { KApiStack, KApiStackProps } from '@kace/aws-infra/src/KApiStack';
import { StackProps } from 'aws-cdk-lib';
import { getDbTarget } from '@kace/aws-infra/src/dbRoutingEnv';

export class AgendasGroupsStack extends KApiStack {
    constructor(scope: Construct, id: string, props: StackProps, kProps: KApiStackProps) {
        super(scope, id, props, kProps);

        const path = 'agendas-groups';
        const lambdaFunction = this.getNodejsFunction(path);

        // This stack builds the function directly (no setDefaultOptions), so DB_TARGET must be
        // injected by hand for the read/write split to route reads to the replica.
        lambdaFunction.addEnvironment('DB_TARGET', getDbTarget(path));
        const lambdaRestApi = this.getLambdaRestApi(path, lambdaFunction);
        const methodOptions = this.getLambdaRestApiMethodOptions();

        this.setDefaultResources(lambdaRestApi, methodOptions);

        const readResource = lambdaRestApi.root
            .addResource('agenda')
            .addResource('{agendaId}')
            .addResource('group')
            .addResource('{groupId}');
        readResource?.addMethod('GET', undefined, methodOptions);

        const deleteResource = readResource?.addResource('delete');
        deleteResource?.addMethod('GET', undefined, methodOptions);

        const batchResource = lambdaRestApi.root.addResource('batch');
        batchResource.addMethod('POST', undefined, methodOptions);

        const batchDeleteResource = batchResource.addResource('delete');
        batchDeleteResource.addMethod('POST', undefined, methodOptions);

        this.setBasePath(path, lambdaRestApi);
        this.setWafAssociation(lambdaRestApi);
        this.grantDynamoDbPermissions(path, lambdaFunction);
    }
}
