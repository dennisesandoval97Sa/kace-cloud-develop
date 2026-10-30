import {withTenantContext} from '@kace/api-common';
import { Controller } from './controller.mjs';
import { ExecuteController } from './ExecuteController.mjs';
import { EventController } from './EventController.js';

const baseHandler = async (event) => {
    const {knexConfig} = event.tenantContext;

    let controller;

    if (event?.source && event.source === 'aws.events') {
        controller = new EventController(event, knexConfig);
    } else if (event.resource === '/{id}/execute') {
        event.resource = '/{id}';
        controller = new ExecuteController(event, knexConfig);
    } else {
        controller = new Controller(event, knexConfig);
    }

    const response = await controller.run();

    return response.toJson();
};

export const handler = withTenantContext(baseHandler);
