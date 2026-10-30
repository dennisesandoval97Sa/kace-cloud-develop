import { LITERALS_SERVICE } from "../../../utils/URL";
import { apiService } from "@kace/utils";

export const searchLiterals = async (filter, id = "null") => {
    const url = `${LITERALS_SERVICE}/search`;
    let operator = "null";
    if (id !== "null") {
        operator = "eq";
    }
    const data = await apiService.post(url, {
        ...filter,
        filter: [{
            field: "tipo_literal",
            operator,
            value: id,
            type: "AND",
        },
        {
            field: "is_active",
            operator: "eq",
            value: "1",
            type: "AND",
        },
        {
            field: "deleted_at",
            operator: "null",
            value: "null",
            type: "AND",
        },
        ],
    });

    if (Array.isArray(data?.data.data.items)) {
        const dataliterals = data.data.data.items;
        const literals = Array.isArray(dataliterals) && dataliterals.length > 0;
        const count = dataliterals.length;
        return literals ? { data: dataliterals, count } : { data: [], count: 0 };
    }
    return { data: [], count: 0 };
};
