import { AggregateRoot } from '../../shared/domain/AggregateRoot.js';
import { ValueObjectDescription } from './value-objects/ValueObjectDescription.js';
import { ValueObjectIsActive } from './value-objects/ValueObjectIsActive.js';
import { ValueObjectType } from './value-objects/ValueObjectType.js';
import { ValueObjectFilterInput } from './value-objects/ValueObjectFilterInput.js';
import { ValueObjectContextPosition } from './value-objects/ValueObjectContextPosition.js';
import { ValueObjectDynamicValue } from './value-objects/ValueObjectDynamicValue.js';
import { ValueObjectStaticValue } from './value-objects/ValueObjectStaticValue.js';
import { InvalidArgumentError } from '../../shared/errors/InvalidArgumentError.js';
import { ValueObjectUuid } from '../../shared/domain/value-object/ValueObjectUuid.js';
import { Crypto, Helper, RegexPatterns, TenantContext, ValidationFailError } from '../../shared/index.js';
import { ComparisonService } from '../../shared/domain/services/ComparisonService.js';
import createDayjsInstance from '../../shared/factories/DayjsFactory.js';
import { NestedValueManager } from '../../shared/domain/utilities/NestedValueManager.js';

const dayjs = createDayjsInstance({});

export class WSRestFunction extends AggregateRoot {
    /**
     * @type {ValueObjectDescription} is initialized in the constructor
     */
    #description;

    /**
     * @type {ValueObjectType} is initialized in the constructor
     */
    #type;

    /**
     * @type {ValueObjectFilterInput} is initialized in the constructor
     */
    #filter_input;

    /**
     * @type {ValueObjectContextPosition} is initialized in the constructor
     */
    #context_position;

    /**
     * @type {ValueObjectStaticValue} is initialized in the constructor
     */
    #value_static;

    /**
     * @type {ValueObjectDynamicValue} is initialized in the constructor
     */
    #value_dynamic;

    /**
     * @type {ValueObjectIsActive} is initialized in the constructor
     */
    #is_active;

    /** @type {ValueObjectType} is initialized in the constructor */
    #functions;

    /** @type {{ secretKey: string, secretIV: string, encryptionMethod: string }} */
    #cryptoParams;

