import { jest } from '@jest/globals';
import JSZip from 'jszip';
import { v4 as uuidV4 } from 'uuid';

const send = jest.fn();
const getSignedUrl = jest.fn();
const getObjectCommands = [];
const putObjectCommands = [];

class FakeS3Client {
    constructor(config) {
        this.config = config;
    }

    send(command) {
        return send(command);
    }
}

class FakeGetObjectCommand {
    constructor(input) {
        this.input = input;
        getObjectCommands.push(input);
    }
}

class FakePutObjectCommand {
    constructor(input) {
        this.input = input;
        putObjectCommands.push(input);
    }
}

jest.unstable_mockModule('@aws-sdk/client-s3', () => ({
    S3Client: FakeS3Client,
    GetObjectCommand: FakeGetObjectCommand,
    PutObjectCommand: FakePutObjectCommand,
}));

jest.unstable_mockModule('@aws-sdk/s3-request-presigner', () => ({
    getSignedUrl,
}));

const { EmailZipGenerator } = await import('../../src/emails/application/download/EmailZipGenerator.js');
const { Email } = await import('../../src/emails/domain/Email.js');
const { EmailBody } = await import('../../src/emails/domain/EmailBody.js');
const { EmailAttachment } = await import('../../src/emails/domain/EmailAttachments.js');

const createdAt = '2026-05-29T10:00:00.000Z';

const createEmail = (overrides = {}) =>
    Email.create({
        id: overrides.id ?? uuidV4(),
        s3_key: 'https://tenant-bucket.s3.amazonaws.com/emails/source.eml',
        subject: 'Critical alert',
        sender: 'sender@example.com',
        to: [{ email: 'agent@example.com' }],
        cc: [],
        bcc: [],
        priority: 'normal',
        workspace_id: uuidV4(),
        message_id: 'provider-message-id',
        account_id: uuidV4(),
        received_at: createdAt,
        created_at: createdAt,
        created_by: uuidV4(),
        updated_at: null,
        updated_by: null,
        ...overrides,
    });

const createEmailBody = ({ emailId, ...overrides }) =>
    EmailBody.create({
        id: uuidV4(),
        email_id: emailId,
        body: 'Plain body',
        body_html: '<p>HTML body</p>',
        created_at: createdAt,
        created_by: uuidV4(),
        updated_at: null,
        updated_by: null,
        ...overrides,
    });

const createAttachment = ({ emailId, ...overrides }) =>
    EmailAttachment.create({
        id: uuidV4(),
        email_id: emailId,
        url: `https://tenant-bucket.s3.amazonaws.com/attachments/${emailId}/uuid_invoice.pdf`,
        size: 7,
        filename: 'invoice.pdf',
        created_at: createdAt,
        created_by: uuidV4(),
        updated_at: null,
        updated_by: null,
        ...overrides,
    });

