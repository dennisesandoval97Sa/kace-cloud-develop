import { Uuid } from "@kace/plugins";
import { removeKey } from "@kace/utils";

export const genericFilter = {
    filter: [
        {
            field: "is_active",
            operator: "eq",
            value: 1,
            type: "OR",
        },
        {
            field: "is_active",
            operator: "eq",
            value: 0,
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

export const formatDataBeforePostGroupList = (data, id) => {
    return id
        ? removeKey(data, ["id", "created_at", "updated_at", "created_by", "deleted_by", "deleted_at", "updated_by"])
        : { ...data, id: Uuid() };
};
