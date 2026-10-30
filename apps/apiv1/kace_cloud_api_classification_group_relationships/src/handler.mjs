import {withTenantContext} from '@kace/api-common';
import { Controller } from './controller.mjs';

const baseHandler = async (event) => {
    const {knexConfig} = event.tenantContext;

    if (event.resource === '/classification/{classificationId}/group/{groupId}') {
        event.resource = '/{id}';
    }
    if (event.resource === '/classification/{classificationId}/group/{groupId}/delete') {
        event.resource = '/{id}/delete';
    }

    const controller = new Controller(event, knexConfig);

    const response = await controller.run();

    return response.toJson();
};

export const handler = withTenantContext(baseHandler);
