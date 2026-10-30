import { XSSDictionary } from '../security/XSSDictionary.js';
import { InvalidArgumentError } from '../../errors/InvalidArgumentError.js';

export class XSSSchemaGuard {
    /**
     * Validates the input string for XSS (Cross-Site Scripting) patterns.
     *
     * This method uses the `XSSDictionary` to check for any prohibited XSS patterns in the input string.
     * If any such patterns are detected, it throws an `InvalidArgumentError` with a message detailing the
     * detected patterns.
     *
     * @param {string} input - The input string to be validated for XSS patterns.
     * @throws {InvalidArgumentError} Throws an error if any prohibited XSS patterns are detected in the input.
     */
    static validate(input, throwError = true) {
        const invalidWords = XSSDictionary.findXSSSchemaPatterns(input);
        if (invalidWords.length) {
            if (!throwError) {
                return false;
            }
            throw new InvalidArgumentError(
                `Palabras prohibidas detectadas - ${XSSDictionary.sanitize(invalidWords.join(', '))}`
            );
        }
    }
}
