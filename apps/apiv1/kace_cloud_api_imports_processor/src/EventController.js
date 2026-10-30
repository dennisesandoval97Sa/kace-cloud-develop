import { HttpResponse, ScheduleEventController } from '@kace/api-common';
import { S3ImportsProcessor } from '@kace/core/src/imports/application/imports-processor/S3ImportsProcessor';
import { KnexCaseRepository } from '@kace/core/src/cases';
import { Helper } from '@kace/core/src/shared/index.js';

export class EventController extends ScheduleEventController {
    /** @type {function(): number} is initialized in the constructor */
    #remainingTimeMs;

    constructor(event, knexConfig, remainingTimeMs) {
        super(event, knexConfig);
        this.repository = new KnexCaseRepository(knexConfig);
        this.#remainingTimeMs = remainingTimeMs;
    }

    /**
     *
     * @returns {Promise<Response>}
     */
    async actionDefault() {
        Helper.logInfo('Begin actionDefault');
        try {
            await new S3ImportsProcessor(this.#remainingTimeMs).processPendingsImports();
            return HttpResponse.ok({ event: this.event });
        } catch (error) {
            Helper.logInfo(error);
            return HttpResponse.internalServerError({ errors: error });
        } finally {
            Helper.logInfo('End actionDefault');
        }
    }
}
