const DISALLOWED_AUXILIARY_DELETE = ["cases", "clients"];

export const isDisallowedAuxiliaryDelete = (primaryEntity) => {
    if (!primaryEntity?.startsWith("aux_")) return false;
    const normalizedEntity = primaryEntity.slice(4);
    return DISALLOWED_AUXILIARY_DELETE.includes(normalizedEntity);
};

export const hasAuxiliaryDeletePermission = (permissionsAuxiliaries, primaryEntity) => {
    if (!primaryEntity?.startsWith("aux_") || !Array.isArray(permissionsAuxiliaries)) {
        return false;
    }
    const normalizedEntity = primaryEntity.slice(4);
    if (DISALLOWED_AUXILIARY_DELETE.includes(normalizedEntity)) {
        return false;
    }
    const pascalEntity = normalizedEntity
        .replace(/-/g, "_")
        .split("_")
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join("");
    const requiredPermission = `${pascalEntity}Delete`;
    const moduleId = normalizedEntity.replace(/-/g, "_");
    return permissionsAuxiliaries.some(
        (p) => p?.module_id === moduleId && p?.name === requiredPermission && p?.granted === true,
    );
};
