import { pathToObject } from "@kace_v2/features/boards/utils/pathToObject.util";
import { normalizeTableDateRangeFilter } from "@kace/utils";
import { isIdentityFilterField } from "@/utils/identityFilterField";

export const filterBuilder = (type, field, value, entity = null, functionName = null, alias = null) => {
    if (field.includes("aux_")) {
        const [entityName, ...rest] = field.split(".");
        const path = rest.join(".");
        return {
            field: `${entityName}.data`,
            operator: "jsonContains",
            value: JSON.stringify(pathToObject(path, value)),
            /*
             * El valor crudo se pierde dentro del JSON del jsonContains: se guarda
             * aparte para poder repintar el input y el chip. sanitizeCriteria lo
             * elimina antes de enviar el criterio a la API.
             */
            displayValue: value,
            type: "AND",
            ...(entity && { entity }),
        };
    }

    const baseFilter = {
        field: alias || field,
        ...(entity && { entity }),
    };
    const isFunction = functionName && functionName.length > 0;
    if (isFunction) {
        baseFilter.field = alias || field;
        return {
            ...baseFilter,
            operator: "eq",
            type: "AND",
            value,
        };
    }

    switch (type) {
        case "string":
            return {
                ...baseFilter,
                operator: isIdentityFilterField(alias || field) ? "eq" : "ilike",
                type: "AND",
                value,
            };

        case "number":
            return {
                ...baseFilter,
                operator: "eq",
                type: "AND",
                value,
            };

        case "boolean":
            return {
                ...baseFilter,
                operator: "eq",
                type: "AND",
                value: Boolean(value),
            };

        case "date": {
            const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            const normalized = normalizeTableDateRangeFilter(value, timeZone, { mode: "date" });
            if (normalized === null) return null;
            return {
                ...baseFilter,
                operator: "between",
                type: "AND",
                value: normalized,
            };
        }

        default:
            return null;
    }
};
