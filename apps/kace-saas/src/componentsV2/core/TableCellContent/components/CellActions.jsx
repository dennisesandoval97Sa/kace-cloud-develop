import PropTypes from "prop-types";
import { useQueryClient } from "@tanstack/react-query";
import {
    AlertModalShared,
    Button,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui-shared";
import { MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { formatTestId, isDeleteAction } from "@/utils/src/helpers";

const CellActions = ({ row, arrayActions }) => {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const queryClient = useQueryClient();

    return (
        <DropdownMenu
            open={open}
            onOpenChange={(open) => {
                setOpen(open);
                queryClient.setQueryData(["selectedCaseData"], {
                    data: row.original,
                    isModalOpen: open,
                });
            }}
        >
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    className="h-8 w-8 p-0 bold"
                    id={`btn_cell_actions_${row.original.id}`}
                    data-testid={`btn_cell_actions_${row.original.id}`}
                >
                    <MoreHorizontal className="h-6 w-6" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
                <DropdownMenuLabel>{t("gridMain.actions.actions")}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {arrayActions
                    .filter((item) => {
                        if (typeof item.show === "function") {
                            try {
                                return item.show(row);
                            } catch (e) {
                                return false;
                            }
                        }
                        if (typeof item.show === "boolean") return item.show;
                        return true;
                    })
                    .map((item) => (
                        <DropdownMenuItem
                            key={item.name}
                            className={`${isDeleteAction(item.name, t) && "text-redCustom"}`}
                            onSelect={(event) => {
                                if (isDeleteAction(item.name, t)) {
                                    event.preventDefault();
                                } else {
                                    item.action(row.original.id, row.original.reference, row.original);
                                }
                            }}
                            id={formatTestId(`action_${row.original.id}`, item.name)}
                            data-testid={formatTestId(`action_${row.original.id}`, item.name)}
                        >
                            {isDeleteAction(item.name, t) ? (
                                <AlertModalShared
                                    nameAcceptAction={t("app.forms.delete")}
                                    nameCancelAction={t("app.forms.cancel")}
                                    handleAcceptAction={() =>
                                        item.action(row.original.id, row.original.reference, row.original)
                                    }
                                    handleCancelAction={() => setOpen(false)}
                                    id={row.original.id}
                                    buttonAction={<div className="w-full h-full">{item.name}</div>}
                                />
                            ) : (
                                item.name
                            )}
                        </DropdownMenuItem>
                    ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
};

CellActions.propTypes = {
    row: PropTypes.object.isRequired,
    arrayActions: PropTypes.array.isRequired,
};

export default CellActions;
