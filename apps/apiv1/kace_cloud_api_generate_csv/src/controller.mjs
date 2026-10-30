import { BaseController, HttpResponse, SearchAuthorizationError, SearchAuthorizationService } from '@kace/api-common';
import {
    objectIdentityErrorResponse,
    secureObjectCreatePayload,
} from '@kace/api-common/src/security/ObjectIdentityAuthorization.js';
import { schemaCreate, schemaUpdate } from './schemas.mjs';
import { SearchSchema } from '@kace/api-common/src/validation/schemas/SearchSchema';
import {
    CsvExportViewCreator,
    CsvExportViewDeleter,
    CsvExportViewFinder,
    CsvExportViewSearcher,
    CsvExportViewUpdater,
    KnexCsvExportViewRepository,
} from '@kace/core/src/csv-export-views';
import { Helper } from '@kace/core/src/shared/index.js';

export class Controller extends BaseController {
    constructor(event, knexConfig) {
        super(event, knexConfig);
        // Pass CONFIG objects (not this.database_connection, a built Knex instance —
        // that would collapse the reader onto the writer, §8.1 footgun).
        const { readerConfig } = this.event.tenantContext;
        this.repository = new KnexCsvExportViewRepository(knexConfig, readerConfig);
        this.started_at = new Date();
    }

    async destroyDbConnection() {
        await this.repository.destroyConnection();
        await super.destroyDbConnection();
    }

    async actionCreate() {
        Helper.logInfo('Begin actionCreate');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'csv-export-views', 'GenerateCsvCreate');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to create CSV export views.',
                    event: this.event,
                });
            }

            const payload = await secureObjectCreatePayload({
                payload: this.payload(),
                userId: this.user.id.value,
                now: this.started_at,
                actorId: this.user.id.value,
                tenantId: this.tenant?.id?.value,
                endpoint: 'POST /generate-csv',
                resourceType: 'generate_csv',
                repository: this.repository,
            });

            const { value, error } = schemaCreate.validate(payload, {
                abortEarly: false,
            });
            if (error) {
                return HttpResponse.validationsFail({ errors: error, event: this.event });
            }

            await new CsvExportViewCreator(this.repository).execute(value);

            return HttpResponse.created({ event: this.event });
        } catch (error) {
            const response = objectIdentityErrorResponse(error, this.event);
            if (response) return response;
            Helper.logInfo(error);
            return HttpResponse.internalServerError({ errors: error, event: this.event });
        } finally {
            Helper.logInfo('End actionCreate');
        }
    }

    async actionUpdate() {
        Helper.logInfo('Begin actionUpdate');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'csv-export-views', 'GenerateCsvUpdate');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to update CSV export views.',
                    event: this.event,
                });
            }
            const id = this.pathParameters().id;
            if (!this.validateId(id)) {
                return HttpResponse.badRequest({ message: 'Invalid id', event: this.event });
            }

            const payload = this.payload();
            payload.updated_at = new Date();
            payload.updated_by = this.user.id.value;

            const { value, error } = schemaUpdate.validate(payload, {
                abortEarly: false,
            });
            if (error) {
                return HttpResponse.validationsFail({ errors: error, event: this.event });
            }

            await new CsvExportViewUpdater(this.repository).execute(id, value);

            return HttpResponse.ok({ event: this.event });
        } catch (error) {
            const response = objectIdentityErrorResponse(error, this.event);
            if (response) return response;
            Helper.logInfo(error);
            return HttpResponse.internalServerError({ errors: error, event: this.event });
        } finally {
            Helper.logInfo('End actionUpdate');
        }
    }

    async actionDelete() {
        Helper.logInfo('Begin actionDelete');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'csv-export-views', 'GenerateCsvDelete');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to delete CSV export views.',
                    event: this.event,
                });
            }
            const id = this.pathParameters().id;
            if (!this.validateId(id)) {
                return HttpResponse.badRequest({ message: 'Invalid id', event: this.event });
            }

            const dto = {
                deleted_at: new Date().toISOString(),
                deleted_by: this.user.id.value,
            };

            await new CsvExportViewDeleter(this.repository).execute(id, dto);

            return HttpResponse.ok({ event: this.event });
        } catch (error) {
            const response = objectIdentityErrorResponse(error, this.event);
            if (response) return response;
            Helper.logInfo(error);
            return HttpResponse.internalServerError({ errors: error, event: this.event });
        } finally {
            Helper.logInfo('End actionDelete');
        }
    }

    async actionRead() {
        Helper.logInfo('Begin actionRead');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'csv-export-views', 'GenerateCsvRead');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to read CSV export views.',
                    event: this.event,
                });
            }
            const id = this.pathParameters().id;
            if (!this.validateId(id)) {
                return HttpResponse.badRequest({ message: 'Invalid id', event: this.event });
            }

            const response = await new CsvExportViewFinder(this.repository).execute(id);

            return HttpResponse.ok({ ...response.toJson(), event: this.event });
        } catch (error) {
            const response = objectIdentityErrorResponse(error, this.event);
            if (response) return response;
            Helper.logInfo(error);
            return HttpResponse.internalServerError({ errors: error, event: this.event });
        } finally {
            Helper.logInfo('End actionRead');
        }
    }

    async actionIndex() {
        Helper.logInfo('Begin actionIndex');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'csv-export-views', 'GenerateCsvRead');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to read CSV export views.',
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

            const response = await new CsvExportViewSearcher(this.repository).execute(dtoCriteria);

            return HttpResponse.ok({ ...response.toJson(), event: this.event });
        } catch (error) {
            const response = objectIdentityErrorResponse(error, this.event);
            if (response) return response;
            Helper.logInfo(error);
            return HttpResponse.internalServerError({ errors: error, event: this.event });
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
        const { value, error } = SearchSchema.validate(this.payload(), {
            abortEarly: false,
        });
        if (error) {
            return HttpResponse.validationsFail({ errors: error, event: this.event });
        }

        try {
            const hasPermission = this.user.hasPermission('administrador', 'csv-export-views', 'GenerateCsvRead');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to read CSV export views.',
                    event: this.event,
                });
            }
            const authorizedQuery = this.#authorizeSearch('generate-csv.search', value);
            const response = await new CsvExportViewSearcher(this.repository).execute(authorizedQuery);
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
            return HttpResponse.internalServerError({ errors: error, event: this.event });
        } finally {
            Helper.logInfo('End actionSearch');
        }
    }
}
