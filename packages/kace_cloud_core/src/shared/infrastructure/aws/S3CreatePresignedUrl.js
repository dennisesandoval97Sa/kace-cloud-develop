import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { buildEffectiveAllowedExtensions } from '@kace/file-extensions';
import { InvalidFileExtensionError } from './errors/InvalidFileExtensionError.js';

export class S3CreatePresignedUrl {
    #s3Client;
    #command;

    static ALLOWED_EXTENSIONS = buildEffectiveAllowedExtensions();

    constructor(s3Client, command) {
        this.#s3Client = s3Client;
        this.#validateFileExtensions(command);
        this.#command = command;
    }

    #validateFileExtensions(command) {
        if (!command || !command.input || !command.input.Key) {
            return;
        }

        const fileName = command.input.Key;
        const extension = this.#getFileExtension(fileName);

        if (!S3CreatePresignedUrl.ALLOWED_EXTENSIONS.includes(extension)) {
            throw new InvalidFileExtensionError(fileName, extension, S3CreatePresignedUrl.ALLOWED_EXTENSIONS);
        }
    }

    #getFileExtension(fileName) {
        const lastDotIndex = fileName.lastIndexOf('.');
        if (lastDotIndex === -1) {
            return '';
        }
        return fileName.substring(lastDotIndex).toLowerCase();
    }

    async execute(expires = '3600') {
        const uploadUrl = await getSignedUrl(this.#s3Client, this.#command, { expiresIn: expires });

        return {
            uploadUrl,
        };
    }
}
