import PropTypes from "prop-types";
import { getComponentKey } from "./utils/getComponentKey";
import { CELL_COMPONENT_MAP } from "./constants";
import CellDefault from "./components/CellDefault";
import {
    isNivelColumn,
    isSeparatorClassificationColumn,
    shouldExpandClassificationLevels,
} from "@/pages/Cases/components/CaseDataTable/utils/classificationLevels.util";

const resolveComponentKey = (accessorKey, cellType, expandLevels, separator, row) => {
    const column = {
        column_name: accessorKey,
        cell_type: cellType,
        expand_levels: expandLevels,
        separator,
    };

    if (shouldExpandClassificationLevels(column)) {
        const value = row?.original?.[accessorKey];

        if (isSeparatorClassificationColumn(column) && typeof value !== "string") {
            return "default";
        }

        return "nivel1";
    }

    if (cellType === "clasificacion" && isNivelColumn(accessorKey)) {
        return "clasificacion";
    }

    return cellType ?? getComponentKey(accessorKey);
};

const TableCellContent = ({ row, accessorKey = "", actions = [], cellType, separator, expandLevels }) => {
    const componentKey = resolveComponentKey(accessorKey, cellType, expandLevels, separator, row);
    const ComponentToRender = CELL_COMPONENT_MAP[componentKey];

    if (!ComponentToRender) {
        return <CellDefault row={row} accessorKey={accessorKey} />;
    }

    return <ComponentToRender row={row} accessorKey={accessorKey} arrayActions={actions} separator={separator} />;
};

TableCellContent.propTypes = {
    row: PropTypes.object.isRequired,
    accessorKey: PropTypes.string,
    actions: PropTypes.arrayOf(
        PropTypes.shape({
            name: PropTypes.string.isRequired,
            action: PropTypes.func.isRequired,
            customizable: PropTypes.bool.isRequired,
        }),
    ),
    cellType: PropTypes.string,
    separator: PropTypes.string,
    expandLevels: PropTypes.bool,
};

export default TableCellContent;
