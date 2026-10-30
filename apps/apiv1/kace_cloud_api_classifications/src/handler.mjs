import {withTenantContext} from '@kace/api-common';
import { Controller } from './Controller.mjs';
import { ControllerList } from './controllerList';

const baseHandler = async (event) => {
    const {knexConfig} = event.tenantContext;

    let controller;

    if (event.resource === '/list') {
        controller = new ControllerList(
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
