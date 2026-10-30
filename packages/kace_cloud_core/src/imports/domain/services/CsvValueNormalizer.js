import { Helper } from '../../../shared';

export class CsvValueNormalizer {
    /**
     * Normaliza un valor proveniente de un archivo CSV
     * @param {string} value
     * @returns {any}
     */
    static normalize(value) {
        if (value === 'null' || value === '' || value === undefined) return null;

        if (value === 'true') return true;
        if (value === 'false') return false;

        if (value.startsWith('{')) {
            try {
                return JSON.parse(value);
            } catch (error) {
                Helper.logError(error);
                throw new Error(`Error (CsvValueNormalizer) parsing JSON: ${error}`);
            }
        }

        if (value.includes('[') && value.includes(']')) {
            try {
                return JSON.parse(JSON.stringify(value));
            } catch (error) {
                Helper.logError(error);
                throw new Error(`Error (CsvValueNormalizer) parsing array-like JSON: ${error}`);
            }
        }

        if (!isNaN(value)) {
            return value.includes('.') ? parseFloat(value) : parseInt(value, 10);
        }

        if (value.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/)) {
            return new Date(value.replace(/"/g, ''));
        }

        return value.replace(/"/g, '');
    }
}
