import { useEffect, useMemo, useState } from "react";
import { createChildren, handleASeniority, handleFullName, handleState, handleStateTimer } from "../../../utils/main";
import { URL_AND_KEYS } from "../../../utils/urlAndKeys";
import useGenericSearchQuery from "../../../hooks/useGenericSearchQuery";
import { useSelector, useDispatch } from "react-redux";
import { setCurrentColor, setTitle } from "../../../redux/state/filterCases";
import { getCasesHeaderNamespace, getSchemaFilter, SPECIAL_FIELDS } from "../../../services/createSchemaFilter";
import useSchemaFields from "@/hooks/useSchemaFields";
import useConfigAgentData from "@/hooks/useConfigAgentData";
import { genericSearchService } from "@/services/genericSearchService";
import { applyTimeDescriptionDisplay } from "@/utils/src/utils/timeDescriptionPrefix";
import { attachMaxLevelToClassificationField } from "../components/CaseDataTable/utils/processCasesData";
import {
    getMaxAvailableNivelLevel,
    MAX_CLASSIFICATION_LEVELS,
} from "../components/CaseDataTable/utils/classificationLevels.util";

const processData = (
    data,
    due_date_for_ans_calculation = false,
    semaphore_by_state_ans = false,
    show_time_description_prefixes = true,
    schema = null,
) => {
    const items =
        handleStateTimer(
            handleASeniority(
                handleFullName(
                    createChildren(handleState(data?.data?.items || data?.data || "")),
                    "allCases",
                    due_date_for_ans_calculation,
                    semaphore_by_state_ans,
                ),
                show_time_description_prefixes,
            ),
            [],
            schema,
        ) || [];
    const metadata = data.metadata || {};
    return {
        items: items.map((item) => applyTimeDescriptionDisplay(item, show_time_description_prefixes)),
        metadata,
    };
};

const filterShowColumns = (columnData, fieldsNoShow = []) => {
    return columnData.filter((column) => !fieldsNoShow.includes(column.column_name));
};