describe('EmailZipGenerator', () => {
    beforeEach(() => {
        send.mockReset();
        getSignedUrl.mockReset();
        getObjectCommands.length = 0;
        putObjectCommands.length = 0;
        process.env.AWS_S3_REGION = 'us-east-1';
        process.env.AWS_S3_ACCESS_KEY_ID = 'access-key';
        process.env.AWS_S3_SECRET_ACCESS_KEY = 'secret-key';
        process.env.AWS_S3_BUCKET = 'tenant-bucket';
    });

    it('includes metadata, body, and attachments in the generated Email ZIP', async () => {
        const emailId = uuidV4();
        const email = createEmail({ id: emailId });
        const emailBody = createEmailBody({ emailId });
        const attachment = createAttachment({ emailId });

        send.mockImplementation((command) => {
            if (command instanceof FakeGetObjectCommand) {
                return Promise.resolve({ Body: Buffer.from('invoice') });
            }

            return Promise.resolve({});
        });
        getSignedUrl.mockResolvedValue('https://signed.example/email.zip');

        const generator = new EmailZipGenerator({
            emailRepository: {
                find: jest.fn().mockResolvedValue(email),
            },
            emailBodyRepository: {
                find: jest.fn().mockResolvedValue(emailBody),
            },
            attachmentsRepository: {
                findAllByEmailId: jest.fn().mockResolvedValue([attachment]),
            },
            s3Storage: {},
        });

        const result = await generator.execute(emailId);

        expect(result).toEqual({ download_url: 'https://signed.example/email.zip' });
        expect(getObjectCommands[0]).toEqual({
            Bucket: 'tenant-bucket',
            Key: `attachments/${emailId}/uuid_invoice.pdf`,
        });
        expect(putObjectCommands[0]).toMatchObject({
            Bucket: 'tenant-bucket',
            ContentType: 'application/zip',
        });

        const zip = await JSZip.loadAsync(putObjectCommands[0].Body);

        await expect(zip.file('body.html').async('string')).resolves.toBe('<p>HTML body</p>');
        await expect(zip.file('attachments/invoice.pdf').async('string')).resolves.toBe('invoice');

        const metadata = JSON.parse(await zip.file('metadata.json').async('string'));
        expect(metadata).toMatchObject({
            subject: 'Critical alert',
            sender: 'sender@example.com',
            channel_hub_message_id: 'provider-message-id',
        });
    });

    it('includes the plain-text body when an email has no HTML body', async () => {
        const emailId = uuidV4();
        const email = createEmail({ id: emailId });
        const emailBody = createEmailBody({
            emailId,
            body: 'Plain-only body\nSecond line',
            body_html: null,
        });

        send.mockResolvedValue({});
        getSignedUrl.mockResolvedValue('https://signed.example/email.zip');

        const generator = new EmailZipGenerator({
            emailRepository: {
                find: jest.fn().mockResolvedValue(email),
            },
            emailBodyRepository: {
                find: jest.fn().mockResolvedValue(emailBody),
            },
            attachmentsRepository: {
                findAllByEmailId: jest.fn().mockResolvedValue([]),
            },
            s3Storage: {},
        });

        await generator.execute(emailId);

        const zip = await JSZip.loadAsync(putObjectCommands[0].Body);

        await expect(zip.file('body.html').async('string')).resolves.toBe('');
        expect(zip.file('body.txt')).not.toBeNull();
        await expect(zip.file('body.txt').async('string')).resolves.toBe('Plain-only body\nSecond line');
    });

    it('resolves path-style S3 urls that embed the bucket name in the path', async () => {
        const emailId = uuidV4();
        const email = createEmail({ id: emailId });
        const emailBody = createEmailBody({ emailId });
        const attachment = createAttachment({
            emailId,
            url: `https://s3.amazonaws.com/tenant-bucket/uploads/${emailId}/report.pdf`,
            filename: 'report.pdf',
        });

        send.mockImplementation((command) => {
            if (command instanceof FakeGetObjectCommand) {
                return Promise.resolve({ Body: Buffer.from('report-bytes') });
            }

            return Promise.resolve({});
        });
        getSignedUrl.mockResolvedValue('https://signed.example/email.zip');

        const generator = new EmailZipGenerator({
            emailRepository: { find: jest.fn().mockResolvedValue(email) },
            emailBodyRepository: { find: jest.fn().mockResolvedValue(emailBody) },
            attachmentsRepository: { findAllByEmailId: jest.fn().mockResolvedValue([attachment]) },
            s3Storage: {},
        });

        await generator.execute(emailId);

        expect(getObjectCommands[0]).toEqual({
            Bucket: 'tenant-bucket',
            Key: `uploads/${emailId}/report.pdf`,
        });
    });

    it('reads attachment bodies for every response shape the S3 SDK can hand back', async () => {
        const emailId = uuidV4();
        const email = createEmail({ id: emailId });
        const emailBody = createEmailBody({ emailId });

        const missingBodyAttachment = createAttachment({
            emailId,
            filename: 'missing-body.txt',
            url: `https://tenant-bucket.s3.amazonaws.com/attachments/${emailId}/missing-body.txt`,
        });
        const uint8ArrayAttachment = createAttachment({
            emailId,
            filename: 'uint8array-body.txt',
            url: `https://tenant-bucket.s3.amazonaws.com/attachments/${emailId}/uint8array-body.txt`,
        });
        const byteArrayAttachment = createAttachment({
            emailId,
            filename: 'byte-array-body.txt',
            url: `https://tenant-bucket.s3.amazonaws.com/attachments/${emailId}/byte-array-body.txt`,
        });
        const stringAttachment = createAttachment({
            emailId,
            filename: 'string-body.txt',
            url: `https://tenant-bucket.s3.amazonaws.com/attachments/${emailId}/string-body.txt`,
        });
        const iterableAttachment = createAttachment({
            emailId,
            filename: 'iterable-body.txt',
            url: `https://tenant-bucket.s3.amazonaws.com/attachments/${emailId}/iterable-body.txt`,
        });

        const bodiesByKey = {
            [`attachments/${emailId}/missing-body.txt`]: undefined,
            [`attachments/${emailId}/uint8array-body.txt`]: new TextEncoder().encode('uint8-content'),
            [`attachments/${emailId}/byte-array-body.txt`]: {
                transformToByteArray: async () => new TextEncoder().encode('byte-array-content'),
            },
            [`attachments/${emailId}/string-body.txt`]: { transformToString: async () => 'string-content' },
            [`attachments/${emailId}/iterable-body.txt`]: {
                [Symbol.asyncIterator]: async function* () {
                    yield Buffer.from('chunk-one-');
                    yield 'chunk-two';
                },
            },
        };

        send.mockImplementation((command) => {
            if (command instanceof FakeGetObjectCommand) {
                return Promise.resolve({ Body: bodiesByKey[command.input.Key] });
            }

            return Promise.resolve({});
        });
        getSignedUrl.mockResolvedValue('https://signed.example/email.zip');

        const generator = new EmailZipGenerator({
            emailRepository: { find: jest.fn().mockResolvedValue(email) },
            emailBodyRepository: { find: jest.fn().mockResolvedValue(emailBody) },
            attachmentsRepository: {
                findAllByEmailId: jest
                    .fn()
                    .mockResolvedValue([
                        missingBodyAttachment,
                        uint8ArrayAttachment,
                        byteArrayAttachment,
                        stringAttachment,
                        iterableAttachment,
                    ]),
            },
            s3Storage: {},
        });

        await generator.execute(emailId);

        const zip = await JSZip.loadAsync(putObjectCommands[0].Body);

        await expect(zip.file('attachments/missing-body.txt').async('string')).resolves.toBe('');
        await expect(zip.file('attachments/uint8array-body.txt').async('string')).resolves.toBe('uint8-content');
        await expect(zip.file('attachments/byte-array-body.txt').async('string')).resolves.toBe('byte-array-content');
        await expect(zip.file('attachments/string-body.txt').async('string')).resolves.toBe('string-content');
        await expect(zip.file('attachments/iterable-body.txt').async('string')).resolves.toBe('chunk-one-chunk-two');
    });

    it('sanitizes attachment filenames, falls back to a generated name, and de-duplicates collisions', async () => {
        const emailId = uuidV4();
        const email = createEmail({ id: emailId });
        const emailBody = createEmailBody({ emailId });

        const noFilenameAttachment = createAttachment({
            emailId,
            filename: null,
            url: `https://tenant-bucket.s3.amazonaws.com/attachments/${emailId}/fallback-source.txt`,
        });
        const symbolsOnlyAttachment = createAttachment({
            emailId,
            filename: '***',
            url: `https://tenant-bucket.s3.amazonaws.com/attachments/${emailId}/symbols-only.bin`,
        });
        const slashesOnlyAttachment = createAttachment({
            emailId,
            filename: '///',
            url: `https://tenant-bucket.s3.amazonaws.com/attachments/${emailId}/slashes-only.bin`,
        });
        const longName = `${'a'.repeat(260)}.txt`;
        const longFilenameAttachment = createAttachment({
            emailId,
            filename: longName,
            url: `https://tenant-bucket.s3.amazonaws.com/attachments/${emailId}/long-name.txt`,
        });
        const longNameNoExtension = 'b'.repeat(300);
        const longFilenameNoExtensionAttachment = createAttachment({
            emailId,
            filename: longNameNoExtension,
            url: `https://tenant-bucket.s3.amazonaws.com/attachments/${emailId}/long-name-no-ext`,
        });
        const duplicateWithExtA = createAttachment({
            emailId,
            filename: 'invoice.pdf',
            url: `https://tenant-bucket.s3.amazonaws.com/attachments/${emailId}/dup-a.pdf`,
        });
        const duplicateWithExtB = createAttachment({
            emailId,
            filename: 'invoice.pdf',
            url: `https://tenant-bucket.s3.amazonaws.com/attachments/${emailId}/dup-b.pdf`,
        });
        const duplicateNoExtA = createAttachment({
            emailId,
            filename: 'readme',
            url: `https://tenant-bucket.s3.amazonaws.com/attachments/${emailId}/dup-c`,
        });
        const duplicateNoExtB = createAttachment({
            emailId,
            filename: 'readme',
            url: `https://tenant-bucket.s3.amazonaws.com/attachments/${emailId}/dup-d`,
        });
        const duplicateWithExtC = createAttachment({
            emailId,
            filename: 'invoice.pdf',
            url: `https://tenant-bucket.s3.amazonaws.com/attachments/${emailId}/dup-e.pdf`,
        });

        send.mockResolvedValue({ Body: Buffer.from('x') });
        getSignedUrl.mockResolvedValue('https://signed.example/email.zip');

        const generator = new EmailZipGenerator({
            emailRepository: { find: jest.fn().mockResolvedValue(email) },
            emailBodyRepository: { find: jest.fn().mockResolvedValue(emailBody) },
            attachmentsRepository: {
                findAllByEmailId: jest
                    .fn()
                    .mockResolvedValue([
                        noFilenameAttachment,
                        symbolsOnlyAttachment,
                        slashesOnlyAttachment,
                        longFilenameAttachment,
                        longFilenameNoExtensionAttachment,
                        duplicateWithExtA,
                        duplicateWithExtB,
                        duplicateNoExtA,
                        duplicateNoExtB,
                        duplicateWithExtC,
                    ]),
            },
            s3Storage: {},
        });

        await generator.execute(emailId);

        const zip = await JSZip.loadAsync(putObjectCommands[0].Body);
        const names = Object.keys(zip.files).filter((name) => name.startsWith('attachments/'));

        expect(names).toContain('attachments/fallback-source.txt');
        expect(names).toContain('attachments/attachment-2');
        expect(names).toContain('attachments/attachment-3');
        expect(names).toContain(`attachments/${'a'.repeat(251)}.txt`);
        expect(names).toContain(`attachments/${'b'.repeat(255)}`);
        expect(names).toContain('attachments/invoice.pdf');
        expect(names).toContain('attachments/invoice-2.pdf');
        expect(names).toContain('attachments/readme');
        expect(names).toContain('attachments/readme-2');
        expect(names).toContain('attachments/invoice-3.pdf');
    });

    it('falls back to the raw attachment url when it cannot be parsed as a URL', async () => {
        const emailId = uuidV4();
        const email = createEmail({ id: emailId });
        const emailBody = createEmailBody({ emailId });
        const attachment = createAttachment({
            emailId,
            filename: 'note.txt',
            url: 'not a valid url /attachments/note.txt',
        });

        send.mockResolvedValue({ Body: Buffer.from('note-bytes') });
        getSignedUrl.mockResolvedValue('https://signed.example/email.zip');

        const generator = new EmailZipGenerator({
            emailRepository: { find: jest.fn().mockResolvedValue(email) },
            emailBodyRepository: { find: jest.fn().mockResolvedValue(emailBody) },
            attachmentsRepository: { findAllByEmailId: jest.fn().mockResolvedValue([attachment]) },
            s3Storage: {},
        });

        await generator.execute(emailId);

        expect(getObjectCommands[0]).toEqual({
            Bucket: 'tenant-bucket',
            Key: 'not a valid url /attachments/note.txt',
        });
    });

    it('keeps a path segment as-is when it is not valid percent-encoding', async () => {
        const emailId = uuidV4();
        const email = createEmail({ id: emailId });
        const emailBody = createEmailBody({ emailId });
        const attachment = createAttachment({
            emailId,
            filename: 'broken-encoding.txt',
            url: `https://tenant-bucket.s3.amazonaws.com/attachments/${emailId}/%E0%A4%A-broken`,
        });

        send.mockResolvedValue({ Body: Buffer.from('bytes') });
        getSignedUrl.mockResolvedValue('https://signed.example/email.zip');

        const generator = new EmailZipGenerator({
            emailRepository: { find: jest.fn().mockResolvedValue(email) },
            emailBodyRepository: { find: jest.fn().mockResolvedValue(emailBody) },
            attachmentsRepository: { findAllByEmailId: jest.fn().mockResolvedValue([attachment]) },
            s3Storage: {},
        });

        await generator.execute(emailId);

        expect(getObjectCommands[0]).toEqual({
            Bucket: 'tenant-bucket',
            Key: `attachments/${emailId}/%E0%A4%A-broken`,
        });
    });
});
