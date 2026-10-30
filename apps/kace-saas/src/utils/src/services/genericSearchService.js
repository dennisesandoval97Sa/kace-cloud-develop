import { apiService } from "./apiService";

const defaultPagination = {
    limit: 100,
    offset: 0,
};

const FILTER_TABLES = [
    {
        endpoint: "cases",
        table: "cases",
    },
];

export const genericSearchService = async (
    url,
    filter = [],
    pagination = null,
    bodyData = null,
) => {
    const table = url.split("/")[0];
    const validateTypeFilter = FILTER_TABLES.filter(
        (item) => item.endpoint === table,
    );
    const defaultFilter = {
        filter: [
            ...filter,
            {
                field:
                    validateTypeFilter.length > 0
                        ? `${validateTypeFilter[0].table}.deleted_at`
                        : "deleted_at",
                operator: "null",
                value: "null",
                type: "AND",
            },
        ],
        order: {
            field:
                validateTypeFilter.length > 0
                    ? `${validateTypeFilter[0].table}.created_at`
                    : "created_at",
            direction: "desc",
        },
    };
    if (table === "classifications-groups-relationships") {
        defaultFilter.filter = [...filter];
        defaultFilter.order = {
            field: "form",
            direction: "desc",
        };
    }

    const combinedPagination = pagination || defaultPagination;

    const body = {
        ...defaultFilter,
        ...combinedPagination,
    };
    const data = await apiService.post(url, bodyData ?? body);
    if (Array.isArray(data?.data.data)) {
        const dataNotifications = data.data.data;
        const notifications =
            Array.isArray(dataNotifications) && dataNotifications.length > 0;
        const count = dataNotifications.length;
        return notifications
            ? { data: dataNotifications, count }
            : { data: [], count: 0 };
    }
    if (Array.isArray(data?.data.data.items)) {
        const { items } = data.data.data;
        const notifications = Array.isArray(items) && items.length > 0;
        const count = items.length;
        return notifications ? { data: items, count } : { data: [], count: 0 };
    }
    if (Array.isArray(data?.data.data.items.items)) {
        const { items } = data.data.data.items;
        const isData = Array.isArray(items) && items.length > 0;
        const count = items.length;
        return isData ? { data: items, count } : { data: [], count: 0 };
    }
    return { data: [], count: 0 };
};
