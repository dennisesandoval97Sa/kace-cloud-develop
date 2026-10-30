import {
    BaseController,
    HttpResponse,
    SearchSchema,
    SearchAuthorizationError,
    SearchAuthorizationService,
} from '@kace/api-common';
import {
    createRepositoryIdCollisionFinder,
    objectIdentityErrorResponse,
    secureObjectCreatePayload,
} from '@kace/api-common/src/security/ObjectIdentityAuthorization.js';
import { EmailCreator } from '@kace/core/src/emails/application/create/EmailCreator';
import { EmailDeleter } from '@kace/core/src/emails/application/delete/EmailDeleter';
import { EmailDetailFinder } from '@kace/core/src/emails/application/find/EmailDetailFinder';
import { EmailBodyContentReader } from '@kace/core/src/emails/application/body/EmailBodyContentReader.js';
import { EmailSearch } from '@kace/core/src/emails/application/search/EmailSearcher';
import { EmailUpdater } from '@kace/core/src/emails/application/update/EmailUpdater';
import { KnexEmailsRepository } from '@kace/core/src/emails/infrastructure/persistence/KnexEmailsRepository';
import { Helper, ValidationFailError } from '@kace/core/src/shared';
import { emailSchema } from './schemas.mjs';
import { KnexEmailsBodyRepository } from '@kace/core/src/emails/infrastructure/persistence/KnexEmailsBodyRepository';
import { KnexEmailAttachmentRepository } from '@kace/core/src/emails/infrastructure/persistence/KnexEmailAttachmentRepository';
import { KnexInteractionRepository } from '@kace/core/src/interactions/infrastructure/persistence/KnexInteractionRepository';
import { KnexAssociateInteractionToCasoRepo } from '@kace/core/src/interactions/infrastructure/persistence/KnexAssociateInteractionToCasoRepo';
import { KnexCaseRepository } from '@kace/core/src/cases/infrastructure/persistence/KnexCaseRepository';
import { KnexChannelHubAccountRepository } from '@kace/core/src/channel-hub-accounts/infrastructure/persistence/KnexChannelHubAccountRepository';
import { KnexWorkspacesRepository } from '@kace/core/src/workspaces/infrastructure/persistence/KnexWorkspacesRepository';
import { HttpAttachmentDownloader } from '@kace/core/src/emails/infrastructure/persistence/HttpAttachmentDownloader';
import { S3AttachmentStorage } from '@kace/core/src/emails/infrastructure/persistence/S3AttachmentStorage';
import { S3EmailBodyStorage } from '@kace/core/src/emails/infrastructure/persistence/S3EmailBodyStorage.js';
import { S3FileScanner } from '@kace/core/src/s3-files/application/scan/S3FileScanner';

export class Controller extends BaseController {
    constructor(event, knexConfig) {
        super(event, knexConfig);
        // Reads (find/search/count on emails, emails_body, emails_attachments) go to the replica;
        // pass CONFIG objects with readerConfig. Direct writes are guarded by markWrite() in the repos.
        const { readerConfig } = this.event.tenantContext;
        this.repository = new KnexEmailsRepository(knexConfig, readerConfig);
        this.emailBodyRepo = new KnexEmailsBodyRepository(knexConfig, readerConfig);
        this.emailAttachmentRepo = new KnexEmailAttachmentRepository(knexConfig, readerConfig);
        this.interactionRepo = new KnexInteractionRepository(knexConfig);
        this.interactionCasoRepo = new KnexAssociateInteractionToCasoRepo(knexConfig);
        this.caseRepo = new KnexCaseRepository(knexConfig);
        this.channelHubAccountRepo = new KnexChannelHubAccountRepository(knexConfig);
        this.workspaceRepo = new KnexWorkspacesRepository(knexConfig);
        this.attachmentDownloader = new HttpAttachmentDownloader();
        this.attachmentStorage = new S3AttachmentStorage();
        this.emailBodyStorage = new S3EmailBodyStorage();
        this.s3FileScanner = new S3FileScanner();
        this.started_at = new Date();
    }

    async destroyDbConnection() {
        await super.destroyDbConnection();
        await this.repository.destroyConnection();
        await this.emailBodyRepo.destroyConnection();
        await this.emailAttachmentRepo.destroyConnection();
    }

