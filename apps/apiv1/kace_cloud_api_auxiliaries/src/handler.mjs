import { withTenantContext } from '@kace/api-common';
import { Controller } from './controller.mjs';
import { ControllerList } from './controllerList.mjs';
import { ControllerListSearch } from './controllerListSearch.mjs';

const baseHandler = async (event, context) => {
    event.kContext = context;
    const { knexConfig } = event.tenantContext;

    let controller;
    if (event.resource === '/{entity}/list') {
        controller = new ControllerList(
            {
                ...event,
                resource: '/',
            },
            knexConfig
        );
    } else if (event.resource === '/{entity}/list/search') {
        controller = new ControllerListSearch(
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
    await controller.destroyDbConnection();
    return response.toJson();
};

export const handler = withTenantContext(baseHandler);
