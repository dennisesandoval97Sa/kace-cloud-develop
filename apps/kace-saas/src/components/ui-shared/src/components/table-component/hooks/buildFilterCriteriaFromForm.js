import { identityFilterOperator } from "@/utils/identityFilterField";

/*
 * Matches composite "nivelX/Valor" picker values (nivel1-nivel10). Kept local so
 * ui-shared stays decoupled from the Cases classificationLevels util.
 */
const NIVEL_COLUMN_PATTERN = /^nivel([1-9]|10)$/i;

export const buildFilterCriteriaFromForm = ({
    dataForm,
    nameTable,
    fieldsCustomerFilters,
    resolveDateOperator,
    validateSearchToTable,
    casesTable,
    casesFilterTitle = "",
    normalizeDateRange,
    statusOperator = null,
    numberFieldNames = [],
}) => {
    const numberFields = new Set(numberFieldNames);

    return Object.entries(dataForm).reduce((criteria, [key, value]) => {
        if (!value) return criteria;

        const customField = fieldsCustomerFilters?.find?.((field) => field.field === key);
        const validatedField = validateSearchToTable({
            view: nameTable.view,
            field: key,
        });
        const hasCriterionResolver = typeof nameTable.resolveFilterCriterion === "function";
        const dateOperator = resolveDateOperator(key);
        let filterValue = dateOperator ? normalizeDateRange(value) : value;
        if (dateOperator && (filterValue === null || filterValue === undefined)) {
            return criteria;
        }

        let resolvedField = key;
        let resolvedOperator = null;

        /*
         * `resolveFilterCriterion` tiene precedencia y anula `transformFilterField`: son ramas excluyentes,
         * asi que declarar ambas en el mismo `nameTable` deja el transformer sin efecto.
         */
        if (hasCriterionResolver) {
            const resolved = nameTable.resolveFilterCriterion({
                field: key,
                value: filterValue,
            });
            if (resolved === null) return criteria;
            resolvedField = resolved.field;
            filterValue = resolved.value;
            resolvedOperator = resolved.operator ?? null;
        } else {
            const transformFilterField = nameTable.transformFilterField;
            let isClassificationLevelValue = false;

            if (transformFilterField && typeof filterValue === "string" && filterValue.includes("/")) {
                const [levelField, ...levelValueParts] = filterValue.split("/");
                if (NIVEL_COLUMN_PATTERN.test(levelField)) {
                    isClassificationLevelValue = true;
                    resolvedField = transformFilterField(levelField);
                    if (resolvedField === null) {
                        return criteria;
                    }
                    filterValue = levelValueParts.join("/");
                }
            }

            if (!isClassificationLevelValue) {
                resolvedField = transformFilterField ? transformFilterField(key) : key;
            }
        }

        if (numberFields.has(key) && typeof filterValue === "string" && /^\d+$/.test(filterValue)) {
            filterValue = Number(filterValue);
            if (!resolvedOperator) resolvedOperator = "eq";
        }

        const defaultField =
            validatedField ||
            customField?.newValue ||
            (!nameTable.view || nameTable.view === "assignment-users-list" ? key : `${nameTable.view}.${key}`);
        const field = resolvedField !== key ? resolvedField : defaultField;
        const criterion = {
            operator:
                resolvedOperator ??
                dateOperator ??
                identityFilterOperator(key) ??
                identityFilterOperator(field) ??
                statusOperator ??
                (numberFields.has(key) ? "eq" : null) ??
                (typeof value === "string" ? "ilike" : "eq"),
            value: filterValue,
            type: "AND",
            ...(casesTable ? { column: field, title: casesFilterTitle } : { field }),
        };

        criteria.push(criterion);
        return criteria;
    }, []);
};
