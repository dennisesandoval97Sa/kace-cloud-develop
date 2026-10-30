import { withTenantContext } from '@kace/api-common';
import { Controller } from './controller.mjs';
import { ControllerSend } from './ControllerSend.mjs';
import { ControllerReply } from './ControllerReply.mjs';
import { ControllerDownload } from './ControllerDownload.mjs';

const baseHandler = async (event) => {
    const { knexConfig } = event.tenantContext;

    if (event.httpMethod === 'POST' && event.resource === '/send') {
        const controller = new ControllerSend({ ...event, resource: '/' }, knexConfig);
        const response = await controller.run();
        return response.toJson();
    }

    if (event.httpMethod === 'POST' && event.resource === '/reply') {
        const controller = new ControllerReply({ ...event, resource: '/' }, knexConfig);
        const response = await controller.run();
        return response.toJson();
    }

    if (event.httpMethod === 'GET' && event.resource === '/{id}/download') {
        const controller = new ControllerDownload({ ...event, resource: '/{id}' }, knexConfig);
        const response = await controller.run();
        return response.toJson();
    }

    const controller = new Controller(event, knexConfig);
    const response = await controller.run();
    return response.toJson();
};

export const handler = withTenantContext(baseHandler);
