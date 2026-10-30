import { OPTIONS_FILTERS_TABLE } from "@kace/utils"

export const FILTER_OBJECTS = [
    {
        name: "toOvercome",
        column: "ans_posicion",
        value: "2",
        title: "casos por vencer",
        operator: "eq",
        type: "AND",
        color: "bg-blueCustom/40",
        field: "cases.ans_posicion"
    },
    {
        name: "defeated",
        column: "ans_posicion",
        value: "3",
        title: "casos vencidos",
        operator: "eq",
        type: "AND",
        color: "bg-blueCustom/40",
        field: "cases.ans_posicion"
    },
    {
        name: "managed",
        column: "fecha_resolucion",
        value: OPTIONS_FILTERS_TABLE.isNotNull,
        title: "casos gestionados",
        operator: OPTIONS_FILTERS_TABLE.isNotNull,
        type: "AND",
        color: "bg-redCustom/40",
        field: "cases.fecha_resolucion"
    },
    {
        name: "pending",
        column: "ans_posicion",
        value: "1",
        title: "casos pendientes",
        operator: "eq",
        type: "AND",
        color: "bg-blueCustom/40",
        field: "cases.ans_posicion"
    }
]

export const DEFAULT_CASES_STATES = [
    { id: 0, name: "Casos por vencer", total: 0, filter: FILTER_OBJECTS[0] },
    { id: 1, name: "Casos vencidos", total: 0, filter: FILTER_OBJECTS[1] },
    { id: 2, name: "Casos gestionados", total: 0, filter: FILTER_OBJECTS[2] },
    { id: 3, name: "Casos pendientes", total: 0, filter: FILTER_OBJECTS[3] }
]
