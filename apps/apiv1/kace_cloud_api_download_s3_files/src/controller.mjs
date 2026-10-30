import { BaseController, HttpResponse } from '@kace/api-common';
import { uploadFileSchema } from './schemas.mjs';

import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

import { GetPresignedUrl } from '@kace/core/src/s3-files/application/get-presigned-url/GetPresignedUrl';
import { Helper } from '@kace/core/src/shared/index.js';

export class Controller extends BaseController {
    #event; // is initialized in the constructor
    constructor(event, knexConfig) {
        super(event, knexConfig);
        this.#event = event;
    }

    async actionCreate() {
        Helper.logInfo('Begin actionIndex');
        try {
            const hasPermission = this.user.hasPermission('administrador', 's3-files', 'S3FilesDownload');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to create this resource.',
                    event: this.#event,
                });
            }

            const payload = this.payload();

            const { value, error } = uploadFileSchema.validate(payload, {
                abortEarly: false,
            });
            if (error) {
                return HttpResponse.validationsFail({
                    errors: error,
                    event: this.#event,
                });
            }

            // Build S3 object key; include payload.id only when provided
            const baseUrl = (payload.url || '').replace(/\/$/, '');
            const idSegment = payload.id ? `/${String(payload.id)}` : '';
            const fileName = value.fileName;
            const key = `${baseUrl}${idSegment}/${fileName}`;

            const {tenant} = this.event.tenantContext;
            const s3Params = {
                Key: key,
                Bucket: tenant.aws_s3_bucket.value,
            };

            const s3Client = new S3Client({
                region: tenant.aws_s3_region.value,
                credentials: {
                    accessKeyId: tenant.aws_s3_access_key_id.value,
                    secretAccessKey: tenant.aws_s3_secret_access_key.value,
                },
            });
            const command = new GetObjectCommand(s3Params);
            const signedUrl = await new GetPresignedUrl(s3Client, command).execute(
                payload.fileName,
                payload.contentType
            );

            return HttpResponse.ok({ data: signedUrl, event: this.#event });
        } catch (error) {
            Helper.logInfo(error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.#event,
            });
        } finally {
            Helper.logInfo('End actionIndex');
        }
    }
}
