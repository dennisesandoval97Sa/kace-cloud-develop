import { BaseController, HttpResponse, SearchAuthorizationError, SearchAuthorizationService } from '@kace/api-common';
import { SearchSchema } from '@kace/api-common/src/validation/schemas/SearchSchema';
import {
    CustomListCollectionResponse,
    CustomListsSearcher,
    KnexCustomListsRepository,
} from '@kace/core/src/custom-lists';
import { Helper } from '@kace/core/src/shared/index.js';

export class ActiveGroupController extends BaseController {
    #event; // is initialized in the constructor
    constructor(event, knexConfig) {
        super(event, knexConfig);

        // Pass CONFIG objects (not a built Knex instance — §8.1 footgun).
        const { readerConfig } = this.event.tenantContext;
        this.repository = new KnexCustomListsRepository(knexConfig, readerConfig);
        this.started_at = new Date();
        this.#event = event;
    }

    async destroyDbConnection() {
        await super.destroyDbConnection();
        await this.repository.destroyConnection();
    }

    async actionIndex() {
        Helper.logInfo('Begin actionIndex by Active Group');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'custom-lists', 'CustomListsRead');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to read this resource.',
                    event: this.#event,
                });
            }
            const customListId = this.#event?.pathParameters?.id;

            if (!customListId) {
                return HttpResponse.badRequest({
                    message: 'Custom list ID is required.',
                    event: this.#event,
                });
            }

            const activeGroup = this.user?.grupo_activo?.value ?? this.user?.grupo_activo;

            if (!activeGroup) {
                return HttpResponse.notFound({
                    message: "Custom list not found or you don't have access to it.",
                    event: this.#event,
                });
            }

            const customList = await this.repository.findByIdAndGroup(customListId, activeGroup);

            if (!customList) {
                return HttpResponse.notFound({
                    message: "Custom list not found or you don't have access to it.",
                    event: this.#event,
                });
            }

            return HttpResponse.ok({
                data: customList.toJson(),
                event: this.#event,
            });
        } catch (error) {
            Helper.logInfo(error);
            return HttpResponse.internalServerError({ errors: error, event: this.#event });
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
            const hasPermission = this.user.hasPermission('administrador', 'custom-lists', 'CustomListsRead');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to read this resource.',
                    event: this.#event,
                });
            }

            const data = SearchSchema.validate(this.payload(), { abortEarly: false });
            if (data.error) {
                return HttpResponse.validationsFail({ errors: data.error, event: this.#event });
            }

            const authorizedQuery = this.#authorizeSearch('custom-lists.active-group.search', data.value);
            const response = await new CustomListsSearcher(this.repository).execute(authorizedQuery);

            return HttpResponse.ok({ ...response.toJson(), event: this.#event });
        } catch (error) {
            if (error instanceof SearchAuthorizationError) {
                return HttpResponse.forbidden({
                    message: error.message,
                    event: this.event,
                });
            }

            Helper.logError(error);
            return HttpResponse.internalServerError({ errors: error, event: this.#event });
        } finally {
            Helper.logInfo('End actionSearch');
        }
    }
}
