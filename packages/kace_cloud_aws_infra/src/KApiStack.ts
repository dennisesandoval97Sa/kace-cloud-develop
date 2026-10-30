import { Construct } from 'constructs';
import { NodejsFunction, NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs';
import {
    AuthorizationType,
    BasePathMapping,
    CognitoUserPoolsAuthorizer,
    DomainName,
    EndpointType,
    GatewayResponse,
    IDomainName,
    LambdaRestApi,
    MethodOptions,
    ResponseType,
} from 'aws-cdk-lib/aws-apigateway';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { UserPool } from 'aws-cdk-lib/aws-cognito';
import { Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import path from 'node:path'; // SONAR-EXC: Esta importación es nativa de NODE por lo que no es necesario agregarla como dependencia.
import { ISecurityGroup, IVpc, SecurityGroup, SubnetType, Vpc } from 'aws-cdk-lib/aws-ec2';
import { CfnWebACLAssociation } from 'aws-cdk-lib/aws-wafv2';
import { readFileSync } from 'fs';
import { PolicyStatement, Effect } from 'aws-cdk-lib/aws-iam';
import * as process from 'node:process';
import { getDbTarget } from './dbRoutingEnv';

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

export class KApiStack extends Stack {
    public domainName: IDomainName | null; // is initialized in the constructor
    public config: KApiStackProps; // is initialized in the constructor
    public readonly vpc: IVpc;
    public readonly lambdaSG: ISecurityGroup;
    private static version: string;

    // Node modules truly npm-installed into the Lambda bundle (kept external to esbuild) rather
    // than inlined. Callers building a specific lambda can extend this list via getNodejsFunction's
    // `overrides.bundling.nodeModules` when that lambda needs an extra runtime dependency.
    public static readonly DEFAULT_BUNDLED_NODE_MODULES = ['pg', 'knex', 'uuid', 'bcrypt', 'dayjs', 'jsonwebtoken'];

    constructor(scope: Construct, id: string, props: StackProps, kProps: KApiStackProps) {
        super(scope, `${kProps.appsServiceName}${id}`, props);

        this.config = kProps;

        if (this.isStagingOrProduction()) {
            this.domainName = DomainName.fromDomainNameAttributes(this, 'DomainName', {
                domainName: this.config.apiGatewayDomainName,
                domainNameAliasTarget: this.config.apiGatewayDomainNameAliasTarget,
                domainNameAliasHostedZoneId: this.config.apiGatewayDomainNameAliasHostedZoneId,
            });

            if (this.config.awsEc2VpcId) {
                this.vpc = Vpc.fromVpcAttributes(this, `${kProps.appsServiceName}ExistingVPC`, {
                    vpcId: this.config.awsEc2VpcId,
                    availabilityZones: this.config.awsEc2VpcAvailabilityZones.split(','),
                    privateSubnetIds: this.config.awsEc2VpcSubnetPrivateIds.split(','),
                    privateSubnetRouteTableIds: this.config.awsEc2VpcPrivateSubnetRouteTableIds.split(','),
                });
            }

            if (this.config.awsEc2VpcLambdaSecurityGroupId) {
                this.lambdaSG = SecurityGroup.fromSecurityGroupId(
                    this,
                    `${kProps.appsServiceName}LambdaSG`,
                    kProps.awsEc2VpcLambdaSecurityGroupId
                );
            }
        } else {
            this.domainName = null;
        }
    }

    public static KProps() {
        const isEnableAuth = ['production', 'staging'].includes(process.env.APPS_ENVIRONMENT as string);

        const props: KApiStackProps = {
            importCron: process.env.IMPORT_CRON_EXPRESSION as string,
            environment: process.env.APPS_ENVIRONMENT as string,
            domain: process.env.APPS_DOMAIN as string,
            apiGatewayDomainName: process.env.AWS_APIGATEWAY_DOMAIN_NAME as string,
            apiGatewayDomainNameAliasTarget: process.env.AWS_APIGATEWAY_DOMAIN_NAME_ALIAS_TARGET as string,
            apiGatewayDomainNameAliasHostedZoneId: process.env
                .AWS_APIGATEWAY_DOMAIN_NAME_ALIAS_HOSTED_ZONE_ID as string,
            appsEnvironment: process.env.APPS_ENVIRONMENT as string,
            appsServiceName: process.env.APPS_SERVICE_NAME as string,
            appsAllowedOrigins: process.env.APPS_ALLOWED_ORIGINS as string,
            appsDebug: process.env.APPS_DEBUG ?? '',
            appsDebugLevel: process.env.APPS_DEBUG_LEVEL ?? '',
            appsContentSecurityPolicyDomains: process.env.APPS_CONTENT_SECURITY_POLICY_DOMAINS as string,
            appsFrameOrigins: process.env.APPS_FRAME_ORIGINS as string,

            s3Region: process.env.AWS_S3_REGION as string,
            s3AccessKeyId: process.env.AWS_S3_ACCESS_KEY_ID as string,
            s3SecretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY as string,
            s3Bucket: process.env.AWS_S3_BUCKET as string,

            awsCssEnable: process.env.AWS_CSS_ENABLE as string,
            awsCssUsername: process.env.AWS_CSS_USERNAME as string,
            awsCssPassword: process.env.AWS_CSS_PASSWORD as string,
            awsCssUrl: process.env.AWS_CSS_URL as string,

            dbHost: process.env.DB_HOST as string,
            dbDatabase: process.env.DB_DATABASE as string,
            dbUser: process.env.DB_USER as string,
            dbPassword: process.env.DB_PASSWORD as string,
            dbPort: process.env.DB_PORT as string,
            dbSchema: process.env.DB_SCHEMA as string,
            dbName: process.env.DB_DATABASE as string,
            dbAuxiliarUser: process.env.DB_AUXILIAR_USER as string,
            dbAuxiliarPassword: process.env.DB_AUXILIAR_PASSWORD as string,

            dbTestHost: process.env.DB_TEST_HOST as string,
            dbTestDatabase: process.env.DB_TEST_DATABASE as string,
            dbTestUser: process.env.DB_TEST_USER as string,
            dbTestPassword: process.env.DB_TEST_PASSWORD as string,
            dbTestAuxiliarUser: process.env.DB_TEST_AUXILIAR_USER as string,
            dbTestAuxiliarPassword: process.env.DB_TEST_AUXILIAR_PASSWORD as string,
            dbTestName: process.env.DB_TEST_NAME as string,
            dbTestPort: process.env.DB_TEST_PORT as string,
            dbTestSchema: process.env.DB_TEST_SCHEMA as string,

            secretKey: process.env.SECRET_KEY as string,
            secretIV: process.env.SECRET_IV as string,
            encryptionMethod: process.env.ENCRYPTION_METHOD as string,

            enableAuth: isEnableAuth,
            cognitoUserPoolId: process.env.AWS_COGNITO_USER_POOL_ID as string,
            pathHandler: path.join(__dirname, '../src/handler.mjs'),

            awsEc2VpcId: process.env.AWS_EC2_VPC_ID as string,
            awsEc2VpcSubnetPrivateIds: process.env.AWS_EC2_VPC_SUBNET_PRIVATE_IDS as string,
            awsEc2VpcAvailabilityZones: process.env.AWS_EC2_VPC_AVAILABILITY_ZONES as string,
            awsEc2VpcPrivateSubnetRouteTableIds: process.env.AWS_EC2_VPC_PRIVATE_SUBNET_ROUTE_TABLE_IDS as string,
            awsEc2VpcLambdaSecurityGroupId: process.env.AWS_EC2_VPC_LAMBDA_SECURITY_GROUP_ID as string,

            awsWafArn: process.env.AWS_WAF_ARN as string,

            awsCognitoRegion: process.env.AWS_COGNITO_REGION as string,
            awsCognitoAppClientId: process.env.AWS_COGNITO_APP_CLIENT_ID as string,
            awsCognitoUrl: process.env.AWS_COGNITO_URL as string,
            awsCognitoUserPoolId: process.env.AWS_COGNITO_USER_POOL_ID as string,

            appsActionsQueueExecutorTimeoutMs: process.env.APPS_ACTIONS_QUEUE_EXECUTOR_TIMEOUT_MS as string,
            appsActionsQueueExecutionTimeoutMs: process.env.APPS_ACTIONS_QUEUE_EXECUTION_TIMEOUT_MS as string,

            awsDynamoDbMultitenantTableARN: process.env.AWS_DYNAMODB_MULTITENANT_TABLE_ARN as string,

            awsCasesEventsQueueArn: process.env.AWS_CASES_EVENTS_QUEUE_ARN,
            awsActionJobsEventsQueueArn: process.env.AWS_ACTION_JOBS_EVENTS_QUEUE_ARN,
            awsAutomatedActionsEventsQueueArn: process.env.AWS_AUTOMATED_ACTIONS_EVENTS_QUEUE_ARN,
            awsWsRestEventsQueueArn: process.env.AWS_WS_REST_EVENTS_QUEUE_ARN,
            awsCasePostProcessingEventsQueueArn: process.env.AWS_CASE_POST_PROCESSING_EVENTS_QUEUE_ARN,
            awsReportsEventsQueueArn: process.env.AWS_REPORTS_EVENTS_QUEUE_ARN,
            awsImportsEventsQueueArn: process.env.AWS_IMPORTS_EVENTS_QUEUE_ARN,
            awsSqsEventsQueueUrl: process.env.AWS_SQS_EVENTS_QUEUE_URL as string,
            awsEventBridgeEventBusArn: process.env.AWS_EVENTBRIDGE_EVENT_BUS_ARN as string,
            awsEventBridgeEventBusUrl: process.env.AWS_EVENTBRIDGE_EVENT_BUS_URL as string,
        };

        return props;
    }

    public setDefaultOptions(id: string, extraEnv: Record<string, string> = {}): NodejsFunction {
        const lambdaFunction = this.getNodejsFunction(id);

        lambdaFunction.addEnvironment('DB_TARGET', getDbTarget(id));

        for (const [key, value] of Object.entries(extraEnv)) {
            lambdaFunction.addEnvironment(key, value);
        }

        const lambdaRestApi = this.getLambdaRestApi(id, lambdaFunction);

        const methodOptions = this.getLambdaRestApiMethodOptions();

        this.setDefaultResources(lambdaRestApi, methodOptions);

        this.setBasePath(id, lambdaRestApi);

        this.setWafAssociation(lambdaRestApi);

        this.grantDynamoDbPermissions(id, lambdaFunction);

        return lambdaFunction;
    }

    public setBasePath(id: string, lambdaRestApi: LambdaRestApi) {
        if (this.domainName) {
            new BasePathMapping(this, `${id}_basePathMapping`, {
                // SONAR-EXC: Esta instancia es necesaria para inicializar recursos en el stack.
                domainName: this.domainName,
                restApi: lambdaRestApi,
                basePath: id,
            });
        }
    }

    public getLambdaRestApi(id: string, lambdaFunction: NodejsFunction) {
        const api = new LambdaRestApi(this, `${id}_api`, {
            restApiName: `${id}_api`,
            handler: lambdaFunction,
            proxy: false,
            defaultCorsPreflightOptions: this.corsPreflightDefaultOptions(),
            endpointConfiguration: {
                types: [EndpointType.REGIONAL],
            },
        });

        this.addGatewayResponses(api);
        return api;
    }

    public addGatewayResponses(api: LambdaRestApi) {
        const allowedOrigins = this.config.appsAllowedOrigins;

        new GatewayResponse(this, 'GatewayResponseDefault4XX', {
            restApi: api,
            type: ResponseType.DEFAULT_4XX,
            responseHeaders: {
                'Access-Control-Allow-Origin': `'${allowedOrigins.split(',')[0]}'`,
                'Access-Control-Allow-Headers': "'Content-Type,Authorization,X-Tenant-Id'",
                'Access-Control-Allow-Methods': "'GET,POST,OPTIONS'",
                'Access-Control-Allow-Credentials': "'true'",
            },
        });

        new GatewayResponse(this, 'GatewayResponseDefault5XX', {
            restApi: api,
            type: ResponseType.DEFAULT_5XX,
            responseHeaders: {
                'Access-Control-Allow-Origin': `'${allowedOrigins.split(',')[0]}'`,
                'Access-Control-Allow-Headers': "'Content-Type,Authorization,X-Tenant-Id'",
                'Access-Control-Allow-Methods': "'GET,POST,OPTIONS'",
                'Access-Control-Allow-Credentials': "'true'",
            },
        });
    }

    public getNodejsFunction(id: string, overrides?: Partial<NodejsFunctionProps>) {
        const logGroup = new LogGroup(this, `${id}_logGroup`, {
            retention: RetentionDays.ONE_MONTH,
            // Fuera de production el log group se elimina al destruir el stack para no dejar recursos huérfanos.
            removalPolicy: this.config.environment === 'production' ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
        });

        return new NodejsFunction(this, `${id}_lambda`, {
            entry: this.config.pathHandler,
            ...this.nodejsFunctionDefaultProps(),
            logGroup,
            ...overrides,
        });
    }

    public setDefaultResources(lambdaRestApi: LambdaRestApi, methodOptions?: MethodOptions) {
        this.setIndexResource(lambdaRestApi, methodOptions);
        this.setCreateResource(lambdaRestApi, methodOptions);
        this.setReadResource(lambdaRestApi, methodOptions);
        this.setUpdateResource(lambdaRestApi, methodOptions);
        this.setDeleteResource(lambdaRestApi, methodOptions);
        this.setSearchResource(lambdaRestApi, methodOptions);
        this.setHistoryResource(lambdaRestApi, methodOptions);
        this.setAdvanceSearchResource(lambdaRestApi, methodOptions);
    }

    public createCognitoUserPoolsAuthorizer() {
        return new CognitoUserPoolsAuthorizer(this, 'CognitoUserPoolsAuthorizer', {
            cognitoUserPools: [UserPool.fromUserPoolId(this, 'UserPool', this.config.cognitoUserPoolId)],
        });
    }

    public setIndexResource(lambdaRestApi: LambdaRestApi, methodOptions?: MethodOptions) {
        lambdaRestApi.root.addMethod('GET', undefined, methodOptions);
    }

    public setCreateResource(lambdaRestApi: LambdaRestApi, methodOptions?: MethodOptions) {
        lambdaRestApi.root.addMethod('POST', undefined, methodOptions);
    }

    public setReadResource(lambdaRestApi: LambdaRestApi, methodOptions?: MethodOptions) {
        const idResource = lambdaRestApi.root.getResource('{id}') ?? lambdaRestApi.root.addResource('{id}');
        idResource.addMethod('GET', undefined, methodOptions);
    }

    public setUpdateResource(lambdaRestApi: LambdaRestApi, methodOptions?: MethodOptions) {
        const idResource = lambdaRestApi.root.getResource('{id}') ?? lambdaRestApi.root.addResource('{id}');
        idResource.addMethod('POST', undefined, methodOptions);
    }

    public setDeleteResource(lambdaRestApi: LambdaRestApi, methodOptions?: MethodOptions) {
        const idResource = lambdaRestApi.root.getResource('{id}') ?? lambdaRestApi.root.addResource('{id}');
        const deleteResource = idResource.addResource('delete');
        deleteResource.addMethod('GET', undefined, methodOptions);
    }

    public setHistoryResource(lambdaRestApi: LambdaRestApi, methodOptions?: MethodOptions) {
        const idResource = lambdaRestApi.root.getResource('{id}') ?? lambdaRestApi.root.addResource('{id}');
        const historyResource = idResource.addResource('history');
        historyResource.addMethod('POST', undefined, methodOptions);
    }

    public setSearchResource(lambdaRestApi: LambdaRestApi, methodOptions?: MethodOptions) {
        const searchResource = lambdaRestApi.root.addResource('search');
        searchResource.addMethod('POST', undefined, methodOptions);
    }

    setAdvanceSearchResource(lambdaRestApi: LambdaRestApi, methodOptions?: MethodOptions) {
        const advanceSearchResource = lambdaRestApi.root.addResource('advance-search');
        advanceSearchResource.addMethod('POST', undefined, methodOptions);
    }

    public corsPreflightDefaultOptions() {
        return {
            allowOrigins: this.config.appsAllowedOrigins.split(','),
            allowMethods: ['GET', 'POST', 'OPTIONS'],
            allowHeaders: [
                'Content-Type',
                'X-Amz-Date',
                'Authorization',
                'X-Api-Key',
                'X-Amz-Security-Token',
                'X-Amz-User-Agent',
                'X-Client-Fingerprint',
                'X-Tenant-Id',
                'User-Agent',
            ],
            allowCredentials: true,
        };
    }

    public nodejsFunctionDefaultProps(): NodejsFunctionProps {
        let props = {};
        if (this.isStagingOrProduction() && this.vpc && this.lambdaSG) {
            props = {
                vpc: this.vpc,
                vpcSubnets: {
                    subnetType: SubnetType.PRIVATE_WITH_EGRESS,
                },
                securityGroups: [this.lambdaSG],
            };
        }

        let environment;
        if (this.config.environment === 'local') {
            environment = {
                NODE_ENV: this.config.environment,
                // DB_TARGET routes reads; the reader host is per-tenant (db_host_reader from Dynamo), so no global DB_HOST_READER env is injected.
                DB_TARGET: 'primary',
                API_VERSION: KApiStack.getApiVersion(),
                TARGET_DYNAMODB_TABLE: `${this.config.appsServiceName}_kace_multi_tenancy`,
                TARGET_DYNAMODB_REGION: this.config.awsCognitoRegion,
                // Fuente única del modo del SQL guard: se lee del .env raíz en synth. Default enforce (fail-safe).
                SQL_GUARD_MODE: process.env.SQL_GUARD_MODE || 'enforce',

                ...this.nodejsFunctionAppEnvVar(),
                ...this.nodejsFunctionDbEnvVar(),
                ...this.nodejsFunctionSecretsEnvVar(),
                ...this.nodejsFunctionS3EnvVar(),
                ...this.nodejsFunctionAWSCSSEnvVar(),
            };
        } else {
            environment = {
                NODE_ENV: this.config.environment,
                // DB_TARGET routes reads; the reader host is per-tenant (db_host_reader from Dynamo), so no global DB_HOST_READER env is injected.
                DB_TARGET: 'primary',
                API_VERSION: KApiStack.getApiVersion(),
                TARGET_DYNAMODB_TABLE: `${this.config.appsServiceName}_kace_multi_tenancy`,
                TARGET_DYNAMODB_REGION: this.config.awsCognitoRegion,
                APPS_DEBUG: this.config.appsDebug,
                APPS_DEBUG_LEVEL: this.config.appsDebugLevel,
                // Fuente única del modo del SQL guard: se lee del .env raíz en synth. Default enforce (fail-safe).
                SQL_GUARD_MODE: process.env.SQL_GUARD_MODE || 'enforce',
            };
        }

        return {
            bundling: {
                nodeModules: KApiStack.DEFAULT_BUNDLED_NODE_MODULES,
                forceDockerBundling: true,
            },
            timeout: Duration.seconds(30),
            environment: environment,
            runtime: Runtime.NODEJS_22_X,
            memorySize: 512,
            ...props,
        };
    }

    public nodejsFunctionSecretsEnvVar() {
        return {
            SECRET_KEY: this.config.secretKey,
            SECRET_IV: this.config.secretIV,
            ENCRYPTION_METHOD: this.config.encryptionMethod,
        };
    }

    public nodejsFunctionDbEnvVar() {
        return {
            DB_HOST: this.config.dbHost,
            DB_DATABASE: this.config.dbDatabase,
            DB_USER: this.config.dbUser,
            DB_PASSWORD: this.config.dbPassword,
            DB_PORT: this.config.dbPort,
            DB_SCHEMA: this.config.dbSchema,
            DB_AUXILIAR_USER: this.config.dbAuxiliarUser,
            DB_AUXILIAR_PASSWORD: this.config.dbAuxiliarPassword,
            DB_NAME: this.config.dbName,
            DB_TEST_HOST: this.config.dbTestHost,
            DB_TEST_DATABASE: this.config.dbTestDatabase,
            DB_TEST_USER: this.config.dbTestUser,
            DB_TEST_PASSWORD: this.config.dbTestPassword,
            DB_TEST_AUXILIAR_USER: this.config.dbTestAuxiliarUser,
            DB_TEST_AUXILIAR_PASSWORD: this.config.dbTestAuxiliarPassword,
            DB_TEST_NAME: this.config.dbTestName,
            DB_TEST_PORT: this.config.dbTestPort,
            DB_TEST_SCHEMA: this.config.dbTestSchema,
            AWS_DYNAMODB_MULTITENANT_TABLE_ARN: this.config.awsDynamoDbMultitenantTableARN,
            AWS_SQS_EVENTS_QUEUE_URL: this.config.awsSqsEventsQueueUrl,
            AWS_EVENTBRIDGE_EVENT_BUS_ARN: this.config.awsEventBridgeEventBusArn,
            AWS_EVENTBRIDGE_EVENT_BUS_URL: this.config.awsEventBridgeEventBusUrl,
        };
    }

    public nodejsFunctionS3EnvVar() {
        return {
            S3_AWS_BUCKET: this.config.s3Bucket,
            S3_AWS_ACCESS_KEY_ID: this.config.s3AccessKeyId,
            S3_AWS_SECRET_ACCESS_KEY: this.config.s3SecretAccessKey,
            S3_AWS_REGION: this.config.s3Region,
            AWS_S3_BUCKET: this.config.s3Bucket,
            AWS_S3_ACCESS_KEY_ID: this.config.s3AccessKeyId,
            AWS_S3_SECRET_ACCESS_KEY: this.config.s3SecretAccessKey,
            AWS_S3_REGION: this.config.s3Region,
        };
    }

    public nodejsFunctionAppEnvVar() {
        return {
            APPS_ENVIRONMENT: this.config.environment,
            APPS_SERVICE_NAME: this.config.appsServiceName,
            APPS_DEBUG: this.config.appsDebug,
            APPS_DEBUG_LEVEL: this.config.appsDebugLevel,
            APPS_DOMAIN: this.config.domain,
            SUBDOMAIN: process.env.APPS_API_SUBDOMAIN as string,
            APPS_API_SUBDOMAIN: process.env.APPS_API_SUBDOMAIN as string,
            APPS_ADMIN_SUBDOMAIN: process.env.APPS_ADMIN_SUBDOMAIN as string,
            APPS_ALLOWED_ORIGINS: this.config.appsAllowedOrigins,
            APPS_CONTENT_SECURITY_POLICY_DOMAINS: this.config.appsContentSecurityPolicyDomains,
            APPS_FRAME_ORIGINS: this.config.appsFrameOrigins,
            APPS_CERTIFICATE_DOMAIN_ARN: process.env.APPS_CERTIFICATE_DOMAIN_ARN as string,
            APPS_HOSTED_ZONE_ID: process.env.APPS_HOSTED_ZONE_ID as string,
            APPS_EXECUTE_REST_HOOK_SERVICE_URL: process.env.APPS_EXECUTE_REST_HOOK_SERVICE_URL as string,
            APPS_TIMEOUT_REST_FLOWS_VALUE_MS: process.env.APPS_TIMEOUT_REST_FLOWS_VALUE_MS as string,
            APPS_ACTIONS_QUEUE_EXECUTOR_TIMEOUT_MS: process.env.APPS_ACTIONS_QUEUE_EXECUTOR_TIMEOUT_MS as string,
            APPS_ACTIONS_QUEUE_EXECUTION_TIMEOUT_MS: process.env.APPS_ACTIONS_QUEUE_EXECUTION_TIMEOUT_MS as string,
            TIMEZONE: process.env.TIMEZONE as string,
            AWS_COGNITO_REGION: this.config.awsCognitoRegion,
            AWS_COGNITO_APP_CLIENT_ID: this.config.awsCognitoAppClientId,
            AWS_COGNITO_URL: this.config.awsCognitoUrl,
            AWS_COGNITO_USER_POOL_ID: this.config.awsCognitoUserPoolId,
        };
    }

    public getLambdaRestApiMethodOptions() {
        let methodOptions = undefined;
        if (this.config.enableAuth) {
            const authorizer = this.createCognitoUserPoolsAuthorizer();

            methodOptions = {
                authorizationType: AuthorizationType.COGNITO,
                authorizer: authorizer,
            };
        }

        return methodOptions;
    }

    nodejsFunctionAWSCSSEnvVar() {
        return {
            AWS_CSS_ENABLE: this.config.awsCssEnable,
            AWS_CSS_USERNAME: this.config.awsCssUsername,
            AWS_CSS_PASSWORD: this.config.awsCssPassword,
            AWS_CSS_URL: this.config.awsCssUrl,
        };
    }

    public setWafAssociation(api: LambdaRestApi) {
        if (this.isStagingOrProduction() && this.config.awsWafArn) {
            new CfnWebACLAssociation(this, 'ApiWebAclAssoc', {
                resourceArn: api.deploymentStage.stageArn,
                webAclArn: this.config.awsWafArn,
            });
        }
    }

    public isStagingOrProduction(): boolean {
        return ['production', 'staging'].includes(this.config.appsEnvironment);
    }

    public static getApiVersion(): string {
        if (!this.version) {
            try {
                const packagePath = path.resolve(process.cwd(), 'package.json');
                const content = readFileSync(packagePath, 'utf8');
                const parsed = JSON.parse(content);
                this.version = typeof parsed.version === 'string' ? parsed.version : 'unknown';
            } catch (err: any) {
                console.warn('⚠️ No se pudo leer la versión desde package.json:', err.message);
                this.version = 'unknown';
            }
        }

        return this.version;
    }

    public grantEventPublishingPermissions(lambdaFunction: NodejsFunction) {
        // Phase 3 — per-BC queues. Each producer gets permission to ALL queues;
        // restricting per-event is more code with no security benefit (the producer
        // already controls its own publish targets).
        const perBcArns = [
            this.config.awsCasesEventsQueueArn,
            this.config.awsActionJobsEventsQueueArn,
            this.config.awsAutomatedActionsEventsQueueArn,
            this.config.awsWsRestEventsQueueArn,
            this.config.awsCasePostProcessingEventsQueueArn,
            this.config.awsReportsEventsQueueArn,
            this.config.awsImportsEventsQueueArn,
        ].filter((arn): arn is string => Boolean(arn));

        if (perBcArns.length > 0) {
            lambdaFunction.addToRolePolicy(
                new PolicyStatement({
                    effect: Effect.ALLOW,
                    actions: ['sqs:SendMessage'],
                    resources: perBcArns,
                })
            );
        }

        if (this.config.awsEventBridgeEventBusArn) {
            lambdaFunction.addToRolePolicy(
                new PolicyStatement({
                    effect: Effect.ALLOW,
                    actions: ['events:PutEvents'],
                    resources: [this.config.awsEventBridgeEventBusArn],
                })
            );
        }
    }

    public grantDynamoDbPermissions(id: string, lambdaFunction: NodejsFunction) {
        if (this.config.awsDynamoDbMultitenantTableARN) {
            lambdaFunction.addToRolePolicy(
                new PolicyStatement({
                    effect: Effect.ALLOW,
                    actions: ['dynamodb:GetItem', 'dynamodb:Scan', 'dynamodb:Query'],
                    resources: [this.config.awsDynamoDbMultitenantTableARN],
                })
            );
        } else {
            throw new Error('No se ha definido la tabla de servicios');
        }
    }
}
