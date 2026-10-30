import {
    BaseController,
    HttpResponse,
    SearchSchema,
    SearchAuthorizationError,
    SearchAuthorizationService,
} from '@kace/api-common';
import {
    assertAuthorizedRelationships,
    objectIdentityErrorResponse,
    secureObjectCreatePayload,
} from '@kace/api-common/src/security/ObjectIdentityAuthorization.js';
import { UserCreator, UserDeleter, UserFinder, UserSearcher, UserUpdater } from '@kace/core/src/users/index.js';
import { schemaCreate, schemaUpdate } from './schemas.js';
import { KnexCaseRepository } from '@kace/core/src/cases/index.js';
import { Helper } from '@kace/core/src/shared/infrastructure/utils/Helper.js';
import { CustomError, InvalidArgumentError, ValidationFailError } from '@kace/core/src/shared/index.js';
import { EntityActionExecutionServiceFactory } from '@kace/core/src/actions/infrastructure/EntityActionExecutionServiceFactory.js';
import { SearchHistory } from '@kace/core/src/shared/domain/services/SearchHistory';
import { SchemaConversionsApplier } from '@kace/core/src/shared/domain/services/SchemaConversionsApplier.js';
import SchemaBuilder from '@kace/schemabuilder/src/SchemaBuilder.js';
import { KnexSchemasRepository } from '@kace/core/src/schemas/infrastructure/persistence/KnexSchemasRepository';
import { SchemaRules } from '@kace/core/src/schemas/application/rules/SchemaRules';
import { GroupFinder, KnexGroupsRepository } from '@kace/core/src/grupos/index.js';
import { GlobalConfigFinder, KnexGlobalConfigurationRepository } from '@kace/core/src/global-config';
import { KnexUsersRepository } from '@kace/core/src/users/infrastructure/KnexUsersRepository.js';
import { IdsValidator, KnexUserGroupRelationshipRepository } from '@kace/core/src/user-group-relationships/index.js';
import { applyDefaultActiveGroup } from './activeGroup.mjs';
import { USER_RELATIONSHIP_RULES, changedRelationshipRules } from './userRelationships.mjs';
import { USER_CREATE_ACTIVE_GROUP_NOT_IN_MEMBERSHIPS, USER_CREATE_GROUPS_NOT_FOUND } from '@kace/error-codes';

export default class Controller extends BaseController {
    #schemasRepository;
    #schemaRules;
    #globalConfigRepository;
    #groupFinder;
    #globalConfigFinder;
    constructor(event, knexConfig) {
        super(event, knexConfig);
        const { readerConfig } = this.event.tenantContext;
        this.repository = new KnexUsersRepository(knexConfig, readerConfig);
        this.casesRepository = new KnexCaseRepository(this.database_connection);
        this.started_at = new Date();
        this.actionExecutionService = EntityActionExecutionServiceFactory.create(this.repository);
        this.#schemasRepository = new KnexSchemasRepository(this.database_connection);
        this.#schemaRules = new SchemaRules(this.#schemasRepository);
        this.#globalConfigRepository = new KnexGlobalConfigurationRepository(this.database_connection);
        this.#globalConfigFinder = new GlobalConfigFinder(this.#globalConfigRepository);
        this.#groupFinder = new GroupFinder(new KnexGroupsRepository(this.database_connection));
    }

