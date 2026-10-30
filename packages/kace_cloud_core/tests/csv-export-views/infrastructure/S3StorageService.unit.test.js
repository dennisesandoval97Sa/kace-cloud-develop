import { jest } from '@jest/globals';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { mockAwsS3, mockAwsS3Presigner } from '../../support/mocks/awsS3.js';

// Helper.js is imported via the `../../shared` barrel, which also re-exports ExportExcelData
// (client-s3 + s3-request-presigner consumer). Mocking @aws-sdk/client-s3 replaces the whole
// module graph, so both need mocking here even though S3StorageService itself never signs URLs.
const { send, clients: createdClients } = mockAwsS3();
mockAwsS3Presigner();

// S3StorageService reuses (and mutates in place, e.g. `delete params.Tagging`) the same params
// object across the initial attempt and the tagging-denied retry, then constructs a new
// PutObjectCommand from it each time. The shared mock's `calls.PutObjectCommand` stores those
// `input` objects by reference, so a later mutation would retroactively change what an earlier
// captured command looks like. Snapshotting a shallow copy inside `send` itself, before any
// further mutation can happen, keeps each captured command an accurate per-attempt record.
const putObjectCommands = [];
let sendQueue = [];
const queueSendRejection = (err) => sendQueue.push({ type: 'reject', err });
const queueSendResolution = (val = {}) => sendQueue.push({ type: 'resolve', val });

const uploadInstances = [];
let nextDoneRejection = null;

class FakeUpload {
    constructor(args) {
        this.args = args;
        this.done = jest.fn().mockImplementation(() => {
            if (nextDoneRejection) {
                const err = nextDoneRejection;
                nextDoneRejection = null;
                return Promise.reject(err);
            }
            return Promise.resolve({});
        });
        uploadInstances.push(this);
    }
}

jest.unstable_mockModule('@aws-sdk/lib-storage', () => ({
    Upload: FakeUpload,
}));

const { S3StorageService } = await import('../../../src/csv-export-views/infrastructure/S3StorageService.js');

const baseConfig = () => ({
    region: 'us-east-1',
    accessKeyId: 'AKIA-test',
    secretAccessKey: 'secret-test',
    bucket: 'test-bucket',
});

