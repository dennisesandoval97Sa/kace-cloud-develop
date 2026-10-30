import React, { memo } from "react";
import PropTypes from "prop-types";
import {
    Button,
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui-shared";
import { useTranslation } from "react-i18next";
import { SlidersHorizontal } from "lucide-react";

const DataTableColumnSelector = ({ columns = [], onToggleVisibility }) => {
    const { t } = useTranslation();
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" data-testid="btn_table_columns" id="btn_table_columns">
                    <SlidersHorizontal className="mr-2 h-4 w-4" />
                    <span className="truncate">{t("dataTable.buttons.columns")}</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[150px] max-h-[300px] overflow-y-auto">
                <DropdownMenuLabel>{t("dataTable.toggleColumns")}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {columns.map((column) => (
                    <DropdownMenuCheckboxItem
                        key={column.id}
                        className="capitalize"
                        checked={column.isVisible}
                        onCheckedChange={() => onToggleVisibility(column.id)}
                        id={`table_column_${column.id}`}
                        data-testid={`table_column_${column.id}`}
                    >
                        {column.displayName}
                    </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
};

DataTableColumnSelector.propTypes = {
    columns: PropTypes.arrayOf(
        PropTypes.shape({
            id: PropTypes.string.isRequired,
            displayName: PropTypes.string.isRequired,
            isVisible: PropTypes.bool.isRequired,
        }),
    ).isRequired,
    onToggleVisibility: PropTypes.func.isRequired,
};

export default memo(DataTableColumnSelector);
