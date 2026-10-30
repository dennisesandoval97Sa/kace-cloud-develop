import { BaseController, HttpResponse, SearchAuthorizationError, SearchAuthorizationService } from '@kace/api-common';
import { Helper } from '@kace/core/src/shared/index.js';
import { validateFileSchema } from './schemas.mjs';
import { ActionJobProcessingValidator, S3FileParser } from '@kace/core/src/action-jobs';
import { KnexActionRepository } from '@kace/core/src/actions';
import { KnexClientRepository } from '@kace/core/src/clients';
import { KnexCaseRepository } from '@kace/core/src/cases';
import { KnexActionJobProcessingRepository } from '@kace/core/src/action-job-processing';
import { KnexActionUpdateModelRepository } from '@kace/core/src/action-update-model';
import { KnexWSRestFlowRepository } from '@kace/core/src/ws-rest-flows';

export class ControllerValidateCSV extends BaseController {
    /** @type {S3FileParser} is initialized in the constructor */
    #s3Service;
    constructor(event, knexConfig) {
        super(event, knexConfig);
        this.#s3Service = new S3FileParser();
        this.actionJobProcessingValidator = new ActionJobProcessingValidator(
            new KnexCaseRepository(this.database_connection),
            new KnexClientRepository(this.database_connection),
            new KnexActionRepository(this.database_connection),
            new KnexActionJobProcessingRepository(this.database_connection),
            new KnexActionUpdateModelRepository(this.database_connection),
            this.#s3Service,
            new KnexWSRestFlowRepository(this.database_connection)
        );
    }

    #searchAuthorizationService;

    #authorizeSearch(endpointKey, query) {
        this.#searchAuthorizationService ??= new SearchAuthorizationService();
        return this.#searchAuthorizationService.authorize({
            endpointKey,
            user: this.user,
            query,
        });
    }

    async actionSearch() {
        Helper.logInfo('Begin actionValidate');

        try {
            const hasPermission = this.user.hasPermission('administrador', 'action-jobs', 'ActionJobsValidateCSV');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to validate CSV files for action jobs.',
                    event: this.event,
                });
            }

            const payload = this.payload();

            const { value, error } = validateFileSchema.validate(payload, {
                abortEarly: false,
            });
            if (error)
                return HttpResponse.validationsFail({
                    errors: error,
                    event: this.event,
                });

            value.s3_file_key = `${value.url}/${value.id}/${value.fileName}`;
            value.details = {
                csv_config: {
                    separator: value.separator,
                    headers: false,
                },
            };
            const authorizedQuery = this.#authorizeSearch('action-batch-executions.validate-csv.search', value);
            const result = await this.actionJobProcessingValidator.validateBatchFile(authorizedQuery);

            if (result.errors.length > 0) {
                await this.#s3Service.deleteFile(value.s3_file_key);
                return HttpResponse.validationsFail({ errors: result.errors, event: this.event });
            }

            return HttpResponse.ok({
                message: 'CSV validado exitosamente',
                event: this.event,
            });
        } catch (error) {
            if (error instanceof SearchAuthorizationError) {
                return HttpResponse.forbidden({
                    message: error.message,
                    event: this.event,
                });
            }

            Helper.logInfo(error);
            return HttpResponse.internalServerError({ errors: error, event: this.event });
        } finally {
            Helper.logInfo('End actionValidate');
        }
    }
}
