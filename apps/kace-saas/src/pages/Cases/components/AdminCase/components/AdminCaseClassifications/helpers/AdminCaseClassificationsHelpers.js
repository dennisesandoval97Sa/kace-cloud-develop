export const getCurrentOptions = (
    nivel,
    classificationsData,
    selectedOptions,
) => {
    if (nivel === "nivel1") return classificationsData;

    const nivelNum = parseInt(nivel.replace("nivel", ""));
    let currentOptions = classificationsData;

    for (let i = 1; i < nivelNum; i++) {
        const currentNivel = `nivel${i}`;
        const currentSelection = selectedOptions[currentNivel];

        if (!currentSelection) break;

        const currentOpt = currentOptions.find(
            (opt) => opt.value === currentSelection,
        );

        if (!currentOpt?.options?.length) break;
        currentOptions = currentOpt.options;
    }

    return currentOptions;
};

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

export function findOptionByValue (
    option,
    value,
    nivel,
    currentNivel = "nivel1",
) {
    if (currentNivel !== nivel) {
        return option.options?.some((nestedOpt) =>
            findOptionByValue(
                nestedOpt,
                value,
                nivel,
                `nivel${parseInt(currentNivel.replace("nivel", "")) + 1}`,
            ),
        );
    }

    return option.value === value;
}
