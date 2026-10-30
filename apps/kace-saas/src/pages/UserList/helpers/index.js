import { Uuid } from "@kace/plugins";
import { removeKey } from "@kace/utils";

export const filterUserList = {
    filter: [
        {
            field: "deleted_at",
            operator: "null",
            value: "null",
            type: "AND",
        },
    ],
    limit: 0,
    offset: 0,
};

export const formatDataBeforePost = (data, id) => {
    return id
        ? removeKey(data, ["id", "created_at", "updated_at", "created_by", "deleted_by", "deleted_at", "updated_by"])
        : { ...data, id: Uuid() };
};
export const INITIAL_VALUES_USER_LIST = {
    id: "",
    descripcion: "",
    lista_usuarios: [],
    is_active: true,
    group_id: "",
};
