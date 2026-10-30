const stripDisplayFields = (filter) => {
    if (!Array.isArray(filter)) return filter;
    return filter.map((f) => {
        if (f && f.groupType && Array.isArray(f.filters)) {
            return { ...f, filters: stripDisplayFields(f.filters) };
        }
        if (f && typeof f === "object") {
            const { displayValue: _dv, ...rest } = f;
            return rest;
        }
        return f;
    });
};

export const sanitizeCriteria = (criteria) => {
    if (!criteria || !Array.isArray(criteria.filter)) return criteria;
    return { ...criteria, filter: stripDisplayFields(criteria.filter) };
};
