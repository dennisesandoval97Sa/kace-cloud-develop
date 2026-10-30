import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import useTableColumnsByType from "./useTableColumnsByType";
import { genericFilters } from "@/utils/genericFilters";
import { getCasesHeaderNamespace, resolveGridColumnHeader } from "@/services/createSchemaFilter";

export const useDataTableColumns = ({
    rawSchema,
    dataTableConfig,
    actions = [],
    processColumns = null,
    includeColumns = null,
    processSchema = null,
    headersTransform = null,
}) => {
    const { t } = useTranslation();
    const { getColumnByType } = useTableColumnsByType();
    /*
     * Cases (the main /cases grid, embedded tables like AdminCaseSubCases, and saved custom Cases
     * views) is the only table that shows the longer, Cases-specific i18n copy
     * (gridMain.columnsCases.*). Every other table (Roles, Groups, Users, ...) keeps resolving
     * through the shared gridMain.columns.* keys. See getCasesHeaderNamespace for why both .entity
     * and .key are checked.
     */
    const casesHeaderNamespace = getCasesHeaderNamespace(dataTableConfig);

    const { processedColumns, processedFilterColumns } = useMemo(() => {
        if (!rawSchema?.length || !dataTableConfig) {
            return { processedColumns: [], processedFilterColumns: [] };
        }

        const isCustomView = dataTableConfig.useDefaultFilters === false;
        const schemaFromProcess = processSchema ? processSchema(rawSchema) : null;
        let visibleSchema = schemaFromProcess || rawSchema;
        if (!schemaFromProcess && !isCustomView) {
            visibleSchema = dataTableConfig.genericColumns
                .map((name) => rawSchema.find((column) => column.column_name === name))
                .filter(Boolean);
        }

        const defaultFilters = genericFilters(dataTableConfig.view);
        const processedFilters = processColumns ? processColumns(defaultFilters, visibleSchema) : defaultFilters;
        const applyTransforms = (schema) =>
            schema.map((row) => {
                const transform = processedFilters[row.column_name];
                return transform ? transform(row) : row;
            });

        const explicitFilterSchema = dataTableConfig.filterColumns
            ?.map((name) => rawSchema.find((column) => column.column_name === name))
            .filter(Boolean);

        return {
            processedColumns: applyTransforms(visibleSchema),
            processedFilterColumns: explicitFilterSchema
                ? applyTransforms(explicitFilterSchema)
                : applyTransforms(visibleSchema),
        };
    }, [rawSchema, dataTableConfig, processSchema, processColumns]);

    const columns = useMemo(() => {
        if (processedColumns.length === 0) return [];

        const fullColumns = [...processedColumns];
        if (actions.length > 0) {
            fullColumns.unshift({
                column_name: "actions",
                enableHiding: false,
            });
        }

        const availableColumns = fullColumns.map((column) => {
            const columnDef = headersTransform ? headersTransform(column) : column;
            const finalColumns = getColumnByType(
                {
                    accessorKey: columnDef.column_name,
                    header: columnDef.header_label || resolveGridColumnHeader(columnDef, t, casesHeaderNamespace),
                    value: columnDef.data_type,
                    meta: columnDef.meta,
                    enableSorting: columnDef.enableSorting,
                    cellType: columnDef.cell_type,
                    separator: columnDef.separator,
                    expandLevels: columnDef.expand_levels,
                },
                actions,
            );

            return finalColumns;
        });

        return includeColumns ? includeColumns({ availableColumns, actions }) : availableColumns;
    }, [
        t,
        actions,
        includeColumns,
        headersTransform,
        processedColumns,
        getColumnByType,
        dataTableConfig,
        casesHeaderNamespace,
    ]);

    return { columns, processedColumns, processedFilterColumns };
};
