import { ClassificationCreateSchema, ClassificationUpdateSchema } from './ClassificactionsSchema.mjs';
import {
    objectIdentityErrorResponse,
    secureObjectCreatePayload,
} from '@kace/api-common/src/security/ObjectIdentityAuthorization.js';
import { SearchSchema } from '@kace/api-common/src/validation/schemas/SearchSchema';
import {
    ClassificationCreator,
    ClassificationDeleter,
    ClassificationFinder,
    ClassificationUpdater,
    ClassificationSearcher,
    KnexClassificationRepository,
} from '@kace/core/src/classifications';
import { CustomError } from '@kace/core/src/shared/errors/CustomError.js';
import { ValidationFailError } from '@kace/core/src/shared/errors/ValidationFailError.js';
import { HttpResponse, BaseController, SearchAuthorizationError, SearchAuthorizationService } from '@kace/api-common';
import { Helper } from '@kace/core/src/shared/index.js';
import { SearchHistory } from '@kace/core/src/shared/domain/services/SearchHistory';
import {
    IdsValidator,
    KnexClassificationTemplateRelationsRepository,
} from '@kace/core/src/classification-template-relations';
import { KnexTemplatesRepository } from '@kace/core/src/templates';

export class Controller extends BaseController {
    constructor(event, knexConfig) {
        super(event, knexConfig);
        const { readerConfig } = this.event.tenantContext;
        this.repository = new KnexClassificationRepository(knexConfig, readerConfig);
        this.classificationTemplateRepository = new KnexClassificationTemplateRelationsRepository(
            this.repository.connection
        );
        this.templateRepository = new KnexTemplatesRepository(this.repository.connection);
        this.templateIdsValidator = new IdsValidator(this.repository, this.templateRepository);
        this.started_at = new Date();
    }

    async destroyDbConnection() {
        await this.repository.destroyConnection();
        await super.destroyDbConnection();
    }

    async actionCreate() {
        Helper.logInfo('Begin actionCreate');

        try {
            const hasPermission = this.user.hasPermission('administrador', 'classifications', 'ClassificationCreate');
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
                endpoint: 'POST /classifications',
                resourceType: 'classifications',
                repository: this.repository,
            });

            const data = ClassificationCreateSchema.validate(payload, {
                abortEarly: false,
            });

            if (data.error) {
                return HttpResponse.validationsFail({
                    errors: data.error,
                    event: this.event,
                });
            }

            await this.#ensureFlowRelationships(data.value.flujo_id);
            await this.#ensureAnsRelationships(data.value.ans_id);

            if (data.value.default_group_id) {
                await this.#ensureGroupRelationships(data.value.default_group_id);
            }
            if (data.value.folio_config_id) {
                await this.#ensureFolioConfigRelationship(data.value.folio_config_id);
            }

            const createDto = {
                ...data.value,
                template_ids: [...new Set(data.value.template_ids.filter(Boolean))],
            };
            await new ClassificationCreator(
                this.repository,
                this.classificationTemplateRepository,
                this.templateIdsValidator
            ).execute(createDto);

            return HttpResponse.created({ data: { id: createDto.id }, event: this.event });
        } catch (error) {
            const response = objectIdentityErrorResponse(error, this.event);
            if (response) return response;
            if (error instanceof ValidationFailError) {
                return HttpResponse.badRequest({ errors: error, event: this.event });
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
            const hasPermission = this.user.hasPermission('administrador', 'classifications', 'ClassificationUpdate');
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

            const data = ClassificationUpdateSchema.validate(payload, {
                abortEarly: false,
            });
            if (data.error) {
                return HttpResponse.validationsFail({
                    errors: data.error,
                    event: this.event,
                });
            }

            if (data.value.flujo_id) {
                await this.#ensureFlowRelationships(data.value.flujo_id);
            }
            if (data.value.ans_id) {
                await this.#ensureAnsRelationships(data.value.ans_id);
            }
            if (data.value.default_group_id) {
                await this.#ensureGroupRelationships(data.value.default_group_id);
            }
            if (data.value.folio_config_id) {
                await this.#ensureFolioConfigRelationship(data.value.folio_config_id);
            }

            await new ClassificationUpdater(this.repository).execute(id, data.value);

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
            const hasPermission = this.user.hasPermission('administrador', 'classifications', 'ClassificationDelete');
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

            await new ClassificationDeleter(this.repository).execute(id, dto);
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
            Helper.logInfo('End actionDelete');
        }
    }

    async actionRead() {
        Helper.logInfo('Begin actionRead');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'classifications', 'ClassificationRead');
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

            const response = await new ClassificationFinder(this.repository).execute(id);

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
            const hasPermission = this.user.hasPermission('administrador', 'classifications', 'ClassificationRead');
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
            const response = await new ClassificationSearcher(this.repository).execute(dtoCriteria);
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
        Helper.logInfo('End actionSearch');

        try {
            const hasPermission = this.user.hasPermission('administrador', 'classifications', 'ClassificationRead');
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

            const authorizedQuery = this.#authorizeSearch('classifications.search', data.value);
            const response = await new ClassificationSearcher(this.repository).execute(authorizedQuery);
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
            const hasPermission = this.user.hasPermission('administrador', 'classifications', 'ClassificationRead');
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

    async #ensureFlowRelationships(flowId) {
        const client = await this.repository
            .connection(this.repository.qualifiedName('flujos'))
            .select('id')
            .where({ id: flowId })
            .first();

        if (!client) {
            throw new CustomError(`Flow with id ${flowId} does not exist.`, 404);
        }
    }

    async #ensureAnsRelationships(ansId) {
        const ans = await this.repository
            .connection(this.repository.qualifiedName('ans'))
            .select('id')
            .where({ id: ansId })
            .first();

        if (!ans) {
            throw new CustomError(`ANS with id ${ansId} does not exist.`, 404);
        }
    }

    async #ensureGroupRelationships(groupId) {
        const grupos = await this.repository
            .connection(this.repository.qualifiedName('grupos'))
            .select('id')
            .where({ id: groupId })
            .first();

        if (!grupos) {
            throw new CustomError(`Group with id ${groupId} does not exist.`, 404);
        }
    }

    /**
     * Without this check a classification can point at a configuration that was deleted (or
     * never existed) and its cases would quietly get no folio.
     */
    async #ensureFolioConfigRelationship(folioConfigId) {
        const configuration = await this.repository
            .connection(this.repository.qualifiedName('folio_configurations'))
            .select('id')
            .where({ id: folioConfigId })
            .whereNull('deleted_at')
            .first();

        if (!configuration) {
            throw new CustomError(`Folio configuration with id ${folioConfigId} does not exist.`, 404);
        }
    }
}
