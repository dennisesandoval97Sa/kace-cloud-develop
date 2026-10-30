import { GroupCreateSchema, GroupUpdateSchema } from './GroupSchema.mjs';
import {
    objectIdentityErrorResponse,
    secureObjectCreatePayload,
} from '@kace/api-common/src/security/ObjectIdentityAuthorization.js';
import { SearchSchema } from '@kace/api-common/src/validation/schemas/SearchSchema';
import {
    AssignmentActiveSessionLimitResolver,
    GroupCreator,
    GroupDeleter,
    GroupDetailFinder,
    GroupFinder,
    GroupRelationsCleaner,
    GroupScheduleGuard,
    GroupSearcher,
    GroupUpdater,
    GroupUsageGuard,
    KnexGroupsRepository,
} from '@kace/core/src/grupos';
import { KnexUsersRepository, UserFinder } from '@kace/core/src/users/index.js';
import { IdsValidator, KnexUserGroupRelationshipRepository } from '@kace/core/src/user-group-relationships/index.js';
import { KnexShiftManagementRepository, ScheduleLockConflict } from '@kace/core/src/shift-management';
import { KnexCaseRepository } from '@kace/core/src/cases';
import { HttpResponse, BaseController, SearchAuthorizationError, SearchAuthorizationService } from '@kace/api-common';
import { Response } from '@kace/api-common/src/http_responses/Response.js';
import { CustomError, Helper, ValidationFailError } from '@kace/core/src/shared/index.js';
import {
    CONFLICT_ERROR,
    GROUP_CREATE_USERS_NOT_FOUND,
    GROUP_HAS_ACTIVE_USERS,
    GROUP_SCHEDULE_UNAVAILABLE,
    RESOURCE_ALREADY_EXISTS,
} from '@kace/error-codes';
import { EntityActionExecutionServiceFactory } from '@kace/core/src/actions/infrastructure/EntityActionExecutionServiceFactory.js';
import { SchemaConversionsApplier } from '@kace/core/src/shared/domain/services/SchemaConversionsApplier.js';
import SchemaBuilder from '@kace/schemabuilder/src/SchemaBuilder.js';
import { KnexSchemasRepository } from '@kace/core/src/schemas/infrastructure/persistence/KnexSchemasRepository';
import { SchemaRules } from '@kace/core/src/schemas/application/rules/SchemaRules';
import { GlobalConfigFinder, KnexGlobalConfigurationRepository } from '@kace/core/src/global-config';

export class Controller extends BaseController {
    #casesRepository; /** is initialized in the constructor */
    #scheduleGuard; /** is initialized in the constructor */
    #schemasRepository;
    #schemaRules;
    #globalConfigRepository;
    #globalConfigFinder;
    constructor(event, knexConfig) {
        super(event, knexConfig);

        /*
         * Groups repo reads (find/search/count) go to the replica; pass CONFIG objects (not
         * this.database_connection, a built instance — §8.1 footgun). The satellite repos and the
         * GroupRelationsCleaner (write-only) stay on the writer.
         */
        const { readerConfig } = this.event.tenantContext;
        this.repository = new KnexGroupsRepository(knexConfig, readerConfig);
        this.userRepository = new KnexUsersRepository(this.database_connection);
        this.userGroupRepository = new KnexUserGroupRelationshipRepository(this.database_connection);
        this.idsValidator = new IdsValidator(this.userRepository, this.repository);
        this.#casesRepository = new KnexCaseRepository(this.database_connection);
        this.#scheduleGuard = new GroupScheduleGuard(new KnexShiftManagementRepository(this.database_connection));
        this.started_at = new Date();
        this.actionExecutionService = EntityActionExecutionServiceFactory.create(this.repository);
        this.relationsCleaner = new GroupRelationsCleaner(this.database_connection);
        this.#schemasRepository = new KnexSchemasRepository(this.database_connection);
        this.#schemaRules = new SchemaRules(this.#schemasRepository);
        this.#globalConfigRepository = new KnexGlobalConfigurationRepository(this.database_connection);
        this.#globalConfigFinder = new GlobalConfigFinder(this.#globalConfigRepository);
        this.usageGuard = new GroupUsageGuard(
            this.userRepository,
            new AssignmentActiveSessionLimitResolver({
                groupsRepository: this.repository,
                globalConfigurationRepository: this.#globalConfigRepository,
            })
        );
    }

