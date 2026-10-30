import {
    BaseController,
    HttpResponse,
    SearchSchema,
    SearchAuthorizationError,
    SearchAuthorizationService,
} from '@kace/api-common';
import {
    objectIdentityErrorResponse,
    secureObjectCreatePayload,
} from '@kace/api-common/src/security/ObjectIdentityAuthorization.js';
import { schemaCreate, schemaUpdate } from './schemas.js';
import {
    KnexUserListsRepository,
    UserListCreator,
    UserListDeleter,
    UserListFinder,
    UserListSearcher,
    UserListUpdater,
    UserListValidator,
} from '@kace/core/src/user-lists/index.js';
import { KnexUsersRepository } from '@kace/core/src/users/index.js';
import { Helper } from '@kace/core/src/shared/index.js';

export class Controller extends BaseController {
    constructor(event, knexConfig) {
        super(event, knexConfig);
        this.startedAt = new Date();

        // UserList repo reads (find/search/count) go to the replica; pass CONFIG objects (not
        // this.database_connection, a built instance — §8.1 footgun). The Users validator repo is
        // shared and used only for write-path validation; keep it on the writer.
        const { readerConfig } = this.event.tenantContext;
        this.userListRepository = new KnexUserListsRepository(knexConfig, readerConfig);
        this.userRepository = new KnexUsersRepository(this.database_connection);
        this.userListValidator = new UserListValidator(this.userRepository);
    }

    async destroyDbConnection() {
        await this.userListRepository.destroyConnection();
        await super.destroyDbConnection();
    }

    async actionCreate() {
        Helper.logInfo('Begin actionCreate');
        try {
            const hasPermission = this.user.hasPermission(
                'administrador',
                'assignment-users-list',
                'AssignmentUsersListCreate'
            );
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to create user list assignments.',
                    event: this.event,
                });
            }
            const payload = await secureObjectCreatePayload({
                payload: this.payload(),
                userId: this.user.id.value,
                now: this.startedAt,
                actorId: this.user.id.value,
                tenantId: this.tenant?.id?.value,
                endpoint: 'POST /assignment-users-list',
                resourceType: 'assignment_users_list',
                repository: this.userListRepository,
            });

            const data = schemaCreate.validate(payload, { abortEarly: false });
            if (data.error) {
                return HttpResponse.validationsFail({
                    errors: data.error,
                    event: this.event,
                });
            }

            await new UserListCreator(this.userListRepository, this.userListValidator).execute(data.value);

            return HttpResponse.created({ event: this.event });
        } catch (error) {
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
            const hasPermission = this.user.hasPermission(
                'administrador',
                'assignment-users-list',
                'AssignmentUsersListUpdate'
            );
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to update user list assignments.',
                    event: this.event,
                });
            }
            const id = this.pathParameters().id;
            if (!this.validateId(id)) {
                return HttpResponse.badRequest({
                    message: 'Invalid ID',
                    event: this.event,
                });
            }

            const payload = this.payload();
            payload.updated_at = this.startedAt;
            payload.updated_by = this.user.id.value;

            const data = schemaUpdate.validate(payload, { abortEarly: false });
            if (data.error) {
                return HttpResponse.validationsFail({
                    errors: data.error,
                    event: this.event,
                });
            }

            await new UserListUpdater(this.userListRepository, this.userListValidator).execute(id, data.value);

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
            const hasPermission = this.user.hasPermission(
                'administrador',
                'assignment-users-list',
                'AssignmentUsersListDelete'
            );
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to delete user list assignments.',
                    event: this.event,
                });
            }
            const id = this.pathParameters().id;
            if (!this.validateId(id)) {
                return HttpResponse.badRequest({
                    message: 'Invalid ID',
                    event: this.event,
                });
            }

            const dto = {
                deleted_at: new Date().toISOString(),
                deleted_by: this.user.id.value,
            };

            await new UserListDeleter(this.userListRepository).execute(id, dto);

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
            const hasPermission = this.user.hasPermission(
                'administrador',
                'assignment-users-list',
                'AssignmentUsersListRead'
            );
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to read user list assignments.',
                    event: this.event,
                });
            }
            const id = this.pathParameters().id;
            if (!this.validateId(id)) {
                return HttpResponse.badRequest({
                    message: 'Invalid ID',
                    event: this.event,
                });
            }

            const response = await new UserListFinder(this.userListRepository).execute(id);

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
            const hasPermission = this.user.hasPermission(
                'administrador',
                'assignment-users-list',
                'AssignmentUsersListRead'
            );
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to list user list assignments.',
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

            const response = await new UserListSearcher(this.userListRepository).execute(dtoCriteria);

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
            const hasPermission = this.user.hasPermission(
                'administrador',
                'assignment-users-list',
                'AssignmentUsersListRead'
            );
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to search user list assignments.',
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

            const authorizedQuery = this.#authorizeSearch('assignment-users-list.search', data.value);
            const response = await new UserListSearcher(this.userListRepository).execute(authorizedQuery);

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
