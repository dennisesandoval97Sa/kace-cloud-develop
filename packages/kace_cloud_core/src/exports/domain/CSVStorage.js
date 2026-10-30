import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import fs from 'fs';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { Helper } from '../../shared/infrastructure/utils/Helper.js';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {TenantContext} from "../../shared/index.js";

export class CSVStorage {
    /** @type {S3Client} is initialized in the constructor */
    #s3Client;
    /** @type {string} is initialized in the constructor */
    #bucket;

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

    async save(fileName, data) {
        const csvData = this.generateCSV(data);
        return this.uploadToS3(fileName, csvData);
    }

    /**
     * Genera un archivo CSV con los datos proporcionados.
     * @param {Array<Object>} data - Datos a escribir en el CSV.
     * @param {string} tableName - Nombre de la tabla (usado como nombre de archivo).
     * @returns {string} Ruta del archivo generado.
     */

    generateCSV(data) {
        if (data.length === 0) return '';

        try {
            const headers = Object.keys(data[0]).join(',');

            const rows = data.map((row) => {
                return Object.values(row)
                    .map((value) => {
                        const safeValue = value ?? '';

                        if (typeof safeValue === 'object' && safeValue !== null) {
                            if (safeValue instanceof Date) {
                                return `"${safeValue.toISOString()}"`;
                            }
                            return `"${JSON.stringify(safeValue).replace(/"/g, '""')}"`;
                        }

                        return `"${String(safeValue).replace(/"/g, '""')}"`;
                    })
                    .join(',');
            });

            return [headers, ...rows].join('\n');
        } catch (error) {
            const errorMessage = `Failed to generateCSV`;
            Helper.logError(`${errorMessage}: ${error}`);
            throw new Error(`${errorMessage}`);
        }
    }

    /**
     * Sube un archivo CSV a S3.
     * @param {string} filePath - Ruta del archivo local.
     * @param {string} fileName - Nombre del archivo en S3.
     * @returns {string} URL de S3 del archivo subido.
     */

    async uploadToS3(fileName, csvData) {
        const filePath = `/tmp/${fileName}.csv`;
        fs.writeFileSync(filePath, csvData);
        Helper.logInfo(`generated CSV file: ${filePath}`);

        dayjs.extend(utc);
        dayjs.extend(timezone);
        const timestamp = dayjs().tz('America/Bogota').format('YYYYMMDD_HHmmss');

        const fileKey = `exports/${timestamp}_${fileName}.csv`;
        const fileContent = fs.createReadStream(filePath);

        const params = {
            Bucket: this.#bucket,
            Key: fileKey,
            Body: fileContent,
            ContentType: 'text/csv',
            ACL: 'private',
        };

        try {
            const command = new PutObjectCommand(params);
            await this.#s3Client.send(command);
            Helper.logInfo(`Upload file to S3: ${fileKey}`);
            return `s3://${this.#bucket}/${fileKey}`;
        } catch (err) {
            const errorMessage = `Failed to upload file ${fileName} to S3`;
            Helper.logError(`${errorMessage}: ${err}`);
            throw new Error(`${errorMessage}`);
        }
    }

    async existsInS3(fileUrl) {
        try {
            const urlParts = new URL(fileUrl);
            const key = urlParts.pathname.substring(1);

            await this.#s3Client.send(new HeadObjectCommand({ Bucket: this.#bucket, Key: key }));
            return true;
        } catch (error) {
            if (error.name === 'NotFound') {
                return false;
            }
            const errorMessage = `Failed to check existence of file in S3. Key: ${key}`;
            Helper.logError(errorMessage, error);
            throw new Error(errorMessage);
        }
    }

    async getDownloadUrl(fileUrl, expiresIn = 3600) {
        let key;
        try {
            const urlParts = new URL(fileUrl);
            key = urlParts.pathname.substring(1);

            const command = new GetObjectCommand({
                Bucket: this.#bucket,
                Key: key,
            });

            const downloadUrl = await getSignedUrl(this.#s3Client, command, { expiresIn });
            Helper.logInfo(`Download URL S3 file: ${downloadUrl}`);

            return downloadUrl;
        } catch (error) {
            const errorMessage = `Failed to generate download URL. File Key: ${key || 'Unknown'}`;

            Helper.logError(`${errorMessage}: ${error}`);
            throw new Error(`${errorMessage}`);
        }
    }
}
