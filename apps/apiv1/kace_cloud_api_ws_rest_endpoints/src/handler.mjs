import {withTenantContext} from '@kace/api-common';
import { Controller } from './controller.mjs';
import { TryoutController } from './TryoutController.mjs';

const baseHandler = async (event) => {
    const {knexConfig} = event.tenantContext;

    let controller;

    if (event.resource === '/tryout/{id}') {
        const modifiedEvent = {
            ...event,
            resource: '/{id}',
        };
        controller = new TryoutController(modifiedEvent, knexConfig);
    } else {
        controller = new Controller(event, knexConfig);
    }

    const response = await controller.run();

    return response.toJson();
};

export const handler = withTenantContext(baseHandler);
