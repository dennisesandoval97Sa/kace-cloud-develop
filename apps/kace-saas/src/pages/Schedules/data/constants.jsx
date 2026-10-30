import { URL_AND_KEYS } from "@/utils/urlAndKeys";

export const HEADERS_CONSTANT_SCHEDULE = [
    "description",
    "created_at",
    "updated_at",
]

export const SCHEDULE_DAYS = {
    monday: {
        id: "monday",
        dia_semana: "Lunes",
        es_laboral: true,
        hora_inicio_jornada: "09:00:00",
        hora_fin_jornada: "18:00:00",
        status: 1,
    },
    tuesday: {
        id: "tuesday",
        dia_semana: "Martes",
        es_laboral: false,
        hora_inicio_jornada: "09:00:00",
        hora_fin_jornada: "18:00:00",
        status: 1,
    },
    wednesday: {
        id: "wednesday",
        dia_semana: "Miércoles",
        es_laboral: false,
        hora_inicio_jornada: "09:00:00",
        hora_fin_jornada: "18:00:00",
        status: 1,
    },
    thursday: {
        id: "thursday",
        dia_semana: "Jueves",
        es_laboral: false,
        hora_inicio_jornada: "09:00:00",
        hora_fin_jornada: "18:00:00",
        status: 1,
    },
    friday: {
        id: "friday",
        dia_semana: "Viernes",
        es_laboral: false,
        hora_inicio_jornada: "09:00:00",
        hora_fin_jornada: "18:00:00",
        status: 1,
    },
    saturday: {
        id: "saturday",
        dia_semana: "Sábado",
        es_laboral: false,
        hora_inicio_jornada: "09:00:00",
        hora_fin_jornada: "18:00:00",
        status: 1,
    },
    sunday: {
        id: "sunday",
        dia_semana: "Domingo",
        es_laboral: false,
        hora_inicio_jornada: "09:00:00",
        hora_fin_jornada: "18:00:00",
        status: 1,
    },
}

export const INITIAL_SCHEDULE_VALUES = {
    description: "",
    holiday_dates: [],
    work_days: {
        monday: {
            start: "08:00",
            end: "18:00",
        },
    },
}

export const INITIAL_DATA_TABLE = [
    {
        day: "monday",
        workingDay: false,
        start: "",
        end: "",
    },
    {
        day: "tuesday",
        workingDay: false,
        start: "",
        end: "",
    },
    {
        day: "wednesday",
        workingDay: false,
        start: "",
        end: "",
    },
    {
        day: "thursday",
        workingDay: false,
        start: "",
        end: "",
    },
    {
        day: "friday",
        workingDay: false,
        start: "",
        end: "",
    },
    {
        day: "saturday",
        workingDay: false,
        start: "",
        end: "",
    },
    {
        day: "sunday",
        workingDay: false,
        start: "",
        end: "",
    },
];

export const dataTableConfig = {
    key: URL_AND_KEYS.shiftManagement.key,
    url: URL_AND_KEYS.shiftManagement.url,
    view: URL_AND_KEYS.shiftManagement.view,
    genericColumns: HEADERS_CONSTANT_SCHEDULE,
    entity: URL_AND_KEYS.shiftManagement.entity,
};

export const FILTER_TRANSFORMATIONS = {
    description: (row) => ({
        ...row,
        label: "Description",
        filterData: {
            field: "shift_management.description",
            operator: "ilike",
            type: "AND",
            value: "",
        },
    })
};

