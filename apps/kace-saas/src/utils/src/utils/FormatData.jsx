import { t } from "i18next";
import { GeolocationTypes } from "../../../enums/GeolocationTypes";
import { formatTableDateTime } from "./dateUtils";
import { resolveDateColumnNamesFromSchema } from "./resolveDateColumnNamesFromSchema";
import { shouldFormatDateValue } from "./shouldFormatDateValue";
import { Uuid } from "@kace/plugins";
import { Check, Clock, Loader } from "lucide-react";
import { createElement } from "react";
import { WSRestFunctionTypeEnum } from "../../../enums/WSRestFunctionTypeEnum";

const isValidHex = (color) => /^#[0-9A-Fa-f]{6}$/.test(color);

const solidColorFromCaseItem = (item, due_date_for_ans_calculation, fecha_vencimiento, semaphore_by_state_ans) => {
    if (due_date_for_ans_calculation) {
        const now = new Date();
        const vencimiento = new Date(fecha_vencimiento);
        return now > vencimiento ? "#FF0000" : "";
    }

    const {
        ans_posicion,
        sla_state_position,
        color_ans_inicial,
        color_ans_intermedio,
        color_ans_final,
        fecha_resolucion,
    } = item;

    if (fecha_resolucion) {
        return "";
    }

    const position = semaphore_by_state_ans ? sla_state_position : ans_posicion;

    if (position === null || position === undefined) {
        return "";
    }

    const colorMap = {
        1: color_ans_inicial,
        2: color_ans_intermedio,
        3: color_ans_final,
    };

    const color = colorMap[position];
    return color && isValidHex(color) ? color : "";
};

export const handleState = (data) => {
    return data.map((item) => {
        const normalizedIsActive = item.is_active === true || item.is_active === 1 || item.is_active === "1";

        const isActive = item.status === 1 || normalizedIsActive;

        const state = isActive ? t("app.forms.active") : t("app.forms.inactive");

        const updatedItem = { ...item };

        if ("status" in item) {
            updatedItem.status = state;
        }

        if (!("status" in item) && "is_active" in item) {
            updatedItem.is_active = state;
        }

        return updatedItem;
    });
};

const DEFAULT_DATE_FIELDS = [
    "start_date",
    "end_date",
    "created_at",
    "updated_at",
    "deleted_at",
    "expired_at",
    "fecha_resolucion",
    "fecha_vencimiento",
];

export const handleStateTimer = (data = [], additionalDateFields = [], schema = null) => {
    if (!data || !Array.isArray(data)) {
        return data;
    }

    const dateFields = [
        ...new Set([...DEFAULT_DATE_FIELDS, ...additionalDateFields, ...resolveDateColumnNamesFromSchema(schema)]),
    ];

    return data.map((item) => {
        if (!item) return item;

        const updatedItem = { ...item };

        dateFields.forEach((field) => {
            try {
                const fieldValue = item[field];
                if (shouldFormatDateValue(fieldValue)) {
                    updatedItem[field] = formatTableDateTime(fieldValue);
                }
            } catch {
                return null;
            }
        });

        return updatedItem;
    });
};

export const handleGeolocationData = (data = [], keyQuery) => {
    if (!data || !/filterGeolocation/gi.test(keyQuery)) return data;

    return data.map((item) => {
        return {
            ...item,
            action_type: GeolocationTypes.getLabel(item.action_type),
            Name: item?.creator.nombres + " " + item.creator.apellido1 + " " + (item?.creator.apellido2 ?? ""),
        };
    });
};

export const handleColor = (data = [], fields = []) => {
    return data.map((file) => {
        fields.forEach((field) => {
            if (file[field]) {
                file[field] = <div className={`bg-${file[field]} w-4 h-4 rounded-full`}></div>;
            }
        });
        return file;
    });
};
export const createChildren = (data) => {
    if (!data) return;
    const dataFilter = data.map((item) => {
        const children = [];
        Object.entries(item).forEach(([key, value]) => {
            if (key === "nivel1") return;
            if (key.includes("nivel") && value !== null && value !== "") {
                const child = {
                    id: key,
                    value,
                    label: value,
                };
                children.push(child);
            }
        });
        item.children = children;
        return item;
    });
    return dataFilter;
};

export const handleCountAns = (data, keyQuery) => {
    if (!data && keyQuery !== "groupsData") return;
    const dataForm = data.map((item) => {
        return {
            ...item,
            notExpiredCases: item.notExpiredCases?.count,
            intermediateCases: item.intermediateCases?.count,
            expiredCases: item.expiredCases?.count,
        };
    });
    return dataForm;
};

