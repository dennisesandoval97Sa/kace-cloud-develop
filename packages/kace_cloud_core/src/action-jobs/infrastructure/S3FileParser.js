import csv from 'csv-parser';
import { DeleteObjectCommand, GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Helper, TenantContext } from '../../shared';

export class S3FileParser {
    /** @type {S3Client|null} initialized lazily on first S3 operation */
    #s3Client = null;
    /** @type {string|null} initialized lazily on first S3 operation */
    #bucketName = null;

    /**
     * Lazily initializes the S3 client and bucket name from the current tenant context.
     * Deferred to avoid crashing at construction time when no tenant context is active.
     */
    #initClient() {
        if (this.#s3Client) return;
        const tenant = TenantContext.getTenant();
        this.#s3Client = new S3Client({
            region: tenant.aws_s3_region.value,
            credentials: {
                accessKeyId: tenant.aws_s3_access_key_id.value,
                secretAccessKey: tenant.aws_s3_secret_access_key.value,
            },
        });
        this.#bucketName = tenant.aws_s3_bucket.value;
    }

    /**
     * Reads a file from an S3 bucket.
     *
     * @param {string} fileKey The key (name) of the file to read from the S3 bucket.
     * @returns {Promise<ReadableStream>} A promise that resolves with the file's content as a readable stream.
     */
    async readFile(fileKey) {
        this.#initClient();
        const command = new GetObjectCommand({
            Bucket: this.#bucketName,
            Key: fileKey,
        });

        const response = await this.#s3Client.send(command);
        return response.Body;
    }

    /**
     * Parses the CSV content of a file.
     *
     * @param {ReadableStream} fileContent The content of the file to parse.
     * @param {Object} [config={ separator: ',', headers: false }] Configuration for parsing the CSV.
     * @param {string} [config.separator=','] The separator character for CSV columns.
     * @param {boolean} [config.headers=false] Whether the CSV has headers or not.
     * @returns {Promise<Object[]>} A promise that resolves with an array of objects representing the parsed CSV records.
     */
    async parseCSV(fileContent, config = { separator: ',', headers: false }) {
        return new Promise((resolve, reject) => {
            const records = [];

            const csvConfig = {
                separator: config.separator || ',',
                headers: config.headers !== undefined ? config.headers : false,
            };

            fileContent
                .pipe(csv(csvConfig))
                .on('data', (record) => records.push(record))
                .on('end', () => resolve(records))
                .on('error', (error) => reject(error instanceof Error ? error : new Error(String(error))));
        });
    }

    /**
     * Deletes a file from the S3 bucket.
     *
     * @param {string} fileKey The key (name) of the file to delete from the S3 bucket.
     * @throws {Error} Throws an error if the delete operation fails.
     * @returns {Promise<void>} A promise that resolves when the file is deleted.
     */
    async deleteFile(fileKey) {
        this.#initClient();
        const command = new DeleteObjectCommand({
            Bucket: this.#bucketName,
            Key: fileKey,
        });

        try {
            await this.#s3Client.send(command);
        } catch (error) {
            const errorMessage = `Error deleting file ${fileKey}:`;
            Helper.logError(`${errorMessage}`, error);
            throw new Error(`${errorMessage}`);
        }
    }
}
