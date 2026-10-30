import path from 'node:path';
import { SERVICE_MANIFEST, DEFAULT_ROUTES } from './service-manifest.mjs';
import { expressToApiGatewayEvent } from './event-adapter.mjs';

const APIV1_DIR = path.resolve(import.meta.dirname, '../../../apps/apiv1');

/**
 * Discovers all Lambda handlers and registers Express routes for each service.
 *
 * @param {import('express').Express} app - Express application
 * @returns {Promise<{serviceCount: number, routeCount: number, skipped: string[]}>}
 */
export async function registerAllRoutes(app) {
    let serviceCount = 0;
    let routeCount = 0;
    const skipped = [];

    for (const service of SERVICE_MANIFEST) {
        if (service.excluded) {
            skipped.push(`${service.directory} (${service.excludeReason})`);
            continue;
        }

        const handlerPath = path.join(APIV1_DIR, service.directory, 'src', 'handler.mjs');

        try {
            const handlerModule = await import(handlerPath);
            const handler = handlerModule.handler;

            if (typeof handler !== 'function') {
                skipped.push(`${service.directory} (handler is not a function)`);
                continue;
            }

            const routes = service.skipDefaultRoutes
                ? [...service.customRoutes]
                : [...DEFAULT_ROUTES, ...service.customRoutes];

            const sortedRoutes = sortRoutes(routes);

            for (const route of sortedRoutes) {
                const expressPath = buildExpressPath(service.basePath, route.resource);
                const expressMethod = route.method.toLowerCase();

                app[expressMethod](expressPath, createRouteHandler(handler, route.resource, service.basePath));
                routeCount++;
            }

            serviceCount++;
            console.log(`  ✓ /${service.basePath} (${routes.length} routes)`);
        } catch (error) {
            skipped.push(`${service.directory} (${error.message})`);
        }
    }

    return { serviceCount, routeCount, skipped };
}

/**
 * Creates an Express route handler that invokes the Lambda handler.
 *
 * @param {Function} handler - Lambda handler function
 * @param {string} resource - API Gateway resource pattern
 * @param {string} basePath - Service base path (for logging)
 * @returns {import('express').RequestHandler}
 */
function createRouteHandler(handler, resource, basePath) {
    return async (req, res) => {
        try {
            const pathParams = extractPathParams(resource, req.params);
            const event = expressToApiGatewayEvent(req, resource, pathParams);

            const lambdaContext = {
                requestId: event.requestContext.requestId,
                functionName: `kace_cloud_api_${basePath.replace(/-/g, '_')}`,
                memoryLimitInMB: '256',
                getRemainingTimeInMillis: () => 30000,
            };

            const result = await handler(event, lambdaContext);

            const statusCode = result.statusCode || 200;
            const responseHeaders = result.headers || {};
            const body = result.body || '';

            res.status(statusCode);

            for (const [key, value] of Object.entries(responseHeaders)) {
                res.set(key, value);
            }

            res.send(body);
        } catch (error) {
            console.error(`Error in ${req.method} /${basePath}${resource}:`, error.message);
            res.status(500).json({
                error: true,
                message: `Internal server error: ${error.message}`,
                service: basePath,
                resource,
            });
        }
    };
}

/**
 * Converts an API Gateway resource pattern to an Express route path.
 *
 * Examples:
 *   '/' + 'cases'                -> '/cases'
 *   '/{id}' + 'cases'            -> '/cases/:id'
 *   '/{id}/transition' + 'cases' -> '/cases/:id/transition'
 *   '/auxiliary/{id}' + 'cases'  -> '/cases/auxiliary/:id'
 *
 * @param {string} basePath - Service base path
 * @param {string} resource - API Gateway resource pattern
 * @returns {string} Express route path
 */
function buildExpressPath(basePath, resource) {
    const expressResource = resource.replace(/\{(\w+)\}/g, ':$1');

    if (expressResource === '/') {
        return `/${basePath}`;
    }

    return `/${basePath}${expressResource}`;
}

/**
 * Extracts path parameters from Express params based on the API Gateway resource pattern.
 *
 * @param {string} resource - API Gateway resource pattern (e.g., '/{id}/transition')
 * @param {Object} expressParams - Express req.params (e.g., { id: 'abc-123' })
 * @returns {Object|null} API Gateway pathParameters or null
 */
function extractPathParams(resource, expressParams) {
    const paramNames = [...resource.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);

    if (paramNames.length === 0) {
        return null;
    }

    const params = {};
    for (const name of paramNames) {
        if (expressParams[name] !== undefined) {
            params[name] = expressParams[name];
        }
    }

    return Object.keys(params).length > 0 ? params : null;
}

/**
 * Sorts routes so static paths are registered before parameterized ones.
 * This prevents '/search' from being captured by '/:id'.
 *
 * Priority:
 * 1. Static paths (no parameters) first
 * 2. Longer (more specific) paths first within same category
 * 3. Same-length paths sorted alphabetically for deterministic order
 *
 * @param {Array<{method: string, resource: string}>} routes
 * @returns {Array<{method: string, resource: string}>}
 */
function sortRoutes(routes) {
    return [...routes].sort((a, b) => {
        const aHasParam = a.resource.includes('{');
        const bHasParam = b.resource.includes('{');

        // Static paths first
        if (aHasParam && !bHasParam) return 1;
        if (!aHasParam && bHasParam) return -1;

        // Count params - fewer params first (more specific)
        const aParamCount = (a.resource.match(/\{/g) || []).length;
        const bParamCount = (b.resource.match(/\{/g) || []).length;
        if (aParamCount !== bParamCount) return aParamCount - bParamCount;

        // Longer (more specific) paths first
        if (b.resource.length !== a.resource.length) {
            return b.resource.length - a.resource.length;
        }

        // Alphabetical for deterministic order
        return a.resource.localeCompare(b.resource);
    });
}
