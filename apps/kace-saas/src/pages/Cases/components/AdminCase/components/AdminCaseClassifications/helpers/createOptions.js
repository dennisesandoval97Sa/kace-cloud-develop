export function createOptions (array, nivel = 1) {
    const nivelKey = `nivel${nivel}`;
    const groupedByNivel = array.reduce((acc, item) => {
        const nivelValue = item[nivelKey]?.trim();
        if (!nivelValue) return acc;

        if (!acc[nivelValue]) {
            acc[nivelValue] = [];
        }
        acc[nivelValue].push(item);
        return acc;
    }, {});

    return Object.entries(groupedByNivel)
        .map(([label, items]) => {
            const nextNivelKey = `nivel${nivel + 1}`;
            const hasNextNivel = items.some(
                (item) => item[nextNivelKey]?.trim() !== "",
            );
            const options = hasNextNivel ? createOptions(items, nivel + 1) : [];
            const flowId = items.find((item) => item.flujo_id);
            const classificationId = items.find((item) => item.id);
            return {
                label,
                value: label,
                options,
                flujo_id: flowId?.flujo_id,
                clasificacion_id: classificationId?.id,
            };
        })
        .filter((option) => option.label.trim() !== "");
}
