import { SecretsVaultCreateSchema, SecretsVaultUpdateSchema } from './SecretsVaultSchema.mjs';
import { SearchSchema } from '@kace/api-common/src/validation/schemas/SearchSchema';
import {
    SecretCreator,
    SecretDeleter,
    SecretFinder,
    SecretSearcher,
    SecretUpdater,
} from '@kace/core/src/secrets-vault';
import { HttpResponse, BaseController, SearchAuthorizationError, SearchAuthorizationService } from '@kace/api-common';
import {
    objectIdentityErrorResponse,
    secureObjectCreatePayload,
} from '@kace/api-common/src/security/ObjectIdentityAuthorization.js';
import { KnexSecretsVaultRepository } from '@kace/core/src/secrets-vault/infrastructure/persistence/KnexSecretsVaultRepository';
import { Helper } from '@kace/core/src/shared/index.js';

export class Controller extends BaseController {
    #cryptoParams; /** Is initialized in the constructor */
    constructor(event, knexConfig) {
        super(event, knexConfig);
        this.repository = new KnexSecretsVaultRepository(this.database_connection);
        this.#cryptoParams = {
            secret_key: this.tenant.secret_key.value,
            secret_iv: this.tenant.secret_iv.value,
            encryption_method: this.tenant.encryption_method.value,
        };
        this.started_at = new Date();
    }

    async actionCreate() {
        Helper.logInfo('Begin actionCreate');

        try {
            const hasPermission = this.user.hasPermission('administrador', 'secrets-vault', 'SecretsVaultCreate');
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
                endpoint: 'POST /secrets-vault',
                resourceType: 'secrets_vault',
                repository: this.repository,
            });
            const data = SecretsVaultCreateSchema.validate(payload, {
                abortEarly: false,
            });

            if (data.error) {
                return HttpResponse.validationsFail({
                    errors: data.error,
                    event: this.event,
                });
            }

            await new SecretCreator(this.repository, this.#cryptoParams).execute(data.value);
            return HttpResponse.created({ event: this.event });
        } catch (error) {
            const response = objectIdentityErrorResponse(error, this.event);
            if (response) return response;
            Helper.logError(error);
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
            const hasPermission = this.user.hasPermission('administrador', 'secrets-vault', 'SecretsVaultUpdate');
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
            payload.updated_by = this.user.id.value;
            payload.updated_at = new Date();

            const { value, error } = SecretsVaultUpdateSchema.validate(payload, {
                abortEarly: false,
            });
            if (error) {
                return HttpResponse.validationsFail({
                    errors: error,
                    event: this.event,
                });
            }

            await new SecretUpdater(this.repository, this.#cryptoParams).execute(value, id);
            return HttpResponse.ok({ event: this.event });
        } catch (error) {
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
            const hasPermission = this.user.hasPermission('administrador', 'secrets-vault', 'SecretsVaultDelete');
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
                deleted_by: this.user.id.value,
                deleted_at: new Date(),
            };
            await new SecretDeleter(this.repository).execute(id, dtoDelete);
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
            const hasPermission = this.user.hasPermission('administrador', 'secrets-vault', 'SecretsVaultsRead');
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
            const secretsVault = await new SecretFinder(this.repository).execute(id);
            return HttpResponse.ok({ ...secretsVault.toJson(), event: this.event });
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
            const hasPermission = this.user.hasPermission('administrador', 'secrets-vault', 'SecretsVaultsRead');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to read this resource.',
                    event: this.event,
                });
            }

            const payload = {
                filter: undefined,
                relationship: undefined,
                limit: 10,
                offset: 0,
                order: {
                    field: 'created_at',
                    direction: 'desc',
                },
            };
            const secret = await new SecretSearcher(this.repository).execute(payload);
            return HttpResponse.ok({ ...secret.toJson(), event: this.event });
        } catch (error) {
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
            const hasPermission = this.user.hasPermission('administrador', 'secrets-vault', 'SecretsVaultsRead');
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

            const authorizedQuery = this.#authorizeSearch('secrets-vault.search', data.value);
            const secret = await new SecretSearcher(this.repository).execute(authorizedQuery);
            return HttpResponse.ok({ ...secret.toJson(), event: this.event });
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
            Helper.logInfo('End actionSearch');
        }
    }
}
