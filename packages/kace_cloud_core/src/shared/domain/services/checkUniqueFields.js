/**
 * Validates unique field constraints against the database.
 * Recurses into object fields to check nested unique constraints, mirroring how
 * SchemaBuilder validates required/type for nested fields.
 *
 * @param {Object} dataStructure - The schema's data_structure object
 * @param {Object} incomingData - The validated data payload being inserted/updated
 * @param {Object} repository - Any KnexRepository instance (provides existsByFieldValue)
 * @param {string} tableName - The auxiliary table to query
 * @param {Object|null} excludeCondition - Knex whereNot condition to exclude the current record
 *   e.g. { id: recordId } for general auxiliaries, { caso_id: caseId } for aux_casos
 * @param {string[]} pathPrefix - Internal: accumulated path for nested fields
 * @returns {Promise<Array<{path: string, value: any}>>} Array of objects with the field path (dot-notation) and the duplicate value
 */
export async function checkUniqueFields(
    dataStructure,
    incomingData,
    repository,
    tableName,
    excludeCondition,
    pathPrefix = []
) {
    const violations = [];

    for (const [fieldName, fieldConfig] of Object.entries(dataStructure)) {
        const currentPath = [...pathPrefix, fieldName];

        if (fieldConfig.type === 'object' && fieldConfig.data_structure) {
            const nestedData = incomingData?.[fieldName] ?? {};
            const nestedViolations = await checkUniqueFields(
                fieldConfig.data_structure,
                nestedData,
                repository,
                tableName,
                excludeCondition,
                currentPath
            );
            violations.push(...nestedViolations);
            continue;
        }

        if (!fieldConfig.unique) continue;

        const value = incomingData?.[fieldName];

        if (value === null || value === undefined) continue;

        const exists = await repository.existsByFieldValue(tableName, currentPath, value, excludeCondition);
        if (exists) violations.push({ path: currentPath.join('.'), value });
    }

    return violations;
}
