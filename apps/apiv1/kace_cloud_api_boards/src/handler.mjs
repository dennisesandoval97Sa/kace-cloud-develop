import { withTenantContext } from '@kace/api-common';
import { Controller } from './controller.mjs';
import { ControllerBoardResources } from './ControllerBoardResources';
import { ControllerAvailableBoards } from './ControllerAvailableBoards';
import ControllerBoardRelations from './ControllerBoardRelations.js';
import { Helper } from '@kace/core/src/shared/index.js';

const baseHandler = async (event) => {
    const { knexConfig, readerConfig } = event.tenantContext;

    let controller;
    Helper.logDebug('handler event resource:', event.resource);
    if (event.resource === '/{id}/resources') {
        controller = new ControllerBoardResources(
            {
                ...event,
                resource: '/search',
            },
            knexConfig,
            readerConfig
        );
    } else if (event.resource === '/available') {
        controller = new ControllerAvailableBoards(
            {
                ...event,
                resource: '/search',
            },
            knexConfig
        );
    } else if (event.resource === '/relations') {
        controller = new ControllerBoardRelations(
            {
                ...event,
                resource: '/',
            },
            knexConfig
        );
    } else if (event.resource === '/relations/{entity}') {
        controller = new ControllerBoardRelations(
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
