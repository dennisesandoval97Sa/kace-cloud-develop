import { HttpResponse, withTenantContext } from '@kace/api-common';
import { BulkTransitionController } from './BulkTransitionController.mjs';
import { BulkCloseController } from './BulkCloseController.mjs';
import { BulkAssignController } from './BulkAssignController.mjs';

export const baseHandler = async (event) => {
    const { knexConfig } = event.tenantContext;

    let controller;

    if (event.resource === '/transition' && event.httpMethod === 'POST') {
        controller = new BulkTransitionController({ ...event, resource: '/' }, knexConfig);
    } else if (event.resource === '/close' && event.httpMethod === 'POST') {
        controller = new BulkCloseController({ ...event, resource: '/' }, knexConfig);
    } else if (event.resource === '/assign' && event.httpMethod === 'POST') {
        controller = new BulkAssignController({ ...event, resource: '/' }, knexConfig);
    } else {
        return HttpResponse.notFound({ event }).toJson();
    }

    const response = await controller.run();

    return response.toJson();
};

export const handler = withTenantContext(baseHandler);
