import {
    Button,
    cn,
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui-shared";
import PropTypes from "prop-types";
import React, { useState } from "react";
import { CheckIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

const MassiveExecutionSelect = ({
    value = "",
    options = [],
    onChange = () => {},
    className = "",
    popOverClassName = "",
}) => {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);

    return (
        <Popover className={cn("w-64", className)} open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start bg-transparent">
                    <span className="truncate">
                        {value
                            ? options.find((f) => f.id === value)?.label
                            : t("massiveExecution.auxClient.selectOption")}
                    </span>
                </Button>
            </PopoverTrigger>
            <PopoverContent className={cn("w-80 p-0", popOverClassName)}>
                <Command>
                    <CommandInput placeholder={t("massiveExecution.auxClient.searchPlaceholder")} />
                    <CommandList>
                        <CommandEmpty>{t("massiveExecution.auxClient.noResults")}</CommandEmpty>
                        <CommandGroup>
                            {options.map((field) => (
                                <CommandItem
                                    key={field.id}
                                    onSelect={() => {
                                        onChange(field.id);
                                        setOpen(false);
                                    }}
                                >
                                    <CheckIcon
                                        className={cn("mr-2 h-4 w-4", value === field.id ? "opacity-100" : "opacity-0")}
                                    />
                                    {field.label}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
};

MassiveExecutionSelect.propTypes = {
    value: PropTypes.any,
    options: PropTypes.array,
    onChange: PropTypes.func,
};

export default MassiveExecutionSelect;
