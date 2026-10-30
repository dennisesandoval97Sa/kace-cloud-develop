'use strict';
var __createBinding =
    (this && this.__createBinding) ||
    (Object.create
        ? function (o, m, k, k2) {
              if (k2 === undefined) k2 = k;
              var desc = Object.getOwnPropertyDescriptor(m, k);
              if (!desc || ('get' in desc ? !m.__esModule : desc.writable || desc.configurable)) {
                  desc = {
                      enumerable: true,
                      get: function () {
                          return m[k];
                      },
                  };
              }
              Object.defineProperty(o, k2, desc);
          }
        : function (o, m, k, k2) {
              if (k2 === undefined) k2 = k;
              o[k2] = m[k];
          });
var __setModuleDefault =
    (this && this.__setModuleDefault) ||
    (Object.create
        ? function (o, v) {
              Object.defineProperty(o, 'default', { enumerable: true, value: v });
          }
        : function (o, v) {
              o['default'] = v;
          });
var __importStar =
    (this && this.__importStar) ||
    function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null)
            for (var k in mod)
                if (k !== 'default' && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
        __setModuleDefault(result, mod);
        return result;
    };
var __importDefault =
    (this && this.__importDefault) ||
    function (mod) {
        return mod && mod.__esModule ? mod : { default: mod };
    };
