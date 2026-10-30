export const parseOneScriptsOptions = (data) =>
    data.map((item) => ({
        label: item.name,
        value: item.id,
    }));
