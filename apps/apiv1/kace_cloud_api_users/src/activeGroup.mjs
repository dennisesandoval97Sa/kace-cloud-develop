export const applyDefaultActiveGroup = (payload) => {
    const dto = { ...payload };
    const groupIds = Array.isArray(dto.group_ids) ? dto.group_ids.filter(Boolean) : [];

    if (!dto.grupo_activo && groupIds.length > 0) {
        dto.grupo_activo = groupIds[0];
    }

    return dto;
};
