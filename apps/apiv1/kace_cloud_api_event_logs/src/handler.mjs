import {withTenantContext} from '@kace/api-common';
import { Controller } from './controller.mjs';
import { ControllerSearchByCase } from './ControllerSearchByCase.mjs';

const baseHandler = async (event) => {
    const {knexConfig} = event.tenantContext;

    let controller;

    if (event.resource === '/case/{id}' && event.httpMethod === 'POST') {
        controller = new ControllerSearchByCase(
            {
                ...event,
                resource: '/search',
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
