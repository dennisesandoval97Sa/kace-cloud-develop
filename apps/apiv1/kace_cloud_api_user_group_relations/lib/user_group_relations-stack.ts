import { StackProps, aws_apigateway } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { KApiStack, KApiStackProps } from '@kace/aws-infra/src/KApiStack';

export class UserGroupRelationsStack extends KApiStack {
    constructor(scope: Construct, id: string, props: StackProps, kProps: KApiStackProps) {
        super(scope, id, props, kProps);

        this.setDefaultOptions('user-group-relationships');
    }

    setDeleteResource(
        lambdaRestApi: aws_apigateway.LambdaRestApi,
        methodOptions?: {
            authorizationType: aws_apigateway.AuthorizationType;
            authorizer: aws_apigateway.CognitoUserPoolsAuthorizer;
        }
    ) {
        const batchDeleteResource = lambdaRestApi.root.addResource('delete');
        batchDeleteResource.addMethod('POST', undefined, methodOptions);
    }
}
