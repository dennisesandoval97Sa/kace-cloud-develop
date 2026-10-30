import { apiService } from "@kace/utils";

export const LIMIT_PAG = 100;

const defaultPagination = {
    limit: LIMIT_PAG,
    offset: 0,
};

export const genericSearch = async (
    url,
    filter = [],
    pagination = null,
    table = null,
    useDefault = true,
    customFilter = {},
) => {
    let defaultFilter = {};
    if (useDefault && url !== "/classifications-groups-relationships/search") {
        defaultFilter = {
            filter: [
                ...filter,
                {
                    field: table ? `${table}.deleted_at` : "deleted_at",
                    operator: "null",
                    value: "null",
                    type: "AND",
                },
            ],
            order: {
                field: table ? `${table}.created_at` : "created_at",
                direction: "desc",
            },
        };
    } else {
        defaultFilter = {
            filter: [...filter],
        };
    }

    const combinedPagination = pagination || defaultPagination;

    const body = {
        ...defaultFilter,
        ...combinedPagination,
        ...customFilter,
    };

    const response = await apiService.post(url, body);

    const raw = response?.data?.data;

    const resolveData = () => {
        if (Array.isArray(raw)) return raw;
        if (Array.isArray(raw?.items)) return raw.items;
        if (Array.isArray(raw?.items?.items)) return raw.items.items;
        return [];
    };

    const resolveCount = (dataArray) => {
        return raw?.count || raw?.total || response?.data?.count || response?.data?.total || dataArray?.length;
    };

    const items = resolveData();
    const count = resolveCount(items);

    return {
        data: items,
        count,
    };
};
