import {withTenantContext} from '@kace/api-common';
import { Controller } from './controller.mjs';
import { Helper } from '@kace/core/src/shared/index.js';
import { HttpResponse } from '@kace/api-common';

const baseHandler = async (event, context) => {
    const {knexConfig} = event.tenantContext;

    const SAFETY_MARGIN_MS = process.env.APPS_TIMEOUT_REST_FLOWS_VALUE_MS
        ? parseInt(process.env.APPS_TIMEOUT_REST_FLOWS_VALUE_MS, 10)
        : 10000;

    let timeoutPromise;

    if (context && typeof context.getRemainingTimeInMillis === 'function') {
        const timeoutMs = context.getRemainingTimeInMillis() - SAFETY_MARGIN_MS;

        timeoutPromise = new Promise((resolve) => {
            setTimeout(
                () => {
                    const body = JSON.stringify(event?.body || {});

                    Helper.logError(
                        `Lambda function ${context.functionName} has exceeded the available execution time.`,
                        JSON.stringify(body)
                    );
                    resolve(
                        HttpResponse.requestTimeout({
                            message: `Lambda function ${context.functionName} has exceeded the available execution time.`,
                            event: JSON.stringify(body),
                        })
                    );
                },
                timeoutMs > 0 ? timeoutMs : 0
            );
        });
    }

    const controller = new Controller(event, knexConfig);
    const execPromise = controller.run().then((response) => response.toJson());

    if (!timeoutPromise) {
        return execPromise;
    }

    return Promise.race([execPromise, timeoutPromise]);
};

export const handler = withTenantContext(baseHandler);
