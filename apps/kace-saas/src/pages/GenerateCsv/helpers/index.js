import { Uuid } from "@kace/plugins";
import { removeKey } from "@kace/utils";

export const filterGenerateCsv = {
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
    description: "",
    views: [],
    frequency: "",
    interval: "",
    time_filter: {
        field: "",
        interval: "",
        unit: "",
        reference: "",
    },
    start_time: "",
    next_execution_at: "",
    is_active: true,
    storage_path: "",
};
