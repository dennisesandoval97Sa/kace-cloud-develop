import { BaseController, HttpResponse } from '@kace/api-common';
import { EmailZipGenerator } from '@kace/core/src/emails/application/download/EmailZipGenerator.js';
import { KnexEmailsRepository } from '@kace/core/src/emails/infrastructure/persistence/KnexEmailsRepository';
import { KnexEmailsBodyRepository } from '@kace/core/src/emails/infrastructure/persistence/KnexEmailsBodyRepository';
import { KnexEmailAttachmentRepository } from '@kace/core/src/emails/infrastructure/persistence/KnexEmailAttachmentRepository';
import { S3EmailBodyStorage } from '@kace/core/src/emails/infrastructure/persistence/S3EmailBodyStorage.js';
import { Helper } from '@kace/core/src/shared/index.js';

export class ControllerDownload extends BaseController {
    constructor(event, knexConfig) {
        super(event, knexConfig);
        this.emailRepository = new KnexEmailsRepository(this.database_connection);
        this.emailBodyRepository = new KnexEmailsBodyRepository(this.database_connection);
        this.emailAttachmentRepository = new KnexEmailAttachmentRepository(this.database_connection);
        this.s3Storage = new S3EmailBodyStorage();
        this.started_at = new Date();
    }

    async actionRead() {
        Helper.logInfo('Begin ControllerDownload::actionRead');
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

            const result = await new EmailZipGenerator({
                emailRepository: this.emailRepository,
                emailBodyRepository: this.emailBodyRepository,
                attachmentsRepository: this.emailAttachmentRepository,
                s3Storage: this.s3Storage,
            }).execute(id);

            return HttpResponse.ok({ data: result, event: this.event });
        } catch (error) {
            Helper.logError(error);
            if (Number.isInteger(error?.statusCode) && error.statusCode === 404) {
                return HttpResponse.custom(error.message, 404, this.event);
            }
            return HttpResponse.internalServerError({ errors: error, event: this.event });
        } finally {
            Helper.logInfo('End ControllerDownload::actionRead');
        }
    }
}
