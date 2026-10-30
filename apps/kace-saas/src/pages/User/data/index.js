import { Uuid } from "@kace/plugins";
import { removeKey } from "@kace/utils";

export const filterAllUsers = {
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
    order: {
        field: "created_at",
        direction: "desc",
    },
    limit: 10,
    offset: 0,
};

export const initialValues = {
    login: "",
    password: "",
    nombres: "",
    apellido1: "",
    apellido2: "",
    email: "",
    telefono: "",
    rol_id: "",
    grupo_activo: "",
    account_type: "",
    codigos_externos: {},
    groups: [],
    external_id: "",
    ips_allowed: {},
    newUser: 1,
};

export const formatDataBeforePost = (data, id) => {
    return id
        ? removeKey(data, [
            "id",
            "groups",
            "grupo_activo",
            "created_at",
            "updated_at",
            "created_by",
            "deleted_by",
            "deleted_at",
            "filters",
            "token",
            "newUser",
            "password",
            "external_id",
        ])
        : removeKey({ ...data, id: Uuid() }, ["groups", "grupo_activo", "newUser"]);
};
