import { Button, Label } from "@kace/ui-shared";
import { InputValueDepend } from "../../../components/ui-shared/src/components/table-component/InputValueDepend";
import useHookFilter from "../../../components/ui-shared/src/components/table-component/hooks/useHookFilter";
import { useForm } from "react-hook-form";
import { URL_AND_KEYS } from "../../../utils/urlAndKeys";
import { createCasesFilterCriterionResolver } from "../../../pages/Cases/components/CaseDataTable/utils/transformNivelFilters";
import useMassiveExecutionCasesTable from "../hooks/useMassiveExecutionCasesTable";
import { useTranslation } from "react-i18next";
import { useCallback, useEffect, useMemo, useRef } from "react";
import useMassiveExecutionCasesForm from "../hooks/useMassiveExecutionCasesForm";
import useMassiveExecutionClientsForm from "../hooks/useMassiveExecutionClientsFileForm";
import { GeneralLoader } from "../../../components/ui-shared/src/components/general-loader";
import { useSelector } from "react-redux";
import { useQueryClient } from "@tanstack/react-query";
import MassiveExecutionSelectType from "@/pages/MassiveExecution/components/MassiveExecutionSelectType";

const deeplyEqual = (previous, current) => {
    const keysA = Object.keys(previous);
    const keysB = Object.keys(current);
    if (keysA.length !== keysB.length) return false;
    for (const key of keysA) {
        if (previous[key] !== current[key]) return false;
    }
    return true;
};

const MassiveExecutionCasesFilterForm = () => {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const searchFilter = useSelector((state) => state.filterCases.filter);
    const { columnsToFilter, dataTable } = useMassiveExecutionCasesTable();
    const nameTable = useMemo(
        () => ({
            ...URL_AND_KEYS.cases,
            key: "actionJobsFilterCases",
            resolveFilterCriterion: createCasesFilterCriterionResolver({ isCustomView: false }),
        }),
        [],
    );
    /*
     * Vacio a proposito: los alias de view_casos (estadoActual -> estados.nombre incluido) los resuelve
     * `resolveFilterCriterion`, que tiene precedencia sobre `fieldsCustomerFilters` en el builder.
     */
    const fieldsCustomerFilters = [];

    const { handleSubmit, control, reset, setValue, watch } = useForm({
        defaultValues: {
            created_at: null,
            action_type: null,
            action_id: null,
            restflow_id: null,
            search_filter: null,
        },
        restflow_context: {},
    });

    const valuesRef = useRef();

    useEffect(() => {
        valuesRef.current = watch();
        const subscription = watch((values) => {
            if (!deeplyEqual(valuesRef.current, values)) {
                queryClient.setQueryData(["actionJobsFilterCases"], []);
                queryClient.invalidateQueries({ queryKey: ["actionJobsFilterCases"] });
                queryClient.removeQueries({ queryKey: ["actionJobsFilterCases"] });
                valuesRef.current = values;
            }
        });
        return () => subscription.unsubscribe();
    }, []);

    const { handleChangeExecutionData, handleExecutionActions, handleClearCasesFilter, isPendingCases } =
        useMassiveExecutionCasesForm();
    const { handleClearClientsFilter } = useMassiveExecutionClientsForm();

    const { onSubmit } = useHookFilter({
        nameHelper: [],
        nameTable,
        setValue,
        reset,
        fieldsCustomerFilters,
    });

    useEffect(() => {
        if (searchFilter?.length) {
            handleChangeExecutionData("search_filter", {
                filter: searchFilter.filter(Boolean),
                limit: 0,
                offset: 0,
            });
        }
    }, [searchFilter]);

    useEffect(() => {
        handleClearCasesFilter();
        handleClearClientsFilter();
    }, []);

    const handleActionTypeChange = useCallback(
        (type) => {
            setValue("action_type", type);
        },
        [setValue],
    );

    const handleActionChange = useCallback(
        (id) => {
            setValue("action_id", id, { shouldValidate: true, shouldDirty: true });
        },
        [setValue],
    );

    const handleRestFlowChange = useCallback(
        (id) => {
            setValue("restflow_id", id, { shouldValidate: true, shouldDirty: true });
        },
        [setValue],
    );

    const handleContextChange = useCallback(
        (context) => {
            setValue("restflow_context", context, { shouldValidate: true, shouldDirty: true });
        },
        [setValue],
    );

    return (
        <div>
            {isPendingCases ? (
                <GeneralLoader />
            ) : (
                <>
                    <form onSubmit={handleSubmit((formData) => onSubmit(formData, false))} autoComplete="off">
                        <div className="flex flex-col gap-8 xl:px-10">
                            <div
                                className="grid grid-flow-row-dense grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 py-4"
                                id="massivefilter_grid"
                                data-testid="massivefilter_grid"
                            >
                                {columnsToFilter.map(({ column_name, header, data_type, options }) => (
                                    <div
                                        className="flex flex-col gap-4"
                                        key={column_name}
                                        id={`massivefilter_${column_name}_container`}
                                        data-testid={`massivefilter_${column_name}_container`}
                                    >
                                        <Label
                                            htmlFor={column_name}
                                            className="text-left ml-2 mt-2"
                                            id={`massivefilter_${column_name}_label`}
                                            data-testid={`massivefilter_${column_name}_label`}
                                        >
                                            {header}
                                        </Label>
                                        {InputValueDepend(data_type, column_name, options, control)}
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="flex justify-center">
                            <Button
                                className="min-w-96"
                                type="submit"
                                id="massivefilter_search"
                                data-testid="massivefilter_search"
                            >
                                {t("button.search")}
                            </Button>
                        </div>
                    </form>
                    {!!dataTable.length && (
                        <div>
                            <hr className="my-4" />
                            <h2 className="text-lg font-semibold leading-none tracking-tight">
                                {t("massiveExecution.executionType")}
                            </h2>
                            <form onSubmit={handleSubmit(handleExecutionActions)} autoComplete="off">
                                <MassiveExecutionSelectType
                                    handler={handleActionTypeChange}
                                    tab="cases"
                                    onContextChange={handleContextChange}
                                    onRestFlowChange={handleRestFlowChange}
                                    onActionChange={handleActionChange}
                                />
                                <div className="flex w-full gap-x-2">
                                    <Button
                                        type="button"
                                        variant="destructive"
                                        onClick={() => {
                                            handleClearCasesFilter();
                                            control._reset({});
                                        }}
                                        id="massivefilter_clear_filter"
                                        data-testid="massivefilter_clear_filter"
                                    >
                                        {t("button.cancel")}
                                    </Button>
                                    <Button type="submit" id="massivefilter_submit" data-testid="massivefilter_submit">
                                        {t("button.executeActions")}
                                    </Button>
                                </div>
                            </form>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default MassiveExecutionCasesFilterForm;
