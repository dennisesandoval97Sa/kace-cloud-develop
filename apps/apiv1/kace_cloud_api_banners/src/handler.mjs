import {withTenantContext} from '@kace/api-common';
import {Controller} from './Controller.mjs';

/**
 * ⚠️ MIGRADO A MULTI-TENANT MIDDLEWARE
 *
 * ANTES (configuración estática):
 * const controller = new Controller(event, knexConfig);
 *
 * AHORA (configuración dinámica por tenant):
 * knexConfig viene de event.tenantContext.knexConfig (inyectado por withTenantContext)
 */

const baseHandler = async (event) => {
    // knexConfig dinámico inyectado por el middleware
    const {knexConfig} = event.tenantContext;

    const controller = new Controller(event, knexConfig);

    const response = await controller.run();

    return response.toJson();
};

// Wrapper con tenant context middleware
export const handler = withTenantContext(baseHandler);
