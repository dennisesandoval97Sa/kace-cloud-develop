import { HttpResponse, ScheduleEventController } from '@kace/api-common';
import { KnexCaseRepository } from '@kace/core/src/cases';
import { Helper } from '@kace/core/src/shared/index.js';
import { AnsBackgroundRunner } from '@kace/core/src/ans/application/calculator/AnsBackgroundRunner.js';
import { BackgroundExecutionService } from '@kace/core/src/shared/domain/services/background-execution/BackgroundExecutionService.js';
import { KnexBackgroundExecutionRepository } from '@kace/core/src/background-executions/infrastructure/persistence/KnexBackgroundExecutionRepository.js';

export class EventController extends ScheduleEventController {
    constructor(event, knexConfig) {
        super(event, knexConfig);
        this.repository = new KnexCaseRepository(this.database_connection);
        this.backgroundExecutionService = new BackgroundExecutionService(
            new KnexBackgroundExecutionRepository(this.database_connection)
        );
    }

    /**
     *
     * @returns {Promise<Response>}
     */
    async actionDefault() {
        Helper.logInfo('Begin actionDefault');
        try {
            const runner = new AnsBackgroundRunner({
                caseRepository: this.repository,
                backgroundExecutionService: this.backgroundExecutionService,
            });

            await runner.execute();
            return HttpResponse.ok();
        } catch (error) {
            Helper.logInfo(error);
            return HttpResponse.internalServerError({ errors: error });
        } finally {
            Helper.logInfo('End actionDefault');
        }
    }
}
