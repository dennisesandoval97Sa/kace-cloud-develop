import {withTenantContext} from '@kace/api-common';
import { Controller } from './controller.mjs';
import { ControllerScanFile } from './controllerScanFile.mjs';

const baseHandler = async (event) => {
    const {knexConfig} = event.tenantContext;

    let controller;

    if (event.resource === '/scan-s3-file') {
        event.resource = '/search';
        controller = new ControllerScanFile(event, knexConfig);
    } else {
        controller = new Controller(event, knexConfig);
    }

    const response = await controller.run();

    return response.toJson();
};

export const handler = withTenantContext(baseHandler);
