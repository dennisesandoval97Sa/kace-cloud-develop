import { jest } from '@jest/globals';

const send = jest.fn();
const createdClients = [];
const putObjectCommands = [];
const getObjectCommands = [];
const headObjectCommands = [];
const deleteObjectCommands = [];

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

class FakeGetObjectCommand {
    constructor(input) {
        this.input = input;
        getObjectCommands.push(input);
    }
}

class FakeHeadObjectCommand {
    constructor(input) {
        this.input = input;
        headObjectCommands.push(input);
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
    GetObjectCommand: FakeGetObjectCommand,
    HeadObjectCommand: FakeHeadObjectCommand,
    DeleteObjectCommand: FakeDeleteObjectCommand,
}));

const { S3EmailBodyStorage } = await import('../../src/emails/infrastructure/persistence/S3EmailBodyStorage.js');
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

describe('S3EmailBodyStorage', () => {
    beforeEach(() => {
        send.mockReset();
        createdClients.length = 0;
        putObjectCommands.length = 0;
        getObjectCommands.length = 0;
        headObjectCommands.length = 0;
        deleteObjectCommands.length = 0;
    });

    it('uploads full email bodies to tenant S3 and returns metadata', async () => {
        send.mockResolvedValueOnce({});

        await TenantContext.run(tenant(), async () => {
            const storage = new S3EmailBodyStorage();
            const buffer = Buffer.from('Full body content', 'utf8');

            const result = await storage.upload({
                emailId: 'email-id',
                part: 'html',
                buffer,
                contentType: 'text/html; charset=utf-8',
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
                Body: buffer,
                ContentType: 'text/html; charset=utf-8',
            });
            expect(putObjectCommands[0].Key).toMatch(/^email-bodies\/email-id\/html-[0-9a-f-]+\.html$/);
            expect(result).toMatchObject({
                s3Key: putObjectCommands[0].Key,
                contentType: 'text/html; charset=utf-8',
                sizeBytes: buffer.length,
            });
            expect(result.sha256).toHaveLength(64);
        });
    });

    it('downloads external email body content from tenant S3', async () => {
        send.mockResolvedValueOnce({
            Body: Buffer.from('Full text body', 'utf8'),
            ContentType: 'text/plain; charset=utf-8',
        });

        await TenantContext.run(tenant(), async () => {
            const storage = new S3EmailBodyStorage();

            const result = await storage.download('email-bodies/email-id/text.txt');

            expect(getObjectCommands[0]).toEqual({
                Bucket: 'tenant-bucket',
                Key: 'email-bodies/email-id/text.txt',
            });
            expect(result).toEqual({
                buffer: Buffer.from('Full text body', 'utf8'),
                content: 'Full text body',
                contentType: 'text/plain; charset=utf-8',
                sizeBytes: Buffer.byteLength('Full text body'),
            });
        });
    });

    it('deletes orphan external email body objects from tenant S3', async () => {
        send.mockResolvedValueOnce({});

        await TenantContext.run(tenant(), async () => {
            const storage = new S3EmailBodyStorage();

            await storage.delete('email-bodies/email-id/text.txt');

            expect(deleteObjectCommands[0]).toEqual({
                Bucket: 'tenant-bucket',
                Key: 'email-bodies/email-id/text.txt',
            });
        });
    });

    it('does nothing when asked to delete without an S3 key', async () => {
        await TenantContext.run(tenant(), async () => {
            const storage = new S3EmailBodyStorage();

            await storage.delete(null);

            expect(send).not.toHaveBeenCalled();
            expect(deleteObjectCommands).toHaveLength(0);
        });
    });

    it('reads external email body object metadata from tenant S3', async () => {
        send.mockResolvedValueOnce({
            ContentType: 'text/html; charset=utf-8',
            ContentLength: 1024,
        });

        await TenantContext.run(tenant(), async () => {
            const storage = new S3EmailBodyStorage();

            const result = await storage.head('email-bodies/email-id/html.html');

            expect(headObjectCommands[0]).toEqual({
                Bucket: 'tenant-bucket',
                Key: 'email-bodies/email-id/html.html',
            });
            expect(result).toEqual({
                contentType: 'text/html; charset=utf-8',
                sizeBytes: 1024,
            });
        });
    });

    it('extracts keys only from tenant S3 URLs generated by upload-s3-files', async () => {
        await TenantContext.run(tenant(), async () => {
            const storage = new S3EmailBodyStorage();

            const key = storage.extractTenantUploadObjectKey(
                'https://tenant-bucket.s3.tenant-region.amazonaws.com/email-bodies/email-id/text-id.txt'
            );

            expect(key).toBe('email-bodies/email-id/text-id.txt');
            expect(() =>
                storage.extractTenantUploadObjectKey(
                    'https://tenant-bucket.s3.tenant-region.amazonaws.com/email-bodies/email-id/text-id.txt?signature=1'
                )
            ).toThrow('External email body URL must not include query string or fragment.');
            expect(() =>
                storage.extractTenantUploadObjectKey(
                    'https://s3.tenant-region.amazonaws.com/tenant-bucket/email-bodies/email-id/text-id.txt'
                )
            ).toThrow('External email body URL must be a tenant S3 URL generated by /upload-s3-files.');
        });
    });

    it('rejects tenant S3 URLs that do not use https', async () => {
        await TenantContext.run(tenant(), async () => {
            const storage = new S3EmailBodyStorage();

            expect(() =>
                storage.extractTenantUploadObjectKey(
                    'http://tenant-bucket.s3.tenant-region.amazonaws.com/email-bodies/email-id/text-id.txt'
                )
            ).toThrow('External email body URL must use https.');
        });
    });

    it('rejects tenant S3 URLs carrying only a fragment', async () => {
        await TenantContext.run(tenant(), async () => {
            const storage = new S3EmailBodyStorage();

            expect(() =>
                storage.extractTenantUploadObjectKey(
                    'https://tenant-bucket.s3.tenant-region.amazonaws.com/email-bodies/email-id/text-id.txt#section'
                )
            ).toThrow('External email body URL must not include query string or fragment.');
        });
    });

    it('rejects tenant S3 URLs with no object key in the path', async () => {
        await TenantContext.run(tenant(), async () => {
            const storage = new S3EmailBodyStorage();

            expect(() =>
                storage.extractTenantUploadObjectKey('https://tenant-bucket.s3.tenant-region.amazonaws.com/')
            ).toThrow('External email body URL is missing an S3 object key.');
        });
    });

    it('uploads text bodies with the default content type and coerces non-buffer input', async () => {
        send.mockResolvedValueOnce({}).mockResolvedValueOnce({});

        await TenantContext.run(tenant(), async () => {
            const storage = new S3EmailBodyStorage();

            const textResult = await storage.upload({
                emailId: 'email-id',
                part: 'text',
                buffer: 'Plain text content',
            });

            expect(putObjectCommands[0].Key).toMatch(/^email-bodies\/email-id\/text-[0-9a-f-]+\.txt$/);
            expect(putObjectCommands[0]).toMatchObject({ ContentType: 'text/plain; charset=utf-8' });
            expect(putObjectCommands[0].Body).toEqual(Buffer.from('Plain text content', 'utf8'));
            expect(textResult.contentType).toBe('text/plain; charset=utf-8');

            const emptyResult = await storage.upload({ emailId: 'email-id', part: 'text', buffer: undefined });

            expect(putObjectCommands[1].Body).toEqual(Buffer.alloc(0));
            expect(emptyResult.sizeBytes).toBe(0);
        });
    });

    it('uses an explicitly injected S3 client and connection options instead of tenant/env config', async () => {
        send.mockResolvedValueOnce({});

        const storage = new S3EmailBodyStorage({
            s3Client: { send },
            bucket: 'explicit-bucket',
            region: 'explicit-region',
            credentials: { accessKeyId: 'explicit-key', secretAccessKey: 'explicit-secret' },
        });

        expect(createdClients).toHaveLength(0);

        await storage.upload({ emailId: 'email-id', part: 'html', buffer: Buffer.from('explicit body') });

        expect(putObjectCommands[0].Bucket).toBe('explicit-bucket');
    });

    it('resolves connection settings from environment variables when there is no tenant context', async () => {
        process.env.AWS_S3_REGION = 'env-region';
        process.env.AWS_S3_ACCESS_KEY_ID = 'env-access-key';
        process.env.AWS_S3_SECRET_ACCESS_KEY = 'env-secret-key';
        process.env.AWS_S3_BUCKET = 'env-bucket';

        try {
            send.mockResolvedValueOnce({});

            const storage = new S3EmailBodyStorage();

            expect(createdClients[0].config).toEqual({
                region: 'env-region',
                credentials: {
                    accessKeyId: 'env-access-key',
                    secretAccessKey: 'env-secret-key',
                },
            });

            await storage.upload({ emailId: 'email-id', part: 'html', buffer: Buffer.from('env body') });

            expect(putObjectCommands[0].Bucket).toBe('env-bucket');
        } finally {
            delete process.env.AWS_S3_REGION;
            delete process.env.AWS_S3_ACCESS_KEY_ID;
            delete process.env.AWS_S3_SECRET_ACCESS_KEY;
            delete process.env.AWS_S3_BUCKET;
        }
    });

    it('defaults missing response metadata to null instead of leaking undefined', async () => {
        send.mockResolvedValueOnce({ Body: Buffer.from('no metadata') }).mockResolvedValueOnce({});

        await TenantContext.run(tenant(), async () => {
            const storage = new S3EmailBodyStorage();

            const downloaded = await storage.download('email-bodies/email-id/text.txt');
            expect(downloaded.contentType).toBeNull();

            const headResult = await storage.head('email-bodies/email-id/text.txt');
            expect(headResult).toEqual({ contentType: null, sizeBytes: null });
        });
    });

    it('normalizes every attachment body shape the S3 SDK can hand back', async () => {
        await TenantContext.run(tenant(), async () => {
            const storage = new S3EmailBodyStorage();

            send.mockResolvedValueOnce({ Body: undefined });
            const missing = await storage.download('key-missing');
            expect(missing.content).toBe('');
            expect(missing.sizeBytes).toBe(0);

            send.mockResolvedValueOnce({ Body: 'plain string body' });
            const stringResult = await storage.download('key-string');
            expect(stringResult.content).toBe('plain string body');

            send.mockResolvedValueOnce({ Body: new TextEncoder().encode('uint8 body') });
            const uint8Result = await storage.download('key-uint8');
            expect(uint8Result.content).toBe('uint8 body');

            send.mockResolvedValueOnce({
                Body: { transformToByteArray: async () => new TextEncoder().encode('byte array body') },
            });
            const byteArrayResult = await storage.download('key-byte-array');
            expect(byteArrayResult.content).toBe('byte array body');

            send.mockResolvedValueOnce({
                Body: {
                    [Symbol.asyncIterator]: async function* () {
                        yield Buffer.from('chunk-a-');
                        yield 'chunk-b';
                    },
                },
            });
            const iterableResult = await storage.download('key-iterable');
            expect(iterableResult.content).toBe('chunk-a-chunk-b');

            send.mockResolvedValueOnce({ Body: 12345 });
            const numericResult = await storage.download('key-numeric');
            expect(numericResult.content).toBe('12345');
        });
    });
});
