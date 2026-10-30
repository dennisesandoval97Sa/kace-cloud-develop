import {TenantContext, Helper} from '@kace/core/src/shared';

/**
 * Middy middleware para ejecutar handler dentro del contexto de tenant (AsyncLocalStorage)
 *
 * Este middleware DEBE usarse DESPUÉS de tenantMiddleware:
 *
 * @example
 * import middy from '@middy/core';
 * import {tenantMiddleware, tenantContextMiddleware} from '@kace/api-common';
 *
 * const handler = middy(baseHandler)
 *   .use(tenantMiddleware())         // 1. Load tenant
 *   .use(tenantContextMiddleware()); // 2. Run in context
 */
const tenantContextMiddleware = () => {
    return {
        before: async (request) => {
            const tenant = request.context?.tenant;
            const startTime = request.internal?.startTime || Date.now();

            if (!tenant) {
                Helper.logDebug('tenantContextMiddleware: No tenant found, skipping context');
                return;
            }

            // Store original handler
            if (!request.internal.originalHandler) {
                request.internal.originalHandler = request.handler;
            }

            // Wrap handler in TenantContext
            request.handler = async (event, context) => {
                return await TenantContext.run(tenant, async () => {
                    Helper.logInfo('Request started', {
                        path: event.path || event.rawPath,
                        method: event.httpMethod || event.requestContext?.http?.method,
                        requestId: context?.requestId,
                    });

                    try {
                        // Call original handler
                        const result = await request.internal.originalHandler(event, context);

                        // Log metrics
                        const duration = Date.now() - startTime;
                        Helper.logMetric('APILatency', duration, 'Milliseconds');

                        return result;
                    } catch (error) {
                        Helper.logError(error);
                        // Error already logged by onError hook
                        throw error;
                    }
                });
            };
        }
    };
};

export {tenantContextMiddleware};
