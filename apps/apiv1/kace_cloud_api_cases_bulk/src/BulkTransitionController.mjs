import { BaseController, HttpResponse } from '@kace/api-common';
import { schemaBulkTransitionUpdate } from './schemas.mjs';
import {
    CaseBulkTransitionsUpdater,
    KnexCaseRepository,
    KnexTransitionsCaseRepository,
} from '@kace/core/src/cases/index.js';
import { KnexTransitionRuleRepository } from '@kace/core/src/transition-rules/infrastructure/KnexTransitionRuleRepository.js';
import { CustomError, Helper, ValidationFailError } from '@kace/core/src/shared/index.js';
import { AUTHORIZATION_ERROR } from '@kace/error-codes';

export class BulkTransitionController extends BaseController {
    constructor(event, knexConfig) {
        super(event, knexConfig);
        this.repository = new KnexCaseRepository(knexConfig);
        this.transitionsRepository = new KnexTransitionsCaseRepository(knexConfig);
        this.transitionRuleRepository = new KnexTransitionRuleRepository(knexConfig);
    }

    async actionCreate() {
        Helper.logInfo('Begin BulkTransitionUpdate');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'cases', 'CasesBulkTransition');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to update this resource.',
                    event: this.event,
                    code: AUTHORIZATION_ERROR,
                });
            }

            const payload = this.payload();
            const { value, error } = schemaBulkTransitionUpdate.validate(payload, {
                abortEarly: false,
            });

            if (error) {
                return HttpResponse.validationsFail({
                    errors: error,
                    event: this.event,
                });
            }

            await new CaseBulkTransitionsUpdater(
                this.repository,
                this.transitionsRepository,
                this.user,
                this.transitionRuleRepository,
                this.eventPublisher,
                this.tenant
            ).execute(value.case_ids, value.transition_id, value.update_source);

            return HttpResponse.ok({ event: this.event });
        } catch (error) {
            Helper.logError('BulkTransitionController error', error);
            if (error instanceof CustomError) {
                return HttpResponse.custom(error.message, error.statusCode, this.event, error.publicErrorCode);
            }
            if (error instanceof ValidationFailError) {
                return HttpResponse.validationsFail({
                    errors: error,
                    event: this.event,
                });
            }
            return HttpResponse.internalServerError({
                errors: error,
                event: this.event,
            });
        } finally {
            Helper.logInfo('End BulkTransitionUpdate');
        }
    }
}
