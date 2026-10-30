import { HttpResponse, SearchAuthorizationService } from '@kace/api-common';
import { secureObjectCreatePayload } from '@kace/api-common/src/security/ObjectIdentityAuthorization.js';
import { SearchSchema } from '@kace/api-common/src/validation/schemas/SearchSchema';
import { FolioConfigurationCreator } from '@kace/core/src/folio-configurations/application/create/FolioConfigurationCreator.js';
import { FolioConfigurationDeleter } from '@kace/core/src/folio-configurations/application/delete/FolioConfigurationDeleter.js';
import { FolioConfigurationFinder } from '@kace/core/src/folio-configurations/application/find/FolioConfigurationFinder.js';
import { FolioConfigurationSearcher } from '@kace/core/src/folio-configurations/application/search/FolioConfigurationSearcher.js';
import { FolioConfigurationUpdater } from '@kace/core/src/folio-configurations/application/update/FolioConfigurationUpdater.js';
import { FolioConfigurationResponse } from '@kace/core/src/folio-configurations/application/FolioConfigurationResponse.js';
import { Helper } from '@kace/core/src/shared/infrastructure/utils/Helper.js';
import { FolioBaseController, MODULE } from './folioBaseController.mjs';
import { schemaCreate, schemaUpdate } from './schemas.mjs';

export class Controller extends FolioBaseController {
    async actionCreate() {
        Helper.logInfo('Begin actionCreate');
        try {
            if (!this.user.hasPermission('administrador', MODULE, 'FolioConfigurationsCreate')) {
                return this.forbidden('create');
            }

            const payload = await secureObjectCreatePayload({
                payload: this.payload(),
                userId: this.user.id.value,
                now: this.started_at,
                actorId: this.user.id.value,
                tenantId: this.tenant?.id?.value,
                endpoint: 'POST /folio-configurations',
                resourceType: 'folio_configurations',
                repository: this.repository,
            });

            const { value, error } = schemaCreate.validate(payload, { abortEarly: false });
            if (error) {
                return HttpResponse.validationsFail({ errors: error, event: this.event });
            }

            await new FolioConfigurationCreator(this.repository).execute(value);

            return HttpResponse.created({ event: this.event });
        } catch (error) {
            return this.fail(error);
        } finally {
            Helper.logInfo('End actionCreate');
        }
    }

    async actionUpdate() {
        Helper.logInfo('Begin actionUpdate');
        try {
            if (!this.user.hasPermission('administrador', MODULE, 'FolioConfigurationsUpdate')) {
                return this.forbidden('update');
            }

            const id = this.pathParameters().id;
            if (!this.validateId(id)) {
                return HttpResponse.badRequest({ message: 'Invalid id', event: this.event });
            }

            const payload = this.payload();
            payload.updated_at = new Date();
            payload.updated_by = this.user.id.value;

            const { value, error } = schemaUpdate.validate(payload, { abortEarly: false });
            if (error) {
                return HttpResponse.validationsFail({ errors: error, event: this.event });
            }

            await new FolioConfigurationUpdater(this.repository, this.sequenceRepository).execute(id, value);

            return HttpResponse.ok({ event: this.event });
        } catch (error) {
            return this.fail(error);
        } finally {
            Helper.logInfo('End actionUpdate');
        }
    }

    async actionDelete() {
        Helper.logInfo('Begin actionDelete');
        try {
            if (!this.user.hasPermission('administrador', MODULE, 'FolioConfigurationsDelete')) {
                return this.forbidden('delete');
            }

            const id = this.pathParameters().id;
            if (!this.validateId(id)) {
                return HttpResponse.badRequest({ message: 'Invalid id', event: this.event });
            }

            await new FolioConfigurationDeleter(this.repository).execute(id, {
                deleted_at: new Date().toISOString(),
                deleted_by: this.user.id.value,
            });

            return HttpResponse.ok({ event: this.event });
        } catch (error) {
            return this.fail(error);
        } finally {
            Helper.logInfo('End actionDelete');
        }
    }

    async actionRead() {
        Helper.logInfo('Begin actionRead');
        try {
            if (!this.user.hasPermission('administrador', MODULE, 'FolioConfigurationsRead')) {
                return this.forbidden('read');
            }

            const id = this.pathParameters().id;
            if (!this.validateId(id)) {
                return HttpResponse.badRequest({ message: 'Invalid id', event: this.event });
            }

            const configuration = await new FolioConfigurationFinder(this.repository).execute(id);

            return HttpResponse.ok({
                ...new FolioConfigurationResponse(configuration).toJson(),
                event: this.event,
            });
        } catch (error) {
            return this.fail(error);
        } finally {
            Helper.logInfo('End actionRead');
        }
    }

    async actionIndex() {
        Helper.logInfo('Begin actionIndex');
        try {
            if (!this.user.hasPermission('administrador', MODULE, 'FolioConfigurationsRead')) {
                return this.forbidden('read');
            }

            const response = await new FolioConfigurationSearcher(this.repository).execute({
                filter: undefined,
                relationship: undefined,
                limit: 0,
                offset: 0,
                order: { field: 'created_at', direction: 'desc' },
            });

            return HttpResponse.ok({ ...response.toJson(), event: this.event });
        } catch (error) {
            return this.fail(error);
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
            if (!this.user.hasPermission('administrador', MODULE, 'FolioConfigurationsRead')) {
                return this.forbidden('read');
            }

            const { value, error } = SearchSchema.validate(this.payload(), { abortEarly: false });
            if (error) {
                return HttpResponse.validationsFail({ errors: error, event: this.event });
            }

            const authorizedQuery = this.#authorizeSearch('folio-configurations.search', value);
            const response = await new FolioConfigurationSearcher(this.repository).execute(authorizedQuery);

            return HttpResponse.ok({ ...response.toJson(), event: this.event });
        } catch (error) {
            return this.fail(error);
        } finally {
            Helper.logInfo('End actionSearch');
        }
    }
}
