import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import DynamoTenantRepository from '@kace/core/src/tenant/infrastructure/aws/DynamoTenantRepository.js';
import { Helper } from '@kace/core/src/shared/index.js';

const lambdaClient = new LambdaClient({});
const tenantRepository = new DynamoTenantRepository();

/**
 * EventBridge Orchestrator Lambda
 *
 * Ejecuta handlers multi-tenant para eventos programados (cron/schedule).
 *
 * Flujo:
 * 1. EventBridge dispara este orchestrator según schedule
 * 2. Orchestrator consulta todos los tenants activos desde DynamoDB
 * 3. Para cada tenant, invoca el Lambda target con tenant_id en event.detail
 *
 * Variables de entorno requeridas:
 * - TARGET_LAMBDA_ARN: ARN del Lambda handler a ejecutar por cada tenant
 *
 * @param {Object} event - Evento de EventBridge
 * @param {string} event.source - aws.events
 * @param {Object} event.detail - Detalles del evento (puede incluir configuración adicional)
 */
export const handler = async (event, context) => {
    const targetLambdaArn = process.env.TARGET_LAMBDA_ARN;

    if (!targetLambdaArn) {
        throw new Error('TARGET_LAMBDA_ARN environment variable is required');
    }

    Helper.logDebug('EventBridge Orchestrator started', {
        targetLambda: targetLambdaArn,
        eventSource: event.source,
    });

    try {
        // 1. Consultar todos los tenants activos
        const tenants = await tenantRepository.findAll();

        Helper.logDebug(`Found ${tenants.length} tenants to process`);

        if (tenants.length === 0) {
            Helper.logDebug('No tenants found - skipping execution');
            return {
                statusCode: 200,
                processedTenants: 0,
                message: 'No tenants to process',
            };
        }

        // 2. Ejecutar Lambda para cada tenant en paralelo
        const results = await Promise.allSettled(
            tenants.map(async (tenant) => {
                const tenantId = tenant.id?.value;

                if (!tenantId) {
                    Helper.logDebug('Tenant missing ID, skipping', { tenant });
                    return { success: false, tenantId: null, error: 'Missing tenant ID' };
                }

                try {
                    // Construir evento para el handler target
                    const targetEvent = {
                        source: 'aws.events',
                        'detail-type': 'Scheduled Event via Orchestrator',
                        detail: {
                            tenant_id: tenantId,
                            orchestrated: true,
                            originalEvent: event.detail || {},
                        },
                        time: new Date().toISOString(),
                    };

                    Helper.logDebug(`Invoking Lambda for tenant: ${tenantId}`);

                    const command = new InvokeCommand({
                        FunctionName: targetLambdaArn,
                        InvocationType: 'Event', // Asíncrono - no espera respuesta
                        Payload: JSON.stringify(targetEvent),
                    });

                    await lambdaClient.send(command);

                    return { success: true, tenantId };
                } catch (error) {
                    Helper.logError(`Failed to invoke Lambda for tenant: ${tenantId}`, {
                        error: error.message,
                        stack: error.stack,
                    });

                    return { success: false, tenantId, error: error.message };
                }
            })
        );

        // 3. Procesar resultados
        const successful = results.filter((r) => r.status === 'fulfilled' && r.value.success).length;
        const failed = results.filter(
            (r) => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)
        ).length;

        Helper.logDebug('EventBridge Orchestrator completed', {
            totalTenants: tenants.length,
            successful,
            failed,
        });

        // Log de fallos para debugging
        if (failed > 0) {
            const failures = results
                .filter((r) => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success))
                .map((r) => ({
                    tenantId: r.status === 'fulfilled' ? r.value.tenantId : 'unknown',
                    error: r.status === 'fulfilled' ? r.value.error : r.reason?.message,
                }));

            Helper.logError('Some tenant invocations failed', { failures });
        }

        return {
            statusCode: 200,
            processedTenants: tenants.length,
            successful,
            failed,
        };
    } catch (error) {
        Helper.logError('EventBridge Orchestrator fatal error', {
            error: error.message,
            stack: error.stack,
        });

        throw error;
    }
};
