const DEFAULT_CAPABILITIES = {
    pagination: true,
    order: true,
    relationship: true,
    select: false,
    distinct: false,
    group_by: false,
    having: false,
};

const hasValue = (value) => {
    if (Array.isArray(value)) return value.length > 0;
    return value !== undefined && value !== null && value !== false;
};

export const resolveCapabilities = (capabilities = {}) => ({ ...DEFAULT_CAPABILITIES, ...capabilities });

export const findDisallowedCapabilities = (query = {}, capabilities = {}) => {
    const resolved = resolveCapabilities(capabilities);
    const checks = [
        ['relationship', query.relationship],
        ['select', query.select],
        ['distinct', query.distinct],
        ['group_by', query.group_by],
        ['having', query.having],
        ['order', query.order],
    ];

    if (!resolved.pagination && (hasValue(query.limit) || hasValue(query.offset))) {
        checks.push(['pagination', { limit: query.limit, offset: query.offset }]);
    }

    return checks
        .filter(([capability, value]) => hasValue(value) && !resolved[capability])
        .map(([capability]) => capability);
};
