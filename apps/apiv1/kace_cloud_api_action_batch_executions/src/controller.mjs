import { BaseController, HttpResponse, SearchAuthorizationError, SearchAuthorizationService } from '@kace/api-common';
import {
    objectIdentityErrorResponse,
    secureObjectCreatePayload,
} from '@kace/api-common/src/security/ObjectIdentityAuthorization.js';
import { schemaCreate, schemaUpdate } from './schemas.mjs';
import { SearchSchema } from '@kace/api-common/src/validation/schemas/SearchSchema';
import {
    ActionJobCreator,
    ActionJobDeleter,
    ActionJobFinder,
    ActionJobSearcher,
    ActionJobUpdater,
    KnexActionJobRepository,
    ActionJobProcessingValidator,
    S3FileParser,
} from '@kace/core/src/action-jobs';
import { KnexActionRepository } from '@kace/core/src/actions';
import { KnexClientRepository } from '@kace/core/src/clients';
import { KnexCaseRepository } from '@kace/core/src/cases';
import { KnexActionJobProcessingRepository } from '@kace/core/src/action-job-processing';
import { KnexActionUpdateModelRepository } from '@kace/core/src/action-update-model';
import { Helper } from '@kace/core/src/shared/index.js';
import { KnexWSRestFlowRepository } from '@kace/core/src/ws-rest-flows';

export class Controller extends BaseController {
    #s3Service; // is initialized in the constructor
    constructor(event, knexConfig) {
        super(event, knexConfig);
        this.repository = new KnexActionJobRepository(this.database_connection);
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
        this.started_at = new Date();
    }

