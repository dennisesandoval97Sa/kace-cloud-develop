import { jest } from '@jest/globals';

/**
 * Mocks '@aws-sdk/client-s3' so tests never open a real S3 connection.
 *
 * Reflects the real usage in src/ (e.g. S3AttachmentStorage, S3TemplateAttachmentReader,
 * S3ScanService): `new S3Client(config)` followed by `client.send(new XCommand(input))`.
 * Only the Commands actually constructed in src/ are covered
 * (PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand); add more
 * here if a future consumer needs another one, rather than inventing an unused shape.
 *
 * MUST be called (and awaited) before dynamically importing the module under test - see
 * jest's `unstable_mockModule` ordering requirement.
 *
 * @example
 * const { send, calls } = await mockAwsS3();
 * const { S3AttachmentStorage } = await import('../../src/emails/infrastructure/persistence/S3AttachmentStorage.js');
 * send.mockResolvedValue({});
 * // ...call code under test...
 * expect(calls.PutObjectCommand[0]).toMatchObject({ Bucket: 'my-bucket' });
 *
 * @returns {{
 *   send: import('@jest/globals').jest.Mock,
 *   clients: Array<{config: object}>,
 *   calls: {
 *     PutObjectCommand: object[],
 *     GetObjectCommand: object[],
 *     DeleteObjectCommand: object[],
 *     HeadObjectCommand: object[],
 *   },
 * }}
 */
export const mockAwsS3 = () => {
    const send = jest.fn();
    const clients = [];
    const calls = {
        PutObjectCommand: [],
        GetObjectCommand: [],
        DeleteObjectCommand: [],
        HeadObjectCommand: [],
    };

    const makeCommand = (name) =>
        class {
            constructor(input) {
                this.input = input;
                calls[name].push(input);
            }
        };

    class FakeS3Client {
        constructor(config) {
            this.config = config;
            clients.push(this);
        }

        send(command) {
            return send(command);
        }
    }

    jest.unstable_mockModule('@aws-sdk/client-s3', () => ({
        S3Client: FakeS3Client,
        PutObjectCommand: makeCommand('PutObjectCommand'),
        GetObjectCommand: makeCommand('GetObjectCommand'),
        DeleteObjectCommand: makeCommand('DeleteObjectCommand'),
        HeadObjectCommand: makeCommand('HeadObjectCommand'),
    }));

    return { send, clients, calls };
};

/**
 * Mocks '@aws-sdk/s3-request-presigner' (used by ExportExcelData, CSVStorage,
 * EmailZipGenerator, S3CreatePresignedUrl to build downloadable links).
 *
 * @example
 * const { getSignedUrl } = await mockAwsS3Presigner();
 * getSignedUrl.mockResolvedValue('https://example.com/signed-url');
 *
 * @returns {{ getSignedUrl: import('@jest/globals').jest.Mock }}
 */
export const mockAwsS3Presigner = () => {
    const getSignedUrl = jest.fn();

    jest.unstable_mockModule('@aws-sdk/s3-request-presigner', () => ({ getSignedUrl }));

    return { getSignedUrl };
};
