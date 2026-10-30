import { withTenantContext } from '@kace/api-common';
import { Controller } from './controller.mjs';
import { CustomController } from './customController.mjs';

const baseHandler = async (event) => {
    const { knexConfig } = event.tenantContext;
    const customResources = new Set(['/batch', '/batch/delete']);

    if (event.resource === '/agenda/{agendaId}/group/{groupId}') {
        event.resource = '/{id}';
    }

    if (event.resource === '/agenda/{agendaId}/group/{groupId}/delete') {
        event.resource = '/{id}/delete';
    }

    const controller = customResources.has(event.resource)
        ? new CustomController(event, knexConfig)
        : new Controller(event, knexConfig);

    const response = await controller.run();

    return response.toJson();
};

export const handler = withTenantContext(baseHandler);
