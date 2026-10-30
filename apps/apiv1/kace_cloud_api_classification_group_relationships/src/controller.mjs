import { createSchema } from './schemas.mjs';
import {
    BaseController,
    HttpResponse,
    SearchSchema,
    SearchAuthorizationError,
    SearchAuthorizationService,
} from '@kace/api-common';
import {
    ClassificationGroupCreator,
    ClassificationGroupFinder,
    ClassificationGroupSearcher,
    ClassificationGroupDeleter,
    IdsValidator,
    KnexClassificationGroupRelationshipRepository,
} from '@kace/core/src/classification-group-relationships';
import { KnexClassificationRepository } from '@kace/core/src/classifications';
import { KnexGroupsRepository } from '@kace/core/src/grupos';
import { KnexOneScriptRepository } from '@kace/core/src/one-script';
import { Helper } from '@kace/core/src/shared/index.js';

export class Controller extends BaseController {
    constructor(event, knexConfig) {
        super(event, knexConfig);
        const { readerConfig } = this.event.tenantContext;
        this.repository = new KnexClassificationGroupRelationshipRepository(knexConfig, readerConfig);
        this.started_at = new Date();
        this.repositoryClassification = new KnexClassificationRepository(knexConfig, readerConfig);
        this.repositoryGroups = new KnexGroupsRepository(this.database_connection);
        this.repositoryOneScript = new KnexOneScriptRepository(this.database_connection);
        this.idsValidationService = new IdsValidator(
            this.repositoryClassification,
            this.repositoryGroups,
            this.repositoryOneScript
        );
    }

    async destroyDbConnection() {
        await this.repository.destroyConnection();
        await this.repositoryClassification.destroyConnection();
        await super.destroyDbConnection();
    }

    async actionCreate() {
        Helper.logInfo('Begin actionCreate');
        try {
            const hasPermission = this.user.hasPermission(
                'administrador',
                'classification-group-relationships',
                'ClassificationGroupsRelationshipCreate'
            );
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to create this resource.',
                    event: this.event,
                });
            }
            const payload = this.payload();

            const data = createSchema.validate(payload, { abortEarly: false });
            if (data.error) {
                return HttpResponse.validationsFail({
                    errors: data.error,
                    event: this.event,
                });
            }

            await new ClassificationGroupCreator(this.repository, this.idsValidationService).execute(data.value);

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

    async actionIndex() {
        Helper.logInfo('Begin actionIndex');
        try {
            const hasPermission = this.user.hasPermission(
                'administrador',
                'classification-group-relationships',
                'ClassificationGroupsRelationshipRead'
            );
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
                order: null,
            };

            const response = await new ClassificationGroupSearcher(this.repository).execute(dtoCriteria);
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
        try {
            const hasPermission = this.user.hasPermission(
                'administrador',
                'classification-group-relationships',
                'ClassificationGroupsRelationshipRead'
            );
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

            const authorizedQuery = this.#authorizeSearch('classification-group-relationships.search', data.value);
            const response = await new ClassificationGroupSearcher(this.repository).execute(authorizedQuery);
            return HttpResponse.ok({ ...response.toJson(), event: this.event });
        } catch (error) {
            if (error instanceof SearchAuthorizationError) {
                return HttpResponse.forbidden({
                    message: error.message,
                    event: this.event,
                });
            }

            Helper.logError(error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.event,
            });
        }
    }

    async actionRead() {
        Helper.logInfo('Begin actionRead');

        try {
            const hasPermission = this.user.hasPermission(
                'administrador',
                'classification-group-relationships',
                'ClassificationGroupsRelationshipRead'
            );
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to delete this resource.',
                    event: this.event,
                });
            }

            const classificationId = this.pathParameters().classificationId;
            const groupId = this.pathParameters().groupId;

            if (!this.validateId(classificationId) || !this.validateId(groupId)) {
                return HttpResponse.badRequest({
                    message: 'Invalid id',
                    event: this.event,
                });
            }

            const response = await new ClassificationGroupFinder(this.repository).execute(classificationId, groupId);
            return HttpResponse.ok({ ...response.toJson(), event: this.event });
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

    async actionDelete() {
        Helper.logInfo('Begin actionDelete');
        try {
            const hasPermission = this.user.hasPermission(
                'administrador',
                'classification-group-relationships',
                'ClassificationGroupsRelationshipDelete'
            );
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to update this resource.',
                    event: this.event,
                });
            }

            const classificationId = this.pathParameters().classificationId;
            const groupId = this.pathParameters().groupId;

            if (!this.validateId(classificationId) || !this.validateId(groupId)) {
                return HttpResponse.badRequest({
                    message: 'Invalid id',
                    event: this.event,
                });
            }

            await new ClassificationGroupDeleter(this.repository).execute(classificationId, groupId);
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
}
