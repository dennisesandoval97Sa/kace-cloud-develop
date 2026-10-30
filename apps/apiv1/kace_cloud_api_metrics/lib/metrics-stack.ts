import { Construct } from 'constructs';
import { KApiStack, KApiStackProps } from '@kace/aws-infra/src/KApiStack';
import { Duration, RemovalPolicy, StackProps, CfnOutput } from 'aws-cdk-lib';
import { NodejsFunction, NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { SubnetType } from 'aws-cdk-lib/aws-ec2';
import { Runtime } from 'aws-cdk-lib/aws-lambda';

export class MetricsStack extends KApiStack {
    static readonly ENDPOINT = 'metrics';
    static readonly LAMBDA_TIMEOUT_SECONDS = 10;
    static readonly LAMBDA_MEMORY_SIZE = 256;
    static readonly API_THROTTLE_RATE_LIMIT = 100;
    static readonly API_THROTTLE_BURST_LIMIT = 200;
    static readonly TTL_DAYS = 10;

    constructor(scope: Construct, id: string, props: StackProps, kProps: KApiStackProps) {
        super(scope, id, props, kProps);

        const stage = this.config.appsEnvironment;

        // ────────────────────────────────────────────────────
        // DynamoDB Table — Web Vitals metrics (separate from multitenant table)
        // ────────────────────────────────────────────────────

        const table = new dynamodb.Table(this, 'WebVitalsTable', {
            tableName: `${process.env.APPS_SERVICE_NAME}_kace_web_vitals`,
            partitionKey: { name: 'date', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            timeToLiveAttribute: 'ttl',
            removalPolicy: this.isStagingOrProduction() ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
        });

        table.addGlobalSecondaryIndex({
            indexName: 'MetricsByName',
            partitionKey: { name: 'name', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
            projectionType: dynamodb.ProjectionType.INCLUDE,
            nonKeyAttributes: ['value', 'rating', 'url', 'appVersion'],
        });

        // ────────────────────────────────────────────────────
        // Lambda Function
        // ────────────────────────────────────────────────────

        const lambdaFunction = this.getNodejsFunction(MetricsStack.ENDPOINT);

        // Grant write access to the web vitals table (not the multitenant table)
        table.grantWriteData(lambdaFunction);

        // Add table name and TTL to Lambda environment
        lambdaFunction.addEnvironment('WEB_VITALS_TABLE_NAME', table.tableName);
        lambdaFunction.addEnvironment('TTL_DAYS', MetricsStack.TTL_DAYS.toString());

        // ────────────────────────────────────────────────────
        // API Gateway — Public endpoint (no auth)
        // ────────────────────────────────────────────────────

        const api = new apigateway.RestApi(this, 'MetricsApi', {
            restApiName: `${stage}-kace-metrics`,
            description: 'Web Vitals metrics collection endpoint',
            deployOptions: {
                stageName: stage,
                throttlingRateLimit: MetricsStack.API_THROTTLE_RATE_LIMIT,
                throttlingBurstLimit: MetricsStack.API_THROTTLE_BURST_LIMIT,
            },
            defaultCorsPreflightOptions: {
                allowOrigins: apigateway.Cors.ALL_ORIGINS,
                allowMethods: ['POST', 'OPTIONS'],
                allowHeaders: ['Content-Type'],
                maxAge: Duration.hours(1),
            },
        });

        const metricsResource = api.root.addResource('metrics');
        metricsResource.addMethod('POST', new apigateway.LambdaIntegration(lambdaFunction, { proxy: true }));

        // ────────────────────────────────────────────────────
        // Outputs
        // ────────────────────────────────────────────────────

        new CfnOutput(this, 'MetricsApiUrl', {
            value: api.url,
            description: 'Metrics API Gateway URL',
            exportName: `${this.config.appsServiceName}-MetricsApiUrl`,
        });

        new CfnOutput(this, 'MetricsTableName', {
            value: table.tableName,
            description: 'DynamoDB table for web vitals metrics',
            exportName: `${this.config.appsServiceName}-MetricsTableName`,
        });

        new CfnOutput(this, 'MetricsEndpoint', {
            value: `${api.url}metrics`,
            description: 'Full metrics endpoint URL for frontend VITE_METRICS_API_URL',
            exportName: `${this.config.appsServiceName}-MetricsEndpoint`,
        });
    }

    // Override: no need for multitenant DynamoDB permissions
    public grantDynamoDbPermissions(_id: string, _lambdaFunction: NodejsFunction) {
        // Intentionally empty — this service uses its own WebVitals table,
        // permissions are granted directly in the constructor.
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

        return {
            bundling: {
                nodeModules: [...KApiStack.DEFAULT_BUNDLED_NODE_MODULES, 'joi'],
                forceDockerBundling: true,
            },
            timeout: Duration.seconds(MetricsStack.LAMBDA_TIMEOUT_SECONDS),
            environment: {
                NODE_ENV: this.config.environment,
                API_VERSION: KApiStack.getApiVersion(),
                STAGE: this.config.appsEnvironment,
            },
            runtime: Runtime.NODEJS_22_X,
            memorySize: MetricsStack.LAMBDA_MEMORY_SIZE,
            ...props,
        };
    }
}
