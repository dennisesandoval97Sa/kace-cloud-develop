import { ValidationFailError } from '../../errors/ValidationFailError';
import { Helper } from '../../infrastructure/utils/Helper';

export class GlobalContextProcessor {
    /**
     * The global context used for replacing values in the context.
     *
     * @private
     * @type {import('./GlobalContext').GlobalContext} globalContext
     */
    #globalContext;

    /**
     * A static array of allowed keys for context replacement.
     * Only these keys can be used for replacements in the global context.
     *
     * @private
     * @type {Array<string>}
     */
    static #allowedKeys = ['body', 'headers'];

    /**
     * @constructor
     * Initializes the GlobalContextProcessor with a provided global context.
     *
     * @param {GlobalContext} globalContext - The global context to be used for replacing values.
     */
    constructor(globalContext) {
        this.#globalContext = globalContext;
    }

    /**
     * Replaces values in the given input, either a string or an object.
     *
     * @param {string|Object} input - The input value, which can be either a string or an object to process.
     * @returns {Promise<string|Object>} The processed value with replaced contexts.
     */
    async replace(input) {
        this.#validateInput(input);

        if (typeof input === 'string') {
            return this.#replaceString(input);
        }

        const [key] = Object.keys(input);
        this.#validateAllowedKey(key);

        return this.#replaceObjectContent(input[key], key);
    }

