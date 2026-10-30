import { Duration } from 'aws-cdk-lib';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { PolicyStatement, Effect } from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import * as path from 'path';

export interface OrchestratorConfig {
    /** Nombre del endpoint (ej: 'actions-queue-executions') */
    endpoint: string;
    /** ARN del Lambda target a invocar por cada tenant */
    targetLambdaArn: string;
    /** CDK Construct padre */
    scope: Construct;
    /** Sufijo único para el nombre del Lambda (opcional) */
    suffix?: string;
    /** Timeout en minutos (default: 10) */
    timeoutMinutes?: number;
    /** Memory en MB (default: 512) */
    memorySize?: number;
}

/**
 * Helper para crear EventBridge Orchestrator Lambda
 *
 * Crea un Lambda que:
 * 1. Consulta todos los tenants de DynamoDB
 * 2. Invoca el target Lambda para cada tenant
 *
 * @example
 * ```typescript
 * const orchestrator = OrchestratorHelper.createOrchestrator({
 *     endpoint: 'actions-queue-executions',
 *     targetLambdaArn: lambdaFunction.functionArn,
 *     scope: this,
 *     suffix: this.node.addr,
 * });
 *
 * // Usar con EventBridge
 * scheduleRule.addTarget(new LambdaFunction(orchestrator));
 * ```
 */
export class OrchestratorHelper {
    /**
     * Crea un Lambda orchestrator para multi-tenant scheduled events
     */
    static createOrchestrator(config: OrchestratorConfig): NodejsFunction {
        const { endpoint, targetLambdaArn, scope, suffix, timeoutMinutes = 10, memorySize = 512 } = config;

        // Crear Lambda orchestrator
        const functionName = suffix ? `${suffix}${endpoint}-orch` : `${endpoint}-orch`;
        const orchestratorFunction = new NodejsFunction(scope, `${endpoint}OrchestratorFunction`, {
            functionName,
            entry: path.join(
                __dirname,
                '../../../kace_cloud_api_common/src/handlers/eventbridge-orchestrator.mjs'
            ),
            runtime: Runtime.NODEJS_22_X,
            timeout: Duration.minutes(timeoutMinutes),
            memorySize,
            environment: {
                TARGET_LAMBDA_ARN: targetLambdaArn,
                NODE_OPTIONS: '--enable-source-maps',
                TARGET_DYNAMODB_TABLE: `${suffix}_kace_multi_tenancy`,
            },
            bundling: {
                minify: false,
                sourceMap: true,
                externalModules: ['@aws-sdk/*'],
                nodeModules: ['pg', 'knex', 'uuid', 'bcrypt', 'dayjs', 'jsonwebtoken'],
                forceDockerBundling: true,
            },
        });

        // Permiso para invocar target Lambda
        orchestratorFunction.addToRolePolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: ['lambda:InvokeFunction'],
                resources: [targetLambdaArn],
            })
        );

        // Permiso para leer tenants de DynamoDB
        orchestratorFunction.addToRolePolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: ['dynamodb:Scan', 'dynamodb:GetItem'],
                resources: [`arn:aws:dynamodb:*:*:table/${suffix}_kace_multi_tenancy`],
            })
        );

        return orchestratorFunction;
    }
}
