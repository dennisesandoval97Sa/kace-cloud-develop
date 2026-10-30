export const parseRestFlowsOptions = (data) =>
    data.map((item) => ({
        label: item.description,
        value: item.id,
    }));
