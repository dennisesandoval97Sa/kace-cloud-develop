const DATE_ACCESSOR_KEYS = new Set([
    "created_at",
    "updated_at",
    "deleted_at",
    "expired_at",
    "last_updated_at",
    "fecha_vencimiento",
    "fecha_resolucion",
    "fecha_asignacion",
    "fecha_inicio",
    "fecha_fin",
    "sla_due_date",
    "edited_at",
]);

const isDateAccessorKey = (accessorKey = "") => DATE_ACCESSOR_KEYS.has(accessorKey);

/*
 * Columnas que se pintan como lista de chips con "+N": los grupos de un usuario y los
 * usuarios/grupos con acceso a un tablero. CellGroups distingue cual es por accessorKey.
 */
const CHIP_LIST_COLUMNS = new Set(["groups", "access_users", "access_groups"]);

export const getComponentKey = (accessorKey) => {
    if (accessorKey.includes("color")) return "color";
    if (accessorKey === "is_active") return "status";
    if (CHIP_LIST_COLUMNS.has(accessorKey)) return "groups";
    if (isDateAccessorKey(accessorKey)) return "date";
    if (accessorKey.includes("_id")) return "element";
    return accessorKey;
};
