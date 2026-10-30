import { jest } from '@jest/globals';
import { S3ScanService } from '../../src/s3-files/infrastructure/external/S3ScanService.js';

const tenantValue = (entry) => ({ value: entry });

describe('S3ScanService', () => {
    it('classifies an encrypted-PDF scanner response without exposing its algorithm', async () => {
        const tenant = {
            aws_s3_region: tenantValue('us-east-1'),
            aws_s3_access_key_id: tenantValue('test-access-key'),
            aws_s3_secret_access_key: tenantValue('test-secret-key'),
            aws_css_url: tenantValue('https://scanner.example.com'),
            aws_css_username: tenantValue('scanner-user'),
            aws_css_password: tenantValue('scanner-password'),
            aws_s3_bucket: tenantValue('test-bucket'),
            apps_environment: tenantValue('staging'),
        };
        const post = jest
            .fn()
            .mockResolvedValueOnce({ data: { accessToken: 'token' } })
            .mockRejectedValueOnce({
                message: 'Unprocessable Entity',
                response: {
                    status: 422,
                    data: { detail: 'PDF uses Standard security handler, AES-256' },
                },
            });
        const service = new S3ScanService(tenant, { httpClient: { post } });

        await expect(service.scanFile({ objectKey: 'attachments/email-id/encrypted.pdf' })).rejects.toMatchObject({
            code: 'attachment_encrypted',
            nonRetryable: true,
            message: 'Attachment cannot be scanned: encrypted PDF',
        });
    });

    it.each([
        ['a scanner 503', { message: 'Encrypted PDF upstream timeout', response: { status: 503, data: {} } }],
        ['scanner throttling', { message: 'Encrypted PDF rate limit', response: { status: 429, data: {} } }],
        ['a transport failure', { message: 'Encrypted PDF connection reset' }],
    ])('keeps %s retryable even when the error text mentions an encrypted PDF', async (_label, scanError) => {
        const tenant = {
            aws_s3_region: tenantValue('us-east-1'),
            aws_s3_access_key_id: tenantValue('test-access-key'),
            aws_s3_secret_access_key: tenantValue('test-secret-key'),
            aws_css_url: tenantValue('https://scanner.example.com'),
            aws_css_username: tenantValue('scanner-user'),
            aws_css_password: tenantValue('scanner-password'),
            aws_s3_bucket: tenantValue('test-bucket'),
            apps_environment: tenantValue('staging'),
        };
        const post = jest
            .fn()
            .mockResolvedValueOnce({ data: { accessToken: 'token' } })
            .mockRejectedValueOnce(scanError);
        const service = new S3ScanService(tenant, { httpClient: { post } });

        await expect(service.scanFile({ objectKey: 'attachments/email-id/encrypted.pdf' })).rejects.toMatchObject({
            message: 'File scanning failed.',
        });
    });

    it('handles circular scanner response data without throwing from the error handler', async () => {
        const tenant = {
            aws_s3_region: tenantValue('us-east-1'),
            aws_s3_access_key_id: tenantValue('test-access-key'),
            aws_s3_secret_access_key: tenantValue('test-secret-key'),
            aws_css_url: tenantValue('https://scanner.example.com'),
            aws_css_username: tenantValue('scanner-user'),
            aws_css_password: tenantValue('scanner-password'),
            aws_s3_bucket: tenantValue('test-bucket'),
            apps_environment: tenantValue('staging'),
        };
        const responseData = {};
        responseData.self = responseData;
        const post = jest
            .fn()
            .mockResolvedValueOnce({ data: { accessToken: 'token' } })
            .mockRejectedValueOnce({
                message: 'Unprocessable Entity',
                response: { status: 422, data: responseData },
            });
        const service = new S3ScanService(tenant, { httpClient: { post } });

        await expect(service.scanFile({ objectKey: 'attachments/email-id/document.pdf' })).rejects.toMatchObject({
            message: 'File scanning failed.',
        });
    });
});
