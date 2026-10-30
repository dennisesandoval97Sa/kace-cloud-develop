export const adaptGroupsFromSelectData = (data) => {
    const dataObject = data?.find((item) => item.key === "data");
    if (dataObject?.key === "data" && Array.isArray(dataObject.value)) {
        return dataObject.value.map((item) => ({
            value: item?.grupo_id,
            label: item?.grupo.nombre,
        }));
    }
    return [];
};
