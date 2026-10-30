import { StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { KApiStack, KApiStackProps } from '@kace/aws-infra/src/KApiStack';
import { NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs';

export class AuxiliariesStack extends KApiStack {
    constructor(scope: Construct, id: string, props: StackProps, kProps: KApiStackProps) {
        super(scope, id, props, kProps);

        const path = 'auxiliaries';
        const lambdaFunction = this.getNodejsFunction(path);

        const lambdaRestApi = this.getLambdaRestApi(path, lambdaFunction);
        const methodOptions = this.getLambdaRestApiMethodOptions();

        const auxiliariesResource = lambdaRestApi.root;

        const entityResource = auxiliariesResource.addResource('{entity}');
        entityResource.addMethod('POST', undefined, methodOptions);
        entityResource.addMethod('GET', undefined, methodOptions);

        const searchResource = entityResource.addResource('search');
        searchResource.addMethod('POST', undefined, methodOptions);

        const listResource = entityResource.addResource('list');
        listResource.addMethod('GET', undefined, methodOptions);

        const searchlistResource = listResource.addResource('search');
        searchlistResource.addMethod('POST', undefined, methodOptions);

        const bulkDeleteResource = entityResource.addResource('bulk-delete');
        bulkDeleteResource.addMethod('POST', undefined, methodOptions);

        const idResource = entityResource.addResource('{id}');
        idResource.addMethod('GET', undefined, methodOptions);
        idResource.addMethod('POST', undefined, methodOptions);

        const deleteResource = idResource.addResource('delete');
        deleteResource.addMethod('GET', undefined, methodOptions);

        const historyResource = idResource.addResource('history');
        historyResource.addMethod('POST', undefined, methodOptions);

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
