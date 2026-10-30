import { BaseController, HttpResponse, SearchAuthorizationError, SearchAuthorizationService } from '@kace/api-common';
import {
    applyServerManagedFields,
    objectIdentityErrorResponse,
    resolveCanonicalCreateIdentity,
} from '@kace/api-common/src/security/ObjectIdentityAuthorization.js';
import { BrokerMapperCreateSchema, BrokerMapperUpdateSchema } from './BrokerMapperSchema.mjs';
import { SearchSchema } from '@kace/api-common/src/validation/schemas/SearchSchema';
import { Helper } from '@kace/core/src/shared/index.js';
import { BROKER_MAPPER_QUEUE_REQUIRED, BROKER_MAPPER_VALIDATION_FAILED } from '@kace/error-codes';

import { MapperCreator } from '@kace/core/src/rabbitmq/application/create/MapperCreator.js';
import { MapperFinder } from '@kace/core/src/rabbitmq/application/find/MapperFinder.js';
import { MapperUpdater } from '@kace/core/src/rabbitmq/application/update/MapperUpdater.js';
import { MapperDeleter } from '@kace/core/src/rabbitmq/application/delete/MapperDeleter.js';
import { MapperSearcher } from '@kace/core/src/rabbitmq/application/search/MapperSearcher.js';
import { KnexMapperRepository } from '@kace/core/src/rabbitmq/infrastructure/persistence/KnexMapperRepository.js';
import { MapperResponse } from '@kace/core/src/rabbitmq/application/MapperResponse.js';

export class Controller extends BaseController {
    constructor(event, knexConfig) {
        super(event, knexConfig);
        this.knexConfig = knexConfig;
        this.started_at = new Date();

        /*
         * Pass CONFIG objects (not this.database_connection, a built Knex instance —
         * that would collapse the reader onto the writer, §8.1 footgun).
         */
        const { readerConfig } = this.event.tenantContext;
        this.readerConfig = readerConfig;
        this.repository = new KnexMapperRepository(this.knexConfig, readerConfig);
    }

    #validationErrorCode(error) {
        const requiredRuleFields = new Set(['target_entity', 'target_field', 'source_field']);
        const mapperRequiredFieldFailed = error?.details?.some((detail) => {
            const path = detail.path ?? [];
            if (path.length === 1) return path[0] === 'name' || path[0] === 'rest_flow_id';

            return (
                path.length === 3 && path[0] === 'rules' && Number.isInteger(path[1]) && requiredRuleFields.has(path[2])
            );
        });

        if (mapperRequiredFieldFailed) return BROKER_MAPPER_VALIDATION_FAILED;

        const queueFailed = error?.details?.some((detail) => detail.path?.[0] === 'queue');
        return queueFailed ? BROKER_MAPPER_QUEUE_REQUIRED : undefined;
    }

    async actionCreate() {
        Helper.logInfo('Begin Mapper actionCreate');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'broker_mappers', 'BrokerMappersCreate');
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
                endpoint: 'POST /broker-mappers',
                resourceType: 'broker_mappers',
            });
            payload = identity.payload;
            if (Array.isArray(payload.rules)) {
                payload.rules = payload.rules.map(({ id, mapper_id, ...rule }) => rule);
            }

            const { value, error } = BrokerMapperCreateSchema.validate(payload, {
                abortEarly: false,
            });
            if (error) {
                return HttpResponse.validationsFail({
                    errors: error,
                    event: this.event,
                    code: this.#validationErrorCode(error),
                });
            }

            await new MapperCreator(new KnexMapperRepository(this.knexConfig, this.readerConfig)).execute(value);
            return HttpResponse.created({
                data: { id: value.id },
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
            Helper.logInfo('End Mapper actionCreate');
        }
    }

    async actionUpdate() {
        Helper.logInfo('Begin Mapper actionUpdate');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'broker_mappers', 'BrokerMappersUpdate');
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
                now: new Date(),
            });

            const { value, error } = BrokerMapperUpdateSchema.validate(payload, {
                abortEarly: false,
            });
            if (error) {
                return HttpResponse.validationsFail({
                    errors: error,
                    event: this.event,
                    code: this.#validationErrorCode(error),
                });
            }

            await new MapperUpdater(new KnexMapperRepository(this.knexConfig, this.readerConfig)).execute(id, value);
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
            Helper.logInfo('End Mapper actionUpdate');
        }
    }

    async actionDelete() {
        Helper.logInfo('Begin Mapper actionDelete');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'broker_mappers', 'BrokerMappersDelete');
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
            await new MapperDeleter(new KnexMapperRepository(this.knexConfig, this.readerConfig)).execute(id, dto);
            return HttpResponse.ok({ event: this.event });
        } catch (error) {
            Helper.logInfo(error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.event,
            });
        } finally {
            Helper.logInfo('End Mapper actionDelete');
        }
    }

    async actionRead() {
        Helper.logInfo('Begin Mapper actionRead');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'broker_mappers', 'BrokerMappersRead');
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

            const response = await new MapperFinder(
                new KnexMapperRepository(this.knexConfig, this.readerConfig)
            ).execute(id);
            if (!response) {
                return HttpResponse.notFound({ event: this.event });
            }

            let payload;
            if (response.toJson) {
                payload = response.toJson();
            } else {
                payload = new MapperResponse({
                    id: response.id,
                    name: response.name,
                    rest_flow_id: response.rest_flow_id,
                    rules: response.rules,
                }).toJson();
            }

            return HttpResponse.ok({ ...payload, event: this.event });
        } catch (error) {
            Helper.logInfo(error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.event,
            });
        } finally {
            Helper.logInfo('End Mapper actionRead');
        }
    }

    async actionIndex() {
        Helper.logInfo('Begin Mapper actionIndex');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'broker_mappers', 'BrokerMappersRead');
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
                order: { field: 'created_at', direction: 'desc' },
            };
            const response = await new MapperSearcher(
                new KnexMapperRepository(this.knexConfig, this.readerConfig)
            ).execute(dtoCriteria);
            let payload;
            if (response?.toJson) {
                payload = response.toJson();
            } else {
                payload = {
                    data: (response || []).map((r) => new MapperResponse(r).toJson()),
                };
            }
            return HttpResponse.ok({ ...payload, event: this.event });
        } catch (error) {
            Helper.logInfo(error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.event,
            });
        } finally {
            Helper.logInfo('End Mapper actionIndex');
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
        Helper.logInfo('Begin Mapper actionSearch');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'broker_mappers', 'BrokerMappersRead');
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

            const authorizedQuery = this.#authorizeSearch('broker-mapper.search', value);
            const response = await new MapperSearcher(
                new KnexMapperRepository(this.knexConfig, this.readerConfig)
            ).execute(authorizedQuery);
            let payload;
            if (response?.toJson) {
                payload = response.toJson();
            } else {
                payload = {
                    data: (response || []).map((r) => new MapperResponse(r).toJson()),
                };
            }
            return HttpResponse.ok({ ...payload, event: this.event });
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
            Helper.logInfo('End Mapper actionSearch');
        }
    }

    async destroyDbConnection() {
        await this.repository.destroyConnection();
        await super.destroyDbConnection();
    }
}
