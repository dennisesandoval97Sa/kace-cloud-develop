export const parseActionsOptions = (data) =>
    data.map((item) => ({
        label: item.description,
        value: item.id,
    }));
