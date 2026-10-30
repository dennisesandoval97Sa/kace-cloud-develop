import { v4 as uuidv4 } from 'uuid';
import { globalSystemUserId } from '@kace/database/seeds/20241125105900_usuario_base.js';
import { SQL_BLACKLIST_WORD_DETECTED } from '@kace/error-codes';
import { Email } from '../../emails/domain/Email.js';
import { EmailAttachment } from '../../emails/domain/EmailAttachments.js';
import { EmailBody } from '../../emails/domain/EmailBody.js';
import { Filename } from '../../emails/domain/value-object/FileNameAttachment.js';
import { Interaction } from '../../interactions/domain/Interaction.js';
import { S3_FILE_SCAN_ERROR_CODES } from '../../s3-files/domain/S3FileScanErrorCodes.js';
import { Helper, ValueObjectJson, ValueObjectString } from '../../shared/index.js';
import { extractChannelHubOriginalFilename } from './ChannelHubAttachmentFilename.js';
import { CHANNEL_HUB_INBOUND_EMAIL_ERROR_CODES } from './ChannelHubInboundEmailErrorCodes.js';
import { ChannelHubInboundEmailProcessingResult } from './ChannelHubInboundEmailProcessingResult.js';
import {
    BODY_STORAGE_MODE_EXTERNAL,
    BODY_STORAGE_MODE_INLINE,
    BODY_PREVIEW_MAX_CHARS,
    EXTERNAL_EMAIL_BODY_MAX_BYTES,
    INLINE_EMAIL_BODY_MAX_BYTES,
    MAX_PLAIN_TEXT_BODY_BYTES,
    bodyBuffer,
    isHtmlContent,
    previewFromHtml,
    previewFromText,
    sha256,
    stripHtmlToText,
} from './ChannelHubInboundEmailBodyContent.js';

export { MAX_PLAIN_TEXT_BODY_BYTES };

const DEFAULT_PRIORITY = 'normal';
const EMAIL_CHANNEL_ID = 'email';
const DEFAULT_SUBJECT = 'No subject';
const MAX_EXTERNAL_MESSAGE_ID_LENGTH = 255;
const MAX_THREAD_ID_LENGTH = 255;
const MAX_SUBJECT_LENGTH = 500;
const MAX_SENDER_LENGTH = 120;

const firstNonEmptyString = (...values) => values.find((value) => typeof value === 'string' && value.trim().length > 0);

export class ChannelHubInboundEmailProcessor {
    #emailRepository;
    #emailBodyRepository;
    #emailAttachmentRepository;
    #interactionRepository;
    #channelHubAccountRepository;
    #workspaceRepository;
    #allowedConnectionRepository;
    #bodyDownloader;
    #attachmentDownloader;
    #attachmentStorage;
    #bodyStorage;
    #fileScanner;
    #inlineImageEmbedder;

    constructor({
        emailRepository,
        emailBodyRepository,
        emailAttachmentRepository,
        interactionRepository,
        channelHubAccountRepository,
        workspaceRepository,
        allowedConnectionRepository,
        bodyDownloader,
        attachmentDownloader,
        attachmentStorage,
        bodyStorage,
        fileScanner,
        inlineImageEmbedder,
    }) {
        this.#emailRepository = emailRepository;
        this.#emailBodyRepository = emailBodyRepository;
        this.#emailAttachmentRepository = emailAttachmentRepository;
        this.#interactionRepository = interactionRepository;
        this.#channelHubAccountRepository = channelHubAccountRepository;
        this.#workspaceRepository = workspaceRepository;
        this.#allowedConnectionRepository = allowedConnectionRepository;
        this.#bodyDownloader = bodyDownloader;
        this.#attachmentDownloader = attachmentDownloader;
        this.#attachmentStorage = attachmentStorage;
        this.#bodyStorage = bodyStorage;
        this.#fileScanner = fileScanner;
        this.#inlineImageEmbedder = inlineImageEmbedder;
    }

