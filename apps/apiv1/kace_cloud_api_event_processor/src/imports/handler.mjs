import { ImportExecutionRequested } from '@kace/core/src/imports/domain/events/ImportExecutionRequested.js';
import { S3ImportsProcessor } from '@kace/core/src/imports/application/imports-processor/S3ImportsProcessor.js';
import { Helper } from '@kace/core/src/shared/infrastructure/utils/Helper.js';
import { createEventLambdaHandler } from '../shared/createEventLambdaHandler.mjs';

const STOP_BUFFER_MS = 30_000;

const handlerFactories = new Map([
    [
        ImportExecutionRequested.EVENT_NAME,
        async ({ getRemainingTimeInMillis }, _event) => {
            const remainingTimeMs = () => getRemainingTimeInMillis() - STOP_BUFFER_MS;
            const result = await new S3ImportsProcessor(remainingTimeMs).processPendingsImports();
            if (result?.skipped) {
                Helper.logInfo('Imports execution skipped; lock holder or reconciliation sweep will pick it up', {
                    skipped: result.skipped,
                });
            }
        },
    ],
]);

export const handler = createEventLambdaHandler({
    handlerFactories,
    lambdaName: 'ImportsEventProcessor',
});
