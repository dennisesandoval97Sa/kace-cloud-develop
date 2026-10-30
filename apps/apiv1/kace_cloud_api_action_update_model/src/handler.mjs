import {withTenantContext} from '@kace/api-common';
import { Controller } from './controller.mjs';
import { CustomController } from './customController.mjs';
import { Helper } from '@kace/core/src/shared/index.js';

const baseHandler = async (event) => {
    const {knexConfig} = event.tenantContext;

    let controller = new Controller(event, knexConfig);

    try {
        controller.resource();
    } catch (error) {
        Helper.logError('Error in the handler', {
            message: error.message,
            stack: error.stack,
        });

        controller = new CustomController(event, knexConfig);
    }
    const response = await controller.run();

    return response.toJson();
};

export const handler = withTenantContext(baseHandler);
