import {withTenantContext} from '@kace/api-common';
import { Controller } from './controller.mjs';
import ControllerReScheduler from './ControllerReScheduler.js';
import ControllerByCase from './ControllerByCase.js';

const baseHandler = async (event) => {
    const {knexConfig} = event.tenantContext;

    let controller;

    if (event.resource === '/{id}/re-scheduler') {
        controller = new ControllerReScheduler(
            {
                ...event,
                resource: '/',
            },
            knexConfig
        );
    } else if (event.resource.includes('/by-case/count')) {
        const resource = event.resource.split('/by-case/count');
        controller = new ControllerByCase(
            {
                ...event,
                resource: resource[1],
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
