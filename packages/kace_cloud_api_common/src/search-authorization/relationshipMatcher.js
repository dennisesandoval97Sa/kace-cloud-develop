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

export const normalizeRelationship = (relationship) => sortObjectKeys(relationship);

export const relationshipKey = (relationship) => JSON.stringify(normalizeRelationship(relationship));

export const findMissingBaseRelationships = (baseRelationships = [], submittedRelationships = []) => {
    const submittedKeys = new Set((submittedRelationships || []).map((relationship) => relationshipKey(relationship)));

    return (baseRelationships || [])
        .map(normalizeRelationship)
        .filter((relationship) => !submittedKeys.has(relationshipKey(relationship)));
};

export const findDisallowedRelationships = (
    baseRelationships = [],
    submittedRelationships = [],
    allowedRelationships = []
) => {
    const baseKeys = new Set((baseRelationships || []).map((relationship) => relationshipKey(relationship)));
    const allowedKeys = new Set((allowedRelationships || []).map((relationship) => relationshipKey(relationship)));

    return (submittedRelationships || [])
        .map(normalizeRelationship)
        .filter(
            (relationship) =>
                !baseKeys.has(relationshipKey(relationship)) && !allowedKeys.has(relationshipKey(relationship))
        );
};
