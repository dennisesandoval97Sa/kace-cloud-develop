import { withTenantContext } from '@kace/api-common';
import { ControllerWebhook } from './ControllerWebhook.mjs';
import { Controller } from './Controller.mjs';
import { ControllerAssociateInteractionToCaso } from './ControllerAssociateInteractionToCaso.mjs';
import { ControllerReview } from './ControllerReview.mjs';

const REVIEW_RESOURCES = new Set([
    '/{id}/review/claim',
    '/{id}/review/release',
    '/agent/{id}/review/claim',
    '/agent/{id}/review/release',
]);
const INTERACTION_CASE_RESOURCES = new Map([
    ['/interaction-cases', '/'],
    ['/interaction-cases/search', '/search'],
    ['/interaction-cases/candidates/search', '/search'],
    ['/interaction-cases/{id}', '/{id}'],
    ['/agent/interaction-cases', '/'],
    ['/agent/interaction-cases/{id}', '/{id}'],
]);

export const baseHandler = async (event) => {
    const { knexConfig } = event.tenantContext;

    let controller;

    if (event.resource === '/webhook') {
        controller = new ControllerWebhook(
            {
                ...event,
                resource: '/',
            },
            knexConfig
        );
    } else if (INTERACTION_CASE_RESOURCES.has(event.resource)) {
        controller = new ControllerAssociateInteractionToCaso(
            {
                ...event,
                originalResource: event.originalResource ?? event.resource,
                resource: INTERACTION_CASE_RESOURCES.get(event.resource),
            },
            knexConfig
        );
    } else if (REVIEW_RESOURCES.has(event.resource)) {
        controller = new ControllerReview(
            {
                ...event,
                originalResource: event.resource,
                resource: '/',
            },
            knexConfig
        );
    } else if (event.resource === '/agent/search') {
        controller = new Controller(
            {
                ...event,
                originalResource: event.originalResource ?? event.resource,
                resource: '/search',
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
