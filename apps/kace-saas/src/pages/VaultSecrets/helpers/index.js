import { Uuid } from "@kace/plugins";
import { removeKey } from "@kace/utils";

export const filterSecretVault = {
    filter: [
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
        ? removeKey(data, ["id", "created_at", "updated_at", "created_by", "deleted_by", "deleted_at"])
        : { ...data, id: Uuid() };
};
export const initialValues = {
    id: "",
    descripcion: "",
    referencia: "",
    secreto: "",
};

export const obtenerCambios = (inicial, modificado) => {
    return Object.keys(modificado).reduce((cambios, clave) => {
        if (inicial[clave] !== modificado[clave]) {
            cambios[clave] = modificado[clave];
        }
        return cambios;
    }, {});
};
