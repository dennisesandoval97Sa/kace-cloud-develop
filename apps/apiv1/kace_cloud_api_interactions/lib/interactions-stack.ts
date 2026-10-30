import { Construct } from 'constructs';
import { KApiStack, KApiStackProps } from '@kace/aws-infra/src/KApiStack';
import { getDbTarget } from '@kace/aws-infra/src/dbRoutingEnv';
import { StackProps } from 'aws-cdk-lib';

export class InteractionsStack extends KApiStack {
    constructor(scope: Construct, id: string, props: StackProps, kProps: KApiStackProps) {
        super(scope, id, props, kProps);

        const path = 'interactions';

        const lambdaFunction = this.getNodejsFunction(path);

        this.grantDynamoDbPermissions(path, lambdaFunction);

        // This stack builds the function directly (no setDefaultOptions), so DB_TARGET must be
        // injected by hand from the routing registry (see manual_stacks_db_target_wiring).
        lambdaFunction.addEnvironment('DB_TARGET', getDbTarget(path));

        const lambdaRestApi = this.getLambdaRestApi(path, lambdaFunction);

        const methodOptions = this.getLambdaRestApiMethodOptions();

        this.setDefaultResources(lambdaRestApi, methodOptions);

        const resourceWebhook = lambdaRestApi.root.addResource('webhook');
        resourceWebhook.addMethod('POST', undefined, methodOptions);

        const resourceInteractionJoinCases = lambdaRestApi.root.addResource('interaction-cases');
        resourceInteractionJoinCases.addMethod('POST', undefined, methodOptions);
        const resourceInteractionJoinCasesSearch = resourceInteractionJoinCases.addResource('search');
        resourceInteractionJoinCasesSearch.addMethod('POST', undefined, methodOptions);
        const resourceInteractionJoinCasesCandidates = resourceInteractionJoinCases.addResource('candidates');
        const resourceInteractionJoinCasesCandidatesSearch =
            resourceInteractionJoinCasesCandidates.addResource('search');
        resourceInteractionJoinCasesCandidatesSearch.addMethod('POST', undefined, methodOptions);
        const resourceInteractionJoinCasesByInteraction = resourceInteractionJoinCases.addResource('{id}');
        resourceInteractionJoinCasesByInteraction.addMethod('GET', undefined, methodOptions);

        const idResource = lambdaRestApi.root.getResource('{id}') ?? lambdaRestApi.root.addResource('{id}');
        const reviewResource = idResource.addResource('review');
        const claimResource = reviewResource.addResource('claim');
        claimResource.addMethod('POST', undefined, methodOptions);
        const releaseResource = reviewResource.addResource('release');
        releaseResource.addMethod('POST', undefined, methodOptions);

        const agentResource = lambdaRestApi.root.addResource('agent');
        const agentSearchResource = agentResource.addResource('search');
        agentSearchResource.addMethod('POST', undefined, methodOptions);
        const agentInteractionCasesResource = agentResource.addResource('interaction-cases');
        agentInteractionCasesResource.addMethod('POST', undefined, methodOptions);
        const agentInteractionCaseResource = agentInteractionCasesResource.addResource('{id}');
        agentInteractionCaseResource.addMethod('GET', undefined, methodOptions);
        const agentIdResource = agentResource.addResource('{id}');
        const agentReviewResource = agentIdResource.addResource('review');
        agentReviewResource.addResource('claim').addMethod('POST', undefined, methodOptions);
        agentReviewResource.addResource('release').addMethod('POST', undefined, methodOptions);

        this.setBasePath(path, lambdaRestApi);
    }
}
