import { SearchSchema } from '@kace/api-common/src/validation/schemas/SearchSchema';
import { HelpsAttachmentsCreateSchema } from './HelpsAttachmentsSchema.mjs';
import {
    HelpsAttachmentsCreator,
    HelpsAttachmentsDeleter,
    HelpsAttachmentsSearcher,
    HelpsAttachmentsFinder,
    KnexHelpsAttachmentsRepository,
} from '@kace/core/src/helps_attachments';
import { HttpResponse, BaseController, SearchAuthorizationError, SearchAuthorizationService } from '@kace/api-common';
import {
    objectIdentityErrorResponse,
    secureObjectCreatePayload,
} from '@kace/api-common/src/security/ObjectIdentityAuthorization.js';
import { Helper } from '@kace/core/src/shared/index.js';

export class Controller extends BaseController {
    constructor(event, knexConfig) {
        super(event, knexConfig);

        /*
         * Pass CONFIG objects (not this.database_connection, a built Knex instance —
         * that would collapse the reader onto the writer, §8.1 footgun).
         */
        const { readerConfig } = this.event.tenantContext;
        this.repository = new KnexHelpsAttachmentsRepository(knexConfig, readerConfig);
        this.started_at = new Date();
    }

    async destroyDbConnection() {
        await this.repository.destroyConnection();
        await super.destroyDbConnection();
    }

    async actionIndex() {
        Helper.logInfo('Begin actionIndex');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'help-attachments', 'HelpAttachmentsRead');
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
            const response = await new HelpsAttachmentsSearcher(this.repository).execute(dtoCriteria);
            return HttpResponse.ok({ ...response.toJson(), event: this.event });
        } catch (error) {
            Helper.logError(error);
            return HttpResponse.custom(error.message, error.statusCode, this.event).toJson();
        } finally {
            Helper.logInfo('End actionIndex');
        }
    }

    async actionRead() {
        Helper.logInfo('Begin actionRead');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'help-attachments', 'HelpAttachmentsRead');
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

            const response = await new HelpsAttachmentsFinder(this.repository).execute(id);
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

    async actionCreate() {
        Helper.logInfo('Begin actionCreate');
        let payload = this.payload();
        try {
            const hasPermission = this.user.hasPermission('administrador', 'help-attachments', 'HelpAttachmentsCreate');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to create this resource.',
                    event: this.event,
                });
            }

            const globalConfig = (await this.getGlobalConfig()).toJson().settings.behaviors.application.agente
                ?.files_extensions?.allowed_file_extensions;
            payload = await secureObjectCreatePayload({
                payload,
                userId: this.user.id.value,
                now: this.started_at,
                actorId: this.user.id.value,
                tenantId: this.tenant?.id?.value,
                endpoint: 'POST /helps-attachments',
                resourceType: 'helps_attachments',
                repository: this.repository,
            });

            const data = HelpsAttachmentsCreateSchema.validate(payload, {
                abortEarly: false,
            });
            if (data.error) {
                return HttpResponse.validationsFail({
                    errors: data.error,
                    event: this.event,
                });
            }

            const dto = { ...data.value };
            dto.allowed_file_extensions = globalConfig;

            const savedAttachment = await new HelpsAttachmentsCreator(this.repository).execute(dto);
            return HttpResponse.created({ data: { id: savedAttachment.id.value }, event: this.event });
        } catch (error) {
            const response = objectIdentityErrorResponse(error, this.event);
            if (response) return response;
            Helper.logInfo(`Failed helps Attachment creation: ${payload.id}`, error);
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
            const hasPermission = this.user.hasPermission('administrador', 'help-attachments', 'HelpAttachmentsDelete');
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
                deleted_at: new Date(),
                deleted_by: this.user.id.value,
            };
            await new HelpsAttachmentsDeleter(this.repository).execute(id, dto);
            return HttpResponse.ok({ event: this.event });
        } catch (error) {
            Helper.logError(error);
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
        Helper.logInfo('End actionSearch');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'help-attachments', 'HelpAttachmentsRead');
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
            const authorizedQuery = this.#authorizeSearch('helps-attachments.search', data.value);
            const response = await new HelpsAttachmentsSearcher(this.repository).execute(authorizedQuery);
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
        } finally {
            Helper.logInfo('End actionSearch');
        }
    }
}
