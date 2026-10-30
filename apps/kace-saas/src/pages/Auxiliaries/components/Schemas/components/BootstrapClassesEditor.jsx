import React, { useState, useMemo, useEffect } from "react";
import { X } from "lucide-react";
import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui-shared";
import { useFormikContext } from "formik";
import PropTypes from "prop-types";
import BootstrapValidator from "../utils/bootstrapValidator";
import { useTranslation } from "react-i18next";

const BootstrapClassesEditor = ({ control, data, onUiModified }) => {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const [selectedClasses, setSelectedClasses] = useState(data ?? []);
    const { setFieldValue } = useFormikContext();

    const validator = useMemo(() => new BootstrapValidator(), []);
    const bootstrapClassGroups = useMemo(() => validator.getAllClasses({ grouped: true }), [validator]);

    const handleSelect = (className) => {
        setSelectedClasses((prev) => {
            if (prev.includes(className)) {
                return prev.filter((c) => c !== className);
            }
            return [...prev, className];
        });
        onUiModified?.();
    };

    useEffect(() => {
        setFieldValue(control, selectedClasses?.join(" ") ?? "");
    }, [selectedClasses]);

    const handleRemoveClass = (className) => {
        setSelectedClasses((prev) => prev.filter((c) => c !== className));
        onUiModified?.();
    };

    return (
        <div className="w-full max-w-2xl mx-auto">
            <div>
                <label className="text-sm font-medium text-slate-700">{t("auxSchema.form.classes")}</label>
                <button
                    onClick={() => setOpen(true)}
                    className="flex flex-wrap items-center gap-2 p-2 min-h-[40px] w-full rounded-md border border-slate-300 bg-white text-sm cursor-text transition-colors focus-within:ring-2 focus-within:ring-blue-500"
                >
                    {selectedClasses.length > 0 ? (
                        selectedClasses.map((className) =>
                            !className?.trim()?.length ? null : (
                                <span
                                    key={className}
                                    className="flex items-center gap-1 bg-blue-100 text-blue-800 text-xs font-semibold px-2 py-1 rounded-full"
                                >
                                    {className}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleRemoveClass(className);
                                        }}
                                        className="rounded-full hover:bg-blue-200 p-0.5"
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                </span>
                            ),
                        )
                    ) : (
                        <span className="text-slate-500 px-1">{t("auxSchema.form.selectClasses")}</span>
                    )}
                </button>
            </div>

            <CommandDialog open={open} onOpenChange={setOpen}>
                <CommandInput placeholder={t("auxSchema.form.searchBootstrapClass")} />
                <CommandList>
                    <CommandEmpty>{t("auxSchema.form.noResultsFound")}</CommandEmpty>
                    {bootstrapClassGroups.map((group) => (
                        <CommandGroup key={group.name} heading={group.name}>
                            {group.classes.map((className) => (
                                <CommandItem
                                    key={className}
                                    value={className}
                                    onSelect={() => handleSelect(className)}
                                    className="flex items-center justify-between"
                                >
                                    {className}
                                    {selectedClasses.includes(className) && (
                                        <div className="h-2 w-2 bg-blue-500 rounded-full" />
                                    )}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    ))}
                </CommandList>
            </CommandDialog>
        </div>
    );
};

BootstrapClassesEditor.propTypes = {
    control: PropTypes.string.isRequired,
    data: PropTypes.arrayOf(PropTypes.string),
    onUiModified: PropTypes.func,
};

export default BootstrapClassesEditor;
