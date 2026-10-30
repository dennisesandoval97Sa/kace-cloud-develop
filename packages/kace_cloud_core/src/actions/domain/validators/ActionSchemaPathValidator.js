export class ActionSchemaPathValidator {
    /**
     * Checks whether a given dot‐notation path exists in a nested schema definition.
     * @param {Object} dataStructure - An object representing nested schema definitions.
     * @param {string} path          - A path string using dot notation
     * @returns {boolean}            - True if every step of the path resolves to a defined node; false otherwise.
     */
    static validate(dataStructure, path) {
        if (!dataStructure || !path || typeof dataStructure !== 'object' || typeof path !== 'string') return false;

        const fields = path.split('.').filter(Boolean);

        let currentDataStructure = dataStructure.data_structure;
        for (const key of fields) {
            if (currentDataStructure === undefined || currentDataStructure === null || !(key in currentDataStructure)) {
                return false;
            }
            currentDataStructure = currentDataStructure[key]?.data_structure ?? currentDataStructure[key];
        }

        return true;
    }
}
