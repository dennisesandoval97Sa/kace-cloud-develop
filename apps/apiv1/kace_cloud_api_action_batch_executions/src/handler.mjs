import {withTenantContext} from '@kace/api-common';
import { Controller } from './controller.mjs';
import { ControllerValidateCSV } from './controllerValidateCSV.mjs';
import { ControllerProcessQueue } from './controllerProcessQueue.mjs';
import EventController from './EventController.mjs';
import { Helper } from '@kace/core/src/shared';
import { HttpResponse } from '@kace/api-common';

const baseHandler = async (event, context) => {
    const {knexConfig} = event.tenantContext;

    let controller;

    if (event?.source && event.source === 'aws.events') {
        controller = new EventController(event, knexConfig);
    } else {
        if (event.resource === '/validate-csv') {
            event.resource = '/search';
            controller = new ControllerValidateCSV(event, knexConfig);
        } else if (event.resource === '/process-queue') {
            event.resource = '/search';
            controller = new ControllerProcessQueue(event, knexConfig);
        } else {
            controller = new Controller(event, knexConfig);
        }
    }

    const response = await controller.run();

    return response.toJson();
};

export const handler = withTenantContext(baseHandler);
