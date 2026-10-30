import TableCellContent from "@/componentsV2/core/TableCellContent";
import { useCallback } from "react";

const CUSTOM_CELL_RENDERER_KEYS = new Set([
    "actions",
    "icon_class",
    "color",
    "color_ans_inicial",
    "color_ans_intermedio",
    "color_ans_final",
    "descripcion",
    "nivel1",
    "error_details",
    "status",
    "is_active",
    "can_start_sub_cases_flow",
    "groups",
    "access_users",
    "access_groups",
]);

const CUSTOM_ACCESSOR_FUNCTIONS = {
    "group.nombre": ({ row }) => row.original?.group?.nombre,
    "one_script.nombre": ({ row }) => row.original?.one_script?.nombre,
};

const useTableColumnsByType = () => {
    const getColumnByType = useCallback((headerData = {}, actions = []) => {
        const {
            accessorKey,
            header,
            isVisible = true,
            value,
            meta,
            enableSorting,
            cellType,
            separator,
            expandLevels,
        } = headerData;

        if (!accessorKey) {
            return {};
        }

        const baseColumn =
            accessorKey === "actions"
                ? {
                      id: "actions",
                      header: null,
                      enableHiding: false,
                      meta: { className: "text-right" },
                  }
                : {
                      accessorKey,
                      accessorType: value,
                      header,
                      isVisible,
                      ...(meta && { meta }),
                      ...(enableSorting === false && { enableSorting: false }),
                      ...(cellType && { cellType }),
                      ...(expandLevels !== undefined && { expandLevels }),
                      ...(separator && { separator }),
                  };

        if (meta?.renderAsPlainText) {
            baseColumn.cell = ({ row }) => row.original?.[accessorKey] ?? "";
        } else if (
            cellType === "default" ||
            (cellType
                ? ["clasificacion", "estado"].includes(cellType)
                : CUSTOM_CELL_RENDERER_KEYS.has(accessorKey) || accessorKey.includes("_id"))
        ) {
            baseColumn.cell = ({ row }) => {
                return (
                    <TableCellContent
                        accessorKey={accessorKey}
                        row={row}
                        actions={actions}
                        cellType={cellType}
                        separator={separator}
                        expandLevels={expandLevels}
                    />
                );
            };
        }

        const customAccessorFn = CUSTOM_ACCESSOR_FUNCTIONS[accessorKey];
        if (customAccessorFn) {
            baseColumn.cell = customAccessorFn;
        }

        return baseColumn;
    }, []);

    return {
        getColumnByType,
    };
};

export default useTableColumnsByType;
