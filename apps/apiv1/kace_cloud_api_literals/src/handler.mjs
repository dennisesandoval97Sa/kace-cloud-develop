import {withTenantContext} from '@kace/api-common';
import { Controller } from './controller.mjs';
import { controllerList } from './controllerList.mjs';

const baseHandler = async (event) => {
    const {knexConfig} = event.tenantContext;

    let controller;

    if (event.resource === '/{id}/list') {
        controller = new controllerList(
            {
                ...event,
                resource: '/',
            },
            knexConfig
        );
    } else {
        controller = new Controller(event, knexConfig);
    }

    const response = await controller.run();

    return response.toJson();
};

export const handler = withTenantContext(baseHandler);
