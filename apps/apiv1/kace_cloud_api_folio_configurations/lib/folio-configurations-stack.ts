import { StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { KApiStack, KApiStackProps } from '@kace/aws-infra/src/KApiStack';
import { getDbTarget } from '@kace/aws-infra/src/dbRoutingEnv';

export class FolioConfigurationsStack extends KApiStack {
    constructor(scope: Construct, id: string, props: StackProps, kProps: KApiStackProps) {
        super(scope, id, props, kProps);

        const path = 'folio-configurations';

        const lambdaFunction = this.getNodejsFunction(path);
        lambdaFunction.addEnvironment('DB_TARGET', getDbTarget(path));
        const lambdaRestApi = this.getLambdaRestApi(path, lambdaFunction);
        const methodOptions = this.getLambdaRestApiMethodOptions();

        this.setDefaultResources(lambdaRestApi, methodOptions);
        this.setBasePath(path, lambdaRestApi);
        this.setWafAssociation(lambdaRestApi);
        this.grantDynamoDbPermissions(path, lambdaFunction);

        // Renders what a configuration would produce without reserving a number.
        const previewResource = lambdaRestApi.root.addResource('preview');
        previewResource.addMethod('POST', undefined, methodOptions);

        // Read-only listing of the classifications using a configuration. The association is
        // written from the classification form, which sets clasificaciones.folio_config_id.
        const idResource = lambdaRestApi.root.getResource('{id}') ?? lambdaRestApi.root.addResource('{id}');
        const classificationsResource = idResource.addResource('classifications');
        classificationsResource.addMethod('GET', undefined, methodOptions);
    }
}
