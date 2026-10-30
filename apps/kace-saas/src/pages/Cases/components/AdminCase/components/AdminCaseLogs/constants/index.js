import { URL_AND_KEYS } from "@/utils/urlAndKeys";

export const dataTableConfig = {
    url: URL_AND_KEYS.eventLogs.url,
    key: "eventLogs",
    /*
     * Sin persistencia: el consumidor reusa esta clave para todos los casos
     * (solo cambia la url, con el caseId), asi que persistir haria que los
     * filtros de la bitacora de un caso reaparecieran en la de otro.
     */
    persist: false,
    urlSchema: "/schema-fields/event_logs",
    keySchema: "eventLogsSchema",
    view: "event_logs",
    genericColumns: ["event_name", "aggregate_id", "initiated_by_user", "occurred_at"],
    useDefaultFilters: false,
    forceUrl: true,
    order: {
        field: "occurred_at",
        direction: "DESC",
    },
};

export const FILTER_TRANSFORMATIONS = {
    event_name: (row) => ({
        ...row,
        label: "Event Name",
        filterData: {
            field: "event_name",
            operator: "in",
            type: "AND",
            value: "",
        },
    }),
    aggregate_id: (row) => ({
        ...row,
        label: "Action/RestFlow ID",
        filterData: {
            field: "aggregate_id",
            operator: "in",
            type: "AND",
            value: "",
        },
    }),
    initiated_by_user: (row) => ({
        ...row,
        label: "Initiated By User",
        filterData: {
            field: "initiated_by_user",
            operator: "eq",
            type: "AND",
            value: "",
        },
    }),
    occurred_at: (row) => ({
        ...row,
        label: "Occurred At",
        filterData: {
            field: "occurred_at",
            operator: "between",
            type: "AND",
            value: "",
        },
    }),
};
