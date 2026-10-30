import { BaseController, HttpResponse, SearchAuthorizationError, SearchAuthorizationService } from '@kace/api-common';
import { batchAddClassificationTemplateSchema, batchRemoveClassificationTemplateSchema } from './schemas.mjs';
import { SearchSchema } from '@kace/api-common/src/validation/schemas/SearchSchema';
import {
    ClassificationTemplateBatchCreator,
    ClassificationTemplateBatchDeleter,
    ClassificationTemplateSearcher,
    IdsValidator,
    KnexClassificationTemplateRelationsRepository,
} from '@kace/core/src/classification-template-relations';
import { KnexClassificationRepository } from '@kace/core/src/classifications';
import { KnexTemplatesRepository } from '@kace/core/src/templates';
import { Helper } from '@kace/core/src/shared/index.js';

export class Controller extends BaseController {
    constructor(event, knexConfig) {
        super(event, knexConfig);
        const { readerConfig } = this.event.tenantContext;
        this.repository = new KnexClassificationTemplateRelationsRepository(knexConfig, readerConfig);
        this.classificationRepository = new KnexClassificationRepository(knexConfig, readerConfig);
        this.templateRepository = new KnexTemplatesRepository(this.database_connection);
        this.idsValidationService = new IdsValidator(this.classificationRepository, this.templateRepository);
        this.started_at = new Date();
    }

    async destroyDbConnection() {
        await this.repository.destroyConnection();
        await this.classificationRepository.destroyConnection();
        await super.destroyDbConnection();
    }

    async actionIndex() {
        Helper.logInfo('Begin actionIndex');
        try {
            const hasPermission = this.user.hasPermission(
                'administrador',
                'classification-template-relations',
                'ClassificationTemplateRelationshipRead'
            );
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to create this resource.',
                    event: this.event,
                });
            }

            const dtoCriteria = {
                filter: undefined,
                relationship: undefined,
                limit: 10,
                offset: 0,
                order: undefined,
            };

            const response = await new ClassificationTemplateSearcher(this.repository).execute(dtoCriteria);

            return HttpResponse.ok({ ...response.toJson(), event: this.event });
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

    async actionCreate() {
        Helper.logInfo('Begin actionCreate');
        try {
            const hasPermission = this.user.hasPermission(
                'administrador',
                'classification-template-relations',
                'ClassificationTemplateRelationshipCreate'
            );
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to update this resource.',
                    event: this.event,
                });
            }

            const { value, error } = batchAddClassificationTemplateSchema.validate(this.payload(), {
                abortEarly: false,
            });
            if (error) {
                return HttpResponse.validationsFail({
                    errors: error,
                    event: this.event,
                });
            }

            await new ClassificationTemplateBatchCreator(this.repository, this.idsValidationService).execute(value);

            return HttpResponse.created({ event: this.event });
        } catch (error) {
            Helper.logInfo(error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.event,
            });
        } finally {
            Helper.logInfo('End actionCreate');
        }
    }

    async actionDelete() {
        Helper.logInfo('Begin actionDelete');
        try {
            const hasPermission = this.user.hasPermission(
                'administrador',
                'classification-template-relations',
                'ClassificationTemplateRelationshipDelete'
            );
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to delete this resource.',
                    event: this.event,
                });
            }

            const { value, error } = batchRemoveClassificationTemplateSchema.validate(this.payload(), {
                abortEarly: false,
            });
            if (error) {
                return HttpResponse.validationsFail({
                    errors: error,
                    event: this.event,
                });
            }

            await new ClassificationTemplateBatchDeleter(this.repository).execute(value);

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
            const hasPermission = this.user.hasPermission(
                'administrador',
                'classification-template-relations',
                'ClassificationTemplateRelationshipRead'
            );
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

            const authorizedQuery = this.#authorizeSearch('classification-template-relations.search', value);
            const response = await new ClassificationTemplateSearcher(this.repository).execute(authorizedQuery);

            return HttpResponse.ok({ ...response.toJson(), event: this.event });
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

    /**
     * @returns {Promise<Response>}
     */
    async run() {
        this.user = await this.getLoggedInUser();
        return this.#newActions();
    }

    async runCognitoAuth() {
        return this.#newActions();
    }

    /**
     * @returns {Promise<Response>}
     */
    async #newActions() {
        const resource = this.resource();
        const method = this.httpMethod();

        const resourceActions = {
            GET: {
                '/': this.actionIndex,
                '/search': this.actionSearch,
            },
            POST: {
                '/': this.actionCreate,
                '/delete': this.actionDelete,
                '/search': this.actionSearch,
            },
        };

        const action = resourceActions[method]?.[resource];
        if (action) {
            return action.call(this);
        }

        if (method === 'GET' || method === 'POST') {
            return HttpResponse.notFound({
                message: `Resource not found: ${resource}`,
                event: this.event,
            });
        }

        return HttpResponse.methodNotAllowed({ event: this.event });
    }

    resource() {
        return this.event.resource;
    }
}
