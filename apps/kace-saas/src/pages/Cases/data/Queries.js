import { genericSearch } from "../../../services/genericSearch";
import { genericView } from "../../../services/genericView";
import { apiService, TRANSITIONS_SERVICE } from "@kace/utils";
import {
    CLIENT_SERVICE,
    COMMENTS_SERVICE,
    APPOINTMENT_SERVICES,
    TIME_SLOT_SERVICE,
    GROUP_SERVICE,
    AGENDA_GROUP_SERVICE,
    SCHEDULES_SERVICE,
    AGENDA_SERVICE,
} from "../../../utils/URL";

export const genericFilterUserInactive = [
    {
        field: "usuario_inactivo",
        operator: "eq",
        value: "99",
        type: "AND",
    },
];

export const getTransitions = async (flowId) => {
    if (!flowId) {
        return [];
    }

    const filter = {
        filter: [
            {
                field: "transiciones.flujo_id",
                operator: "eq",
                value: flowId,
                type: "AND",
            },
        ],
        limit: 50,
        offset: 0,
    };
    try {
        const url = `${TRANSITIONS_SERVICE}/search`;
        const response = await apiService.post(url, filter);
        if (response.status === 200 && Array.isArray(response.data.data.items)) {
            return response.data.data.items;
        }
        return [];
    } catch {
        // NO-SONAR: Si ocurre un error, se devuelve un arreglo vacío para evitar que falle el proceso y continúe sin interrupciones.
        return [];
    }
};

export const searchClient = async (id) => {
    const response = await genericSearch(`${CLIENT_SERVICE}/search`, {
        filter: [
            {
                field: "id",
                operator: "eq",
                value: id,
                type: "AND",
            },
        ],
        limit: 10,
        offset: 0,
    });
    return response;
};

export const searchDescription = async (id) => {
    const response = await genericSearch(`${CLIENT_SERVICE}/search`, {
        filter: [
            {
                field: "id",
                operator: "eq",
                value: id,
                type: "AND",
            },
        ],
        limit: 1,
        offset: 0,
    });
    return response;
};

export const searchClientFetch = async (data) => {
    const response = await genericSearch(`${CLIENT_SERVICE}/search`, {
        filter: [
            {
                field: data.type,
                operator: "ilike",
                value: data.payload,
                type: "AND",
            },
            {
                field: "status",
                operator: "eq",
                value: 1,
                type: "AND",
            },
        ],
        limit: 10,
        offset: 0,
    });
    return response;
};

export const searchComments = async (caseId) => {
    const filter = {
        filter: [
            {
                field: "comentarios.caso_id",
                operator: "eq",
                value: caseId,
                type: "AND",
            },
        ],
        limit: 20,
        offset: 0,
    };
    const url = `${COMMENTS_SERVICE}/search`;
    const data = await genericSearch(url, filter);
    if (Array.isArray(data.data)) {
        const { items, count } = data.data;
        const comments = Array.isArray(items) && items.length > 0;
        return comments ? { data: items, count } : { data: [], count: 0 };
    }
    return [];
};

export const searchAppointments = async (caseId, userId, admin, diary) => {
    const filter = [
        {
            field: "appointments.case_id",
            operator: "eq",
            value: caseId,
            type: "AND",
        },
        {
            field: "appointments.is_canceled",
            operator: "eq",
            value: 0,
            type: "AND",
        },
        {
            field: "appointments.is_completed",
            operator: "eq",
            value: 0,
            type: "AND",
        },
        {
            field: "appointments.agenda_id",
            operator: "eq",
            value: diary,
            type: "AND",
        },
        {
            field: "appointments.deleted_at",
            operator: "null",
            value: "null",
            type: "AND",
        },
    ];
    let customFilter = {};
    if (!admin) {
        filter.push({
            field: "cases.responsable_id",
            operator: "eq",
            value: userId,
            type: "AND",
        });
    }
    customFilter = {
        relationship: [
            {
                table: "cases",
                condition: {
                    column: "cases.id",
                    refColumn: "appointments.case_id",
                },
                type: "join",
            },
        ],
        order: {
            field: "appointments.created_at",
            direction: "desc",
        },
    };

    const data = await genericSearch(`${APPOINTMENT_SERVICES}/search`, filter, null, null, false, customFilter);

    return data;
};

export const searchBussinesHours = async (id) => {
    return genericView(`${GROUP_SERVICE}/${id}${SCHEDULES_SERVICE}`);
};

export const searchTimeSlot = async (diaryId) => {
    const response = await genericSearch(`${TIME_SLOT_SERVICE}/search`, [
        {
            field: "agenda_id",
            operator: "eq",
            value: diaryId,
            type: "AND",
        },
    ]);
    return response;
};

export const searchRelationDiaryGroup = async (idGroup) => {
    const response = await genericSearch(`${AGENDA_GROUP_SERVICE}/search`, [], null, null, true, {
        filter: [
            {
                field: "group_id",
                operator: "eq",
                value: idGroup,
                type: "AND",
            },
        ],
    });
    return response;
};

export const searchIsWeekendAgenda = async (id) => {
    return await genericView(`${AGENDA_SERVICE}/${id}`);
};
