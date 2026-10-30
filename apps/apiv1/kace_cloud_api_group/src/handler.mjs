import { withTenantContext } from '@kace/api-common';
import { Controller } from './Controller.mjs';
import ControllerShiftManagement from './ControllerShiftManagement.js';

const baseHandler = async (event) => {
    const { knexConfig } = event.tenantContext;

    let controller;
    if (event.resource === '/{id}/shift-management') {
        controller = new ControllerShiftManagement(
            {
                ...event,
                resource: '/{id}',
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
