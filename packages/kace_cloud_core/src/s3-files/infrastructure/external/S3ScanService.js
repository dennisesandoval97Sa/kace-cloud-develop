import { DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';
import axios from 'axios';
import { Helper, TenantContext, ValidationFailError } from '../../../shared/index.js';
import { isEncryptedPdfDescription } from '../../domain/EncryptedPdfDetection.js';
import { S3_FILE_SCAN_ERROR_CODES } from '../../domain/S3FileScanErrorCodes.js';

function safeSerialize(value) {
    try {
        return JSON.stringify(value ?? {});
    } catch {
        return '[unserializable scanner response]';
    }
}

function scanFailureDescription(error) {
    const responseData = error?.response?.data;
    const serializedResponse = safeSerialize(responseData);

    return `${error?.message ?? ''} ${serializedResponse}`;
}

function isEncryptedPdfFailure(error, objectPath) {
    const statusCode = error?.response?.status;
    const hasStatusCode = Number.isInteger(statusCode);
    const hasTransientStatus = statusCode === 408 || statusCode === 429 || statusCode >= 500;
    if ((hasStatusCode && statusCode < 400) || hasTransientStatus) {
        return false;
    }

    const responseData = error?.response?.data;
    if (responseData?.code === 'ENCRYPTED_DOCUMENT' || responseData?.reason === 'encrypted') {
        return true;
    }

    if (!hasStatusCode) {
        return false;
    }

    const description = scanFailureDescription(error);

    return isEncryptedPdfDescription(description, objectPath);
}

export class S3ScanService {
    /** @type {S3Client} is initialized in the constructor */
    #s3Client;
    /** @type {string} is initialized in the constructor */
    #cssUrl;
    /** @type {string} is initialized in the constructor */
    #cssUsername;
    /** @type {string} is initialized in the constructor */
    #cssPassword;
    /** @type {string} is initialized in the constructor */
    #bucket;
    /** @type {boolean} is initialized in the constructor */
    #isSecurityEnabled;
    #httpClient;

    /**
     * Creates an instance of `S3ScanService`.
     * @param {Tenant} tenant
     * @param {{httpClient?: {post: Function}}} options - Optional HTTP dependency for scanner requests.
     * @constructor
     */
    constructor(tenant = null, { httpClient = axios } = {}) {
        if (!tenant) {
            tenant = TenantContext.getTenant();
        }
        this.#s3Client = new S3Client({
            region: tenant.aws_s3_region.value,
            credentials: {
                accessKeyId: tenant.aws_s3_access_key_id.value,
                secretAccessKey: tenant.aws_s3_secret_access_key.value,
            },
        });

        this.#cssUrl = tenant.aws_css_url.value;
        this.#cssUsername = tenant.aws_css_username.value;
        this.#cssPassword = tenant.aws_css_password.value;
        this.#bucket = tenant.aws_s3_bucket.value;
        const environment = tenant.apps_environment.value?.trim().toLowerCase() || 'development';
        this.#isSecurityEnabled = environment === 'production' || environment === 'staging';
        this.#httpClient = httpClient;
    }

    /**
     * Scans an S3 file for security threats.
     *
     * @param {S3File} s3File - The file to be scanned.
     * @returns {Promise<Object>} The scan result.
     */
    async scanFile(s3File) {
        if (!this.#isSecurityEnabled) {
            Helper.logInfo('Security validation is disabled. Skipping scan.');
            return { message: 'Security validation disabled', result: 'Clean' };
        }

        const token = await this.#getTokenForCss();
        const scanPayload = {
            container: this.#bucket,
            objectPath: s3File.objectKey,
        };

        return this.#sendScanRequest(scanPayload, token);
    }

    /**
     * Sends a request to scan an S3 file.
     *
     * @param {Object} scanPayload - The payload containing file details.
     * @param {string} token - The authentication token.
     * @returns {Promise<Object>} The scan result.
     */
    async #sendScanRequest(scanPayload, token) {
        const scanUrl = `${this.#cssUrl}/api/Scan/Existing`;
        Helper.logInfo(`Starting file scan on ${scanUrl}`);

        try {
            const response = await this.#httpClient.post(scanUrl, scanPayload, {
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
            });
            return response.data;
        } catch (error) {
            Helper.logError(`Scan request failed: ${error.message}`);
            if (isEncryptedPdfFailure(error, scanPayload.objectPath)) {
                const encryptedError = new ValidationFailError('Attachment cannot be scanned: encrypted PDF', 'scan');
                encryptedError.code = S3_FILE_SCAN_ERROR_CODES.ATTACHMENT_ENCRYPTED;
                encryptedError.nonRetryable = true;
                throw encryptedError;
            }

            throw new ValidationFailError('File scanning failed.', 'scan');
        }
    }

    /**
     * Deletes an S3 file if found to be insecure.
     *
     * @param {string} objectKey - The key of the file to be deleted.
     * @returns {Promise<void>}
     */
    async deleteFile(objectKey) {
        Helper.logInfo(`Deleting file from S3: ${objectKey}`);

        const deleteParams = {
            Bucket: this.#bucket,
            Key: objectKey,
        };

        const command = new DeleteObjectCommand(deleteParams);
        await this.#s3Client.send(command);
    }

    /**
     * Retrieves an authentication token for the CSS service.
     *
     * @returns {Promise<string>} The authentication token.
     */
    async #getTokenForCss() {
        const tokenUrl = `${this.#cssUrl}/api/Token`;
        Helper.logInfo(`Soliciting token at ${tokenUrl}`);

        try {
            const response = await this.#httpClient.post(
                tokenUrl,
                {
                    username: this.#cssUsername,
                    password: this.#cssPassword,
                },
                {
                    headers: { 'Content-Type': 'application/json' },
                }
            );
            return response.data.accessToken;
        } catch (error) {
            Helper.logError(`Error obtaining token for CSS: `, error);
            throw new ValidationFailError('Error getting token for CSS.', 'authentication');
        }
    }
}
