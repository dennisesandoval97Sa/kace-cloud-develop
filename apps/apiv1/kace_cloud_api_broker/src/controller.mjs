import { BaseController, HttpResponse, SearchAuthorizationError, SearchAuthorizationService } from '@kace/api-common';
import {
    applyServerManagedFields,
    objectIdentityErrorResponse,
    resolveCanonicalCreateIdentity,
} from '@kace/api-common/src/security/ObjectIdentityAuthorization.js';
import { BrokerAdapterCreateSchema, BrokerAdapterUpdateSchema } from './BrokerSchema.mjs';
import { SearchSchema } from '@kace/api-common/src/validation/schemas/SearchSchema';
import { Helper } from '@kace/core/src/shared/index.js';
import { BROKER_ADAPTER_VHOST_REQUIRED } from '@kace/error-codes';

import { AdapterCreator } from '@kace/core/src/rabbitmq/application/create/AdapterCreator.js';
import { AdapterFinder } from '@kace/core/src/rabbitmq/application/find/AdapterFinder.js';
import { AdapterUpdater } from '@kace/core/src/rabbitmq/application/update/AdapterUpdater.js';
import { AdapterDeleter } from '@kace/core/src/rabbitmq/application/delete/AdapterDeleter.js';
import { AdapterSearcher } from '@kace/core/src/rabbitmq/application/search/AdapterSearcher.js';
import { KnexAdapterSettingsRepository } from '@kace/core/src/rabbitmq/infrastructure/persistence/KnexAdapterSettingsRepository.js';
import { AdapterResponse } from '@kace/core/src/rabbitmq/application/AdapterResponse.js';

export class Controller extends BaseController {
    constructor(event, knexConfig) {
        super(event, knexConfig);
        this.knexConfig = knexConfig;
        this.started_at = new Date();

        // Pass CONFIG objects (not this.database_connection, a built Knex instance —
        // that would collapse the reader onto the writer, §8.1 footgun).
        const { readerConfig } = this.event.tenantContext;
        this.readerConfig = readerConfig;
        this.repository = new KnexAdapterSettingsRepository(this.knexConfig, readerConfig);
    }

