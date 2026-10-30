import { Construct } from 'constructs';
import { KApiStack, KApiStackProps } from '@kace/aws-infra/src/KApiStack';
import { getDbTarget } from '@kace/aws-infra/src/dbRoutingEnv';
import { StackProps } from 'aws-cdk-lib';

export class EmailsStack extends KApiStack {
    constructor(scope: Construct, id: string, props: StackProps, kProps: KApiStackProps) {
        super(scope, id, props, kProps);

        const path = 'emails';

        const lambdaFunction = this.getNodejsFunction(path);

        // This stack builds the function directly (no setDefaultOptions), so DB_TARGET must be
        // injected by hand from the routing registry (see manual_stacks_db_target_wiring).
        lambdaFunction.addEnvironment('DB_TARGET', getDbTarget(path));

        const lambdaRestApi = this.getLambdaRestApi(path, lambdaFunction);

        const methodOptions = this.getLambdaRestApiMethodOptions();

        this.setDefaultResources(lambdaRestApi, methodOptions);

        const emailsResource = lambdaRestApi.root;
        const sendResource = emailsResource.addResource('send');
        sendResource.addMethod('POST', undefined, methodOptions);

        const replyResource = emailsResource.addResource('reply');
        replyResource.addMethod('POST', undefined, methodOptions);

        const idResource = lambdaRestApi.root.getResource('{id}') ?? lambdaRestApi.root.addResource('{id}');
        const bodyResource = idResource.addResource('body');
        bodyResource.addMethod('GET', undefined, methodOptions);

        const downloadResource = idResource.addResource('download');
        downloadResource.addMethod('GET', undefined, methodOptions);

        this.setBasePath(path, lambdaRestApi);

        this.setWafAssociation(lambdaRestApi);

        this.grantDynamoDbPermissions(id, lambdaFunction);
    }
}
