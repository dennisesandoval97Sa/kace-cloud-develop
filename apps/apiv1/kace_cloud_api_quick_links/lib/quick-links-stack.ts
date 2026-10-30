import { Construct } from 'constructs';
import { KApiStack, KApiStackProps } from '@kace/aws-infra/src/KApiStack';
import { getDbTarget } from '@kace/aws-infra/src/dbRoutingEnv';
import { StackProps } from 'aws-cdk-lib';

export class QuickLinksStack extends KApiStack {
    constructor(scope: Construct, id: string, props: StackProps, kProps: KApiStackProps) {
        super(scope, id, props, kProps);

        const path = 'quick-links';

        const lambdaFunction = this.getNodejsFunction(path);
        lambdaFunction.addEnvironment('DB_TARGET', getDbTarget(path));

        const lambdaRestApi = this.getLambdaRestApi(path, lambdaFunction);
        const methodOptions = this.getLambdaRestApiMethodOptions();

        // Solo las tres rutas requeridas por el ejercicio.
        this.setIndexResource(lambdaRestApi, methodOptions);
        this.setCreateResource(lambdaRestApi, methodOptions);
        this.setDeleteResource(lambdaRestApi, methodOptions);

        this.setBasePath(path, lambdaRestApi);
        this.setWafAssociation(lambdaRestApi);
        this.grantDynamoDbPermissions(id, lambdaFunction);
    }
}
