import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import JSZip from 'jszip';
import { EmailFinder } from '../find/EmailFinder.js';
import { EmailBodyContentReader } from '../body/EmailBodyContentReader.js';
import { TenantContext } from '../../../shared/index.js';

const PRESIGNED_URL_TTL = 300;

const hasContent = (content) => String(content ?? '').trim().length > 0;

const decodePathSegment = (segment) => {
    try {
        return decodeURIComponent(segment);
    } catch {
        return segment;
    }
};

const getS3ObjectKeyFromUrl = (attachmentUrl, bucket) => {
    if (!attachmentUrl) {
        throw new Error('missing_attachment_url');
    }

    try {
        const parsedUrl = new URL(attachmentUrl);
        const keyParts = parsedUrl.pathname.split('/').filter(Boolean).map(decodePathSegment);

        if (parsedUrl.hostname === 's3.amazonaws.com' && keyParts[0] === bucket) {
            return keyParts.slice(1).join('/');
        }

        return keyParts.join('/');
    } catch {
        return String(attachmentUrl).replace(/^\/+/, '');
    }
};

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

const sanitizeZipFilename = (value, fallback) => {
    const basename =
        String(value ?? '')
            .replace(/[\u0000-\u001f\u007f]/g, '')
            .split(/[\\/]/)
            .filter(Boolean)
            .pop() ?? '';
    const sanitized = basename
        .trim()
        .replace(/^[.\s]+|[.\s]+$/g, '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[+&=% ]/g, '-')
        .replace(/[^a-zA-Z0-9.\-_]/g, '')
        .toLowerCase()
        .replace(/^[.\s]+|[.\s]+$/g, '');

    if (!sanitized) return fallback;
    if (sanitized.length <= 255) return sanitized;

    const extension = sanitized.match(/(\.[a-z0-9]{1,20})$/)?.[1] ?? '';
    const baseMaxLength = Math.max(255 - extension.length, 1);
    return `${sanitized.slice(0, baseMaxLength)}${extension}`;
};

const makeUniqueZipFilename = (filename, usedNames) => {
    if (!usedNames.has(filename)) {
        usedNames.add(filename);
        return filename;
    }

    const extension = filename.match(/(\.[a-z0-9]{1,20})$/)?.[1] ?? '';
    const base = extension ? filename.slice(0, -extension.length) : filename;
    let suffix = 2;

    while (usedNames.has(`${base}-${suffix}${extension}`)) {
        suffix += 1;
    }

    const uniqueName = `${base}-${suffix}${extension}`;
    usedNames.add(uniqueName);
    return uniqueName;
};

export class EmailZipGenerator {
    #emailFinder;
    #emailBodyContentReader;
    #s3Client;
    #bucket;

    constructor({ emailRepository, emailBodyRepository, attachmentsRepository, s3Storage }) {
        this.#emailFinder = new EmailFinder(emailRepository, emailBodyRepository, attachmentsRepository);
        this.#emailBodyContentReader = new EmailBodyContentReader({
            emailRepository,
            emailBodyRepository,
            bodyStorage: s3Storage,
        });

        const tenant = TenantContext.getTenant?.();
        const region = tenant?.aws_s3_region?.value ?? process.env.AWS_S3_REGION;
        const credentials = {
            accessKeyId: tenant?.aws_s3_access_key_id?.value ?? process.env.AWS_S3_ACCESS_KEY_ID,
            secretAccessKey: tenant?.aws_s3_secret_access_key?.value ?? process.env.AWS_S3_SECRET_ACCESS_KEY,
        };

        this.#s3Client = new S3Client({ region, credentials });
        this.#bucket = tenant?.aws_s3_bucket?.value ?? process.env.BUCKET ?? process.env.AWS_S3_BUCKET;
    }

    async execute(emailId) {
        const emailResponse = await this.#emailFinder.execute(emailId);
        const { data: emailData } = emailResponse.toJson();

        const bodyResult = await this.#emailBodyContentReader.execute({ emailId, part: 'html' });
        const htmlContent = bodyResult?.content ?? '';
        const textContent = !hasContent(htmlContent)
            ? ((await this.#emailBodyContentReader.execute({ emailId, part: 'text' }))?.content ?? '')
            : '';
        const attachments = emailData.attachments ?? [];

        const metadata = {
            subject: emailData.subject,
            sender: emailData.sender,
            to: emailData.to,
            cc: emailData.cc,
            bcc: emailData.bcc,
            received_at: emailData.received_at,
            channel_hub_message_id: emailData.message_id,
        };

        const zip = new JSZip();
        zip.file('metadata.json', JSON.stringify(metadata, null, 2));
        zip.file('body.html', htmlContent);
        if (hasContent(textContent)) {
            zip.file('body.txt', textContent);
        }

        const usedAttachmentNames = new Set();
        for (const [index, attachment] of attachments.entries()) {
            const key = getS3ObjectKeyFromUrl(attachment.url, this.#bucket);
            const attachmentResponse = await this.#s3Client.send(
                new GetObjectCommand({ Bucket: this.#bucket, Key: key })
            );
            const attachmentBody = await streamToBuffer(attachmentResponse.Body);
            const displayName = sanitizeZipFilename(
                attachment.filename || key.split('/').pop(),
                `attachment-${index + 1}`
            );
            const zipName = makeUniqueZipFilename(displayName, usedAttachmentNames);

            zip.file(`attachments/${zipName}`, attachmentBody);
        }

        const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });

        const timestamp = Date.now();
        const key = `email-downloads/${emailId}/${timestamp}.zip`;

        await this.#s3Client.send(
            new PutObjectCommand({
                Bucket: this.#bucket,
                Key: key,
                Body: zipBuffer,
                ContentType: 'application/zip',
            })
        );

        const downloadUrl = await getSignedUrl(
            this.#s3Client,
            new GetObjectCommand({ Bucket: this.#bucket, Key: key }),
            { expiresIn: PRESIGNED_URL_TTL }
        );

        return { download_url: downloadUrl };
    }
}
