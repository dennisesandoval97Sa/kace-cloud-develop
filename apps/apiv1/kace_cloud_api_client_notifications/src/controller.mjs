import { createSchema, updateSchema } from './schemas.mjs';
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
import {
    ClientNotificationCreator,
    ClientNotificationDeleter,
    ClientNotificationFinder,
    ClientNotificationUpdater,
    ClientNotificationSearcher,
    KnexClientNotificationRepository,
} from '@kace/core/src/client-notifications';
import { CustomError, Helper } from '@kace/core/src/shared/index.js';

export class Controller extends BaseController {
    constructor(event, knexConfig) {
        super(event, knexConfig);

        // Pass CONFIG objects (not this.database_connection, a built Knex instance —
        // that would collapse the reader onto the writer, §8.1 footgun).
        const { readerConfig } = this.event.tenantContext;
        this.repository = new KnexClientNotificationRepository(knexConfig, readerConfig);
        this.started_at = new Date();
    }

    async destroyDbConnection() {
        await this.repository.destroyConnection();
        await super.destroyDbConnection();
    }

    async actionCreate() {
        Helper.logInfo('Begin actionCreate');
        try {
            const hasPermission = this.user.hasPermission(
                'administrador',
                'client-notifications',
                'ClientNotificationsCreate'
            );
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to create this resource.',
                    event: this.event,
                });
            }

            const payload = await secureObjectCreatePayload({
                payload: this.payload(),
                userId: this.user.id.value,
                now: this.started_at,
                actorId: this.user.id.value,
                tenantId: this.tenant?.id?.value,
                endpoint: 'POST /client-notifications',
                resourceType: 'client_notifications',
                repository: this.repository,
            });

            const data = createSchema.validate(payload, { abortEarly: false });
            if (data.error) {
                return HttpResponse.validationsFail({
                    errors: data.error,
                    event: this.event,
                });
            }

            await this.#ensureClientRelationship(data.value.client_id);
            if (data.value.read_by) {
                await this.#ensureUserRelationship(data.value.read_by);
            }

            await new ClientNotificationCreator(this.repository).execute(data.value);
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
                'client-notifications',
                'ClientNotificationsUpdate'
            );
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to update this resource.',
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
            payload.updated_at = new Date().toISOString();
            payload.updated_by = this.user.id.value;

            const data = updateSchema.validate(payload, { abortEarly: false });

            if (data.error) {
                return HttpResponse.validationsFail({
                    errors: data.error,
                    event: this.event,
                });
            }

            if (data.value.client_id) {
                await this.#ensureClientRelationship(data.value.client_id);
            }
            if (data.value.read_by) {
                await this.#ensureUserRelationship(data.value.read_by);
            }

            await new ClientNotificationUpdater(this.repository).execute(id, data.value);
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
                'client-notifications',
                'ClientNotificationsDelete'
            );
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to delete this resource.',
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

            await new ClientNotificationDeleter(this.repository).execute(id, dto);
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
                'client-notifications',
                'ClientNotificationsRead'
            );
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to read this resource.',
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
            const response = await new ClientNotificationFinder(this.repository).execute(id);
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
                'client-notifications',
                'ClientNotificationsRead'
            );
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to read this resource.',
                    event: this.event,
                });
            }

            const dtoCriteria = {
                filter: [
                    {
                        field: 'deleted_at',
                        operator: 'null',
                        value: '',
                        type: 'AND',
                    },
                ],
                relationship: undefined,
                limit: 10,
                offset: 0,
                order: {
                    field: 'created_at',
                    direction: 'desc',
                },
            };
            const response = await new ClientNotificationSearcher(this.repository).execute(dtoCriteria);
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
        try {
            const hasPermission = this.user.hasPermission(
                'administrador',
                'client-notifications',
                'ClientNotificationsRead'
            );
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to read this resource.',
                    event: this.event,
                });
            }

            const data = SearchSchema.validate(this.payload(), { abortEarly: false });
            if (data.error) {
                return HttpResponse.validationsFail({
                    errors: data.error,
                    event: this.event,
                });
            }

            const authorizedQuery = this.#authorizeSearch('client-notifications.search', data.value);
            const response = await new ClientNotificationSearcher(this.repository).execute(authorizedQuery);
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
            Helper.logError(error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.event,
            });
        }
    }

    async #ensureClientRelationship(clientId) {
        const client = await this.repository
            .connection(this.repository.qualifiedName('clients'))
            .select('id')
            .where({ id: clientId })
            .first();

        if (!client) {
            throw new CustomError('Client not found', 404);
        }
    }

    async #ensureUserRelationship(userId) {
        const user = await this.repository
            .connection(this.repository.qualifiedName('usuarios'))
            .select('id')
            .where({ id: userId })
            .first();

        if (!user) {
            throw new CustomError('User not found', 404);
        }
    }
}
