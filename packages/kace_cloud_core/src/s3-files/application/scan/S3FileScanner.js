import { isEncryptedPdfDescription } from '../../domain/EncryptedPdfDetection.js';
import { S3_FILE_SCAN_ERROR_CODES } from '../../domain/S3FileScanErrorCodes.js';

const DEFINITIVE_SCANNER_VERDICTS = new Set(['clean', 'infected', 'suspicious']);

export class S3FileScanner {
    #scanService;

    constructor(scanService) {
        this.#scanService = scanService;
    }

    /**
     * Executes the security validation process of an S3 file.
     *
     * This method takes a data transfer object (DTO), prepares the necessary fields,
     * and then performs a security scan. If the file is found to be insecure,
     * it is deleted from S3.
     *
     * @param {Object} dto - The data transfer object containing the file properties.
     * @returns {Promise<void>} A promise that resolves when the scan is completed.
     */
    async execute(dto) {
        dto.objectKey = `${dto.url}/${dto.id}/${dto.fileName}`;

        let scanResult;
        try {
            scanResult = await this.#scanService.scanFile(dto);
        } catch (error) {
            if (error?.code !== S3_FILE_SCAN_ERROR_CODES.ATTACHMENT_ENCRYPTED) {
                throw error;
            }

            await this.#scanService.deleteFile(dto.objectKey);
            return this.#encryptedPdfResult(dto.fileName);
        }

        if (scanResult?.message === 'Security validation disabled') {
            return scanResult;
        }

        if (this.#isEncryptedPdfResult(scanResult, dto.fileName)) {
            await this.#scanService.deleteFile(dto.objectKey);
            return this.#encryptedPdfResult(dto.fileName);
        }

        if (!scanResult || !scanResult.result || scanResult.result !== 'Clean') {
            await this.#scanService.deleteFile(dto.objectKey);

            return {
                message: 'Threat detected',
                errors: {
                    fileName: dto.fileName,
                    message: `The attachment ${dto.fileName} is insecure and has been deleted`,
                },
            };
        }

        return {
            message: 'File validated successfully',
        };
    }

    #isEncryptedPdfResult(scanResult, fileName) {
        const normalizedVerdict = String(scanResult?.result ?? '')
            .trim()
            .toLowerCase();
        if (DEFINITIVE_SCANNER_VERDICTS.has(normalizedVerdict)) {
            return false;
        }

        const description = [
            scanResult?.result,
            scanResult?.message,
            scanResult?.detail,
            scanResult?.error,
            scanResult?.errors?.message,
        ]
            .filter(Boolean)
            .join(' ');
        return isEncryptedPdfDescription(description, fileName);
    }

    #encryptedPdfResult(fileName) {
        return {
            code: S3_FILE_SCAN_ERROR_CODES.ATTACHMENT_ENCRYPTED,
            message: 'Attachment cannot be scanned: encrypted PDF',
            errors: { fileName },
        };
    }
}
