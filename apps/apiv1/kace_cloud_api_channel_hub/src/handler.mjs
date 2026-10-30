import { withTenantContext } from '@kace/api-common';
import { Controller } from './controller.mjs';
import { RegisterController } from './RegisterController.mjs';
import { WorkspacePriorityListController } from './WorkspacePriorityListController.mjs';
import { WorkspacePriorityReorderController } from './WorkspacePriorityReorderController.mjs';
import { WorkspacePriorityReorderStatusController } from './WorkspacePriorityReorderStatusController.mjs';

export const createBaseHandler =
    ({
        ControllerClass = Controller,
        RegisterControllerClass = RegisterController,
        WorkspacePriorityListControllerClass = WorkspacePriorityListController,
        WorkspacePriorityReorderControllerClass = WorkspacePriorityReorderController,
        WorkspacePriorityReorderStatusControllerClass = WorkspacePriorityReorderStatusController,
    } = {}) =>
    async (event) => {
        const { knexConfig } = event.tenantContext;
        const { resource, httpMethod: method } = event;
        let SelectedControllerClass = ControllerClass;
        let controllerEvent = event;

        if (method === 'POST' && resource === '/{id}/register') {
            SelectedControllerClass = RegisterControllerClass;
            controllerEvent = { ...event, resource: '/' };
        } else if (method === 'GET' && resource === '/{id}/workspace-priorities') {
            SelectedControllerClass = WorkspacePriorityListControllerClass;
            controllerEvent = { ...event, resource: '/{id}' };
        } else if (method === 'GET' && resource === '/{id}/workspace-priorities/reorders/{operationId}') {
            SelectedControllerClass = WorkspacePriorityReorderStatusControllerClass;
            controllerEvent = { ...event, resource: '/{id}' };
        } else if (method === 'POST' && resource === '/{id}/workspace-priorities/reorder') {
            SelectedControllerClass = WorkspacePriorityReorderControllerClass;
            controllerEvent = { ...event, resource: '/' };
        } else if (method === 'POST' && resource === '/{id}/delete') {
            controllerEvent = { ...event, httpMethod: 'GET' };
        }

        const controller = new SelectedControllerClass(controllerEvent, knexConfig);
        const response = await controller.run();
        return response.toJson();
    };

export const handler = withTenantContext(createBaseHandler());
