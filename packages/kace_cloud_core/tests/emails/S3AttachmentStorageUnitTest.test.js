import { jest } from '@jest/globals';

const send = jest.fn().mockResolvedValue({});
const createdClients = [];
const putObjectCommands = [];
const deleteObjectCommands = [];
const headObjectCommands = [];

class FakeHeadObjectCommand {
    constructor(input) {
        this.input = input;
        headObjectCommands.push(input);
    }
}

class FakeS3Client {
    constructor(config) {
        this.config = config;
        createdClients.push(this);
    }

    send(command) {
        return send(command);
    }
}

class FakePutObjectCommand {
    constructor(input) {
        this.input = input;
        putObjectCommands.push(input);
    }
}

class FakeDeleteObjectCommand {
    constructor(input) {
        this.input = input;
        deleteObjectCommands.push(input);
    }
}

jest.unstable_mockModule('@aws-sdk/client-s3', () => ({
    S3Client: FakeS3Client,
    PutObjectCommand: FakePutObjectCommand,
    DeleteObjectCommand: FakeDeleteObjectCommand,
    GetObjectCommand: class {},
    HeadObjectCommand: FakeHeadObjectCommand,
}));

const { S3AttachmentStorage } = await import('../../src/emails/infrastructure/persistence/S3AttachmentStorage.js');
const { TenantContext } = await import('../../src/shared/index.js');

function tenant() {
    return {
        id: { value: 'tenant-id' },
        aws_s3_region: { value: 'tenant-region' },
        aws_s3_access_key_id: { value: 'tenant-access-key' },
        aws_s3_secret_access_key: { value: 'tenant-secret-key' },
        aws_s3_bucket: { value: 'tenant-bucket' },
    };
}

describe('S3AttachmentStorage', () => {
    beforeEach(() => {
        send.mockClear();
        createdClients.length = 0;
        putObjectCommands.length = 0;
        deleteObjectCommands.length = 0;
        headObjectCommands.length = 0;
    });

    it('uses tenant S3 configuration for uploads and returned URLs', async () => {
        await TenantContext.run(tenant(), async () => {
            const storage = new S3AttachmentStorage();

            const result = await storage.upload({
                emailId: 'email-id',
                buffer: Buffer.from('file'),
                contentType: 'application/pdf',
                filename: 'invoice.pdf',
            });

            expect(createdClients[0].config).toEqual({
                region: 'tenant-region',
                credentials: {
                    accessKeyId: 'tenant-access-key',
                    secretAccessKey: 'tenant-secret-key',
                },
            });
            expect(putObjectCommands[0]).toMatchObject({
                Bucket: 'tenant-bucket',
                Body: Buffer.from('file'),
                ContentType: 'application/pdf',
            });
            expect(result.s3Url).toContain('https://tenant-bucket.s3.amazonaws.com/');
        });
    });

    it('keeps the stored S3 object basename within 255 characters while preserving the extension', async () => {
        await TenantContext.run(tenant(), async () => {
            const storage = new S3AttachmentStorage();
            const longFilename = `${'a'.repeat(260)}.png`;

            const result = await storage.upload({
                emailId: 'email-id',
                buffer: Buffer.from('file'),
                contentType: 'image/png',
                filename: longFilename,
            });

            const storedBasename = result.s3Key.split('/').pop();

            expect(storedBasename).toHaveLength(255);
            expect(storedBasename).toMatch(/^[0-9a-f-]{36}_/);
            expect(storedBasename.endsWith('.png')).toBe(true);
            expect(putObjectCommands[0].Key).toBe(result.s3Key);
        });
    });

    it('uses the same tenant bucket when deleting orphan uploaded attachments', async () => {
        await TenantContext.run(tenant(), async () => {
            const storage = new S3AttachmentStorage();

            await storage.delete('attachments/email-id/invoice.pdf');

            expect(deleteObjectCommands[0]).toEqual({
                Bucket: 'tenant-bucket',
                Key: 'attachments/email-id/invoice.pdf',
            });
        });
    });

    describe('head', () => {
        it('returns size and contentType from HeadObject response', async () => {
            send.mockResolvedValueOnce({ ContentLength: 2432353, ContentType: 'application/pdf' });
            const storage = new S3AttachmentStorage({ bucket: 'tenant-bucket', region: 'r', credentials: {} });

            const result = await storage.head('attachments/abc/file.pdf');

            expect(headObjectCommands).toEqual([{ Bucket: 'tenant-bucket', Key: 'attachments/abc/file.pdf' }]);
            expect(result).toEqual({ size: 2432353, contentType: 'application/pdf' });
        });

        it('defaults size 0 and null contentType when response lacks metadata', async () => {
            send.mockResolvedValueOnce({});
            const storage = new S3AttachmentStorage({ bucket: 'tenant-bucket', region: 'r', credentials: {} });

            const result = await storage.head('attachments/abc/file.pdf');

            expect(result).toEqual({ size: 0, contentType: null });
        });

        it('propagates S3 errors (NotFound)', async () => {
            send.mockRejectedValueOnce(new Error('NotFound'));
            const storage = new S3AttachmentStorage({ bucket: 'tenant-bucket', region: 'r', credentials: {} });

            await expect(storage.head('attachments/abc/missing.pdf')).rejects.toThrow('NotFound');
        });
    });
});
