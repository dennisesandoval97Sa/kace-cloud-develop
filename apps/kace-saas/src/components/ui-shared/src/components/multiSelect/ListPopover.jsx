import { ScrollArea } from "../ui/scroll-area";
import { CheckListIcon } from "../../icons";
import { Button } from "../ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import PropTypes from "prop-types";

export function ListPopover({ listValues = [], setListValues, nameTesting }) {
    const { t } = useTranslation();
    const canRemove = typeof setListValues === "function";

    const handleRemove = (itemId) => {
        setListValues((prev) => prev.filter((i) => i.id !== itemId));
    };

    const handleClearAll = () => {
        setListValues([]);
    };

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    disabled={listValues.length === 0}
                    type="button"
                    className="absolute z-50 -right-5 -top-5 rounded-full h-9 w-9 p-0"
                    data-testid={`btnShowList${nameTesting}`}
                >
                    <CheckListIcon />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 overflow-hidden" align="end">
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-200">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-800">{t("app.text.selected")}</span>
                        <span className="inline-flex items-center justify-center bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full min-w-[1.5rem]">
                            {listValues.length}
                        </span>
                    </div>
                    {canRemove && (
                        <button
                            type="button"
                            onClick={handleClearAll}
                            className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                            data-testid={`btnClearAll${nameTesting}`}
                        >
                            {t("button.clear")}
                        </button>
                    )}
                </div>
                <ScrollArea className="h-56 w-full">
                    <div className="flex flex-col gap-1.5 pr-1">
                        {listValues.map((item) => (
                            <div
                                key={item.id}
                                className="flex items-center justify-between gap-2 rounded-md bg-blue-50 border border-blue-100 px-3 py-1.5 text-sm"
                            >
                                <span className="text-blue-900 font-medium min-w-0 break-words flex-1">
                                    {item.label}
                                </span>
                                {canRemove && (
                                    <button
                                        type="button"
                                        onClick={() => handleRemove(item.id)}
                                        className="shrink-0 text-blue-300 hover:text-red-500 transition-colors rounded p-0.5 hover:bg-red-50"
                                        aria-label={`${t("button.delete")} ${item.label}`}
                                        data-testid={`btnRemoveItem${nameTesting}_${item.id}`}
                                    >
                                        <X size={14} />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </ScrollArea>
            </PopoverContent>
        </Popover>
    );
}

ListPopover.propTypes = {
    listValues: PropTypes.array.isRequired,
    setListValues: PropTypes.func,
    nameTesting: PropTypes.string.isRequired,
};
