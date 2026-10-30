import { withTenantContext } from '@kace/api-common';
import { Controller } from './Controller.mjs';
import { AvailableController } from './AvailableController.mjs';
import { RegisterChannelHubTagsController } from './RegisterChannelHubTagsController.mjs';
import { DeactivateController } from './DeactivateController.mjs';

const CHANNEL_HUB_REGISTER_ROUTE = '/{id}/channel-hub-tags/register';
const AVAILABLE_ROUTE = '/available';

const baseHandler = async (event) => {
    const { knexConfig } = event.tenantContext;

    let SelectedController = Controller;
    let controllerEvent = event;

    if (event.httpMethod === 'POST' && event.resource === CHANNEL_HUB_REGISTER_ROUTE) {
        SelectedController = RegisterChannelHubTagsController;
        controllerEvent = { ...event, resource: '/' };
    } else if (event.httpMethod === 'GET' && event.resource === AVAILABLE_ROUTE) {
        SelectedController = AvailableController;
        controllerEvent = { ...event, resource: '/' };
    } else if (event.httpMethod === 'POST' && event.resource === '/{id}/deactivate') {
        SelectedController = DeactivateController;
        controllerEvent = { ...event, resource: '/' };
    }

    const controller = new SelectedController(controllerEvent, knexConfig);
    const response = await controller.run();

    return response.toJson();
};

export const handler = withTenantContext(baseHandler);
