import { DISALLOWED_AUXILIARY_DELETE, schemaCreate, schemaUpdate } from './schemas.mjs';
import {
    applyServerManagedFields,
    objectIdentityErrorResponse,
    secureObjectCreatePayload,
} from '@kace/api-common/src/security/ObjectIdentityAuthorization.js';
import { BaseController, HttpResponse, SearchAuthorizationError, SearchAuthorizationService } from '@kace/api-common';
import { KnexAuxiliariesRepository } from '@kace/core/src/auxiliaries/infrastructure/persistence/KnexAuxiliariesRepository';
import { AuxiliaryCreator } from '@kace/core/src/auxiliaries/application/create/AuxiliaryCreator';
import { AuxiliaryUpdater } from '@kace/core/src/auxiliaries/application/update/AuxiliaryUpdater';
import { AuxiliaryFinder } from '@kace/core/src/auxiliaries/application/find/AuxiliaryFinder';
import { AuxiliaryDeleter } from '@kace/core/src/auxiliaries/application/delete/AuxiliaryDeleter';
import { AuxiliaryBulkDeleter } from '@kace/core/src/auxiliaries/application/delete/AuxiliaryBulkDeleter';
import { AuxiliarySearcher } from '@kace/core/src/auxiliaries/application/search/AuxiliarySearcher';
import { SearchSchema } from '@kace/api-common/src/validation/schemas/SearchSchema';
import { SearchHistory } from '@kace/core/src/shared/domain/services/SearchHistory';
import { Helper, ValidationFailError } from '@kace/core/src/shared/index.js';
import SchemaBuilder from '@kace/schemabuilder/src/SchemaBuilder.js';
import {
    SchemaConversionsApplier,
    TEXT_SOURCE_ADOPTABLE_TYPES,
} from '@kace/core/src/shared/domain/services/SchemaConversionsApplier.js';
import { AuxDefinitionTableNameFinder } from '@kace/core/src/aux_definitions/domain/AuxDefinitionTableNameFinder';
import { KnexAuxDefinitionsRepository } from '@kace/core/src/aux_definitions/infrastructure/persitance/KnexAuxDefinitionsRepository';
import { SchemaRules } from '@kace/core/src/schemas/application/rules/SchemaRules';
import { KnexSchemasRepository } from '@kace/core/src/schemas/infrastructure/persistence/KnexSchemasRepository';
import { KnexBoardsRepository } from '@kace/core/src/boards/infrastructure/persistence/KnexBoardsRepository';
import { BoardPermissionChecker } from '@kace/core/src/boards/application/BoardPermissionChecker.js';

export class Controller extends BaseController {
    /**
     * is initialized in the constructor
     * @type {string}
     */
    #currentEntity;

    /**
     * is initialized in the constructor
     * @type {KnexAuxDefinitionsRepository}
     */
    #auxDefinitionsRepository;

    /**
     * is initialized in the constructor
     * @type {KnexSchemasRepository}
     */
    #schemasRepository; //

    /**
     * is initialized in the constructor
     * @type {AuxDefinitionTableNameFinder}
     */
    #auxDefinitionTableNameFinder;

    /**
     * is initialized in the constructor
     * @type {Date}
     */
    #started_at;

    /**
     * is initialized in the constructor
     * @type {KnexAuxiliariesRepository}
     */
    #repository;

    /**
     * is initialized in the constructor
     * @type {SchemaRules}
     */
    #schemaRules;

    #boardsRepository;

    #boardPermissionChecker;

    constructor(event, knexConfig) {
        super(event, knexConfig);
        this.#started_at = new Date();
        this.#currentEntity = `aux_${this.pathParameters().entity}`.replace(/-/g, '_');
        this.#repository = new KnexAuxiliariesRepository(this.database_connection, this.#currentEntity);
        this.#auxDefinitionsRepository = new KnexAuxDefinitionsRepository(this.#repository.connection);
        this.#auxDefinitionTableNameFinder = new AuxDefinitionTableNameFinder(this.#auxDefinitionsRepository);
        this.#schemasRepository = new KnexSchemasRepository(this.#repository.connection);
        this.#schemaRules = new SchemaRules(this.#schemasRepository);
        this.#boardsRepository = new KnexBoardsRepository(this.database_connection);
        this.#boardPermissionChecker = new BoardPermissionChecker(this.#boardsRepository);
    }

