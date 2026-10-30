import { Button } from "../ui/button";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { MixerHorizontalIcon } from "../../icons";
import { useTranslation } from "react-i18next";

export function DataTableViewOptions({ table }) {
    const { t } = useTranslation();
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    id="view_column_options"
                    data-testid="view_column_options"
                    className="flex items-center gap-2 shrink-0"
                    aria-label={t("text.columns")}
                    title={t("text.columns")}
                >
                    <MixerHorizontalIcon width={20} height={20} aria-hidden="true" />
                    <span className="hidden sm:inline">{t("text.columns")}</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[150px] max-h-[300px] overflow-y-auto">
                <DropdownMenuLabel>{t("text.alternate_columns")}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {table
                    .getAllColumns()
                    .filter(
                        (column) =>
                            typeof column.accessorFn !== "undefined" &&
                            column.getCanHide() &&
                            column.columnDef.isVisible,
                    )
                    .map((column) => {
                        return (
                            <DropdownMenuCheckboxItem
                                key={column.id}
                                className="capitalize"
                                checked={column.getIsVisible()}
                                onCheckedChange={(value) => column.toggleVisibility(!!value)}
                                id={`select_column_item_${column.id}`}
                                data-testid={`select_column_item_${column.id}`}
                            >
                                {typeof column.columnDef.header === "string" ? column.columnDef.header : column.id}
                            </DropdownMenuCheckboxItem>
                        );
                    })}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
