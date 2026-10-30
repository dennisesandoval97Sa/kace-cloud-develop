import { BaseController, HttpResponse } from '@kace/api-common';
import { schemaBulkClose } from './schemas.mjs';
import { CaseBulkCloser, KnexCaseRepository } from '@kace/core/src/cases/index.js';
import { KnexCommentsRepository } from '@kace/core/src/comments/index.js';
import { CustomError, Helper, ValidationFailError } from '@kace/core/src/shared/index.js';
import { AUTHORIZATION_ERROR } from '@kace/error-codes';

export class BulkCloseController extends BaseController {
    constructor(event, knexConfig) {
        super(event, knexConfig);
        this.repository = new KnexCaseRepository(knexConfig);
        this.commentsRepository = new KnexCommentsRepository(knexConfig);
    }

    async actionCreate() {
        Helper.logInfo('Begin BulkClose');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'cases', 'CasesBulkClose');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to update this resource.',
                    event: this.event,
                    code: AUTHORIZATION_ERROR,
                });
            }

            const payload = this.payload();
            const { value, error } = schemaBulkClose.validate(payload, {
                abortEarly: false,
            });

            if (error) {
                return HttpResponse.validationsFail({
                    errors: error,
                    event: this.event,
                });
            }

            await new CaseBulkCloser(this.repository, this.user, this.commentsRepository).execute(
                value.case_ids,
                value.close_reason
            );

            return HttpResponse.ok({ event: this.event });
        } catch (error) {
            Helper.logError('BulkCloseController error', error);
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
            Helper.logInfo('End BulkClose');
        }
    }
}
