import { useCallback } from "react";
import { ACTION_GROUPS } from "../constants";
import CellActions from "@/componentsV2/core/TableCellContent/components/CellActions";
import CellDate from "@/componentsV2/core/TableCellContent/components/CellDate";
import CellDefault from "@/componentsV2/core/TableCellContent/components/CellDefault";
import DueDateCell from "@/componentsV2/core/TableCellContent/components/DueDateCell";
import { useTranslation } from "react-i18next";
import { ChevronRight, ChevronDown } from "lucide-react";
import { formatTableDateTime } from "@/utils/main";
import { getComponentKey } from "@/componentsV2/core/TableCellContent/utils/getComponentKey";

const withEmptyCellFallback = (column) => {
    if (column.cell || !column.accessorKey) {
        return column;
    }

    const CellComponent = getComponentKey(column.accessorKey) === "date" ? CellDate : CellDefault;

    return {
        ...column,
        cell: ({ row }) => <CellComponent row={row} accessorKey={column.accessorKey} />,
    };
};

const useIncludeCasesColumns = (isSubCasesEnabled = false, ansDisplayMode = "row") => {
    const { t } = useTranslation();
    const includeCasesColumns = useCallback(
        ({ availableColumns, actions = [] }) => {
            if (!availableColumns) return [];

            const parsedColumns = availableColumns
                .filter(
                    (column) =>
                        column.id !== "actions" &&
                        column.accessorKey !== "reference" &&
                        column.accessorKey !== "subcasos",
                )
                .map((column) => {
                    if (column.accessorKey === "fecha_vencimiento" && ansDisplayMode === "circle") {
                        return {
                            ...column,
                            cell: ({ row }) => (
                                <DueDateCell
                                    value={formatTableDateTime(row.original?.fecha_vencimiento)}
                                    ansColor={row.original?.ansColor}
                                />
                            ),
                        };
                    }
                    return withEmptyCellFallback(column);
                });

            const columns = [
                {
                    id: "actions",
                    header: null,
                    cell: ({ row }) => {
                        const resolutionDate = row.original?.fecha_resolucion;
                        const groupToUse = resolutionDate ? ACTION_GROUPS.RESOLVED : ACTION_GROUPS.UNRESOLVED;
                        const arrayActions = actions.filter((action) => groupToUse.includes(action.name));
                        return <CellActions row={row} arrayActions={arrayActions} />;
                    },
                    meta: { className: "text-right" },
                },
                withEmptyCellFallback({
                    id: "reference",
                    accessorKey: "reference",
                    header: t("gridMain.columns.Consecutivo"),
                    value: "Number",
                }),
            ];

            const subcasesColumn = isSubCasesEnabled
                ? {
                      id: "subcasos",
                      accessorKey: "subcasos",
                      header:
                          t("gridMain.columns.subcases") !== "gridMain.columns.subcases"
                              ? t("gridMain.columns.subcases")
                              : "Subcasos",
                      enableHiding: true,
                      isVisible: true,
                      cell: ({ row }) => {
                          const useSubcasesOnly = typeof row.original?.onToggleSubcases === "function";
                          const isExpanded = useSubcasesOnly
                              ? Boolean(row.original?.isSubcasesExpanded)
                              : row.getIsExpanded();
                          const isLoading = row.original?.loadingSubcases || false;
                          const onLoadSubcases = row.original?.onLoadSubcases;

                          const handleClick = (e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (useSubcasesOnly) {
                                  if (onLoadSubcases && !isExpanded) {
                                      onLoadSubcases();
                                  }
                                  row.original?.onToggleSubcases?.();
                              } else {
                                  if (onLoadSubcases && !isExpanded) {
                                      onLoadSubcases();
                                  }
                                  row.toggleExpanded();
                              }
                          };

                          return (
                              <button
                                  type="button"
                                  onClick={handleClick}
                                  disabled={isLoading}
                                  className="flex items-center gap-2 px-3 py-1 rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-60 transition-colors"
                              >
                                  {isExpanded ? (
                                      <ChevronDown className="w-4 h-4" />
                                  ) : (
                                      <ChevronRight className="w-4 h-4" />
                                  )}
                              </button>
                          );
                      },
                      meta: { isSubcasosColumn: true },
                  }
                : null;

            const finalColumns = subcasesColumn
                ? [...columns, ...parsedColumns, subcasesColumn]
                : [...columns, ...parsedColumns];
            return finalColumns;
        },
        [isSubCasesEnabled, ansDisplayMode, t],
    );

    return { includeCasesColumns };
};

export default useIncludeCasesColumns;
