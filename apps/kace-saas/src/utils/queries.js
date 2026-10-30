export const filterCasesToOvercome = {
    filter: [
        {
            field: "ans_posicion",
            operator: "neq",
            value: 3,
            type: "AND",
        },
        {
            field: "ans_posicion",
            operator: "notNull",
            value: "null",
            type: "AND",
        },
    ],
    limit: 0,
    offset: 0,
};

export const filterCasesDefeated = {
    filter: [
        {
            field: "ans_posicion",
            operator: "eq",
            value: 3,
            type: "AND",
        },
        {
            field: "ans_posicion",
            operator: "notNull",
            value: "null",
            type: "AND",
        },
    ],
    limit: 0,
    offset: 0,
};

export const filterCasesManaged = {
    filter: [
        {
            field: "fecha_resolucion",
            operator: "notNull",
            value: "null",
            type: "AND",
        },
    ],
    limit: 0,
    offset: 0,
};

export const filterCasesPending = {
    filter: [
        {
            field: "fecha_resolucion",
            operator: "null",
            value: "null",
            type: "AND",
        },
    ],
    limit: 0,
    offset: 0,
};

export const filterCasesForState = (field) => {
    return {
        filter: [
            {
                field: "estadoActual",
                operator: "eq",
                value: field,
                type: "AND",
            },
        ],
        limit: 0,
        offset: 0,
    };
};
