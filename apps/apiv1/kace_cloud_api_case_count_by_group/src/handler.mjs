import { withTenantContext } from '@kace/api-common';
import { Controller } from './controller.mjs';

const baseHandler = async (event) => {
    const { knexConfig, readerConfig } = event.tenantContext;

    const controller = new Controller(event, knexConfig, readerConfig);

    const response = await controller.run();

    return response.toJson();
};

export const handler = withTenantContext(baseHandler);