    constructor({
        id,
        description,
        type,
        filter_input,
        context_position,
        value_static,
        value_dynamic,
        is_active,
        created_by,
        updated_by,
        deleted_by,
        created_at,
        updated_at,
        deleted_at,
    }) {
        super(id);
        this.#description = new ValueObjectDescription(description ?? 'default');
        this.#type = new ValueObjectType(type);
        this.#filter_input = new ValueObjectFilterInput(filter_input);
        this.#context_position = new ValueObjectContextPosition(context_position ?? 'default');
        this.#value_static = new ValueObjectStaticValue(this.#staticValueToString(value_static));
        this.#value_dynamic = new ValueObjectDynamicValue(value_dynamic ?? false);
        this.#is_active = new ValueObjectIsActive(is_active ?? false);
        const tenant = TenantContext.getTenant();
        this.#cryptoParams = {
            secretKey: tenant.secret_key.value,
            secretIV: tenant.secret_iv.value,
            encryptionMethod: tenant.encryption_method.value,
        };
        this.created_at = created_at;
        this.updated_at = updated_at;
        this.deleted_at = deleted_at;
        this.created_by = created_by;
        this.updated_by = updated_by;
        this.deleted_by = deleted_by;
        this.#functions = {
            formatDate: (date, format) => this.#formatDate(date, format),
            dateDifference: (start, end) => this.#dateDifference(start, end),
            toUpperCase: (text) => this.#toUpperCase(text),
            toLowerCase: (text) => this.#toLowerCase(text),
            trim: (text) => this.#trim(text),
            concatenate: (...texts) => this.#concatenate(...texts),
            concatenateComma: (...values) => this.#concatenateComma(...values),
            maskText: (text, maskChar, visibleStart, visibleEnd) =>
                this.#maskText(text, maskChar, visibleStart, visibleEnd),
            isValidUUID: (uuid) => this.#isValidUUID(uuid),
            generateUUID: () => this.#generateUUID(),
            increment: (value, step) => this.#increment(value, step),
            formatNumber: (value) => this.#formatNumber(value),
            formatText: (value) => this.#formatText(value),
            validatePhone: (value) => this.#validatePhone(value),
            validateEmail: (value) => this.#validateEmail(value),
            encrypt: (text) => this.#encrypt(text),
            findNewElements: (original, updated) => this.#findNewElements(original, updated),
            convertToTimezone: (date, targetTimezone, format) => this.#convertToTimezone(date, targetTimezone, format),
            reverseArray: (array) => this.#reverseArray(array),
            currentDate: (format) => this.#currentDate(format),
            addToContext: (value) => this.#addToContext(value),
            mapProperty: (value) => this.#mapProperty(value),
            regexOr: (val1, val2, pattern) => this.#regexOr(val1, val2, pattern),
            divide: (dividend, divisor) => this.#divide(dividend, divisor),
            subtract: (minuend, subtrahend) => this.#subtract(minuend, subtrahend),
            add: (augend, addend) => this.#add(augend, addend),
            abs: (value) => this.#abs(value),
            ceil: (value) => this.#ceil(value),
            floor: (value) => this.#floor(value),
            addMinutes: (date, minutes) => this.#addMinutes(date, minutes),
            addHours: (date, hours) => this.#addHours(date, hours),
            addDays: (date, days) => this.#addDays(date, days),
            subtractMinutes: (date, minutes) => this.#subtractMinutes(date, minutes),
            subtractHours: (date, hours) => this.#subtractHours(date, hours),
            subtractDays: (date, days) => this.#subtractDays(date, days),
            filterArray: (array, condition) => this.#filterArray(array, condition),
            normalizeChannelHubRule: (rule) => this.#normalizeChannelHubRule(rule),
            filterArrayAll: (array, conditions) => this.#filterArrayAll(array, conditions),
            filterArrayIn: (lookupArray, targetArray, config) => this.#filterArrayIn(lookupArray, targetArray, config),
            selectArray: (array, config) => this.#selectArray(array, config),
        };
        this.validateValueDynamicAndValueStatic();
        this.validateValueStaticByType();
    }

    /**
     * Execute a private method dynamically
     * @param {string} functionName - The function to execute
     * @param {...any} params - Params for the function
     * @returns {any} Result of the function execution
     */
    execute(...params) {
        return this.#functions[this.#type.value](...params);
    }

    /**
     * Create a new instance of WSRestFunction and return it
     *
     * @param {  Object } dto
     * @return { WSRestFunction }
     */
    static create(dto) {
        return new WSRestFunction(dto);
    }

    /**
     * @param {string} value
     */
    set description(value) {
        if (!this.#areEqual(this.#description.value, value)) {
            this.#description = new ValueObjectDescription(value);
            this.changedAttributes.description = this.#description.value;
        }
    }

    /**
     * @param {string} value
     */
    set type(value) {
        if (!this.#areEqual(this.#type.value, value)) {
            this.#type = new ValueObjectType(value);
            this.changedAttributes.type = this.#type.value;
        }
    }

    /**
     * @param {jsonb} value
     */
    set filter_input(value) {
        if (!this.#areEqual(this.#filter_input.value, value)) {
            this.#filter_input = new ValueObjectFilterInput(value);
            this.changedAttributes.filter_input = this.#filter_input.value;
        }
    }

    /**
     * @param {text} value
     */
    set context_position(value) {
        if (!this.#areEqual(this.#context_position.value, value)) {
            this.#context_position = new ValueObjectContextPosition(value);
            this.changedAttributes.context_position = this.#context_position.value;
        }
    }

    /**
     * @param {string} value
     */
    set value_static(value) {
        if (!this.#areEqual(this.#value_static.value, value)) {
            this.#value_static = new ValueObjectStaticValue(this.#staticValueToString(value));
            this.changedAttributes.value_static = this.#value_static.value;
        }
    }

    /**
     * @param {text} value
     */
    set value_dynamic(value) {
        if (!this.#areEqual(this.#value_dynamic.value, value)) {
            this.#value_dynamic = new ValueObjectDynamicValue(value);
            this.changedAttributes.value_dynamic = this.#value_dynamic.value;
        }
    }

    /**
     * @param {boolean} value
     */
    set is_active(value) {
        if (!this.#areEqual(this.#is_active.value, value)) {
            this.#is_active = new ValueObjectIsActive(value);
            this.changedAttributes.is_active = this.#is_active.value;
        }
    }

    /**
     * @return {ValueObjectDescription}
     */
    get description() {
        return this.#description;
    }

    /**
     * @return {ValueObjectType}
     */
    get type() {
        return this.#type;
    }

    /**
     * @return {ValueObjectFilterInput}
     */
    get filter_input() {
        return this.#filter_input;
    }

    /**
     * @return {ValueObjectContextPosition}
     */
    get context_position() {
        return this.#context_position;
    }

    /**
     * @return {ValueObjectStaticValue}
     */
    get value_static() {
        return this.#value_static;
    }

    /**
     * @return {ValueObjectDynamicValue}
     */
    get value_dynamic() {
        return this.#value_dynamic;
    }

    /**
     * @return {ValueObjectIsActive}
     */
    get is_active() {
        return this.#is_active;
    }

    /**
     * Verify if two values are equal and return a boolean
     *
     * @return {boolean}
     */
    #areEqual(value, otherValue) {
        return value === otherValue;
    }
    /**
     * Convert a date to a specific format (default: YYYY-MM-DD)
     * Also supports timezone conversion when format includes a comma-separated timezone
     * Example: 'YYYY-MM-DD HH:mm:ss, America/Bogota'
     * @param {string|Date} date - The date to format
     * @param {string} [format='YYYY-MM-DD'] - The desired format, optionally with timezone
     * @returns {string} Formatted date
     * @throws {InvalidArgumentError} If the date is invalid
     */
    #formatDate(date, format = 'YYYY-MM-DD') {
        const allowedFormats = [
            'YYYY-MM-DD',
            'DD-MM-YYYY',
            'MM/DD/YYYY',
            'YYYY/MM/DD',
            'YYYY-MM-DD HH:mm:ss',
            'DD/MM/YYYY HH:mm:ss',
        ];

        let dateFormat = format;
        let timezone = null;

        if (format.includes(',')) {
            const parts = format.split(',').map((part) => part.trim());
            const hasValidParts = parts.length === 2;
            const timezonePattern = /^[A-Za-z]+\/[A-Za-z_]+$/;
            const isValidTimezone = timezonePattern.test(parts[1]);

            if (hasValidParts && isValidTimezone) {
                [dateFormat, timezone] = parts;
            }
        }

        let dateObj;

        dateObj = dayjs.utc(date);
        if (timezone) {
            try {
                dateObj = dayjs(date).tz(timezone);
            } catch (error) {
                Helper.logError(`Invalid timezone: ${timezone}`);
            }
        }

        if (!dateObj.isValid()) {
            throw new InvalidArgumentError('Invalid date format');
        }

        const finalFormat = allowedFormats.includes(dateFormat) ? dateFormat : 'YYYY-MM-DD';

        return dateObj.format(finalFormat);
    }

    /**
     * Calculate the difference in days between two dates
     * @param {string|Date} startDate - Start date
     * @param {string|Date} endDate - End date
     * @returns {number} Difference in days
     * @throws {InvalidArgumentError} If dates are invalid
     */
    #dateDifference(startDate, endDate) {
        const isBad = (date) => !(date instanceof Date) && (typeof date !== 'string' || isNaN(Date.parse(date)));

        if (isBad(startDate)) {
            throw new InvalidArgumentError('Invalid startDate format');
        }
        if (isBad(endDate)) {
            throw new InvalidArgumentError('Invalid endDate format');
        }

        const startDateObj = dayjs(startDate);
        const endDateObj = dayjs(endDate);

        if (!startDateObj.isValid()) throw new InvalidArgumentError('Invalid startDate');
        if (!endDateObj.isValid()) throw new InvalidArgumentError('Invalid endDate');

        let earlierDate = startDateObj;
        let laterDate = endDateObj;
        let sign = 1;
        if (endDateObj.isBefore(startDateObj)) {
            earlierDate = endDateObj;
            laterDate = startDateObj;
            sign = -1;
        }

        const years = laterDate.diff(earlierDate, 'year');
        const sPlusY = earlierDate.add(years, 'year');

        const months = laterDate.diff(sPlusY, 'month');
        const sPlusYM = sPlusY.add(months, 'month');

        const days = laterDate.diff(sPlusYM, 'day');
        const sPlusYMD = sPlusYM.add(days, 'day');

        const hours = laterDate.diff(sPlusYMD, 'hour');
        const sPlusYMDH = sPlusYMD.add(hours, 'hour');

        const minutes = laterDate.diff(sPlusYMDH, 'minute');

        const msTotal = laterDate.valueOf() - earlierDate.valueOf();
        const diffInYears = laterDate.diff(earlierDate, 'year');
        const diffInMonth = laterDate.diff(earlierDate, 'month');
        const diffInDays = Math.floor(msTotal / (1000 * 60 * 60 * 24));
        const diffInHours = Math.floor(msTotal / (1000 * 60 * 60));
        const diffInMinutos = Math.floor(msTotal / (1000 * 60));

        const formattedStart = earlierDate.format('DD/MM/YYYY HH:mm:ss');
        const formattedEnd = laterDate.format('DD/MM/YYYY HH:mm:ss');

        return {
            range: `${formattedStart} - ${formattedEnd}`,
            byUnit: {
                year: years * sign,
                month: months * sign,
                day: days * sign,
                hour: hours * sign,
                minute: minutes * sign,
            },
            diffInYears: diffInYears * sign,
            diffInMonths: diffInMonth * sign,
            diffInDays: diffInDays * sign,
            diffInHours: diffInHours * sign,
            diffInMinutes: diffInMinutos * sign,
        };
    }

    /**
     * Convert a string to uppercase
     * @param {string} text - The text to convert
     * @returns {string} Uppercase text
     * @throws {InvalidArgumentError} If input is not a string
     */
    #toUpperCase(text) {
        if (typeof text !== 'string') {
            throw new InvalidArgumentError('Invalid input toUpperCase: must be a string');
        }
        return text.toUpperCase();
    }

    /**
     * Convert a string to lowercase
     * @param {string} text - The text to convert
     * @returns {string} Lowercase text
     * @throws {InvalidArgumentError} If input is not a string
     */
    #toLowerCase(text) {
        if (typeof text !== 'string') {
            throw new InvalidArgumentError('Invalid input toLowerCase: must be a string');
        }
        return text.toLowerCase();
    }

    /**
     * Trim whitespace from a string
     * @param {string} text - The text to trim
     * @returns {string} Trimmed text
     * @throws {InvalidArgumentError} If input is not a string
     */
    #trim(text) {
        if (typeof text !== 'string') {
            throw new InvalidArgumentError('Invalid input trim: must be a string');
        }
        return text.trim();
    }

    /**
     * Concatenate multiple strings
     * @param {...string} texts - Strings to concatenate
     * @returns {string} Concatenated string
     * @throws {InvalidArgumentError} If any input is not a string
     */
    #concatenate(...texts) {
        if (texts.some((text) => typeof text !== 'string')) {
            throw new InvalidArgumentError('All inputs must be strings');
        }
        return texts.join(' ');
    }

    #concatenateComma(...values) {
        if (values.some((v) => v === null || v === undefined || typeof v === 'boolean' || typeof v === 'object')) {
            throw new InvalidArgumentError('All inputs must be strings or numbers');
        }
        return values.map(String).join(',');
    }

    /**
     * Mask a string, keeping only the last 4 characters visible
     * @param {string} text - The text to mask
     * @returns {string} Masked text
     * @throws {InvalidArgumentError} If input is not a string
     */
    #maskText(text, maskChar = '*', visibleStart = 0, visibleEnd = 4) {
        if (typeof text !== 'string') {
            throw new InvalidArgumentError('Invalid input: must be a string');
        }
        if (typeof maskChar !== 'string' || maskChar.length !== 1) {
            throw new InvalidArgumentError('Invalid input: Mask character must be a single character string');
        }
        if (typeof visibleStart !== 'number' || typeof visibleEnd !== 'number') {
            throw new InvalidArgumentError('Invalid input: Visible start and end must be numbers');
        }
        if (visibleStart + visibleEnd > text.length) {
            throw new InvalidArgumentError('Invalid input: Visible characters exceed text length');
        }
        const maskLength = Math.max(0, text.length - (visibleStart + visibleEnd));
        const maskedPart = maskChar.repeat(maskLength);
        const endPart = visibleEnd > 0 ? text.slice(-visibleEnd) : '';
        return text.slice(0, visibleStart) + maskedPart + endPart;
    }

    /**
     * Validate if a string is a valid UUID
     * @param {string} uuid - The UUID to validate
     * @returns {boolean} True if valid, false otherwise
     */
    #isValidUUID(uuid) {
        return ValueObjectUuid.isValidUuid(uuid);
    }

    /**
     * Generate a random UUID v4
     * @returns {string} Generated UUID
     */
    #generateUUID() {
        return ValueObjectUuid.random();
    }

    /**
     * Increments a number by a given step.
     * @param {number|string} value - The initial value.
     * @param {number|string} [step=1] - The increment step (default is 1).
     * @returns {number} The incremented value.
     * @throws {InvalidArgumentError} If value is not a valid number.
     */
    #increment(value, step = 1) {
        const numValue = typeof value === 'number' ? value : Number(value);

        if (isNaN(numValue)) {
            throw new InvalidArgumentError('The value must be a valid number');
        }

        if (step === null || step === undefined) {
            return numValue + 1;
        }

        const stepValue = typeof step === 'number' ? step : Number(step);

        return numValue + (isNaN(stepValue) ? 1 : stepValue);
    }

    /**
     * Casts the value to a number.
     * @param {unknown} value - The value to format as a number.
     * @returns {number} The formatted number.
     * @throws {InvalidArgumentError} If input is null, undefined, or not a valid number.
     */
    #formatNumber(value) {
        if (value === null || value === undefined) {
            throw new InvalidArgumentError('Invalid input: must not be null or undefined');
        }

        return typeof value === 'number' ? value : Number(value);
    }

    /**
     * Encrypt a text
     * @param {string} text - The text to encrypt
     * @returns {string} Encrypted text
     * @throws {InvalidArgumentError} If input is invalid
     */
    #encrypt(text) {
        if (typeof text !== 'string' || text.trim() === '') {
            throw new InvalidArgumentError('Text must be a non-empty string');
        }
        const crypto = new Crypto(
            this.#cryptoParams.secretIV,
            this.#cryptoParams.secretKey,
            this.#cryptoParams.encryptionMethod
        );

        return crypto.encryptData(text);
    }

    /**
     * Casts the value to a string.
     * @param {unknown} value - The value to format as a string.
     * @returns {string} The formatted string.
     * @throws {InvalidArgumentError} If input is null or undefined.
     */
    #formatText(value) {
        if (value === null || value === undefined) return null;
        return typeof value === 'string' ? value : String(value);
    }

    /**
     * Validates a phone number.
     * @param {string} value - The phone number to validate.
     * @returns {boolean} True if valid, false otherwise.
     * @throws {InvalidArgumentError} If input is null or undefined.
     */
    #validatePhone(value) {
        const phoneRegex = /^\+?[1-9]\d{5,13}$/;

        return phoneRegex.test(value);
    }

    /**
     * Validates an email address.
     * @param {string} value - The email address to validate.
     * @returns {boolean} True if valid, false otherwise.
     * @throws {InvalidArgumentError} If input is invalid.
     */
    #validateEmail(value) {
        const emailRegex = RegexPatterns.emailRegex();
        return emailRegex.test(value);
    }

    /**
     * valid, if value_dynamic is true, value_static must not be null
     */
    validateValueDynamicAndValueStatic() {
        if (this.value_dynamic.value && this.value_static.value === null) {
            throw new ValidationFailError('value_static cannot be null if value_dynamic is true', 'value_static');
        }
    }

    /**
     * Validates the static value (`value_static`) based on the function type (`type`).
     * Ensures that:
     * - For text-based types (e.g., "encrypt", "formatText"), the value is a non-empty string.
     * - For number-based types (e.g., "increment", "formatNumber"), the value is a valid number.
     *
     * @returns {void}
     * @throws {ValidationFailError} If the value does not match the expected type or is missing.
     */
    validateValueStaticByType() {
        const type = this.type.value;
        const staticValue = this.value_static.value;
        const isDynamic = this.value_dynamic?.value;

        const requiredTextTypes = [
            'maskText',
            'concatenate',
            'concatenateComma',
            'regexOr',
            'filterArray',
            'filterArrayAll',
            'filterArrayIn',
            'selectArray',
        ];
        const requiredNumberTypes = [
            'increment',
            'divide',
            'subtract',
            'add',
            'addMinutes',
            'addHours',
            'addDays',
            'subtractMinutes',
            'subtractHours',
            'subtractDays',
        ];

        if (requiredTextTypes.includes(type)) {
            if (typeof staticValue !== 'string' || staticValue.trim() === '') {
                throw new ValidationFailError(
                    `value_static must be a non-empty string for function type "${type}"`,
                    'value_static'
                );
            }
        }

        if (requiredNumberTypes.includes(type)) {
            if (!isDynamic) {
                const raw = String(staticValue ?? '').trim();
                const numPart = raw.includes(',') ? raw.split(',')[0].trim() : raw;
                if (raw === '' || isNaN(Number(numPart))) {
                    throw new ValidationFailError(
                        `value_static must be a valid number for function type "${type}"`,
                        'value_static'
                    );
                }
            }
        }
    }

    #staticValueToString(value_static) {
        if (value_static === null || value_static === undefined) {
            return null;
        }

        if (value_static instanceof Date) {
            return value_static.toISOString();
        }

        if (typeof value_static === 'object') {
            return JSON.stringify(value_static);
        }

        try {
            return value_static.toString();
        } catch (error) {
            Helper.logError(error);
            // Errors are intentionally not logged or thrown to prevent flow interruption
            return String(value_static);
        }
    }

    /**
     * Find new elements in arrays (simplified version using string comparison)
     * @param {Array|string} original - The original array or JSON string representing an array
     * @param {Array|string} updated - The updated array or JSON string representing an array
     * @returns {Array} New elements found in updated array but not in original
     * @throws {ValidationFailError} If inputs are invalid or not arrays
     */
    #findNewElements(original, updated) {
        const parseIfString = (value) => {
            if (typeof value === 'string') {
                try {
                    return JSON.parse(value);
                } catch {
                    Helper.logError(`Invalid JSON string provided: ${value}`);
                    throw new ValidationFailError('Invalid JSON string provided', 'value');
                }
            }
            return value;
        };

        const originalParsed = parseIfString(original);
        const updatedParsed = parseIfString(updated);

        if (!updated || !Array.isArray(updatedParsed) || updatedParsed.length === 0) {
            return [];
        }

        if (!Array.isArray(originalParsed)) {
            throw new ValidationFailError(
                'value must be an array or JSON string representing an array',
                'findNewElements'
            );
        }

        const newElements = updatedParsed.filter(
            (element2) => !originalParsed.some((element1) => ComparisonService.deepEqual(element1, element2))
        );

        return JSON.parse(JSON.stringify(newElements));
    }

    /**
     * Convert a date to a specific timezone
     * @param {string|Date} date - The date to convert
     * @param {string} targetTimezone - Target timezone (e.g., 'America/New_York', 'Europe/London')
     * @param {string} [format='YYYY-MM-DD HH:mm:ss'] - Output format
     * @returns {string} Date converted to target timezone
     * @throws {InvalidArgumentError} If date or timezone is invalid
     */
    #convertToTimezone(date, targetTimezone = 'America/Bogota', format = 'YYYY-MM-DD HH:mm:ss') {
        Helper.logDebug(
            `convertToTimezone params:`,
            `date: ${date}, targetTimezone: ${targetTimezone}, format: ${format}`
        );
        if (date == null) {
            throw new InvalidArgumentError('Date cannot be null or undefined');
        }

        if (typeof targetTimezone !== 'string' || targetTimezone.trim() === '') {
            throw new InvalidArgumentError('Target timezone must be a non-empty string');
        }

        try {
            let dateObj;

            if (typeof date === 'string') {
                dateObj = dayjs(date);
            } else if (date instanceof Date) {
                dateObj = dayjs(date);
            } else {
                throw new InvalidArgumentError('Date must be a string or Date object');
            }

            if (!dateObj.isValid()) {
                throw new InvalidArgumentError('Invalid date format');
            }

            const convertedDate = dateObj.tz(targetTimezone);

            return convertedDate.format(format);
        } catch (error) {
            Helper.logError(error);
            if (error instanceof InvalidArgumentError) {
                throw error;
            }

            if (error.message.includes('time zone')) {
                throw new InvalidArgumentError(`Invalid timezone: ${targetTimezone}`);
            }

            throw new InvalidArgumentError(`Error converting date to timezone: ${error.message}`);
        }
    }

    /**
     * Reverse the order of elements in an array
     * @param {Array|string} array - The array to reverse or JSON string representing an array
     * @returns {Array} New array with elements in reverse order
     * @throws {InvalidArgumentError} If input is not an array or valid JSON array string
     */
    #reverseArray(array) {
        const parseIfString = (value) => {
            if (typeof value === 'string') {
                try {
                    return JSON.parse(value);
                } catch {
                    Helper.logError(`Invalid JSON string provided for reverseArray: ${value}`);
                    throw new InvalidArgumentError('Invalid JSON string provided for reverseArray');
                }
            }
            return value;
        };

        const parsedArray = parseIfString(array);

        if (!Array.isArray(parsedArray)) {
            throw new InvalidArgumentError('Input must be an array or JSON string representing an array');
        }

        const clonedArray = JSON.parse(JSON.stringify(parsedArray));
        return clonedArray.reverse();
    }

    /**
     * Get the current date in the specified format
     * @param {string} [format='YYYYMMDD'] - The desired format
     * @returns {string} Formatted current date
     */
    #currentDate(format = 'YYYYMMDD') {
        const dateObj = dayjs();
        return dateObj.format(format);
    }

    /**
     * Returns the value as-is (parsing if JSON string).
     * Context reference resolution is handled by the executor service after placement.
     * @param {any} value - The value to add to context (JSON object, array, or JSON string)
     * @returns {any} Parsed value
     * @throws {InvalidArgumentError} If value is null or undefined
     */
    #addToContext(value) {
        if (value === null || value === undefined) {
            throw new InvalidArgumentError('Value cannot be null or undefined for addToContext');
        }
        if (typeof value === 'string') {
            try {
                return JSON.parse(value);
            } catch {
                return value;
            }
        }
        return value;
    }

    /**
     * Deep-clones the resolved context value so it can be placed at a new
     * context position and recorded in the event metadata.
     *
     * The executor resolves the source path from `value_static`, passes the raw
     * value here, and then places the returned clone at `context_position`.
     *
     * @param {any} value - The already-resolved context value
     * @returns {any} Deep-cloned snapshot ready to be written elsewhere in context
     * @throws {InvalidArgumentError} If value is null/undefined or not serializable
     */
    #mapProperty(value) {
        if (value === null || value === undefined) {
            return value;
        }
        try {
            return JSON.parse(JSON.stringify(value));
        } catch (error) {
            Helper.logError('mapProperty: could not serialize context value', error);
            throw new InvalidArgumentError('mapProperty: context value is not serializable');
        }
    }

    /**
     * Returns the first of val1 or val2 that matches the given regex pattern.
     * Coerces non-null values to string before testing.
     * @param {any} val1 - First candidate value
     * @param {any} val2 - Second candidate value (may be null)
     * @param {string} pattern - Regex pattern string (required, non-empty)
     * @returns {any|null} First matching value, or null if none match
     * @throws {InvalidArgumentError} If pattern is not a non-empty string
     */
    #regexOr(val1, val2, pattern) {
        if (typeof pattern !== 'string' || pattern.trim() === '') {
            throw new InvalidArgumentError('regexOr: pattern must be a non-empty string');
        }
        const regex = new RegExp(pattern);
        const str1 = val1 != null ? String(val1) : null;
        const str2 = val2 != null ? String(val2) : null;
        if (str1 !== null && regex.test(str1)) return val1;
        if (str2 !== null && regex.test(str2)) return val2;
        return null;
    }

    /**
     * Divide two numbers
     * @param {number|string} dividend - The number to be divided
     * @param {number|string} divisor - The number to divide by
     * @returns {number} Result of the division
     * @throws {InvalidArgumentError} If inputs are not valid numbers or divisor is zero
     */
    #divide(dividend, divisor) {
        if (dividend == null) {
            throw new InvalidArgumentError('divide: dividend must be a valid number');
        }
        if (divisor == null) {
            throw new InvalidArgumentError('divide: divisor must be a valid number');
        }

        const numDividend = typeof dividend === 'number' ? dividend : Number(dividend);
        const numDivisor = typeof divisor === 'number' ? divisor : Number(divisor);

        if (isNaN(numDividend)) {
            throw new InvalidArgumentError('divide: dividend must be a valid number');
        }
        if (isNaN(numDivisor)) {
            throw new InvalidArgumentError('divide: divisor must be a valid number');
        }
        if (numDivisor === 0) {
            throw new InvalidArgumentError('divide: division by zero is not allowed');
        }

        return numDividend / numDivisor;
    }

    /**
     * Subtract two numbers (minuend - subtrahend)
     * @param {number|string} minuend - The number to subtract from
     * @param {number|string} subtrahend - The number to subtract
     * @returns {number} Result of the subtraction
     * @throws {InvalidArgumentError} If inputs are not valid numbers
     */
    #subtract(minuend, subtrahend) {
        if (minuend == null) {
            throw new InvalidArgumentError('subtract: minuend must be a valid number');
        }
        if (subtrahend == null) {
            throw new InvalidArgumentError('subtract: subtrahend must be a valid number');
        }

        const numMinuend = typeof minuend === 'number' ? minuend : Number(minuend);
        const numSubtrahend = typeof subtrahend === 'number' ? subtrahend : Number(subtrahend);

        if (isNaN(numMinuend)) {
            throw new InvalidArgumentError('subtract: minuend must be a valid number');
        }
        if (isNaN(numSubtrahend)) {
            throw new InvalidArgumentError('subtract: subtrahend must be a valid number');
        }

        return numMinuend - numSubtrahend;
    }

    /**
     * Add two numbers (augend + addend)
     * @param {number|string} augend - The first number to add
     * @param {number|string} addend - The second number to add
     * @returns {number} Result of the addition
     * @throws {InvalidArgumentError} If inputs are not valid numbers
     */
    #add(augend, addend) {
        if (augend == null) {
            throw new InvalidArgumentError('add: augend must be a valid number');
        }
        if (addend == null) {
            throw new InvalidArgumentError('add: addend must be a valid number');
        }

        const numAugend = typeof augend === 'number' ? augend : Number(augend);
        const numAddend = typeof addend === 'number' ? addend : Number(addend);

        if (isNaN(numAugend)) {
            throw new InvalidArgumentError('add: augend must be a valid number');
        }
        if (isNaN(numAddend)) {
            throw new InvalidArgumentError('add: addend must be a valid number');
        }

        return numAugend + numAddend;
    }

    /**
     * Get the absolute value of a number
     * @param {number|string} value - The number to get absolute value of
     * @returns {number} Absolute value (always non-negative)
     * @throws {InvalidArgumentError} If input is not a valid number
     */
    #abs(value) {
        if (value == null) {
            throw new InvalidArgumentError('abs: value must be a valid number');
        }

        const numValue = typeof value === 'number' ? value : Number(value);

        if (isNaN(numValue)) {
            throw new InvalidArgumentError('abs: value must be a valid number');
        }

        return Math.abs(numValue);
    }

    /**
     * Round a number up to the nearest integer (always towards positive infinity)
     * @param {number|string} value - The number to round up
     * @returns {number} Rounded up integer
     * @throws {InvalidArgumentError} If input is not a valid number
     */
    #ceil(value) {
        if (value == null) {
            throw new InvalidArgumentError('ceil: value must be a valid number');
        }

        const numValue = typeof value === 'number' ? value : Number(value);

        if (isNaN(numValue)) {
            throw new InvalidArgumentError('ceil: value must be a valid number');
        }

        return Math.ceil(numValue);
    }

    /**
     * Round a number down to the nearest integer (always towards negative infinity)
     * @param {number|string} value - The number to round down
     * @returns {number} Rounded down integer
     * @throws {InvalidArgumentError} If input is not a valid number
     */
    #floor(value) {
        if (value == null) {
            throw new InvalidArgumentError('floor: value must be a valid number');
        }

        const numValue = typeof value === 'number' ? value : Number(value);

        if (isNaN(numValue)) {
            throw new InvalidArgumentError('floor: value must be a valid number');
        }

        return Math.floor(numValue);
    }

    #parseValueWithTimezone(rawValue) {
        const str = String(rawValue ?? '');
        const commaIdx = str.indexOf(',');
        if (commaIdx === -1) return { numericValue: str, timezone: null };
        const numericValue = str.slice(0, commaIdx).trim();
        const rest = str.slice(commaIdx + 1).trim();
        // If rest contains another comma the format is invalid; pass it through so dayjs.tz throws RangeError
        if (rest.includes(',')) {
            return { numericValue, timezone: rest };
        }
        return { numericValue, timezone: rest || null };
    }

    /**
     * Returns true when the date already encodes a specific moment in time
     * (a JS Date object or a string with an explicit UTC/offset suffix),
     * meaning the timezone parameter should be ignored and not applied.
     */
    #hasExplicitOffset(date) {
        if (date instanceof Date) return true;
        if (typeof date !== 'string') return false;
        return /Z$/i.test(date.trim()) || /[+-]\d{2}:\d{2}$/.test(date.trim());
    }

    #normalizeDateString(date) {
        if (typeof date !== 'string') return date;
        return date.trim().replace(/T\s+/g, 'T').replace(/:\s+/g, ':');
    }

    #buildDateObj(date, timezone, fnName) {
        const normalized = this.#normalizeDateString(date);
        const useTimezone = timezone && !this.#hasExplicitOffset(normalized);
        let dateObj;
        try {
            dateObj = useTimezone ? dayjs.tz(normalized, timezone) : dayjs.utc(normalized);
        } catch (error) {
            // dayjs.tz throws RangeError for invalid IANA timezones
            throw new InvalidArgumentError(`${fnName}: invalid timezone "${timezone}"`);
        }
        if (!dateObj.isValid()) {
            throw new InvalidArgumentError(`${fnName}: invalid date format`);
        }
        return dateObj;
    }

    /**
     * Add minutes to a date
     * @param {string|Date} date - The date to add minutes to
     * @param {number|string} minutes - Minutes to add; optionally "minutes,IANA_timezone" to interpret naive dates in that timezone
     * @returns {string} New date in ISO format (YYYY-MM-DDTHH:mm:ssZ)
     * @throws {InvalidArgumentError} If date or minutes are invalid
     */
    #addMinutes(date, minutes) {
        if (date == null) {
            throw new InvalidArgumentError('addMinutes: date must be a valid date');
        }

        const { numericValue, timezone } = this.#parseValueWithTimezone(minutes);
        const minutesNum = typeof numericValue === 'number' ? numericValue : Number(numericValue);
        if (isNaN(minutesNum)) {
            throw new InvalidArgumentError('addMinutes: minutes must be a valid number');
        }

        return this.#buildDateObj(date, timezone, 'addMinutes').add(minutesNum, 'minute').toISOString();
    }

    /**
     * Add hours to a date
     * @param {string|Date} date - The date to add hours to
     * @param {number|string} hours - Hours to add; optionally "hours,IANA_timezone" to interpret naive dates in that timezone
     * @returns {string} New date in ISO format (YYYY-MM-DDTHH:mm:ssZ)
     * @throws {InvalidArgumentError} If date or hours are invalid
     */
    #addHours(date, hours) {
        if (date == null) {
            throw new InvalidArgumentError('addHours: date must be a valid date');
        }

        const { numericValue, timezone } = this.#parseValueWithTimezone(hours);
        const hoursNum = typeof numericValue === 'number' ? numericValue : Number(numericValue);
        if (isNaN(hoursNum)) {
            throw new InvalidArgumentError('addHours: hours must be a valid number');
        }

        return this.#buildDateObj(date, timezone, 'addHours').add(hoursNum, 'hour').toISOString();
    }

    /**
     * Add days to a date
     * @param {string|Date} date - The date to add days to
     * @param {number|string} days - Days to add; optionally "days,IANA_timezone" to interpret naive dates in that timezone
     * @returns {string} New date in ISO format (YYYY-MM-DDTHH:mm:ssZ)
     * @throws {InvalidArgumentError} If date or days are invalid
     */
    #addDays(date, days) {
        if (date == null) {
            throw new InvalidArgumentError('addDays: date must be a valid date');
        }

        const { numericValue, timezone } = this.#parseValueWithTimezone(days);
        const daysNum = typeof numericValue === 'number' ? numericValue : Number(numericValue);
        if (isNaN(daysNum)) {
            throw new InvalidArgumentError('addDays: days must be a valid number');
        }

        return this.#buildDateObj(date, timezone, 'addDays').add(daysNum, 'day').toISOString();
    }

    /**
     * Subtract minutes from a date
     * @param {string|Date} date - The date to subtract minutes from
     * @param {number|string} minutes - Minutes to subtract; optionally "minutes,IANA_timezone" to interpret naive dates in that timezone
     * @returns {string} New date in ISO format (YYYY-MM-DDTHH:mm:ssZ)
     * @throws {InvalidArgumentError} If date or minutes are invalid
     */
    #subtractMinutes(date, minutes) {
        if (date == null) {
            throw new InvalidArgumentError('subtractMinutes: date must be a valid date');
        }

        const { numericValue, timezone } = this.#parseValueWithTimezone(minutes);
        const minutesNum = typeof numericValue === 'number' ? numericValue : Number(numericValue);
        if (isNaN(minutesNum)) {
            throw new InvalidArgumentError('subtractMinutes: minutes must be a valid number');
        }

        return this.#buildDateObj(date, timezone, 'subtractMinutes').subtract(minutesNum, 'minute').toISOString();
    }

    /**
     * Subtract hours from a date
     * @param {string|Date} date - The date to subtract hours from
     * @param {number|string} hours - Hours to subtract; optionally "hours,IANA_timezone" to interpret naive dates in that timezone
     * @returns {string} New date in ISO format (YYYY-MM-DDTHH:mm:ssZ)
     * @throws {InvalidArgumentError} If date or hours are invalid
     */
    #subtractHours(date, hours) {
        if (date == null) {
            throw new InvalidArgumentError('subtractHours: date must be a valid date');
        }

        const { numericValue, timezone } = this.#parseValueWithTimezone(hours);
        const hoursNum = typeof numericValue === 'number' ? numericValue : Number(numericValue);
        if (isNaN(hoursNum)) {
            throw new InvalidArgumentError('subtractHours: hours must be a valid number');
        }

        return this.#buildDateObj(date, timezone, 'subtractHours').subtract(hoursNum, 'hour').toISOString();
    }

    /**
     * Subtract days from a date
     * @param {string|Date} date - The date to subtract days from
     * @param {number|string} days - Days to subtract; optionally "days,IANA_timezone" to interpret naive dates in that timezone
     * @returns {string} New date in ISO format (YYYY-MM-DDTHH:mm:ssZ)
     * @throws {InvalidArgumentError} If date or days are invalid
     */
    #subtractDays(date, days) {
        if (date == null) {
            throw new InvalidArgumentError('subtractDays: date must be a valid date');
        }

        const { numericValue, timezone } = this.#parseValueWithTimezone(days);
        const daysNum = typeof numericValue === 'number' ? numericValue : Number(numericValue);
        if (isNaN(daysNum)) {
            throw new InvalidArgumentError('subtractDays: days must be a valid number');
        }

        return this.#buildDateObj(date, timezone, 'subtractDays').subtract(daysNum, 'day').toISOString();
    }

    /**
     * Filter an array of objects by a condition on a property.
     * Condition format: "field=value" or "field!=value"
     * @param {Array|string} array - Array of objects (or JSON string)
     * @param {string} condition   - Filter condition, e.g. "status=Pendiente"
     * @returns {Object|null} First object that satisfies the condition, or null if none found
     * @throws {InvalidArgumentError} If inputs are invalid or condition format is wrong
     */
    #filterArray(array, condition) {
        if (typeof condition !== 'string' || condition.trim() === '') {
            throw new InvalidArgumentError('filterArray: condition must be a non-empty string');
        }

        const parseIfString = (value) => {
            if (typeof value === 'string') {
                try {
                    return JSON.parse(value);
                } catch {
                    throw new InvalidArgumentError('filterArray: array must be a valid JSON array string');
                }
            }
            return value;
        };

        const parsedArray = parseIfString(array);

        if (!Array.isArray(parsedArray)) {
            throw new InvalidArgumentError('filterArray: input must be an array or JSON string representing an array');
        }

        const match = condition.match(/^(.+?)(!=|=)(.*)$/);
        if (!match) {
            throw new InvalidArgumentError(
                `filterArray: invalid condition format "${condition}". Expected "field=value" or "field!=value"`
            );
        }

        const [, field, operator, rawValue] = match;
        const fieldTrimmed = field.trim();
        const valueTrimmed = rawValue.trim();

        return (
            parsedArray.find((item) => {
                if (typeof item !== 'object' || item === null) return false;
                const itemValue = String(NestedValueManager.getValue(item, fieldTrimmed) ?? '');
                return operator === '=' ? itemValue === valueTrimmed : itemValue !== valueTrimmed;
            }) ?? null
        );
    }

    #normalizeChannelHubRule(rule) {
        if (!rule || typeof rule !== 'object' || Array.isArray(rule)) {
            throw new InvalidArgumentError('normalizeChannelHubRule: rule must be an object');
        }

        const output = {};
        const baseFields = ['connectionId', 'ruleName'];
        const optionalFields = ['webhooks'];
        const conflictPairs = [
            ['subjectContains', 'subjectEquals'],
            ['toContains', 'toEquals'],
            ['bodyContains', 'bodyEquals'],
            ['ccContains', 'ccEquals'],
            ['fromContains', 'fromEquals'],
        ];

        for (const field of baseFields) {
            this.#setChannelHubRuleFieldIfPresent(output, field, rule[field]);
        }

        for (const [containsField, equalsField] of conflictPairs) {
            const containsValue = this.#normalizeChannelHubRuleValue(rule[containsField]);
            const equalsValue = this.#normalizeChannelHubRuleValue(rule[equalsField]);

            if (containsValue !== undefined) {
                output[containsField] = containsValue;
            } else if (equalsValue !== undefined) {
                output[equalsField] = equalsValue;
            }
        }

        for (const field of optionalFields) {
            this.#setChannelHubRuleFieldIfPresent(output, field, rule[field]);
        }

        this.#setChannelHubRuleFieldIfPresent(output, 'actionRules', rule.actionRules);

        this.#requireChannelHubRuleField(output, 'connectionId');
        this.#requireChannelHubRuleField(output, 'ruleName');
        if (!output.actionRules || !this.#hasChannelHubRuleContent(output.actionRules.classifyAs)) {
            throw new InvalidArgumentError('normalizeChannelHubRule: actionRules.classifyAs is required');
        }

        return output;
    }

    #setChannelHubRuleFieldIfPresent(target, key, value) {
        const normalized = this.#normalizeChannelHubRuleValue(value);
        if (normalized !== undefined) {
            target[key] = normalized;
        }
    }

    #requireChannelHubRuleField(target, key) {
        if (!this.#hasChannelHubRuleContent(target[key])) {
            throw new InvalidArgumentError(`normalizeChannelHubRule: ${key} is required`);
        }
    }

    #hasChannelHubRuleContent(value) {
        return this.#normalizeChannelHubRuleValue(value) !== undefined;
    }

    #normalizeChannelHubRuleValue(value) {
        if (value === null || value === undefined) {
            return undefined;
        }

        if (typeof value === 'string') {
            const trimmed = value.trim();
            return trimmed === '' ? undefined : trimmed;
        }

        if (Array.isArray(value)) {
            const normalizedItems = value
                .map((item) => this.#normalizeChannelHubRuleValue(item))
                .filter((item) => item !== undefined);
            return normalizedItems.length === 0 ? undefined : normalizedItems;
        }

        if (typeof value === 'object') {
            const normalizedObject = Object.entries(value).reduce((accumulator, [key, nestedValue]) => {
                const normalizedNestedValue = this.#normalizeChannelHubRuleValue(nestedValue);
                if (normalizedNestedValue !== undefined) {
                    accumulator[key] = normalizedNestedValue;
                }
                return accumulator;
            }, {});

            return Object.keys(normalizedObject).length === 0 ? undefined : normalizedObject;
        }

        return value;
    }

    /**
     * Filters an array of objects using multiple AND conditions separated by `|`.
     * Returns all matching elements (e.g., "field=value" or "field!=value").
     *
     * Example: "status=active|role=admin"
     *
     * @param {Array|string} array - Array or JSON string
     * @param {string} conditions - Pipe-separated conditions
     * @returns {Array} All matching elements
     * @throws {InvalidArgumentError} If inputs are invalid or condition format is wrong
     */
    #filterArrayAll(array, conditions) {
        if (typeof conditions !== 'string' || conditions.trim() === '') {
            throw new InvalidArgumentError('filterArrayAll: conditions must be a non-empty string');
        }

        const parseIfString = (value) => {
            if (typeof value === 'string') {
                try {
                    return JSON.parse(value);
                } catch {
                    throw new InvalidArgumentError('filterArrayAll: array must be a valid JSON array string');
                }
            }
            return value;
        };

        const parsedArray = parseIfString(array);

        if (!Array.isArray(parsedArray)) {
            throw new InvalidArgumentError(
                'filterArrayMulti: input must be an array or JSON string representing an array'
            );
        }

        const conditionList = conditions
            .split('|')
            .map((c) => c.trim())
            .filter(Boolean);

        const parsedConditions = conditionList.map((condition) => {
            const match = condition.match(/^(.+?)(!=|=)(.*)$/);
            if (!match) {
                throw new InvalidArgumentError(
                    `filterArrayMulti: invalid condition format "${condition}". Expected "field=value" or "field!=value"`
                );
            }
            const [, field, operator, rawValue] = match;
            return { field: field.trim(), operator, value: rawValue.trim() };
        });

        return parsedArray.filter((item) => {
            if (typeof item !== 'object' || item === null) return false;
            return parsedConditions.every(({ field, operator, value }) => {
                const itemValue = String(NestedValueManager.getValue(item, field) ?? '');
                return operator === '=' ? itemValue === value : itemValue !== value;
            });
        });
    }

    /**
     * Filters `targetArray` to keep only elements where `matchField` values exist in `lookupArray`'s `lookupField`.
     *
     * Config: "lookupField,matchField"
     * Example Config: "id,data.gc_id"
     *
     * Returns `[]` if either array is empty or null — nothing to cross-reference.
     *
     * @param {Array|string|null} lookupArray - Lookup array or JSON string; null/empty returns []
     * @param {Array|string|null} targetArray - Array to filter or JSON string; null/empty returns []
     * @param {string} config - "lookupField,matchField"
     * @returns {Array} Filtered targetArray
     * @throws {InvalidArgumentError} If config is invalid or a non-null/non-array value is provided
     */
    #filterArrayIn(lookupArray, targetArray, config) {
        if (typeof config !== 'string' || config.trim() === '') {
            throw new InvalidArgumentError('filterArrayIn: config must be a non-empty string');
        }

        const parseIfString = (value, label) => {
            if (typeof value === 'string') {
                try {
                    return JSON.parse(value);
                } catch {
                    throw new InvalidArgumentError(`filterArrayIn: ${label} must be a valid JSON array string`);
                }
            }
            return value;
        };

        const parsedLookup = parseIfString(lookupArray, 'lookupArray');
        const parsedTarget = parseIfString(targetArray, 'targetArray');

        if (parsedLookup == null || parsedTarget == null) return [];

        if (!Array.isArray(parsedLookup)) {
            throw new InvalidArgumentError(
                'filterArrayIn: lookupArray must be an array or JSON string representing an array'
            );
        }
        if (!Array.isArray(parsedTarget)) {
            throw new InvalidArgumentError(
                'filterArrayIn: targetArray must be an array or JSON string representing an array'
            );
        }

        if (parsedLookup.length === 0 || parsedTarget.length === 0) return [];

        const parts = config.split(',').map((p) => p.trim());

        if (parts.length !== 2 || !parts[0] || !parts[1]) {
            throw new InvalidArgumentError(
                `filterArrayIn: invalid config "${config}". Expected "lookupField,matchField"`
            );
        }

        const [lookupField, matchField] = parts;

        const lookupSet = new Set(
            parsedLookup
                .map((item) => NestedValueManager.getValue(item, lookupField))
                .filter((v) => v !== undefined && v !== null)
                .map(String)
        );

        return parsedTarget.filter((item) => {
            if (typeof item !== 'object' || item === null) return false;
            const itemValue = NestedValueManager.getValue(item, matchField);
            return itemValue !== undefined && itemValue !== null && lookupSet.has(String(itemValue));
        });
    }

    /**
     * Extract one or more fields from every element of an array.
     * Config format: `"field.path"` or `"field.path|separator"` (pipe separates fields from join separator).
     * Use comma-separated paths for multi-field mode (returns array of objects).
     * Use `"$"` to return each primitive element as-is.
     * @param {Array|string} array  - Array of items (or JSON string thereof)
     * @param {string}       config - `"fields"` or `"fields|separator"`
     * @returns {Array|string} Extracted values, picked objects, or joined string
     * @throws {InvalidArgumentError} If inputs are invalid or separator is used in multi-field mode
     */
    #selectArray(array, config) {
        if (typeof config !== 'string' || config.trim() === '') {
            throw new InvalidArgumentError('selectArray: config must be a non-empty string');
        }

        const pipeIdx = config.indexOf('|');
        const fields = pipeIdx !== -1 ? config.slice(0, pipeIdx) : config;
        const separator = pipeIdx !== -1 ? config.slice(pipeIdx + 1) : undefined;

        if (fields.trim() === '') {
            throw new InvalidArgumentError('selectArray: fields part of config must be a non-empty string');
        }

        let parsedArray = array;
        if (typeof array === 'string') {
            try {
                parsedArray = JSON.parse(array);
            } catch {
                throw new InvalidArgumentError('selectArray: array must be a valid JSON array string');
            }
        }

        if (!Array.isArray(parsedArray)) {
            throw new InvalidArgumentError(
                'selectArray: first argument must be an array or a JSON string representing an array'
            );
        }

        const fieldPaths = fields
            .split(',')
            .map((f) => f.trim())
            .filter(Boolean);

        if (fieldPaths.length === 0) {
            throw new InvalidArgumentError('selectArray: fields must contain at least one non-empty path');
        }

        const isMultiField = fieldPaths.length > 1;
        const isSelf = !isMultiField && fieldPaths[0] === '$';

        if (isMultiField && separator !== undefined) {
            throw new InvalidArgumentError('selectArray: separator is not supported in multi-field mode');
        }

        const result = parsedArray.reduce((acc, item) => {
            if (item == null) return acc;

            if (isSelf) {
                acc.push(item);
            } else if (typeof item === 'object') {
                if (isMultiField) {
                    const picked = {};
                    for (const path of fieldPaths) {
                        const value = NestedValueManager.getValue(item, path);
                        if (value !== undefined) picked[path] = value;
                    }
                    acc.push(picked);
                } else {
                    const value = NestedValueManager.getValue(item, fieldPaths[0]);
                    if (value != null) acc.push(value);
                }
            }
            return acc;
        }, []);

        if (separator !== undefined) {
            return result.join(separator);
        }

        return JSON.parse(JSON.stringify(result));
    }
}
