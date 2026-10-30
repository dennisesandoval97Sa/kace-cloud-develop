const ENTITY_FK_MAP = {
    cases: "caso_id",
    clients: "cliente_id",
    users: "usuario_id",
    groups: "grupo_id",
    roles: "rol_id",
    classifications: "clasificacion_id",
    states: "estado_id",
    transitions: "transicion_id",
    appointments: "cita_id",
    agendas: "agenda_id",
    notifications: "notificacion_id",
    comments: "comentario_id",
    templates: "plantilla_id",
    documents: "documento_id",
};

export const hasMainEntityDependency = (row, columns = [], primaryEntity) => {
    if (!primaryEntity?.startsWith("aux_") || !row) return false;

    const mainEntity = primaryEntity.slice(4);

    const hasColumnDependency = columns.some((column) => {
        if (column.entity !== mainEntity) return false;
        const columnKey = column.alias || column.field;
        const value = row[columnKey];
        return value !== null && value !== undefined && value !== "";
    });

    if (hasColumnDependency) return true;

    const fkFields = [ENTITY_FK_MAP[mainEntity], `${mainEntity}_id`, `${mainEntity.slice(0, -1)}_id`].filter(Boolean);

    const dataSources = [row, row.data ?? {}];

    return fkFields.some((fkField) =>
        dataSources.some((source) => {
            const value = source[fkField];
            return value !== null && value !== undefined && value !== "";
        }),
    );
};

export const hasAnyMainEntityDependency = (selectedRows, columns = [], primaryEntity) => {
    if (!selectedRows?.length) return false;
    return selectedRows.some((row) => hasMainEntityDependency(row, columns, primaryEntity));
};
