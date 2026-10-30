import { withTenantContext } from '@kace/api-common';
import { Controller } from './controller.mjs';
import { EventController } from './EventController.js';

const STOP_BUFFER_MS = 30_000;

const baseHandler = async (event, context) => {
    const { knexConfig } = event.tenantContext;

    const remainingTimeMs = () => context.getRemainingTimeInMillis() - STOP_BUFFER_MS;
    let controller;

    if (event?.source && event.source === 'aws.events') {
        controller = new EventController(event, knexConfig, remainingTimeMs);
    } else {
        controller = new Controller(event, knexConfig, remainingTimeMs);
    }

    const response = await controller.run();

    return response.toJson();
};

export const handler = withTenantContext(baseHandler);
