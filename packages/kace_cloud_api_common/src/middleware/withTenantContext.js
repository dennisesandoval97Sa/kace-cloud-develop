import { TenantContextManager } from './TenantContextManager.js';
import { TenantContext } from '@kace/core/src/shared';
import { Helper } from '@kace/core/src/shared';
import { DbRequestContext } from '../db-routing/DbRequestContext.js';
import { HttpResponse } from '../http_responses/HttpResponse.js';
import { TENANT_CONTEXT_ERROR } from '@kace/error-codes';

/**
 * HOC (Higher Order Component) para agregar contexto de tenant a handlers sin Middy
 *
 * Este wrapper carga la configuración del tenant desde DynamoDB y la inyecta
 * en el event antes de ejecutar el handler.
 *
 * @param {Function} handler - Lambda handler function
 * @param {Object} opts - Opciones
 * @param {string[]} opts.skipPaths - Rutas que no requieren tenant context
 *
 * @returns {Function} Handler wrapped con tenant context
 *
 * @example
 * import {withTenantContext} from '@kace/api-common/middleware';
 *
 * const baseHandler = async (event) => {
 *   const {knexConfig, tenantConfig} = event.tenantContext;
 *   const controller = new Controller(event, knexConfig);
 *   return await controller.run();
 * };
 *
 * export const handler = withTenantContext(baseHandler);
 */
export const withTenantContext = (handler, opts = {}) => {
    const options = {
        skipPaths: ['/health', '/healthcheck', '/_health'],
        ...opts,
    };

    return async (event, context, callback) => {
        const startTime = Date.now();

        try {
            // Skip para rutas específicas
            const path = event.path || event.rawPath;
            if (options.skipPaths.includes(path)) {
                Helper.logDebug('withTenantContext: Skipping for path', { path });
                return await handler(event, context, callback);
            }

            // Extract tenant ID
            const tenantId = TenantContextManager.extractTenantId(event);

            // Load tenant configuration
            const tenant = await TenantContextManager.getTenant(tenantId);

            // Read per-invocation (not hoisted) so tests can toggle DB_TARGET; the cost is a single string compare.
            const preferReplica = process.env.DB_TARGET === 'replica';
            const knexConfig = TenantContextManager.buildKnexConfig(tenant, { preferReplica });
            const readerConfig = preferReplica
                ? TenantContextManager.buildReaderConfig(tenant, { preferReplica })
                : knexConfig;
            Helper.logDebug(`withTenantContext: tenantId ${tenant.id.value} dbHost ${tenant.db_host.value}`);
            event.tenantContext = {
                tenant,
                knexConfig,
                readerConfig,
                preferReplica,
                tenant_id: tenantId,
            };

            const contextLoadDuration = Date.now() - startTime;

            // 🔥 RUN HANDLER IN TENANT CONTEXT (AsyncLocalStorage)
            return await TenantContext.run(tenant, async () => {
                Helper.logDebug('Request started', {
                    path: event.path || event.rawPath,
                    method: event.httpMethod || event.requestContext?.http?.method,
                    requestId: context.requestId,
                });

                Helper.logDebug('Tenant context loaded', {
                    duration: contextLoadDuration,
                    cacheHit: contextLoadDuration < 10, // Less than 10ms likely cache hit
                });

                try {
                    // Execute handler
                    const result = await DbRequestContext.run(() => handler(event, context, callback));

                    // Log success metrics
                    const totalDuration = Date.now() - startTime;
                    Helper.logMetric('APIRequest', 1);
                    Helper.logMetric('APILatency', totalDuration, 'Milliseconds');
                    Helper.logInfo('Request completed', {
                        duration: totalDuration,
                        statusCode: result?.statusCode,
                    });

                    return result;
                } catch (handlerError) {
                    // Log error with full context
                    Helper.logError('Request failed', handlerError);
                    Helper.logMetric('APIError', 1);
                    throw handlerError;
                }
            });
        } catch (error) {
            Helper.logError(error);
            // Handle errors outside tenant context (tenant loading errors, etc.)
            const statusCode = error.message.includes('not found') ? 404 : 400;
            const responseEvent = {
                ...event,
                kContext: {
                    ...(event?.kContext ?? {}),
                    awsRequestId: context?.awsRequestId ?? context?.requestId ?? event?.requestContext?.requestId,
                },
            };

            const response =
                statusCode === 404
                    ? HttpResponse.notFound({ errors: error, event: responseEvent, code: TENANT_CONTEXT_ERROR })
                    : HttpResponse.badRequest({ errors: error, event: responseEvent, code: TENANT_CONTEXT_ERROR });

            return response.toJson();
        }
    };
};
