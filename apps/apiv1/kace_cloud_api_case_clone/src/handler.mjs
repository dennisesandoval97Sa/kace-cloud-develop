import {withTenantContext} from '@kace/api-common';
import { Controller } from './controller.mjs';

const baseHandler = async (event) => {
    const {knexConfig} = event.tenantContext;

    const controller = new Controller(event, knexConfig);

    const response = await controller.run();

    return response.toJson();
};

export const handler = withTenantContext(baseHandler);
