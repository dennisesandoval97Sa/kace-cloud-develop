import { ClientCreateSchema, ClientUpdateSchema } from './ClientSchema.mjs';
import { SearchSchema } from '@kace/api-common/src/validation/schemas/SearchSchema';
import {
    ClientCreator,
    ClientDeleter,
    ClientFinder,
    ClientUpdater,
    ClientSearcher,
    KnexClientRepository,
} from '@kace/core/src/clients';
import { FakeClientCreator } from '@kace/core/src/fake-clients/application/create/FakeClientCreator.js';
import { HttpResponse, BaseController, SearchAuthorizationError, SearchAuthorizationService } from '@kace/api-common';
import {
    applyServerManagedFields,
    assertAuthorizedRelationships,
    assertCreateRouteUpdateAuthorized,
    objectIdentityErrorResponse,
    resolveCanonicalCreateIdentity,
} from '@kace/api-common/src/security/ObjectIdentityAuthorization.js';
import { Helper, ValueObjectUuid } from '@kace/core/src/shared/index.js';
import { KnexGroupsRepository } from '@kace/core/src/grupos/index.js';
import { GlobalValidationService, KnexGlobalConfigurationRepository } from '@kace/core/src/global-config/index.js';
import { KnexFakeClientRepository } from '@kace/core/src/fake-clients/infrastructure/persistence/KnexFakeClientRepository.js';
import { KnexAllowedConnectionsRepository } from '@kace/core/src/allowed-conections/infrastructure/persistence/KnexAllowedConnectionsRepository.js';
import { KnexSecretsVaultRepository } from '@kace/core/src/secrets-vault/infrastructure/persistence/KnexSecretsVaultRepository.js';
import { KnexWSRestWorkflowStepRepository } from '@kace/core/src/ws-rest-workflow-step/infrastructure/persistence/KnexWSRestWorkflowStepRepository.js';

export class Controller extends BaseController {
    #LIKE_FIELDS = ['nombres', 'apellido1', 'apellido2', 'nombre_empresa'];
    #EQUAL_FIELDS = ['documento'];

    /** @type {GlobalValidationService} is initialized in the constructor */
    #globalValidationService;

    /** @type {KnexGroupsRepository} */
    #groupsRepository; // is initialized in the constructor

    /** @type {KnexGlobalConfigurationRepository} */
    #globalConfig; // is initialized in the constructor

    /** @type {KnexAllowedConnectionsRepository} */
    #allowedConnection; // is initialized in the constructor

    /** @type {KnexSecretsVaultRepository} */
    #secretVault; // is initialized in the constructor

    /** @type {KnexWSRestWorkflowStepRepository} */
    #wsRestWorkflowStep; // is initialized in the constructor

    constructor(event, knexConfig) {
        super(event, knexConfig);
        this.repository = new KnexClientRepository(this.database_connection);
        this.#globalValidationService = new GlobalValidationService(
            new KnexGroupsRepository(this.database_connection),
            new KnexGlobalConfigurationRepository(this.database_connection)
        );
        this.globalValidationService = this.#globalValidationService;
        this.fakeClientRepository = new KnexFakeClientRepository(this.database_connection);
        this.clientCreatorFactory = (repository) => new ClientCreator(repository);
        this.clientUpdaterFactory = (repository) => new ClientUpdater(repository);
        this.clientDeleterFactory = (repository) => new ClientDeleter(repository);
        this.fakeClientCreatorFactory = (repository) => new FakeClientCreator(repository);

        this.started_at = new Date();

