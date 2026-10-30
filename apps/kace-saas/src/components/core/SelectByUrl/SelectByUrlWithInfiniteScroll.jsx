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
import { useInfiniteQuery } from "@tanstack/react-query";
import PropTypes from "prop-types";
import { useEffect, useState, useMemo } from "react";
import { genericSearch, LIMIT_PAG } from "../../../services/genericSearch";
import { genericView } from "../../../services/genericView";
import { useTranslation } from "react-i18next";
import { fromObjectToArray, getNestedValue } from "./utils/objectUtils";
import { X } from "lucide-react";
import { formatTestId } from "@/utils/src/helpers";

export const SelectByUrlWithInfiniteScroll = ({
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
    errorLayout = "inline",
    ...props
}) => {
    const { t } = useTranslation();

    const [options, setOptions] = useState([]);
    const [search, setSearch] = useState("");
    const [open, setOpen] = useState(false);

    const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
        queryKey: [keyQuery],
        queryFn: async ({ pageParam = 0 }) => {
            if (method === "post") {
                return genericSearch(
                    `${url}/search`,
                    filtro,
                    {
                        limit: LIMIT_PAG,
                        offset: pageParam * LIMIT_PAG,
                    },
                    null,
                    useSearchDefault,
                    customFilter,
                );
            }
            return genericView(url);
        },

        getNextPageParam: (lastPage, pages) => {
            const totalLoaded = pages.reduce((acc, page) => acc + (page.data?.length || 0), 0);

            const total = lastPage?.count || 0;

            if (totalLoaded >= total) return undefined;

            return pages?.length;
        },
        keepPreviousData: true,
        enabled: !!enabledMode,
    });

    useEffect(() => {
        if (!data) return;

        const allItems = data.pages?.flatMap((page) => page?.data) || [];

        if (handleCustomer) {
            handleCustomer(allItems, setOptions, name);
            return;
        }

        if (typeForm) {
            const isObject = Object.prototype.toString.call(allItems) === "[object Object]";

            const newValues = isObject ? typeForm(fromObjectToArray(allItems)) : typeForm(allItems);

            setOptions(newValues);
            return;
        }

        setOptions(
            allItems.map((item) => ({
                value: getNestedValue(item, valueFrom) ?? item.id,
                label: getNestedValue(item, itemLabel) ?? t("Sin nombre"),
            })),
        );
    }, [data]);

    const filteredOptions = useMemo(() => {
        if (!search) return options;

        return options.filter((opt) => opt.label.toLowerCase().includes(search.toLowerCase()));
    }, [options, search]);

    useEffect(() => {
        setFieldValue(name, value);
    }, [value]);

    const handleScroll = (e) => {
        const target = e.target;

        const isBottom = target.scrollTop + target.clientHeight >= target.scrollHeight - 10;

        if (isBottom && hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
        }
    };

    const renderOptions = () => {
        const hasData = filteredOptions?.length > 0;

        if (isLoading && !hasData) {
            return (
                <div className="flex justify-center items-center p-4 h-36 w-full">
                    <GeneralLoader />
                </div>
            );
        }

        return (
            <>
                {filteredOptions?.map((option, index) => (
                    <SelectItem value={option.value} key={`${option.value}-${index}`}>
                        {isTranslated ? t(`fieldsClient.${option.label}`) : option.label}
                    </SelectItem>
                ))}

                {isFetchingNextPage && (
                    <div className="flex justify-center p-2 text-sm text-gray-400">
                        {t("generalSetup.form.labels.loading")}
                    </div>
                )}
            </>
        );
    };

    const handleOpenChange = (isOpen) => {
        setOpen(isOpen);

        if (!isOpen) {
            setSearch("");
        }
    };

    return (
        <div className="flex flex-col gap-2">
            <div className={errorLayout === "stacked" ? "flex flex-col gap-1" : "flex justify-between"}>
                <Label className={cn(error && touched && "border-redCustom text-redCustom")}>{t(label)}</Label>

                {error && touched && <Label className="text-redCustom">{error}</Label>}
            </div>

            <div className="flex items-center gap-2">
                <Select
                    open={open}
                    onOpenChange={handleOpenChange}
                    onValueChange={(value) => setFieldValue(name, value)}
                    value={value}
                    {...props}
                >
                    <SelectTrigger className={cn("w-full", error && touched && "border-redCustom text-redCustom")}>
                        <SelectValue
                            placeholder={isLoading ? t("generalSetup.form.labels.loading...") : t("app.forms.options")}
                        />
                    </SelectTrigger>

                    <SelectContent onScroll={handleScroll} className="max-h-60 overflow-auto">
                        <div className="p-2 sticky top-0 z-10 bg-white border-b shadow-sm">
                            <input
                                type="text"
                                placeholder="Buscar..."
                                className="w-full border rounded px-2 py-1 text-sm"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>

                        <SelectGroup>
                            <SelectLabel>{t("actions.form.options")}</SelectLabel>

                            {renderOptions()}
                        </SelectGroup>
                    </SelectContent>
                </Select>

                {value && (
                    <X
                        className="h-4 w-4 cursor-pointer"
                        onClick={() => setFieldValue(name, "")}
                        id={formatTestId("selectbyurl_reset", `${label || name}`)}
                    />
                )}
            </div>
        </div>
    );
};

SelectByUrlWithInfiniteScroll.propTypes = {
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
    errorLayout: PropTypes.oneOf(["stacked", "inline"]),
};
