import { InvalidArgumentError } from '../../errors/InvalidArgumentError.js';
import { Helper } from '../../infrastructure/utils/Helper.js';

/**
 * A utility class for type and value checks.
 */
export class Guards {
    /**
     * Checks if a value is of type `string`.
     *
     * @param {ValueObject} vo - The value to check.
     * @throws {InvalidArgumentError} If the value is not of type `string`.
     */
    static stringType(vo) {
        if (typeof vo.value !== 'string') {
            throw new InvalidArgumentError(`${vo.field}: The value must be a string`);
        }
    }

    /**
     * Checks if a value has a length less than or equal to a specified maximum.
     *
     * @param {ValueObject} vo - The value to check.
     * @param {number} max - The maximum length allowed.
     * @throws {InvalidArgumentError} If the value exceeds the maximum length.
     */
    static stringMaxLength(vo, max) {
        if (vo.value?.length > max) {
            throw new InvalidArgumentError(`${vo.field}: The value must be at most ${max} characters long`);
        }
    }

    /**
     * Checks if a value is of type `bigint`.
     *
     * @param {ValueObject} vo - The value to check.
     * @throws {InvalidArgumentError} If the value is not of type `bigint`.
     */
    static integerType(vo) {
        if (typeof vo.value !== 'number') {
            throw new InvalidArgumentError(`${vo.field}: The value must be a number`);
        }

        if (!Number.isInteger(vo.value)) {
            throw new InvalidArgumentError(`${vo.field}: The value must be an integer`);
        }
    }

    /**
     * Checks if a value is of type `boolean`.
     *
     * @param {ValueObject} vo - The value to check.
     * @throws {InvalidArgumentError} If the value is not of type `boolean`.
     */
    static booleanType(vo) {
        if (typeof vo.value === 'number') {
            if (vo.value !== 0 && vo.value !== 1) {
                throw new InvalidArgumentError(`${vo.field}: The value must be a boolean`);
            }
            return;
        }
        if (typeof vo.value !== 'boolean') {
            throw new InvalidArgumentError(`${vo.field}: The value must be a boolean`);
        }
    }

    /**
     * Checks if a value has a length greater than or equal to a specified minimum.
     *
     * @param {ValueObject} vo - The value to check.
     * @param {number} min - The minimum length allowed.
     * @throws {InvalidArgumentError} If the value is less than the minimum length.
     */
    static stringMinLength(vo, min) {
        if (vo.value?.length < min) {
            throw new InvalidArgumentError(`${vo.field}: The value must be at least ${min} characters long`);
        }
    }

    /**
     * Checks if a value is of type `object`.
     *
     * @param {ValueObject} vo - The value to check.
     * @throws {InvalidArgumentError} If the value is not of type `object`.
     */
    static objectType(vo) {
        if (typeof vo.value !== 'object') {
            throw new InvalidArgumentError(`${vo.field}: The value must be an object`);
        }
    }

    /**
     * Checks if a value matches a specified regular expression pattern.
     *
     * @param {ValueObject} vo - The value to check.
     * @param {RegExp} regExp - The regular expression pattern to match.
     * @param {string} [message=null] - The error message to throw if the value does not match the pattern.
     * @throws {InvalidArgumentError} If the value does not match the pattern.
     */
    static stringPattern(vo, regExp, message = null) {
        message = message || `${vo.field}: The value must match the pattern`;
        if (!regExp.test(vo.value)) {
            Helper.logInfo('VO:', vo, vo.value);
            throw new InvalidArgumentError(message);
        }
    }

    /**
     * Checks if a value is within a specified range (inclusive).
     *
     * @param {ValueObject} vo - The value to check.
     * @param {number} min - The minimum value of the range.
     * @param {number} max - The maximum value of the range.
     * @throws {InvalidArgumentError} If the value is not within the specified range.
     */
    static IntegerInRange(vo, min, max) {
        if (vo.value < min || vo.value > max) {
            throw new InvalidArgumentError(`${vo.field}: The value must be between ${min} and ${max}`);
        }
    }

    /**
     * Checks if a value is of type `array`.
     *
     * @param {ValueObject} vo - The value to check.
     * @throws {InvalidArgumentError} If the value is not of type `array`.
     */
    static arrayType(vo) {
        if (Array.isArray(vo.value) === false) {
            throw new InvalidArgumentError(`${vo.field}: The value must be an array`);
        }
    }

    /**
     * Checks if a value is included in a specified enum.
     *
     * @param {*} value - The value to check.
     * @param {Object} enumObject - The enum object to check against.
     * @throws {InvalidArgumentError} If the value is not included in the enum.
     */
    static enumValue(value, enumObject) {
        if (!Object.values(enumObject).includes(value)) {
            throw new InvalidArgumentError('Invalid value for enum');
        }
    }

    /**
     * Checks if a value is of type `number` (including decimals).
     *
     * @param {ValueObject} vo - The value to check.
     * @throws {InvalidArgumentError} If the value is not a number.
     */
    static decimalType(vo) {
        if (typeof vo.value !== 'number' || isNaN(vo.value)) {
            throw new InvalidArgumentError(`${vo.field}: The value must be a valid number`);
        }
    }
}
