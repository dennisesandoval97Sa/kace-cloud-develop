import {
    BaseController,
    HttpResponse,
    SearchSchema,
    SearchAuthorizationError,
    SearchAuthorizationService,
} from '@kace/api-common';
import { Helper } from '@kace/core/src/shared/index.js';
import { S3ImportsDashboard } from '@kace/core/src/imports/application/imports-dashboard/S3ImportsDashboard';
import { KnexS3ImportFiles } from '@kace/core/src/imports/infrastructure/persistence/KnexS3ImportFiles.js';
import { ImportsDashboardSearcher } from '@kace/core/src/imports/application/imports-dashboard/search/ImportsDashboardSearcher';

export class Controller extends BaseController {
    constructor(event, knexConfig) {
        super(event, knexConfig);

        // Pass CONFIG objects (not this.database_connection, a built Knex instance —
        // that would collapse the reader onto the writer, §8.1 footgun).
        const { readerConfig } = this.event.tenantContext;
        this.repository = new KnexS3ImportFiles(knexConfig, readerConfig);
    }

    async destroyDbConnection() {
        await this.repository.destroyConnection();
        await super.destroyDbConnection();
    }

    async actionRead() {
        Helper.logInfo('Begin actionRead');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'imports-dashboard', 'ImportsDashboardRead');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to view the imports dashboard.',
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

            const response = await new S3ImportsDashboard(this.repository).execute(id);
            return HttpResponse.ok({ ...response.toJson(), event: this.event });
        } catch (error) {
            Helper.logInfo(error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.event,
            });
        } finally {
            Helper.logInfo('End actionRead');
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
            const hasPermission = this.user.hasPermission('administrador', 'imports-dashboard', 'ImportsDashboardRead');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to read this resource.',
                    event: this.event,
                });
            }

            const payload = this.payload();
            const data = SearchSchema.validate(payload, { abortEarly: false });
            if (data.error) {
                return HttpResponse.validationsFail({
                    errors: data.error,
                    event: this.event,
                });
            }

            const importsSearcher = new ImportsDashboardSearcher(this.repository);
            const authorizedQuery = this.#authorizeSearch('imports-dashboard.search', data.value);
            // The dashboard is per-user (same scoping as actionRead/findImportsByUser):
            // enforce created_by server-side, after authorization, so it applies to
            // every caller regardless of the filters submitted.
            const userId = this.user.id?.value ?? this.user.id;
            if (!userId) {
                return HttpResponse.unauthorized({
                    message: 'Unable to resolve the authenticated user.',
                    event: this.event,
                });
            }
            const scopedQuery = {
                ...authorizedQuery,
                filter: [
                    ...(authorizedQuery.filter || []),
                    { field: 's3_import_files.created_by', operator: 'eq', value: userId, type: 'AND' },
                ],
            };
            const response = await importsSearcher.execute(scopedQuery);

            return HttpResponse.ok({ ...response.toJson(), event: this.event });
        } catch (error) {
            if (error instanceof SearchAuthorizationError) {
                return HttpResponse.forbidden({
                    message: error.message,
                    event: this.event,
                });
            }

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
