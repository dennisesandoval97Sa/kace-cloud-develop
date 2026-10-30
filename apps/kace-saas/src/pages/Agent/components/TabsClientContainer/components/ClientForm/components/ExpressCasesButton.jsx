import React, { useState } from "react";
import PropTypes from "prop-types";
import { ChevronDown, Zap } from "lucide-react";
import {
    Button,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuPortal,
    DropdownMenuTrigger,
} from "@/components/ui-shared";
import { useNavigate } from "react-router-dom";
import {useTranslation} from "react-i18next";

const ExpressCasesButton = ({ options = [] }) => {
    const { t } = useTranslation()
    const navigate = useNavigate();

    const [open, setOpen] = useState(false);

    return (
        <DropdownMenu open={open} onOpenChange={setOpen}>
            <DropdownMenuTrigger asChild>
                <Button className="group relative inline-flex items-center gap-2 rounded-lg bg-secondary px-5 py-3 font-medium text-primary-foreground shadow-sm transition-all hover:bg-secondary/90 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2">
                    <Zap className="size-5 fill-current transition-transform group-hover:scale-110" />
                    <span>{t("app.button.expressCase")}</span>
                    <div className="ml-1 flex items-center gap-1">
                        <ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} />
                    </div>
                </Button>
            </DropdownMenuTrigger>

            <DropdownMenuPortal>
                <DropdownMenuContent
                    className="min-w-[220px] animate-in fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-2 rounded-lg border border-border bg-popover p-1 shadow-lg"
                    sideOffset={5}
                >
                    {options.map((option) => {
                        return (
                            <DropdownMenuItem
                                key={option.id}
                                className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-sm text-popover-foreground outline-none transition-colors hover:bg-accent hover:text-accent-foreground data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
                                onSelect={() => navigate(`/agent/express-case?form_id=${option.value}&action=create`)}
                            >
                                <span>{option.label}</span>
                            </DropdownMenuItem>
                        );
                    })}
                </DropdownMenuContent>
            </DropdownMenuPortal>
        </DropdownMenu>
    );
};

ExpressCasesButton.propTypes = {
    options: PropTypes.arrayOf(PropTypes.shape({
        id: PropTypes.string.isRequired,
        label: PropTypes.string.isRequired,
        value: PropTypes.string.isRequired,
    })),
};

export default ExpressCasesButton;
