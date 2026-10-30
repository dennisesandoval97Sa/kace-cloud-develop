import { Guards } from '../guards/Guards.js';
import { RegexPatterns } from '../regex/RegexPatterns.js';

export class ValueObjectVaultReference {
    /** @type {String|undefined} is initialized in the constructor */
    #originalValue;
    /** @type {String|undefined} is initialized in the constructor */
    #resolvedValue;

    constructor(field, value, nullable) {
        this.field = field;
        this.#originalValue = value;
        this.#resolvedValue = undefined;

        if (nullable) return;

        Guards.stringMinLength(this, 3);
        Guards.stringMaxLength(this, 255);
        Guards.stringPattern(
            this,
            RegexPatterns.vaultReferenceRegex(),
            `${this.field} is not a allowed vault reference`
        );
    }

    /**
     * Resolve this vault reference with the provided value
     * @param {string} resolvedValue - The plain resolved value
     * @returns {ValueObjectVaultReference} - Returns this instance
     */
    resolve(resolvedValue) {
        this.#resolvedValue = resolvedValue;
        return this;
    }

    /**
     * Get the current value (resolved or original)
     * @returns {string}
     */
    get value() {
        return this.#resolvedValue !== undefined ? this.#resolvedValue : this.#originalValue;
    }

    /**
     * Check if this value object contains a resolved value
     * @returns {boolean}
     */
    get isResolved() {
        return this.#resolvedValue !== undefined;
    }

    /**
     * Get the original vault reference value
     * @returns {string}
     */
    get originalReference() {
        return this.#originalValue;
    }
}
