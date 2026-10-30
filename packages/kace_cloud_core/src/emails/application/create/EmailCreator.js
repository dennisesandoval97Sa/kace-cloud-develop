import { CustomError, Helper, ValidationFailError, ValueObjectUuid } from '@kace/core/src/shared/index.js';
import { KnexEmailsRepository } from '../../infrastructure/persistence/KnexEmailsRepository.js';
import { Email } from '../../domain/Email.js';
import { EmailFinder } from '../../domain/EmailFinder.js';
import { KnexEmailsBodyRepository } from '../../infrastructure/persistence/KnexEmailsBodyRepository.js';
import { EmailBody } from '../../domain/EmailBody.js';
import { KnexEmailAttachmentRepository } from '../../infrastructure/persistence/KnexEmailAttachmentRepository.js';
import { EmailAttachment } from '../../domain/EmailAttachments.js';
import { S3AttachmentStorage } from '../../infrastructure/persistence/S3AttachmentStorage.js';
import { HttpAttachmentDownloader } from '../../infrastructure/persistence/HttpAttachmentDownloader.js';
import { S3FileScanner, S3ScanService } from '../../../s3-files/index.js';

const EXTERNAL_STORAGE_MODE = 'external';
const DEFAULT_TEXT_CONTENT_TYPE = 'text/plain; charset=utf-8';
const DEFAULT_HTML_CONTENT_TYPE = 'text/html; charset=utf-8';

export class EmailCreator {
    /** @type {KnexEmailsRepository} is initialized in the constructor */
    #repository;
    /** @type {EmailFinder} is initialized in the constructor */
    #finder;
    /** @type {KnexEmailsBodyRepository} is initialized in the constructor */
    #emailBodyRepository;
    /** @type {KnexEmailAttachmentRepository} is initialized in the constructor */
    #emailAttachmentRepository;
    #channelHubAccountRepository;
    /** @type {HttpAttachmentDownloader} is initialized in the constructor */
    #attachmentDownloader;
    /** @type {S3AttachmentStorage} is initialized in the constructor */
    #attachmentStorage;
    /** @type {S3FileScanner} is initialized in the constructor */
    #fileScanner;
    #bodyStorage;

    /**
     * Constructs an instance of the class and initializes its dependencies.
     *
     * @param {KnexEmailsRepository} repository - The repository for managing email data.
     * @param {KnexEmailsBodyRepository} emailBodyRepository - The repository for handling email body information.
     * @param {KnexEmailAttachmentRepository} emailAttachmentRepository - The repository for managing email attachments.
     * @param {KnexChannelHubAccountRepository} channelHubAccountRepository - The repository for Channel Hub accounts.
     * @param {HttpAttachmentDownloader} attachmentDownloader - The service responsible for downloading attachments.
     * @param {S3AttachmentStorage} attachmentStorage - The service for storing email attachments.
     * @param {S3FileScanner} s3FileScanner - The scanner for analyzing files stored in S3.
     * @param {Object|null} bodyStorage - The service for validating external email body storage.
     * @return {void}
     */
    constructor(
        repository,
        emailBodyRepository,
        emailAttachmentRepository,
        channelHubAccountRepository,
        attachmentDownloader,
        attachmentStorage,
        s3FileScanner,
        bodyStorage = null
    ) {
        this.#repository = repository;
        this.#finder = new EmailFinder(repository);
        this.#emailBodyRepository = emailBodyRepository;
        this.#emailAttachmentRepository = emailAttachmentRepository;
        this.#channelHubAccountRepository = channelHubAccountRepository;
        this.#attachmentDownloader = attachmentDownloader;
        this.#attachmentStorage = attachmentStorage;
        this.#fileScanner = s3FileScanner;
        this.#bodyStorage = bodyStorage;
    }

    /**
     * Creates a new email and saves it to the repository.
     * @param {Object} dto - Data for creating the entity.
     * @returns {Promise<void>}
     */
    async execute(dto) {
        const uploadedAttachmentKeys = [];

        const channelHubAccount = await this.#resolveChannelHubAccount(dto);
        dto.account_id = channelHubAccount.id.value;

        const email = Email.create(dto);
        // The controller checks collisions for HTTP create calls. Keep this domain
        // guard for non-controller callers and as defense in depth before insert.
        const emailFound = await this.#finder.execute(email.id.value);
        if (emailFound) {
            throw new ValidationFailError(`Email with id ${email.id.value} already exists`, 'email');
        }

        try {
            const bodyRecord = dto.body ? await this.#prepareBodyRecord(dto.body, email.id.value) : null;
            const attachments = await this.#prepareAttachments({
                emailId: email.id.value,
                attachments: dto.attachments ?? [],
                createdAt: dto.created_at,
                createdBy: dto.created_by,
                uploadedAttachmentKeys,
            });

