import { jest } from '@jest/globals';

const send = jest.fn();
const createdClients = [];
const getObjectCommands = [];

class FakeS3Client {
    constructor(config) {
        this.config = config;
        createdClients.push(this);
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

jest.unstable_mockModule('@aws-sdk/client-s3', () => ({
    S3Client: FakeS3Client,
    GetObjectCommand: FakeGetObjectCommand,
    PutObjectCommand: class {},
    DeleteObjectCommand: class {},
    HeadObjectCommand: class {},
}));

const { S3TemplateAttachmentReader } =
    await import('../../../src/template-attachments/infrastructure/S3TemplateAttachmentReader.js');
const { TenantContext } = await import('../../../src/shared/index.js');

function tenant() {
    return {
        id: { value: 'tenant-id' },
        aws_s3_region: { value: 'tenant-region' },
        aws_s3_access_key_id: { value: 'tenant-access-key' },
        aws_s3_secret_access_key: { value: 'tenant-secret-key' },
        aws_s3_bucket: { value: 'tenant-bucket' },
    };
}

describe('S3TemplateAttachmentReader', () => {
    beforeEach(() => {
        send.mockReset();
        createdClients.length = 0;
        getObjectCommands.length = 0;
    });

    it('reads the object using the template/{templateId}/{filename} key with tenant credentials', async () => {
        send.mockResolvedValue({
            ContentType: 'image/png',
            Body: Buffer.from('image-bytes'),
        });

        await TenantContext.run(tenant(), async () => {
            const reader = new S3TemplateAttachmentReader();

            const result = await reader.read({ templateId: 'template-id', filename: 'logo.png' });

            expect(createdClients[0].config).toEqual({
                region: 'tenant-region',
                credentials: {
                    accessKeyId: 'tenant-access-key',
                    secretAccessKey: 'tenant-secret-key',
                },
            });
            expect(getObjectCommands[0]).toEqual({
                Bucket: 'tenant-bucket',
                Key: 'template/template-id/logo.png',
            });
            expect(result).toEqual({
                filename: 'logo.png',
                contentType: 'image/png',
                content: Buffer.from('image-bytes'),
            });
        });
    });

    it('rejects filenames containing a path separator instead of building a traversable S3 key', async () => {
        await TenantContext.run(tenant(), async () => {
            const reader = new S3TemplateAttachmentReader();

            await expect(
                reader.read({ templateId: 'template-id', filename: '../other-template-id/secret.png' })
            ).rejects.toThrow('Invalid template attachment filename');
            expect(send).not.toHaveBeenCalled();
        });
    });

    it('rejects a bare ".." filename', async () => {
        await TenantContext.run(tenant(), async () => {
            const reader = new S3TemplateAttachmentReader();

            await expect(reader.read({ templateId: 'template-id', filename: '..' })).rejects.toThrow(
                'Invalid template attachment filename'
            );
            expect(send).not.toHaveBeenCalled();
        });
    });

    it('falls back to application/octet-stream when neither the caller nor S3 provide a content type', async () => {
        send.mockResolvedValue({ Body: Buffer.from('bytes') });

        await TenantContext.run(tenant(), async () => {
            const reader = new S3TemplateAttachmentReader();
            const result = await reader.read({ templateId: 'template-id', filename: 'file.bin' });

            expect(result.contentType).toBe('application/octet-stream');
        });
    });

    it('prefers the explicit contentType argument over the S3 response header', async () => {
        send.mockResolvedValue({ ContentType: 'image/gif', Body: Buffer.from('bytes') });

        await TenantContext.run(tenant(), async () => {
            const reader = new S3TemplateAttachmentReader();
            const result = await reader.read({
                templateId: 'template-id',
                filename: 'a.png',
                contentType: 'image/png',
            });

            expect(result.contentType).toBe('image/png');
        });
    });
});
