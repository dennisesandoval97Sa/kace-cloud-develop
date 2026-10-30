import { BaseController, HttpResponse } from '@kace/api-common';
import { uploadFileSchema } from './schemas.mjs';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { GetPresignedUrl } from '@kace/core/src/s3-files/application/get-presigned-url/GetPresignedUrl';
import { Helper } from '@kace/core/src/shared/index.js';

export class Controller extends BaseController {
    constructor(event, knexConfig) {
        super(event, knexConfig);
    }

    async actionCreate() {
        Helper.logInfo('Begin actionIndex');
        try {
            const hasPermission = this.user.hasPermission('administrador', 's3-files', 'S3FilesUpload');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to create this resource.',
                    event: this.event,
                });
            }

            const payload = this.payload();

            const { value, error } = uploadFileSchema.validate(payload, {
                abortEarly: false,
            });
            if (error) {
                return HttpResponse.validationsFail({
                    errors: error,
                    event: this.event,
                });
            }

            const s3Params = {
                Key: `${value.url}/${value.id}/${value.fileName}`,
                Bucket: this.event.tenantContext.tenant.aws_s3_bucket.value,
                ContentType: value.contentType,
            };
            const command = new PutObjectCommand(s3Params);

            const s3Client = new S3Client({
                region: this.event.tenantContext.tenant.aws_s3_region.value,
                credentials: {
                    accessKeyId: this.event.tenantContext.tenant.aws_s3_access_key_id.value,
                    secretAccessKey: this.event.tenantContext.tenant.aws_s3_secret_access_key.value,
                },
            });

            const signedUrl = await new GetPresignedUrl(s3Client, command).execute(value.fileName, value.contentType);

            return HttpResponse.ok({ data: signedUrl, event: this.event });
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
}
