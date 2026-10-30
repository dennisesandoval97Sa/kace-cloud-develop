import { withTenantContext } from '@kace/api-common';
import { Controller } from './controller.mjs';
import { ControllerPreview } from './controllerPreview.mjs';
import { ControllerClassifications } from './controllerClassifications.mjs';

const baseHandler = async (event) => {
    const { knexConfig } = event.tenantContext;

    let controller;

    if (event.resource === '/preview' && event.httpMethod === 'POST') {
        controller = new ControllerPreview({ ...event, resource: '/' }, knexConfig);
    } else if (event.resource === '/{id}/classifications' && event.httpMethod === 'GET') {
        controller = new ControllerClassifications({ ...event, resource: '/{id}' }, knexConfig);
    } else {
        controller = new Controller(event, knexConfig);
    }

    const response = await controller.run();

    return response.toJson();
};

export const handler = withTenantContext(baseHandler);
