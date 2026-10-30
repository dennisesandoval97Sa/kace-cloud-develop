import { Uuid } from "@kace/plugins";
import { removeKey } from "@kace/utils";

export const formatDataBeforePost = (data, id) => {
    return id
        ? removeKey(data, ["id", "created_at", "updated_at", "created_by", "updated_by"])
        : { ...data, id: Uuid() };
};
