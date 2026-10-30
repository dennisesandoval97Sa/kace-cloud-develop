import { HttpResponse, withTenantContext } from '@kace/api-common';
import { BulkCloseController } from './BulkCloseController.mjs';
import { BulkDeleteController } from './BulkDeleteController.mjs';
import { BulkMoveController } from './BulkMoveController.mjs';
import { AgentMoveDestinationsController } from './AgentMoveDestinationsController.mjs';

export const baseHandler = async (event) => {
    const { knexConfig } = event.tenantContext;

    let controller;

    if (event.resource === '/agent/{id}/move-destinations' && event.httpMethod === 'GET') {
        controller = new AgentMoveDestinationsController(
            { ...event, originalResource: event.originalResource ?? event.resource, resource: '/' },
            knexConfig
        );
    } else if ((event.resource === '/move' || event.resource === '/agent/move') && event.httpMethod === 'POST') {
        controller = new BulkMoveController(
            { ...event, originalResource: event.originalResource ?? event.resource, resource: '/' },
            knexConfig
        );
    } else if ((event.resource === '/close' || event.resource === '/agent/close') && event.httpMethod === 'POST') {
        controller = new BulkCloseController(
            { ...event, originalResource: event.originalResource ?? event.resource, resource: '/' },
            knexConfig
        );
    } else if (event.resource === '/delete' && event.httpMethod === 'POST') {
        controller = new BulkDeleteController({ ...event, resource: '/' }, knexConfig);
    } else {
        return HttpResponse.notFound({ event }).toJson();
    }

    const response = await controller.run();

    return response.toJson();
};

export const handler = withTenantContext(baseHandler);
