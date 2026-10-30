import { Uuid } from "@kace/plugins";
import { removeKey } from "@kace/utils";

export const filterBanners = {
    filter: [
        {
            field: "status",
            operator: "eq",
            value: 1,
            type: "AND",
        },
        {
            field: "status",
            operator: "eq",
            value: 2,
            type: "OR",
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
    fecha_inicio: "",
    fecha_fin: "",
    especificaciones: {
        users: [],
        groups: [],
        clients: null,
    },
    descripcion: "",
    propiedades: {
        position: "",
        icon: "",
        color: "",
        siteToShow: "",
    },
    status: 1,
};
