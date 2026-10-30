import { BaseController, HttpResponse, SearchAuthorizationError, SearchAuthorizationService } from '@kace/api-common';
import { KnexAuxiliariesRepository } from '@kace/core/src/auxiliaries/infrastructure/persistence/KnexAuxiliariesRepository';
import { AuxiliaryListSearcher } from '@kace/core/src/auxiliaries/application/AuxiliaryListSearcher';
import { Helper } from '@kace/core/src/shared/index.js';
import { SearchSchema } from '@kace/api-common/src/validation/schemas/SearchSchema';

export class ControllerListSearch extends BaseController {
    /**
     * is initialized in the constructor
     * @type {string}
     */
    #currentEntity;

    /**
     * is initialized in the constructor
     * @type {KnexAuxiliariesRepository}
     */
    #repository;

    constructor(event, knexConfig) {
        super(event, knexConfig);
        this.#currentEntity = `aux_${this.pathParameters().entity}`;
        this.#repository = new KnexAuxiliariesRepository(this.database_connection, this.#currentEntity);
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
        Helper.logInfo('Begin List Filter actionSearch');
        try {
            if (!this.user.hasAuxiliaryPermission(this.#currentEntity, 'Read')) {
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

            const queryString = this.event.queryStringParameters ?? {};
            const field = typeof queryString.field === 'string' ? queryString.field.trim() : undefined;

            const authorizedQuery = this.#authorizeSearch('auxiliaries.list-search.search', data.value);

            const response = await new AuxiliaryListSearcher(this.#repository).execute(
                this.#currentEntity,
                field,
                authorizedQuery
            );
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
            Helper.logInfo('End List actionSearch');
        }
    }

    async run() {
        const { httpMethod, pathParameters, path } = this.event;
        const entity = pathParameters?.entity;

        if (!entity) {
            return HttpResponse.badRequest({
                message: 'Invalid or missing entity',
                event: this.event,
            });
        }

        try {
            this.user = await this.getLoggedInUser();
        } catch (error) {
            Helper.logInfo('Error getLoggedInUser', error);
            return HttpResponse.badRequest({
                message: error.message,
                event: this.event,
            });
        }

        try {
            if (httpMethod === 'POST' && path.endsWith(`/${entity}/list/search`)) {
                return this.actionSearch();
            }

            return HttpResponse.notFound({
                message: 'Route not found',
                event: this.event,
            });
        } catch (error) {
            Helper.logError(error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.event,
            });
        }
    }
}
