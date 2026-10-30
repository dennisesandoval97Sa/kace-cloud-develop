import { withTenantContext } from '@kace/api-common';
import { Controller } from './controller.mjs';
import { ControllerRelationsCount } from './controllerRelationsCount.js';
import { ControllerRules } from './controllerRules.js';
import { ControllerFunctions } from './controllerFunctions.js';

const baseHandler = async (event) => {
    const { knexConfig } = event.tenantContext;

    let controller;

    if (event.resource === '/{id}/relations-count') {
        controller = new ControllerRelationsCount(
            {
                ...event,
                resource: '/{id}',
            },
            knexConfig
        );
    } else if (event.resource === '/rules/search') {
        controller = new ControllerRules(
            {
                ...event,
                resource: '/search',
            },
            knexConfig
        );
    } else if (event.resource === '/{id}/rules') {
        controller = new ControllerRules(
            {
                ...event,
                resource: '/{id}',
            },
            knexConfig
        );
    } else if (event.resource === '/functions') {
        controller = new ControllerFunctions(
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
