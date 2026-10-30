import { useMemo, useRef, useCallback, useEffect } from "react";
import PropTypes from "prop-types";
import SelectOptions from "./components/SelectOptions";
import { X } from "lucide-react";
import { cn } from "@/componentsV2/lib/utils";
import { GeneralLoader } from "../GeneralLoader";
import { Label } from "../Label";
import {
    Select as SelectBase,
    SelectContent,
    SelectGroup,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from "../SelectBase";

const normalizedLabel = (label) => {
    return label.replace(/\s+/g, "_").toLowerCase();
};

const Select = ({
    label = "",
    errorData = {},
    wasTouched = false,
    onChangeHandler = () => {},
    handlerClear = () => {},
    value = "",
    isLoading = false,
    options = [],
    t,
    onMenuScrollToBottom = () => {},
    isFetchingNextPage = false,
    translateOptions = true,
}) => {
    const hasError = useMemo(() => Object.keys(errorData).length > 0 && wasTouched, [errorData, wasTouched]);
    const contentRef = useRef(null);
    const onMenuScrollToBottomRef = useRef(onMenuScrollToBottom);

    useEffect(() => {
        onMenuScrollToBottomRef.current = onMenuScrollToBottom;
    }, [onMenuScrollToBottom]);

    const handleScroll = useCallback(() => {
        const viewport = contentRef.current?.querySelector("[data-radix-select-viewport]");
        if (viewport) {
            const isAtBottom = Math.ceil(viewport.scrollTop + viewport.clientHeight) >= viewport.scrollHeight;

            if (isAtBottom) {
                onMenuScrollToBottomRef.current();
            }
        }
    }, []);

    return (
        <div className="flex flex-col gap-2">
            <div className="flex justify-between">
                <Label className={cn("", { "border-redCustom text-redCustom": hasError })}>{t(label)}</Label>
                {hasError && <Label className="text-redCustom">{errorData}</Label>}
            </div>
            <div className="flex items-center gap-2">
                <SelectBase onValueChange={onChangeHandler} value={value}>
                    <SelectTrigger
                        className={cn("w-full", { "border-redCustom text-redCustom": hasError })}
                        id={`open_select_${normalizedLabel(label)}`}
                        data-testid={`open_select_${normalizedLabel(label)}`}
                    >
                        <SelectValue
                            placeholder={isLoading ? t("Cargando...") : t("app.forms.options")}
                            id={`select_value_${value}`}
                            data-testid={`select_value_${value}`}
                        />
                    </SelectTrigger>
                    <SelectContent ref={contentRef} onScroll={handleScroll}>
                        <SelectGroup
                            defaultValue={value}
                            id={`select_group_${value}`}
                            data-testid={`select_group_${value}`}
                        >
                            <SelectLabel>{t("actions.form.options")}</SelectLabel>
                            {isLoading && (
                                <div className="flex justify-center items-center p-4 h-36 w-full">
                                    <GeneralLoader />
                                </div>
                            )}

                            <SelectOptions options={options} t={t} translateOptions={translateOptions} />

                            {isFetchingNextPage && (
                                <div className="flex justify-center p-2">
                                    <GeneralLoader />
                                </div>
                            )}
                        </SelectGroup>
                    </SelectContent>
                </SelectBase>
                {value && (
                    <X
                        className="h-4 w-4 opacity-60 hover:opacity-100 cursor-pointer"
                        onClick={handlerClear}
                        id={`clear_select_${normalizedLabel(label)}`}
                        data-testid={`clear_select_${normalizedLabel(label)}`}
                    />
                )}
            </div>
        </div>
    );
};

Select.propTypes = {
    t: PropTypes.func.isRequired,
    label: PropTypes.string,
    errorData: PropTypes.object,
    wasTouched: PropTypes.bool,
    onChangeHandler: PropTypes.func,
    handlerClear: PropTypes.func,
    value: PropTypes.string,
    isLoading: PropTypes.bool,
    options: PropTypes.array,
    onMenuScrollToBottom: PropTypes.func,
    isFetchingNextPage: PropTypes.bool,
    translateOptions: PropTypes.bool,
};

export default Select;
