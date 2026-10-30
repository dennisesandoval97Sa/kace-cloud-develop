import {withTenantContext} from '@kace/api-common';
import { Controller } from './controller.mjs';
import LogoutController from './LogoutController.mjs';

const baseHandler = async (event) => {
    const {knexConfig} = event.tenantContext;

    let controller;

    if (event.resource === '/logout') {
        controller = new LogoutController(
            {
                ...event,
                resource: '/',
            },
            knexConfig
        );
    } else {
        controller = new Controller(event, knexConfig);
    }

    const response = await controller.runCognitoAuth();

    return response.toJson();
};

export const handler = withTenantContext(baseHandler);
