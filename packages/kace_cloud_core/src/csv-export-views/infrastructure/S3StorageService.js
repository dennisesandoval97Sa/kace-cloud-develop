import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';
import { Helper } from '../../shared';

export class S3StorageService {
    constructor({ region, accessKeyId, secretAccessKey, bucket, requestHandler = null }) {
        const s3Config = {
            region,
            credentials: {
                accessKeyId,
                secretAccessKey,
            },
        };
        if (requestHandler) {
            s3Config.requestHandler = requestHandler;
        }
        this.s3Client = new S3Client(s3Config);
        this.bucket = bucket;
    }

    /**
     * Build the common PutObject-style params (ContentType, ContentDisposition,
     * caducity metadata/tagging) shared by file and stream uploads. Does not set `Body`.
     * @param {string} destinationPath
     * @param {{ expiresInDays?: number, skipTagging?: boolean }} [options]
     * @returns {Object}
     */
    #buildObjectParams(destinationPath, options = {}) {
        const params = {
            Bucket: this.bucket,
            Key: destinationPath,
            // default content type; may be overridden below based on extension
            ContentType: 'application/octet-stream',
            ACL: 'private',
        };

        // Set proper ContentType and ContentDisposition based on file extension
        try {
            const ext = path.extname(destinationPath || '').toLowerCase();
            const baseName = path.basename(destinationPath || 'file');
            if (ext === '.xlsx') {
                params.ContentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
            } else if (ext === '.xls') {
                params.ContentType = 'application/vnd.ms-excel';
            } else if (ext === '.csv') {
                params.ContentType = 'text/csv';
            } else if (ext === '.pdf') {
                params.ContentType = 'application/pdf';
            }

            // Force download with an attachment disposition using the original filename
            params.ContentDisposition = `attachment; filename="${baseName}"`;
        } catch (e) {
            Helper.logError(e);
            // If path utilities fail for any reason, continue with defaults
        }

        // If caller requests object caducity, attach metadata, Expires header, and optionally
        // a lifecycle tag. Tagging requires s3:PutObjectTagging; pass includeTagging=false
        // when that permission is not available.
        if (options && typeof options.expiresInDays === 'number' && options.expiresInDays > 0) {
            const expiresDate = new Date(Date.now() + options.expiresInDays * 24 * 60 * 60 * 1000);
            // Expires header (useful for caching semantics)
            params.Expires = expiresDate;
            // Add custom metadata for consumers
            params.Metadata = Object.assign({}, params.Metadata, {
                'expires-at': expiresDate.toISOString(),
            });
            // Add a tag so bucket lifecycle rules (if configured) can match and expire objects.
            // Omitted when skipTagging is true (e.g. when the IAM role lacks s3:PutObjectTagging).
            if (!options.skipTagging) {
                try {
                    params.Tagging = `expires=true&expire_days=${options.expiresInDays}`;
                } catch (e) {
                    Helper.logError(e);
                    // ignore tagging errors here, SDK expects a string
                }
            }
        }

        return params;
    }

    /**
     * Upload a file to S3.
     * @param {string} filePath
     * @param {string} destinationPath
     * @param {{ expiresInDays?: number }} [options]
     */
    async uploadFile(filePath, destinationPath, options = {}) {
        const params = this.#buildObjectParams(destinationPath, options);
        params.Body = fs.createReadStream(filePath);

        try {
            const command = new PutObjectCommand(params);
            await this.s3Client.send(command);
            return `s3://${this.bucket}/${destinationPath}`;
        } catch (err) {
            // If tagging caused an access denied error, retry without Tagging to remain compatible
            const msg = err && err.message ? err.message : '';
            const code = err && err.name ? err.name : err && err.code ? err.code : null;
            const taggingDenied =
                /PutObjectTagging|not authorized to perform|s3:PutObjectTagging|AccessDenied/i.test(msg) ||
                code === 'AccessDenied';

            if (taggingDenied && params.Tagging) {
                Helper.logInfo('S3StorageService: PutObjectTagging denied, retrying upload without tags');
                try {
                    // Remove tagging and recreate the file stream for retry (original stream is already consumed)
                    delete params.Tagging;
                    params.Body = fs.createReadStream(filePath);
                    const retryCommand = new PutObjectCommand(params);
                    await this.s3Client.send(retryCommand);
                    return `s3://${this.bucket}/${destinationPath}`;
                } catch (err2) {
                    Helper.logError(err2);
                    // If retry fails, throw the retry error with context
                    throw new Error(`Failed to upload file to S3 (retry without tagging failed): ${err2.message}`);
                }
            }

            Helper.logError(err);
            throw new Error(`Failed to upload file to S3: ${err.message}`);
        }
    }

    /**
     * Upload a readable stream to S3 via multipart upload, without buffering it to a
     * local temp file first. Intended for large, generated-on-the-fly content (e.g. a
     * streaming XLSX writer piping into a PassThrough).
     *
     * NOTE: If the IAM role performing the upload lacks `s3:PutObjectTagging` permissions,
     * the caller should pass `skipTagging: true` in the options. Expiry intent will still
     * be preserved via `Metadata.expires-at` and the `Expires` header.
     * @param {import('stream').Readable} bodyStream
     * @param {string} destinationPath
     * @param {{ expiresInDays?: number, skipTagging?: boolean }} [options]
     * @returns {Promise<string>} s3://bucket/key
     */
    async uploadStream(bodyStream, destinationPath, options = {}) {
        // Lazy import: @aws-sdk/lib-storage isn't part of the Lambda-managed AWS SDK, so it's
        // only npm-installed into the bundles of lambdas that actually call this method. A
        // top-level import here would break cold start for every other lambda that merely
        // imports S3StorageService without ever calling uploadStream.
        const { Upload } = await import('@aws-sdk/lib-storage');

        const params = this.#buildObjectParams(destinationPath, options);
        params.Body = bodyStream;

        try {
            const upload = new Upload({ client: this.s3Client, params });
            await upload.done();
            return `s3://${this.bucket}/${destinationPath}`;
        } catch (err) {
            Helper.logError(err);
            throw new Error(`Failed to upload stream to S3: ${err.message}`);
        }
    }
}
