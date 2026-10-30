import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import DataTable from "@/componentsV2/core/DataTable";
import useDataTable from "@/hooks/useDataTable";
import { dataTableConfig } from "../data/constants";
import { processColumns, processData, processFilters } from "../utils/datatableProcess";
import useConfigAgentData from "@/hooks/useConfigAgentData";
import { useMemo } from "react";

export const ClassificationTableContainer = ({
    arrayAction = [],
    handleAssingForm,
    handleUpdateClassificationFlow,
}) => {
    const { t } = useTranslation();
    const { cases: configCases } = useConfigAgentData();

    const tableFilters = useMemo(() => {
        if (configCases && !configCases.case_enable_subcases) {
            return [
                {
                    field: "can_start_sub_cases_flow",
                    operator: "eq",
                    type: "AND",
                    value: "true",
                },
            ]
        };
        return [];
    }, [configCases]);

    const flowsAction = useMemo(() => {
        if (configCases?.case_enable_subcases) {
            return [
                {
                    name: `${t("app.forms.flowForm")}`,
                    action: handleUpdateClassificationFlow,
                    show: (row) => row?.original?.can_start_sub_cases_flow === t("gridMain.text.isPrimary"),
                    customizable: false,
                }
            ];
        }
        return [];
    }, [configCases]);

    const { renderData, query, filters, pagination, columnSelector } = useDataTable({
        dataTableConfig: dataTableConfig(configCases?.case_enable_subcases),
        actions: [
            ...arrayAction,
            {
                name: `${t("app.forms.views")}`,
                action: handleAssingForm,
                customizable: false,
            },
            ...flowsAction
        ],
        processFilters: processFilters(configCases?.case_enable_subcases),
        processColumns,
        processData,
        tableFilters,
    });

    return (
        <DataTable
            renderData={renderData}
            query={query}
            filters={filters}
            pagination={pagination}
            columnSelector={columnSelector}
        />
    );
};

ClassificationTableContainer.propTypes = {
    arrayAction: PropTypes.array,
    handleAssingForm: PropTypes.func,
    handleUpdateClassificationFlow: PropTypes.func,
};
