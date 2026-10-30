import { CustomError } from '../../../shared/errors/CustomError.js';
import { Helper } from '../../../shared/index.js';
import { EmailAttachment } from '../../domain/EmailAttachments.js';
import { EmailAttachmentS3Location } from '../../domain/EmailAttachmentS3Location.js';

/**
 * Shared persistence service for outbound email attachments (send/reply).
 *
 * `prepare()` resolves real metadata (filename from the S3 key, size via
 * HeadObject) and validates that every kace-S3 attachment actually exists
 * in storage — call it BEFORE sending to Channel Hub so an email with a
 * broken attachment never goes out. `persist()` saves the prepared rows
 * AFTER the send succeeds.
 */
export class OutboundAttachmentPersister {
    #emailAttachmentRepository;
    #attachmentStorage;

    constructor({ emailAttachmentRepository, attachmentStorage }) {
        this.#emailAttachmentRepository = emailAttachmentRepository;
        this.#attachmentStorage = attachmentStorage;
    }

    /**
     * @param {string[]} urls
     * @returns {Promise<Array<{url: string, filename: string|null, size: number}>>}
     * @throws {CustomError} 422 when a kace-S3 attachment is missing in storage.
     * @throws {CustomError} 502 on other storage failures (access denied, throttling, network, etc.).
     */
    async prepare(urls = []) {
        // HeadObject calls are independent per attachment, so resolve them in
        // parallel; Promise.all preserves input order and rethrows the same
        // per-attachment CustomError (422/502) the sequential version produced.
        return Promise.all(urls.map((url) => this.#prepareOne(url)));
    }

    /**
     * @param {string} url
     * @returns {Promise<{url: string, filename: string|null, size: number}>}
     * @throws {CustomError} 422 when a kace-S3 attachment is missing in storage.
     * @throws {CustomError} 502 on other storage failures (access denied, throttling, network, etc.).
     */
    async #prepareOne(url) {
        const location = EmailAttachmentS3Location.fromUrl(url);

        if (!location) {
            return { url, filename: null, size: 0 };
        }

        let head;
        try {
            head = await this.#attachmentStorage.head(location.key);
        } catch (error) {
            if (error?.name === 'NotFound' || error?.$metadata?.httpStatusCode === 404) {
                throw new CustomError(`Attachment not found in storage: ${url}`, 422);
            }
            Helper.logError(`Error reading attachment metadata from storage: ${url}`, error);
            throw new CustomError(`Failed to read attachment from storage: ${url}`, 502);
        }

        return {
            url,
            filename: location.cleanFilename,
            size: head?.size ?? 0,
        };
    }

    /**
     * @param {Object} params
     * @param {string} params.emailId
     * @param {Array<{url: string, filename: string|null, size: number}>} params.attachments
     * @param {string} params.userId
     * @param {Date} params.now
     */
    async persist({ emailId, attachments, userId, now }) {
        for (const { url, filename, size } of attachments ?? []) {
            const attachment = EmailAttachment.create({
                email_id: emailId,
                url,
                size,
                filename,
                created_at: now,
                created_by: userId,
                updated_at: now,
                updated_by: userId,
            });
            await this.#emailAttachmentRepository.save(attachment);
        }
    }
}