describe('S3StorageService', () => {
    let fixtureFilePath;

    beforeAll(() => {
        fixtureFilePath = path.join(os.tmpdir(), `s3-storage-service-unit-${process.pid}.csv`);
        fs.writeFileSync(fixtureFilePath, 'id,name\n1,test\n');
    });

    afterAll(() => {
        fs.rmSync(fixtureFilePath, { force: true });
    });

    beforeEach(() => {
        send.mockReset();
        sendQueue = [];
        send.mockImplementation((command) => {
            putObjectCommands.push({ ...command.input });
            const next = sendQueue.shift();
            if (!next) {
                return Promise.resolve({});
            }
            return next.type === 'reject' ? Promise.reject(next.err) : Promise.resolve(next.val);
        });
        createdClients.length = 0;
        putObjectCommands.length = 0;
        uploadInstances.length = 0;
    });

    describe('constructor', () => {
        it('builds an S3Client config without requestHandler when none is provided', () => {
            new S3StorageService(baseConfig());

            expect(createdClients).toHaveLength(1);
            expect(createdClients[0].config).not.toHaveProperty('requestHandler');
            expect(createdClients[0].config).toMatchObject({
                region: 'us-east-1',
                credentials: { accessKeyId: 'AKIA-test', secretAccessKey: 'secret-test' },
            });
        });

        it('attaches the given requestHandler to the S3Client config', () => {
            const requestHandler = { name: 'custom-handler' };

            new S3StorageService({ ...baseConfig(), requestHandler });

            expect(createdClients[0].config.requestHandler).toBe(requestHandler);
        });
    });

    describe('uploadFile — content type by extension', () => {
        it.each([
            ['report.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
            ['report.xls', 'application/vnd.ms-excel'],
            ['report.csv', 'text/csv'],
            ['report.pdf', 'application/pdf'],
            ['report.unknownext', 'application/octet-stream'],
        ])('sets ContentType %s -> %s', async (fileName, expectedContentType) => {
            const service = new S3StorageService(baseConfig());

            await service.uploadFile(fixtureFilePath, `folder/${fileName}`);

            expect(putObjectCommands).toHaveLength(1);
            expect(putObjectCommands[0].ContentType).toBe(expectedContentType);
            expect(putObjectCommands[0].ContentDisposition).toBe(`attachment; filename="${fileName}"`);
            expect(putObjectCommands[0].Key).toBe(`folder/${fileName}`);
            expect(putObjectCommands[0].Bucket).toBe('test-bucket');
        });

        it('falls back to a "file" ContentDisposition name when destinationPath is empty', async () => {
            const service = new S3StorageService(baseConfig());

            await service.uploadFile(fixtureFilePath, '');

            expect(putObjectCommands[0].ContentDisposition).toBe('attachment; filename="file"');
            expect(putObjectCommands[0].ContentType).toBe('application/octet-stream');
        });

        it('keeps default params when path utilities throw on a non-string destinationPath', async () => {
            const service = new S3StorageService(baseConfig());

            // destinationPath is truthy (an object), so `destinationPath || ''` keeps the object and
            // path.extname()/path.basename() throw a TypeError on it — exercising the defensive catch.
            const result = await service.uploadFile(fixtureFilePath, { not: 'a-string' });

            expect(putObjectCommands[0].ContentType).toBe('application/octet-stream');
            expect(putObjectCommands[0]).not.toHaveProperty('ContentDisposition');
            expect(result).toBe('s3://test-bucket/[object Object]');
        });
    });

    describe('uploadFile — caducity metadata and tagging', () => {
        it('does not set Expires/Metadata/Tagging when no expiresInDays option is given', async () => {
            const service = new S3StorageService(baseConfig());

            await service.uploadFile(fixtureFilePath, 'a.csv');

            expect(putObjectCommands[0]).not.toHaveProperty('Expires');
            expect(putObjectCommands[0]).not.toHaveProperty('Metadata');
            expect(putObjectCommands[0]).not.toHaveProperty('Tagging');
        });

        it('ignores expiresInDays when options is explicitly null', async () => {
            const service = new S3StorageService(baseConfig());

            await service.uploadFile(fixtureFilePath, 'a.csv', null);

            expect(putObjectCommands[0]).not.toHaveProperty('Expires');
            expect(putObjectCommands[0]).not.toHaveProperty('Tagging');
        });

        it('ignores a non-numeric expiresInDays', async () => {
            const service = new S3StorageService(baseConfig());

            await service.uploadFile(fixtureFilePath, 'a.csv', { expiresInDays: '5' });

            expect(putObjectCommands[0]).not.toHaveProperty('Expires');
        });

        it('ignores expiresInDays when it is not strictly positive', async () => {
            const service = new S3StorageService(baseConfig());

            await service.uploadFile(fixtureFilePath, 'a.csv', { expiresInDays: 0 });

            expect(putObjectCommands[0]).not.toHaveProperty('Expires');
        });

        it('sets Expires/Metadata and a lifecycle Tagging string for a positive expiresInDays', async () => {
            const service = new S3StorageService(baseConfig());
            const fixedNow = new Date('2026-01-01T00:00:00.000Z').getTime();
            jest.spyOn(Date, 'now').mockReturnValue(fixedNow);

            await service.uploadFile(fixtureFilePath, 'a.csv', { expiresInDays: 2 });

            const expected = new Date(fixedNow + 2 * 24 * 60 * 60 * 1000);
            expect(putObjectCommands[0].Expires).toEqual(expected);
            expect(putObjectCommands[0].Metadata).toEqual({ 'expires-at': expected.toISOString() });
            expect(putObjectCommands[0].Tagging).toBe('expires=true&expire_days=2');

            Date.now.mockRestore();
        });

        it('omits Tagging (but keeps Expires/Metadata) when skipTagging is true', async () => {
            const service = new S3StorageService(baseConfig());

            await service.uploadFile(fixtureFilePath, 'a.csv', { expiresInDays: 3, skipTagging: true });

            expect(putObjectCommands[0]).toHaveProperty('Expires');
            expect(putObjectCommands[0]).not.toHaveProperty('Tagging');
        });
    });

    describe('uploadFile — S3 error handling', () => {
        it('returns the s3:// url on a successful upload', async () => {
            const service = new S3StorageService(baseConfig());

            const result = await service.uploadFile(fixtureFilePath, 'reports/a.csv');

            expect(result).toBe('s3://test-bucket/reports/a.csv');
            expect(send).toHaveBeenCalledTimes(1);
        });

        it('retries without Tagging and succeeds when tagging is denied by name AccessDenied', async () => {
            const taggingError = new Error('User is not authorized to perform: s3:PutObjectTagging');
            taggingError.name = 'AccessDenied';
            queueSendRejection(taggingError);
            queueSendResolution({});
            const service = new S3StorageService(baseConfig());

            const result = await service.uploadFile(fixtureFilePath, 'a.csv', { expiresInDays: 1 });

            expect(result).toBe('s3://test-bucket/a.csv');
            expect(send).toHaveBeenCalledTimes(2);
            expect(putObjectCommands).toHaveLength(2);
            expect(putObjectCommands[0]).toHaveProperty('Tagging');
            expect(putObjectCommands[1]).not.toHaveProperty('Tagging');
        });

        it('retries via the AccessDenied err.code fallback (no err.name) and throws a wrapped error if the retry also fails', async () => {
            const firstError = { code: 'AccessDenied', message: 'denied' };
            const secondError = new Error('still denied on retry');
            queueSendRejection(firstError);
            queueSendRejection(secondError);
            const service = new S3StorageService(baseConfig());

            await expect(service.uploadFile(fixtureFilePath, 'a.csv', { expiresInDays: 1 })).rejects.toThrow(
                'Failed to upload file to S3 (retry without tagging failed): still denied on retry'
            );
            expect(send).toHaveBeenCalledTimes(2);
        });

        it('does not retry when tagging was denied but the upload had no Tagging to begin with', async () => {
            const taggingError = new Error('not authorized to perform s3:PutObjectTagging');
            taggingError.name = 'AccessDenied';
            queueSendRejection(taggingError);
            const service = new S3StorageService(baseConfig());

            // No expiresInDays => #buildObjectParams never set params.Tagging, so even though the
            // error looks like a tagging-denial, there is nothing to retry without.
            await expect(service.uploadFile(fixtureFilePath, 'a.csv')).rejects.toThrow(
                'Failed to upload file to S3: not authorized to perform s3:PutObjectTagging'
            );
            expect(send).toHaveBeenCalledTimes(1);
        });

        it('throws the plain wrapped error for an unrelated failure, using err.code when err.name is absent', async () => {
            const networkError = { code: 'NetworkingError' };
            queueSendRejection(networkError);
            const service = new S3StorageService(baseConfig());

            await expect(service.uploadFile(fixtureFilePath, 'a.csv', { expiresInDays: 1 })).rejects.toThrow(
                'Failed to upload file to S3: undefined'
            );
            expect(send).toHaveBeenCalledTimes(1);
        });

        it('throws "...: undefined" when the rejected value has neither message, name nor code', async () => {
            queueSendRejection({});
            const service = new S3StorageService(baseConfig());

            await expect(service.uploadFile(fixtureFilePath, 'a.csv')).rejects.toThrow(
                'Failed to upload file to S3: undefined'
            );
        });
    });

    describe('uploadStream', () => {
        it('uploads via @aws-sdk/lib-storage Upload and returns the s3:// url', async () => {
            const service = new S3StorageService(baseConfig());
            const bodyStream = { marker: 'stream' };

            const result = await service.uploadStream(bodyStream, 'streamed/a.xlsx', { expiresInDays: 4 });

            expect(result).toBe('s3://test-bucket/streamed/a.xlsx');
            expect(uploadInstances).toHaveLength(1);
            expect(uploadInstances[0].args.client).toBe(service.s3Client);
            expect(uploadInstances[0].args.params).toMatchObject({
                Bucket: 'test-bucket',
                Key: 'streamed/a.xlsx',
                Body: bodyStream,
                ContentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                Tagging: 'expires=true&expire_days=4',
            });
            expect(uploadInstances[0].done).toHaveBeenCalledTimes(1);
        });

        it('uses default options ({}) when none are given', async () => {
            const service = new S3StorageService(baseConfig());

            await service.uploadStream({ marker: 'stream' }, 'streamed/no-options.csv');

            expect(uploadInstances[0].args.params).not.toHaveProperty('Tagging');
            expect(uploadInstances[0].args.params).not.toHaveProperty('Expires');
        });

        it('wraps and rethrows when the multipart upload fails', async () => {
            const service = new S3StorageService(baseConfig());
            nextDoneRejection = new Error('network reset');

            await expect(service.uploadStream({ marker: 'stream' }, 'streamed/fail.csv')).rejects.toThrow(
                'Failed to upload stream to S3: network reset'
            );
            expect(uploadInstances).toHaveLength(1);
        });
    });
});
