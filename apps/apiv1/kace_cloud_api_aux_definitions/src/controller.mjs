import { schemaCreate, schemaUpdate } from './schemas.mjs';
import {
    objectIdentityErrorResponse,
    secureObjectCreatePayload,
} from '@kace/api-common/src/security/ObjectIdentityAuthorization.js';
import { BaseController, HttpResponse, SearchAuthorizationError, SearchAuthorizationService } from '@kace/api-common';
import { KnexAuxDefinitionsRepository } from '@kace/core/src/aux_definitions/infrastructure/persitance/KnexAuxDefinitionsRepository';
import { AuxDefinitionCreator } from '@kace/core/src/aux_definitions/application/create/AuxDefinitionCreator';
import { AuxDefinitionUpdater } from '@kace/core/src/aux_definitions/application/update/AuxDefinitionUpdater';
import { AuxDefinitionFinder } from '@kace/core/src/aux_definitions/application/find/AuxDefinitionFinder';
import { AuxDefinitionSearcher } from '@kace/core/src/aux_definitions/application/search/AuxDefinitionSearcher';
import { Helper } from '@kace/core/src/shared/index.js';
import { SearchSchema } from '@kace/api-common/src/validation/schemas/SearchSchema';
import { KnexSchemasRepository } from '@kace/core/src/schemas/infrastructure/persistence/KnexSchemasRepository';
import { KnexWSRestFlowRepository } from '@kace/core/src/ws-rest-flows/infrastructure/persistence/KnexWSRestFlowRepository';
import { SearchHistory } from '@kace/core/src/shared/domain/services/SearchHistory';

export class Controller extends BaseController {
    constructor(event, knexConfig) {
        super(event, knexConfig);

        // Main repo reads (find/search/findByName/findByTableName) go to the replica; pass CONFIG
        // objects (not this.database_connection, a built instance — §8.1 footgun). The DDL/high-
        // privileges repo below keeps its own writer-only connection (createTables must not read
        // from the replica).
        const { readerConfig } = this.event.tenantContext;
        this.repository = new KnexAuxDefinitionsRepository(knexConfig, readerConfig);
        this.schemasRepository = new KnexSchemasRepository(this.database_connection);
        this.WSRestFlowRepository = new KnexWSRestFlowRepository(this.database_connection);

        const { tenant } = this.event.tenantContext;
        this.definitionsHighPrivilegesRepository = new KnexAuxDefinitionsRepository({
            ...knexConfig,
            connection: {
                host: tenant.db_host.value,
                user: tenant.db_auxiliar_user.value,
                password: tenant.db_auxiliar_password.value,
                database: tenant.db_database.value,
                port: tenant.db_port.value,
            },
        });
        this.started_at = new Date();
    }

    async destroyDbConnection() {
        await this.repository.destroyConnection();
        await this.definitionsHighPrivilegesRepository.destroyConnection();
        await super.destroyDbConnection();
    }

    async actionCreate() {
        Helper.logInfo('Begin actionCreate');

        try {
            const hasPermission = this.user.hasPermission('administrador', 'aux-definitions', 'AuxDefinitionsCreate');
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
                endpoint: 'POST /aux-definitions',
                resourceType: 'aux_definitions',
                repository: this.repository,
            });

            const data = schemaCreate.validate(payload, { abortEarly: false });
            if (data.error) {
                return HttpResponse.validationsFail({
                    errors: data.error,
                    event: this.event,
                });
            }

            await new AuxDefinitionCreator(
                this.repository,
                this.schemasRepository,
                this.WSRestFlowRepository,
                this.definitionsHighPrivilegesRepository
            ).execute(data.value);
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
            const hasPermission = this.user.hasPermission('administrador', 'aux-definitions', 'AuxDefinitionsUpdate');
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

            const data = schemaUpdate.validate(payload, { abortEarly: false });

            if (data.error) {
                return HttpResponse.validationsFail({
                    errors: data.error,
                    event: this.event,
                });
            }

            await new AuxDefinitionUpdater(this.repository).execute(data.value, id);
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

    async actionRead() {
        Helper.logInfo('Begin actionRead');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'aux-definitions', 'AuxDefinitionsRead');
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
            const response = await new AuxDefinitionFinder(this.repository).execute(id);
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
            const dtoCriteria = {
                filter: undefined,
                relationship: undefined,
                limit: 0,
                offset: 0,
                order: {
                    field: 'created_at',
                    direction: 'desc',
                },
            };
            const response = await new AuxDefinitionSearcher(this.repository).execute(dtoCriteria);
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
            const payload = this.payload();
            const data = SearchSchema.validate(payload, { abortEarly: false });
            if (data.error) {
                return HttpResponse.validationsFail({
                    errors: data.error,
                    event: this.event,
                });
            }
            const authorizedQuery = this.#authorizeSearch('aux-definitions.search', data.value);
            const response = await new AuxDefinitionSearcher(this.repository).execute(authorizedQuery);
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
            const hasPermission = this.user.hasPermission('administrador', 'aux-definitions', 'AuxDefinitionsRead');
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
            Helper.logError(error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.event,
            });
        } finally {
            Helper.logInfo('End actionHistory');
        }
    }
}
