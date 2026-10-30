import { SCHEDULES_SERVICE } from "../../../utils/URL";
import { genericSearch } from "../../../services/genericSearch";

export const filterSchedule = {
    filter: [
        {
            field: "deleted_at",
            operator: "null",
            value: "null",
            type: "AND",
        },
    ],
    order: {
        field: "created_at",
        direction: "desc",
    },
};

export const getHolidaysBySchedule = async (id) => {
    return genericSearch(`${SCHEDULES_SERVICE}/holidays/search`, {
        select: ["horarios_dias_festivos.*"],
        condition: [
            {
                field: "horarios_dias_festivos.horario_id",
                operator: "eq",
                value: id,
                type: "and",
            },
            {
                field: "horarios_dias_festivos.status",
                operator: "eq",
                value: 1,
                type: "and",
            },
        ],
        limit: 100,
        offset: 0,
    });
};

export const getWorkDaysBySchedule = async (id) => {
    return genericSearch(`${SCHEDULES_SERVICE}/days/search`, {
        select: ["horarios_dias.*"],
        condition: [
            {
                field: "horarios_dias.horario_id",
                operator: "eq",
                value: id,
                type: "and",
            },
            {
                field: "horarios_dias.status",
                operator: "eq",
                value: 1,
                type: "and",
            },
        ],
        limit: 100,
        offset: 0,
    });
};
