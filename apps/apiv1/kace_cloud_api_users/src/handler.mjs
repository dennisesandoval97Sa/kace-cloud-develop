import { withTenantContext } from '@kace/api-common';
import Controller from './controller.mjs';
import ControllerSearchByName from './controllerSearchByName.mjs';
import ControllerSession from './controllerSession.mjs';
import ControllerIntegrationActivity from './controllerIntegrationActivity.mjs';
import ControllerValidateGroup from './controllerValidateGroup.mjs';
import ControllerUpdateActiveGroup from './controllerUpdateActiveGroup.mjs';
import ControllerBulkUpdate from './controllerBulkUpdate.mjs';

const baseHandler = async (event) => {
    const { knexConfig } = event.tenantContext;

    let controller;

    if (event.resource === '/searchByName') {
        controller = new ControllerSearchByName(
            {
                ...event,
                resource: '/search',
            },
            knexConfig
        );
    } else if (event.resource === '/session/alive' && event.httpMethod === 'POST') {
        controller = new ControllerSession(
            {
                ...event,
                resource: '/',
            },
            knexConfig
        );
    } else if (event.resource === '/session/validate-group' && event.httpMethod === 'GET') {
        controller = new ControllerValidateGroup(
            {
                ...event,
                resource: '/',
            },
            knexConfig
        );
    } else if (event.resource === '/update-active-group' && event.httpMethod === 'POST') {
        controller = new ControllerUpdateActiveGroup({ ...event, resource: '/' }, knexConfig);
    } else if (event.resource === '/bulk-update' && event.httpMethod === 'POST') {
        controller = new ControllerBulkUpdate({ ...event, resource: '/' }, knexConfig);
    } else if (event.resource === '/{id}/integration-activity' && event.httpMethod === 'POST') {
        controller = new ControllerIntegrationActivity(
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
