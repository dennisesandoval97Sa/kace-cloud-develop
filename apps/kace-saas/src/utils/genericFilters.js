export const genericFilters = (view) => ({
    created_at: (row) => ({
        ...row,
        filterData: {
            field: `${view}.created_at`,
            operator: "between",
            type: "AND",
            value: "",
        },
    }),
    updated_at: (row) => ({
        ...row,
        filterData: {
            field: `${view}.updated_at`,
            operator: "between",
            type: "AND",
            value: "",
        },
    }),
    created_by: (row) => ({
        ...row,
        filterData: {
            field: `${view}.reference`,
            operator: "eq",
            type: "AND",
            value: "",
        },
    }),
    updated_by: (row) => ({
        ...row,
        filterData: {
            field: `${view}.reference`,
            operator: "eq",
            type: "AND",
            value: "",
        },
    }),
});

export const filterByIsPrimary = {
    field: "is_primary",
    operator: "eq",
    value: "true",
    type: "AND",
};

export const filterByIsActive = {
    field: "is_active",
    operator: "eq",
    value: 1,
    type: "AND",
};
