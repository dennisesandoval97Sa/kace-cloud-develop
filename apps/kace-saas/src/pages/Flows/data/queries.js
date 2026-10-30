export const filterFlows = {
    filter: [
        {
            field: "deleted_at",
            operator: "null",
            value: "null",
            type: "AND",
        },
    ],
    order: {
        field: "updated_at",
        direction: "desc",
    },
    limit: 10,
    offset: 0,
};
