import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { TenantContext } from '../../shared/index.js';

const streamToBuffer = async (body) => {
    if (!body) return Buffer.alloc(0);
    if (Buffer.isBuffer(body)) return body;
    if (body instanceof Uint8Array) return Buffer.from(body);

    if (typeof body.transformToByteArray === 'function') {
        return Buffer.from(await body.transformToByteArray());
    }

    if (typeof body.transformToString === 'function') {
        return Buffer.from(await body.transformToString());
    }

    const chunks = [];
    for await (const chunk of body) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    return Buffer.concat(chunks);
};

export class S3CaseAttachmentReader {
    #s3Client = null;
    #bucketName = null;

    #initClient() {
        if (this.#s3Client) return;
        const tenant = TenantContext.getTenant();
        this.#s3Client = new S3Client({
            region: tenant.aws_s3_region.value,
            credentials: {
                accessKeyId: tenant.aws_s3_access_key_id.value,
                secretAccessKey: tenant.aws_s3_secret_access_key.value,
            },
        });
        this.#bucketName = tenant.aws_s3_bucket.value;
    }

    /**
     * Reads a Case Attachment from the tenant S3 bucket.
     *
     * @param {{ caseId: string, filename: string, contentType?: string }} params
     * @returns {Promise<{ filename: string, contentType: string, content: Buffer }>}
     */
    async read({ caseId, filename, contentType }) {
        this.#initClient();
        const response = await this.#s3Client.send(
            new GetObjectCommand({
                Bucket: this.#bucketName,
                Key: `case/${caseId}/${filename}`,
            })
        );

        return {
            filename,
            contentType: contentType || response.ContentType || 'application/octet-stream',
            content: await streamToBuffer(response.Body),
        };
    }
}