    async actionCreate() {
        Helper.logInfo('Begin actionCreate');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'users', 'UsersCreate');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to create this resource.',
                    event: this.event,
                });
            }

            const payload = applyDefaultActiveGroup(
                await secureObjectCreatePayload({
                    payload: this.payload(),
                    userId: this.user.id.value,
                    now: this.started_at,
                    actorId: this.user.id.value,
                    tenantId: this.tenant?.id?.value,
                    endpoint: 'POST /users',
                    resourceType: 'users',
                    repository: this.repository,
                    relationships: USER_RELATIONSHIP_RULES,
                })
            );

            const data = schemaCreate.validate(payload, { abortEarly: false });
            if (data.error) {
                return HttpResponse.validationsFail({
                    errors: data.error,
                    event: this.event,
                });
            }

            const dto = { ...data.value };
            dto.plainPassword = data.value.password;
            const groupIds = [...new Set((dto.group_ids ?? []).filter(Boolean))];
            const userGroupRepository = new KnexUserGroupRelationshipRepository(this.database_connection);
            const groupsRepository = new KnexGroupsRepository(this.database_connection);
            const idsValidator = new IdsValidator(this.repository, groupsRepository);
            const userCreator = new UserCreator(
                this.repository,
                this.actionExecutionService,
                userGroupRepository,
                idsValidator
            );

            if (!groupIds.includes(dto.grupo_activo)) {
                throw new ValidationFailError(
                    'grupo_activo must be one of group_ids',
                    'grupo_activo',
                    [],
                    USER_CREATE_ACTIVE_GROUP_NOT_IN_MEMBERSHIPS
                );
            }
            try {
                await idsValidator.validateGroupIds(groupIds);
            } catch (error) {
                if (error instanceof InvalidArgumentError) {
                    throw new ValidationFailError(
                        'One or more group_ids do not exist',
                        'group_ids',
                        [],
                        USER_CREATE_GROUPS_NOT_FOUND
                    );
                }
                throw error;
            }

            let schemaId;
            if (dto.grupo_activo) {
                const groupResponse = await this.#groupFinder.execute(dto.grupo_activo);
                const globalConfigId = groupResponse.toJson().data.configuration_id;
                const globalConfig = await this.#globalConfigFinder.getConfiguration(
                    globalConfigId,
                    'behaviors',
                    'admin',
                    'users'
                );
                schemaId = globalConfig.users_schema_id;
            }

            if (!schemaId || schemaId === '') {
                await userCreator.execute(dto);
            } else {
                const schema = await this.#schemaRules.execute(schemaId);
                const dataStructure = schema.toJson().data.data_structure;
                const joiBuilderValidation = SchemaBuilder.build(dataStructure);
                const valueData = joiBuilderValidation.validate(data.value.data);

                if (valueData.error) {
                    return HttpResponse.validationsFail({
                        errors: valueData.error,
                        event: this.event,
                    });
                }

                // `dto` is the object actually persisted: it is a shallow copy of `data.value`
                // taken before this block, so the converted values must land on `dto.data`.
                if (dto.data) {
                    dto.data = SchemaConversionsApplier.execute({
                        target: dto.data,
                        converted: valueData.value,
                        dataStructure,
                    });
                }

                await userCreator.execute(dto);
            }

            return HttpResponse.created({ data: { id: dto.id }, event: this.event });
        } catch (error) {
            const response = objectIdentityErrorResponse(error, this.event);
            if (response) return response;
            if (error instanceof ValidationFailError) {
                return HttpResponse.badRequest({ errors: error, event: this.event });
            }
            if (error instanceof CustomError) {
                return HttpResponse.badRequest({ errors: error, event: this.event });
            }
            Helper.logError('Error in actionCreate', error);
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
            const id = this.pathParameters().id;

            const hasAdminPermission = this.user.hasPermission('administrador', 'users', 'UsersUpdate');
            if (!hasAdminPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to update this resource.',
                    event: this.event,
                });
            }

            if (!this.validateId(id)) {
                return HttpResponse.badRequest({
                    message: 'Invalid id',
                    event: this.event,
                });
            }

            const payload = this.payload();
            payload.updated_at = this.started_at;
            payload.updated_by = this.user.id.value;

            const data = schemaUpdate.validate(payload, { abortEarly: false });
            if (data.error) {
                return HttpResponse.validationsFail({
                    errors: data.error,
                    event: this.event,
                });
            }

            const currentUser = await new UserFinder(this.repository, this.user).execute(id);

            const storedUser = currentUser.toJson().data;
            await assertAuthorizedRelationships({
                payload: data.value,
                repository: this.repository,
                actorId: this.user.id.value,
                tenantId: this.tenant?.id?.value,
                endpoint: 'POST /users/{id}',
                resourceType: 'users',
                relationships: changedRelationshipRules(data.value, storedUser),
            });

            const currentGroupId = storedUser.grupo_activo;
            if (currentGroupId) {
                let groupResponse = null;
                try {
                    groupResponse = await this.#groupFinder.execute(currentGroupId);
                } catch (groupError) {
                    if (groupError instanceof CustomError && groupError.statusCode === 404) {
                        Helper.logInfo(
                            `Self-healing grupo_activo: references a deleted group (userId=${id}, groupId=${currentGroupId}); nulling unless caller overrides.`
                        );
                        if (data.value.grupo_activo === undefined) {
                            data.value.grupo_activo = null;
                        }
                    } else {
                        throw groupError;
                    }
                }

                if (groupResponse) {
                    const globalConfigIdUpdate = groupResponse.toJson().data.configuration_id;

                    const globalConfigUpdate = await this.#globalConfigFinder.getConfiguration(
                        globalConfigIdUpdate,
                        'behaviors',
                        'admin',
                        'users'
                    );

                    const schemaIdUpdate = globalConfigUpdate.users_schema_id;

                    if (!schemaIdUpdate || schemaIdUpdate === '') {
                        await new UserUpdater(this.repository, this.actionExecutionService).execute(id, data.value);
                        return HttpResponse.ok({ event: this.event });
                    }

                    const schemaUpdateObj = await this.#schemaRules.execute(schemaIdUpdate);
                    const dsUpdate = schemaUpdateObj.toJson().data.data_structure;

                    const partialKeys = Object.keys(data.value.data || {});
                    const partialDs = SchemaBuilder.buildPartial(dsUpdate, partialKeys);
                    const joiBuilderUpdate = SchemaBuilder.build(partialDs);
                    const valueUpdate = joiBuilderUpdate.validate(data.value.data, {
                        abortEarly: false,
                        context: { isUpdate: true },
                    });

                    if (valueUpdate.error) {
                        return HttpResponse.validationsFail({
                            errors: valueUpdate.error,
                            event: this.event,
                        });
                    }

                    if (data.value.data) {
                        data.value.data = SchemaConversionsApplier.execute({
                            target: data.value.data,
                            converted: valueUpdate.value,
                            dataStructure: partialDs,
                        });
                    }
                }
            }

            await new UserUpdater(this.repository, this.actionExecutionService).execute(id, data.value);

            return HttpResponse.ok({ event: this.event });
        } catch (error) {
            const response = objectIdentityErrorResponse(error, this.event);
            if (response) return response;
            Helper.logError('Error in actionUpdate', error);
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
            const hasPermission = this.user.hasPermission('administrador', 'users', 'UsersDelete');
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

            await new UserDeleter(this.repository, this.actionExecutionService).execute(id, dto);

            return HttpResponse.ok({ event: this.event });
        } catch (error) {
            const response = objectIdentityErrorResponse(error, this.event);
            if (response) return response;
            Helper.logError('Error in actionDelete', error);
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
            const hasPermission = this.user.hasPermission('administrador', 'users', 'UsersRead');
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

            const response = await new UserFinder(this.repository, this.user).execute(id, true);
            const userData = response.toJson().data;

            return HttpResponse.ok({
                ...response.toJson(),
                data: userData,
                event: this.event,
            });
        } catch (error) {
            const response = objectIdentityErrorResponse(error, this.event);
            if (response) return response;
            Helper.logError('Error in actionRead', error);
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
            const hasPermission = this.user.hasPermission('administrador', 'users', 'UsersRead');
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

            const service = new UserSearcher(this.repository, this.casesRepository);
            const response = await service.execute(dtoCriteria);

            return HttpResponse.ok({ ...response.toJson(), event: this.event });
        } catch (error) {
            const response = objectIdentityErrorResponse(error, this.event);
            if (response) return response;
            Helper.logError('Error in actionIndex', error);
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
            const hasAdminPermission = this.user.hasPermission('administrador', 'users', 'UsersRead');
            const hasAgentPermission = this.user.hasPermission('agente', 'users', 'UsersRead');

            if (!hasAdminPermission && !hasAgentPermission) {
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

            const userSearcher = new UserSearcher(this.repository, this.casesRepository);
            const authorizedQuery = this.#authorizeSearch('users.search', data.value);
            const response = await userSearcher.execute(authorizedQuery);

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
            Helper.logError('Error in actionSearch', error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.event,
            });
        } finally {
            Helper.logInfo('End actionSearch');
        }
    }

    async actionHistory() {
        Helper.logInfo('Begin actionHistory');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'users', 'UsersRead');
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
            const id = this.pathParameters().id;

            const response = await new SearchHistory(this.repository).execute(id, data.value);
            return HttpResponse.ok({ ...response, event: this.event });
        } catch (error) {
            const response = objectIdentityErrorResponse(error, this.event);
            if (response) return response;
            Helper.logError('Error in actionHistory', error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.event,
            });
        } finally {
            Helper.logInfo('End actionHistory');
        }
    }

    async destroyDbConnection() {
        await this.repository.destroyConnection();
        await super.destroyDbConnection();
    }
}
