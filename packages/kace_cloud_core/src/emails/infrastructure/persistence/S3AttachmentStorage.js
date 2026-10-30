import { v4 as uuidv4 } from 'uuid';
import { AttachmentStoragePort } from '../../domain/ports/AttachmentStoragePort';
import { Filename } from '../../domain/value-object/FileNameAttachment';
import { DeleteObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { TenantContext } from '../../../shared/index.js';

/**
 * S3-based implementation of the AttachmentStoragePort.
 *
 * This class is responsible for uploading email attachments to an Amazon S3 bucket.
 * Each attachment is stored under a structured path that includes the email ID
 * and a unique identifier to avoid name collisions.
 */

export class S3AttachmentStorage extends AttachmentStoragePort {
    static MAX_S3_OBJECT_BASENAME_LENGTH = 255;

    /** @type {S3Client} */
    #s3Client;
    /** @type {string} */
    #bucket;

    /**
     * Creates an instance of S3AttachmentStorage.
     *
     * Initializes the S3 client using credentials and region
     * provided through environment variables.
     */

    constructor({ s3Client = null, bucket = null, region = null, credentials = null } = {}) {
        super();
        const tenant = TenantContext.getTenant?.();
        const resolvedRegion = region ?? tenant?.aws_s3_region?.value ?? process.env.AWS_S3_REGION;
        const resolvedCredentials = credentials ?? {
            accessKeyId: tenant?.aws_s3_access_key_id?.value ?? process.env.AWS_S3_ACCESS_KEY_ID,
            secretAccessKey: tenant?.aws_s3_secret_access_key?.value ?? process.env.AWS_S3_SECRET_ACCESS_KEY,
        };

        this.#s3Client =
            s3Client ??
            new S3Client({
                region: resolvedRegion,
                credentials: resolvedCredentials,
            });

        this.#bucket = bucket ?? tenant?.aws_s3_bucket?.value ?? process.env.BUCKET ?? process.env.AWS_S3_BUCKET;
    }

    /**
     * Uploads an attachment to Amazon S3.
     *
     * The file name is sanitized to prevent invalid characters,
     * and a unique key is generated using the email ID and a UUID.
     *
     * @param {Object} params - Upload parameters.
     * @param {string} params.emailId - Identifier of the email associated with the attachment.
     * @param {Buffer} params.buffer - File content as a buffer.
     * @param {string} params.contentType - MIME type of the file.
     * @param {string} params.filename - Original file name.
     *
     * @returns {Promise<{s3Key: string, s3Url: string}>}
     * An object containing the S3 object key and its public URL.
     */

    async upload({ emailId, buffer, contentType, filename }) {
        const attachmentId = uuidv4();
        const safeFilename = Filename.sanitize(filename, {
            maxLength: S3AttachmentStorage.MAX_S3_OBJECT_BASENAME_LENGTH - attachmentId.length - 1,
        });

        const key = `attachments/${emailId}/${attachmentId}_${safeFilename}`;

        const command = new PutObjectCommand({
            Bucket: this.#bucket,
            Key: key,
            Body: buffer,
            ContentType: contentType,
        });

        await this.#s3Client.send(command);

        return {
            s3Key: key,
            s3Url: `https://${this.#bucket}.s3.amazonaws.com/${key}`,
        };
    }

    async delete(s3Key) {
        if (!s3Key) {
            return;
        }

        const command = new DeleteObjectCommand({
            Bucket: this.#bucket,
            Key: s3Key,
        });

        await this.#s3Client.send(command);
    }

    /**
     * Reads object metadata from S3 without downloading the content.
     *
     * @param {string} s3Key
     * @returns {Promise<{size: number, contentType: string|null}>}
     */
    async head(s3Key) {
        const command = new HeadObjectCommand({
            Bucket: this.#bucket,
            Key: s3Key,
        });

        const response = await this.#s3Client.send(command);

        return {
            size: Number(response?.ContentLength ?? 0),
            contentType: response?.ContentType ?? null,
        };
    }
}
