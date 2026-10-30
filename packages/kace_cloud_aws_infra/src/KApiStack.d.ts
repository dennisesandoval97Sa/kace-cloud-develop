import { Construct } from 'constructs';
import { NodejsFunction, NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs';
import {
    AuthorizationType,
    CognitoUserPoolsAuthorizer,
    IDomainName,
    LambdaRestApi,
    MethodOptions,
} from 'aws-cdk-lib/aws-apigateway';
import { Stack, StackProps } from 'aws-cdk-lib';
import { ISecurityGroup, IVpc } from 'aws-cdk-lib/aws-ec2';
export interface KApiStackProps {
    apiGatewayDomainName: string;
    apiGatewayDomainNameAliasHostedZoneId: string;
    apiGatewayDomainNameAliasTarget: string;
    appsAllowedOrigins: string;
    appsEnvironment: string;
    appsServiceName: string;
    appsDebug: string;
    appsDebugLevel: string;
    cognitoUserPoolId: string;
    dbDatabase: string;
    dbHost: string;
    dbPassword: string;
    dbPort: string;
    dbSchema: string;
    dbUser: string;
    dbName: string;
    dbAuxiliarUser: string;
    dbAuxiliarPassword: string;
    dbTestHost: string;
    dbTestDatabase: string;
    dbTestUser: string;
    dbTestPassword: string;
    dbTestAuxiliarUser: string;
    dbTestAuxiliarPassword: string;
    dbTestName: string;
    dbTestPort: string;
    dbTestSchema: string;
    domain: string;
    enableAuth: boolean;
    encryptionMethod: string;
    environment: string;
    pathHandler: string;
    s3AccessKeyId: string;
    s3Bucket: string;
    s3Region: string;
    s3SecretAccessKey: string;
    secretIV: string;
    secretKey: string;
    awsCssEnable: string;
    awsCssUsername: string;
    awsCssPassword: string;
    awsCssUrl: string;
    appsContentSecurityPolicyDomains: string;
    appsFrameOrigins: string;
    awsEc2VpcId: string;
    awsEc2VpcSubnetPrivateIds: string;
    awsEc2VpcAvailabilityZones: string;
    awsEc2VpcPrivateSubnetRouteTableIds: string;
    awsEc2VpcLambdaSecurityGroupId: string;
    awsWafArn: string;
    importCron: string;
    awsCognitoRegion: string;
    awsCognitoAppClientId: string;
    awsCognitoUrl: string;
    awsCognitoUserPoolId: string;
    appsActionsQueueExecutorTimeoutMs: string;
    appsActionsQueueExecutionTimeoutMs: string;
    awsDynamoDbMultitenantTableARN: string;
    awsCasesEventsQueueArn?: string;
    awsActionJobsEventsQueueArn?: string;
    awsAutomatedActionsEventsQueueArn?: string;
    awsWsRestEventsQueueArn?: string;
    awsCasePostProcessingEventsQueueArn?: string;
    awsReportsEventsQueueArn?: string;
    awsImportsEventsQueueArn?: string;
    awsSqsEventsQueueUrl: string;
    awsEventBridgeEventBusArn: string;
    awsEventBridgeEventBusUrl: string;
}
export declare class KApiStack extends Stack {
    domainName: IDomainName | null;
    config: KApiStackProps;
    readonly vpc: IVpc;
    readonly lambdaSG: ISecurityGroup;
    private static version;
    constructor(scope: Construct, id: string, props: StackProps, kProps: KApiStackProps);
    static KProps(): KApiStackProps;
    setDefaultOptions(id: string, extraEnv?: Record<string, string>): NodejsFunction;
    setBasePath(id: string, lambdaRestApi: LambdaRestApi): void;
    getLambdaRestApi(id: string, lambdaFunction: NodejsFunction): LambdaRestApi;
    addGatewayResponses(api: LambdaRestApi): void;
    getNodejsFunction(id: string, overrides?: Partial<NodejsFunctionProps>): NodejsFunction;
    setDefaultResources(lambdaRestApi: LambdaRestApi, methodOptions?: MethodOptions): void;
    createCognitoUserPoolsAuthorizer(): CognitoUserPoolsAuthorizer;
    setIndexResource(lambdaRestApi: LambdaRestApi, methodOptions?: MethodOptions): void;
    setCreateResource(lambdaRestApi: LambdaRestApi, methodOptions?: MethodOptions): void;
    setReadResource(lambdaRestApi: LambdaRestApi, methodOptions?: MethodOptions): void;
    setUpdateResource(lambdaRestApi: LambdaRestApi, methodOptions?: MethodOptions): void;
    setDeleteResource(lambdaRestApi: LambdaRestApi, methodOptions?: MethodOptions): void;
    setHistoryResource(lambdaRestApi: LambdaRestApi, methodOptions?: MethodOptions): void;
    setSearchResource(lambdaRestApi: LambdaRestApi, methodOptions?: MethodOptions): void;
    setAdvanceSearchResource(lambdaRestApi: LambdaRestApi, methodOptions?: MethodOptions): void;
    corsPreflightDefaultOptions(): {
        allowOrigins: string[];
        allowMethods: string[];
        allowHeaders: string[];
        allowCredentials: boolean;
    };
    nodejsFunctionDefaultProps(): NodejsFunctionProps;
    nodejsFunctionSecretsEnvVar(): {
        SECRET_KEY: string;
        SECRET_IV: string;
        ENCRYPTION_METHOD: string;
    };
    nodejsFunctionDbEnvVar(): {
        DB_HOST: string;
        DB_DATABASE: string;
        DB_USER: string;
        DB_PASSWORD: string;
        DB_PORT: string;
        DB_SCHEMA: string;
        DB_AUXILIAR_USER: string;
        DB_AUXILIAR_PASSWORD: string;
        DB_NAME: string;
        DB_TEST_HOST: string;
        DB_TEST_DATABASE: string;
        DB_TEST_USER: string;
        DB_TEST_PASSWORD: string;
        DB_TEST_AUXILIAR_USER: string;
        DB_TEST_AUXILIAR_PASSWORD: string;
        DB_TEST_NAME: string;
        DB_TEST_PORT: string;
        DB_TEST_SCHEMA: string;
        AWS_DYNAMODB_MULTITENANT_TABLE_ARN: string;
        AWS_SQS_EVENTS_QUEUE_URL: string;
        AWS_EVENTBRIDGE_EVENT_BUS_ARN: string;
        AWS_EVENTBRIDGE_EVENT_BUS_URL: string;
    };
    nodejsFunctionS3EnvVar(): {
        S3_AWS_BUCKET: string;
        S3_AWS_ACCESS_KEY_ID: string;
        S3_AWS_SECRET_ACCESS_KEY: string;
        S3_AWS_REGION: string;
        AWS_S3_BUCKET: string;
        AWS_S3_ACCESS_KEY_ID: string;
        AWS_S3_SECRET_ACCESS_KEY: string;
        AWS_S3_REGION: string;
    };
    nodejsFunctionAppEnvVar(): {
        APPS_ENVIRONMENT: string;
        APPS_SERVICE_NAME: string;
        APPS_DEBUG: string;
        APPS_DEBUG_LEVEL: string;
        APPS_DOMAIN: string;
        SUBDOMAIN: string;
        APPS_API_SUBDOMAIN: string;
        APPS_ADMIN_SUBDOMAIN: string;
        APPS_ALLOWED_ORIGINS: string;
        APPS_CONTENT_SECURITY_POLICY_DOMAINS: string;
        APPS_FRAME_ORIGINS: string;
        APPS_CERTIFICATE_DOMAIN_ARN: string;
        APPS_HOSTED_ZONE_ID: string;
        APPS_EXECUTE_REST_HOOK_SERVICE_URL: string;
        APPS_TIMEOUT_REST_FLOWS_VALUE_MS: string;
        APPS_ACTIONS_QUEUE_EXECUTOR_TIMEOUT_MS: string;
        APPS_ACTIONS_QUEUE_EXECUTION_TIMEOUT_MS: string;
        TIMEZONE: string;
        AWS_COGNITO_REGION: string;
        AWS_COGNITO_APP_CLIENT_ID: string;
        AWS_COGNITO_URL: string;
        AWS_COGNITO_USER_POOL_ID: string;
    };
    getLambdaRestApiMethodOptions():
        | {
              authorizationType: AuthorizationType;
              authorizer: CognitoUserPoolsAuthorizer;
          }
        | undefined;
    nodejsFunctionAWSCSSEnvVar(): {
        AWS_CSS_ENABLE: string;
        AWS_CSS_USERNAME: string;
        AWS_CSS_PASSWORD: string;
        AWS_CSS_URL: string;
    };
    setWafAssociation(api: LambdaRestApi): void;
    isStagingOrProduction(): boolean;
    static getApiVersion(): string;
    grantEventPublishingPermissions(lambdaFunction: NodejsFunction): void;
    grantDynamoDbPermissions(id: string, lambdaFunction: NodejsFunction): void;
}
