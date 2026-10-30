import { InvalidArgumentError } from '../../../errors/InvalidArgumentError.js';

export class InvalidFileExtensionError extends InvalidArgumentError {
    constructor(fileName, extension, allowedExtensions) {
        super(
            `File "${fileName}" has an invalid extension "${extension}". ` +
            `Allowed extensions: ${allowedExtensions.join(', ')}`
        );
        this.fileName = fileName;
        this.extension = extension;
        this.allowedExtensions = allowedExtensions;
    }
}