        this.#groupsRepository = new KnexGroupsRepository(this.database_connection);
        this.#globalConfig = new KnexGlobalConfigurationRepository(this.database_connection);
        this.#allowedConnection = new KnexAllowedConnectionsRepository(this.database_connection);
        this.#secretVault = new KnexSecretsVaultRepository(this.database_connection);
        this.#wsRestWorkflowStep = new KnexWSRestWorkflowStepRepository(this.database_connection);
    }

    async actionCreate() {
        Helper.logInfo('Begin actionCreate');

        try {
            const hasPermission = this.user.hasPermission('agente', 'clients', 'ClientsCreate');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to create this resource.',
                    event: this.event,
                });
            }

            let payload = applyServerManagedFields(this.payload(), {
                operation: 'create',
                userId: this.user.id.value,
                now: this.started_at,
            });

            const identity = await resolveCanonicalCreateIdentity({
                payload,
                allowLegacyId: false,
                actorId: this.user.id.value,
                tenantId: this.tenant?.id?.value,
                endpoint: 'POST /clients',
                resourceType: 'clients',
            });
            payload = identity.payload;

            const { error, value } = ClientCreateSchema.validate(payload, {
                abortEarly: false,
            });
            if (error) {
                return HttpResponse.validationsFail({
                    errors: error,
                    event: this.event,
                });
            }

            await this.globalValidationService.validateFields(this.user, 'agente', 'clients', value);
            await assertAuthorizedRelationships({
                payload: value,
                repository: this.repository,
                actorId: this.user.id.value,
                tenantId: this.tenant?.id?.value,
                endpoint: 'POST /clients',
                resourceType: 'clients',
                relationships: [
                    { field: 'padre_id', table: 'clients' },
                    { field: 'contactos', table: 'clients' },
                ],
            });

            const client = await this.repository.findByIdentification(value.tipo_documento, value.documento);
            if (!client) {
                await this.clientCreatorFactory(this.repository).execute(value);

                const fakeClientExist = await this.fakeClientRepository.find(new ValueObjectUuid('id', payload.id));

                if (!fakeClientExist) {
                    await this.fakeClientCreatorFactory(this.fakeClientRepository).execute(value);
                }

                return HttpResponse.created({
                    data: { id: value.id },
                    event: this.event,
                });
            } else {
                assertCreateRouteUpdateAuthorized({
                    user: this.user,
                    existingObject: client,
                    permission: [
                        { role: 'agente', moduleId: 'clients', action: 'ClientsUpdate' },
                        { role: 'administrador', moduleId: 'clients', action: 'ClientsUpdate' },
                    ],
                    actorId: this.user.id.value,
                    tenantId: this.tenant?.id?.value,
                    endpoint: 'POST /clients',
                    resourceType: 'clients',
                });
                value.id = client.id.value;
                value.updated_at = this.started_at;
                value.updated_by = this.user.id.value;
                await this.clientUpdaterFactory(this.repository).execute(client.id.value, value);
                return HttpResponse.ok({ data: { id: value.id }, event: this.event });
            }
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
            const hasPermission = this.user.hasPermission('administrador', 'clients', 'ClientsUpdate');
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

            const payload = applyServerManagedFields(this.payload(), {
                operation: 'update',
                userId: this.user.id.value,
                now: this.started_at,
            });

            const { error, value } = ClientUpdateSchema.validate(payload, {
                abortEarly: false,
            });
            if (error) {
                return HttpResponse.validationsFail({
                    errors: error,
                    event: this.event,
                });
            }
            await this.globalValidationService.validateFields(this.user, 'agente', 'clients', value);
            await assertAuthorizedRelationships({
                payload: value,
                repository: this.repository,
                actorId: this.user.id.value,
                tenantId: this.tenant?.id?.value,
                endpoint: 'POST /clients/{id}',
                resourceType: 'clients',
                relationships: [{ field: 'padre_id', table: 'clients' }],
            });

            await this.clientUpdaterFactory(this.repository).execute(id, value);
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
            const hasPermission = this.user.hasPermission('administrador', 'clients', 'ClientsDelete');
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
            const dto = applyServerManagedFields(
                {},
                {
                    operation: 'delete',
                    userId: this.user.id.value,
                    now: new Date().toISOString(),
                }
            );

            await this.clientDeleterFactory(this.repository).execute(id, dto);
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

    async actionRead() {
        Helper.logInfo('Begin actionRead');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'clients', 'ClientsRead');
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
            const response = await new ClientFinder(this.repository).execute(id);
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

    async actionIndex() {
        Helper.logInfo('Begin actionIndex');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'clients', 'ClientsRead');
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
                order: {
                    field: 'created_at',
                    direction: 'desc',
                },
            };
            const response = await new ClientSearcher(
                this.repository,
                this.#groupsRepository,
                this.#globalConfig,
                this.#wsRestWorkflowStep,
                this.#allowedConnection,
                this.#secretVault,
                this.user
            ).execute(dtoCriteria);
            return HttpResponse.ok({ ...response.toJson(), event: this.event });
        } catch (error) {
            Helper.logError(error);
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
            const hasAdminPermission = this.user.hasPermission('administrador', 'clients', 'ClientsRead');

            const hasAgentPermission = this.user.hasPermission('agente', 'clients', 'ClientsRead');
            if (!hasAdminPermission && !hasAgentPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to read this resource.',
                    event: this.event,
                });
            }
            const { error, value } = SearchSchema.validate(this.payload(), {
                abortEarly: false,
            });

            if (error) {
                return HttpResponse.validationsFail({
                    errors: error,
                    event: this.event,
                });
            }

            const modifiedData = {
                ...value,
                filter: this.#transformerFilter(value.filter),
            };

            const authorizedQuery = this.#authorizeSearch('clients.search', modifiedData);
            const response = await new ClientSearcher(
                this.repository,
                this.#groupsRepository,
                this.#globalConfig,
                this.#wsRestWorkflowStep,
                this.#allowedConnection,
                this.#secretVault,
                this.user
            ).execute(authorizedQuery, this.user.grupo_activo);
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
            Helper.logInfo('End actionSearch');
        }
    }

    /**
     * @param {?Array<object>} filter Array of filters.
     *
     * @returns {?Array<object>} Array of filters with the correct operator.
     */
    #transformerFilter(filter) {
        if (!filter || !Array.isArray(filter)) {
            return null;
        }

        return filter.map(({ field, operator, ...rest }) => {
            let newOperator = operator;

            if (operator === 'like' && this.#EQUAL_FIELDS.includes(field)) {
                newOperator = 'eq';
            }

            if (operator === 'like' && this.#LIKE_FIELDS.includes(field)) {
                newOperator = 'ilike';
            }

            return {
                field,
                operator: newOperator,
                ...rest,
            };
        });
    }
}
