import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import fs from 'fs';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { Helper } from '../../infrastructure/utils/Helper.js';
import { TenantContext } from '../../infrastructure/context/TenantContext.js';

/**
 * Service responsible for exporting data rows to Excel format.
 * Receives pre-fetched data rows and generates Excel-compatible files (.xls with CSV content).
 * This service does NOT query databases - it only handles data formatting and S3 upload.
 */
export class ExportExcelData {
    /** @type {S3Client} */
    #s3Client;

    /** @type {string} */
    #bucket;

    /**
     * Initializes the export service with S3 configuration from tenant context.
     */
    constructor() {
        const tenant = TenantContext.getTenant();
        this.#s3Client = new S3Client({
            region: tenant.aws_s3_region.value,
            credentials: {
                accessKeyId: tenant.aws_s3_access_key_id.value,
                secretAccessKey: tenant.aws_s3_secret_access_key.value,
            },
        });
        this.#bucket = tenant.aws_s3_bucket.value;
    }

    /**
     * Executes the export process: generate Excel file, upload to S3, return pre-signed URL.
     * @param {Array<Object>} rows - Pre-fetched data rows to export
     * @param {string} fileName - File name (without extension)
     * @param {string[]} headers - Optional custom headers for the Excel file (defaults to row keys)
     * @param {Object} options - Optional configuration
     * @param {number} options.expiresIn - Pre-signed URL expiration time in seconds (default: 3600)
     * @returns {Promise<string>} - Pre-signed download URL
     */
    async execute(rows, fileName, headers = null, options = {}) {
        try {
            Helper.logInfo(`Starting Excel export: ${fileName}`);

            if (!rows || rows.length === 0) {
                Helper.logInfo('No data provided for export');
                throw new Error('No data available to export');
            }

            Helper.logInfo(`Exporting ${rows.length} rows`);

            const excelContent = this.#generateExcelContent(rows, headers);

            const s3FileUrl = await this.#uploadToS3(fileName, excelContent);

            Helper.logInfo(`File uploaded successfully: ${s3FileUrl}`);

            const downloadUrl = await this.#getDownloadUrl(s3FileUrl, options.expiresIn);

            Helper.logInfo(`Download URL generated: ${downloadUrl}`);

            return downloadUrl;
        } catch (error) {
            const errorMessage = `Failed to export Excel data: ${fileName}`;
            Helper.logError(`${errorMessage}: ${error}`);
            throw new Error(`${errorMessage}: ${error.message}`);
        }
    }

    /**
     * Generates Excel-compatible content (CSV format) from data rows.
     * @param {Array<Object>} data - Array of data objects
     * @param {string[]} customHeaders - Optional custom headers
     * @returns {string} - CSV content
     * @private
     */
    #generateExcelContent(data, customHeaders = null) {
        if (data.length === 0) return '';

        try {
            const headers = customHeaders || Object.keys(data[0]);
            const headerRow = headers.join(',');

            const rows = data.map((row) => {
                return headers
                    .map((header) => {
                        const value = row[header] ?? '';

                        if (typeof value === 'object' && value !== null) {
                            if (value instanceof Date) {
                                return `"${value.toISOString()}"`;
                            }
                            return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
                        }

                        return `"${String(value).replace(/"/g, '""')}"`;
                    })
                    .join(',');
            });

            return [headerRow, ...rows].join('\n');
        } catch (error) {
            const errorMessage = 'Failed to generate Excel content';
            Helper.logError(`${errorMessage}: ${error}`);
            throw new Error(`${errorMessage}`);
        }
    }

    /**
     * Uploads Excel file to S3 with .xls extension.
     * @param {string} fileName - Name of the file (without extension)
     * @param {string} content - CSV content
     * @returns {Promise<string>} - S3 URL of uploaded file
     * @private
     */
    async #uploadToS3(fileName, content) {
        const filePath = `/tmp/${fileName}.xls`;
        fs.writeFileSync(filePath, content);
        Helper.logInfo(`Generated temporary Excel file: ${filePath}`);
        dayjs.extend(utc);
        dayjs.extend(timezone);
        const timestamp = dayjs().tz('America/Bogota').format('YYYYMMDD_HHmmss');

        const fileKey = `exports/${timestamp}_${fileName}.xls`;
        const fileContent = fs.createReadStream(filePath);

        const params = {
            Bucket: this.#bucket,
            Key: fileKey,
            Body: fileContent,
            ContentType: 'application/vnd.ms-excel',
            ACL: 'private',
        };

        try {
            const command = new PutObjectCommand(params);
            await this.#s3Client.send(command);
            Helper.logInfo(`Uploaded file to S3: ${fileKey}`);

            fs.unlinkSync(filePath);

            return `s3://${this.#bucket}/${fileKey}`;
        } catch (err) {
            const errorMessage = `Failed to upload file ${fileName} to S3`;
            Helper.logError(`${errorMessage}: ${err}`);
            throw new Error(`${errorMessage}`);
        }
    }

    /**
     * Generates a pre-signed download URL for the S3 file.
     * @param {string} fileUrl - S3 URL (s3://bucket/key format)
     * @param {number} expiresIn - URL expiration time in seconds (default: 1 hour)
     * @returns {Promise<string>} - Pre-signed download URL
     * @private
     */
    async #getDownloadUrl(fileUrl, expiresIn = 3600) {
        let key;
        try {
            const urlParts = new URL(fileUrl);
            key = urlParts.pathname.substring(1); // Remove leading '/'

            const command = new GetObjectCommand({
                Bucket: this.#bucket,
                Key: key,
            });

            const downloadUrl = await getSignedUrl(this.#s3Client, command, { expiresIn });
            Helper.logInfo(`Generated pre-signed download URL for S3 file: ${downloadUrl}`);

            return downloadUrl;
        } catch (error) {
            const errorMessage = `Failed to generate download URL. File Key: ${key || 'Unknown'}`;
            Helper.logError(`${errorMessage}: ${error}`);
            throw new Error(`${errorMessage}`);
        }
    }
}
