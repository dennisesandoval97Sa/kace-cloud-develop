import {
    COLUMNS_NOT_SHOW,
    columnsToNotShowByTable,
    createFilter,
    FILTER_SCOPES,
    levelsClassification,
    validateFilters,
} from "../helpers";
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiService } from "@kace/utils";
import { useTranslation } from "react-i18next";
import { genericSearchService } from "../../../../../../services/genericSearchService";
import { GeolocationTypes } from "../../../../../../enums/GeolocationTypes";
import { format, fromZonedTime, toZonedTime } from "date-fns-tz";
import useUserInformation from "../../../../../../hooks/useUserInformation";
import useSchemaFields from "@/hooks/useSchemaFields";
import { identityFilterOperator } from "@/utils/identityFilterField";

const createNewFilter = async (payload, id) => {
    const response = await apiService.post(`/users/${id}`, payload);
    if (response.status !== 200) {
        throw new Error("Error al guardar el filtro");
    }
    return response;
};

const useHookFilterOld = ({ nameHelper, nameTable, keyQueryData, setValue, reset }) => {
    const [columns, setColumns] = useState([]);
    const [modalNewFilter, setModalNewFilter] = useState(false);
    const [dataFiltersUser, setDataFiltersUser] = useState(null);
    const [dataNewFilter, setDataNewFilter] = useState();
    const [toastAlertFilter, setToastAlertFilter] = useState(null);
    const [columnsData, setColumnsData] = useState([]);
    const [initialValues, setInitialValues] = useState({});
    const [isFilter, setIsFilter] = useState(false);
    const [appliedFilterValues, setAppliedFilterValues] = useState(null);
    const [nameFilterSelected, setNameFilterSelected] = useState("");
    const [valueOfLevel, setValueOfLevel] = useState(null);
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const { user } = useUserInformation();
    const { getSchemaField } = useSchemaFields();

    useEffect(() => {
        if (user) {
            setDataFiltersUser(user);
        }
    }, [user]);

    const dataFilterColumns = useMemo(() => getSchemaField(nameTable.schemaFields ?? nameTable.table), []);

    const functionMap = {
        levelsClassification,
    };

    const handleSearchFilter = (dataProps) => {
        if (isFilter) {
            const newFilter = createFilter(dataProps);
            const oldFilter =
                dataFiltersUser.filters.application[FILTER_SCOPES.ADMIN][nameTable.table][nameFilterSelected];
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
        let newFilter = null;
        if (update) {
            newFilter = createFilter(dataProps);
        } else {
            newFilter = createFilter(dataNewFilter);
        }
        /**
         * NO-SONAR: comentario para posterior refactorización
         * TODO: Evitar la mutación directa de dataFiltersUser y usar una copia inmutable antes de actualizar.
         */
        validateFilters(dataFiltersUser, nameTable.table, FILTER_SCOPES.ADMIN);
        dataFiltersUser.filters.application[FILTER_SCOPES.ADMIN][nameTable.table][name] = newFilter;
        const { id, filters } = dataFiltersUser;

        toast.promise(
            createNewFilter(
                {
                    account_type: user.account_type,
                    grupo_activo: user.grupo_activo,
                    filters,
                },
                id,
            ),
            {
                loading: "Guardando filtro",
                success: () => {
                    return `Filtro ${dataProps ? "actualizado" : "guardado"} correctamente`;
                },
                error: (error) => {
                    return error.message;
                },
            },
        );
    };

    const handleSelectFilter = (name) => {
        setIsFilter(true);
        setNameFilterSelected(name);
        const filterSelected = dataFiltersUser.filters.application[FILTER_SCOPES.ADMIN][nameTable.table][name];
        const updatedColumns = columns
            .map((column) => {
                const { column_name } = column;
                const fieldValue = Object.keys(filterSelected).find((key) => key === column_name);

                if (fieldValue !== undefined) {
                    setValue(column_name, filterSelected[fieldValue]);
                }
                if (column.column_name === "action_type") column.options = GeolocationTypes.getLabel();

                const canShowFieldInModuleFilters = columnsToNotShowByTable[nameTable.schemaFields]
                    ? columnsToNotShowByTable[nameTable.schemaFields].includes(column.column_name)
                    : false;
                if (COLUMNS_NOT_SHOW.includes(column.column_name) || canShowFieldInModuleFilters) return null;
                return {
                    ...column,
                    header: t(`gridMain.columns.${column.label}`),
                };
            })
            .filter((column) => column !== null);

        setColumnsData(updatedColumns);
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

                        if (column.column_name === "action_type") column.options = GeolocationTypes.getLabel();

                        const canShowFieldInModuleFilters = columnsToNotShowByTable[nameTable.schemaFields]
                            ? columnsToNotShowByTable[nameTable.schemaFields].includes(column.column_name)
                            : false;
                        if (COLUMNS_NOT_SHOW.includes(column.column_name) || canShowFieldInModuleFilters) return null;
                        return {
                            ...column,
                            header: t(`gridMain.columns.${column.label}`),
                        };
                    })
                    .filter((column) => column !== null),
            );
        }
    };

    const isColumnDate = (column) => {
        const keyWords = ["fecha", "created_at", "updated_at"];
        return keyWords.some((word) => column.includes(word));
    };

    const resolveStatusOperator = (formData) => {
        const statusForm =
            formData?.status !== undefined ? "status" : formData?.is_active !== undefined ? "is_active" : null;

        const status = statusForm ? formData[statusForm] : null;
        if (status === "" || status === undefined || status === null) return null;
        const operator = status === 0 ? "neq" : status === 1 ? "eq" : null;
        formData[statusForm] = 1;
        return operator;
    };

    const onSubmit = async (dataForm) => {
        const formSnapshot = { ...dataForm };
        const statusOperator = resolveStatusOperator(dataForm);
        const isThereData = Object.values(dataForm).some((value) => value !== "");
        if (!isThereData) {
            toast.info(t("app.text.noFiltersToApply"));
            return;
        }

        const hasActionTypeProp = Object.keys(dataForm).find((item) => item === "action_type");
        if (hasActionTypeProp && dataForm.action_type) {
            dataForm.action_type = GeolocationTypes.getLabel(dataForm.action_type);
        }

        const filter = Object.entries(dataForm).reduce((acc, [key, value]) => {
            if (value) {
                let filterValue = value;

                if (isColumnDate(key)) {
                    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

                    const [startUTC, endUTC] = value.split(", ").map((date) => date.trim());

                    const startLocal = toZonedTime(new Date(startUTC), userTimezone);
                    const endLocal = toZonedTime(new Date(endUTC), userTimezone);

                    const startOfDayUTC = format(fromZonedTime(startLocal, userTimezone), "yyyy-MM-dd'T'HH:mm:ss.SSSX");

                    const endOfDayUTC = format(fromZonedTime(endLocal, userTimezone), "yyyy-MM-dd'T'HH:mm:ss.SSSX");

                    filterValue = `${startOfDayUTC}, ${endOfDayUTC}`;
                }
                const field =
                    key === "nivel1" && valueOfLevel !== null
                        ? `clasificaciones.${valueOfLevel}`
                        : `${nameTable.schemaFields}.${key}`;
                acc.push({
                    field,
                    operator: isColumnDate(key)
                        ? "between"
                        : statusOperator ||
                          identityFilterOperator(key) ||
                          identityFilterOperator(field) ||
                          (typeof value === "string" ? "ilike" : "eq"),
                    value: filterValue,
                    type: "AND",
                });
            }
            return acc;
        }, []);

        if (filter.length > 0) {
            filter[filter.length - 1].type = "AND";
        }

        const response = await queryClient.fetchQuery({
            queryKey: [keyQueryData],
            queryFn: async () =>
                genericSearchService(
                    `${nameTable.table}/search`,
                    filter,
                    {
                        limit: 100,
                        offset: 0,
                    },
                    nameTable.schemaFields,
                ),
        });
        queryClient.setQueryData([keyQueryData], { data: response.data });
        handleSearchFilter(dataForm);
        setDataNewFilter(dataForm);
        setAppliedFilterValues(formSnapshot);
        setIsFilter(false);
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
            if (COLUMNS_NOT_SHOW.includes(column.column_name)) return;
            transformedObject[column.column_name] = "";
        });
        setInitialValues(transformedObject);
    }, [columns]);

    useEffect(() => {
        handleHelpers();
    }, [nameHelper, columns]);

    useEffect(() => {
        if (Object.keys(initialValues).length > 0) {
            reset(initialValues);
        }
    }, [initialValues]);

    return {
        modalNewFilter,
        toastAlertFilter,
        columnsData,
        onSubmit,
        handleSelectFilter,
        dataFiltersUser,
        handleNewFilter,
        setModalNewFilter,
        handleHelpers,
        setValueOfLevel,
        appliedFilterValues,
        setAppliedFilterValues,
        initialValues,
    };
};

export default useHookFilterOld;
