import { URL_AND_KEYS } from "@/utils/urlAndKeys";

export const HEADERS_CONST_TIMESLOTS = [
    "description",
    "start_time",
    "end_time",
    "max_appointments",
    "is_active",
    "created_at",
    "updated_at",
];

export const FILTER_COLUMNS_TIMESLOTS = [
    "description",
    "start_time",
    "end_time",
    "max_appointments",
    "is_active",
    "created_by",
    "updated_by",
    "created_at",
    "updated_at",
];

export const TIME_SLOTS_QUERY_KEY = "timeSlotsData";

export const dataTableConfig = {
    key: URL_AND_KEYS.timeSlots.key,
    url: URL_AND_KEYS.timeSlots.url,
    view: URL_AND_KEYS.timeSlots.view,
    genericColumns: HEADERS_CONST_TIMESLOTS,
    filterColumns: FILTER_COLUMNS_TIMESLOTS,
    entity: URL_AND_KEYS.timeSlots.entity,
};

const createFilterTransformation = (columnName, operator = "eq") => {
    return (row) => ({
        ...row,
        filterData: {
            field: `appointment_time_slots.${columnName}`,
            operator,
            type: "AND",
            value: "",
        },
    });
};

export const FILTER_TRANSFORMATIONS = {
    description: createFilterTransformation("description", "ilike"),
    start_time: createFilterTransformation("start_time"),
    end_time: createFilterTransformation("end_time"),
    max_appointments: createFilterTransformation("max_appointments"),
    is_active: (row) => ({
        ...row,
        field_type: "boolean",
        filterData: {
            field: "appointment_time_slots.is_active",
            operator: "eq",
            type: "AND",
            value: "",
        },
    }),
    created_by: createFilterTransformation("created_by"),
    updated_by: createFilterTransformation("updated_by"),
};
