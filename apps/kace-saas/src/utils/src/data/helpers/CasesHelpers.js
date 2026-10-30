export const filterAllCases = {
    select: [
        "cases.*",
        "clasificaciones.nivel1 as clasificaciones_nivel1",
        "clasificaciones.nivel2 as clasificaciones_nivel2",
        "clasificaciones.nivel3 as clasificaciones_nivel3",
        "ans.color_ans_inicial",
        "ans.color_ans_intermedio",
        "ans.color_ans_final",
        "estados.nombre as estado_actual",
    ],
    limit: 2,
    offset: 0,
};

export const filter = {
    select: [
        "cases.*",
        "clasificaciones.nivel1 as clasificaciones_nivel1",
        "clasificaciones.nivel2 as clasificaciones_nivel2",
        "clasificaciones.nivel3 as clasificaciones_nivel3",
        "clients.nombres as cliente_nombres",
        "clients.apellido1 as cliente_apellido1",
        "clients.documento as cliente_documento",
        "ans.color_ans_inicial",
        "ans.color_ans_intermedio",
        "ans.color_ans_final",
        "estados.nombre as estado_actual",
        "usuarios.login",
    ],
    condition: [
        {
            field: "cases.fecha_resolucion",
            operator: "null",
            value: "null",
            type: "and",
        },
    ],
    limit: 2,
    offset: 0,
};

export const filterAllCaseForUser = {
    select: [
        "cases.*",
        "clasificaciones.nivel1 as clasificaciones_nivel1",
        "clasificaciones.nivel2 as clasificaciones_nivel2",
        "clasificaciones.nivel3 as clasificaciones_nivel3",
        "clients.nombres as cliente_nombres",
        "clients.apellido1 as cliente_apellido1",
        "clients.documento as cliente_documento",
        "ans.color_ans_inicial",
        "ans.color_ans_intermedio",
        "ans.color_ans_final",
        "estados.nombre as estado_actual",
        "usuarios.login",
    ],
    limit: 2,
    offset: 0,
};

export const getCaseFilters = (caso) => {
    return Object.entries(caso).reduce((acc, [key, value]) => {
        if (value) {
            acc.push({
                field: `cases.${key}`,
                operator: "eq",
                value,
                type: "and",
            });
        }
        return acc;
    }, []);
};

export const getClientFilters = (clientes) => {
    return Object.entries(clientes).reduce((acc, [key, value]) => {
        if (value) {
            acc.push({
                field: `clients.${key}`,
                operator: "like",
                value: `%${value}%`,
                type: "and",
            });
        }
        return acc;
    }, []);
};

export const getStateFilters = (estados) => {
    return Object.entries(estados).reduce((acc, [key, value]) => {
        if (value) {
            acc.push({
                field: `estados.${key}`,
                operator: "eq",
                value,
                type: "and",
            });
        }
        return acc;
    }, []);
};

export const getResponsibleFilters = (responsable_id) => {
    return [
        {
            field: "cases.responsable_id",
            operator: "eq",
            value: responsable_id,
            type: "and",
        },
    ];
};
