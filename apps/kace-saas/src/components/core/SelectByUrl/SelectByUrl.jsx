import {
    cn,
    GeneralLoader,
    Label,
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from "@kace/ui-shared";
import { useQuery } from "@tanstack/react-query";
import PropTypes from "prop-types";
import { useEffect, useState } from "react";
import { genericSearch } from "../../../services/genericSearch";
import { genericView } from "../../../services/genericView";
import { useTranslation } from "react-i18next";
import { fromObjectToArray, getNestedValue } from "./utils/objectUtils";
import { X } from "lucide-react";
import { formatTestId } from "@/utils/src/helpers";

const renderSelectContent = ({ isLoading, options, t, isTranslated }) => {
    if (isLoading) {
        return (
            <div
                className="flex justify-center items-center p-4 h-36 w-full"
                id="selectbyurl_loading"
                data-testid="selectbyurl_loading"
            >
                <GeneralLoader />
            </div>
        );
    }

    if (!options || options?.length === 0) {
        return (
            <div
                className="flex justify-center items-center p-4"
                id="selectbyurl_empty"
                data-testid="selectbyurl_empty"
            >
                <p>{t("generalSetup.form.labels.without_options")}</p>
            </div>
        );
    }

    return options?.map((option, index) => (
        <SelectItem
            value={option.value}
            key={`${option.value}${index}`}
            id={`selectbyurl_options_item_${option.value}`}
            data-testid={`selectbyurl_options_item_${option.value}`}
        >
            <span
                className="flex gap-2 items-center"
                data-testid={formatTestId("selectbyurl_item", `label_${option.label}`)}
                id={formatTestId("selectbyurl_item", `label_${option.label}`)}
            >
                {option.icon}
                {isTranslated ? t(`fieldsClient.${option.label}`) : option.label}
            </span>
        </SelectItem>
    ));
};
export const SelectByUrl = ({
    setFieldValue,
    name = "",
    value = null,
    url = "",
    keyQuery = "",
    itemLabel = "",
    label = "",
    error,
    touched,
    method = "post",
    typeForm = null,
    handleCustomer = null,
    customFilter = {},
    enabledMode = true,
    valueFrom = "",
    filtro = [],
    useSearchDefault = true,
    isTranslated = false,
    onClear,
    ensureSelectedInOptions = false,
    errorLayout = "inline",
    ...props
}) => {
    const { t } = useTranslation();
    const [options, setOptions] = useState([]);
    const { data, isLoading } = useQuery({
        queryKey: [keyQuery],
        queryFn: async () => {
            if (method === "post") {
                return genericSearch(`${url}/search`, filtro, null, null, useSearchDefault, customFilter);
            } else {
                return genericView(url);
            }
        },
        refetchOnWindowFocus: false,
        retry: 1,
        staleTime: 1000 * 60 * 60,
        enabled: !!enabledMode,
    });

    const { data: selectedData } = useQuery({
        queryKey: [keyQuery, "selected", value],
        queryFn: () =>
            genericSearch(
                `${url}/search`,
                [{ field: "id", operator: "eq", value, type: "AND" }],
                { limit: 1, offset: 0 },
                null,
                useSearchDefault,
                customFilter,
            ),
        refetchOnWindowFocus: false,
        retry: 1,
        staleTime: 1000 * 60 * 60,
        enabled: !!enabledMode && ensureSelectedInOptions && Boolean(value),
    });

    useEffect(() => {
        if (!data) return;

        if (handleCustomer) {
            handleCustomer(data, setOptions, name);
            return;
        }

        if (typeForm) {
            const isObject = Object.prototype.toString.call(data) === "[object Object]";
            const newValues = isObject ? typeForm(fromObjectToArray(data)) : typeForm(data);
            setOptions(newValues);
            return;
        }

        const items = data.data || data;

        if (Array.isArray(items) && items.length > 0) {
            setOptions(
                items
                    ?.map((item) => {
                        const value = getNestedValue(item, valueFrom) ?? item.id;
                        const label = getNestedValue(item, itemLabel) ?? t("Sin nombre");

                        return { value, label };
                    })
                    .filter((option) => option.value !== undefined),
            );
        }
    }, [data, valueFrom, itemLabel, handleCustomer, typeForm, name]);

    useEffect(() => {
        if (!ensureSelectedInOptions || !value) return;
        const items = selectedData?.data || [];
        if (!Array.isArray(items) || items.length === 0) return;

        setOptions((prev) => {
            if (prev.some((opt) => opt.value === value)) return prev;

            const parsed = items
                .map((item) => ({
                    value: getNestedValue(item, valueFrom) ?? item.id,
                    label: getNestedValue(item, itemLabel) ?? t("Sin nombre"),
                }))
                .filter((opt) => opt.value !== undefined);

            const selected = parsed.find((opt) => opt.value === value);
            if (!selected) return prev;
            return [selected, ...prev];
        });
    }, [ensureSelectedInOptions, value, selectedData, valueFrom, itemLabel, t]);

    useEffect(() => {
        setFieldValue(name, value);
    }, [value]);

    return (
        <div className="flex flex-col gap-2">
            <div
                className={errorLayout === "stacked" ? "flex flex-col gap-1" : "flex justify-between"}
                id={`selectbyurl_wrapper_${name}`}
                data-testid={`selectbyurl_wrapper_${name}`}
            >
                <Label
                    className={cn(error && touched && "border-redCustom text-redCustom")}
                    id={`selectbyurl_label${name}`}
                    data-testid={`selectbyurl_label${name}`}
                >
                    {t(label)}
                </Label>
                {error && touched && (
                    <Label
                        className="text-redCustom"
                        data-testid={`selectbyurl_error_${name}`}
                        id={`selectbyurl_error_${name}`}
                    >
                        {error}
                    </Label>
                )}
            </div>
            <div className="flex items-center gap-2">
                <Select
                    id={`selectbyurl_${name}`}
                    data-testid={`selectbyurl_${name}`}
                    onValueChange={(value) => {
                        setFieldValue(name, value);
                    }}
                    value={value}
                    {...props}
                >
                    <SelectTrigger
                        className={cn("w-full", error && touched && "border-redCustom text-redCustom")}
                        id={`btn_selectbyurl_trigger_${value || "empty"}`}
                        data-testid={`btn_selectbyurl_trigger_${value || "empty"}`}
                    >
                        <SelectValue
                            placeholder={isLoading ? t("Cargando...") : t("app.forms.options")}
                            id="selectbyurl_value_option"
                            data-testid="selectbyurl_value_option"
                        />
                    </SelectTrigger>
                    <SelectContent id={`selectbyurl_content_${name}`} data-testid={`selectbyurl_content_${name}`}>
                        <SelectGroup defaultValue={value}>
                            <SelectLabel data-testid={`selectbyurl_group_${name}`} id={`selectbyurl_group_${name}`}>
                                {t("actions.form.options")}
                            </SelectLabel>
                            {renderSelectContent({ isLoading, options, t, isTranslated })}
                        </SelectGroup>
                    </SelectContent>
                </Select>
                {value && (
                    <X
                        className="h-4 w-4 opacity-60 hover:opacity-100 cursor-pointer"
                        onClick={() => {
                            setFieldValue(name, "");
                            onClear?.();
                        }}
                        id={formatTestId("selectbyurl_reset", `${label || name}`)}
                        data-testid={formatTestId("selectbyurl_reset", `${label || name}`)}
                    />
                )}
            </div>
        </div>
    );
};

SelectByUrl.propTypes = {
    setFieldValue: PropTypes.func,
    name: PropTypes.string,
    value: PropTypes.string,
    url: PropTypes.string,
    keyQuery: PropTypes.oneOfType([PropTypes.string, PropTypes.array]),
    itemLabel: PropTypes.string,
    label: PropTypes.string,
    error: PropTypes.string,
    touched: PropTypes.bool,
    method: PropTypes.string,
    typeForm: PropTypes.func,
    handleCustomer: PropTypes.func,
    valueFrom: PropTypes.string,
    filtro: PropTypes.array,
    useSearchDefault: PropTypes.bool,
    customFilter: PropTypes.object,
    enabledMode: PropTypes.bool,
    isTranslated: PropTypes.bool,
    onClear: PropTypes.func,
    ensureSelectedInOptions: PropTypes.bool,
    errorLayout: PropTypes.oneOf(["stacked", "inline"]),
};
