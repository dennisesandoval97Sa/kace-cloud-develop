import { URL_AND_KEYS } from "@/utils/urlAndKeys";

export const HEADERS_CONSTANT_AUTOMATION_SETTINGS = [
    "description",
    "frequency",
    "end_date",
    "created_at",
    "updated_at",
];

export const AUTOMATION_SETTINGS_FILTER_COLUMNS = [
    "description",
    "frequency",
    "start_date",
    "end_date",
    "created_at",
    "updated_at",
];

export const dataTableConfig = {
    key: URL_AND_KEYS.automationSettings.key,
    url: URL_AND_KEYS.automationSettings.url,
    view: URL_AND_KEYS.automationSettings.view,
    entity: URL_AND_KEYS.automationSettings.entity,
    genericColumns: HEADERS_CONSTANT_AUTOMATION_SETTINGS,
    filterColumns: AUTOMATION_SETTINGS_FILTER_COLUMNS,
};

const createFilterTransformation = (field, operator = "ilike") => {
    return (row) => ({
        ...row,
        filterData: {
            field: `${URL_AND_KEYS.automationSettings.view}.${field}`,
            operator,
            type: "AND",
            value: "",
        },
    });
};

export const FILTER_TRANSFORMATIONS = {
    description: createFilterTransformation("description"),
    frequency: createFilterTransformation("frequency"),
    start_date: createFilterTransformation("start_date", "between"),
    end_date: createFilterTransformation("end_date", "between"),
};

export const INITIAL_VALUES_AUTOMATION_SETTINGS = {
    description: "",
    frequency: "* * * * *",
    start_date: "",
    end_date: "",
};

export const DAYS = [
    {
        id: 1,
        label: "monday",
        value: 1,
    },
    {
        id: 2,
        label: "tuesday",
        value: 2,
    },
    {
        id: 3,
        label: "wednesday",
        value: 3,
    },
    {
        id: 4,
        label: "thursday",
        value: 4,
    },
    {
        id: 5,
        label: "friday",
        value: 5,
    },
    {
        id: 6,
        label: "saturday",
        value: 6,
    },
    {
        id: 7,
        label: "sunday",
        value: 7,
    },
];

export const FREQUENCY_OPTIONS = [
    {
        value: "each_minute",
        label: "Cada minuto",
        cron: "* * * * *",
    },
    {
        value: "every_5_minutes",
        label: "Cada 5 minutos",
        cron: "*/5 * * * *",
    },
    {
        value: "every_10_minutes",
        label: "Cada 10 minutos",
        cron: "*/10 * * * *",
    },
    {
        value: "every_30_minutes",
        label: "Cada media hora",
        cron: "*/30 * * * *",
    },
    {
        value: "every_hour",
        label: "Cada hora",
        cron: "0 * * * *",
    },
    {
        value: "every_6_hours",
        label: "Cada 6 horas",
        cron: "0 */6 * * *",
    },
    {
        value: "every_12_hours",
        label: "Cada 12 horas",
        cron: "0 */12 * * *",
    },
    {
        value: "once_a_day",
        label: "Una vez al día (a medianoche)",
        cron: "0 0 * * *",
    },
];
