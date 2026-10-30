import { createSchema, updateSchema } from './schemas.mjs';
import {
    objectIdentityErrorResponse,
    secureObjectCreatePayload,
} from '@kace/api-common/src/security/ObjectIdentityAuthorization.js';
import { BaseController, HttpResponse, SearchAuthorizationError, SearchAuthorizationService } from '@kace/api-common';
import { KnexAuxClientsRepository } from '@kace/core/src/aux_clientes/infrastructure/persitance/KnexAuxClientsRepository';
import { AuxClientsCreator } from '@kace/core/src/aux_clientes/application/create/AuxClientsCreator';
import { AuxClientsUpdater } from '@kace/core/src/aux_clientes/application/update/AuxClientsUpdater';
import { AuxClientsFinder } from '@kace/core/src/aux_clientes/application/find/AuxClientsFinder';
import { CustomError } from '@kace/core/src/shared/errors/CustomError';
import { Helper } from '@kace/core/src/shared/index.js';
import { SearchHistory } from '@kace/core/src/shared/domain/services/SearchHistory';
import { SearchSchema } from '@kace/api-common/src/validation/schemas/SearchSchema';
import { AuxClientsSearcher } from '@kace/core/src/aux_clientes/application/search/AuxClientsSearcher';

export class Controller extends BaseController {
    constructor(event, knexConfig) {
        super(event, knexConfig);
        this.repository = new KnexAuxClientsRepository(this.database_connection);
        this.started_at = new Date();
    }

    async actionCreate() {
        Helper.logInfo('Begin actionCreate');
        try {
            const hasPermission = this.user.hasAuxiliaryPermission('clients', 'Create');
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
                endpoint: 'POST /aux-clients',
                resourceType: 'aux_clients',
                repository: this.repository,
            });

            const data = createSchema.validate(payload, { abortEarly: false });
            if (data.error) {
                return HttpResponse.validationsFail({
                    errors: data.error,
                    event: this.event,
                });
            }

            await this.#ensureClientRelationship(data.value.cliente_id);

            await new AuxClientsCreator(this.repository).execute(data.value);
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
            const hasPermission = this.user.hasAuxiliaryPermission('clients', 'Update');
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

            await new AuxClientsUpdater(this.repository).execute(data.value, id);
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
            const hasPermission = this.user.hasAuxiliaryPermission('clients', 'Read');
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

            const response = await new AuxClientsFinder(this.repository).execute(id);
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
        const data = SearchSchema.validate(this.payload(), { abortEarly: false });
        if (data.error) {
            return HttpResponse.validationsFail({
                errors: data.error,
                event: this.event,
            });
        }

        try {
            const authorizedQuery = this.#authorizeSearch('aux-clients.search', data.value);
            const response = await new AuxClientsSearcher(this.repository).execute(authorizedQuery);

            return HttpResponse.ok({
                ...response.toJson(),
                event: this.event,
            });
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
        }
    }

    async actionHistory() {
        Helper.logInfo('Begin actionHistory');
        try {
            const hasPermission = this.user.hasAuxiliaryPermission('clients', 'Read');
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
            Helper.logInfo(error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.event,
            });
        } finally {
            Helper.logInfo('End actionHistory');
        }
    }

    async #ensureClientRelationship(clientId) {
        const client = await this.repository
            .connection(this.repository.qualifiedName('clients'))
            .select('id')
            .where({ id: clientId })
            .first();

        if (!client) {
            throw new CustomError(`Client with ID ${clientId} not found`, 404);
        }
    }
}
