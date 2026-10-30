import { withTenantContext } from '@kace/api-common';
import { Helper } from '@kace/core/src/shared/infrastructure/utils/Helper.js';
import Controller from './controller.mjs';
import { LambdaDebugService } from './services/LambdaDebugService.mjs';
import { TenantDebugFlag } from './services/TenantDebugFlag.mjs';
import { SCHEDULE_SOURCE_MARKER } from './services/DebugScheduler.mjs';

const baseHandler = async (event) => {
    const { knexConfig } = event.tenantContext;
    const controller = new Controller(event, knexConfig);
    const response = await controller.run();
    return response.toJson();
};

const httpHandler = withTenantContext(baseHandler);

const isScheduledDisable = (event) =>
    event && typeof event === 'object' && event.source === SCHEDULE_SOURCE_MARKER && typeof event.target === 'string';

export const handler = async (event, context, callback) => {
    if (context?.invokedFunctionArn) {
        process.env.DEBUG_TOGGLE_LAMBDA_ARN = context.invokedFunctionArn;
    }

    if (isScheduledDisable(event)) {
        Helper.logInfo('Scheduled debug-disable triggered', { target: event.target, tenantId: event.tenantId });
        try {
            const service = new LambdaDebugService();
            const { fnName } = await service.disable(event.target);
            const { updated: dynamoReset } = await new TenantDebugFlag().disable(event.tenantId);
            Helper.logInfo('Scheduled debug-disable completed', { target: event.target, fnName, dynamoReset });
            return { ok: true, target: event.target, fnName, dynamoReset };
        } catch (error) {
            Helper.logError('Scheduled debug-disable failed', error);
            throw error;
        }
    }

    return httpHandler(event, context, callback);
};
