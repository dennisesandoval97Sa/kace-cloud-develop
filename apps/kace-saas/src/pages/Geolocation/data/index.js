import { Uuid } from "@kace/plugins";
import { removeKey } from "@kace/utils";

export const formatDataBeforePost = (data, id) => {
    return id
        ? removeKey(data, [
            "id",
        ])
        : removeKey({ ...data, id: Uuid() }, ["updated_by"]);
};
export const initialValues = {
    id: "",
    nombre: "",
    descripcion: "",
    latitud: "",
    longitud: "",
    radio: "",
    activo: true,
    created_by: "",
    updated_by: "",
    created_at: "",
    updated_at: "",
    grupos: [],
};
