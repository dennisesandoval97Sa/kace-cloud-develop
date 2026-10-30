export const processSchemaData = (data = []) => {
    return data?.data?.map((item) => ({
        id: item.id,
        label: item.name || "",
        value: item.id || "",
        status: item.is_active,
    }));
};

export const bodyFilterParams = (event) => ({
    filter: [
        {
            field: "name",
            operator: "ilike",
            value: event,
            type: "OR",
        },
    ],
    order: { field: "created_at", direction: "desc" },
    limit: 10,
    offset: 0,
});

export const formatSchema = (activeSchemas) => {
    return activeSchemas.map((schema) => ({
        id: schema.id,
        label: schema.name.trim(),
        value: schema.id,
    }));
};