const capitalizeFirstLetter = (str) => {
    if (!str) return str;
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

const useCasesTableData = ({
    keyQuery = "",
    altoImpacto,
    customSchemaFilterConfig = {},
    isCustomViewEnabled = false,
    customViewName = null,
    refetchInterval = false,
}) => {
    const [headers, setHeaders] = useState([]);
    const [currentFilters, setCurrentFilters] = useState([]);
    const [columnsToFilter, setColumnsToFilter] = useState([]);
    const filter = useSelector((state) => state.filterCases.filter);
    const dispatch = useDispatch();
    const { getSchemaField } = useSchemaFields();
    const { cases: configCases, agent_filter_subcases_only } = useConfigAgentData();

    const defaultIgnoreFields = [
        "nivel2",
        "nivel3",
        "nivel4",
        "nivel5",
        "nivel6",
        "nivel7",
        "nivel8",
        "nivel9",
        "nivel10",
        "antiguedad",
        "login",
        "caso_clonado_id",
        "antiguedad_horas",
        "antiguedad_minutos",
        "primer_apellido",
        "tipo_cliente",
        "segundo_apellido",
        "usuario_inactivo",
        "color_ans_inicial",
        "color_ans_intermedio",
        "color_ans_final",
        "nombre_empresa",
        "cambio_estado_comentario_id",
        "motivo_baja",
        "created_by",
        "creator_external_id",
        "documento",
        "deleted_at",
        "responsable_id",
        "cliente_id",
        "deleted_at",
        "deleted_by",
        "parent_id",
    ];

    const {
        classificationFields = [
            {
                column_name: "nivel1",
                field: SPECIAL_FIELDS.classification_levels,
            },
        ],
        extraIgnoreFields = [],
    } = customSchemaFilterConfig;
    const filterIgnoreFields = [...defaultIgnoreFields, "id", "antiguedad_dias", "ans_posicion"];
    const ignoreFields = Array.from(new Set([...filterIgnoreFields, ...extraIgnoreFields]));
    const params = {
        ...URL_AND_KEYS.cases,
    };
    if (isCustomViewEnabled) {
        // customViewName is the tenant's actual configured view (e.g. "view_case_admin"),
        // not the generic customEntity constant — without it, the schema lookup below
        // always resolves to the default view (view_case_details, all 10 nivel columns),
        // so a custom view with fewer levels never gets capped correctly.
        params.entity = customViewName || URL_AND_KEYS.cases.customEntity;
        params.url = URL_AND_KEYS.cases.urlView;
        params.view = null;
    }

    const dataHeaders = useMemo(() => getSchemaField(params.entity), [params.entity]);

    const maxNivelLevel = useMemo(
        () => (isCustomViewEnabled ? getMaxAvailableNivelLevel(dataHeaders ?? []) : MAX_CLASSIFICATION_LEVELS),
        [isCustomViewEnabled, dataHeaders],
    );

    const {
        data: dataTable,
        isLoading: isLoadingTable,
        refetch,
        isFetching,
        isError: tableError,
    } = useGenericSearchQuery({
        url: `${params.url}/search`,
        keyQuery,
        table: params.view,
        enabled: currentFilters,
        filter: altoImpacto
            ? [
                  ...currentFilters,
                  {
                      field: "alto_impacto",
                      operator: "eq",
                      value: 1,
                      type: "AND",
                  },
              ]
            : currentFilters,
        select: (data) =>
            processData(
                data,
                configCases?.due_date_for_ans_calculation,
                configCases?.semaphore_by_state_ans,
                configCases?.show_time_description_prefixes ?? true,
                dataHeaders,
            ),
        pagination: {
            limit: 0,
            offset: 0,
        },
        options: {
            refetchInterval,
            refetchIntervalInBackground: !!refetchInterval,
        },
    });

    const caseStatusCounter = useMemo(() => {
        const countByStatus = dataTable?.metadata?.countByStatus || [];
        return countByStatus.map((item) => ({
            title: item?.status || "Desconocido",
            number: item?.count || 0,
            color: item?.color ?? null,
        }));
    }, [dataTable]);

    useEffect(() => {
        if (filter) {
            let filterToSend = [];
            if (Array.isArray(filter)) {
                filterToSend = filter.map((filter) => {
                    const operator =
                        agent_filter_subcases_only &&
                        (filter.column === "parent_id" || filter.column === "cases.parent_id")
                            ? "notNull"
                            : filter.operator;
                    return {
                        field: filter.column,
                        value: filter.value,
                        type: filter.type,
                        operator: operator,
                    };
                });
                if (agent_filter_subcases_only) {
                    const isParentIdFilter = filterToSend.find(
                        (filter) => filter.field === "parent_id" || filter.field === "cases.parent_id",
                    );
                    if (!isParentIdFilter) {
                        filterToSend.push({
                            field: "parent_id",
                            value: "null",
                            type: "AND",
                            operator: "notNull",
                        });
                    }
                }
                dispatch(setTitle(filter[0].title));
                setCurrentFilters(filterToSend);
            } else {
                const newArray = [
                    ...filterToSend,
                    {
                        field: filter.column,
                        value: filter.value,
                        type: filter.type,
                        operator: filter.operator,
                    },
                ];
                if (filter.name && filter.name !== "managed") {
                    newArray.push({
                        field: "fecha_resolucion",
                        value: "null",
                        type: "AND",
                        operator: "null",
                    });
                }
                dispatch(setCurrentColor(filter.color));
                dispatch(setTitle(capitalizeFirstLetter(filter.title)));
                setCurrentFilters(newArray);
            }
        } else {
            setCurrentFilters([]);
        }
    }, [filter]);

    useEffect(() => {
        if (!dataHeaders) return;

        const ignore = [...defaultIgnoreFields, "apellido1", "apellido2", "primerapellido", "segundoapellido"];
        const filtered = filterShowColumns(dataHeaders, ignore);

        const transform = (row, modifyClient = true) => {
            const out = { ...row };

            if (!isCustomViewEnabled) {
                if (row.column_name === "estado_actual") out.column_name = "estadoActual";
                if (modifyClient && row.column_name === "nombre_cliente") out.column_name = "nombreCliente";
            }

            out.label =
                out.column_name === "nivel1"
                    ? "ByLevel"
                    : out.column_name.charAt(0).toUpperCase() + out.column_name.replace("_", " ").substring(1);

            return out;
        };

        const reorder = (arr) => (arr.length ? [arr[arr.length - 1], ...arr.slice(0, -1)] : arr);

        const headers = filtered.map(transform);
        const schema = dataHeaders.map((r) => transform(r, false));
        const schemaFilter = attachMaxLevelToClassificationField(
            getSchemaFilter(
                schema,
                [{ column_name: "reference", field: SPECIAL_FIELDS.number }, ...classificationFields],
                ignoreFields,
                getCasesHeaderNamespace(params),
            ),
            maxNivelLevel,
        );

        const finalHeaders = isCustomViewEnabled ? headers : reorder(headers);
        const finalSchema = isCustomViewEnabled ? schemaFilter : reorder(schemaFilter);

        setColumnsToFilter(finalSchema);
        setHeaders(finalHeaders);
    }, [dataHeaders, maxNivelLevel]);

    return {
        headers,
        dataTable: dataTable?.items || [],
        isLoadingTable,
        refetch,
        isFetching,
        errors: tableError,
        columnsToFilter,
        maxNivelLevel,
        fieldsCustomerFilters: null,
        caseStatusCounter,
        showSubcasesButton: !agent_filter_subcases_only,
    };
};

export const fetchSubcases = async (parentId, { limit = 10, offset = 0 } = {}) => {
    const base = URL_AND_KEYS.cases.url;
    const url = `${base}/${parentId}/sub-cases/search`;
    const filter = [
        {
            groupType: "OR",
            filters: [
                { field: "cases.is_visible", operator: "eq", value: "true", type: "OR" },
                { field: "cases.is_visible", operator: "null", value: "null", type: "OR" },
            ],
        },
    ];
    return genericSearchService(url, filter, { limit, offset }, null, false, null, null, null);
};

export default useCasesTableData;
