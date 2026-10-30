export const COMMENT_REOPEN_CASES_INITIAL = {
    comment: {
        id: "",
        descripcion: "",
        calificacion: 1,
        caso_id: "",
    },
};

export const OPTIONS_FILTERS_TABLE = {
    isNull: "null",
    isNotNull: "notNull",
};

export const OPTIONS_ACTIONS_CASES = {
    reassignCase: "Reasignar caso",
    reopenCase: "Re-abrir caso",
    closeCase: "Cerrar caso",
    deleteCase: "Eliminar caso",
    calendarCase: "Mi Agenda",

};

export const ACTION_CASE_CONSTANTS = [
    "reOpen",
    "reAssign",
    "cloneCase",
    "closeCase",
];
