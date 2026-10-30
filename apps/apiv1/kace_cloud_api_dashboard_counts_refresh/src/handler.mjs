import { withTenantContext } from '@kace/api-common';
import { EventController } from './EventController.mjs';

const baseHandler = async (event) => {
    const { knexConfig } = event.tenantContext;
    const controller = new EventController(event, knexConfig);
    const response = await controller.run();
    return response.toJson();
};

export const handler = withTenantContext(baseHandler);
