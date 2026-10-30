import { Guards, ValueObjectString } from '../../shared';
import { InvalidArgumentError } from '../../shared/errors/InvalidArgumentError.js';
import { HELP_ATTACHMENT_FILENAME_REJECTED } from '@kace/error-codes';

export class ValueObjectPath extends ValueObjectString {
    constructor(field, value, nullable) {
        try {
            super(field, value, nullable);
            Guards.stringMaxLength(this, 150);
            Guards.stringMinLength(this, 5);
            Guards.stringPattern(
                this,
                /^[^/\\]+?\.[a-zA-Z0-9]{2,}$/, // SONAR-EXC: The guards are responsible for validating the value, avoiding intense CPU usage
                `${this.field}: The file name must include a valid name and extension (e.g., "document.pdf"): ${value}`
            );
        } catch (error) {
            if (error instanceof InvalidArgumentError) {
                throw new InvalidArgumentError(
                    'The Help attachment filename was rejected.',
                    400,
                    HELP_ATTACHMENT_FILENAME_REJECTED
                );
            }
            throw error;
        }
    }
}
