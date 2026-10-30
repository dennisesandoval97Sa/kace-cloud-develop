import {
    COLUMNS_NOT_SHOW,
    createFilter,
    DEFAULT_FILTER_SCOPE,
    FILTER_SCOPES,
    getScopedViewFilters,
    levelsClassification,
    pickRestorableFilterValues,
    removeSavedUserFilter,
    resolveDateFilterOperator,
    seedScopeFromLegacyAdmin,
    validateFilters,
    validateSearchToTable,
} from "../helpers";
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiService, normalizeTableDateRangeFilter } from "@kace/utils";
import { useTranslation } from "react-i18next";
import { genericSearchService } from "../../../../../../services/genericSearchService";
import useUserInformation from "../../../../../../hooks/useUserInformation";
import { useDispatch } from "react-redux";
import { setFilterCases } from "../../../../../../redux/state/filterCases";
import { URL_AND_KEYS } from "../../../../../../utils/urlAndKeys";
import useSchemaFields from "@/hooks/useSchemaFields";
import { buildFilterCriteriaFromForm } from "./buildFilterCriteriaFromForm";
import { getCasesHeaderNamespace, resolveGridColumnHeader } from "../../../../../../services/createSchemaFilter";

const createNewFilter = async (payload, userId) => {
    const response = await apiService.post(`/users/${userId}`, payload);
    if (response.status !== 200) {
        throw new Error("FILTER_SAVE_FAILED");
    }
    return response;
};

const syncUserFiltersCache = (queryClient, nextFilters) => {
    queryClient.setQueryData(["userInformation"], (prev) => {
        if (!prev) return prev;
        return {
            ...prev,
            user: { ...prev.user, filters: nextFilters },
        };
    });
};

