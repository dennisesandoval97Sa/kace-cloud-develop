import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';
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
export declare class OrchestratorHelper {
    /**
     * Crea un Lambda orchestrator para multi-tenant scheduled events
     */
    static createOrchestrator(config: OrchestratorConfig): NodejsFunction;
}
