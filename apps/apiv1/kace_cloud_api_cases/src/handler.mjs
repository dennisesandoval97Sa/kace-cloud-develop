import { withTenantContext } from '@kace/api-common';
import { Controller } from './controller.mjs';
import { ViewController } from './caseViewController.mjs';
import { TransitionController } from './caseTransitionController.mjs';
import { SubCasesController } from './subCasesController.mjs';
import { VisibleController } from './caseVisibleController.mjs';

const baseHandler = async (event) => {
    const { knexConfig, readerConfig } = event.tenantContext;

    let controller;

    if (event.resource === '/{id}/transition' && event.httpMethod === 'POST') {
        controller = new TransitionController(
            {
                ...event,
                resource: '/',
            },
            knexConfig
        );
    } else if (event.resource === '/{id}/sub-cases' && event.httpMethod === 'POST') {
        controller = new SubCasesController(
            {
                ...event,
                resource: '/',
            },
            knexConfig
        );
    } else if (event.resource === '/{id}/sub-cases/delete' && event.httpMethod === 'POST') {
        controller = new SubCasesController({ ...event, resource: '/{id}/delete', httpMethod: 'GET' }, knexConfig);
    } else if (event.resource === '/{id}/sub-cases/search' && event.httpMethod === 'POST') {
        controller = new SubCasesController(
            {
                ...event,
                resource: '/search',
            },
            knexConfig
        );
    } else if (event.resource?.startsWith('/view')) {
        if (event.resource === '/view') {
            event.resource = '/';
        }
        if (event.resource === '/view/search') {
            event.resource = '/search';
        }
        controller = new ViewController(event, knexConfig, readerConfig);
    } else if (event.resource === '/visible') {
        controller = new VisibleController(
            {
                ...event,
                resource: '/search',
            },
            knexConfig,
            readerConfig
        );
    } else {
        controller = new Controller(event, knexConfig, readerConfig);
    }

    const response = await controller.run();

    return response.toJson();
};

export const handler = withTenantContext(baseHandler);
