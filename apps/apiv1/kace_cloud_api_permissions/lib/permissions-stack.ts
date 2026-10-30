import { Construct } from 'constructs';
import { KApiStack, KApiStackProps } from '@kace/aws-infra/src/KApiStack';
import { StackProps } from 'aws-cdk-lib';

export class PermissionsStack extends KApiStack {
    constructor(scope: Construct, id: string, props: StackProps, kProps: KApiStackProps) {
        super(scope, id, props, kProps);

        const name = 'permissions';

        const lambdaFunction = this.getNodejsFunction(name);

        const lambdaRestApi = this.getLambdaRestApi(name, lambdaFunction);

        const methodOptions = this.getLambdaRestApiMethodOptions();

        this.setIndexResource(lambdaRestApi, methodOptions);

        this.setBasePath(name, lambdaRestApi);
        this.setWafAssociation(lambdaRestApi);
        this.grantDynamoDbPermissions(name, lambdaFunction);
    }
}
