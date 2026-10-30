export const resolveSearchTotal = (total) => {
    if (total && typeof total === "object") {
        return Number(total.count ?? total["count(*)"] ?? 0);
    }
    return Number(total ?? 0);
};

export const parseResponseApi = (data) => {
    if (!data) return { data: [], count: 0, total: 0 };
    const items = data?.data?.data?.items || data?.data?.data || data?.data?.data?.items?.items;
    if (Array.isArray(items)) {
        return {
            data: items,
            count: items.length,
            total: resolveSearchTotal(data.data.metadata?.count ?? items.length),
        };
    }
    return { data: [], count: 0, total: 0 };
};