    async execute(payload) {
        const externalMessageId = payload?.messageId;
        const threadId = this.#threadIdFrom(payload?.threadId);
        const connectionId = this.#connectionIdFrom(payload?.connectionId);
        const workspaceTag = this.#workspaceTagFrom(payload?.tag);
        let workspaceId = null;
        const textBodyUrl = payload?.content?.text;
        const htmlBodyUrl = payload?.content?.html;
        const attachments = this.#normalizeAttachments(payload?.attachments);
        const receivedAt =
            firstNonEmptyString(payload?.operatorDate, payload?.received_at, payload?.receivedAt) ??
            new Date().toISOString();
        const sender = this.#normalizeEmail(payload?.origin);
        const subject = this.#subjectFrom(payload?.subject);
        const recipients = this.#normalizeDestination(payload?.destination);

        if (!externalMessageId) {
            return ChannelHubInboundEmailProcessingResult.nonRetryable(
                'missing_external_message_id',
                'Channel Hub messageId is required.'
            );
        }

        if (!connectionId) {
            return ChannelHubInboundEmailProcessingResult.nonRetryable(
                'missing_channel_hub_connection_id',
                'Channel Hub connectionId is required.'
            );
        }

        const invalidInput = this.#validateDbBoundInput({
            externalMessageId,
            threadId,
            sender,
            subject,
            receivedAt,
            recipients,
        });

        if (invalidInput) {
            return invalidInput;
        }

        if (!sender) {
            return ChannelHubInboundEmailProcessingResult.nonRetryable(
                'missing_sender',
                'Channel Hub origin is required.'
            );
        }

        if (!textBodyUrl) {
            return ChannelHubInboundEmailProcessingResult.nonRetryable(
                'missing_text_body_url',
                'Channel Hub plain-text body URL is required.'
            );
        }

        let workspace;
        let allowed;
        const uploadedAttachmentKeys = [];
        const uploadedBodyKeys = [];

        try {
            const channelHubAccount = await this.#channelHubAccountRepository.findByConnectionId(connectionId);
            if (!channelHubAccount) {
                return ChannelHubInboundEmailProcessingResult.nonRetryable(
                    'channel_hub_connection_not_found',
                    `Channel Hub connectionId '${connectionId}' does not match a configured Channel Hub Account in KACE.`
                );
            }

            const workspaceResolution = await this.#resolveWorkspaceForChannelHubAccountAndTag({
                connectionId,
                workspaceTag,
                channelHubAccount,
            });
            if (workspaceResolution.error) {
                return workspaceResolution.error;
            }

            workspace = workspaceResolution.workspace;
            workspaceId = workspace.id.value;

            const existingEmail = await this.#emailRepository.findByWorkspaceAndMessageId(
                workspaceId,
                externalMessageId
            );
            if (existingEmail) {
                return await this.#alreadyProcessedResult(existingEmail);
            }

            allowed = await this.#allowedConnectionRepository.isAllowedConnection(textBodyUrl);
            if (!allowed) {
                return ChannelHubInboundEmailProcessingResult.nonRetryable(
                    'untrusted_text_body_url',
                    'Plain-text body URL host is not trusted.'
                );
            }

            if (htmlBodyUrl && !(await this.#allowedConnectionRepository.isAllowedConnection(htmlBodyUrl))) {
                return ChannelHubInboundEmailProcessingResult.nonRetryable(
                    'untrusted_html_body_url',
                    'HTML body URL host is not trusted.'
                );
            }

            for (const attachment of attachments) {
                if (!(await this.#allowedConnectionRepository.isAllowedConnection(attachment.url))) {
                    return ChannelHubInboundEmailProcessingResult.nonRetryable(
                        'untrusted_attachment_url',
                        'Attachment URL host is not trusted.'
                    );
                }
            }

            const emailId = uuidv4();
            const now = new Date().toISOString();
            const createdBy = globalSystemUserId;

            const bodyPreparation = await this.#prepareEmailBodyRecord({
                emailId,
                externalMessageId,
                connectionId,
                workspaceTag,
                textBodyUrl,
                htmlBodyUrl,
                uploadedBodyKeys,
            });
            if (bodyPreparation.error) {
                return bodyPreparation.error;
            }

            const durableAttachments = await this.#prepareDurableAttachments({
                emailId,
                attachments,
                createdAt: now,
                createdBy,
                uploadedAttachmentKeys,
            });

            const saved = await this.#persistAtomically({
                emailId,
                now,
                createdBy,
                externalMessageId,
                threadId,
                workspaceId,
                sender,
                recipients,
                bodyRecord: bodyPreparation.bodyRecord,
                subject,
                receivedAt,
                channelHubAccount,
                attachments: durableAttachments,
            });

            return ChannelHubInboundEmailProcessingResult.accepted(saved);
        } catch (error) {
            await this.#cleanupUploadedBodies(uploadedBodyKeys);
            await this.#cleanupUploadedAttachments(uploadedAttachmentKeys);

            if (error?.nonRetryable) {
                return ChannelHubInboundEmailProcessingResult.nonRetryable(error.code, error.message);
            }

            if (this.#isUniqueViolation(error)) {
                try {
                    const existingEmail = await this.#emailRepository.findByWorkspaceAndMessageId(
                        workspaceId,
                        externalMessageId
                    );
                    if (existingEmail) {
                        return await this.#alreadyProcessedResult(existingEmail);
                    }
                } catch (_lookupError) {
                    // Fall through to retryable: the race lookup itself depends on database availability.
                }
            }

            return ChannelHubInboundEmailProcessingResult.retryable(
                'processing_failed',
                'Channel Hub inbound email processing failed.',
                error
            );
        }
    }

    #workspaceTagFrom(tag) {
        if (typeof tag !== 'string') {
            return null;
        }

        const normalized = tag.trim();
        return normalized.length > 0 ? normalized : null;
    }

    #connectionIdFrom(connectionId) {
        if (typeof connectionId !== 'string') {
            return null;
        }

        const normalized = connectionId.trim();
        return normalized.length > 0 ? normalized : null;
    }

    #threadIdFrom(threadId) {
        if (typeof threadId !== 'string') {
            return null;
        }

        const normalized = threadId.trim();
        return normalized.length > 0 ? normalized : null;
    }

    async #resolveWorkspaceForChannelHubAccountAndTag({ connectionId, workspaceTag, channelHubAccount }) {
        if (!workspaceTag) {
            return await this.#resolveDefaultInboxWorkspace();
        }

        const workspaces = await this.#workspaceRepository.findActiveByChannelHubAccountIdAndTag(
            channelHubAccount.id.value,
            workspaceTag
        );

        if (workspaces.length === 1) {
            return { workspace: workspaces[0] };
        }

        if (workspaces.length > 1) {
            return {
                error: ChannelHubInboundEmailProcessingResult.nonRetryable(
                    'inconsistent_channel_hub_connection_workspace',
                    this.#formatConnectionWorkspaceInconsistencyMessage({ connectionId, workspaceTag, workspaces })
                ),
            };
        }

        return await this.#resolveDefaultInboxWorkspace();
    }

    async #resolveDefaultInboxWorkspace() {
        const inboxWorkspace = await this.#workspaceRepository.findDefaultInboxWorkspace();
        if (!inboxWorkspace) {
            return {
                error: ChannelHubInboundEmailProcessingResult.nonRetryable(
                    'default_inbox_workspace_not_found',
                    'Default INBOX Workspace is not configured or inactive.'
                ),
            };
        }

        return { workspace: inboxWorkspace };
    }

    #formatConnectionWorkspaceInconsistencyMessage({ connectionId, workspaceTag, workspaces }) {
        const formattedWorkspaces = workspaces
            .map((workspace) => this.#formatConnectionWorkspaceCandidate(workspace))
            .join(', ');

        return `Channel Hub connectionId '${connectionId}' with tag '${workspaceTag}' matches multiple active workspaces in KACE. This is a configuration inconsistency; the email cannot be routed safely. Workspaces: ${formattedWorkspaces}.`;
    }

    #formatConnectionWorkspaceCandidate(workspace) {
        return [
            `[workspaceId=${this.#formatDiagnosticValue(workspace?.id?.value ?? workspace?.id)}`,
            `workspaceName=${this.#formatDiagnosticValue(workspace?.description?.value ?? workspace?.description)}]`,
        ].join(', ');
    }

    #formatDiagnosticValue(value) {
        if (value === null || value === undefined) {
            return 'not_configured';
        }

        const normalized = String(value).trim();
        return normalized.length > 0 ? normalized : 'not_configured';
    }

    #normalizeDestination(destination = {}) {
        const recipients = {
            to: this.#normalizeRecipientList(destination.to),
            cc: this.#normalizeRecipientList(destination.cc),
            bcc: this.#normalizeRecipientList(destination.bcc),
        };

        if (recipients.to.length === 0 && recipients.cc.length === 0 && recipients.bcc.length === 1) {
            recipients.to = [{ ...recipients.bcc[0] }];
        }

        return recipients;
    }

    #normalizeRecipientList(value) {
        const values = Array.isArray(value) ? value : value ? [value] : [];

        return values
            .flatMap((recipient) => {
                if (typeof recipient === 'string') {
                    return this.#splitRecipientString(recipient).map((email) => ({
                        email: this.#normalizeEmail(email),
                        name: null,
                    }));
                }

                return [
                    {
                        email: this.#normalizeEmail(recipient?.email ?? recipient?.address),
                        name: recipient?.name ?? null,
                    },
                ];
            })
            .filter((recipient) => Boolean(recipient.email));
    }

    #splitRecipientString(value) {
        return String(value)
            .split(',')
            .map((recipient) => recipient.trim())
            .filter(Boolean);
    }

    #normalizeEmail(value) {
        if (!value) {
            return null;
        }

        if (typeof value === 'object') {
            return this.#normalizeEmail(value.email ?? value.address);
        }

        return String(value).trim().toLowerCase();
    }

    #subjectFrom(subject) {
        const normalizedSubject = String(subject ?? '').trim();
        return normalizedSubject || DEFAULT_SUBJECT;
    }

    #validateDbBoundInput({ externalMessageId, threadId, sender, subject, receivedAt, recipients }) {
        if (String(externalMessageId).length > MAX_EXTERNAL_MESSAGE_ID_LENGTH) {
            return ChannelHubInboundEmailProcessingResult.nonRetryable(
                'invalid_external_message_id',
                `External message ID cannot exceed ${MAX_EXTERNAL_MESSAGE_ID_LENGTH} characters.`
            );
        }

        if (threadId && String(threadId).length > MAX_THREAD_ID_LENGTH) {
            return ChannelHubInboundEmailProcessingResult.nonRetryable(
                'invalid_thread_id',
                `Thread ID cannot exceed ${MAX_THREAD_ID_LENGTH} characters.`
            );
        }

        if (sender && sender.length > MAX_SENDER_LENGTH) {
            return ChannelHubInboundEmailProcessingResult.nonRetryable(
                'invalid_sender',
                `Sender cannot exceed ${MAX_SENDER_LENGTH} characters.`
            );
        }

        if (subject.length > MAX_SUBJECT_LENGTH) {
            return ChannelHubInboundEmailProcessingResult.nonRetryable(
                'invalid_subject',
                `Subject cannot exceed ${MAX_SUBJECT_LENGTH} characters.`
            );
        }

        if (Number.isNaN(new Date(receivedAt).getTime())) {
            return ChannelHubInboundEmailProcessingResult.nonRetryable(
                'invalid_received_at',
                'Received timestamp must be a valid date-time.'
            );
        }

        const invalidDomainInput = this.#validateDomainBoundInput({
            externalMessageId,
            threadId,
            sender,
            subject,
            recipients,
        });
        if (invalidDomainInput) {
            return invalidDomainInput;
        }

        return null;
    }

    #validateDomainBoundInput({ externalMessageId, threadId, sender, subject, recipients }) {
        const invalidSubject = this.#validateSubjectDomainInput(subject);
        if (invalidSubject) {
            return invalidSubject;
        }

        try {
            new ValueObjectString('message_id', externalMessageId);
            new ValueObjectString('thread_id', threadId, true);
            new ValueObjectString('external_identifier', externalMessageId);
            new ValueObjectString('conversation_id', externalMessageId);
            if (sender) {
                new ValueObjectString('sender', sender);
            }
            new ValueObjectJson('to', recipients.to);
            new ValueObjectJson('cc', recipients.cc);
            new ValueObjectJson('bcc', recipients.bcc);
        } catch (error) {
            return ChannelHubInboundEmailProcessingResult.nonRetryable(
                'invalid_domain_input',
                error.message ?? 'Channel Hub payload contains invalid domain-bound input.'
            );
        }

        return null;
    }

    #validateSubjectDomainInput(subject) {
        try {
            new ValueObjectString('subject', subject);
        } catch (error) {
            const code =
                error?.publicErrorCode === SQL_BLACKLIST_WORD_DETECTED
                    ? CHANNEL_HUB_INBOUND_EMAIL_ERROR_CODES.SUBJECT_FORBIDDEN_WORD
                    : 'invalid_domain_input';

            return ChannelHubInboundEmailProcessingResult.nonRetryable(
                code,
                error.message ?? 'Channel Hub subject contains invalid domain-bound input.'
            );
        }

        return null;
    }

    async #prepareEmailBodyRecord({
        emailId,
        externalMessageId,
        connectionId,
        workspaceTag,
        textBodyUrl,
        htmlBodyUrl,
        uploadedBodyKeys,
    }) {
        const bodyDownloads = new Map();
        const textDownload = await this.#downloadBodyOnce(bodyDownloads, textBodyUrl, { kind: 'text' });
        const textFinalUrl = textDownload?.finalUrl ?? textBodyUrl;
        if (!(await this.#allowedConnectionRepository.isAllowedConnection(textFinalUrl))) {
            return {
                error: ChannelHubInboundEmailProcessingResult.nonRetryable(
                    'untrusted_text_body_url',
                    'Plain-text body final URL host is not trusted.'
                ),
            };
        }

        let htmlDownload = null;
        if (htmlBodyUrl) {
            htmlDownload = await this.#downloadBodyOnce(bodyDownloads, htmlBodyUrl, { kind: 'html' });
            const htmlFinalUrl = htmlDownload?.finalUrl ?? htmlBodyUrl;
            if (!(await this.#allowedConnectionRepository.isAllowedConnection(htmlFinalUrl))) {
                return {
                    error: ChannelHubInboundEmailProcessingResult.nonRetryable(
                        'untrusted_html_body_url',
                        'HTML body final URL host is not trusted.'
                    ),
                };
            }
        }

        const textBuffer = bodyBuffer(textDownload);
        const downloadedTextBody = textBuffer.toString('utf8');
        const htmlBuffer = htmlDownload ? bodyBuffer(htmlDownload) : null;
        const downloadedHtmlBody = htmlBuffer ? htmlBuffer.toString('utf8') : null;
        const textLooksHtml = isHtmlContent({
            contentType: textDownload?.contentType,
            body: downloadedTextBody,
            url: textFinalUrl,
        });
        const plainTextBody = textLooksHtml ? stripHtmlToText(downloadedTextBody) : downloadedTextBody;

        const preparedText = await this.#prepareBodyPart({
            emailId,
            part: 'text',
            label: 'Plain-text body',
            content: plainTextBody,
            contentType: textLooksHtml
                ? 'text/plain; charset=utf-8'
                : (textDownload?.contentType ?? 'text/plain; charset=utf-8'),
            uploadedBodyKeys,
        });
        if (preparedText.error) {
            return { error: preparedText.error };
        }

        let preparedHtml = this.#emptyHtmlBodyPart();
        if (htmlBodyUrl) {
            const htmlSource = downloadedHtmlBody ?? downloadedTextBody;
            const rewrittenHtmlBody =
                typeof this.#inlineImageEmbedder?.execute === 'function'
                    ? await this.#inlineImageEmbedder.execute(htmlSource)
                    : htmlSource;

            preparedHtml = await this.#prepareBodyPart({
                emailId,
                part: 'html',
                label: 'HTML body',
                content: rewrittenHtmlBody,
                contentType: htmlDownload?.contentType ?? 'text/html; charset=utf-8',
                uploadedBodyKeys,
            });
            if (preparedHtml.error) {
                return { error: preparedHtml.error };
            }
        }

        const deduplicatedBodyDownload = Boolean(htmlBodyUrl && textBodyUrl === htmlBodyUrl);
        Helper.logDebug('ChannelHubWebhook::bodyStorageDecision', {
            messageId: externalMessageId,
            connectionId,
            tag: workspaceTag,
            text: {
                mode: preparedText.storageMode,
                sizeBytes: preparedText.sizeBytes,
            },
            html: {
                mode: preparedHtml.storageMode,
                sizeBytes: preparedHtml.sizeBytes,
            },
            deduplicatedBodyDownload,
        });

        return {
            bodyRecord: {
                text: preparedText,
                html: preparedHtml,
            },
        };
    }

    async #downloadBodyOnce(downloads, url, { kind }) {
        if (downloads.has(url)) {
            return await downloads.get(url);
        }

        const promise =
            kind === 'html' ? this.#bodyDownloader.download(url, { kind: 'html' }) : this.#bodyDownloader.download(url);
        downloads.set(url, promise);
        return await promise;
    }

    async #prepareBodyPart({ emailId, part, label, content, contentType, uploadedBodyKeys }) {
        const buffer = Buffer.from(content ?? '', 'utf8');
        if (buffer.length > EXTERNAL_EMAIL_BODY_MAX_BYTES) {
            return {
                error: ChannelHubInboundEmailProcessingResult.nonRetryable(
                    part === 'html'
                        ? CHANNEL_HUB_INBOUND_EMAIL_ERROR_CODES.HTML_BODY_TOO_LARGE
                        : CHANNEL_HUB_INBOUND_EMAIL_ERROR_CODES.TEXT_BODY_TOO_LARGE,
                    `${label} exceeds ${EXTERNAL_EMAIL_BODY_MAX_BYTES} bytes (received ${buffer.length})`
                ),
            };
        }

        const base = {
            storageMode: BODY_STORAGE_MODE_INLINE,
            s3Key: null,
            sizeBytes: buffer.length,
            contentType,
            sha256: sha256(buffer),
            previewTruncated: false,
        };

        if (buffer.length <= INLINE_EMAIL_BODY_MAX_BYTES) {
            return {
                ...base,
                body: part === 'text' ? content : null,
                bodyHtml: part === 'html' ? content : null,
            };
        }

        if (!this.#bodyStorage || typeof this.#bodyStorage.upload !== 'function') {
            throw new Error('Channel Hub email body storage dependency is not configured.');
        }

        const stored = await this.#bodyStorage.upload({
            emailId,
            part,
            buffer,
            contentType,
        });
        if (stored?.s3Key) {
            uploadedBodyKeys.push(stored.s3Key);
        }

        const preview =
            part === 'html'
                ? previewFromHtml(content, BODY_PREVIEW_MAX_CHARS)
                : previewFromText(content, BODY_PREVIEW_MAX_CHARS);

        return {
            ...base,
            storageMode: BODY_STORAGE_MODE_EXTERNAL,
            s3Key: stored?.s3Key ?? null,
            contentType: stored?.contentType ?? contentType,
            sizeBytes: stored?.sizeBytes ?? buffer.length,
            sha256: stored?.sha256 ?? base.sha256,
            previewTruncated: true,
            body: part === 'text' ? preview.preview : null,
            bodyHtml: null,
        };
    }

    #emptyHtmlBodyPart() {
        return {
            storageMode: BODY_STORAGE_MODE_INLINE,
            s3Key: null,
            sizeBytes: null,
            contentType: null,
            sha256: null,
            previewTruncated: false,
            body: null,
            bodyHtml: null,
        };
    }

    #normalizeAttachments(value) {
        const attachments = Array.isArray(value) ? value : [];

        return attachments.map((attachment) => {
            if (typeof attachment === 'string') {
                return {
                    url: attachment,
                    filename: null,
                    displayFilename: null,
                    contentType: null,
                    size: null,
                };
            }

            return {
                url: attachment?.url,
                filename: this.#filenameFromPayload(attachment),
                displayFilename: this.#displayFilenameFromPayload(attachment),
                contentType: attachment?.content_type ?? attachment?.contentType ?? null,
                size: Number.isFinite(Number(attachment?.size)) ? Number(attachment.size) : null,
            };
        });
    }

    #filenameFromPayload(attachment) {
        const filename = attachment?.filename ?? attachment?.name ?? attachment?.fileName;
        const normalized = typeof filename === 'string' ? filename.trim() : filename;
        return normalized ? Filename.sanitize(normalized) : null;
    }

    #displayFilenameFromPayload(attachment) {
        const filename = attachment?.filename ?? attachment?.name ?? attachment?.fileName;
        const basename = String(filename ?? '')
            .replace(/\p{Cc}/gu, '')
            .split(/[\\/]/)
            .filter(Boolean)
            .pop();

        return basename?.trim().slice(0, 255) || null;
    }

    async #prepareDurableAttachments({ emailId, attachments, createdAt, createdBy, uploadedAttachmentKeys }) {
        if (!attachments.length) {
            return [];
        }

        if (
            !this.#attachmentDownloader ||
            !this.#attachmentStorage ||
            !this.#fileScanner ||
            !this.#emailAttachmentRepository
        ) {
            throw new Error('Channel Hub attachment processing dependencies are not configured.');
        }

        const durableAttachments = [];

        for (const attachment of attachments) {
            if (!attachment.url) {
                const error = new Error('Attachment URL is required.');
                error.code = 'missing_attachment_url';
                error.nonRetryable = true;
                throw error;
            }

            const download = await this.#attachmentDownloader.download(attachment.url);
            const finalUrl = download?.finalUrl ?? attachment.url;
            if (!(await this.#allowedConnectionRepository.isAllowedConnection(finalUrl))) {
                const error = new Error('Attachment final URL host is not trusted.');
                error.code = 'untrusted_attachment_url';
                error.nonRetryable = true;
                throw error;
            }

            const buffer = Buffer.isBuffer(download?.buffer) ? download.buffer : Buffer.from(download?.buffer ?? '');
            const filename = Filename.sanitize(
                attachment.filename ?? download?.filename ?? this.#filenameFromUrl(finalUrl)
            );
            const contentType = attachment.contentType ?? download?.contentType ?? null;

            const stored = await this.#attachmentStorage.upload({
                emailId,
                buffer,
                contentType,
                filename,
            });
            if (stored?.s3Key) {
                uploadedAttachmentKeys.push(stored.s3Key);
            }

            await this.#scanStoredAttachment(stored, attachment.displayFilename ?? filename);

            durableAttachments.push(
                EmailAttachment.create({
                    id: uuidv4(),
                    email_id: emailId,
                    url: stored.s3Url,
                    size: attachment.size ?? download?.contentLength ?? buffer.length,
                    filename,
                    created_at: createdAt,
                    created_by: createdBy,
                    updated_at: createdAt,
                    updated_by: createdBy,
                })
            );
        }

        return durableAttachments;
    }

    async #scanStoredAttachment(stored, originalFilename) {
        const [baseFolder, folderId, ...fileNameParts] = String(stored?.s3Key ?? '').split('/');
        const fileName = fileNameParts.join('/');
        const scanResult = await this.#fileScanner.execute({
            url: baseFolder,
            id: folderId,
            fileName,
        });

        if (scanResult?.code === S3_FILE_SCAN_ERROR_CODES.ATTACHMENT_ENCRYPTED) {
            const error = new Error(`Attachment cannot be scanned: encrypted PDF '${originalFilename}'`);
            error.code = S3_FILE_SCAN_ERROR_CODES.ATTACHMENT_ENCRYPTED;
            error.nonRetryable = true;
            throw error;
        }

        if (!['File validated successfully', 'Security validation disabled'].includes(scanResult?.message)) {
            throw new Error(`Attachment ${fileName} rejected by security scan.`);
        }
    }

    #filenameFromUrl(url) {
        try {
            const pathname = new URL(url).pathname;
            const candidate = decodeURIComponent(pathname.split('/').filter(Boolean).pop() ?? '');
            return candidate ? Filename.sanitize(extractChannelHubOriginalFilename(candidate)) : null;
        } catch (_error) {
            return null;
        }
    }

    async #cleanupUploadedBodies(uploadedBodyKeys) {
        if (!uploadedBodyKeys.length || typeof this.#bodyStorage?.delete !== 'function') {
            return;
        }

        await Promise.allSettled(
            uploadedBodyKeys.map((s3Key) => {
                return this.#bodyStorage.delete(s3Key);
            })
        );
    }

    async #cleanupUploadedAttachments(uploadedAttachmentKeys) {
        if (!uploadedAttachmentKeys.length || typeof this.#attachmentStorage?.delete !== 'function') {
            return;
        }

        await Promise.allSettled(
            uploadedAttachmentKeys.map((s3Key) => {
                return this.#attachmentStorage.delete(s3Key);
            })
        );
    }

    async #alreadyProcessedResult(email) {
        const interaction = await this.#findInteractionForDuplicateReplay(email.id.value);

        return ChannelHubInboundEmailProcessingResult.alreadyProcessed({
            already_processed: true,
            email_id: email.id.value,
            interaction_id: interaction?.id?.value ?? null,
        });
    }

    async #findInteractionForDuplicateReplay(emailId) {
        try {
            return await this.#interactionRepository.findByEmailId(emailId);
        } catch (_error) {
            return null;
        }
    }

    #isUniqueViolation(error) {
        return error?.code === '23505' || /unique|constraint/i.test(error?.message ?? '');
    }

    async #persistAtomically({
        emailId,
        now,
        createdBy,
        externalMessageId,
        threadId,
        workspaceId,
        sender,
        recipients,
        bodyRecord,
        subject,
        receivedAt,
        channelHubAccount,
        attachments = [],
    }) {
        const connection = this.#emailRepository.connection;

        const email = Email.create({
            id: emailId,
            s3_key: `channel-hub/inbound/${emailId}`,
            subject,
            sender,
            to: recipients.to,
            cc: recipients.cc,
            bcc: recipients.bcc,
            priority: DEFAULT_PRIORITY,
            workspace_id: workspaceId,
            message_id: externalMessageId,
            thread_id: threadId,
            account_id: channelHubAccount.id.value,
            received_at: receivedAt,
            created_at: now,
            created_by: createdBy,
            updated_at: now,
            updated_by: createdBy,
        });

        const emailBody = EmailBody.create({
            id: uuidv4(),
            email_id: emailId,
            body: bodyRecord.text.body,
            body_html: bodyRecord.html.bodyHtml,
            body_text_storage_mode: bodyRecord.text.storageMode,
            body_text_s3_key: bodyRecord.text.s3Key,
            body_text_size_bytes: bodyRecord.text.sizeBytes,
            body_text_content_type: bodyRecord.text.contentType,
            body_text_sha256: bodyRecord.text.sha256,
            body_text_preview_truncated: bodyRecord.text.previewTruncated,
            body_html_storage_mode: bodyRecord.html.storageMode,
            body_html_s3_key: bodyRecord.html.s3Key,
            body_html_size_bytes: bodyRecord.html.sizeBytes,
            body_html_content_type: bodyRecord.html.contentType,
            body_html_sha256: bodyRecord.html.sha256,
            body_html_preview_truncated: bodyRecord.html.previewTruncated,
            created_at: now,
            created_by: createdBy,
            updated_at: now,
            updated_by: createdBy,
        });

        const interaction = Interaction.create({
            id: uuidv4(),
            channel_id: EMAIL_CHANNEL_ID,
            client_identifier: sender,
            external_identifier: externalMessageId,
            description: subject,
            priority: DEFAULT_PRIORITY,
            workspace_id: workspaceId,
            email_id: emailId,
            start_review_at: null,
            start_review_by: null,
            conversation_id: externalMessageId,
            receipt_at: receivedAt,
            closed_at: null,
            closed_by: null,
            is_closed: false,
            in_review: false,
            created_at: now,
            created_by: createdBy,
            updated_at: now,
            updated_by: createdBy,
        });

        await connection.transaction(async (trx) => {
            await this.#emailRepository.trxTable(trx).insert({
                id: email.id.value,
                s3_key: email.s3_key.value,
                subject: email.subject.value,
                sender: email.sender.value,
                to: JSON.stringify(email.to.value),
                cc: JSON.stringify(email.cc.value),
                bcc: JSON.stringify(email.bcc.value),
                priority: email.priority.value,
                workspace_id: email.workspace_id.value,
                message_id: email.message_id.value,
                thread_id: email.thread_id.value,
                account_id: email.account_id.value,
                received_at: email.received_at.value,
                created_at: email.created_at.value,
                created_by: email.created_by.value,
                updated_at: email.updated_at.value,
                updated_by: email.updated_by.value,
                deleted_at: email.deleted_at.value,
                deleted_by: email.deleted_by.value,
            });

            await this.#emailBodyRepository.trxTable(trx).insert({
                id: emailBody.id.value,
                email_id: emailBody.email_id.value,
                body: emailBody.body.value,
                body_html: emailBody.body_html.value,
                body_text_storage_mode: emailBody.body_text_storage_mode.value,
                body_text_s3_key: emailBody.body_text_s3_key.value,
                body_text_size_bytes: emailBody.body_text_size_bytes.value,
                body_text_content_type: emailBody.body_text_content_type.value,
                body_text_sha256: emailBody.body_text_sha256.value,
                body_text_preview_truncated: emailBody.body_text_preview_truncated.value,
                body_html_storage_mode: emailBody.body_html_storage_mode.value,
                body_html_s3_key: emailBody.body_html_s3_key.value,
                body_html_size_bytes: emailBody.body_html_size_bytes.value,
                body_html_content_type: emailBody.body_html_content_type.value,
                body_html_sha256: emailBody.body_html_sha256.value,
                body_html_preview_truncated: emailBody.body_html_preview_truncated.value,
                created_at: emailBody.created_at.value,
                created_by: emailBody.created_by.value,
                updated_at: emailBody.updated_at.value,
                updated_by: emailBody.updated_by.value,
                deleted_at: emailBody.deleted_at.value,
                deleted_by: emailBody.deleted_by.value,
            });

            for (const attachment of attachments) {
                await this.#emailAttachmentRepository.trxTable(trx).insert({
                    id: attachment.id.value,
                    email_id: attachment.email_id.value,
                    url: attachment.url.value,
                    size: attachment.size.value,
                    filename: attachment.filename.value,
                    created_at: attachment.created_at.value,
                    created_by: attachment.created_by.value,
                    updated_at: attachment.updated_at.value,
                    updated_by: attachment.updated_by.value,
                    deleted_at: attachment.deleted_at.value,
                    deleted_by: attachment.deleted_by.value,
                });
            }

            await this.#interactionRepository.trxTable(trx).insert({
                id: interaction.id.value,
                channel_id: interaction.channel_id.value,
                client_identifier: interaction.client_identifier.value,
                external_identifier: interaction.external_identifier.value,
                description: interaction.description.value,
                priority: interaction.priority.value,
                workspace_id: interaction.workspace_id.value,
                email_id: interaction.email_id.value,
                start_review_at: interaction.start_review_at.value,
                start_review_by: interaction.start_review_by.value,
                conversation_id: interaction.conversation_id.value,
                receipt_at: interaction.receipt_at.value,
                closed_at: interaction.closed_at.value,
                closed_by: interaction.closed_by.value,
                is_closed: interaction.is_closed.value,
                in_review: interaction.in_review.value,
                created_by: interaction.created_by.value,
                created_at: interaction.created_at.value,
                updated_by: interaction.updated_by.value,
                updated_at: interaction.updated_at.value,
                deleted_by: interaction.deleted_by.value,
                deleted_at: interaction.deleted_at.value,
            });
        });

        return {
            email_id: emailId,
            interaction_id: interaction.id.value,
        };
    }
}
