export function getAnsColumnKeys(columns = []) {
    return columns
        .filter((column) => column.is_ans)
        .map((column) => column.alias || column.field)
        .filter(Boolean);
}

export function getAnsColorMap(ansItems = []) {
    return ansItems.reduce((map, item) => {
        map[item.id] = {
            1: item.color_ans_inicial ?? "#bdde86",
            2: item.color_ans_intermedio ?? "#ea6718",
            3: item.color_ans_final ?? "#e61e1e",
        };
        return map;
    }, {});
}

export function wrapRowAns(newItem, keys, colorsByAnsId, t) {
    if (!Array.isArray(keys) || keys.length === 0) return newItem;
    const perRowColors =
        newItem.color_ans_inicial || newItem.color_ans_intermedio || newItem.color_ans_final
            ? { 1: newItem.color_ans_inicial, 2: newItem.color_ans_intermedio, 3: newItem.color_ans_final }
            : null;
    const fallback = Object.values(colorsByAnsId)[0] ?? {};
    const colors = perRowColors ?? colorsByAnsId[newItem.ans_id] ?? colorsByAnsId[newItem.medicion_ans_id] ?? fallback;
    let result = { ...newItem };
    keys.forEach((key) => {
        const value = result[key];
        const position = Number(value);
        const color = colors[position];
        if (!Number.isFinite(position) || !color) return;
        const ariaLabel =
            typeof t === "function"
                ? t("boards.ans.position", { position, defaultValue: `ANS position ${position}` })
                : `ANS position ${position}`;
        result = {
            ...result,
            [key]: (
                <div className="flex items-center gap-2">
                    <span
                        className="inline-block w-6 h-6 rounded-full"
                        style={{ backgroundColor: color }}
                        aria-label={ariaLabel}
                        title={String(position)}
                    />
                </div>
            ),
        };
    });
    return result;
}
