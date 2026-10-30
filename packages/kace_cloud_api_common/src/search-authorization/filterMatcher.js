const sortObjectKeys = (value) => {
    if (Array.isArray(value)) return value.map(sortObjectKeys);
    if (!value || typeof value !== 'object') return value;

    return Object.keys(value)
        .sort()
        .reduce((acc, key) => {
            acc[key] = sortObjectKeys(value[key]);
            return acc;
        }, {});
};

export const normalizeFilter = (filter) => sortObjectKeys(filter);

export const filterKey = (filter) => JSON.stringify(normalizeFilter(filter));

export const flattenFilters = (filters = []) => {
    if (!Array.isArray(filters)) return [];

    return filters.flatMap((filter) => {
        if (filter?.groupType && Array.isArray(filter.filters)) {
            return flattenFilters(filter.filters);
        }
        return [normalizeFilter(filter)];
    });
};

const flattenConjunctiveFilters = (filters = []) => {
    if (!Array.isArray(filters)) return [];

    return filters.flatMap((filter) => {
        if (filter?.groupType && Array.isArray(filter.filters)) {
            return String(filter.groupType).toUpperCase() === 'AND' ? flattenConjunctiveFilters(filter.filters) : [];
        }
        return [normalizeFilter(filter)];
    });
};

const hasOrFilter = (filters = []) => {
    if (!Array.isArray(filters)) return false;

    return filters.some((filter) => {
        if (String(filter?.type).toUpperCase() === 'OR' || String(filter?.groupType).toUpperCase() === 'OR') {
            return true;
        }
        return hasOrFilter(filter?.filters);
    });
};

export const findMissingBaseFilters = (baseFilters = [], submittedFilters = []) => {
    if (hasOrFilter(submittedFilters)) return flattenFilters(baseFilters);

    const submittedKeys = new Set(flattenConjunctiveFilters(submittedFilters).map(filterKey));

    return flattenFilters(baseFilters).filter((baseFilter) => !submittedKeys.has(filterKey(baseFilter)));
};

export const findDisallowedFilters = (baseFilters = [], submittedFilters = [], allowedFilters = []) => {
    const baseKeys = new Set(flattenFilters(baseFilters).map(filterKey));
    const allowedByField = new Map(allowedFilters.map(({ field, operators }) => [field, new Set(operators)]));

    return flattenFilters(submittedFilters).filter((filter) => {
        if (baseKeys.has(filterKey(filter))) return false;
        const allowedOperators = allowedByField.get(filter.field);
        return !allowedOperators || !allowedOperators.has(filter.operator);
    });
};

const valueHasSearchSignal = (value) => {
    if (Array.isArray(value)) return value.some(valueHasSearchSignal);
    if (typeof value === 'number' || typeof value === 'boolean') return true;
    if (typeof value === 'string') return value.replace(/[%_\s]/g, '').length > 0;
    if (value && typeof value === 'object' && 'value' in value) return valueHasSearchSignal(value.value);
    return false;
};

const filterSatisfiesRequirement = (filter, requirement) => {
    if (filter.field !== requirement.field) return false;
    if (!requirement.operators.includes(filter.operator)) return false;
    if (requirement.requireValue === false) return true;

    return valueHasSearchSignal(filter.value);
};

export const findMissingRequiredFilterGroups = (requiredFilterGroups = [], submittedFilters = []) => {
    const submittedConjunctiveFilters = flattenConjunctiveFilters(submittedFilters);

    return requiredFilterGroups
        .filter((group) => {
            const requiredFilters = group.filters || [];
            return !requiredFilters.some((requiredFilter) =>
                submittedConjunctiveFilters.some((submittedFilter) =>
                    filterSatisfiesRequirement(submittedFilter, requiredFilter)
                )
            );
        })
        .map(({ name, filters }) => ({ name, filters }));
};
