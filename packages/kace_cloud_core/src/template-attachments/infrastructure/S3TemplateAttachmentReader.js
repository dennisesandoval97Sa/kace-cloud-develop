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

// Matches a plain file basename: no path separators and no ".." segments, so a
// filename can never escape the `template/{templateId}/` prefix it's read from.
const SAFE_FILENAME_PATTERN = /^[^/\\]+$/;

export class S3TemplateAttachmentReader {
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

    async read({ templateId, filename, contentType }) {
        // `filename` here can originate from a `data-filename` attribute embedded in a
        // template's saved HTML body — content editable by anyone with template-edit
        // permission, not just values that came from a legitimate upload. Without this
        // guard, a crafted `data-filename="../other-template-id/secret.png"` would let
        // the S3 key traverse into another template's (or another prefix's) objects.
        if (typeof filename !== 'string' || filename === '..' || !SAFE_FILENAME_PATTERN.test(filename)) {
            throw new Error(`Invalid template attachment filename: ${filename}`);
        }

        this.#initClient();
        const response = await this.#s3Client.send(
            new GetObjectCommand({
                Bucket: this.#bucketName,
                Key: `template/${templateId}/${filename}`,
            })
        );
        return {
            filename,
            contentType: contentType || response.ContentType || 'application/octet-stream',
            content: await streamToBuffer(response.Body),
        };
    }
}