    async actionCreate() {
        Helper.logInfo('Begin actionCreate');
        try {
            const boardId = this.pathParameters()?.board_id;
            const role = this.pathParameters()?.role;
            let hasPermission;
            if (boardId && (role === 'agente' || role === 'administrador')) {
                hasPermission = await this.#boardPermissionChecker.execute(
                    this.user,
                    boardId,
                    'can_create_record',
                    'BoardsCreateRegister',
                    role
                );
                if (!hasPermission) {
                    return HttpResponse.forbidden({
                        message: 'You do not have permission to create this resource.',
                        event: this.event,
                    });
                }
            }

            hasPermission = this.user.hasAuxiliaryPermission(this.#currentEntity, 'Create');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to create this resource.',
                    event: this.event,
                });
            }

            const payload = await secureObjectCreatePayload({
                payload: this.payload(),
                userId: this.user.id.value,
                now: this.#started_at,
                actorId: this.user.id.value,
                tenantId: this.tenant?.id?.value,
                endpoint: 'POST /auxiliaries',
                resourceType: 'auxiliaries',
                repository: this.#repository,
            });

            const data = schemaCreate.validate(payload, { abortEarly: false });
            if (data.error) {
                return HttpResponse.validationsFail({
                    errors: data.error,
                    event: this.event,
                });
            }

            const auxDefinition = await this.#auxDefinitionTableNameFinder.execute(this.#currentEntity);

            const schema = await this.#schemaRules.execute(auxDefinition.schema_id.value);
            const dataStructure = schema.toJson().data.data_structure;

            const joiBuilderValidation = SchemaBuilder.build(dataStructure);
            const valueData = joiBuilderValidation.validate(data.value.data, { abortEarly: false, allowUnknown: true });

            if (valueData.error) {
                return HttpResponse.validationsFail({
                    errors: valueData.error,
                    event: this.event,
                });
            }

            // Se adopta la conversión de Joi sólo en las hojas de tipo adoptable cuyo valor
            // convertido vuelve a validar: el documento convertido completo reescribiría las
            // fechas en una forma que ya no pasa su propio esquema. Los `default` del esquema sí
            // se materializan, porque este create valida contra la estructura completa y un campo
            // no diligenciado debe quedar con el valor que el administrador configuró.
            data.value.data = SchemaConversionsApplier.execute({
                target: data.value.data,
                converted: valueData.value,
                dataStructure,
                adoptableTypes: TEXT_SOURCE_ADOPTABLE_TYPES,
                materializeDefaults: true,
            });

            await new AuxiliaryCreator(this.#repository).execute(data.value, this.#currentEntity, dataStructure);
            return HttpResponse.created({ event: this.event });
        } catch (error) {
            const response = objectIdentityErrorResponse(error, this.event);
            if (response) return response;
            if (error instanceof ValidationFailError) {
                return HttpResponse.validationsFail({ message: error.message, event: this.event });
            }
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
            const boardId = this.pathParameters()?.board_id;
            const role = this.pathParameters()?.role;
            let hasPermission;
            if (boardId && (role === 'agente' || role === 'administrador')) {
                hasPermission = await this.#boardPermissionChecker.execute(
                    this.user,
                    boardId,
                    'can_edit_record',
                    'BoardsUpdateRegister',
                    role
                );
                if (!hasPermission) {
                    return HttpResponse.forbidden({
                        message: 'You do not have permission to update this resource.',
                        event: this.event,
                    });
                }
            }

            hasPermission = this.user.hasAuxiliaryPermission(this.#currentEntity, 'Update');
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
                now: this.#started_at,
            });

            const data = schemaUpdate.validate(payload, { abortEarly: false });
            if (data.error) {
                return HttpResponse.validationsFail({
                    errors: data.error,
                    event: this.event,
                });
            }

            const auxDefinition = await this.#auxDefinitionTableNameFinder.execute(this.#currentEntity);

            const schema = await this.#schemaRules.execute(auxDefinition.schema_id.value);
            const dataStructure = schema.toJson().data.data_structure;

            const partialKeys = Object.keys(data.value.data);
            const partialDataStructure = SchemaBuilder.buildPartial(dataStructure, partialKeys);

            const joiBuilderValidation = SchemaBuilder.build(partialDataStructure);
            const valueData = joiBuilderValidation.validate(data.value.data, { abortEarly: false, allowUnknown: true });

            if (valueData.error) {
                return HttpResponse.validationsFail({
                    errors: valueData.error,
                    event: this.event,
                });
            }

            // A diferencia del create, aquí NO se materializan defaults: rellenarían claves que el
            // registro nunca tuvo, en una petición que sólo parchea las que envió.
            data.value.data = SchemaConversionsApplier.execute({
                target: data.value.data,
                converted: valueData.value,
                dataStructure: partialDataStructure,
                adoptableTypes: TEXT_SOURCE_ADOPTABLE_TYPES,
            });

            const shouldOverrideArray = this.event.queryStringParameters?.override?.toLowerCase() ?? 'false';
            await new AuxiliaryUpdater(this.#repository).execute(
                id,
                data.value,
                this.#currentEntity,
                shouldOverrideArray === 'true',
                dataStructure
            );
            return HttpResponse.ok({ event: this.event });
        } catch (error) {
            const response = objectIdentityErrorResponse(error, this.event);
            if (response) return response;
            if (error instanceof ValidationFailError) {
                return HttpResponse.validationsFail({ message: error.message, event: this.event });
            }
            Helper.logInfo(error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.event,
            });
        } finally {
            Helper.logInfo('End actionUpdate');
        }
    }

    async actionRead() {
        Helper.logInfo('Begin actionRead');
        try {
            const boardId = this.pathParameters()?.board_id;
            const role = this.pathParameters()?.role;
            let hasPermission;
            if (boardId && (role === 'agente' || role === 'administrador')) {
                hasPermission = await this.#boardPermissionChecker.execute(
                    this.user,
                    boardId,
                    'can_view_record',
                    'BoardsReadRegister',
                    role
                );
                if (!hasPermission) {
                    return HttpResponse.forbidden({
                        message: 'You do not have permission to read this resource.',
                        event: this.event,
                    });
                }
            }

            hasPermission = this.user.hasAuxiliaryPermission(this.#currentEntity, 'Read');
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

            const response = await new AuxiliaryFinder(this.#repository).execute(id, this.#currentEntity);
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

    async actionDelete() {
        Helper.logInfo('Begin actionDelete');
        try {
            const entity = this.pathParameters().entity;
            if (DISALLOWED_AUXILIARY_DELETE.includes(entity)) {
                return HttpResponse.badRequest({
                    message: `No se pudieron eliminar ${1} registro(s) porque están vinculados a entidades principales`,
                    event: this.event,
                });
            }

            if (!this.user.hasAuxiliaryPermission(this.#currentEntity, 'Delete')) {
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

            await new AuxiliaryDeleter(this.#repository).execute(id, dto, this.#currentEntity);
            return HttpResponse.ok({ event: this.event });
        } catch (error) {
            const response = objectIdentityErrorResponse(error, this.event);
            if (response) return response;
            Helper.logInfo(error);
            if (error instanceof ValidationFailError) {
                return HttpResponse.badRequest({
                    message: error.message,
                    event: this.event,
                });
            }
            return HttpResponse.internalServerError({
                errors: error,
                event: this.event,
            });
        } finally {
            Helper.logInfo('End actionDelete');
        }
    }

    async actionBulkDelete() {
        Helper.logInfo('Begin actionBulkDelete');
        try {
            const entity = this.pathParameters().entity;
            if (DISALLOWED_AUXILIARY_DELETE.includes(entity)) {
                return HttpResponse.badRequest({
                    message: `No se pudieron eliminar ${this.payload()?.ids?.length || 0} registro(s) porque están vinculados a entidades principales`,
                    event: this.event,
                });
            }

            if (!this.user.hasAuxiliaryPermission(this.#currentEntity, 'Delete')) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to delete this resource.',
                    event: this.event,
                });
            }

            const payload = this.payload();
            if (!payload.ids || !Array.isArray(payload.ids) || payload.ids.length === 0) {
                return HttpResponse.badRequest({
                    message: 'Invalid ids: must be a non-empty array',
                    event: this.event,
                });
            }

            for (const id of payload.ids) {
                if (!this.validateId(id)) {
                    return HttpResponse.badRequest({
                        message: `Invalid id: ${id}`,
                        event: this.event,
                    });
                }
            }

            const dto = {
                deleted_at: new Date().toISOString(),
                deleted_by: this.user.id.value,
            };

            const result = await new AuxiliaryBulkDeleter(this.#repository).execute(
                payload.ids,
                dto,
                this.#currentEntity
            );

            if (result?.blocked && result.blocked.length > 0) {
                return HttpResponse.badRequest({
                    message: `No se pudieron eliminar ${result.blocked.length} registro(s) porque están vinculados a entidades principales`,
                    errors: result,
                    event: this.event,
                });
            }

            return HttpResponse.ok({ data: result, message: 'Success', event: this.event });
        } catch (error) {
            const response = objectIdentityErrorResponse(error, this.event);
            if (response) return response;
            Helper.logInfo(error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.event,
            });
        } finally {
            Helper.logInfo('End actionBulkDelete');
        }
    }

    async actionIndex() {
        Helper.logInfo('Begin actionIndex');
        try {
            if (!this.user.hasAuxiliaryPermission(this.#currentEntity, 'Read')) {
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

            const response = await new AuxiliarySearcher(this.#repository).execute(dtoCriteria, this.#currentEntity);
            return HttpResponse.ok({ ...response.toJson(), event: this.event });
        } catch (error) {
            const response = objectIdentityErrorResponse(error, this.event);
            if (response) return response;
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

            const authorizedQuery = this.#authorizeSearch('auxiliaries.search', data.value);
            const response = await new AuxiliarySearcher(this.#repository).execute(
                authorizedQuery,
                this.#currentEntity
            );
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
        } finally {
            Helper.logInfo('End actionSearch');
        }
    }

    async actionHistory() {
        Helper.logInfo('Begin actionHistory');
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
            const id = this.pathParameters().id;

            const response = await new SearchHistory(this.#repository).execute(id, data.value);
            return HttpResponse.ok({ ...response, event: this.event });
        } catch (error) {
            const response = objectIdentityErrorResponse(error, this.event);
            if (response) return response;
            Helper.logError(error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.event,
            });
        } finally {
            Helper.logInfo('End actionHistory');
        }
    }

    async run() {
        const { httpMethod, pathParameters, path } = this.event;
        const entity = pathParameters?.entity;
        const id = pathParameters?.id;

        if (!entity) {
            return HttpResponse.badRequest({
                message: 'Invalid or missing entity',
                event: this.event,
            });
        }

        try {
            this.user = await this.getLoggedInUser();
        } catch (error) {
            const response = objectIdentityErrorResponse(error, this.event);
            if (response) return response;
            Helper.logInfo('Error getLoggedInUser', error);
            return HttpResponse.badRequest({
                message: error.message,
                event: this.event,
            });
        }

        try {
            if (httpMethod === 'POST' && !id && path.endsWith(`/${entity}`)) {
                return await this.actionCreate();
            }

            if (httpMethod === 'POST' && id && path.endsWith(`/${entity}/${id}`)) {
                return await this.actionUpdate();
            }

            if (httpMethod === 'GET' && id && path.endsWith(`/${entity}/${id}`)) {
                return await this.actionRead();
            }

            if (httpMethod === 'GET' && id && path.endsWith(`/${entity}/${id}/delete`)) {
                return await this.actionDelete();
            }

            if (httpMethod === 'POST' && id && path.endsWith(`/${entity}/${id}/history`)) {
                return await this.actionHistory();
            }

            if (httpMethod === 'GET' && !id && path.endsWith(`/${entity}`)) {
                return await this.actionIndex();
            }

            if (httpMethod === 'POST' && !id && path.endsWith(`/${entity}/search`)) {
                return await this.actionSearch();
            }

            if (httpMethod === 'POST' && !id && path.endsWith(`/${entity}/bulk-delete`)) {
                return await this.actionBulkDelete();
            }

            return HttpResponse.notFound({
                message: 'Route not found',
                event: this.event,
            });
        } catch (error) {
            const response = objectIdentityErrorResponse(error, this.event);
            if (response) return response;
            Helper.logError(error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.event,
            });
        } finally {
            await this.#repository.destroyConnection();
        }
    }
}
