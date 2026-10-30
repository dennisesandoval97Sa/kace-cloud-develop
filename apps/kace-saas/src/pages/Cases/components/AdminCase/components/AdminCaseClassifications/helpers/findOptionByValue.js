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