    async destroyDbConnection() {
        await this.repository.destroyConnection();
        await super.destroyDbConnection();
    }

    async actionCreate() {
        Helper.logInfo('Begin actionCreate');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'groups', 'GroupsCreate');
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
                endpoint: 'POST /group',
                resourceType: 'group',
                repository: this.repository,
            });

            const data = GroupCreateSchema.validate(payload, { abortEarly: false });

            if (data.error) {
                return HttpResponse.validationsFail({
                    errors: data.error,
                    event: this.event,
                });
            }

            const currentUser = await new UserFinder(this.userRepository, this.user).execute(this.user?.id.value);
            const currentGroupId = currentUser.toJson().data.grupo_activo;

            const globalConfigId = await (await new GroupFinder(this.repository).execute(currentGroupId)).toJson().data
                .configuration_id;
            const globalConfig = await this.#globalConfigFinder.getConfiguration(
                globalConfigId,
                'behaviors',
                'admin',
                'groups'
            );
            const schemaId = globalConfig.groups_schema_id;
            const groupCreator = new GroupCreator(
                this.repository,
                this.actionExecutionService,
                this.userGroupRepository,
                this.idsValidator,
                this.#scheduleGuard
            );
            let createdGroupId;
            if (!schemaId || schemaId === '') {
                createdGroupId = await groupCreator.execute(data.value);
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

                if (data.value.data) {
                    data.value.data = SchemaConversionsApplier.execute({
                        target: data.value.data,
                        converted: valueData.value,
                        dataStructure,
                    });
                }

                createdGroupId = await groupCreator.execute(data.value);
            }
            return HttpResponse.created({ data: { id: createdGroupId }, event: this.event });
        } catch (error) {
            const response = objectIdentityErrorResponse(error, this.event);
            if (response) return response;
            const badRequestResponse = groupBadRequestErrorResponse(error, this.event);
            if (badRequestResponse) return badRequestResponse;
            const conflictResponse = scheduleLockConflictResponse(error, this.event);
            if (conflictResponse) return conflictResponse;
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
            const hasPermission = this.user.hasPermission('administrador', 'groups', 'GroupsUpdate');
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
            const data = GroupUpdateSchema.validate(payload, { abortEarly: false });

            if (data.error) {
                return HttpResponse.validationsFail({
                    errors: data.error,
                    event: this.event,
                });
            }
            const currentUser = await new UserFinder(this.userRepository, this.user).execute(this.user?.id.value);
            const currentGroupId = currentUser.toJson().data.grupo_activo;

            if (currentGroupId) {
                const group = await new GroupFinder(this.repository).execute(currentGroupId);
                const globalConfigId = group.toJson().data.configuration_id;
                const globalConfig = await this.#globalConfigFinder.getConfiguration(
                    globalConfigId,
                    'behaviors',
                    'admin',
                    'groups'
                );

                const schemaIdUpdate = globalConfig.groups_schema_id;
                if (schemaIdUpdate && schemaIdUpdate !== '') {
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

            await new GroupUpdater(
                this.repository,
                this.actionExecutionService,
                this.usageGuard,
                this.#scheduleGuard
            ).execute(data.value, id);
            return HttpResponse.ok({ event: this.event });
        } catch (error) {
            const response = objectIdentityErrorResponse(error, this.event);
            if (response) return response;
            Helper.logInfo(error);
            const activeUsersResponse = groupHasActiveUsersResponse(error, this.event);
            if (activeUsersResponse) return activeUsersResponse;
            const badRequestResponse = groupBadRequestErrorResponse(error, this.event);
            if (badRequestResponse) return badRequestResponse;
            const conflictResponse = scheduleLockConflictResponse(error, this.event);
            if (conflictResponse) return conflictResponse;
            if (error instanceof CustomError) {
                return HttpResponse.custom(error.message, error.statusCode, this.event);
            }
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
            const hasPermission = this.user.hasPermission('administrador', 'groups', 'GroupsDelete');
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
            const dtoDelete = {
                deleted_at: new Date().toISOString(),
                deleted_by: this.user.id.value,
            };
            await new GroupDeleter(
                this.repository,
                this.actionExecutionService,
                this.usageGuard,
                this.relationsCleaner
            ).execute(id, dtoDelete);
            return HttpResponse.ok({ event: this.event });
        } catch (error) {
            const response = objectIdentityErrorResponse(error, this.event);
            if (response) return response;
            Helper.logInfo(error);
            const activeUsersResponse = groupHasActiveUsersResponse(error, this.event);
            if (activeUsersResponse) return activeUsersResponse;
            if (error instanceof CustomError) {
                return HttpResponse.custom(error.message, error.statusCode, this.event);
            }
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
            const id = this.pathParameters().id;
            const hasAdminPermission = this.user.hasPermission('administrador', 'groups', 'GroupsRead');
            const isOwnGroup = this.user?.grupo_activo?.value && this.user.grupo_activo.value === id;
            if (!hasAdminPermission && !isOwnGroup) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to read this resource.',
                    event: this.event,
                });
            }

            if (!this.validateId(id)) {
                return HttpResponse.badRequest({
                    message: 'Invalid id',
                    event: this.event,
                });
            }
            const group = await new GroupDetailFinder(this.repository, this.#scheduleGuard).execute(id);
            return HttpResponse.ok({
                data: group.toJson(),
                event: this.event,
            });
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
            const hasPermission = this.user.hasPermission('administrador', 'groups', 'GroupsRead');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to read this resource.',
                    event: this.event,
                });
            }

            const payload = {
                filter: undefined,
                relationships: undefined,
                limit: 10,
                offset: 0,
                order: {
                    field: 'created_at',
                    direction: 'desc',
                },
            };

            const group = await new GroupSearcher(this.repository, this.#casesRepository).execute(payload);
            return HttpResponse.ok({ ...group.toJson(), event: this.event });
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
        Helper.logInfo('End actionSearch');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'groups', 'GroupsRead');
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
            const authorizedQuery = this.#authorizeSearch('group.search', data.value);
            const groups = await new GroupSearcher(this.repository, this.#casesRepository).execute(authorizedQuery);
            return HttpResponse.ok({ ...groups.toJson(), event: this.event });
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

const GROUP_BAD_REQUEST_CODES = new Set([
    GROUP_CREATE_USERS_NOT_FOUND,
    GROUP_SCHEDULE_UNAVAILABLE,
    RESOURCE_ALREADY_EXISTS,
]);

export const groupBadRequestErrorResponse = (error, event) => {
    if (!(error instanceof ValidationFailError) || !GROUP_BAD_REQUEST_CODES.has(error.publicErrorCode)) {
        return null;
    }
    return HttpResponse.badRequest({ errors: error, event });
};

export const scheduleLockConflictResponse = (error, event) => {
    if (!(error instanceof ScheduleLockConflict)) {
        return null;
    }
    return HttpResponse.conflict({ message: error.message, event, code: CONFLICT_ERROR });
};

function groupHasActiveUsersResponse(error, event) {
    if (!(error instanceof CustomError) || error.publicErrorCode !== GROUP_HAS_ACTIVE_USERS) {
        return null;
    }

    const fields = error.fields && typeof error.fields === 'object' ? error.fields : {};
    return new Response({
        message: error.message,
        statusCode: error.statusCode,
        event,
        publicErrorCode: GROUP_HAS_ACTIVE_USERS,
        publicData: {
            count: fields.count ?? 0,
            users: Array.isArray(fields.users) ? fields.users : [],
        },
        exposePublicErrorDetails: true,
    });
}