    /**
     * Validates the input type to ensure it's either a string or a valid object.
     *
     * @param {any} input - The value to validate.
     * @throws {ValidationFailError} If the input is not a string or an object.
     */
    #validateInput(input) {
        const valid = typeof input === 'string' || (input && typeof input === 'object' && !Array.isArray(input));
        if (!valid) {
            throw new ValidationFailError(`GlobalContextProcessor: Invalid input type.`);
        }
    }

    /**
     * Validates that the provided key is allowed for context replacement.
     *
     * @param {string} key - The key to check.
     * @throws {ValidationFailError} If the key is not allowed.
     */
    #validateAllowedKey(key) {
        if (!GlobalContextProcessor.#allowedKeys.includes(key)) {
            throw new ValidationFailError(
                `Key '${key}' is not allowed. Allowed: ${GlobalContextProcessor.#allowedKeys.join(', ')}.`
            );
        }
    }

    /**
     * Replaces a string value containing a context path with its corresponding value from GlobalContext.
     *
     * @param {string} value - The string value to replace.
     * @returns {Promise<string>} The replaced string value.
     */
    async #replaceString(value) {
        const replaced = await this.#getContextDataFromText(value);
        return this.#unwrapDataContext(replaced);
    }

    /**
     * Processes an input object or string for context replacement.
     * If the input is serializable to JSON and contains context paths, they will be replaced.
     *
     * @param {any} input - The input value to process (object or string).
     * @param {string} key - The key associated with the input for result remapping.
     * @returns {Promise<any>} The processed value with context values replaced.
     */
    async #replaceObjectContent(input, key) {
        if (!input) {
            return input;
        }

        if (typeof input === 'string') {
            const replaced = await this.#replaceString(input);
            return { [key]: replaced };
        }

        const serialized = JSON.stringify(input);
        const replaced = await this.#replaceContext(serialized);

        return this.#renameKey(replaced, key);
    }
    /**
     * Extracts prefix, context path, and suffix from a string containing a context reference.
     *
     * @param {string} value - The string to analyze.
     * @returns {{ prefix: string, contextPath: string, suffix: string } | null}
     */
    #extractContextParts(value) {
        // SONAR-EXC: Esto permite capturar casos donde no hay nada antes de 'context'.
        const regex = /^(.*?)(context(?:\.\w+|\[\d+\])+)(.*)?$/s;
        const match = value.match(regex);
        if (!match) {
            return null;
        }

        const [, prefix = '', contextPath, suffix = ''] = match;
        return { prefix, contextPath, suffix };
    }
    /**
     * Cleans a full context path string by removing the initial "context." prefix.
     *
     * @param {string} path - The raw context path.
     * @returns {string} The cleaned path.
     */
    #cleanContextPath(path) {
        return path.replace(/^context\./, '');
    }
    /**
     * Extracts the last segment of a context path to be used as a key in GlobalContext.
     *
     * @param {string} path - The cleaned context path.
     * @returns {string} The final key segment.
     */
    #extractFinalKeyFromPath(path) {
        return path
            .split(/[.\[\]]/)
            .filter(Boolean)
            .pop();
    }
    /**
     * Fetches the value from the GlobalContext for a given context path.
     *
     * @param {string} path - The raw context path (with or without "context." prefix).
     * @returns {Promise<any>} The value obtained from GlobalContext.
     */
    async #getValueFromContext(path) {
        const cleanPath = this.#cleanContextPath(path);
        const contextResult = await this.#globalContext.getByFilterInput([cleanPath]);
        const finalKey = this.#extractFinalKeyFromPath(cleanPath);

        const dataProcessed = contextResult.dataProcessed ?? {};
        const resolved = contextResult.resolved ?? false;

        if (!resolved) {
            Helper.logDebug('GlobalContextProcessor: context key not found, value set to null', { path });
            return null;
        }

        // resolved=true but hasKey=false means #updateProcessedData stored the value
        // directly as dataProcessed (array/object case — no key wrapper applied).
        const hasKey = Object.hasOwn(dataProcessed, finalKey);
        if (!hasKey) {
            const dp = dataProcessed;
            if (Array.isArray(dp) || (dp && typeof dp === 'object' && Object.keys(dp).length > 0)) {
                return dp;
            }
            return null;
        }

        const value = dataProcessed[finalKey];
        if (value === undefined) {
            return path.replace('context.', 'context_undefined.');
        }
        return value;
    }

    /**
     * Replaces a context path inside a plain string with its value from GlobalContext.
     *
     * @param {string} text - The input text containing a context path.
     * @returns {Promise<string>} The text with the context value replaced.
     */
    async #getContextDataFromText(text) {
        this.#ensureIsString(text);

        while (text.includes('context.')) {
            const parts = this.#extractContextParts(text);
            if (!parts) {
                return text;
            }

            const { prefix, contextPath, suffix } = parts;
            const value = await this.#getValueFromContext(contextPath);

            // Fix: se incluye null para evitar que `${null}` interpole el string literal "null".
            if (value === undefined || value === null) {
                return null;
            }

            // When the resolved value is an array or object and there is no surrounding text
            // (prefix/suffix), return it directly instead of coercing it to a string like
            // "[object Object]". This supports plain-text bodies that ARE a context reference.
            if (typeof value === 'object' && !prefix && !suffix) {
                return value;
            }

            text = `${prefix}${value}${suffix}`;
        }

        return text;
    }

    /**
     * Replaces all context paths inside a JSON string with their values from GlobalContext.
     *
     * @param {string} jsonText - A JSON string possibly containing context paths.
     * @returns {Promise<{ dataProcessed: Object }>} The resulting object with replaced context values.
     */
    async #replaceContext(jsonText) {
        this.#ensureIsString(jsonText);

        let rawObj = JSON.parse(jsonText);
        while (jsonText.includes('context.')) {
            rawObj = JSON.parse(jsonText);
            const contextMap = this.#buildContextMap(rawObj);
            const prefixSuffixMap = this.#buildPrefixSuffixMap(rawObj);

            rawObj = await this.#replaceKeysAndValues(rawObj, contextMap, prefixSuffixMap);
            const newJsonText = JSON.stringify(rawObj);

            if (newJsonText === jsonText) {
                break;
            }
            jsonText = newJsonText;
        }

        return { dataProcessed: rawObj };
    }
    /**
     * Builds a map of keys to context paths found in a given object.
     *
     * @param {Object} obj - The input object to inspect.
     * @returns {Object} A map of keys to context paths.
     */
    #buildContextMap(obj) {
        const contextMap = {};

        for (const [key, value] of Object.entries(obj)) {
            if (typeof value === 'string') {
                const parts = this.#extractContextParts(value);
                if (parts) {
                    contextMap[key] = parts.contextPath;
                }
            } else if (typeof value === 'object' && value !== null) {
                contextMap[key] = this.#buildContextMap(value);
            }
        }

        return contextMap;
    }

    /**
     * Replaces both keys and values that contain context paths in a single pass.
     *
     * @param {Object} obj - The original object.
     * @param {Object} contextMap - A map of keys to context paths.
     * @param {Object} prefixSuffixMap - A map of keys to prefix/suffix info.
     * @returns {Promise<Object>} The updated object with both keys and values replaced.
     */
    async #replaceKeysAndValues(obj, contextMap, prefixSuffixMap) {
        if (Array.isArray(obj)) {
            return this.#processArray(obj);
        }

        if (!obj || typeof obj !== 'object') {
            return obj;
        }

        const result = {};

        for (const [key, value] of Object.entries(obj)) {
            let newKey = key;
            let newValue = value;

            const keyParts = this.#extractContextParts(key);
            if (keyParts) {
                const keyContextValue = await this.#getValueFromContext(keyParts.contextPath);
                if (keyContextValue === null) {
                    newKey = `${keyParts.prefix}${keyParts.contextPath.replace(/^context\./, 'context_undefined.')}${keyParts.suffix}`;
                } else if (keyContextValue !== undefined) {
                    if (typeof keyContextValue === 'object' && keyContextValue !== null) {
                        const keys = keyParts.contextPath.split(/[.[\]]/g).filter(Boolean);
                        const lastKey = keys[keys.length - 1];
                        newKey = keyContextValue[lastKey] || key;
                    } else {
                        newKey = `${keyParts.prefix}${keyContextValue}${keyParts.suffix}`;
                    }
                }
            }

            const contextPath = contextMap[key];
            if (typeof contextPath === 'string') {
                const valueContextValue = await this.#getValueFromContext(contextPath);
                if (valueContextValue === undefined) {
                    newValue = null;
                } else {
                    const { prefix = '', suffix = '' } = prefixSuffixMap[key] || {};
                    if (prefix || suffix) {
                        newValue = `${prefix}${valueContextValue}${suffix}`;
                    } else {
                        newValue = valueContextValue;
                    }
                }
            } else if (typeof contextPath === 'object' && contextPath !== null) {
                newValue = await this.#replaceKeysAndValues(value, contextPath, prefixSuffixMap[key] || {});
            } else if (typeof value === 'object' && value !== null) {
                newValue = await this.#replaceKeysAndValues(value, {}, {});
            } else if (typeof value === 'string') {
                newValue = await this.#processStringItem(value);
            }

            result[newKey] = newValue;
        }

        return result;
    }

    /**
     * Processes an array by applying context replacement to each element.
     *
     * @param {Array} arr - The array to process.
     * @returns {Promise<Array>} The processed array with context values replaced.
     */
    async #processArray(arr) {
        const result = [];

        for (const item of arr) {
            if (typeof item === 'string') {
                result.push(await this.#processStringItem(item));
            } else if (typeof item === 'object' && item !== null) {
                result.push(await this.#replaceKeysAndValues(item, {}, {}));
            } else {
                result.push(item);
            }
        }

        return JSON.parse(JSON.stringify(result));
    }

    /**
     * Processes a string item from an array that may contain context references.
     *
     * @param {string} item - The string item to process.
     * @returns {Promise<any>} The processed item.
     */
    async #processStringItem(item) {
        const parts = this.#extractContextParts(item);
        if (!parts) {
            return item;
        }

        const trimmed = item.trim();
        if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
            try {
                const parsed = JSON.parse(trimmed);
                if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                    const replaced = await this.#replaceContext(trimmed);
                    return JSON.stringify(replaced.dataProcessed);
                }
            } catch {
                // Not valid JSON — fall through to normal string processing.
            }
        }

        const value = await this.#getValueFromContext(parts.contextPath);
        // Fix: mismo caso que #getContextDataFromText, evitar interpolación de null a string "null".
        if (value === undefined || value === null) {
            return null;
        }
        return `${parts.prefix}${value}${parts.suffix}`;
    }

    /**
     * Builds a map of keys to prefix/suffix info, including nested objects
     *
     * @param {Object} obj - The input object to inspect.
     * @returns {Object} A map of keys to prefix/suffix info.
     */
    #buildPrefixSuffixMap(obj) {
        const map = {};

        for (const [key, value] of Object.entries(obj)) {
            if (typeof value === 'string') {
                const parts = this.#extractContextParts(value);
                if (parts && (parts.prefix || parts.suffix)) {
                    map[key] = { prefix: parts.prefix, suffix: parts.suffix };
                }
            } else if (typeof value === 'object' && value !== null) {
                map[key] = this.#buildPrefixSuffixMap(value);
            }
        }

        return map;
    }

    /**
     * Checks if the value contains a `dataContext` property.
     *
     * @param {any} value - The value to check.
     * @returns {boolean} `true` if the value has `dataContext`, `false` otherwise.
     */
    #unwrapDataContext(value) {
        if (value?.dataProcessed && Object.keys(value.dataProcessed).length === 1) {
            return Object.values(value.dataProcessed)[0];
        }
        return value;
    }

    /**
     * Renames the `dataContext` property to a new key.
     *
     * @param {Object} obj - The object containing the `dataContext` property.
     * @param {string} newKey - The new key for the `dataContext`.
     * @returns {Object} The object with the `dataContext` renamed.
     */
    #renameKey(obj, newKey) {
        if (obj?.dataProcessed) {
            obj[newKey] = obj.dataProcessed;
            delete obj.dataProcessed;
        }
        return obj;
    }

    /**
     * Ensures that the value is a valid string.
     *
     * @param {any} value - The value to check.
     * @throws {ValidationFailError} If the value is not a string.
     */
    #ensureIsString(value) {
        if (typeof value !== 'string') {
            throw new ValidationFailError(`Expected a string.`);
        }
    }
}