            await this.#repository.connection.transaction(async (trx) => {
                await this.#repository.save(email, trx);

                if (bodyRecord) {
                    const emailBody = await EmailBody.create({
                        id: dto.body.id,
                        email_id: email.id.value,
                        ...bodyRecord,
                        created_at: dto.created_at,
                        created_by: dto.created_by,
                    });

                    await this.#emailBodyRepository.save(emailBody, trx);
                }

                for (const attachment of attachments) {
                    await this.#emailAttachmentRepository.save(attachment, trx);
                }
            });
        } catch (error) {
            await this.#cleanupUploadedAttachments(uploadedAttachmentKeys);
            throw error;
        }
    }

    async #resolveChannelHubAccount(dto) {
        if (dto.account_id) {
            return await this.#resolveExplicitChannelHubAccount(dto.account_id);
        }

        const accounts = await this.#findActiveChannelHubAccountsForRecipients(dto);

        if (accounts.length === 0) {
            throw new ValidationFailError(
                'Receiving Channel Hub account could not be resolved from email recipients.',
                'account_id'
            );
        }

        if (accounts.length > 1) {
            throw new ValidationFailError(
                'Receiving Channel Hub account is ambiguous; provide account_id.',
                'account_id'
            );
        }

        return accounts[0];
    }

    async #resolveExplicitChannelHubAccount(accountId) {
        const account = await this.#channelHubAccountRepository.find(new ValueObjectUuid('account_id', accountId));

        if (!account) {
            throw new ValidationFailError(`Channel Hub account with id ${accountId} not found.`, 'account_id');
        }

        if (!this.#isActiveChannelHubAccount(account)) {
            throw new ValidationFailError(`Channel Hub account with id ${accountId} is inactive.`, 'account_id');
        }

        return account;
    }

    async #findActiveChannelHubAccountsForRecipients(dto) {
        const recipientEmails = this.#recipientEmails(dto);
        const accounts = await this.#channelHubAccountRepository.findAllByEmails(recipientEmails);
        const activeAccountsById = new Map();

        for (const account of accounts) {
            if (this.#isActiveChannelHubAccount(account)) {
                activeAccountsById.set(account.id.value, account);
            }
        }

        return [...activeAccountsById.values()];
    }

    #recipientEmails({ to, cc, bcc }) {
        return [to, cc, bcc]
            .flatMap((recipients) => (Array.isArray(recipients) ? recipients : []))
            .map((recipient) => this.#recipientEmail(recipient))
            .filter(Boolean);
    }

    #recipientEmail(recipient) {
        const value = typeof recipient === 'string' ? recipient : recipient?.email;
        return typeof value === 'string' ? value.trim().toLowerCase() : null;
    }

    #isActiveChannelHubAccount(account) {
        return account?.is_active?.value === true || account?.is_active?.value === 1;
    }

    async #prepareAttachments({ emailId, attachments, createdAt, createdBy, uploadedAttachmentKeys }) {
        if (!attachments.length) {
            return [];
        }

        if (!this.#attachmentDownloader || !this.#attachmentStorage || !this.#fileScanner) {
            throw new CustomError('Email attachment processing dependencies are not configured.', 500);
        }

        const durableAttachments = [];

        for (const att of attachments) {
            const file = await this.#attachmentDownloader.download(att.url);
            const filename = att.filename ?? file.filename;

            const stored = await this.#attachmentStorage.upload({
                emailId,
                buffer: file.buffer,
                contentType: file.contentType,
                filename,
            });
            if (stored?.s3Key) {
                uploadedAttachmentKeys.push(stored.s3Key);
            }
            if (!stored?.s3Key || !stored?.s3Url) {
                throw new CustomError(`Attachment ${filename ?? att.url} was uploaded without durable S3 metadata.`);
            }

            const [baseFolder, folderId, ...fileNameParts] = stored.s3Key.split('/');
            const fileName = fileNameParts.join('/');

            const scanResult = await this.#fileScanner.execute({
                url: baseFolder,
                id: folderId,
                fileName,
            });

            if (scanResult?.message !== 'File validated successfully') {
                throw new CustomError(`Attachment ${fileName} rejected by security scan`);
            }

            durableAttachments.push(
                await EmailAttachment.create({
                    id: att.id,
                    email_id: emailId,
                    url: stored.s3Url,
                    size: att.size ?? file.buffer.length,
                    filename,
                    created_at: createdAt,
                    created_by: createdBy,
                })
            );
        }

        return durableAttachments;
    }

    async #cleanupUploadedAttachments(uploadedAttachmentKeys) {
        if (!uploadedAttachmentKeys.length || typeof this.#attachmentStorage?.delete !== 'function') {
            return;
        }

        const results = await Promise.allSettled(
            uploadedAttachmentKeys.map((s3Key) => this.#attachmentStorage.delete(s3Key))
        );
        const failedKeys = results
            .map((result, index) => (result.status === 'rejected' ? uploadedAttachmentKeys[index] : null))
            .filter(Boolean);

        if (failedKeys.length > 0) {
            Helper.logError('Failed to clean up orphaned S3 attachments', { s3Keys: failedKeys });
        }
    }

    async #prepareBodyRecord(bodyDto, emailId) {
        const text = await this.#prepareExternalBodyPart({
            part: 'text',
            emailId,
            external: bodyDto.text,
        });
        const html = await this.#prepareExternalBodyPart({
            part: 'html',
            emailId,
            external: bodyDto.html,
        });

        if (html && bodyDto.body_html) {
            throw new ValidationFailError(
                'body.body_html cannot be provided when body.html.s3_url is provided.',
                'body.html'
            );
        }

        return {
            body: bodyDto.body,
            body_html: html ? null : (bodyDto.body_html ?? null),
            body_text_storage_mode: text?.storageMode ?? null,
            body_text_s3_key: text?.s3Key ?? null,
            body_text_size_bytes: text?.sizeBytes ?? null,
            body_text_content_type: text?.contentType ?? null,
            body_text_sha256: text?.sha256 ?? null,
            body_text_preview_truncated: Boolean(text),
            body_html_storage_mode: html?.storageMode ?? null,
            body_html_s3_key: html?.s3Key ?? null,
            body_html_size_bytes: html?.sizeBytes ?? null,
            body_html_content_type: html?.contentType ?? null,
            body_html_sha256: html?.sha256 ?? null,
            body_html_preview_truncated: Boolean(html),
        };
    }

    async #prepareExternalBodyPart({ part, emailId, external }) {
        if (!external?.s3_url) {
            return null;
        }

        if (
            !this.#bodyStorage ||
            typeof this.#bodyStorage.extractTenantUploadObjectKey !== 'function' ||
            typeof this.#bodyStorage.head !== 'function'
        ) {
            throw new CustomError('Email body storage is not configured.', 500);
        }

        const field = `body.${part}.s3_url`;
        let s3Key;
        try {
            s3Key = this.#bodyStorage.extractTenantUploadObjectKey(external.s3_url);
        } catch (error) {
            throw new ValidationFailError(error.message, field);
        }

        this.#validateExternalBodyKey({ s3Key, emailId, part, field });

        const storageMetadata = await this.#headExternalBodyObject({ s3Key, field });
        const sizeBytes = Number(external.size_bytes);
        if (!Number.isFinite(sizeBytes) || sizeBytes < 0) {
            throw new ValidationFailError('External email body size_bytes must be a non-negative number.', field);
        }

        if (Number(storageMetadata.sizeBytes) !== sizeBytes) {
            throw new ValidationFailError('External email body size_bytes does not match the S3 object.', field);
        }

        return {
            storageMode: EXTERNAL_STORAGE_MODE,
            s3Key,
            sizeBytes,
            contentType: external.content_type || this.#defaultContentType(part),
            sha256: external.sha256,
        };
    }

    async #headExternalBodyObject({ s3Key, field }) {
        try {
            const storageMetadata = await this.#bodyStorage.head(s3Key);
            if (!Number.isFinite(Number(storageMetadata?.sizeBytes))) {
                throw new Error('missing ContentLength');
            }
            return storageMetadata;
        } catch (_error) {
            throw new ValidationFailError('External email body object could not be verified in tenant S3.', field);
        }
    }

    #validateExternalBodyKey({ s3Key, emailId, part, field }) {
        const prefix = `email-bodies/${emailId}/`;
        if (!s3Key.startsWith(prefix)) {
            throw new ValidationFailError(`External email body object must be stored under ${prefix}.`, field);
        }

        const filename = s3Key.slice(prefix.length);
        const expectedExtension = part === 'html' ? '.html' : '.txt';
        if (!filename.startsWith(`${part}-`) || !filename.endsWith(expectedExtension)) {
            throw new ValidationFailError(
                `External email body object filename must match ${part}-*.${expectedExtension.slice(1)}.`,
                field
            );
        }
    }

    #defaultContentType(part) {
        return part === 'html' ? DEFAULT_HTML_CONTENT_TYPE : DEFAULT_TEXT_CONTENT_TYPE;
    }
}