Object.defineProperty(exports, '__esModule', { value: true });
exports.KApiStack = void 0;
const aws_lambda_nodejs_1 = require('aws-cdk-lib/aws-lambda-nodejs');
const aws_apigateway_1 = require('aws-cdk-lib/aws-apigateway');
const aws_lambda_1 = require('aws-cdk-lib/aws-lambda');
const aws_cognito_1 = require('aws-cdk-lib/aws-cognito');
const aws_cdk_lib_1 = require('aws-cdk-lib');
const aws_logs_1 = require('aws-cdk-lib/aws-logs');
const node_path_1 = __importDefault(require('node:path')); // SONAR-EXC: Esta importación es nativa de NODE por lo que no es necesario agregarla como dependencia.
const aws_ec2_1 = require('aws-cdk-lib/aws-ec2');
const aws_wafv2_1 = require('aws-cdk-lib/aws-wafv2');
const fs_1 = require('fs');
const aws_iam_1 = require('aws-cdk-lib/aws-iam');
const process = __importStar(require('node:process'));
const dbRoutingEnv_1 = require('./dbRoutingEnv');
class KApiStack extends aws_cdk_lib_1.Stack {
    constructor(scope, id, props, kProps) {
        super(scope, `${kProps.appsServiceName}${id}`, props);
        this.config = kProps;
        if (this.isStagingOrProduction()) {
            this.domainName = aws_apigateway_1.DomainName.fromDomainNameAttributes(this, 'DomainName', {
                domainName: this.config.apiGatewayDomainName,
                domainNameAliasTarget: this.config.apiGatewayDomainNameAliasTarget,
                domainNameAliasHostedZoneId: this.config.apiGatewayDomainNameAliasHostedZoneId,
            });
            if (this.config.awsEc2VpcId) {
                this.vpc = aws_ec2_1.Vpc.fromVpcAttributes(this, `${kProps.appsServiceName}ExistingVPC`, {
                    vpcId: this.config.awsEc2VpcId,
                    availabilityZones: this.config.awsEc2VpcAvailabilityZones.split(','),
                    privateSubnetIds: this.config.awsEc2VpcSubnetPrivateIds.split(','),
                    privateSubnetRouteTableIds: this.config.awsEc2VpcPrivateSubnetRouteTableIds.split(','),
                });
            }
            if (this.config.awsEc2VpcLambdaSecurityGroupId) {
                this.lambdaSG = aws_ec2_1.SecurityGroup.fromSecurityGroupId(
                    this,
                    `${kProps.appsServiceName}LambdaSG`,
                    kProps.awsEc2VpcLambdaSecurityGroupId
                );
            }
        } else {
            this.domainName = null;
        }
    }
    static KProps() {
        const isEnableAuth = ['production', 'staging'].includes(process.env.APPS_ENVIRONMENT);
        const props = {
            importCron: process.env.IMPORT_CRON_EXPRESSION,
            environment: process.env.APPS_ENVIRONMENT,
            domain: process.env.APPS_DOMAIN,
            apiGatewayDomainName: process.env.AWS_APIGATEWAY_DOMAIN_NAME,
            apiGatewayDomainNameAliasTarget: process.env.AWS_APIGATEWAY_DOMAIN_NAME_ALIAS_TARGET,
            apiGatewayDomainNameAliasHostedZoneId: process.env.AWS_APIGATEWAY_DOMAIN_NAME_ALIAS_HOSTED_ZONE_ID,
            appsEnvironment: process.env.APPS_ENVIRONMENT,
            appsServiceName: process.env.APPS_SERVICE_NAME,
            appsAllowedOrigins: process.env.APPS_ALLOWED_ORIGINS,
            appsDebug: process.env.APPS_DEBUG ?? '',
            appsDebugLevel: process.env.APPS_DEBUG_LEVEL ?? '',
            appsContentSecurityPolicyDomains: process.env.APPS_CONTENT_SECURITY_POLICY_DOMAINS,
            appsFrameOrigins: process.env.APPS_FRAME_ORIGINS,
            s3Region: process.env.AWS_S3_REGION,
            s3AccessKeyId: process.env.AWS_S3_ACCESS_KEY_ID,
            s3SecretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY,
            s3Bucket: process.env.AWS_S3_BUCKET,
            awsCssEnable: process.env.AWS_CSS_ENABLE,
            awsCssUsername: process.env.AWS_CSS_USERNAME,
            awsCssPassword: process.env.AWS_CSS_PASSWORD,
            awsCssUrl: process.env.AWS_CSS_URL,
            dbHost: process.env.DB_HOST,
            dbDatabase: process.env.DB_DATABASE,
            dbUser: process.env.DB_USER,
            dbPassword: process.env.DB_PASSWORD,
            dbPort: process.env.DB_PORT,
            dbSchema: process.env.DB_SCHEMA,
            dbName: process.env.DB_DATABASE,
            dbAuxiliarUser: process.env.DB_AUXILIAR_USER,
            dbAuxiliarPassword: process.env.DB_AUXILIAR_PASSWORD,
            dbTestHost: process.env.DB_TEST_HOST,
            dbTestDatabase: process.env.DB_TEST_DATABASE,
            dbTestUser: process.env.DB_TEST_USER,
            dbTestPassword: process.env.DB_TEST_PASSWORD,
            dbTestAuxiliarUser: process.env.DB_TEST_AUXILIAR_USER,
            dbTestAuxiliarPassword: process.env.DB_TEST_AUXILIAR_PASSWORD,
            dbTestName: process.env.DB_TEST_NAME,
            dbTestPort: process.env.DB_TEST_PORT,
            dbTestSchema: process.env.DB_TEST_SCHEMA,
            secretKey: process.env.SECRET_KEY,
            secretIV: process.env.SECRET_IV,
            encryptionMethod: process.env.ENCRYPTION_METHOD,
            enableAuth: isEnableAuth,
            cognitoUserPoolId: process.env.AWS_COGNITO_USER_POOL_ID,
            pathHandler: node_path_1.default.join(__dirname, '../src/handler.mjs'),
            awsEc2VpcId: process.env.AWS_EC2_VPC_ID,
            awsEc2VpcSubnetPrivateIds: process.env.AWS_EC2_VPC_SUBNET_PRIVATE_IDS,
            awsEc2VpcAvailabilityZones: process.env.AWS_EC2_VPC_AVAILABILITY_ZONES,
            awsEc2VpcPrivateSubnetRouteTableIds: process.env.AWS_EC2_VPC_PRIVATE_SUBNET_ROUTE_TABLE_IDS,
            awsEc2VpcLambdaSecurityGroupId: process.env.AWS_EC2_VPC_LAMBDA_SECURITY_GROUP_ID,
            awsWafArn: process.env.AWS_WAF_ARN,
            awsCognitoRegion: process.env.AWS_COGNITO_REGION,
            awsCognitoAppClientId: process.env.AWS_COGNITO_APP_CLIENT_ID,
            awsCognitoUrl: process.env.AWS_COGNITO_URL,
            awsCognitoUserPoolId: process.env.AWS_COGNITO_USER_POOL_ID,
            appsActionsQueueExecutorTimeoutMs: process.env.APPS_ACTIONS_QUEUE_EXECUTOR_TIMEOUT_MS,
            appsActionsQueueExecutionTimeoutMs: process.env.APPS_ACTIONS_QUEUE_EXECUTION_TIMEOUT_MS,
            awsDynamoDbMultitenantTableARN: process.env.AWS_DYNAMODB_MULTITENANT_TABLE_ARN,
            awsCasesEventsQueueArn: process.env.AWS_CASES_EVENTS_QUEUE_ARN,
            awsActionJobsEventsQueueArn: process.env.AWS_ACTION_JOBS_EVENTS_QUEUE_ARN,
            awsAutomatedActionsEventsQueueArn: process.env.AWS_AUTOMATED_ACTIONS_EVENTS_QUEUE_ARN,
            awsWsRestEventsQueueArn: process.env.AWS_WS_REST_EVENTS_QUEUE_ARN,
            awsCasePostProcessingEventsQueueArn: process.env.AWS_CASE_POST_PROCESSING_EVENTS_QUEUE_ARN,
            awsReportsEventsQueueArn: process.env.AWS_REPORTS_EVENTS_QUEUE_ARN,
            awsImportsEventsQueueArn: process.env.AWS_IMPORTS_EVENTS_QUEUE_ARN,
            awsSqsEventsQueueUrl: process.env.AWS_SQS_EVENTS_QUEUE_URL,
            awsEventBridgeEventBusArn: process.env.AWS_EVENTBRIDGE_EVENT_BUS_ARN,
            awsEventBridgeEventBusUrl: process.env.AWS_EVENTBRIDGE_EVENT_BUS_URL,
        };
        return props;
    }
    setDefaultOptions(id, extraEnv = {}) {
        const lambdaFunction = this.getNodejsFunction(id);
        lambdaFunction.addEnvironment('DB_TARGET', (0, dbRoutingEnv_1.getDbTarget)(id));
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
    setBasePath(id, lambdaRestApi) {
        if (this.domainName) {
            new aws_apigateway_1.BasePathMapping(this, `${id}_basePathMapping`, {
                // SONAR-EXC: Esta instancia es necesaria para inicializar recursos en el stack.
                domainName: this.domainName,
                restApi: lambdaRestApi,
                basePath: id,
            });
        }
    }
    getLambdaRestApi(id, lambdaFunction) {
        const api = new aws_apigateway_1.LambdaRestApi(this, `${id}_api`, {
            restApiName: `${id}_api`,
            handler: lambdaFunction,
            proxy: false,
            defaultCorsPreflightOptions: this.corsPreflightDefaultOptions(),
            endpointConfiguration: {
                types: [aws_apigateway_1.EndpointType.REGIONAL],
            },
        });
        this.addGatewayResponses(api);
        return api;
    }
    addGatewayResponses(api) {
        const allowedOrigins = this.config.appsAllowedOrigins;
        new aws_apigateway_1.GatewayResponse(this, 'GatewayResponseDefault4XX', {
            restApi: api,
            type: aws_apigateway_1.ResponseType.DEFAULT_4XX,
            responseHeaders: {
                'Access-Control-Allow-Origin': `'${allowedOrigins.split(',')[0]}'`,
                'Access-Control-Allow-Headers': "'Content-Type,Authorization,X-Tenant-Id'",
                'Access-Control-Allow-Methods': "'GET,POST,OPTIONS'",
                'Access-Control-Allow-Credentials': "'true'",
            },
        });
        new aws_apigateway_1.GatewayResponse(this, 'GatewayResponseDefault5XX', {
            restApi: api,
            type: aws_apigateway_1.ResponseType.DEFAULT_5XX,
            responseHeaders: {
                'Access-Control-Allow-Origin': `'${allowedOrigins.split(',')[0]}'`,
                'Access-Control-Allow-Headers': "'Content-Type,Authorization,X-Tenant-Id'",
                'Access-Control-Allow-Methods': "'GET,POST,OPTIONS'",
                'Access-Control-Allow-Credentials': "'true'",
            },
        });
    }
    getNodejsFunction(id, overrides) {
        const logGroup = new aws_logs_1.LogGroup(this, `${id}_logGroup`, {
            retention: aws_logs_1.RetentionDays.ONE_MONTH,
            // Fuera de production el log group se elimina al destruir el stack para no dejar recursos huérfanos.
            removalPolicy:
                this.config.environment === 'production'
                    ? aws_cdk_lib_1.RemovalPolicy.RETAIN
                    : aws_cdk_lib_1.RemovalPolicy.DESTROY,
        });
        return new aws_lambda_nodejs_1.NodejsFunction(this, `${id}_lambda`, {
            entry: this.config.pathHandler,
            ...this.nodejsFunctionDefaultProps(),
            logGroup,
            ...overrides,
        });
    }
    setDefaultResources(lambdaRestApi, methodOptions) {
        this.setIndexResource(lambdaRestApi, methodOptions);
        this.setCreateResource(lambdaRestApi, methodOptions);
        this.setReadResource(lambdaRestApi, methodOptions);
        this.setUpdateResource(lambdaRestApi, methodOptions);
        this.setDeleteResource(lambdaRestApi, methodOptions);
        this.setSearchResource(lambdaRestApi, methodOptions);
        this.setHistoryResource(lambdaRestApi, methodOptions);
        this.setAdvanceSearchResource(lambdaRestApi, methodOptions);
    }
    createCognitoUserPoolsAuthorizer() {
        return new aws_apigateway_1.CognitoUserPoolsAuthorizer(this, 'CognitoUserPoolsAuthorizer', {
            cognitoUserPools: [aws_cognito_1.UserPool.fromUserPoolId(this, 'UserPool', this.config.cognitoUserPoolId)],
        });
    }
    setIndexResource(lambdaRestApi, methodOptions) {
        lambdaRestApi.root.addMethod('GET', undefined, methodOptions);
    }
    setCreateResource(lambdaRestApi, methodOptions) {
        lambdaRestApi.root.addMethod('POST', undefined, methodOptions);
    }
    setReadResource(lambdaRestApi, methodOptions) {
        const idResource = lambdaRestApi.root.getResource('{id}') ?? lambdaRestApi.root.addResource('{id}');
        idResource.addMethod('GET', undefined, methodOptions);
    }
    setUpdateResource(lambdaRestApi, methodOptions) {
        const idResource = lambdaRestApi.root.getResource('{id}') ?? lambdaRestApi.root.addResource('{id}');
        idResource.addMethod('POST', undefined, methodOptions);
    }
    setDeleteResource(lambdaRestApi, methodOptions) {
        const idResource = lambdaRestApi.root.getResource('{id}') ?? lambdaRestApi.root.addResource('{id}');
        const deleteResource = idResource.addResource('delete');
        deleteResource.addMethod('GET', undefined, methodOptions);
    }
    setHistoryResource(lambdaRestApi, methodOptions) {
        const idResource = lambdaRestApi.root.getResource('{id}') ?? lambdaRestApi.root.addResource('{id}');
        const historyResource = idResource.addResource('history');
        historyResource.addMethod('POST', undefined, methodOptions);
    }
    setSearchResource(lambdaRestApi, methodOptions) {
        const searchResource = lambdaRestApi.root.addResource('search');
        searchResource.addMethod('POST', undefined, methodOptions);
    }
    setAdvanceSearchResource(lambdaRestApi, methodOptions) {
        const advanceSearchResource = lambdaRestApi.root.addResource('advance-search');
        advanceSearchResource.addMethod('POST', undefined, methodOptions);
    }
    corsPreflightDefaultOptions() {
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
    nodejsFunctionDefaultProps() {
        let props = {};
        if (this.isStagingOrProduction() && this.vpc && this.lambdaSG) {
            props = {
                vpc: this.vpc,
                vpcSubnets: {
                    subnetType: aws_ec2_1.SubnetType.PRIVATE_WITH_EGRESS,
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
            timeout: aws_cdk_lib_1.Duration.seconds(30),
            environment: environment,
            runtime: aws_lambda_1.Runtime.NODEJS_22_X,
            memorySize: 512,
            ...props,
        };
    }
    nodejsFunctionSecretsEnvVar() {
        return {
            SECRET_KEY: this.config.secretKey,
            SECRET_IV: this.config.secretIV,
            ENCRYPTION_METHOD: this.config.encryptionMethod,
        };
    }
    nodejsFunctionDbEnvVar() {
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
    nodejsFunctionS3EnvVar() {
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
    nodejsFunctionAppEnvVar() {
        return {
            APPS_ENVIRONMENT: this.config.environment,
            APPS_SERVICE_NAME: this.config.appsServiceName,
            APPS_DEBUG: this.config.appsDebug,
            APPS_DEBUG_LEVEL: this.config.appsDebugLevel,
            APPS_DOMAIN: this.config.domain,
            SUBDOMAIN: process.env.APPS_API_SUBDOMAIN,
            APPS_API_SUBDOMAIN: process.env.APPS_API_SUBDOMAIN,
            APPS_ADMIN_SUBDOMAIN: process.env.APPS_ADMIN_SUBDOMAIN,
            APPS_ALLOWED_ORIGINS: this.config.appsAllowedOrigins,
            APPS_CONTENT_SECURITY_POLICY_DOMAINS: this.config.appsContentSecurityPolicyDomains,
            APPS_FRAME_ORIGINS: this.config.appsFrameOrigins,
            APPS_CERTIFICATE_DOMAIN_ARN: process.env.APPS_CERTIFICATE_DOMAIN_ARN,
            APPS_HOSTED_ZONE_ID: process.env.APPS_HOSTED_ZONE_ID,
            APPS_EXECUTE_REST_HOOK_SERVICE_URL: process.env.APPS_EXECUTE_REST_HOOK_SERVICE_URL,
            APPS_TIMEOUT_REST_FLOWS_VALUE_MS: process.env.APPS_TIMEOUT_REST_FLOWS_VALUE_MS,
            APPS_ACTIONS_QUEUE_EXECUTOR_TIMEOUT_MS: process.env.APPS_ACTIONS_QUEUE_EXECUTOR_TIMEOUT_MS,
            APPS_ACTIONS_QUEUE_EXECUTION_TIMEOUT_MS: process.env.APPS_ACTIONS_QUEUE_EXECUTION_TIMEOUT_MS,
            TIMEZONE: process.env.TIMEZONE,
            AWS_COGNITO_REGION: this.config.awsCognitoRegion,
            AWS_COGNITO_APP_CLIENT_ID: this.config.awsCognitoAppClientId,
            AWS_COGNITO_URL: this.config.awsCognitoUrl,
            AWS_COGNITO_USER_POOL_ID: this.config.awsCognitoUserPoolId,
        };
    }
    getLambdaRestApiMethodOptions() {
        let methodOptions = undefined;
        if (this.config.enableAuth) {
            const authorizer = this.createCognitoUserPoolsAuthorizer();
            methodOptions = {
                authorizationType: aws_apigateway_1.AuthorizationType.COGNITO,
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
    setWafAssociation(api) {
        if (this.isStagingOrProduction() && this.config.awsWafArn) {
            new aws_wafv2_1.CfnWebACLAssociation(this, 'ApiWebAclAssoc', {
                resourceArn: api.deploymentStage.stageArn,
                webAclArn: this.config.awsWafArn,
            });
        }
    }
    isStagingOrProduction() {
        return ['production', 'staging'].includes(this.config.appsEnvironment);
    }
    static getApiVersion() {
        if (!this.version) {
            try {
                const packagePath = node_path_1.default.resolve(process.cwd(), 'package.json');
                const content = (0, fs_1.readFileSync)(packagePath, 'utf8');
                const parsed = JSON.parse(content);
                this.version = typeof parsed.version === 'string' ? parsed.version : 'unknown';
            } catch (err) {
                console.warn('⚠️ No se pudo leer la versión desde package.json:', err.message);
                this.version = 'unknown';
            }
        }
        return this.version;
    }
    grantEventPublishingPermissions(lambdaFunction) {
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
        ].filter((arn) => Boolean(arn));
        if (perBcArns.length > 0) {
            lambdaFunction.addToRolePolicy(
                new aws_iam_1.PolicyStatement({
                    effect: aws_iam_1.Effect.ALLOW,
                    actions: ['sqs:SendMessage'],
                    resources: perBcArns,
                })
            );
        }
        if (this.config.awsEventBridgeEventBusArn) {
            lambdaFunction.addToRolePolicy(
                new aws_iam_1.PolicyStatement({
                    effect: aws_iam_1.Effect.ALLOW,
                    actions: ['events:PutEvents'],
                    resources: [this.config.awsEventBridgeEventBusArn],
                })
            );
        }
    }
    grantDynamoDbPermissions(id, lambdaFunction) {
        if (this.config.awsDynamoDbMultitenantTableARN) {
            lambdaFunction.addToRolePolicy(
                new aws_iam_1.PolicyStatement({
                    effect: aws_iam_1.Effect.ALLOW,
                    actions: ['dynamodb:GetItem', 'dynamodb:Scan', 'dynamodb:Query'],
                    resources: [this.config.awsDynamoDbMultitenantTableARN],
                })
            );
        } else {
            throw new Error('No se ha definido la tabla de servicios');
        }
    }
}
exports.KApiStack = KApiStack;
// Node modules truly npm-installed into the Lambda bundle (kept external to esbuild) rather
// than inlined. Callers building a specific lambda can extend this list via getNodejsFunction's
// `overrides.bundling.nodeModules` when that lambda needs an extra runtime dependency.
KApiStack.DEFAULT_BUNDLED_NODE_MODULES = ['pg', 'knex', 'uuid', 'bcrypt', 'dayjs', 'jsonwebtoken'];
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiS0FwaVN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiS0FwaVN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQ0EscUVBQW9GO0FBQ3BGLCtEQVdvQztBQUNwQyx1REFBaUQ7QUFDakQseURBQW1EO0FBQ25ELDZDQUF5RTtBQUN6RSxtREFBK0Q7QUFDL0QsMERBQTZCLENBQUMsdUdBQXVHO0FBQ3JJLGlEQUEyRjtBQUMzRixxREFBNkQ7QUFDN0QsMkJBQWtDO0FBQ2xDLGlEQUE4RDtBQUM5RCxzREFBd0M7QUFDeEMsaURBQTZDO0FBd0U3QyxNQUFhLFNBQVUsU0FBUSxtQkFBSztJQVloQyxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQWlCLEVBQUUsTUFBc0I7UUFDL0UsS0FBSyxDQUFDLEtBQUssRUFBRSxHQUFHLE1BQU0sQ0FBQyxlQUFlLEdBQUcsRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFdEQsSUFBSSxDQUFDLE1BQU0sR0FBRyxNQUFNLENBQUM7UUFFckIsSUFBSSxJQUFJLENBQUMscUJBQXFCLEVBQUUsRUFBRSxDQUFDO1lBQy9CLElBQUksQ0FBQyxVQUFVLEdBQUcsMkJBQVUsQ0FBQyx3QkFBd0IsQ0FBQyxJQUFJLEVBQUUsWUFBWSxFQUFFO2dCQUN0RSxVQUFVLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxvQkFBb0I7Z0JBQzVDLHFCQUFxQixFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsK0JBQStCO2dCQUNsRSwyQkFBMkIsRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLHFDQUFxQzthQUNqRixDQUFDLENBQUM7WUFFSCxJQUFJLElBQUksQ0FBQyxNQUFNLENBQUMsV0FBVyxFQUFFLENBQUM7Z0JBQzFCLElBQUksQ0FBQyxHQUFHLEdBQUcsYUFBRyxDQUFDLGlCQUFpQixDQUFDLElBQUksRUFBRSxHQUFHLE1BQU0sQ0FBQyxlQUFlLGFBQWEsRUFB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QUksRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLFFBQVEsRUFBRSxPQUFPLEVBQUUsY0FBYyxDQUFDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcbmltcG9ydCB7IE5vZGVqc0Z1bmN0aW9uLCBOb2RlanNGdW5jdGlvblByb3BzIH0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYS1ub2RlanMnO1xuaW1wb3J0IHtcbiAgICBBdXRob3JpemF0aW9uVHlwZSxcbiAgICBCYXNlUGF0aE1hcHBpbmcsXG4gICAgQ29nbml0b1VzZXJQb29sc0F1dGhvcml6ZXIsXG4gICAgRG9tYWluTmFtZSxcbiAgICBFbmRwb2ludFR5cGUsXG4gICAgR2F0ZXdheVJlc3BvbnNlLFxuICAgIElEb21haW5OYW1lLFxuICAgIExhbWJkYVJlc3RBcGksXG4gICAgTWV0aG9kT3B0aW9ucyxcbiAgICBSZXNwb25zZVR5cGUsXG59IGZyb20gJ2F3cy1jZGstbGliL2F3cy1hcGlnYXRld2F5JztcbmltcG9ydCB7IFJ1bnRpbWUgfSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbGFtYmRhJztcbmltcG9ydCB7IFVzZXJQb29sIH0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWNvZ25pdG8nO1xuaW1wb3J0IHsgRHVyYXRpb24sIFJlbW92YWxQb2xpY3ksIFN0YWNrLCBTdGFja1Byb3BzIH0gZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0IHsgTG9nR3JvdXAsIFJldGVudGlvbkRheXMgfSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbG9ncyc7XG5pbXBvcnQgcGF0aCBmcm9tICdub2RlOnBhdGgnOyAvLyBTT05BUi1FWEM6IEVzdGEgaW1wb3J0YWNpw7NuIGVzIG5hdGl2YSBkZSBOT0RFIHBvciBsbyBxdWUgbm8gZXMgbmVjZXNhcmlvIGFncmVnYXJsYSBjb21vIGRlcGVuZGVuY2lhLlxuaW1wb3J0IHsgSVNlY3VyaXR5R3JvdXAsIElWcGMsIFNlY3VyaXR5R3JvdXAsIFN1Ym5ldFR5cGUsIFZwYyB9IGZyb20gJ2F3cy1jZGstbGliL2F3cy1lYzInO1xuaW1wb3J0IHsgQ2ZuV2ViQUNMQXNzb2NpYXRpb24gfSBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtd2FmdjInO1xuaW1wb3J0IHsgcmVhZEZpbGVTeW5jIH0gZnJvbSAnZnMnO1xuaW1wb3J0IHsgUG9saWN5U3RhdGVtZW50LCBFZmZlY3QgfSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJztcbmltcG9ydCAqIGFzIHByb2Nlc3MgZnJvbSAnbm9kZTpwcm9jZXNzJztcbmltcG9ydCB7IGdldERiVGFyZ2V0IH0gZnJvbSAnLi9kYlJvdXRpbmdFbnYnO1xuXG5leHBvcnQgaW50ZXJmYWNlIEtBcGlTdGFja1Byb3BzIHtcbiAgICBhcGlHYXRld2F5RG9tYWluTmFtZTogc3RyaW5nO1xuICAgIGFwaUdhdGV3YXlEb21haW5OYW1lQWxpYXNIb3N0ZWRab25lSWQ6IHN0cmluZztcbiAgICBhcGlHYXRld2F5RG9tYWluTmFtZUFsaWFzVGFyZ2V0OiBzdHJpbmc7XG4gICAgYXBwc0FsbG93ZWRPcmlnaW5zOiBzdHJpbmc7XG4gICAgYXBwc0Vudmlyb25tZW50OiBzdHJpbmc7XG4gICAgYXBwc1NlcnZpY2VOYW1lOiBzdHJpbmc7XG4gICAgYXBwc0RlYnVnOiBzdHJpbmc7XG4gICAgYXBwc0RlYnVnTGV2ZWw6IHN0cmluZztcbiAgICBjb2duaXRvVXNlclBvb2xJZDogc3RyaW5nO1xuICAgIGRiRGF0YWJhc2U6IHN0cmluZztcbiAgICBkYkhvc3Q6IHN0cmluZztcbiAgICBkYlBhc3N3b3JkOiBzdHJpbmc7XG4gICAgZGJQb3J0OiBzdHJpbmc7XG4gICAgZGJTY2hlbWE6IHN0cmluZztcbiAgICBkYlVzZXI6IHN0cmluZztcbiAgICBkYk5hbWU6IHN0cmluZztcbiAgICBkYkF1eGlsaWFyVXNlcjogc3RyaW5nO1xuICAgIGRiQXV4aWxpYXJQYXNzd29yZDogc3RyaW5nO1xuICAgIGRiVGVzdEhvc3Q6IHN0cmluZztcbiAgICBkYlRlc3REYXRhYmFzZTogc3RyaW5nO1xuICAgIGRiVGVzdFVzZXI6IHN0cmluZztcbiAgICBkYlRlc3RQYXNzd29yZDogc3RyaW5nO1xuICAgIGRiVGVzdEF1eGlsaWFyVXNlcjogc3RyaW5nO1xuICAgIGRiVGVzdEF1eGlsaWFyUGFzc3dvcmQ6IHN0cmluZztcbiAgICBkYlRlc3ROYW1lOiBzdHJpbmc7XG4gICAgZGJUZXN0UG9ydDogc3RyaW5nO1xuICAgIGRiVGVzdFNjaGVtYTogc3RyaW5nO1xuICAgIGRvbWFpbjogc3RyaW5nO1xuICAgIGVuYWJsZUF1dGg6IGJvb2xlYW47XG4gICAgZW5jcnlwdGlvbk1ldGhvZDogc3RyaW5nO1xuICAgIGVudmlyb25tZW50OiBzdHJpbmc7XG4gICAgcGF0aEhhbmRsZXI6IHN0cmluZztcbiAgICBzM0FjY2Vzc0tleUlkOiBzdHJpbmc7XG4gICAgczNCdWNrZXQ6IHN0cmluZztcbiAgICBzM1JlZ2lvbjogc3RyaW5nO1xuICAgIHMzU2VjcmV0QWNjZXNzS2V5OiBzdHJpbmc7XG4gICAgc2VjcmV0SVY6IHN0cmluZztcbiAgICBzZWNyZXRLZXk6IHN0cmluZztcbiAgICBhd3NDc3NFbmFibGU6IHN0cmluZztcbiAgICBhd3NDc3NVc2VybmFtZTogc3RyaW5nO1xuICAgIGF3c0Nzc1Bhc3N3b3JkOiBzdHJpbmc7XG4gICAgYXdzQ3NzVXJsOiBzdHJpbmc7XG4gICAgYXBwc0NvbnRlbnRTZWN1cml0eVBvbGljeURvbWFpbnM6IHN0cmluZztcbiAgICBhcHBzRnJhbWVPcmlnaW5zOiBzdHJpbmc7XG4gICAgYXdzRWMyVnBjSWQ6IHN0cmluZztcbiAgICBhd3NFYzJWcGNTdWJuZXRQcml2YXRlSWRzOiBzdHJpbmc7XG4gICAgYXdzRWMyVnBjQXZhaWxhYmlsaXR5Wm9uZXM6IHN0cmluZztcbiAgICBhd3NFYzJWcGNQcml2YXRlU3VibmV0Um91dGVUYWJsZUlkczogc3RyaW5nO1xuICAgIGF3c0VjMlZwY0xhbWJkYVNlY3VyaXR5R3JvdXBJZDogc3RyaW5nO1xuICAgIGF3c1dhZkFybjogc3RyaW5nO1xuICAgIGltcG9ydENyb246IHN0cmluZztcbiAgICBhd3NDb2duaXRvUmVnaW9uOiBzdHJpbmc7XG4gICAgYXdzQ29nbml0b0FwcENsaWVudElkOiBzdHJpbmc7XG4gICAgYXdzQ29nbml0b1VybDogc3RyaW5nO1xuICAgIGF3c0NvZ25pdG9Vc2VyUG9vbElkOiBzdHJpbmc7XG4gICAgYXBwc0FjdGlvbnNRdWV1ZUV4ZWN1dG9yVGltZW91dE1zOiBzdHJpbmc7XG4gICAgYXBwc0FjdGlvbnNRdWV1ZUV4ZWN1dGlvblRpbWVvdXRNczogc3RyaW5nO1xuICAgIGF3c0R5bmFtb0RiTXVsdGl0ZW5hbnRUYWJsZUFSTjogc3RyaW5nO1xuICAgIGF3c0Nhc2VzRXZlbnRzUXVldWVBcm4/OiBzdHJpbmc7XG4gICAgYXdzQWN0aW9uSm9ic0V2ZW50c1F1ZXVlQXJuPzogc3RyaW5nO1xuICAgIGF3c0F1dG9tYXRlZEFjdGlvbnNFdmVudHNRdWV1ZUFybj86IHN0cmluZztcbiAgICBhd3NXc1Jlc3RFdmVudHNRdWV1ZUFybj86IHN0cmluZztcbiAgICBhd3NDYXNlUG9zdFByb2Nlc3NpbmdFdmVudHNRdWV1ZUFybj86IHN0cmluZztcbiAgICBhd3NSZXBvcnRzRXZlbnRzUXVldWVBcm4/OiBzdHJpbmc7XG4gICAgYXdzU3FzRXZlbnRzUXVldWVVcmw6IHN0cmluZztcbiAgICBhd3NFdmVudEJyaWRnZUV2ZW50QnVzQXJuOiBzdHJpbmc7XG4gICAgYXdzRXZlbnRCcmlkZ2VFdmVudEJ1c1VybDogc3RyaW5nO1xufVxuXG5leHBvcnQgY2xhc3MgS0FwaVN0YWNrIGV4dGVuZHMgU3RhY2sge1xuICAgIHB1YmxpYyBkb21haW5OYW1lOiBJRG9tYWluTmFtZSB8IG51bGw7IC8vIGlzIGluaXRpYWxpemVkIGluIHRoZSBjb25zdHJ1Y3RvclxuICAgIHB1YmxpYyBjb25maWc6IEtBcGlTdGFja1Byb3BzOyAvLyBpcyBpbml0aWFsaXplZCBpbiB0aGUgY29uc3RydWN0b3JcbiAgICBwdWJsaWMgcmVhZG9ubHkgdnBjOiBJVnBjO1xuICAgIHB1YmxpYyByZWFkb25seSBsYW1iZGFTRzogSVNlY3VyaXR5R3JvdXA7XG4gICAgcHJpdmF0ZSBzdGF0aWMgdmVyc2lvbjogc3RyaW5nO1xuXG4gICAgLy8gTm9kZSBtb2R1bGVzIHRydWx5IG5wbS1pbnN0YWxsZWQgaW50byB0aGUgTGFtYmRhIGJ1bmRsZSAoa2VwdCBleHRlcm5hbCB0byBlc2J1aWxkKSByYXRoZXJcbiAgICAvLyB0aGFuIGlubGluZWQuIENhbGxlcnMgYnVpbGRpbmcgYSBzcGVjaWZpYyBsYW1iZGEgY2FuIGV4dGVuZCB0aGlzIGxpc3QgdmlhIGdldE5vZGVqc0Z1bmN0aW9uJ3NcbiAgICAvLyBgb3ZlcnJpZGVzLmJ1bmRsaW5nLm5vZGVNb2R1bGVzYCB3aGVuIHRoYXQgbGFtYmRhIG5lZWRzIGFuIGV4dHJhIHJ1bnRpbWUgZGVwZW5kZW5jeS5cbiAgICBwdWJsaWMgc3RhdGljIHJlYWRvbmx5IERFRkFVTFRfQlVORExFRF9OT0RFX01PRFVMRVMgPSBbJ3BnJywgJ2tuZXgnLCAndXVpZCcsICdiY3J5cHQnLCAnZGF5anMnLCAnanNvbndlYnRva2VuJ107XG5cbiAgICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogU3RhY2tQcm9wcywga1Byb3BzOiBLQXBpU3RhY2tQcm9wcykge1xuICAgICAgICBzdXBlcihzY29wZSwgYCR7a1Byb3BzLmFwcHNTZXJ2aWNlTmFtZX0ke2lkfWAsIHByb3BzKTtcblxuICAgICAgICB0aGlzLmNvbmZpZyA9IGtQcm9wcztcblxuICAgICAgICBpZiAodGhpcy5pc1N0YWdpbmdPclByb2R1Y3Rpb24oKSkge1xuICAgICAgICAgICAgdGhpcy5kb21haW5OYW1lID0gRG9tYWluTmFtZS5mcm9tRG9tYWluTmFtZUF0dHJpYnV0ZXModGhpcywgJ0RvbWFpbk5hbWUnLCB7XG4gICAgICAgICAgICAgICAgZG9tYWluTmFtZTogdGhpcy5jb25maWcuYXBpR2F0ZXdheURvbWFpbk5hbWUsXG4gICAgICAgICAgICAgICAgZG9tYWluTmFtZUFsaWFzVGFyZ2V0OiB0aGlzLmNvbmZpZy5hcGlHYXRld2F5RG9tYWluTmFtZUFsaWFzVGFyZ2V0LFxuICAgICAgICAgICAgICAgIGRvbWFpbk5hbWVBbGlhc0hvc3RlZFpvbmVJZDogdGhpcy5jb25maWcuYXBpR2F0ZXdheURvbWFpbk5hbWVBbGlhc0hvc3RlZFpvbmVJZCxcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5jb25maWcuYXdzRWMyVnBjSWQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnZwYyA9IFZwYy5mcm9tVnBjQXR0cmlidXRlcyh0aGlzLCBgJHtrUHJvcHMuYXBwc1NlcnZpY2VOYW1lfUV4aXN0aW5nVlBDYCwge1xuICAgICAgICAgICAgICAgICAgICB2cGNJZDogdGhpcy5jb25maWcuYXdzRWMyVnBjSWQsXG4gICAgICAgICAgICAgICAgICAgIGF2YWlsYWJpbGl0eVpvbmVzOiB0aGlzLmNvbmZpZy5hd3NFYzJWcGNBdmFpbGFiaWxpdHlab25lcy5zcGxpdCgnLCcpLFxuICAgICAgICAgICAgICAgICAgICBwcml2YXRlU3VibmV0SWRzOiB0aGlzLmNvbmZpZy5hd3NFYzJWcGNTdWJuZXRQcml2YXRlSWRzLnNwbGl0KCcsJyksXG4gICAgICAgICAgICAgICAgICAgIHByaXZhdGVTdWJuZXRSb3V0ZVRhYmxlSWRzOiB0aGlzLmNvbmZpZy5hd3NFYzJWcGNQcml2YXRlU3VibmV0Um91dGVUYWJsZUlkcy5zcGxpdCgnLCcpLFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodGhpcy5jb25maWcuYXdzRWMyVnBjTGFtYmRhU2VjdXJpdHlHcm91cElkKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5sYW1iZGFTRyA9IFNlY3VyaXR5R3JvdXAuZnJvbVNlY3VyaXR5R3JvdXBJZChcbiAgICAgICAgICAgICAgICAgICAgdGhpcyxcbiAgICAgICAgICAgICAgICAgICAgYCR7a1Byb3BzLmFwcHNTZXJ2aWNlTmFtZX1MYW1iZGFTR2AsXG4gICAgICAgICAgICAgICAgICAgIGtQcm9wcy5hd3NFYzJWcGNMYW1iZGFTZWN1cml0eUdyb3VwSWRcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5kb21haW5OYW1lID0gbnVsbDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHB1YmxpYyBzdGF0aWMgS1Byb3BzKCkge1xuICAgICAgICBjb25zdCBpc0VuYWJsZUF1dGggPSBbJ3Byb2R1Y3Rpb24nLCAnc3RhZ2luZyddLmluY2x1ZGVzKHByb2Nlc3MuZW52LkFQUFNfRU5WSVJPTk1FTlQgYXMgc3RyaW5nKTtcblxuICAgICAgICBjb25zdCBwcm9wczogS0FwaVN0YWNrUHJvcHMgPSB7XG4gICAgICAgICAgICBpbXBvcnRDcm9uOiBwcm9jZXNzLmVudi5JTVBPUlRfQ1JPTl9FWFBSRVNTSU9OIGFzIHN0cmluZyxcbiAgICAgICAgICAgIGVudmlyb25tZW50OiBwcm9jZXNzLmVudi5BUFBTX0VOVklST05NRU5UIGFzIHN0cmluZyxcbiAgICAgICAgICAgIGRvbWFpbjogcHJvY2Vzcy5lbnYuQVBQU19ET01BSU4gYXMgc3RyaW5nLFxuICAgICAgICAgICAgYXBpR2F0ZXdheURvbWFpbk5hbWU6IHByb2Nlc3MuZW52LkFXU19BUElHQVRFV0FZX0RPTUFJTl9OQU1FIGFzIHN0cmluZyxcbiAgICAgICAgICAgIGFwaUdhdGV3YXlEb21haW5OYW1lQWxpYXNUYXJnZXQ6IHByb2Nlc3MuZW52LkFXU19BUElHQVRFV0FZX0RPTUFJTl9OQU1FX0FMSUFTX1RBUkdFVCBhcyBzdHJpbmcsXG4gICAgICAgICAgICBhcGlHYXRld2F5RG9tYWluTmFtZUFsaWFzSG9zdGVkWm9uZUlkOiBwcm9jZXNzLmVudlxuICAgICAgICAgICAgICAgIC5BV1NfQVBJR0FURVdBWV9ET01BSU5fTkFNRV9BTElBU19IT1NURURfWk9ORV9JRCBhcyBzdHJpbmcsXG4gICAgICAgICAgICBhcHBzRW52aXJvbm1lbnQ6IHByb2Nlc3MuZW52LkFQUFNfRU5WSVJPTk1FTlQgYXMgc3RyaW5nLFxuICAgICAgICAgICAgYXBwc1NlcnZpY2VOYW1lOiBwcm9jZXNzLmVudi5BUFBTX1NFUlZJQ0VfTkFNRSBhcyBzdHJpbmcsXG4gICAgICAgICAgICBhcHBzQWxsb3dlZE9yaWdpbnM6IHByb2Nlc3MuZW52LkFQUFNfQUxMT1dFRF9PUklHSU5TIGFzIHN0cmluZyxcbiAgICAgICAgICAgIGFwcHNEZWJ1ZzogcHJvY2Vzcy5lbnYuQVBQU19ERUJVRyA/PyAnJyxcbiAgICAgICAgICAgIGFwcHNEZWJ1Z0xldmVsOiBwcm9jZXNzLmVudi5BUFBTX0RFQlVHX0xFVkVMID8/ICcnLFxuICAgICAgICAgICAgYXBwc0NvbnRlbnRTZWN1cml0eVBvbGljeURvbWFpbnM6IHByb2Nlc3MuZW52LkFQUFNfQ09OVEVOVF9TRUNVUklUWV9QT0xJQ1lfRE9NQUlOUyBhcyBzdHJpbmcsXG4gICAgICAgICAgICBhcHBzRnJhbWVPcmlnaW5zOiBwcm9jZXNzLmVudi5BUFBTX0ZSQU1FX09SSUdJTlMgYXMgc3RyaW5nLFxuXG4gICAgICAgICAgICBzM1JlZ2lvbjogcHJvY2Vzcy5lbnYuQVdTX1MzX1JFR0lPTiBhcyBzdHJpbmcsXG4gICAgICAgICAgICBzM0FjY2Vzc0tleUlkOiBwcm9jZXNzLmVudi5BV1NfUzNfQUNDRVNTX0tFWV9JRCBhcyBzdHJpbmcsXG4gICAgICAgICAgICBzM1NlY3JldEFjY2Vzc0tleTogcHJvY2Vzcy5lbnYuQVdTX1MzX1NFQ1JFVF9BQ0NFU1NfS0VZIGFzIHN0cmluZyxcbiAgICAgICAgICAgIHMzQnVja2V0OiBwcm9jZXNzLmVudi5BV1NfUzNfQlVDS0VUIGFzIHN0cmluZyxcblxuICAgICAgICAgICAgYXdzQ3NzRW5hYmxlOiBwcm9jZXNzLmVudi5BV1NfQ1NTX0VOQUJMRSBhcyBzdHJpbmcsXG4gICAgICAgICAgICBhd3NDc3NVc2VybmFtZTogcHJvY2Vzcy5lbnYuQVdTX0NTU19VU0VSTkFNRSBhcyBzdHJpbmcsXG4gICAgICAgICAgICBhd3NDc3NQYXNzd29yZDogcHJvY2Vzcy5lbnYuQVdTX0NTU19QQVNTV09SRCBhcyBzdHJpbmcsXG4gICAgICAgICAgICBhd3NDc3NVcmw6IHByb2Nlc3MuZW52LkFXU19DU1NfVVJMIGFzIHN0cmluZyxcblxuICAgICAgICAgICAgZGJIb3N0OiBwcm9jZXNzLmVudi5EQl9IT1NUIGFzIHN0cmluZyxcbiAgICAgICAgICAgIGRiRGF0YWJhc2U6IHByb2Nlc3MuZW52LkRCX0RBVEFCQVNFIGFzIHN0cmluZyxcbiAgICAgICAgICAgIGRiVXNlcjogcHJvY2Vzcy5lbnYuREJfVVNFUiBhcyBzdHJpbmcsXG4gICAgICAgICAgICBkYlBhc3N3b3JkOiBwcm9jZXNzLmVudi5EQl9QQVNTV09SRCBhcyBzdHJpbmcsXG4gICAgICAgICAgICBkYlBvcnQ6IHByb2Nlc3MuZW52LkRCX1BPUlQgYXMgc3RyaW5nLFxuICAgICAgICAgICAgZGJTY2hlbWE6IHByb2Nlc3MuZW52LkRCX1NDSEVNQSBhcyBzdHJpbmcsXG4gICAgICAgICAgICBkYk5hbWU6IHByb2Nlc3MuZW52LkRCX0RBVEFCQVNFIGFzIHN0cmluZyxcbiAgICAgICAgICAgIGRiQXV4aWxpYXJVc2VyOiBwcm9jZXNzLmVudi5EQl9BVVhJTElBUl9VU0VSIGFzIHN0cmluZyxcbiAgICAgICAgICAgIGRiQXV4aWxpYXJQYXNzd29yZDogcHJvY2Vzcy5lbnYuREJfQVVYSUxJQVJfUEFTU1dPUkQgYXMgc3RyaW5nLFxuXG4gICAgICAgICAgICBkYlRlc3RIb3N0OiBwcm9jZXNzLmVudi5EQl9URVNUX0hPU1QgYXMgc3RyaW5nLFxuICAgICAgICAgICAgZGJUZXN0RGF0YWJhc2U6IHByb2Nlc3MuZW52LkRCX1RFU1RfREFUQUJBU0UgYXMgc3RyaW5nLFxuICAgICAgICAgICAgZGJUZXN0VXNlcjogcHJvY2Vzcy5lbnYuREJfVEVTVF9VU0VSIGFzIHN0cmluZyxcbiAgICAgICAgICAgIGRiVGVzdFBhc3N3b3JkOiBwcm9jZXNzLmVudi5EQl9URVNUX1BBU1NXT1JEIGFzIHN0cmluZyxcbiAgICAgICAgICAgIGRiVGVzdEF1eGlsaWFyVXNlcjogcHJvY2Vzcy5lbnYuREJfVEVTVF9BVVhJTElBUl9VU0VSIGFzIHN0cmluZyxcbiAgICAgICAgICAgIGRiVGVzdEF1eGlsaWFyUGFzc3dvcmQ6IHByb2Nlc3MuZW52LkRCX1RFU1RfQVVYSUxJQVJfUEFTU1dPUkQgYXMgc3RyaW5nLFxuICAgICAgICAgICAgZGJUZXN0TmFtZTogcHJvY2Vzcy5lbnYuREJfVEVTVF9OQU1FIGFzIHN0cmluZyxcbiAgICAgICAgICAgIGRiVGVzdFBvcnQ6IHByb2Nlc3MuZW52LkRCX1RFU1RfUE9SVCBhcyBzdHJpbmcsXG4gICAgICAgICAgICBkYlRlc3RTY2hlbWE6IHByb2Nlc3MuZW52LkRCX1RFU1RfU0NIRU1BIGFzIHN0cmluZyxcblxuICAgICAgICAgICAgc2VjcmV0S2V5OiBwcm9jZXNzLmVudi5TRUNSRVRfS0VZIGFzIHN0cmluZyxcbiAgICAgICAgICAgIHNlY3JldElWOiBwcm9jZXNzLmVudi5TRUNSRVRfSVYgYXMgc3RyaW5nLFxuICAgICAgICAgICAgZW5jcnlwdGlvbk1ldGhvZDogcHJvY2Vzcy5lbnYuRU5DUllQVElPTl9NRVRIT0QgYXMgc3RyaW5nLFxuXG4gICAgICAgICAgICBlbmFibGVBdXRoOiBpc0VuYWJsZUF1dGgsXG4gICAgICAgICAgICBjb2duaXRvVXNlclBvb2xJZDogcHJvY2Vzcy5lbnYuQVdTX0NPR05JVE9fVVNFUl9QT09MX0lEIGFzIHN0cmluZyxcbiAgICAgICAgICAgIHBhdGhIYW5kbGVyOiBwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4vc3JjL2hhbmRsZXIubWpzJyksXG5cbiAgICAgICAgICAgIGF3c0VjMlZwY0lkOiBwcm9jZXNzLmVudi5BV1NfRUMyX1ZQQ19JRCBhcyBzdHJpbmcsXG4gICAgICAgICAgICBhd3NFYzJWcGNTdWJuZXRQcml2YXRlSWRzOiBwcm9jZXNzLmVudi5BV1NfRUMyX1ZQQ19TVUJORVRfUFJJVkFURV9JRFMgYXMgc3RyaW5nLFxuICAgICAgICAgICAgYXdzRWMyVnBjQXZhaWxhYmlsaXR5Wm9uZXM6IHByb2Nlc3MuZW52LkFXU19FQzJfVlBDX0FWQUlMQUJJTElUWV9aT05FUyBhcyBzdHJpbmcsXG4gICAgICAgICAgICBhd3NFYzJWcGNQcml2YXRlU3VibmV0Um91dGVUYWJsZUlkczogcHJvY2Vzcy5lbnYuQVdTX0VDMl9WUENfUFJJVkFURV9TVUJORVRfUk9VVEVfVEFCTEVfSURTIGFzIHN0cmluZyxcbiAgICAgICAgICAgIGF3c0VjMlZwY0xhbWJkYVNlY3VyaXR5R3JvdXBJZDogcHJvY2Vzcy5lbnYuQVdTX0VDMl9WUENfTEFNQkRBX1NFQ1VSSVRZX0dST1VQX0lEIGFzIHN0cmluZyxcblxuICAgICAgICAgICAgYXdzV2FmQXJuOiBwcm9jZXNzLmVudi5BV1NfV0FGX0FSTiBhcyBzdHJpbmcsXG5cbiAgICAgICAgICAgIGF3c0NvZ25pdG9SZWdpb246IHByb2Nlc3MuZW52LkFXU19DT0dOSVRPX1JFR0lPTiBhcyBzdHJpbmcsXG4gICAgICAgICAgICBhd3NDb2duaXRvQXBwQ2xpZW50SWQ6IHByb2Nlc3MuZW52LkFXU19DT0dOSVRPX0FQUF9DTElFTlRfSUQgYXMgc3RyaW5nLFxuICAgICAgICAgICAgYXdzQ29nbml0b1VybDogcHJvY2Vzcy5lbnYuQVdTX0NPR05JVE9fVVJMIGFzIHN0cmluZyxcbiAgICAgICAgICAgIGF3c0NvZ25pdG9Vc2VyUG9vbElkOiBwcm9jZXNzLmVudi5BV1NfQ09HTklUT19VU0VSX1BPT0xfSUQgYXMgc3RyaW5nLFxuXG4gICAgICAgICAgICBhcHBzQWN0aW9uc1F1ZXVlRXhlY3V0b3JUaW1lb3V0TXM6IHByb2Nlc3MuZW52LkFQUFNfQUNUSU9OU19RVUVVRV9FWEVDVVRPUl9USU1FT1VUX01TIGFzIHN0cmluZyxcbiAgICAgICAgICAgIGFwcHNBY3Rpb25zUXVldWVFeGVjdXRpb25UaW1lb3V0TXM6IHByb2Nlc3MuZW52LkFQUFNfQUNUSU9OU19RVUVVRV9FWEVDVVRJT05fVElNRU9VVF9NUyBhcyBzdHJpbmcsXG5cbiAgICAgICAgICAgIGF3c0R5bmFtb0RiTXVsdGl0ZW5hbnRUYWJsZUFSTjogcHJvY2Vzcy5lbnYuQVdTX0RZTkFNT0RCX01VTFRJVEVOQU5UX1RBQkxFX0FSTiBhcyBzdHJpbmcsXG5cbiAgICAgICAgICAgIGF3c0Nhc2VzRXZlbnRzUXVldWVBcm46IHByb2Nlc3MuZW52LkFXU19DQVNFU19FVkVOVFNfUVVFVUVfQVJOLFxuICAgICAgICAgICAgYXdzQWN0aW9uSm9ic0V2ZW50c1F1ZXVlQXJuOiBwcm9jZXNzLmVudi5BV1NfQUNUSU9OX0pPQlNfRVZFTlRTX1FVRVVFX0FSTixcbiAgICAgICAgICAgIGF3c0F1dG9tYXRlZEFjdGlvbnNFdmVudHNRdWV1ZUFybjogcHJvY2Vzcy5lbnYuQVdTX0FVVE9NQVRFRF9BQ1RJT05TX0VWRU5UU19RVUVVRV9BUk4sXG4gICAgICAgICAgICBhd3NXc1Jlc3RFdmVudHNRdWV1ZUFybjogcHJvY2Vzcy5lbnYuQVdTX1dTX1JFU1RfRVZFTlRTX1FVRVVFX0FSTixcbiAgICAgICAgICAgIGF3c0Nhc2VQb3N0UHJvY2Vzc2luZ0V2ZW50c1F1ZXVlQXJuOiBwcm9jZXNzLmVudi5BV1NfQ0FTRV9QT1NUX1BST0NFU1NJTkdfRVZFTlRTX1FVRVVFX0FSTixcbiAgICAgICAgICAgIGF3c1JlcG9ydHNFdmVudHNRdWV1ZUFybjogcHJvY2Vzcy5lbnYuQVdTX1JFUE9SVFNfRVZFTlRTX1FVRVVFX0FSTixcbiAgICAgICAgICAgIGF3c1Nxc0V2ZW50c1F1ZXVlVXJsOiBwcm9jZXNzLmVudi5BV1NfU1FTX0VWRU5UU19RVUVVRV9VUkwgYXMgc3RyaW5nLFxuICAgICAgICAgICAgYXdzRXZlbnRCcmlkZ2VFdmVudEJ1c0FybjogcHJvY2Vzcy5lbnYuQVdTX0VWRU5UQlJJREdFX0VWRU5UX0JVU19BUk4gYXMgc3RyaW5nLFxuICAgICAgICAgICAgYXdzRXZlbnRCcmlkZ2VFdmVudEJ1c1VybDogcHJvY2Vzcy5lbnYuQVdTX0VWRU5UQlJJREdFX0VWRU5UX0JVU19VUkwgYXMgc3RyaW5nLFxuICAgICAgICB9O1xuXG4gICAgICAgIHJldHVybiBwcm9wcztcbiAgICB9XG5cbiAgICBwdWJsaWMgc2V0RGVmYXVsdE9wdGlvbnMoaWQ6IHN0cmluZywgZXh0cmFFbnY6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7fSkge1xuICAgICAgICBjb25zdCBsYW1iZGFGdW5jdGlvbiA9IHRoaXMuZ2V0Tm9kZWpzRnVuY3Rpb24oaWQpO1xuXG4gICAgICAgIGxhbWJkYUZ1bmN0aW9uLmFkZEVudmlyb25tZW50KCdEQl9UQVJHRVQnLCBnZXREYlRhcmdldChpZCkpO1xuXG4gICAgICAgIGZvciAoY29uc3QgW2tleSwgdmFsdWVdIG9mIE9iamVjdC5lbnRyaWVzKGV4dHJhRW52KSkge1xuICAgICAgICAgICAgbGFtYmRhRnVuY3Rpb24uYWRkRW52aXJvbm1lbnQoa2V5LCB2YWx1ZSk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBsYW1iZGFSZXN0QXBpID0gdGhpcy5nZXRMYW1iZGFSZXN0QXBpKGlkLCBsYW1iZGFGdW5jdGlvbik7XG5cbiAgICAgICAgY29uc3QgbWV0aG9kT3B0aW9ucyA9IHRoaXMuZ2V0TGFtYmRhUmVzdEFwaU1ldGhvZE9wdGlvbnMoKTtcblxuICAgICAgICB0aGlzLnNldERlZmF1bHRSZXNvdXJjZXMobGFtYmRhUmVzdEFwaSwgbWV0aG9kT3B0aW9ucyk7XG5cbiAgICAgICAgdGhpcy5zZXRCYXNlUGF0aChpZCwgbGFtYmRhUmVzdEFwaSk7XG5cbiAgICAgICAgdGhpcy5zZXRXYWZBc3NvY2lhdGlvbihsYW1iZGFSZXN0QXBpKTtcblxuICAgICAgICB0aGlzLmdyYW50RHluYW1vRGJQZXJtaXNzaW9ucyhpZCwgbGFtYmRhRnVuY3Rpb24pO1xuICAgIH1cblxuICAgIHB1YmxpYyBzZXRCYXNlUGF0aChpZDogc3RyaW5nLCBsYW1iZGFSZXN0QXBpOiBMYW1iZGFSZXN0QXBpKSB7XG4gICAgICAgIGlmICh0aGlzLmRvbWFpbk5hbWUpIHtcbiAgICAgICAgICAgIG5ldyBCYXNlUGF0aE1hcHBpbmcodGhpcywgYCR7aWR9X2Jhc2VQYXRoTWFwcGluZ2AsIHtcbiAgICAgICAgICAgICAgICAvLyBTT05BUi1FWEM6IEVzdGEgaW5zdGFuY2lhIGVzIG5lY2VzYXJpYSBwYXJhIGluaWNpYWxpemFyIHJlY3Vyc29zIGVuIGVsIHN0YWNrLlxuICAgICAgICAgICAgICAgIGRvbWFpbk5hbWU6IHRoaXMuZG9tYWluTmFtZSxcbiAgICAgICAgICAgICAgICByZXN0QXBpOiBsYW1iZGFSZXN0QXBpLFxuICAgICAgICAgICAgICAgIGJhc2VQYXRoOiBpZCxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHVibGljIGdldExhbWJkYVJlc3RBcGkoaWQ6IHN0cmluZywgbGFtYmRhRnVuY3Rpb246IE5vZGVqc0Z1bmN0aW9uKSB7XG4gICAgICAgIGNvbnN0IGFwaSA9IG5ldyBMYW1iZGFSZXN0QXBpKHRoaXMsIGAke2lkfV9hcGlgLCB7XG4gICAgICAgICAgICByZXN0QXBpTmFtZTogYCR7aWR9X2FwaWAsXG4gICAgICAgICAgICBoYW5kbGVyOiBsYW1iZGFGdW5jdGlvbixcbiAgICAgICAgICAgIHByb3h5OiBmYWxzZSxcbiAgICAgICAgICAgIGRlZmF1bHRDb3JzUHJlZmxpZ2h0T3B0aW9uczogdGhpcy5jb3JzUHJlZmxpZ2h0RGVmYXVsdE9wdGlvbnMoKSxcbiAgICAgICAgICAgIGVuZHBvaW50Q29uZmlndXJhdGlvbjoge1xuICAgICAgICAgICAgICAgIHR5cGVzOiBbRW5kcG9pbnRUeXBlLlJFR0lPTkFMXSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRoaXMuYWRkR2F0ZXdheVJlc3BvbnNlcyhhcGkpO1xuICAgICAgICByZXR1cm4gYXBpO1xuICAgIH1cblxuICAgIHB1YmxpYyBhZGRHYXRld2F5UmVzcG9uc2VzKGFwaTogTGFtYmRhUmVzdEFwaSkge1xuICAgICAgICBjb25zdCBhbGxvd2VkT3JpZ2lucyA9IHRoaXMuY29uZmlnLmFwcHNBbGxvd2VkT3JpZ2lucztcblxuICAgICAgICBuZXcgR2F0ZXdheVJlc3BvbnNlKHRoaXMsICdHYXRld2F5UmVzcG9uc2VEZWZhdWx0NFhYJywge1xuICAgICAgICAgICAgcmVzdEFwaTogYXBpLFxuICAgICAgICAgICAgdHlwZTogUmVzcG9uc2VUeXBlLkRFRkFVTFRfNFhYLFxuICAgICAgICAgICAgcmVzcG9uc2VIZWFkZXJzOiB7XG4gICAgICAgICAgICAgICAgJ0FjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpbic6IGAnJHthbGxvd2VkT3JpZ2lucy5zcGxpdCgnLCcpWzBdfSdgLFxuICAgICAgICAgICAgICAgICdBY2Nlc3MtQ29udHJvbC1BbGxvdy1IZWFkZXJzJzogXCInQ29udGVudC1UeXBlLEF1dGhvcml6YXRpb24sWC1UZW5hbnQtSWQnXCIsXG4gICAgICAgICAgICAgICAgJ0FjY2Vzcy1Db250cm9sLUFsbG93LU1ldGhvZHMnOiBcIidHRVQsUE9TVCxPUFRJT05TJ1wiLFxuICAgICAgICAgICAgICAgICdBY2Nlc3MtQ29udHJvbC1BbGxvdy1DcmVkZW50aWFscyc6IFwiJ3RydWUnXCIsXG4gICAgICAgICAgICB9LFxuICAgICAgICB9KTtcblxuICAgICAgICBuZXcgR2F0ZXdheVJlc3BvbnNlKHRoaXMsICdHYXRld2F5UmVzcG9uc2VEZWZhdWx0NVhYJywge1xuICAgICAgICAgICAgcmVzdEFwaTogYXBpLFxuICAgICAgICAgICAgdHlwZTogUmVzcG9uc2VUeXBlLkRFRkFVTFRfNVhYLFxuICAgICAgICAgICAgcmVzcG9uc2VIZWFkZXJzOiB7XG4gICAgICAgICAgICAgICAgJ0FjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpbic6IGAnJHthbGxvd2VkT3JpZ2lucy5zcGxpdCgnLCcpWzBdfSdgLFxuICAgICAgICAgICAgICAgICdBY2Nlc3MtQ29udHJvbC1BbGxvdy1IZWFkZXJzJzogXCInQ29udGVudC1UeXBlLEF1dGhvcml6YXRpb24sWC1UZW5hbnQtSWQnXCIsXG4gICAgICAgICAgICAgICAgJ0FjY2Vzcy1Db250cm9sLUFsbG93LU1ldGhvZHMnOiBcIidHRVQsUE9TVCxPUFRJT05TJ1wiLFxuICAgICAgICAgICAgICAgICdBY2Nlc3MtQ29udHJvbC1BbGxvdy1DcmVkZW50aWFscyc6IFwiJ3RydWUnXCIsXG4gICAgICAgICAgICB9LFxuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBwdWJsaWMgZ2V0Tm9kZWpzRnVuY3Rpb24oaWQ6IHN0cmluZywgb3ZlcnJpZGVzPzogUGFydGlhbDxOb2RlanNGdW5jdGlvblByb3BzPikge1xuICAgICAgICBjb25zdCBsb2dHcm91cCA9IG5ldyBMb2dHcm91cCh0aGlzLCBgJHtpZH1fbG9nR3JvdXBgLCB7XG4gICAgICAgICAgICByZXRlbnRpb246IFJldGVudGlvbkRheXMuT05FX01PTlRILFxuICAgICAgICAgICAgLy8gRnVlcmEgZGUgcHJvZHVjdGlvbiBlbCBsb2cgZ3JvdXAgc2UgZWxpbWluYSBhbCBkZXN0cnVpciBlbCBzdGFjayBwYXJhIG5vIGRlamFyIHJlY3Vyc29zIGh1w6lyZmFub3MuXG4gICAgICAgICAgICByZW1vdmFsUG9saWN5OiB0aGlzLmNvbmZpZy5lbnZpcm9ubWVudCA9PT0gJ3Byb2R1Y3Rpb24nID8gUmVtb3ZhbFBvbGljeS5SRVRBSU4gOiBSZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgICAgIH0pO1xuXG4gICAgICAgIHJldHVybiBuZXcgTm9kZWpzRnVuY3Rpb24odGhpcywgYCR7aWR9X2xhbWJkYWAsIHtcbiAgICAgICAgICAgIGVudHJ5OiB0aGlzLmNvbmZpZy5wYXRoSGFuZGxlcixcbiAgICAgICAgICAgIC4uLnRoaXMubm9kZWpzRnVuY3Rpb25EZWZhdWx0UHJvcHMoKSxcbiAgICAgICAgICAgIGxvZ0dyb3VwLFxuICAgICAgICAgICAgLi4ub3ZlcnJpZGVzLFxuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBwdWJsaWMgc2V0RGVmYXVsdFJlc291cmNlcyhsYW1iZGFSZXN0QXBpOiBMYW1iZGFSZXN0QXBpLCBtZXRob2RPcHRpb25zPzogTWV0aG9kT3B0aW9ucykge1xuICAgICAgICB0aGlzLnNldEluZGV4UmVzb3VyY2UobGFtYmRhUmVzdEFwaSwgbWV0aG9kT3B0aW9ucyk7XG4gICAgICAgIHRoaXMuc2V0Q3JlYXRlUmVzb3VyY2UobGFtYmRhUmVzdEFwaSwgbWV0aG9kT3B0aW9ucyk7XG4gICAgICAgIHRoaXMuc2V0UmVhZFJlc291cmNlKGxhbWJkYVJlc3RBcGksIG1ldGhvZE9wdGlvbnMpO1xuICAgICAgICB0aGlzLnNldFVwZGF0ZVJlc291cmNlKGxhbWJkYVJlc3RBcGksIG1ldGhvZE9wdGlvbnMpO1xuICAgICAgICB0aGlzLnNldERlbGV0ZVJlc291cmNlKGxhbWJkYVJlc3RBcGksIG1ldGhvZE9wdGlvbnMpO1xuICAgICAgICB0aGlzLnNldFNlYXJjaFJlc291cmNlKGxhbWJkYVJlc3RBcGksIG1ldGhvZE9wdGlvbnMpO1xuICAgICAgICB0aGlzLnNldEhpc3RvcnlSZXNvdXJjZShsYW1iZGFSZXN0QXBpLCBtZXRob2RPcHRpb25zKTtcbiAgICAgICAgdGhpcy5zZXRBZHZhbmNlU2VhcmNoUmVzb3VyY2UobGFtYmRhUmVzdEFwaSwgbWV0aG9kT3B0aW9ucyk7XG4gICAgfVxuXG4gICAgcHVibGljIGNyZWF0ZUNvZ25pdG9Vc2VyUG9vbHNBdXRob3JpemVyKCkge1xuICAgICAgICByZXR1cm4gbmV3IENvZ25pdG9Vc2VyUG9vbHNBdXRob3JpemVyKHRoaXMsICdDb2duaXRvVXNlclBvb2xzQXV0aG9yaXplcicsIHtcbiAgICAgICAgICAgIGNvZ25pdG9Vc2VyUG9vbHM6IFtVc2VyUG9vbC5mcm9tVXNlclBvb2xJZCh0aGlzLCAnVXNlclBvb2wnLCB0aGlzLmNvbmZpZy5jb2duaXRvVXNlclBvb2xJZCldLFxuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBwdWJsaWMgc2V0SW5kZXhSZXNvdXJjZShsYW1iZGFSZXN0QXBpOiBMYW1iZGFSZXN0QXBpLCBtZXRob2RPcHRpb25zPzogTWV0aG9kT3B0aW9ucykge1xuICAgICAgICBsYW1iZGFSZXN0QXBpLnJvb3QuYWRkTWV0aG9kKCdHRVQnLCB1bmRlZmluZWQsIG1ldGhvZE9wdGlvbnMpO1xuICAgIH1cblxuICAgIHB1YmxpYyBzZXRDcmVhdGVSZXNvdXJjZShsYW1iZGFSZXN0QXBpOiBMYW1iZGFSZXN0QXBpLCBtZXRob2RPcHRpb25zPzogTWV0aG9kT3B0aW9ucykge1xuICAgICAgICBsYW1iZGFSZXN0QXBpLnJvb3QuYWRkTWV0aG9kKCdQT1NUJywgdW5kZWZpbmVkLCBtZXRob2RPcHRpb25zKTtcbiAgICB9XG5cbiAgICBwdWJsaWMgc2V0UmVhZFJlc291cmNlKGxhbWJkYVJlc3RBcGk6IExhbWJkYVJlc3RBcGksIG1ldGhvZE9wdGlvbnM/OiBNZXRob2RPcHRpb25zKSB7XG4gICAgICAgIGNvbnN0IGlkUmVzb3VyY2UgPSBsYW1iZGFSZXN0QXBpLnJvb3QuZ2V0UmVzb3VyY2UoJ3tpZH0nKSA/PyBsYW1iZGFSZXN0QXBpLnJvb3QuYWRkUmVzb3VyY2UoJ3tpZH0nKTtcbiAgICAgICAgaWRSZXNvdXJjZS5hZGRNZXRob2QoJ0dFVCcsIHVuZGVmaW5lZCwgbWV0aG9kT3B0aW9ucyk7XG4gICAgfVxuXG4gICAgcHVibGljIHNldFVwZGF0ZVJlc291cmNlKGxhbWJkYVJlc3RBcGk6IExhbWJkYVJlc3RBcGksIG1ldGhvZE9wdGlvbnM/OiBNZXRob2RPcHRpb25zKSB7XG4gICAgICAgIGNvbnN0IGlkUmVzb3VyY2UgPSBsYW1iZGFSZXN0QXBpLnJvb3QuZ2V0UmVzb3VyY2UoJ3tpZH0nKSA/PyBsYW1iZGFSZXN0QXBpLnJvb3QuYWRkUmVzb3VyY2UoJ3tpZH0nKTtcbiAgICAgICAgaWRSZXNvdXJjZS5hZGRNZXRob2QoJ1BPU1QnLCB1bmRlZmluZWQsIG1ldGhvZE9wdGlvbnMpO1xuICAgIH1cblxuICAgIHB1YmxpYyBzZXREZWxldGVSZXNvdXJjZShsYW1iZGFSZXN0QXBpOiBMYW1iZGFSZXN0QXBpLCBtZXRob2RPcHRpb25zPzogTWV0aG9kT3B0aW9ucykge1xuICAgICAgICBjb25zdCBpZFJlc291cmNlID0gbGFtYmRhUmVzdEFwaS5yb290LmdldFJlc291cmNlKCd7aWR9JykgPz8gbGFtYmRhUmVzdEFwaS5yb290LmFkZFJlc291cmNlKCd7aWR9Jyk7XG4gICAgICAgIGNvbnN0IGRlbGV0ZVJlc291cmNlID0gaWRSZXNvdXJjZS5hZGRSZXNvdXJjZSgnZGVsZXRlJyk7XG4gICAgICAgIGRlbGV0ZVJlc291cmNlLmFkZE1ldGhvZCgnR0VUJywgdW5kZWZpbmVkLCBtZXRob2RPcHRpb25zKTtcbiAgICB9XG5cbiAgICBwdWJsaWMgc2V0SGlzdG9yeVJlc291cmNlKGxhbWJkYVJlc3RBcGk6IExhbWJkYVJlc3RBcGksIG1ldGhvZE9wdGlvbnM/OiBNZXRob2RPcHRpb25zKSB7XG4gICAgICAgIGNvbnN0IGlkUmVzb3VyY2UgPSBsYW1iZGFSZXN0QXBpLnJvb3QuZ2V0UmVzb3VyY2UoJ3tpZH0nKSA/PyBsYW1iZGFSZXN0QXBpLnJvb3QuYWRkUmVzb3VyY2UoJ3tpZH0nKTtcbiAgICAgICAgY29uc3QgaGlzdG9yeVJlc291cmNlID0gaWRSZXNvdXJjZS5hZGRSZXNvdXJjZSgnaGlzdG9yeScpO1xuICAgICAgICBoaXN0b3J5UmVzb3VyY2UuYWRkTWV0aG9kKCdQT1NUJywgdW5kZWZpbmVkLCBtZXRob2RPcHRpb25zKTtcbiAgICB9XG5cbiAgICBwdWJsaWMgc2V0U2VhcmNoUmVzb3VyY2UobGFtYmRhUmVzdEFwaTogTGFtYmRhUmVzdEFwaSwgbWV0aG9kT3B0aW9ucz86IE1ldGhvZE9wdGlvbnMpIHtcbiAgICAgICAgY29uc3Qgc2VhcmNoUmVzb3VyY2UgPSBsYW1iZGFSZXN0QXBpLnJvb3QuYWRkUmVzb3VyY2UoJ3NlYXJjaCcpO1xuICAgICAgICBzZWFyY2hSZXNvdXJjZS5hZGRNZXRob2QoJ1BPU1QnLCB1bmRlZmluZWQsIG1ldGhvZE9wdGlvbnMpO1xuICAgIH1cblxuICAgIHNldEFkdmFuY2VTZWFyY2hSZXNvdXJjZShsYW1iZGFSZXN0QXBpOiBMYW1iZGFSZXN0QXBpLCBtZXRob2RPcHRpb25zPzogTWV0aG9kT3B0aW9ucykge1xuICAgICAgICBjb25zdCBhZHZhbmNlU2VhcmNoUmVzb3VyY2UgPSBsYW1iZGFSZXN0QXBpLnJvb3QuYWRkUmVzb3VyY2UoJ2FkdmFuY2Utc2VhcmNoJyk7XG4gICAgICAgIGFkdmFuY2VTZWFyY2hSZXNvdXJjZS5hZGRNZXRob2QoJ1BPU1QnLCB1bmRlZmluZWQsIG1ldGhvZE9wdGlvbnMpO1xuICAgIH1cblxuICAgIHB1YmxpYyBjb3JzUHJlZmxpZ2h0RGVmYXVsdE9wdGlvbnMoKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBhbGxvd09yaWdpbnM6IHRoaXMuY29uZmlnLmFwcHNBbGxvd2VkT3JpZ2lucy5zcGxpdCgnLCcpLFxuICAgICAgICAgICAgYWxsb3dNZXRob2RzOiBbJ0dFVCcsICdQT1NUJywgJ09QVElPTlMnXSxcbiAgICAgICAgICAgIGFsbG93SGVhZGVyczogW1xuICAgICAgICAgICAgICAgICdDb250ZW50LVR5cGUnLFxuICAgICAgICAgICAgICAgICdYLUFtei1EYXRlJyxcbiAgICAgICAgICAgICAgICAnQXV0aG9yaXphdGlvbicsXG4gICAgICAgICAgICAgICAgJ1gtQXBpLUtleScsXG4gICAgICAgICAgICAgICAgJ1gtQW16LVNlY3VyaXR5LVRva2VuJyxcbiAgICAgICAgICAgICAgICAnWC1BbXotVXNlci1BZ2VudCcsXG4gICAgICAgICAgICAgICAgJ1gtQ2xpZW50LUZpbmdlcnByaW50JyxcbiAgICAgICAgICAgICAgICAnWC1UZW5hbnQtSWQnLFxuICAgICAgICAgICAgICAgICdVc2VyLUFnZW50JyxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgICBhbGxvd0NyZWRlbnRpYWxzOiB0cnVlLFxuICAgICAgICB9O1xuICAgIH1cblxuICAgIHB1YmxpYyBub2RlanNGdW5jdGlvbkRlZmF1bHRQcm9wcygpOiBOb2RlanNGdW5jdGlvblByb3BzIHtcbiAgICAgICAgbGV0IHByb3BzID0ge307XG4gICAgICAgIGlmICh0aGlzLmlzU3RhZ2luZ09yUHJvZHVjdGlvbigpICYmIHRoaXMudnBjICYmIHRoaXMubGFtYmRhU0cpIHtcbiAgICAgICAgICAgIHByb3BzID0ge1xuICAgICAgICAgICAgICAgIHZwYzogdGhpcy52cGMsXG4gICAgICAgICAgICAgICAgdnBjU3VibmV0czoge1xuICAgICAgICAgICAgICAgICAgICBzdWJuZXRUeXBlOiBTdWJuZXRUeXBlLlBSSVZBVEVfV0lUSF9FR1JFU1MsXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBzZWN1cml0eUdyb3VwczogW3RoaXMubGFtYmRhU0ddLFxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCBlbnZpcm9ubWVudDtcbiAgICAgICAgaWYgKHRoaXMuY29uZmlnLmVudmlyb25tZW50ID09PSAnbG9jYWwnKSB7XG4gICAgICAgICAgICBlbnZpcm9ubWVudCA9IHtcbiAgICAgICAgICAgICAgICBOT0RFX0VOVjogdGhpcy5jb25maWcuZW52aXJvbm1lbnQsXG4gICAgICAgICAgICAgICAgLy8gREJfVEFSR0VUIHJvdXRlcyByZWFkczsgdGhlIHJlYWRlciBob3N0IGlzIHBlci10ZW5hbnQgKGRiX2hvc3RfcmVhZGVyIGZyb20gRHluYW1vKSwgc28gbm8gZ2xvYmFsIERCX0hPU1RfUkVBREVSIGVudiBpcyBpbmplY3RlZC5cbiAgICAgICAgICAgICAgICBEQl9UQVJHRVQ6ICdwcmltYXJ5JyxcbiAgICAgICAgICAgICAgICBBUElfVkVSU0lPTjogS0FwaVN0YWNrLmdldEFwaVZlcnNpb24oKSxcbiAgICAgICAgICAgICAgICBUQVJHRVRfRFlOQU1PREJfVEFCTEU6IGAke3RoaXMuY29uZmlnLmFwcHNTZXJ2aWNlTmFtZX1fa2FjZV9tdWx0aV90ZW5hbmN5YCxcbiAgICAgICAgICAgICAgICBUQVJHRVRfRFlOQU1PREJfUkVHSU9OOiB0aGlzLmNvbmZpZy5hd3NDb2duaXRvUmVnaW9uLFxuICAgICAgICAgICAgICAgIC8vIEZ1ZW50ZSDDum5pY2EgZGVsIG1vZG8gZGVsIFNRTCBndWFyZDogc2UgbGVlIGRlbCAuZW52IHJhw616IGVuIHN5bnRoLiBEZWZhdWx0IGVuZm9yY2UgKGZhaWwtc2FmZSkuXG4gICAgICAgICAgICAgICAgU1FMX0dVQVJEX01PREU6IHByb2Nlc3MuZW52LlNRTF9HVUFSRF9NT0RFIHx8ICdlbmZvcmNlJyxcblxuICAgICAgICAgICAgICAgIC4uLnRoaXMubm9kZWpzRnVuY3Rpb25BcHBFbnZWYXIoKSxcbiAgICAgICAgICAgICAgICAuLi50aGlzLm5vZGVqc0Z1bmN0aW9uRGJFbnZWYXIoKSxcbiAgICAgICAgICAgICAgICAuLi50aGlzLm5vZGVqc0Z1bmN0aW9uU2VjcmV0c0VudlZhcigpLFxuICAgICAgICAgICAgICAgIC4uLnRoaXMubm9kZWpzRnVuY3Rpb25TM0VudlZhcigpLFxuICAgICAgICAgICAgICAgIC4uLnRoaXMubm9kZWpzRnVuY3Rpb25BV1NDU1NFbnZWYXIoKSxcbiAgICAgICAgICAgIH07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBlbnZpcm9ubWVudCA9IHtcbiAgICAgICAgICAgICAgICBOT0RFX0VOVjogdGhpcy5jb25maWcuZW52aXJvbm1lbnQsXG4gICAgICAgICAgICAgICAgLy8gREJfVEFSR0VUIHJvdXRlcyByZWFkczsgdGhlIHJlYWRlciBob3N0IGlzIHBlci10ZW5hbnQgKGRiX2hvc3RfcmVhZGVyIGZyb20gRHluYW1vKSwgc28gbm8gZ2xvYmFsIERCX0hPU1RfUkVBREVSIGVudiBpcyBpbmplY3RlZC5cbiAgICAgICAgICAgICAgICBEQl9UQVJHRVQ6ICdwcmltYXJ5JyxcbiAgICAgICAgICAgICAgICBBUElfVkVSU0lPTjogS0FwaVN0YWNrLmdldEFwaVZlcnNpb24oKSxcbiAgICAgICAgICAgICAgICBUQVJHRVRfRFlOQU1PREJfVEFCTEU6IGAke3RoaXMuY29uZmlnLmFwcHNTZXJ2aWNlTmFtZX1fa2FjZV9tdWx0aV90ZW5hbmN5YCxcbiAgICAgICAgICAgICAgICBUQVJHRVRfRFlOQU1PREJfUkVHSU9OOiB0aGlzLmNvbmZpZy5hd3NDb2duaXRvUmVnaW9uLFxuICAgICAgICAgICAgICAgIEFQUFNfREVCVUc6IHRoaXMuY29uZmlnLmFwcHNEZWJ1ZyxcbiAgICAgICAgICAgICAgICBBUFBTX0RFQlVHX0xFVkVMOiB0aGlzLmNvbmZpZy5hcHBzRGVidWdMZXZlbCxcbiAgICAgICAgICAgICAgICAvLyBGdWVudGUgw7puaWNhIGRlbCBtb2RvIGRlbCBTUUwgZ3VhcmQ6IHNlIGxlZSBkZWwgLmVudiByYcOteiBlbiBzeW50aC4gRGVmYXVsdCBlbmZvcmNlIChmYWlsLXNhZmUpLlxuICAgICAgICAgICAgICAgIFNRTF9HVUFSRF9NT0RFOiBwcm9jZXNzLmVudi5TUUxfR1VBUkRfTU9ERSB8fCAnZW5mb3JjZScsXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGJ1bmRsaW5nOiB7XG4gICAgICAgICAgICAgICAgbm9kZU1vZHVsZXM6IEtBcGlTdGFjay5ERUZBVUxUX0JVTkRMRURfTk9ERV9NT0RVTEVTLFxuICAgICAgICAgICAgICAgIGZvcmNlRG9ja2VyQnVuZGxpbmc6IHRydWUsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgdGltZW91dDogRHVyYXRpb24uc2Vjb25kcygzMCksXG4gICAgICAgICAgICBlbnZpcm9ubWVudDogZW52aXJvbm1lbnQsXG4gICAgICAgICAgICBydW50aW1lOiBSdW50aW1lLk5PREVKU18yMl9YLFxuICAgICAgICAgICAgbWVtb3J5U2l6ZTogNTEyLFxuICAgICAgICAgICAgLi4ucHJvcHMsXG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgcHVibGljIG5vZGVqc0Z1bmN0aW9uU2VjcmV0c0VudlZhcigpIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIFNFQ1JFVF9LRVk6IHRoaXMuY29uZmlnLnNlY3JldEtleSxcbiAgICAgICAgICAgIFNFQ1JFVF9JVjogdGhpcy5jb25maWcuc2VjcmV0SVYsXG4gICAgICAgICAgICBFTkNSWVBUSU9OX01FVEhPRDogdGhpcy5jb25maWcuZW5jcnlwdGlvbk1ldGhvZCxcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICBwdWJsaWMgbm9kZWpzRnVuY3Rpb25EYkVudlZhcigpIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIERCX0hPU1Q6IHRoaXMuY29uZmlnLmRiSG9zdCxcbiAgICAgICAgICAgIERCX0RBVEFCQVNFOiB0aGlzLmNvbmZpZy5kYkRhdGFiYXNlLFxuICAgICAgICAgICAgREJfVVNFUjogdGhpcy5jb25maWcuZGJVc2VyLFxuICAgICAgICAgICAgREJfUEFTU1dPUkQ6IHRoaXMuY29uZmlnLmRiUGFzc3dvcmQsXG4gICAgICAgICAgICBEQl9QT1JUOiB0aGlzLmNvbmZpZy5kYlBvcnQsXG4gICAgICAgICAgICBEQl9TQ0hFTUE6IHRoaXMuY29uZmlnLmRiU2NoZW1hLFxuICAgICAgICAgICAgREJfQVVYSUxJQVJfVVNFUjogdGhpcy5jb25maWcuZGJBdXhpbGlhclVzZXIsXG4gICAgICAgICAgICBEQl9BVVhJTElBUl9QQVNTV09SRDogdGhpcy5jb25maWcuZGJBdXhpbGlhclBhc3N3b3JkLFxuICAgICAgICAgICAgREJfTkFNRTogdGhpcy5jb25maWcuZGJOYW1lLFxuICAgICAgICAgICAgREJfVEVTVF9IT1NUOiB0aGlzLmNvbmZpZy5kYlRlc3RIb3N0LFxuICAgICAgICAgICAgREJfVEVTVF9EQVRBQkFTRTogdGhpcy5jb25maWcuZGJUZXN0RGF0YWJhc2UsXG4gICAgICAgICAgICBEQl9URVNUX1VTRVI6IHRoaXMuY29uZmlnLmRiVGVzdFVzZXIsXG4gICAgICAgICAgICBEQl9URVNUX1BBU1NXT1JEOiB0aGlzLmNvbmZpZy5kYlRlc3RQYXNzd29yZCxcbiAgICAgICAgICAgIERCX1RFU1RfQVVYSUxJQVJfVVNFUjogdGhpcy5jb25maWcuZGJUZXN0QXV4aWxpYXJVc2VyLFxuICAgICAgICAgICAgREJfVEVTVF9BVVhJTElBUl9QQVNTV09SRDogdGhpcy5jb25maWcuZGJUZXN0QXV4aWxpYXJQYXNzd29yZCxcbiAgICAgICAgICAgIERCX1RFU1RfTkFNRTogdGhpcy5jb25maWcuZGJUZXN0TmFtZSxcbiAgICAgICAgICAgIERCX1RFU1RfUE9SVDogdGhpcy5jb25maWcuZGJUZXN0UG9ydCxcbiAgICAgICAgICAgIERCX1RFU1RfU0NIRU1BOiB0aGlzLmNvbmZpZy5kYlRlc3RTY2hlbWEsXG4gICAgICAgICAgICBBV1NfRFlOQU1PREJfTVVMVElURU5BTlRfVEFCTEVfQVJOOiB0aGlzLmNvbmZpZy5hd3NEeW5hbW9EYk11bHRpdGVuYW50VGFibGVBUk4sXG4gICAgICAgICAgICBBV1NfU1FTX0VWRU5UU19RVUVVRV9VUkw6IHRoaXMuY29uZmlnLmF3c1Nxc0V2ZW50c1F1ZXVlVXJsLFxuICAgICAgICAgICAgQVdTX0VWRU5UQlJJREdFX0VWRU5UX0JVU19BUk46IHRoaXMuY29uZmlnLmF3c0V2ZW50QnJpZGdlRXZlbnRCdXNBcm4sXG4gICAgICAgICAgICBBV1NfRVZFTlRCUklER0VfRVZFTlRfQlVTX1VSTDogdGhpcy5jb25maWcuYXdzRXZlbnRCcmlkZ2VFdmVudEJ1c1VybCxcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICBwdWJsaWMgbm9kZWpzRnVuY3Rpb25TM0VudlZhcigpIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIFMzX0FXU19CVUNLRVQ6IHRoaXMuY29uZmlnLnMzQnVja2V0LFxuICAgICAgICAgICAgUzNfQVdTX0FDQ0VTU19LRVlfSUQ6IHRoaXMuY29uZmlnLnMzQWNjZXNzS2V5SWQsXG4gICAgICAgICAgICBTM19BV1NfU0VDUkVUX0FDQ0VTU19LRVk6IHRoaXMuY29uZmlnLnMzU2VjcmV0QWNjZXNzS2V5LFxuICAgICAgICAgICAgUzNfQVdTX1JFR0lPTjogdGhpcy5jb25maWcuczNSZWdpb24sXG4gICAgICAgICAgICBBV1NfUzNfQlVDS0VUOiB0aGlzLmNvbmZpZy5zM0J1Y2tldCxcbiAgICAgICAgICAgIEFXU19TM19BQ0NFU1NfS0VZX0lEOiB0aGlzLmNvbmZpZy5zM0FjY2Vzc0tleUlkLFxuICAgICAgICAgICAgQVdTX1MzX1NFQ1JFVF9BQ0NFU1NfS0VZOiB0aGlzLmNvbmZpZy5zM1NlY3JldEFjY2Vzc0tleSxcbiAgICAgICAgICAgIEFXU19TM19SRUdJT046IHRoaXMuY29uZmlnLnMzUmVnaW9uLFxuICAgICAgICB9O1xuICAgIH1cblxuICAgIHB1YmxpYyBub2RlanNGdW5jdGlvbkFwcEVudlZhcigpIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIEFQUFNfRU5WSVJPTk1FTlQ6IHRoaXMuY29uZmlnLmVudmlyb25tZW50LFxuICAgICAgICAgICAgQVBQU19TRVJWSUNFX05BTUU6IHRoaXMuY29uZmlnLmFwcHNTZXJ2aWNlTmFtZSxcbiAgICAgICAgICAgIEFQUFNfREVCVUc6IHRoaXMuY29uZmlnLmFwcHNEZWJ1ZyxcbiAgICAgICAgICAgIEFQUFNfREVCVUdfTEVWRUw6IHRoaXMuY29uZmlnLmFwcHNEZWJ1Z0xldmVsLFxuICAgICAgICAgICAgQVBQU19ET01BSU46IHRoaXMuY29uZmlnLmRvbWFpbixcbiAgICAgICAgICAgIFNVQkRPTUFJTjogcHJvY2Vzcy5lbnYuQVBQU19BUElfU1VCRE9NQUlOIGFzIHN0cmluZyxcbiAgICAgICAgICAgIEFQUFNfQVBJX1NVQkRPTUFJTjogcHJvY2Vzcy5lbnYuQVBQU19BUElfU1VCRE9NQUlOIGFzIHN0cmluZyxcbiAgICAgICAgICAgIEFQUFNfQURNSU5fU1VCRE9NQUlOOiBwcm9jZXNzLmVudi5BUFBTX0FETUlOX1NVQkRPTUFJTiBhcyBzdHJpbmcsXG4gICAgICAgICAgICBBUFBTX0FMTE9XRURfT1JJR0lOUzogdGhpcy5jb25maWcuYXBwc0FsbG93ZWRPcmlnaW5zLFxuICAgICAgICAgICAgQVBQU19DT05URU5UX1NFQ1VSSVRZX1BPTElDWV9ET01BSU5TOiB0aGlzLmNvbmZpZy5hcHBzQ29udGVudFNlY3VyaXR5UG9saWN5RG9tYWlucyxcbiAgICAgICAgICAgIEFQUFNfRlJBTUVfT1JJR0lOUzogdGhpcy5jb25maWcuYXBwc0ZyYW1lT3JpZ2lucyxcbiAgICAgICAgICAgIEFQUFNfQ0VSVElGSUNBVEVfRE9NQUlOX0FSTjogcHJvY2Vzcy5lbnYuQVBQU19DRVJUSUZJQ0FURV9ET01BSU5fQVJOIGFzIHN0cmluZyxcbiAgICAgICAgICAgIEFQUFNfSE9TVEVEX1pPTkVfSUQ6IHByb2Nlc3MuZW52LkFQUFNfSE9TVEVEX1pPTkVfSUQgYXMgc3RyaW5nLFxuICAgICAgICAgICAgQVBQU19FWEVDVVRFX1JFU1RfSE9PS19TRVJWSUNFX1VSTDogcHJvY2Vzcy5lbnYuQVBQU19FWEVDVVRFX1JFU1RfSE9PS19TRVJWSUNFX1VSTCBhcyBzdHJpbmcsXG4gICAgICAgICAgICBBUFBTX1RJTUVPVVRfUkVTVF9GTE9XU19WQUxVRV9NUzogcHJvY2Vzcy5lbnYuQVBQU19USU1FT1VUX1JFU1RfRkxPV1NfVkFMVUVfTVMgYXMgc3RyaW5nLFxuICAgICAgICAgICAgQVBQU19BQ1RJT05TX1FVRVVFX0VYRUNVVE9SX1RJTUVPVVRfTVM6IHByb2Nlc3MuZW52LkFQUFNfQUNUSU9OU19RVUVVRV9FWEVDVVRPUl9USU1FT1VUX01TIGFzIHN0cmluZyxcbiAgICAgICAgICAgIEFQUFNfQUNUSU9OU19RVUVVRV9FWEVDVVRJT05fVElNRU9VVF9NUzogcHJvY2Vzcy5lbnYuQVBQU19BQ1RJT05TX1FVRVVFX0VYRUNVVElPTl9USU1FT1VUX01TIGFzIHN0cmluZyxcbiAgICAgICAgICAgIFRJTUVaT05FOiBwcm9jZXNzLmVudi5USU1FWk9ORSBhcyBzdHJpbmcsXG4gICAgICAgICAgICBBV1NfQ09HTklUT19SRUdJT046IHRoaXMuY29uZmlnLmF3c0NvZ25pdG9SZWdpb24sXG4gICAgICAgICAgICBBV1NfQ09HTklUT19BUFBfQ0xJRU5UX0lEOiB0aGlzLmNvbmZpZy5hd3NDb2duaXRvQXBwQ2xpZW50SWQsXG4gICAgICAgICAgICBBV1NfQ09HTklUT19VUkw6IHRoaXMuY29uZmlnLmF3c0NvZ25pdG9VcmwsXG4gICAgICAgICAgICBBV1NfQ09HTklUT19VU0VSX1BPT0xfSUQ6IHRoaXMuY29uZmlnLmF3c0NvZ25pdG9Vc2VyUG9vbElkLFxuICAgICAgICB9O1xuICAgIH1cblxuICAgIHB1YmxpYyBnZXRMYW1iZGFSZXN0QXBpTWV0aG9kT3B0aW9ucygpIHtcbiAgICAgICAgbGV0IG1ldGhvZE9wdGlvbnMgPSB1bmRlZmluZWQ7XG4gICAgICAgIGlmICh0aGlzLmNvbmZpZy5lbmFibGVBdXRoKSB7XG4gICAgICAgICAgICBjb25zdCBhdXRob3JpemVyID0gdGhpcy5jcmVhdGVDb2duaXRvVXNlclBvb2xzQXV0aG9yaXplcigpO1xuXG4gICAgICAgICAgICBtZXRob2RPcHRpb25zID0ge1xuICAgICAgICAgICAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBBdXRob3JpemF0aW9uVHlwZS5DT0dOSVRPLFxuICAgICAgICAgICAgICAgIGF1dGhvcml6ZXI6IGF1dGhvcml6ZXIsXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG1ldGhvZE9wdGlvbnM7XG4gICAgfVxuXG4gICAgbm9kZWpzRnVuY3Rpb25BV1NDU1NFbnZWYXIoKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBBV1NfQ1NTX0VOQUJMRTogdGhpcy5jb25maWcuYXdzQ3NzRW5hYmxlLFxuICAgICAgICAgICAgQVdTX0NTU19VU0VSTkFNRTogdGhpcy5jb25maWcuYXdzQ3NzVXNlcm5hbWUsXG4gICAgICAgICAgICBBV1NfQ1NTX1BBU1NXT1JEOiB0aGlzLmNvbmZpZy5hd3NDc3NQYXNzd29yZCxcbiAgICAgICAgICAgIEFXU19DU1NfVVJMOiB0aGlzLmNvbmZpZy5hd3NDc3NVcmwsXG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgcHVibGljIHNldFdhZkFzc29jaWF0aW9uKGFwaTogTGFtYmRhUmVzdEFwaSkge1xuICAgICAgICBpZiAodGhpcy5pc1N0YWdpbmdPclByb2R1Y3Rpb24oKSAmJiB0aGlzLmNvbmZpZy5hd3NXYWZBcm4pIHtcbiAgICAgICAgICAgIG5ldyBDZm5XZWJBQ0xBc3NvY2lhdGlvbih0aGlzLCAnQXBpV2ViQWNsQXNzb2MnLCB7XG4gICAgICAgICAgICAgICAgcmVzb3VyY2VBcm46IGFwaS5kZXBsb3ltZW50U3RhZ2Uuc3RhZ2VBcm4sXG4gICAgICAgICAgICAgICAgd2ViQWNsQXJuOiB0aGlzLmNvbmZpZy5hd3NXYWZBcm4sXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHB1YmxpYyBpc1N0YWdpbmdPclByb2R1Y3Rpb24oKTogYm9vbGVhbiB7XG4gICAgICAgIHJldHVybiBbJ3Byb2R1Y3Rpb24nLCAnc3RhZ2luZyddLmluY2x1ZGVzKHRoaXMuY29uZmlnLmFwcHNFbnZpcm9ubWVudCk7XG4gICAgfVxuXG4gICAgcHVibGljIHN0YXRpYyBnZXRBcGlWZXJzaW9uKCk6IHN0cmluZyB7XG4gICAgICAgIGlmICghdGhpcy52ZXJzaW9uKSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHBhY2thZ2VQYXRoID0gcGF0aC5yZXNvbHZlKHByb2Nlc3MuY3dkKCksICdwYWNrYWdlLmpzb24nKTtcbiAgICAgICAgICAgICAgICBjb25zdCBjb250ZW50ID0gcmVhZEZpbGVTeW5jKHBhY2thZ2VQYXRoLCAndXRmOCcpO1xuICAgICAgICAgICAgICAgIGNvbnN0IHBhcnNlZCA9IEpTT04ucGFyc2UoY29udGVudCk7XG4gICAgICAgICAgICAgICAgdGhpcy52ZXJzaW9uID0gdHlwZW9mIHBhcnNlZC52ZXJzaW9uID09PSAnc3RyaW5nJyA/IHBhcnNlZC52ZXJzaW9uIDogJ3Vua25vd24nO1xuICAgICAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oJ+KaoO+4jyBObyBzZSBwdWRvIGxlZXIgbGEgdmVyc2nDs24gZGVzZGUgcGFja2FnZS5qc29uOicsIGVyci5tZXNzYWdlKTtcbiAgICAgICAgICAgICAgICB0aGlzLnZlcnNpb24gPSAndW5rbm93bic7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdGhpcy52ZXJzaW9uO1xuICAgIH1cblxuICAgIHB1YmxpYyBncmFudEV2ZW50UHVibGlzaGluZ1Blcm1pc3Npb25zKGxhbWJkYUZ1bmN0aW9uOiBOb2RlanNGdW5jdGlvbikge1xuICAgICAgICAvLyBQaGFzZSAzIOKAlCBwZXItQkMgcXVldWVzLiBFYWNoIHByb2R1Y2VyIGdldHMgcGVybWlzc2lvbiB0byBBTEwgcXVldWVzO1xuICAgICAgICAvLyByZXN0cmljdGluZyBwZXItZXZlbnQgaXMgbW9yZSBjb2RlIHdpdGggbm8gc2VjdXJpdHkgYmVuZWZpdCAodGhlIHByb2R1Y2VyXG4gICAgICAgIC8vIGFscmVhZHkgY29udHJvbHMgaXRzIG93biBwdWJsaXNoIHRhcmdldHMpLlxuICAgICAgICBjb25zdCBwZXJCY0FybnMgPSBbXG4gICAgICAgICAgICB0aGlzLmNvbmZpZy5hd3NDYXNlc0V2ZW50c1F1ZXVlQXJuLFxuICAgICAgICAgICAgdGhpcy5jb25maWcuYXdzQWN0aW9uSm9ic0V2ZW50c1F1ZXVlQXJuLFxuICAgICAgICAgICAgdGhpcy5jb25maWcuYXdzQXV0b21hdGVkQWN0aW9uc0V2ZW50c1F1ZXVlQXJuLFxuICAgICAgICAgICAgdGhpcy5jb25maWcuYXdzV3NSZXN0RXZlbnRzUXVldWVBcm4sXG4gICAgICAgICAgICB0aGlzLmNvbmZpZy5hd3NDYXNlUG9zdFByb2Nlc3NpbmdFdmVudHNRdWV1ZUFybixcbiAgICAgICAgICAgIHRoaXMuY29uZmlnLmF3c1JlcG9ydHNFdmVudHNRdWV1ZUFybixcbiAgICAgICAgXS5maWx0ZXIoKGFybik6IGFybiBpcyBzdHJpbmcgPT4gQm9vbGVhbihhcm4pKTtcblxuICAgICAgICBpZiAocGVyQmNBcm5zLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIGxhbWJkYUZ1bmN0aW9uLmFkZFRvUm9sZVBvbGljeShcbiAgICAgICAgICAgICAgICBuZXcgUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICAgICAgICAgICAgZWZmZWN0OiBFZmZlY3QuQUxMT1csXG4gICAgICAgICAgICAgICAgICAgIGFjdGlvbnM6IFsnc3FzOlNlbmRNZXNzYWdlJ10sXG4gICAgICAgICAgICAgICAgICAgIHJlc291cmNlczogcGVyQmNBcm5zLFxuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICApO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuY29uZmlnLmF3c0V2ZW50QnJpZGdlRXZlbnRCdXNBcm4pIHtcbiAgICAgICAgICAgIGxhbWJkYUZ1bmN0aW9uLmFkZFRvUm9sZVBvbGljeShcbiAgICAgICAgICAgICAgICBuZXcgUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICAgICAgICAgICAgZWZmZWN0OiBFZmZlY3QuQUxMT1csXG4gICAgICAgICAgICAgICAgICAgIGFjdGlvbnM6IFsnZXZlbnRzOlB1dEV2ZW50cyddLFxuICAgICAgICAgICAgICAgICAgICByZXNvdXJjZXM6IFt0aGlzLmNvbmZpZy5hd3NFdmVudEJyaWRnZUV2ZW50QnVzQXJuXSxcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHB1YmxpYyBncmFudER5bmFtb0RiUGVybWlzc2lvbnMoaWQ6IHN0cmluZywgbGFtYmRhRnVuY3Rpb246IE5vZGVqc0Z1bmN0aW9uKSB7XG4gICAgICAgIGlmICh0aGlzLmNvbmZpZy5hd3NEeW5hbW9EYk11bHRpdGVuYW50VGFibGVBUk4pIHtcbiAgICAgICAgICAgIGxhbWJkYUZ1bmN0aW9uLmFkZFRvUm9sZVBvbGljeShcbiAgICAgICAgICAgICAgICBuZXcgUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICAgICAgICAgICAgZWZmZWN0OiBFZmZlY3QuQUxMT1csXG4gICAgICAgICAgICAgICAgICAgIGFjdGlvbnM6IFsnZHluYW1vZGI6R2V0SXRlbScsICdkeW5hbW9kYjpTY2FuJywgJ2R5bmFtb2RiOlF1ZXJ5J10sXG4gICAgICAgICAgICAgICAgICAgIHJlc291cmNlczogW3RoaXMuY29uZmlnLmF3c0R5bmFtb0RiTXVsdGl0ZW5hbnRUYWJsZUFSTl0sXG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ05vIHNlIGhhIGRlZmluaWRvIGxhIHRhYmxhIGRlIHNlcnZpY2lvcycpO1xuICAgICAgICB9XG4gICAgfVxufVxuIl19
