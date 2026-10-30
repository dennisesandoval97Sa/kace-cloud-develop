import { BaseController, HttpResponse, SearchAuthorizationError, SearchAuthorizationService } from '@kace/api-common';
import { SearchSchema } from '@kace/api-common/src/validation/schemas/SearchSchema';
import { ViewCaseSearcher, ConfiguredViewCaseRepositoryFactory } from '@kace/core/src/cases';
import { Helper } from '@kace/core/src/shared/index.js';

const cleanCaseViewFilterField = (filter) => {
    if (filter.groupType && Array.isArray(filter.filters)) {
        return {
            ...filter,
            filters: filter.filters.map(cleanCaseViewFilterField),
        };
    }

    if (typeof filter.field === 'string' && filter.field.includes('.')) {
        return {
            ...filter,
            field: filter.field.split('.')[1],
        };
    }

    return filter;
};

export class ViewController extends BaseController {
    #repository = null;

    /** @type {ConfiguredViewCaseRepositoryFactory} */
    #repositoryFactory;

    constructor(event, knexConfig, readerConfig = null) {
        super(event, knexConfig);
        // Factory receives CONFIG objects (never the Knex instance) so the view repository
        // can open a real reader pool; the writer instance is only used for view-name resolution.
        this.#repositoryFactory = new ConfiguredViewCaseRepositoryFactory(this.database_connection, {
            knexConfig,
            readerConfig,
        });
        this.started_at = new Date();
    }

    /**
     * Resolves the view name and builds the repository for the authenticated user's group config.
     * The result is cached for the lifetime of this controller instance (one request),
     * so getGlobalConfig() and the view-existence queries run at most once per request.
     * @returns {Promise<KnexViewCaseRepository>}
     */
    async #buildRepository() {
        if (this.#repository) return this.#repository;

        const globalConfig = await this.getGlobalConfig();
        this.#repository = await this.#repositoryFactory.create(globalConfig);
        return this.#repository;
    }

    /**
     * The view repository is built from configs and owns its own pools, so
     * BaseController's cleanup does not cover it.
     */
    async destroyDbConnection() {
        await super.destroyDbConnection();
        if (this.#repository) {
            await this.#repository.destroyConnection();
        }
    }

    async actionIndex() {
        Helper.logInfo('Begin actionIndex');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'cases', 'CasesRead');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to read this resource.',
                    event: this.event,
                });
            }

            const repository = await this.#buildRepository();

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

            const response = await new ViewCaseSearcher(repository).execute(dtoCriteria);

            return HttpResponse.ok({ ...response.toJson(), event: this.event });
        } catch (error) {
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
            const hasPermission = this.user.hasPermission('administrador', 'cases', 'CasesRead');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to read this resource.',
                    event: this.event,
                });
            }

            const { value, error } = SearchSchema.validate(this.payload(), {
                abortEarly: false,
            });
            if (error) {
                return HttpResponse.validationsFail({ errors: error });
            }

            let payload;

            if (value.filter && value.filter.length > 0) {
                const cleanFilters = value.filter.map(cleanCaseViewFilterField);

                payload = { ...value, filter: cleanFilters };
            }

            const repository = await this.#buildRepository();

            const authorizedQuery = this.#authorizeSearch('cases.case-view.search', payload ? payload : value);
            const response = await new ViewCaseSearcher(repository).execute(authorizedQuery);

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