    async actionCreate() {
        Helper.logInfo('Begin actionCreate');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'action-jobs', 'ActionJobsCreate');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to create action jobs.',
                    event: this.event,
                });
            }

            const payload = await secureObjectCreatePayload({
                payload: this.payload(),
                userId: this.user.id.value,
                now: this.started_at,
                actorId: this.user.id.value,
                tenantId: this.tenant?.id?.value,
                endpoint: 'POST /action-batch-executions',
                resourceType: 'action_batch_executions',
                repository: this.repository,
            });

            const { value, error } = schemaCreate.validate(payload, {
                abortEarly: false,
            });
            if (error)
                return HttpResponse.validationsFail({
                    errors: error,
                    event: this.event,
                });

            let result;
            value.details = { ...value.details };

            if (value.type === 'file' || value.type === 'file_clients') {
                value.details.csv_config = {
                    separator: value.separator ?? ';',
                    headers: false,
                };
                result = await this.actionJobProcessingValidator.validateBatchFile(value);
                if (!result.processedCount || result.errors.length) {
                    return HttpResponse.validationsFail({
                        errors: result.errors,
                        event: this.event,
                    });
                }
                result = await this.actionJobProcessingValidator.validateBatchFile(value, true);
            }

            if (value.type === 'filter' || value.type === 'filter_clients') {
                const endpointKey = value.type === 'filter_clients' ? 'clients.search' : 'cases.search';
                value.search_filter = this.#authorizeSearch(endpointKey, value.search_filter);
                if (value.restflow_id) {
                    value.restflow_context = {
                        ...value.restflow_context,
                        triggered_by: {
                            id: this.user.id.value,
                            nombres: this.user.nombres.value,
                            apellido1: this.user.apellido1.value,
                            apellido2: this.user.apellido2.value,
                        },
                    };
                }
                result = await this.actionJobProcessingValidator.saveFilteredResults(value);
            }

            if (!result.processedCount) {
                return HttpResponse.validationsFail({
                    errors: result.errors,
                    event: this.event,
                });
            }

            value.details.errors = result.errors;
            value.total_records = result.processedCount;
            value.failed_records = result.casesFailed;

            const response = await new ActionJobCreator(
                this.repository,
                this.eventPublisher,
                this.tenant,
                this.user
            ).execute(value);
            Helper.logDebug(JSON.stringify(response.toJson()));

            return HttpResponse.created({
                ...response.toJson(),
                event: this.event,
                errors: result.errors,
            });
        } catch (error) {
            if (error instanceof SearchAuthorizationError) {
                return HttpResponse.forbidden({
                    message: error.message,
                    event: this.event,
                });
            }

            const response = objectIdentityErrorResponse(error, this.event);
            if (response) return response;
            Helper.logInfo(error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.event,
            });
        } finally {
            Helper.logInfo('End actionCreate');
        }
    }

    async actionUpdate() {
        Helper.logInfo('Begin actionUpdate');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'action-jobs', 'ActionJobsUpdate');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to update action jobs.',
                    event: this.event,
                });
            }

            const id = this.pathParameters().id;
            if (!this.validateId(id)) {
                return HttpResponse.badRequest({
                    message: 'Invalid id',
                    event: this.event,
                });
            }

            const payload = this.payload();
            payload.updated_at = new Date();
            payload.updated_by = this.user.id.value;
            const { value, error } = schemaUpdate.validate(payload, {
                abortEarly: false,
            });
            if (error) {
                return HttpResponse.validationsFail({
                    errors: error,
                    event: this.event,
                });
            }

            await new ActionJobUpdater(this.repository).execute(id, value);

            return HttpResponse.ok({ event: this.event });
        } catch (error) {
            const response = objectIdentityErrorResponse(error, this.event);
            if (response) return response;
            Helper.logInfo(error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.event,
            });
        } finally {
            Helper.logInfo('End actionUpdate');
        }
    }

    async actionDelete() {
        Helper.logInfo('Begin actionDelete');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'action-jobs', 'ActionJobsDelete');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to delete action jobs.',
                    event: this.event,
                });
            }

            const id = this.pathParameters().id;
            if (!this.validateId(id)) {
                return HttpResponse.badRequest({
                    message: 'Invalid id',
                    event: this.event,
                });
            }

            const dto = {
                deleted_at: new Date().toISOString(),
                deleted_by: this.user.id.value,
            };

            await new ActionJobDeleter(this.repository).execute(id, dto);

            return HttpResponse.ok({ event: this.event });
        } catch (error) {
            const response = objectIdentityErrorResponse(error, this.event);
            if (response) return response;
            Helper.logInfo(error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.event,
            });
        } finally {
            Helper.logInfo('End actionDelete');
        }
    }

    async actionRead() {
        Helper.logInfo('Begin actionRead');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'action-jobs', 'ActionJobsRead');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to read action jobs.',
                    event: this.event,
                });
            }

            const id = this.pathParameters().id;
            if (!this.validateId(id)) {
                return HttpResponse.badRequest({
                    message: 'Invalid id',
                    event: this.event,
                });
            }

            const response = await new ActionJobFinder(this.repository).execute(id);
            if (!response) {
                return HttpResponse.notFound({ event: this.event });
            }

            return HttpResponse.ok({ ...response.toJson(), event: this.event });
        } catch (error) {
            const response = objectIdentityErrorResponse(error, this.event);
            if (response) return response;
            Helper.logInfo(error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.event,
            });
        } finally {
            Helper.logInfo('End actionRead');
        }
    }

    async actionIndex() {
        Helper.logInfo('Begin actionIndex');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'action-jobs', 'ActionJobsRead');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to list action jobs.',
                    event: this.event,
                });
            }

            const dtoCriteria = {
                filter: undefined,
                relationship: undefined,
                limit: 10,
                offset: 0,
                order: {
                    field: 'created_at',
                    direction: 'desc',
                },
            };

            const response = await new ActionJobSearcher(this.repository).execute(dtoCriteria);

            return HttpResponse.ok({ ...response.toJson(), event: this.event });
        } catch (error) {
            const response = objectIdentityErrorResponse(error, this.event);
            if (response) return response;
            Helper.logInfo(error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.event,
            });
        } finally {
            Helper.logInfo('End actionIndex');
        }
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
        Helper.logInfo('Begin actionSearch');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'action-jobs', 'ActionJobsRead');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to search action jobs.',
                    event: this.event,
                });
            }

            const { value, error } = SearchSchema.validate(this.payload(), {
                abortEarly: false,
            });
            if (error) {
                return HttpResponse.validationsFail({
                    errors: error,
                    event: this.event,
                });
            }

            const authorizedQuery = this.#authorizeSearch('action-batch-executions.search', value);
            const response = await new ActionJobSearcher(this.repository).execute(authorizedQuery);

            return HttpResponse.ok({ ...response.toJson(), event: this.event });
        } catch (error) {
            if (error instanceof SearchAuthorizationError) {
                return HttpResponse.forbidden({
                    message: error.message,
                    event: this.event,
                });
            }

            const response = objectIdentityErrorResponse(error, this.event);
            if (response) return response;
            Helper.logInfo(error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.event,
            });
        } finally {
            Helper.logInfo('End actionSearch');
        }
    }
}
