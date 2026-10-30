import { BaseController, HttpResponse, SearchAuthorizationError, SearchAuthorizationService } from '@kace/api-common';
import { VisibleUpdateSchema } from '@kace/api-common/src/validation/schemas/SearchSchema';
import { KnexCaseRepository } from '@kace/core/src/cases';
import { VisibleCaseSearcher } from '@kace/core/src/cases/application/search/VisibleCaseSearcher';
import { Helper } from '@kace/core/src/shared/index.js';

export class VisibleController extends BaseController {
    constructor(event, knexConfig, readerConfig = null) {
        super(event, knexConfig);
        /*
         * Build from CONFIG objects (never the Knex instance): an instance collapses the
         * reader onto the writer and silently disables replica routing.
         */
        this.repository = new KnexCaseRepository(knexConfig, readerConfig);
        this.started_at = new Date();
    }

    /**
     * The repository above owns its own pools (built from configs, not from
     * database_connection), so BaseController's cleanup does not cover it.
     */
    async destroyDbConnection() {
        await super.destroyDbConnection();
        await this.repository.destroyConnection();
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
        Helper.logInfo('Begin visisble cases actionSearch');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'cases', 'CasesRead');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to read this resource.',
                    event: this.event,
                });
            }
            const data = VisibleUpdateSchema.validate(this.payload(), { abortEarly: false });

            if (data.error) {
                return HttpResponse.validationsFail({
                    errors: data.error,
                    event: this.event,
                });
            }

            const { is_visible, ...criteriaDto } = data.value;

            const authorizedQuery = this.#authorizeSearch('cases-2.case-visible.search', criteriaDto);
            const response = await new VisibleCaseSearcher(this.repository).execute(authorizedQuery, is_visible);

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
            Helper.logInfo('End visisble cases actionSearch');
        }
    }
}