export const handleFullName = (data, keyQuery, due_date_for_ans_calculation, semaphore_by_state_ans) => {
    if (!data) return;
    if (keyQuery === "allCases") {
        return data.map((item) => {
            const fullNameResponsible = item.nombres + " " + item.apellido1 + " " + (item.apellido2 ?? "");

            const fullNameClient =
                item.tipo_cliente === "Natural"
                    ? [
                          item.nombreCliente || item.nombrecliente || item.nombre_cliente,
                          item.primerApellido || item.primerapellido || item.primer_apellido,
                          item.segundoApellido || item.segundoapellido || item.segundo_apellido,
                      ]
                          .filter(Boolean)
                          .join(" ")
                    : item.nombre_empresa || "";

            return {
                ...item,
                nombres: fullNameResponsible,
                nombreCliente: fullNameClient,
                nombre_cliente: fullNameClient,
                nombrecliente: fullNameClient,
                ansColor: solidColorFromCaseItem(
                    item,
                    due_date_for_ans_calculation,
                    item?.fecha_vencimiento,
                    semaphore_by_state_ans,
                ),
            };
        });
    } else {
        return data.map((item) => {
            const names = item.nombres + " " + item.apellido1 + " " + (item.apellido2 ?? "");
            return {
                ...item,
                nombres: names,
                ans1: item.notExpiredCases,
                ans2: item.intermediateCases,
                ans3: item.expiredCases,
            };
        });
    }
};

export const handleASeniority = (data, showPrefixes = true) => {
    if (!data) return;
    const includePrefix = showPrefixes !== false;
    const dataForm = data.map((item) => {
        const daysText =
            item.antiguedad_dias !== null
                ? (includePrefix ? t("gridMain.text.workingTime") : "") + item.antiguedad_dias + t("gridMain.text.days")
                : (includePrefix ? t("gridMain.text.notWorkingTime") : "0") + t("gridMain.text.days");
        const hoursText =
            item.antiguedad_horas !== null
                ? item.antiguedad_horas + t("gridMain.text.hours")
                : 0 + t("gridMain.text.hours");
        const minutesText =
            item.antiguedad_minutos !== null
                ? item.antiguedad_minutos + t("gridMain.text.minutes")
                : 0 + t("gridMain.text.minutes");
        const seniority = daysText + hoursText + minutesText;
        return {
            ...item,
            antiguedad_dias: seniority,
        };
    });
    return dataForm;
};

export const handleStatus = (data) => {
    if (!data || !Array.isArray(data)) return;
    const dataForm = data.map((item) => {
        let status = t("gridMain.text.pending");
        if (item.is_in_progress) {
            status = t("gridMain.text.inProgress");
        }
        if (item.is_completed) {
            status = t("gridMain.text.completed");
        }
        return { ...item, is_pending: status };
    });
    return dataForm;
};

export const handleFileType = (data) => {
    if (!data || !Array.isArray(data)) return;
    const dataForm = data.map((item) => {
        const fileType = t(`gridMain.text.${item.type}`);
        return { ...item, type: fileType };
    });
    return dataForm;
};

export const getBatchStatusData = (data) => {
    try {
        const statusCounts = {
            pending: 0,
            inProgress: 0,
            completed: 0,
        };

        data.forEach((batch) => {
            if (batch.is_pending) statusCounts.pending++;
            if (batch.is_in_progress) statusCounts.inProgress++;
            if (batch.is_completed) statusCounts.completed++;
        });

        return [
            {
                id: Uuid(),
                title: t("massiveExecution.charts.title.pendingActions"),
                icon: createElement(Clock),
                number: statusCounts.pending,
                color: "bg-blue-600",
            },
            {
                id: Uuid(),
                title: t("massiveExecution.charts.title.inProgressActions"),
                icon: createElement(Loader),
                number: statusCounts.inProgress,
                color: "bg-yellow-600",
            },
            {
                id: Uuid(),
                title: t("massiveExecution.charts.title.completedActions"),
                icon: createElement(Check),
                number: statusCounts.completed,
                color: "bg-green-600",
            },
        ];
    } catch {
        // NO-SONAR: En caso de error, se retorna un array vacío para evitar que el fallo interrumpa el flujo de la aplicación.
        return [];
    }
};

export const handleEndpointType = (data, keyQuery) => {
    if (!data || keyQuery !== "wsRestEndpointsData") return data;
    return data.map((item) => ({ ...item, type: t(`restEndPoint.list.${item.type}`) }));
};

export const handleFunctionType = (data, keyQuery) => {
    if (!data || keyQuery !== "wsRestFunctionData") return data;
    return data.map((item) => ({
        ...item,
        type: t(`restFunctions.form.label.${WSRestFunctionTypeEnum.fromValue(item.type).key}`),
    }));
};

export const handlePrincipalFlow = (data) => {
    return data.map((item) => {
        if ("can_start_sub_cases_flow" in item) {
            return {
                ...item,
                can_start_sub_cases_flow: t(
                    `gridMain.text.${!!item.can_start_sub_cases_flow ? "isPrimary" : "isSubclassification"}`,
                ),
            };
        }
        return item;
    });
};