    async actionCreate() {
        Helper.logInfo('Begin actionCreate');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'emails', 'EmailsCreate');

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
                endpoint: 'POST /emails',
                resourceType: 'emails',
                repository: this.repository,
                // Import clients upload body objects under email-bodies/{emailId}/
                // before calling POST /emails, so keep caller UUIDs after a collision check.
                allowLegacyId: true,
                collisionFinders: [createRepositoryIdCollisionFinder(this.repository, 'emails')],
            });

            const data = emailSchema.validate(payload, { abortEarly: false });
            if (data.error) {
                return HttpResponse.validationsFail({
                    errors: data.error,
                    event: this.event,
                });
            }

            await new EmailCreator(
                this.repository,
                this.emailBodyRepo,
                this.emailAttachmentRepo,
                this.channelHubAccountRepo,
                this.attachmentDownloader,
                this.attachmentStorage,
                this.s3FileScanner,
                this.emailBodyStorage
            ).execute(data.value);

            return HttpResponse.created({ data: { id: data.value.id }, event: this.event });
        } catch (error) {
            const response = objectIdentityErrorResponse(error, this.event);
            if (response) return response;
            if (error instanceof ValidationFailError) {
                return HttpResponse.validationsFail({ message: error.message, event: this.event });
            }
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
            const hasPermission = this.user.hasPermission('administrador', 'emails', 'EmailsUpdate');
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
            payload.updated_at = this.started_at;
            payload.updated_by = this.user.id.value;
            const data = emailSchema.validate(payload, { abortEarly: false });

            if (data.error) {
                return HttpResponse.validationsFail({
                    errors: data.error,
                    event: this.event,
                });
            }

            await new EmailUpdater(this.repository, this.emailBodyRepo, this.emailAttachmentRepo).execute(
                data.value,
                id
            );

            return HttpResponse.ok({ event: this.event });
        } catch (error) {
            const response = objectIdentityErrorResponse(error, this.event);
            if (response) return response;
            Helper.logError(error);
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
            const hasPermission = this.user.hasPermission('administrador', 'emails', 'EmailsDelete');
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

            await new EmailDeleter(this.repository, this.emailBodyRepo, this.emailAttachmentRepo).execute(id, dto);

            return HttpResponse.ok({ event: this.event });
        } catch (error) {
            const response = objectIdentityErrorResponse(error, this.event);
            if (response) return response;
            Helper.logError(error);
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
            const hasPermission = this.user.hasPermission('administrador', 'emails', 'EmailsRead');
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
            const data = await new EmailDetailFinder(
                this.repository,
                this.emailBodyRepo,
                this.emailAttachmentRepo,
                this.interactionRepo,
                this.interactionCasoRepo,
                this.caseRepo,
                this.channelHubAccountRepo,
                this.workspaceRepo
            ).execute(id);
            return HttpResponse.ok({ data, event: this.event });
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

    async actionReadBody() {
        Helper.logInfo('Begin actionReadBody');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'emails', 'EmailsRead');
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

            const part = this.event.queryStringParameters?.part;
            const data = await new EmailBodyContentReader({
                emailRepository: this.repository,
                emailBodyRepository: this.emailBodyRepo,
                bodyStorage: this.emailBodyStorage,
            }).execute({ emailId: id, part });

            return HttpResponse.ok({ data, event: this.event });
        } catch (error) {
            Helper.logInfo(error);
            if (Number.isInteger(error?.statusCode) && error.statusCode >= 400 && error.statusCode < 500) {
                return HttpResponse.custom(error.message, error.statusCode, this.event);
            }

            return HttpResponse.internalServerError({
                errors: error,
                event: this.event,
            });
        } finally {
            Helper.logInfo('End actionReadBody');
        }
    }

    async actionIndex() {
        Helper.logInfo('Begin actionIndex');

        const hasPermission = this.user.hasPermission('administrador', 'emails', 'EmailsRead');
        if (!hasPermission) {
            return HttpResponse.forbidden({
                message: 'You do not have permission to read this resource.',
                event: this.event,
            });
        }
        try {
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
            const response = await new EmailSearch(this.repository).execute(dtoCriteria);

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
            const hasPermission = this.user.hasPermission('administrador', 'emails', 'EmailsRead');
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

            const authorizedQuery = this.#authorizeSearch('emails.search', data.value);
            const response = await new EmailSearch(this.repository).execute(authorizedQuery);

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
}