    #validationErrorCode(error) {
        const vhostFailed = error?.details?.some((detail) => detail.path?.[0] === 'vhost');
        return vhostFailed ? BROKER_ADAPTER_VHOST_REQUIRED : undefined;
    }

    async actionCreate() {
        Helper.logInfo('Begin Adapter actionCreate');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'broker_adapters', 'BrokerAdaptersCreate');
            if (!hasPermission)
                return HttpResponse.forbidden({
                    message: 'You do not have permission to create this resource.',
                    event: this.event,
                });

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
                endpoint: 'POST /broker-adapters',
                resourceType: 'broker_adapters',
            });
            payload = identity.payload;

            const { value, error } = BrokerAdapterCreateSchema.validate(payload, { abortEarly: false });
            if (error)
                return HttpResponse.validationsFail({
                    errors: error,
                    event: this.event,
                    code: this.#validationErrorCode(error),
                });

            const cryptoParams = {
                secret_key: this.event.tenantContext.tenant.secret_key.value,
                secret_iv: this.event.tenantContext.tenant.secret_iv.value,
                encryption_method: this.event.tenantContext.tenant.encryption_method.value,
            };

            await new AdapterCreator(
                new KnexAdapterSettingsRepository(this.knexConfig, this.readerConfig),
                cryptoParams
            ).execute(value);
            return HttpResponse.created({ data: { id: value.id }, event: this.event });
        } catch (error) {
            const response = objectIdentityErrorResponse(error, this.event);
            if (response) return response;
            Helper.logInfo(error);
            return HttpResponse.internalServerError({ errors: error, event: this.event });
        } finally {
            Helper.logInfo('End Adapter actionCreate');
        }
    }

    async actionUpdate() {
        Helper.logInfo('Begin Adapter actionUpdate');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'broker_adapters', 'BrokerAdaptersUpdate');
            if (!hasPermission)
                return HttpResponse.forbidden({
                    message: 'You do not have permission to update this resource.',
                    event: this.event,
                });

            const id = this.pathParameters().id;
            if (!this.validateId(id)) return HttpResponse.badRequest({ message: 'Invalid id', event: this.event });

            const payload = applyServerManagedFields(this.payload(), {
                operation: 'update',
                userId: this.user.id.value,
                now: new Date(),
            });

            const { value, error } = BrokerAdapterUpdateSchema.validate(payload, { abortEarly: false });
            if (error)
                return HttpResponse.validationsFail({
                    errors: error,
                    event: this.event,
                    code: this.#validationErrorCode(error),
                });

            const cryptoParams = {
                secret_key: this.event.tenantContext.tenant.secret_key.value,
                secret_iv: this.event.tenantContext.tenant.secret_iv.value,
                encryption_method: this.event.tenantContext.tenant.encryption_method.value,
            };

            await new AdapterUpdater(
                new KnexAdapterSettingsRepository(this.knexConfig, this.readerConfig),
                cryptoParams
            ).execute(id, value);
            return HttpResponse.ok({ event: this.event });
        } catch (error) {
            const response = objectIdentityErrorResponse(error, this.event);
            if (response) return response;
            Helper.logInfo(error);
            return HttpResponse.internalServerError({ errors: error, event: this.event });
        } finally {
            Helper.logInfo('End Adapter actionUpdate');
        }
    }

    async actionDelete() {
        Helper.logInfo('Begin Adapter actionDelete');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'broker_adapters', 'BrokerAdaptersDelete');
            if (!hasPermission)
                return HttpResponse.forbidden({
                    message: 'You do not have permission to delete this resource.',
                    event: this.event,
                });

            const id = this.pathParameters().id;
            if (!this.validateId(id)) return HttpResponse.badRequest({ message: 'Invalid id', event: this.event });

            const dto = { deleted_at: new Date().toISOString(), deleted_by: this.user.id.value };
            await new AdapterDeleter(new KnexAdapterSettingsRepository(this.knexConfig, this.readerConfig)).execute(
                id,
                dto
            );
            return HttpResponse.ok({ event: this.event });
        } catch (error) {
            Helper.logInfo(error);
            return HttpResponse.internalServerError({ errors: error, event: this.event });
        } finally {
            Helper.logInfo('End Adapter actionDelete');
        }
    }

    async actionRead() {
        Helper.logInfo('Begin Adapter actionRead');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'broker_adapters', 'BrokerAdaptersRead');
            if (!hasPermission)
                return HttpResponse.forbidden({
                    message: 'You do not have permission to read this resource.',
                    event: this.event,
                });

            const id = this.pathParameters().id;
            if (!this.validateId(id)) return HttpResponse.badRequest({ message: 'Invalid id', event: this.event });

            const response = await new AdapterFinder(
                new KnexAdapterSettingsRepository(this.knexConfig, this.readerConfig)
            ).execute(id);
            const payload = response && response.toJson ? response.toJson() : new AdapterResponse(response).toJson();
            return HttpResponse.ok({ ...payload, event: this.event });
        } catch (error) {
            Helper.logInfo(error);
            return HttpResponse.internalServerError({ errors: error, event: this.event });
        } finally {
            Helper.logInfo('End Adapter actionRead');
        }
    }

    async actionIndex() {
        Helper.logInfo('Begin Adapter actionIndex');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'broker_adapters', 'BrokerAdaptersRead');
            if (!hasPermission)
                return HttpResponse.forbidden({
                    message: 'You do not have permission to read this resource.',
                    event: this.event,
                });

            const dtoCriteria = {
                filter: undefined,
                relationship: undefined,
                limit: 10,
                offset: 0,
                order: { field: 'created_at', direction: 'desc' },
            };
            const response = await new AdapterSearcher(
                new KnexAdapterSettingsRepository(this.knexConfig, this.readerConfig)
            ).execute(dtoCriteria);
            const payload =
                response && response.toJson
                    ? response.toJson()
                    : { data: (response || []).map((r) => new AdapterResponse(r).toJson()) };
            return HttpResponse.ok({ ...payload, event: this.event });
        } catch (error) {
            Helper.logInfo(error);
            return HttpResponse.internalServerError({ errors: error, event: this.event });
        } finally {
            Helper.logInfo('End Adapter actionIndex');
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
        Helper.logInfo('Begin Adapter actionSearch');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'broker_adapters', 'BrokerAdaptersRead');
            if (!hasPermission)
                return HttpResponse.forbidden({
                    message: 'You do not have permission to read this resource.',
                    event: this.event,
                });

            const { value, error } = SearchSchema.validate(this.payload(), { abortEarly: false });
            if (error) return HttpResponse.validationsFail({ errors: error, event: this.event });

            const authorizedQuery = this.#authorizeSearch('broker.search', value);
            const response = await new AdapterSearcher(
                new KnexAdapterSettingsRepository(this.knexConfig, this.readerConfig)
            ).execute(authorizedQuery);
            const payload =
                response && response.toJson
                    ? response.toJson()
                    : { data: (response || []).map((r) => new AdapterResponse(r).toJson()) };
            return HttpResponse.ok({ ...payload, event: this.event });
        } catch (error) {
            if (error instanceof SearchAuthorizationError) {
                return HttpResponse.forbidden({
                    message: error.message,
                    event: this.event,
                });
            }

            Helper.logInfo(error);
            return HttpResponse.internalServerError({ errors: error, event: this.event });
        } finally {
            Helper.logInfo('End Adapter actionSearch');
        }
    }

    async destroyDbConnection() {
        await this.repository.destroyConnection();
        await super.destroyDbConnection();
    }
}
