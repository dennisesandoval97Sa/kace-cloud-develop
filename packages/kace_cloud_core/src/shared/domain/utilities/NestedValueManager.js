export class NestedValueManager {
    /**
     * Gets a nested value from an object using dot notation or array notation
     * @param {Object} obj - The object to search in
     * @param {string} path - The path to the value (e.g., "data.user.name" or "data[0].user.name")
     * @returns {*} The value found or undefined if not found
     */
    static getValue(obj, path) {
        if (!obj || typeof obj !== 'object' || !path || typeof path !== 'string') {
            return undefined;
        }

        const keys = path.split(/[.[\]]/g).filter((p) => p !== '');
        let current = obj;

        for (const key of keys) {
            if (current === null || current === undefined) {
                return undefined;
            }
            current = current[key];
        }

        return typeof current === 'object' && current !== null ? JSON.parse(JSON.stringify(current)) : current;
    }

    /**
     * Sets a nested value in an object using dot notation or array notation
     * @param {Object} obj - The object to modify
     * @param {string} path - The path to set the value (e.g., "data.user.name")
     * @param {*} value - The value to set
     * @returns {boolean} True if the value was set successfully, false otherwise
     */
    static setValue(obj, path, value) {
        if (!obj || typeof obj !== 'object' || !path || typeof path !== 'string') {
            return false;
        }

        const keys = path.split(/[.[\]]/g).filter((p) => p !== '');
        let current = obj;

        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];

            if (current[key] === undefined || current[key] === null) {
                const nextKey = keys[i + 1];
                const isNextArray = !isNaN(nextKey) && parseInt(nextKey, 10).toString() === nextKey;
                current[key] = isNextArray ? [] : {};
            }
            current = current[key];
        }

        const lastKey = keys[keys.length - 1];
        if (value !== null && typeof value === 'object') {
            current[lastKey] = JSON.parse(JSON.stringify(value));
        } else {
            current[lastKey] = value;
        }
        return true;
    }
}
