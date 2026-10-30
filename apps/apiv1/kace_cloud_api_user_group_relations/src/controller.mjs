import { BaseController, HttpResponse, SearchAuthorizationError, SearchAuthorizationService } from '@kace/api-common';
import { batchAddUserGroupSchema, batchRemoveUserGroupSchema } from './schemas.mjs';
import { SearchSchema } from '@kace/api-common/src/validation/schemas/SearchSchema';
import {
    UserGroupBatchCreator,
    UserGroupBatchDeleter,
    UserGroupSearcher,
    IdsValidator,
    KnexUserGroupRelationshipRepository,
} from '@kace/core/src/user-group-relationships';
import { KnexUsersRepository } from '@kace/core/src/users';
import { KnexGroupsRepository } from '@kace/core/src/grupos';
import { Helper } from '@kace/core/src/shared/index.js';

export class Controller extends BaseController {
    constructor(event, knexConfig) {
        super(event, knexConfig);
        const { readerConfig } = this.event.tenantContext;
        this.repository = new KnexUserGroupRelationshipRepository(knexConfig, readerConfig);
        this.idsValidationService = new IdsValidator(
            new KnexUsersRepository(this.database_connection),
            new KnexGroupsRepository(this.database_connection)
        );
        this.started_at = new Date();
    }

    async destroyDbConnection() {
        await this.repository.destroyConnection();
        await super.destroyDbConnection();
    }

    async actionIndex() {
        Helper.logInfo('Begin actionIndex');
        try {
            const hasPermission = this.user.hasPermission(
                'administrador',
                'user-group-relationships',
                'UserGroupsRelationshipRead'
            );
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to read this resource.',
                    event: this.event,
                });
            }

            const dtoCriteria = {
                filter: undefined,
                relationship: undefined,
                limit: 10,
                offset: 0,
                order: undefined,
            };

            const response = await new UserGroupSearcher(this.repository).execute(dtoCriteria);

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

    async actionCreate() {
        Helper.logInfo('Begin actionCreate');
        try {
            const hasPermission = this.user.hasPermission(
                'administrador',
                'user-group-relationships',
                'UserGroupsRelationshipCreate'
            );
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to create this resource.',
                    event: this.event,
                });
            }

            const { value, error } = batchAddUserGroupSchema.validate(this.payload(), { abortEarly: false });
            if (error) {
                return HttpResponse.validationsFail({
                    errors: error,
                    event: this.event,
                });
            }

            await new UserGroupBatchCreator(this.repository, this.idsValidationService).execute(
                value,
                this.user.id.value
            );

            return HttpResponse.created({ event: this.event });
        } catch (error) {
            Helper.logInfo(error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.event,
            });
        } finally {
            Helper.logInfo('End actionCreate');
        }
    }

    async actionDelete() {
        Helper.logInfo('Begin actionDelete');
        try {
            const hasPermission = this.user.hasPermission(
                'administrador',
                'user-group-relationships',
                'UserGroupsRelationshipDelete'
            );
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to delete this resource.',
                    event: this.event,
                });
            }

            const { value, error } = batchRemoveUserGroupSchema.validate(this.payload(), { abortEarly: false });
            if (error) {
                return HttpResponse.validationsFail({
                    errors: error,
                    event: this.event,
                });
            }

            await new UserGroupBatchDeleter(this.repository, this.idsValidationService).execute(
                value,
                this.user.id.value
            );

            return HttpResponse.ok({ event: this.event });
        } catch (error) {
            Helper.logInfo(error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.event,
            });
        } finally {
            Helper.logInfo('End actionDelete');
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
            const hasPermission = this.user.hasPermission(
                'administrador',
                'user-group-relationships',
                'UserGroupsRelationshipRead'
            );
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
                return HttpResponse.validationsFail({
                    errors: error,
                    event: this.event,
                });
            }

            const authorizedQuery = this.#authorizeSearch('user-group-relations.search', value);
            const response = await new UserGroupSearcher(this.repository).execute(authorizedQuery);

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

    /**
     * @returns {Promise<Response>}
     */
    async run() {
        this.user = await this.getLoggedInUser();
        return this.#newActions();
    }

    async runCognitoAuth() {
        return this.#newActions();
    }

    /**
     * @returns {Promise<Response>}
     */
    async #newActions() {
        const resource = this.resource();
        const method = this.httpMethod();

        const resourceActions = {
            GET: {
                '/': this.actionIndex,
                '/search': this.actionSearch,
            },
            POST: {
                '/': this.actionCreate,
                '/delete': this.actionDelete,
                '/search': this.actionSearch,
            },
        };

        const action = resourceActions[method]?.[resource];
        if (action) {
            return action.call(this);
        }

        if (method === 'GET' || method === 'POST') {
            return HttpResponse.notFound({
                message: `Resource not found: ${resource}`,
                event: this.event,
            });
        }

        return HttpResponse.methodNotAllowed({ event: this.event });
    }

    resource() {
        return this.event.resource;
    }
}
