import { BaseController, HttpResponse, SearchAuthorizationError, SearchAuthorizationService } from '@kace/api-common';
import { EventSearcherByCaseId, KnexEventRepository } from '@kace/core/src/event-log';
import { SearchSchema } from '@kace/api-common/src/validation/schemas/SearchSchema';
import { Helper } from '@kace/core/src/shared/index.js';

export class ControllerSearchByCase extends BaseController {
    constructor(event, knexConfig) {
        super(event, knexConfig);

        // Pass CONFIG objects (not this.database_connection, a built Knex instance —
        // that would collapse the reader onto the writer, §8.1 footgun).
        const { readerConfig } = this.event.tenantContext;
        this.repository = new KnexEventRepository(knexConfig, readerConfig);
        this.started_at = new Date();
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

    async destroyDbConnection() {
        await this.repository.destroyConnection();
        await super.destroyDbConnection();
    }

    async actionSearch() {
        Helper.logInfo('Begin actionSearchCase');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'event-logs', 'EventLogsRead');

            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to read this resource.',
                    event: this.event,
                });
            }

            const case_id = this.pathParameters().id;
            if (!this.validateId(case_id)) {
                return HttpResponse.badRequest({
                    message: 'Invalid id',
                    event: this.event,
                });
            }

            const payload = this.payload();
            const dtoCriteria = SearchSchema.validate(payload, { abortEarly: false });

            if (dtoCriteria.error) {
                return HttpResponse.validationsFail({
                    errors: dtoCriteria.error,
                    event: this.event,
                });
            }

            const authorizedQuery = this.#authorizeSearch('event-logs.search-by-case.search', dtoCriteria.value);

            const response = await new EventSearcherByCaseId(this.repository).execute(case_id, authorizedQuery);
            return HttpResponse.ok({ ...response.toJson(), event: this.event });
        } catch (error) {
            if (error instanceof SearchAuthorizationError) {
                return HttpResponse.forbidden({
                    message: error.message,
                    event: this.event,
                });
            }

            Helper.logError(error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.event,
            });
        } finally {
            Helper.logInfo('End actionSearchCase');
        }
    }
}
