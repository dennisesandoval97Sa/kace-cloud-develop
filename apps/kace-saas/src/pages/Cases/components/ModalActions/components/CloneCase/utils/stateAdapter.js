export const adaptStatesFromData = (data) => {
    return data
        .map((item) => {
            if (item.estado_siguiente) {
                return {
                    label: item.estado_siguiente.nombre,
                    value: item.transition.id,
                };
            } else if (item.estado_actual) {
                return {
                    label: item.estado_actual.nombre,
                    value: item.transition.id,
                };
            } else return null;
        })
        .filter(Boolean);
};
