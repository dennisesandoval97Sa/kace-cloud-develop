import { Uuid } from "@kace/plugins";
import { removeKey } from "@kace/utils";

export const filterRoles = {
    filter: [
        {
            field: "status",
            operator: "eq",
            value: 1,
            type: "OR",
        },
        {
            field: "status",
            operator: "eq",
            value: 2,
            type: "OR",
        },
        {
            field: "deleted_at",
            operator: "null",
            value: "null",
            type: "AND",
        },
    ],
    limit: 10,
    offset: 0,
};

export const formatDataBeforePost = (data, id) => {
    return id
        ? removeKey(data, ["id", "created_at", "updated_at", "created_by", "deleted_by", "deleted_at", "updated_by"])
        : { ...data, id: Uuid() };
};
export const initialValues = {
    id: "",
    descripcion: "",
    permisos: "",
    status: 1,
};