const useHookFilter = ({
    nameHelper,
    nameTable,
    setValue,
    reset,
    fieldsCustomerFilters,
    baseFilters = [],
    formColumnNames = [],
    numberFieldNames = [],
    scope = DEFAULT_FILTER_SCOPE,
}) => {
    const [columns, setColumns] = useState([]);
    const [modalNewFilter, setModalNewFilter] = useState(false);
    const [dataFiltersUser, setDataFiltersUser] = useState(null);
    const [dataNewFilter, setDataNewFilter] = useState();
    const [toastAlertFilter, setToastAlertFilter] = useState(null);
    const [columnsData, setColumnsData] = useState([]);
    const [initialValues, setInitialValues] = useState({});
    const [isFilter, setIsFilter] = useState(false);
    const [nameFilterSelected, setNameFilterSelected] = useState("");
    const dispatch = useDispatch();
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const { user } = useUserInformation();
    const { getSchemaField } = useSchemaFields();

    useEffect(() => {
        if (user) {
            setDataFiltersUser(user);
        }
    }, [user]);

    const dataFilterColumns = useMemo(() => getSchemaField(nameTable?.entity), [nameTable]);
    /*
     * Cases is the only table whose column headers get the longer, Cases-specific i18n copy
     * (gridMain.columnsCases.*). Every other table keeps resolving through the shared
     * gridMain.columns.* keys, since those are reused by Roles, Groups, Users, etc. See
     * getCasesHeaderNamespace for why both .entity and .key are checked.
     */
    const casesHeaderNamespace = getCasesHeaderNamespace(nameTable);

    const functionMap = {
        levelsClassification,
    };

    const handleSearchFilter = (dataProps) => {
        if (isFilter) {
            const newFilter = createFilter(dataProps);
            const oldFilter = getScopedViewFilters(dataFiltersUser?.filters, nameTable.view, scope)[nameFilterSelected];
            if (JSON.stringify(newFilter) !== JSON.stringify(oldFilter)) {
                const toastId = toast.info(t("app.text.confirmUpdateFilter"), {
                    duration: 10000,
                    closeButton: true,
                    position: "top-center",
                    actionButtonStyle: {
                        backgroundColor: "#0873DC",
                        borderRadius: "25%",
                    },
                    action: {
                        label: t("app.button.yes"),
                        onClick: () => {
                            handleNewFilter(nameFilterSelected, dataProps, true);
                            toast.dismiss();
                        },
                    },
                });
                setToastAlertFilter(toastId);
            }
        } else {
            const toastId = toast.info(t("app.text.confirmSaveFilter"), {
                duration: 10000,
                closeButton: true,
                position: "top-center",
                actionButtonStyle: {
                    backgroundColor: "#0873DC",
                    borderRadius: "25%",
                },
                action: {
                    label: t("app.button.yes"),
                    onClick: () => {
                        setModalNewFilter(true);
                        toast.dismiss();
                    },
                },
            });
            setToastAlertFilter(toastId);
        }
    };

    const handleNewFilter = async (name, dataProps, update) => {
        const filterName = typeof name === "string" ? name.trim() : "";
        if (!filterName) {
            toast.error(t("app.text.filterNameRequired"));
            return false;
        }

        const viewFilters = getScopedViewFilters(user?.filters, nameTable.view, scope);
        if (!update && Object.hasOwn(viewFilters, filterName)) {
            toast.error(t("app.text.filterNameExists"));
            return false;
        }

        const newFilter = update ? createFilter(dataProps) : createFilter(dataNewFilter);
        const nextFilters = structuredClone(user?.filters ?? {});
        /*
         * Captured BEFORE validateFilters, which unconditionally creates an empty view bucket when
         * missing — that init would otherwise erase the "never seeded" vs. "seeded then emptied"
         * distinction the seeding rule below depends on.
         */
        const scopeViewExistedBeforeInit = nextFilters.application?.[scope]?.[nameTable.view] !== undefined;
        validateFilters({ filters: nextFilters }, nameTable.view, scope);

        seedScopeFromLegacyAdmin(nextFilters, nameTable.view, scope, scopeViewExistedBeforeInit);
        const scopeViewFilters = nextFilters.application[scope][nameTable.view];
        scopeViewFilters[filterName] = newFilter;

        const { id, account_type, grupo_activo } = user;
        const savePromise = createNewFilter({ account_type, grupo_activo, filters: nextFilters }, id).then(() => {
            syncUserFiltersCache(queryClient, nextFilters);
            setDataFiltersUser({ ...user, filters: nextFilters });
            setIsFilter(true);
            setNameFilterSelected(filterName);
        });

        toast.promise(savePromise, {
            loading: t("app.text.savingFilter"),
            success: () => t(update ? "app.text.filterUpdated" : "app.text.filterSaved"),
            position: "top-center",
            className: "bg-blue-400",
            error: (error) =>
                error?.message && error.message !== "FILTER_SAVE_FAILED"
                    ? error.message
                    : t("app.text.filterSaveError"),
        });

        try {
            await savePromise;
            return true;
        } catch {
            return false;
        }
    };

    const handleSelectFilter = (name) => {
        const filterSelected = getScopedViewFilters(dataFiltersUser?.filters, nameTable.view, scope)[name];
        if (!filterSelected) {
            return {};
        }

        reset();
        setIsFilter(true);
        setNameFilterSelected(name);
        const knownColumnNames =
            formColumnNames.length > 0 ? formColumnNames : columns.map((column) => column.column_name);
        const restored = pickRestorableFilterValues(filterSelected, knownColumnNames);
        Object.entries(restored).forEach(([key, value]) => setValue(key, value));
        const updatedColumns = columns
            .map((column) => {
                const { column_name } = column;
                if (COLUMNS_NOT_SHOW.includes(column_name)) return null;
                return {
                    ...column,
                    header: resolveGridColumnHeader(column, t, casesHeaderNamespace),
                };
            })
            .filter((column) => column !== null);

        setColumnsData(updatedColumns);
        onSubmit(restored, false);
        return restored;
    };

    const handleDeleteFilter = async (name) => {
        const { id, filters, account_type, grupo_activo } = user;
        /*
         * A filter that only exists via the admin fallback (legacy) does not live in the agente
         * bucket, so always forcing the hook's own scope breaks that delete end to end. Fall back to
         * the admin scope only when the agente bucket does not exist AT ALL for this view (never
         * seeded) — never when it exists but is merely empty (e.g. every agente filter was already
         * deleted), since admin's legacy filters must not reappear once agente has its own bucket.
         */
        const ownScopeExists = filters?.application?.[scope]?.[nameTable.view] !== undefined;
        let targetScope = scope;
        if (!ownScopeExists && scope === FILTER_SCOPES.AGENTE) {
            targetScope = FILTER_SCOPES.ADMIN;
        }
        const nextFilters = removeSavedUserFilter(filters, nameTable.view, name, targetScope);
        if (nextFilters === filters) return false;

        try {
            await createNewFilter({ account_type, grupo_activo, filters: nextFilters }, id);
            syncUserFiltersCache(queryClient, nextFilters);
            setDataFiltersUser({ ...user, filters: nextFilters });
            if (nameFilterSelected === name) {
                setNameFilterSelected("");
                setIsFilter(false);
            }
            return true;
        } catch (error) {
            toast.error(
                error?.message && error.message !== "FILTER_SAVE_FAILED"
                    ? error.message
                    : t("app.text.deleteFilterError"),
            );
            return false;
        }
    };

    const clearSelectedSavedFilter = () => {
        setIsFilter(false);
        setNameFilterSelected("");
    };

    const handleHelpers = () => {
        if (nameHelper.length > 0 || columns.length > 0) {
            setColumnsData(
                columns
                    .map((column) => {
                        const listFilter = nameHelper.filter((item) => item.column === column.column_name);
                        if (listFilter.length > 0) {
                            const functionName = listFilter[0].helper;
                            if (functionMap[functionName]) {
                                const options = functionMap[functionName](listFilter[0].data);
                                column.options = options;
                            }
                        }

                        if (COLUMNS_NOT_SHOW.includes(column.column_name)) {
                            return null;
                        }
                        return {
                            ...column,
                            header: resolveGridColumnHeader(column, t, casesHeaderNamespace),
                        };
                    })
                    .filter((column) => column !== null),
            );
        }
    };

    const resolveStatusOperator = (formData) => {
        const statusForm =
            formData?.status !== undefined ? "status" : formData?.is_active !== undefined ? "is_active" : null;

        const status = statusForm ? formData[statusForm] : null;
        if (status === "" || status === undefined || status === null) return null;
        /*
         * Este helper es para los switches Activo/Inactivo (0/1). Las columnas status de tipo texto
         * (p.ej. s3_import_files.status) se filtran por su valor literal y no deben sobreescribirse.
         */
        if (typeof status !== "number" && typeof status !== "boolean") return null;
        const operator = status === 0 ? "neq" : status === 1 ? "eq" : null;
        formData[statusForm] = 1;
        return operator;
    };

    const onSubmit = async (dataForm, showModal = true) => {
        const casesTable = nameTable.key === URL_AND_KEYS.cases.key;
        const statusOperator = resolveStatusOperator(dataForm);
        const isThereData = Object.values(dataForm).some((value) => value !== "");
        if (!isThereData) {
            toast.info(t("app.text.noFiltersToApply"));
            return;
        }

        const filter = buildFilterCriteriaFromForm({
            dataForm,
            nameTable,
            fieldsCustomerFilters,
            resolveDateOperator: resolveDateFilterOperator,
            validateSearchToTable,
            casesTable,
            casesFilterTitle: t("app.text.filteredCases"),
            normalizeDateRange: (value) => {
                const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
                return normalizeTableDateRangeFilter(value, userTimezone, { mode: "date" });
            },
            statusOperator,
            numberFieldNames,
        });

        const hadDateFields = Object.entries(dataForm).some(
            ([key, value]) => value !== "" && value != null && resolveDateFilterOperator(key),
        );
        if (!filter.length && hadDateFields) {
            toast.info(t("app.text.invalidDateRange"));
            return;
        }

        /*
         * buildFilterCriteriaFromForm produce como mucho un criterio por campo con valor, y puede descartar
         * alguno en silencio: resolveFilterCriterion devuelve null (p.ej. "nivel2/null", que SelectByListLevels
         * emite en cuanto se elige un nivel sin escoger valor) o normalizeDateRange no interpreta el rango.
         * Antes esos valores viajaban al backend y no devolvian nada; ahora el criterio desaparece y la
         * busqueda se amplia. En Ejecucion Masiva el filtro define el alcance de una accion irreversible,
         * asi que el descarte tiene que ser visible.
         */
        const filledFieldCount = Object.values(dataForm).filter(Boolean).length;
        if (filter.length < filledFieldCount) {
            toast.warning(t("app.text.someFiltersDiscarded"));
            /*
             * Sin ningun criterio la busqueda devolveria el universo completo y, al no despacharse
             * setFilterCases, la tabla de resultados y el search_filter que se ejecuta quedarian
             * apuntando a conjuntos distintos.
             */
            if (!filter.length) return;
        }

        if (filter.length && (casesTable || nameTable.key === "actionJobsFilterCases")) {
            dispatch(setFilterCases([...baseFilters, ...filter]));
        }
        if (!casesTable) {
            const table = nameTable.view === "assignment-users-list" ? false : nameTable.view;
            const response = await queryClient.fetchQuery({
                queryKey: [nameTable.key, []],
                queryFn: async () =>
                    genericSearchService(
                        `${nameTable.url}/search`,
                        filter,
                        {
                            limit: 0,
                            offset: 0,
                        },
                        table,
                    ),
                staleTime: 0,
                gcTime: 0,
                refetchOnWindowFocus: false,
            });
            queryClient.setQueryData([nameTable.key, [], null], {
                data: response.data,
            });
        }
        setDataNewFilter(dataForm);
        if (showModal) {
            handleSearchFilter(dataForm);
        }
    };

    const filterHeaders = (data) => {
        const filteredData = Array.from(
            data
                .reduce((map, item) => {
                    if (!map.has(item.column_name)) {
                        map.set(item.column_name, item);
                    }
                    return map;
                }, new Map())
                .values(),
        );
        return filteredData;
    };

    useEffect(() => {
        if (dataFilterColumns) {
            const dataFilterColumnsByOne = filterHeaders(dataFilterColumns);
            setColumns(dataFilterColumnsByOne);
        }
    }, [dataFilterColumns]);

    useEffect(() => {
        const transformedObject = {};
        columns.forEach((column) => {
            transformedObject[column.column_name] = "";
        });
        setInitialValues(transformedObject);
    }, [columns]);

    useEffect(() => {
        if (nameHelper.length && columns.length) {
            handleHelpers();
        }
    }, [nameHelper, columns]);

    useEffect(() => {
        if (Object.keys(initialValues).length > 0) {
            reset(initialValues);
        }
    }, [initialValues]);

    const handleClear = () => {
        const isCasesTable = nameTable?.key === URL_AND_KEYS.cases.key || nameTable?.key === "actionJobsFilterCases";
        if (isCasesTable) {
            dispatch(setFilterCases([...baseFilters]));
        }
        clearSelectedSavedFilter();
    };

    return {
        modalNewFilter,
        toastAlertFilter,
        columnsData,
        onSubmit,
        handleSelectFilter,
        handleDeleteFilter,
        dataFiltersUser,
        handleNewFilter,
        setModalNewFilter,
        handleHelpers,
        handleClear,
        clearSelectedSavedFilter,
    };
};

export default useHookFilter;
