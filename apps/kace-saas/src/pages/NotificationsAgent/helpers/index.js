import { Uuid } from "@kace/plugins";
import { removeKey } from "@kace/utils";

export const filterNotificationsAgent = {
    filter: [
        {
            field: "is_active",
            operator: "eq",
            value: 1,
            type: "AND",
        },
    ],
    limit: 10,
    offset: 0,
};

export const formatDataBeforePost = (data, id) => {
    return id
        ? removeKey(data, ["id", "created_at", "updated_at", "created_by", "updated_by"])
        : { ...data, id: Uuid() };
};

export const initialValues = {
    id: "",
    asunto: "",
    mensaje: "",
    fecha_inicio: "",
    fecha_fin: "",
    leida: false,
    user_id: "",
    is_active: true,
};
