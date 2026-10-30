import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import {
    Button,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui-shared";
import { ChevronDown } from "lucide-react";

const DataTableBulkActions = ({ bulkActions }) => {
    const { t } = useTranslation();
    if (!bulkActions || bulkActions.selectedCount <= 0) {
        return null;
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    id="btn_table_bulk_actions"
                    variant="outline"
                    size="sm"
                    className="gap-2 border-border bg-muted text-foreground hover:bg-accent hover:text-accent-foreground"
                >
                    <span className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
                    {t("navbar.actions")} ({bulkActions.selectedCount})
                    <ChevronDown className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
                {bulkActions.actions.map((action, index) => (
                    <DropdownMenuItem
                        key={`${action.label}-${index}`}
                        onSelect={action.onClick}
                        id={`bulk_action_${index}`}
                        data-testid={`bulk_action_${index}`}
                    >
                        {action.label}
                    </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                    className="text-destructive"
                    onSelect={bulkActions.onClearSelection}
                    id="bulk_action_clear_selection"
                    data-testid="bulk_action_clear_selection"
                >
                    {t("button.clearSelection")}
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
};

DataTableBulkActions.propTypes = {
    bulkActions: PropTypes.shape({
        selectedCount: PropTypes.number.isRequired,
        onClearSelection: PropTypes.func.isRequired,
        actions: PropTypes.arrayOf(
            PropTypes.shape({
                label: PropTypes.string.isRequired,
                onClick: PropTypes.func.isRequired,
            }),
        ).isRequired,
    }),
};

export default DataTableBulkActions;
